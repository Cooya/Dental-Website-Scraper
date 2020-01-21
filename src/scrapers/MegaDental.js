const cheerio = require('cheerio');
const parseString = require('xml2js').parseString;
const querystring = require('querystring');
const util = require('util');
const utils = require('@coya/utils');
const uuidv1 = require('uuid/v1');

const Item = require('../models/MegaDentalItem');
const Link = require('../models/Link');
const Scraper = require('./Scraper');

const BASE_URL = 'https://www.megadental.fr';
const SITE_MAP_URL = 'https://www.megadental.fr/sitemap.xml';
const SPECS_LIST = [
	'Code Article fournisseur',
	'Dispositif Medical',
	'Description',
	'Marque',
	'Présentation',
	'Taille',
	'Mandrin',
	'Type de fraises',
	'Compatibilité Turbine / Contre Angle',
	'Forme générale',
	'Grain'
];

const parseXML = util.promisify(parseString);
const requestOptions = {
	timeout: 30000,
	headers: { 'User-Agent':'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:72.0) Gecko/20100101 Firefox/72.0' }
};

module.exports = class MegaDental extends Scraper {
	constructor() {
		super('MegaDental');
	}

	async analyseSiteMap() {
		console.log('Analysing sitemap...');
		const xml = await utils.request('get', SITE_MAP_URL);
		const json = await parseXML(xml);

		const linksInDatabase = await Link.countDocuments({ origin: this.origin, type: 'item' });
		if(linksInDatabase == json.urlset.url.length) {
			console.log('Items collection up-to-date.');
			return;
		}

		for (let url of json.urlset.url) {
			if(await Link.findOne({ origin: this.origin, type: 'item', url: url.loc[0] }))
				continue;

			await (new Link({ origin: this.origin, type: 'item', url: url.loc[0] })).customSave();

			// if (link.match(/https:\/\/www\.megadental\.fr\/[a-z0-9-]+\/[a-z0-9-]+\.html/)) {
			// 	link = new Link({origin: this.origin, type: 'category', url: link});
			// 	await link.customSave();
			// } else if (link.match(/https:\/\/www\.megadental\.fr\/[a-z0-9-]+\.html/)) {
			// 	link = new Link({origin: this.origin, type: 'item', url: link});
			// 	await link.customSave();
			// }
		}
	}

	async retrieveAllCategoryLinks() {
		// gathering without sitemap
		console.log(`Request to ${BASE_URL}...`);
		const $ = await utils.get(BASE_URL, requestOptions);

		const submenus = await $('.submenu.dropdown-menu').get();
		for(let submenu of submenus) {
			const menuPanels = await $(submenu).find('.nav-item.level1').get();
			for(let menuPanel of menuPanels) {
				const category = $(menuPanel).find('a.nav-anchor.subitems-group > span').text();
				const subcategoryLinks = $(menuPanel).find('div.nav-item.level2 > a.nav-anchor').get();
				for(let subcategoryLink of subcategoryLinks) {
					subcategoryLink = new Link({ origin: this.origin, type: 'category', url: $(subcategoryLink).attr('href'), data: { category, subcategory: $(subcategoryLink).text() } });
					await subcategoryLink.customSave();
				}
			}
		}

		// gathering with sitemap
		// const categoryLinksCount = await Link.countDocuments({ origin: this.origin, type: 'category' });
		// if (categoryLinksCount < CATEGORY_LINKS_COUNT)
		// 	await this.analyseSiteMap();

		console.log('All category links have been retrieved.');
		console.log('%s category links are in database.', await Link.find({ origin: this.origin, type: 'category' }).countDocuments());
	}

	async retrieveItemLinks(categoryUrl, data) {
		let page = 1;
		while(true) {
			console.log(`Request to ${categoryUrl + '?p=' + page}...`);
			const $ = await utils.get(categoryUrl + '?p=' + page, requestOptions);

			const itemLinks = await utils.getLinks($, 'ol.products.list a.product-item-link');
			console.log('%s item links found on the page.', itemLinks.length);

			for (let itemLink of itemLinks) {
				itemLink = new Link({ origin: this.origin, type: 'item', url: itemLink, data });
				await itemLink.customSave();
			}

			if(!$('li.item.pages-item-next').length)
				break;
			page++;
		}
	}

	async retrieveItem(itemUrl, data) {
		console.log(`Processing item "${itemUrl}"...`);
		let $;
		while(true) {
			try {
				$ = await utils.get(itemUrl, requestOptions);
				break;
			} catch(e) {
				console.warn('Timeout, trying again...');
				if(e.message.indexOf('timeout') !== -1);
				else throw e;
			}
		}
		if (!$)
			return 1; // 404 error or response body empty, we can mark the item as processed
		if(!$('h1.page-title').length) {
			console.log(`"${itemUrl}" is a category link.`);
			return 1;
		}

		const specs = $('table th').get();
		for(let spec of specs)
			if(!SPECS_LIST.includes($(spec).text()))
				throw new Error(`Unknown spec "${$(spec).text()}" for "${itemUrl}".`);

		if($('#product-options-wrapper').length) {
			const optionsData = JSON.parse($('#product-options-wrapper script[type="text/x-magento-init"]').html());

			let json;
			try {
				json = optionsData['#product_addtocart_form'].configurable.spConfig;
			} catch(e) {
				try {
					json = optionsData['[data-role=swatch-options]']['Magento_Swatches/js/swatch-renderer']['jsonConfig'];
				} catch(e) {
					json = null;
				}
			}
			if(json) {
			
				// build products list with url
				const products = json.index;
				let url;
				for (let [pId, pValue] of Object.entries(products)) {
					url = itemUrl + '#';
					for (let [specId, optionId] of Object.entries(pValue))
						url += specId + '=' + optionId + '&';
					url = url.substring(0, url.length - 1);
					products[pId] = {
						origin: this.origin,
						category: data.category,
						subcategory: data.subcategory,
						url,
						attributes: []
					};
				}
				
				// add options for every attribute
				const attributes = Object.values(json.attributes);
				if(attributes.length > 7) throw new Error('More than 7 attributes !');
				for(let i = 0; i < attributes.length; ++i) {
					for(let option of attributes[i].options) {
						for(let productId of option.products) {
							products[productId].attributes.push({
								label: attributes[i].label,
								value: option.label
							});
						}
					}
				}
				
				for (let [key, val] of Object.entries(json.product_information)) {
					if(key == 'default') continue;
					products[key].designation = val.name.value;
				}

				if(json.dynamic.code_mega)
					for (let [key, val] of Object.entries(json.dynamic.code_mega)) {
						products[key].reference = val.value;
					}

				if(json.dynamic.code_art_fournisseur)
					for (let [key, val] of Object.entries(json.dynamic.code_art_fournisseur)) {
						products[key].supplierArticleCode = val.value;
					}

				if(json.dynamic.presentation)
					for (let [key, val] of Object.entries(json.dynamic.presentation)) {
						products[key].presentation = val.value.trim() || null;
					}

				for (let [key, val] of Object.entries(json.dynamic.description)) {
					products[key].description = cheerio.load(val.value).text().trim() || null;
				}

				if(json.dynamic.marque)
					for (let [key, val] of Object.entries(json.dynamic.marque)) {
						products[key].brand = val.value;
					}
				
				for (let [key, val] of Object.entries(json.optionPrices)) {
					products[key].prices = [];
					for(let tierPrice of Object.values(val.tierPrices)) {
						products[key].prices.push({
							quantity: tierPrice.qty,
							basePrice: val.basePrice.amount,
							discountPrice: tierPrice.price
						});
					}

					if(Object.values(val.tierPrices).length > 4)
						throw new Error('More than 4 tier prices !');
				}

				let itemsCounter = 0;
				for(let product of Object.values(products)) {
					if(!product.brand) product.brand = null;
					if(!product.presentation) product.presentation = null;
					if(!product.supplierArticleCode) product.supplierArticleCode = null;
					if(!product.reference) product.reference = 'no-ref-' + uuidv1();
					await Item.newItem(product);
					itemsCounter++;
				}
				return itemsCounter;
			}
		}

		// parse prices in yellow area
		const yellowPrices = $('div.price-final_price span.price').get();
		const basePrice = Number($(yellowPrices[yellowPrices.length - 1]).text().replace('€', '.').replace(/[^0-9.]/g, ''));
		const discountPrice = yellowPrices.length > 1 ? Number($(yellowPrices[0]).text().replace('€', '.').replace(/[^0-9.]/g, '')) : null;

		let prices = [];
		const tierPrices = $('ul.prices-tier > li').get();
		if(tierPrices.length) { // if there is tier prices to the right-hand side
			for(let tierPrice of tierPrices) {
				prices.push({
					quantity: parseInt($(tierPrice).text().match(/Achetez-en ([0-9]+) pour/)[1]),
					basePrice,
					discountPrice: Number($(tierPrice).find('span.price-wrapper').attr('data-price-amount'))
				});
			}
		}
		else {
			prices.push({
				quantity: 1,
				basePrice,
				discountPrice 
			});
		}

		await Item.newItem({
			origin: this.origin,
			category: data.category,
			subcategory: data.subcategory,
			url: itemUrl,
			designation: $('h1.page-title > span').text().trim() || 'Pas de désignation',
			reference: $('div[itemprop="sku"]').text().trim() || 'no-ref-' + uuidv1(),
			supplierArticleCode: $('td[data-th="Code Article fournisseur"]').text() || null,
			presentation: $('td[data-th="Présentation"]').text().trim() || null,
			attributes: [],
			description: $('div.description').text().trim() || null,
			brand: $('td[data-th="Marque"]').text().trim() || null,
			prices
		});

		return 1;

		// if (!reference) {
		// 	let firstRoute = getFirstRoute($, articleId);
		// 	//console.debug(firstRoute);

		// 	const routes = [];
		// 	await determineNextRoutes(articleId, routes, firstRoute);
		// 	//console.debug(routes);

		// 	const retrieveArticle = async (route) => {
		// 		const dynamicData = await requestDynamicData(articleId, route);
		// 		//console.debug(dynamicData);
		// 		if (dynamicData) {
		// 			await Item.newItem({
		// 				origin: this.origin,
		// 				url: itemUrl,
		// 				designation,
		// 				reference: dynamicData.reference,
		// 				presentation: route[0],
		// 				size: route[1],
		// 				color: route[2],
		// 				type: route[3],
		// 				description,
		// 				brand,
		// 				price: dynamicData.price,
		// 				discountPrice: dynamicData.discountPrice
		// 			});
		// 			itemsCounter++;
		// 		}
		// 	};

		// 	await utils.asyncForEach(routes, retrieveArticle);
		// } else {
		// 	let price = $('div.prix-public').text() || $('div.prix').text();
		// 	let discountPrice = $('div.prix-public').text() && $('div.prix').text();

		// 	const route = getFirstRoute($, articleId);
		// 	await Item.newItem({
		// 		origin: this.origin,
		// 		url: itemUrl,
		// 		designation,
		// 		reference,
		// 		presentation: route[0],
		// 		size: route[1],
		// 		color: route[2],
		// 		type: route[3],
		// 		description,
		// 		brand,
		// 		price: /([0-9.]+)€/.exec(price)[1],
		// 		discountPrice: discountPrice ? /([0-9.]+)€/.exec(discountPrice)[1] : null
		// 	});
		// 	itemsCounter++;
		// 	//await sleep(3);
		// }
	}

	lintItem(item) {
		for(let i = 0; i < item.attributes.length; ++i) {
			item['attributeName' + (i + 1)] = item.attributes[i].label;
			item['attributeValue' + (i + 1)] = item.attributes[i].value;
		}
		delete item.attributes;
		for(let i = 0; i < item.prices.length; ++i) {
			item['quantity' + (i + 1)] = item.prices[i].quantity;
			item['price' + (i + 1)] = item.prices[i].basePrice || item.prices[i].price; // key mistake, it should be "basePrice" only
			item['discountPrice' + (i + 1)] = item.prices[i].discountPrice;
		}
		if(item.price1 == item.discountPrice1)
			item.discountPrice1 = null;
		delete item.prices;
		if(item.reference.startsWith('no-ref')) item.reference = null;
	}
};

