// https://www.dentalpromotion.fr/instruments-nickel-titane-146/protaper-gold-f4-31mm-6pcs--68108.html

const fs = require('fs');
const util = require('util');

const cheerio = require('cheerio');
const json2xls = require('json2xls');
const mongoose = require('mongoose');
const request = require('request');
const sleep = require('system-sleep');

const writeFile = util.promisify(fs.writeFile);

// urls and indexes
const brandsUrl = 'https://www.dentalpromotion.fr/achat/marque.php?id=';
const brandFirstIndex = 0;
const brandLastIndex = 200;
const categoriesUrl = 'https://www.dentalpromotion.fr/achat/cat-x-{id}.html';
const completeCategoryUrlSuffix = '?nombre=*&multipage=session_multipage_affiche_produits';
const categoryFirstIndex = 0;
const categoryLastIndex = 400;

// input/output
const dbUrl = 'mongodb://localhost:27017/coya';
const outputFile = './output/output.xlsx';

// database models
const CategoryLink = require('./models').CategoryLink;
const ItemLink = require('./models').ItemLink;
const Item = require('./models').Item;

function doRequest(url) {
    return new Promise(function (resolve, reject) {
        request(url, {followAllRedirects: true}, function (error, res, body) {
            if(error)
                reject(error);
            else if(res.statusCode != 200)
                reject('Bad status code : ' + res.statusCode);
            else
                resolve(body);
        });
    });
}

function doRedirectedRequest(url) {
    return new Promise(function (resolve, reject) {
        request(url, {followRedirect: false}, function (error, res, body) {
            if(error)
                reject(error);
            else if(res.statusCode != 200 && res.statusCode != 301 && res.statusCode != 302)
                reject('Bad status code : ' + res.statusCode);
            else
                resolve(res.headers.location);
        });
    });
}

async function getAllItemLinksFromCategories() {
    let promises = [];
    let entities = [];
    let results;
    let i = 0;
    let itemLink;
    let categoryLinksCount = await CategoryLink.estimatedDocumentCount();
    for(let categoryLink of await CategoryLink.find({processed: false})) {
        if(categoryLink.url == 'https://www.dentalpromotion.fr/achat/cat-instruments-extraction-154.html') {
            i++;
            continue;
        }
        promises.push(getItemLinksFromCategory(categoryLink.url))
        entities.push(categoryLink);

        if(++i % 10 == 0 || i == categoryLinksCount) {
            console.log('Waiting for promises...');
            results  = await Promise.all(promises);
            for(let links of results) {
                for(let link of links) {
                    console.log(link);
                    itemLink = new ItemLink({url: link, processed: false})
                    await itemLink.validate();
                    try {
                        await itemLink.save();
                    }
                    catch(e) {
                        if(e.message.indexOf('E11000 duplicate key error collection') != -1) {
                            console.error('Item already processed...');
                            return;
                        }
                
                        console.error(e);
                        process.exit(1);
                    }
                }
            }
            for(let entity of entities)
                await markEntityAsProcessed(entity);
            promises = [];
            entities = [];
        }
    }
}

async function getRealCategoryLink(index) {
    const url = categoriesUrl.replace('{id}', index);
    console.log('Requesting ' + url + '...');
    let link;
    try {
        link = await doRedirectedRequest(url);
        console.log(link);
    }
    catch(e) {
        if(e == 'Bad status code : 403')
            return null;
        else {
            console.error(e);
            process.exit(1);
        }
    }
    if(link != 'https://www.dentalpromotion.fr/')
        return link;
    return null;
}

async function getItemLinksFromCategory(categoryUrl) {
    const url = categoryUrl + completeCategoryUrlSuffix;
    console.log('Requesting ' + url + '...');
    let html;
    try {
        html = await doRequest(url);
    }
    catch(e) {
        if(e == 'Bad status code : 403')
            return null;
        else {
            console.error(e);
            process.exit(1);
        }
    }
    let $ = cheerio.load(html);
    let productLinks = [];
    $('td.fc_titre_produit > a').each((index, element) => {
        productLinks.push($(element).attr('href'));
    });
    return productLinks;
}

async function getProductLinksFromBrand(index) {
    let html = await doRequest(brandsUrl + index);
    let $ = cheerio.load(html);
    let productLinks = [];
    $('td.fc_titre_produit > a').each((index, element) => {
        productLinks.push($(element).attr('href'));
    });
    return productLinks;
}

