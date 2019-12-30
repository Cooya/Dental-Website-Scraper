const assert = require('assert');
const utils = require('@coya/utils');

const Counter = require('../models/Counter');
const Item = require('../models/HenryScheinItem');
const Link = require('../models/Link');
const Scraper = require('./Scraper');

const BASE_URL = 'https://www.henryschein.fr';
const PRODUCTS_URL = 'https://www.henryschein.fr/fr-fr/Shopping/ProductBrowser.aspx';
const ORIGIN = 'HenrySchein';
const COOKIES = 'Commerce_TestPersistentCookie=TestCookie; Commerce_TestSessionCookie=TestCookie; ASP.NET_SessionId=w4fhg5q0h3sykb1y4v3bwxsu; HSCSProfile=HSCSProfile=%7ba6264d5c-7518-43b7-8a50-6634c95a6c41%7d&PreferredCultureId=fr-FR&ExchangeMessage=&ShowProductsPicture=False; OneWeb=DivisionId=dental; OneWebSessionCookie=AccordianMenuActiveIndex=0&GetNextCounter=4130&BrowseSupply_ContShoppingKey=%2ffr-fr%2fShopping%2fProductBrowser.aspx%3fpagenumber%3d1&LastViewedProducts=896-1129%2c896-1973%2c894-2456; CampaignHistory=2907,2868,2913,2902,2857,2907,2868,2913,2902,2857,2907,2868,2913,2902,2857,2907,2868,2913,2902,2857,2907,2868,2913,2902,2857,2907,2868,2913,2902,2857,2907,2868,2913,2902,2857; TestCookie=ok; france_website#lang=fr-FR';

const resolveUrl = utils.resolveUrl.bind(null, BASE_URL);

module.exports = class HenrySchein extends Scraper {
	constructor() {
		super(ORIGIN);
	}

	async retrieveAllCategoryLinks() {
		console.log('No category link to fetch.');
	}

	async retrieveAllItemLinks() {
		console.log('Fetching item links...');
		const counter = await Counter.get('henry_schein_page_number', 1);
		while (true) {
			const $ = await utils.get(PRODUCTS_URL + '?pagenumber=' + counter.value, { headers: { Cookie: COOKIES }, encoding: 'iso-8859-15' });
			const itemLinks = $('h2.product-name > a');
			if (!itemLinks.length) break;
			for (let itemLink of itemLinks.get()) {
				let link = new Link({ type: 'item', origin: ORIGIN, url: resolveUrl($(itemLink).attr('href')) });
				await link.customSave();
			}

			console.log('Page %s processed.', counter.value);
			await counter.inc();
		}
		console.log('%s item links are in database.', await Link.find({ type: 'item', origin: ORIGIN }).countDocuments());
	}

	async retrieveItem(itemUrl) {
		const $ = await utils.get(itemUrl, { headers: { Cookie: COOKIES }, encoding: 'iso-8859-15' });

		if ($('article h1').text().trim() == 'Ce produit est introuvable. Il n\'existe plus dans le catalogue actuel.') {
			console.warn('The item at the url "' + itemUrl + '" does not exist anymore.');
			return;
		}

		const designation = $('h1.title').text();
		const title = designation.split(' - ').filter((val) => !!val.trim());
		const subtitleSplit = $('div.page-title small').text().split(' | ');
		const subtitlePart1 = subtitleSplit[0].split(' / ');
		const crossedPrice = $('div.value > s').text().trim();
		const refsAndBrand = $('h2.product-title:nth-child(1) > small').text().replace(/\n/g, ' ');
		const finalAttr = title[title.length - 1].trim();
		let pricesByLot = [];
		const prices = $('aside.price-opts > strong').text().trim();
		if (prices.indexOf('Prix non disponible') != -1) pricesByLot.push({ soldBy: 1, commonPrice: 0, discountPrice: null });
		else {
			for (let price of prices.split('  ')) {
				if (price.indexOf('x') == -1) {
					// no price by lot
					pricesByLot.push({
						soldBy: 1,
						commonPrice: crossedPrice ? crossedPrice : price,
						discountPrice: crossedPrice ? price : null
					});
				} else {
					const values = /x([0-9]+) ([0-9 ]+,[0-9]+)/.exec(price);
					pricesByLot.push({ soldBy: values[1], commonPrice: values[2], discountPrice: null });
				}
			}
		}

		let counter = 0;
		for (let priceByLot of pricesByLot) {
			const itemData = {
				origin: ORIGIN,
				url: itemUrl,
				family: subtitlePart1[0].trim(),
				subfamily: subtitlePart1[1].trim(),
				designation,
				attr1: title.length > 2 ? title[1].trim() : null,
				attr2: title.length > 3 ? title[2].trim() : null,
				attr3: title.length > 4 ? title[3].trim() : null,
				finalAttr: finalAttr != designation ? finalAttr : null,
				reference: refsAndBrand.split(' | ')[0].trim(),
				providerRef: refsAndBrand.split(' | ')[1].split(' - ')[1].trim(),
				brand: refsAndBrand.split(' | ')[1].split(' - ')[0].trim(),
				description: $('li.customer-notes div.value').text().trim(),
				soldBy: priceByLot.soldBy,
				commonPrice: priceByLot.commonPrice ? extractPriceAsNumber(priceByLot.commonPrice) : null,
				discountPrice: priceByLot.discountPrice ? extractPriceAsNumber(priceByLot.discountPrice) : null
			};
			await Item.newItem(itemData);
			counter++;
		}

		return counter;
	}
};

function extractPriceAsNumber(price) {
	price = /[0-9\s]+[,|.][0-9]+/
		.exec(price)[0]
		.replace(/,/g, '.')
		.replace(/\s/g, '');
	return parseFloat(price);
}

assert.equal(extractPriceAsNumber('3 641,49 €'), 3641.49);