// eslint-disable-next-line no-unused-vars
function getFirstRoute($, articleId) {
	const route = [];
	for (let i = 0; i < 4; ++i) {
		const formGroup = $('#select' + i + '_' + articleId);
		if (!formGroup.length) {
			console.warn('A form group has not been found...');
			route.push(null);
		} else {
			let text = $(formGroup).find('input').attr('value');
			if (text) route.push(text);
			else route.push($(formGroup).find('option').length ? 'javascript:void(0)' : null);
		}
	}
	return route;
}

// eslint-disable-next-line no-unused-vars
async function determineNextRoutes(articleId, routesArray, route) {
	for (let i = 0; i < route.length; ++i) {
		if (route[i] == 'javascript:void(0)') {
			let newRoutes = (await requestPossibilities(articleId, route, i)).map((possibility) => {
				const newRoute = route.slice(0);
				newRoute[i] = possibility;
				return newRoute;
			});
			await utils.asyncForEach(newRoutes, determineNextRoutes.bind(null, articleId, routesArray));
			return;
		}
	}
	routesArray.push(route);
}

async function requestPossibilities(articleId, route, i) {
	const article = await requestArticleToBoutique(articleId, route, i > 0 ? i - 1 : null);
	const $ = cheerio.load((article.selected.tab.length && article.selected.tab[i]._) || article.selected.tab._);

	let options = $('select:enabled > option:enabled');
	if (!options.length) {
		options = [$('p.form-control-static input').val()];
		if (!options[0]) {
			console.error(route, i);
			throw new Error('No option found at this index.');
		}
		return options;
	}

	const possibilities = [];
	options.map((i, option) => {
		if ($(option).val() == 'javascript:void(0)') return;
		possibilities.push($(option).val());
	});

	return possibilities;
}

