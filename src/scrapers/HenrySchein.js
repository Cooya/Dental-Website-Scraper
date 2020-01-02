const utils = require('@coya/utils');

const Item = require('../models/HenryScheinItem');
const Link = require('../models/Link');
const Scraper = require('./Scraper');
const sleep = require('../utils/sleep');

const CATEGORIES_URL = 'https://www.henryschein.fr/fr-fr/dental/c/browsesupplies';
const COOKIES = 'Commerce_TestPersistentCookie=TestCookie; Commerce_TestSessionCookie=TestCookie; ASP.NET_SessionId=w4fhg5q0h3sykb1y4v3bwxsu; HSCSProfile=HSCSProfile=%7ba6264d5c-7518-43b7-8a50-6634c95a6c41%7d&PreferredCultureId=fr-FR&ExchangeMessage=&ShowProductsPicture=False; OneWeb=DivisionId=dental; OneWebSessionCookie=AccordianMenuActiveIndex=0&GetNextCounter=4130&BrowseSupply_ContShoppingKey=%2ffr-fr%2fShopping%2fProductBrowser.aspx%3fpagenumber%3d1&LastViewedProducts=896-1129%2c896-1973%2c894-2456; CampaignHistory=2907,2868,2913,2902,2857,2907,2868,2913,2902,2857,2907,2868,2913,2902,2857,2907,2868,2913,2902,2857,2907,2868,2913,2902,2857,2907,2868,2913,2902,2857,2907,2868,2913,2902,2857; TestCookie=ok; france_website#lang=fr-FR';

module.exports = class HenrySchein extends Scraper {
	constructor() {
		super('HenrySchein');
	}

	async retrieveAllCategoryLinks() {
		let $, $$, link;

		console.log('Fetching category links...');
		$ = await getPage(CATEGORIES_URL);
		for(let categoryUrl of getHrefs($, 'ul.hs-categories li.item > a')) {
			$$ = await getPage(categoryUrl);
			for(let subcategoryUrl of getHrefs($$, 'ul.hs-categories li.item > a')) {
				link = new Link({ origin: this.origin, type: 'category', url: subcategoryUrl });
				await link.customSave();
			}
		}

		console.log('%s category links are in database.', await Link.find({ origin: this.origin, type: 'category' }).countDocuments());
	}

	async retrieveItemLinks(categoryUrl) {
		let $, link, pagesNumber;
		
		$ = await getPage(categoryUrl);
		pagesNumber = parseInt($('div.hs-paging').attr('data-total'));

		for(let i = 1; i <= pagesNumber; ++i) {
			if(i != 1)
				$ = await getPage(categoryUrl + '?pagenumber=' + i);

			for(let itemUrl of getHrefs($, 'h2.product-name > a')) {
				link = new Link({ origin: this.origin, type: 'item', url: itemUrl });
				await link.customSave();
			}
		}
	}

	async retrieveItem(itemUrl) {
		const $ = await getPage(itemUrl);

		if ($('article h1').text().trim() == 'Ce produit est introuvable. Il n\'existe plus dans le catalogue actuel.') {
			console.warn('The item at the url "' + itemUrl + '" does not exist anymore.');
			return;
		}

		const designation = $('h1.title').text();
		const title = designation.split(' - ').filter((val) => !!val.trim());
		const subtitleSplit = $('div.page-title small').text().split(' | ');
		const subtitlePart1 = subtitleSplit[0].split(' / ');
		const crossedPrice = $('div.product span.price-mod').text().replace('€', '').trim();
		const refsAndBrand = $('h2.product-title:nth-child(1) > small').text().replace(/\n/g, ' ');
		const finalAttr = title[title.length - 1].trim();

		// parse prices
		// https://www.henryschein.fr/fr-fr/dental/p/usage-unique/gants-latex-sans-poudre/gants-cybercoat-cybertech-taille-xl-boite-de-90/900-9562
		let pricesByLot = [];
		let prices = $('section.product-desc div.product-price span.amount').text().trim();
		if (prices.indexOf('Prix non disponible') != -1)
			pricesByLot.push({ soldBy: 1, commonPrice: 0, discountPrice: null });
		else {
			prices = prices.split(' ');
			for(let i = 0; i < prices.length; ++i) {
				// price for a single item
				if(i == 0) {
					pricesByLot.push({
						soldBy: 1,
						commonPrice: crossedPrice ? crossedPrice : prices[i],
						discountPrice: crossedPrice ? prices[i] : null
					});
				}
				// price for items by lot
				else if(prices[i].includes('x')) {
					const quantity = parseInt(prices[i].match(/x([0-9]+)/)[1]);
					const price = prices[i + 1].replace(',', '.').replace('€', '');
					pricesByLot.push({ soldBy: quantity, commonPrice: price, discountPrice: null });
					i++;
				}
			}
		}

		let itemData, counter = 0;
		for (let priceByLot of pricesByLot) {
			itemData = {
				origin: this.origin,
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
	return parseFloat(price.match(/[0-9\s]+[,|.][0-9]+/)[0].replace(/,/g, '.').replace(/\s/g, ''));
}

function getHrefs($, selector) {
	return $(selector).map(function() {
		return $(this).attr('href');
	}).get();
}

async function getPage(url) {
	console.debug(`Requesting ${url}...`);
	try {
		return await utils.get(url, { headers: { Cookie: COOKIES }, encoding: 'iso-8859-15' });
	} catch(e) {
		if(e.code == 'ECONNABORTED') {
			console.warn('The connection has been closed, trying again...');
			await sleep(5);
			return getPage(url);
		} else throw e;
	}
}
