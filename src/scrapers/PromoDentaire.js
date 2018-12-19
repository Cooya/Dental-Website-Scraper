const Item = require('../models/PromoDentaireItem');
const Link = require('../models/Link');
const utils = require('../utils');

const BASE_URL = 'https://www.promodentaire.com';
const ORIGIN = 'PromoDentaire';
const EXPECTED_CATEGORIES_COUNT = 17;

const resolveUrl = utils.resolveUrl.bind(null, BASE_URL);

module.exports = class PromoDentaire {
	async retrieveAllCategoryLinks() {
		if ((await Link.find({ origin: ORIGIN, type: 'category' }).countDocuments()) == EXPECTED_CATEGORIES_COUNT) {
			console.log('All category links have been retrieved.');
			return;
		}

		console.log('Fetching category links...');
		const $ = await utils.get(BASE_URL);
		const categoryLinks = utils.getLinks($, '#divSousMenu td > a');
		for (let categoryLink of categoryLinks) {
			console.debug(categoryLink);
			categoryLink = new Link({ origin: ORIGIN, type: 'category', url: resolveUrl(categoryLink) });
			await categoryLink.customSave();
		}
		console.log('All category links have been retrieved.');
		console.log('%s category links are in database.', await Link.find({ origin: ORIGIN, type: 'category' }).countDocuments());
	}

	async retrieveAllItemLinks() {
		console.log('Fetching item links...');
		const categoryLinks = await Link.find({ origin: ORIGIN, type: 'category', processed: false });
		for (let categoryLink of categoryLinks) {
			await this.retrieveItemLinks(categoryLink.url);
			await categoryLink.markAsProcessed();
		}
		console.log('All category links have been processed.');
		console.log('%s item links are in database.', await Link.find({ origin: ORIGIN, type: 'item' }).countDocuments());
	}

	async retrieveItemLinks(categoryUrl) {
		let $ = await utils.get(categoryUrl);
		let nbPages = $('#divGammesListe > div > a');
		nbPages = parseInt($(nbPages[nbPages.length - 3]).text());
		console.log('%s pages found on the page.', nbPages);

		let itemLinks = utils.getLinks($, '#divGamme > div > div > a');
		console.log('%s item links found on the page.', itemLinks.length);
		for (let itemLink of itemLinks) {
			itemLink = new Link({ origin: ORIGIN, type: 'item', url: resolveUrl(itemLink) });
			await itemLink.customSave();
		}

		for (let i = 2; i < nbPages + 1; ++i) {
			console.debug('Page %s/%s', i, nbPages);
			$ = await utils.get(categoryUrl + '&numPageCourante=' + i);
			itemLinks = utils.getLinks($, '#divGamme > div > div > a');
			console.log('%s item links found on the page.', itemLinks.length);
			for (let itemLink of itemLinks) {
				itemLink = new Link({ origin: ORIGIN, type: 'item', url: resolveUrl(itemLink) });
				await itemLink.customSave();
			}
		}
	}
};