// eslint-disable-next-line no-unused-vars
async function requestDynamicData(articleId, route) {
	console.log('Requesting dynamic data...');
	const article = await requestArticleToBoutique(articleId, route);
	if (article.id == '-999') {
		console.error('The parameters for this article are not valid.');
		return null;
	}

	let price = article.prix_public.trim() || article.prix.trim();
	let discountPrice = article.prix_public.trim() && article.prix.trim();

	return {
		reference: article.reference.trim(),
		price: /([0-9.]+)€/.exec(price)[1],
		discountPrice: discountPrice ? /([0-9.]+)€/.exec(discountPrice)[1] : null
	};
}

async function requestArticleToBoutique(articleId, route, last = null) {
	const str = route.filter((val) => !!val).join('|') + '|';
	const data = await utils.request('get', BASE_URL + '/boutique/lib.tpl.php?art=' + articleId + '&str=' + querystring.escape(str) + (last ? '&last=' + last : ''));
	const json = await parseXML(data, { explicitArray: false });
	if (!json.article) throw new Error('No article returned.');
	return json.article;
}

// eslint-disable-next-line no-unused-vars
function determineOptionsPossibilities(optionsArray) {
	optionsArray = optionsArray.filter((value) => !!value);

	const result = [];
	for (let row1 of optionsArray[0]) {
		if (optionsArray.length > 1) {
			for (let row2 of optionsArray[1]) {
				if (optionsArray.length > 2) {
					for (let row3 of optionsArray[2]) {
						if (optionsArray.length > 3) {
							for (let row4 of optionsArray[3]) result.push([row1, row2, row3, row4]);
						} else result.push([row1, row2, row3]);
					}
				} else result.push([row1, row2]);
			}
		} else result.push([row1]);
	}
	return result;
}
