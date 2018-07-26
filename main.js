// https://www.dentalpromotion.fr/instruments-nickel-titane-146/protaper-gold-f4-31mm-6pcs--68108.html

const fs = require('fs');
const util = require('util');

const cheerio = require('cheerio');
const json2xls = require('json2xls');
const mongoose = require('mongoose');
const request = require('request');
const sleep = require('system-sleep');

const writeFile = util.promisify(fs.writeFile);

const brandsUrl = 'https://www.dentalpromotion.fr/achat/marque.php?id=';
const brandFirstIndex = 0;
const brandLastIndex = 200;

const categoriesUrl = 'https://www.dentalpromotion.fr/achat/cat-x-{id}.html';
const categoryFirstIndex = 0;
const categoryLastIndex = 400;
const dbUrl = 'mongodb://localhost/coya';
const byBrandDbFile = './database/item-links-by-brand.txt';
const byCategoryDbFile = './database/item-links-by-category.txt';
const lotsFile = './lots.txt'
const outputFile = './ouput.xlsx';

const TinyDB = require('./tiny_db');
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

async function getProductLinksFromCategories(index) {
    const url = categoriesUrl.replace('{id}', index);
    console.log('Requesting ' + url + '...');
    let html;
    try {
        html = await doRequest(url);
    }
    catch(e) {
        console.error(e);
        process.exit(1);
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
        if(e  == 'Bad status code : 403')
            return null;
        else {
            console.error(e);
            process.exit(1);
        }
    }
    let $ = cheerio.load(html);

    let designationAndReference = $('div.fp_produit > h4');
    let lotExplanationTable = $('div.lot_explanation_table').text();
    if(lotExplanationTable)
        await writeFile(lotsFile, lotExplanationTable + '\n', {flag: 'a'});

    let result = {
        url: url,
        designation: $('h1.titre_produit').text(),
        reference: $(designationAndReference[0]).text().replace('Référence ', ''),
        barcode: $(designationAndReference[1]).text().replace('Code-barres : ', ''),
        brand: $('div.fp_produit > h3 a').text() || null,
        currentPrice: $('span.prix > span').text().replace(',', '.').replace(' ', '') || null,
        priceBefore: $('td.middle > del').text().replace(' €', '').replace(',', '.').replace(' ', '') || null
    };

    let lotBy;
    for(index of [3, 4, 6, 8, 10]) {
        lotBy = new RegExp('Par ' + index + ' \: ([0-9, ]+) € TTC').exec(lotExplanationTable);
        result['lotBy' + index] = lotBy && lotBy[1].replace(',', '.').replace(' ', '');
    }

    return result;
}

async function markItemLinkAsProcessed(itemLink) {
    console.log('Marking the last processed item link as processed...');
    try {
        itemLink.processed = true;
        await itemLink.save();
    }
    catch(e) {
        console.error(e);
        process.exit(1);
    }
}

async function saveItemInDatabase(itemData) {
    try {
        const item = new Item(itemData);
        await item.validate();
        await item.save();
        console.log('Item saved in database.');
        console.log(itemData);
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

async function saveItemLinksInDatabase() {
    try {
        await mongoose.connect(dbUrl);
    }
    catch(e) {
        console.error(e);
        process.exit(1);
    }

    const byBrandDb = new TinyDB(byBrandDbFile);
    await byBrandDb.load();
    const byCategoryDb = new TinyDB(byCategoryDbFile);
    await byCategoryDb.load();

    let counter;
    let itemLink;
    for(let db of [byCategoryDb.get(), byBrandDb.get()]) {
        counter = 0;
        for(let url of db) {
            itemLink = new ItemLink({url: url, processed: false});
            try {
                await itemLink.validate();
                await itemLink.save();
                counter++;
            }
            catch(e) {
                if(e.message.indexOf('E11000 duplicate key error collection') == -1) {
                    console.error(e);
                    process.exit(1);
                }
            }
        }
        console.log(counter);
    }

    const itemLinks = await ItemLink.find();
    console.log(itemLinks.length);

    process.exit(0);
}

(async function main() {
    try {
        await mongoose.connect(dbUrl);
    }
    catch(e) {
        console.error(e);
        process.exit(1);
    }

    const itemLinks = await ItemLink.find({processed: false});
    let data;
    let i = 0;
    for(let itemLink of itemLinks) {
        console.log('Processing item with url = "' + itemLink.url + '"...');
        data = await scrapProductData(itemLink.url);
        if(data)
            await saveItemInDatabase(data);
        await markItemLinkAsProcessed(itemLink);

        console.log((++i) + '/' + itemLinks.length);
        sleep(1000);
    }

    const xls = json2xls(await Item.find(), {
        fields: ['url', 'designation', 'reference', 'barcode', 'brand', 'currentPrice', 'priceBefore', 'lotBy3', 'lotBy4', 'lotBy6', 'lotBy8']
    });

    await writeFile(outputFile, xls, 'binary');
    process.exit(0);
})();