async function scrapProductData(url) {
    let html;
    try {
        html = await doRequest(url);
    }
    catch(e) {
        if(e == 'Bad status code : 403')
            return null;
        else {
            console.error(e);
            process.exit(1);
        }
    }
    let $ = cheerio.load(html);

    let designationAndReference = $('div.fp_produit > h4');
    return {
        url: url,
        designation: $('h1.titre_produit').text(),
        reference: $(designationAndReference[0]).text().replace('Référence ', ''),
        barcode: $(designationAndReference[1]).text().replace('Code-barres : ', ''),
        brand: $('div.fp_produit > h3 a').text() || null,
        currentPrice: $('span.prix > span').text().replace(',', '.').replace(' ', '') || null,
        priceBefore: $('div.product_affiche_prix td.middle > del').text().replace(' €', '').replace(',', '.').replace(' ', '') || null,
        lots: $('div.lot_explanation_table').text() || null
    };
}

async function markEntityAsProcessed(entity) {
    console.log('Marking the last processed item link as processed...');
    try {
        entity.processed = true;
        await entity.save();
        console.log('Entry marked.');
    }
    catch(e) {
        console.error(e);
        process.exit(1);
    }
}

async function saveItemInDatabase(itemData) {
    try {
        const item = new Item(itemData);
        console.log(itemData);
        await item.validate();
        await item.save();
        console.log('Item saved in database.');
    }
    catch(e) {
        if(e.message.indexOf('E11000 duplicate key error collection') != -1) {
            console.error('Item already processed...');
            return;
        }

        console.error(e);
        process.exit(1);
    }
}

async function processItemLink(itemLink) {
    console.log('Processing item with url = "' + itemLink.url + '"...');
    let data = await scrapProductData(itemLink.url);
    if(data)
        await saveItemInDatabase(data);
    return await markEntityAsProcessed(itemLink);
}

function determineLots(items, lots) {
    let needTodetermineLots = !lots.length;
    let lot;
    items = items.map((item) => {
        item = Object.assign({}, item._doc);
        for(let j = 0; j < 505; ++j) {
            lot = new RegExp('Par ' + j + ' \: ([0-9, ]+) € TTC').exec(item.lots);
            if(lot) {
                item['lotBy' + j] = lot[1].replace(',', '.').replace(' ', '');
                if(needTodetermineLots && lots.indexOf(j) == -1)
                    lots.push(j);
            }
        }
        return item;
    });
    
    if(needTodetermineLots) {
        lots = lots.sort((a, b) => {return a - b});
        for(let i = 0; i < lots.length; ++i)
            lots[i] = 'lotBy' + lots[i];
    }
    return items;
}

(async function main() {
    try {
        await mongoose.connect(dbUrl, {useNewUrlParser: true});
    }
    catch(e) {
        console.error(e);
        process.exit(1);
    }

    // await getAllItemLinksFromCategories();
    // process.exit(0);

    // const itemLinks = await ItemLink.find({processed: false});
    // let promises = [];
    // for(let i = 0; i < itemLinks.length; ++i) {
    //     promises.push(processItemLink(itemLinks[i]))
    //     console.log(i + '/' + itemLinks.length);

    //     if(i % 10 == 0) {
    //         console.log('Waiting for promises...');
    //         await Promise.all(promises);
    //         promises = [];
    //     }
    // }
    // await Promise.all(promises);
    // process.exit(0);

    let lotFields = [
        'lotBy2',
        'lotBy3',
        'lotBy4',
        'lotBy5',
        'lotBy6',
        'lotBy8',
        'lotBy10',
        'lotBy12',
        'lotBy20',
        'lotBy30',
        'lotBy50',
        'lotBy100'
    ];
    const items = determineLots(await Item.find(), lotFields);
    console.log(lotFields);
    // process.exit(0);
    
    console.log('Building xslx data...');
    const xls = json2xls(items, {
        fields: ['url', 'designation', 'reference', 'barcode', 'brand', 'currentPrice', 'priceBefore'].concat(lotFields)
    });

    console.log('Writing into output file...');
    await writeFile(outputFile, xls, 'binary');
    process.exit(0);
})();