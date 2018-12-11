const sleep = require('system-sleep');

const Link = require('../models/Link');
const utils = require('../utils');

const BASE_URL = 'https://www.megadental.fr';
const SITE_MAP_URL = 'https://www.megadental.fr/boutique/sitemap.php';
const ORIGIN = 'megadental';

const resolveUrl = utils.resolveUrl.bind(null, BASE_URL);

const schema = {
	designation: {
		type: String,
		required: true
	},
	reference: {
		type: String,
		required: true
	},
	presentation: {
		type: String,
		required: true
	},
	size: {
		type: String,
		required: true
	},
	color: {
		type: String,
		required: true
	},
	type: {
		type: String,
		required: true
	},
	description: {
		type: String,
		required: true
	},
	brand: {
		type: String,
		required: true
	},
	price: {
		type: Number,
		required: true
	},
	discountPrice: {
		type: Number,
		required: true
	}
};

module.exports = class MegaRental {
	constructor() {
		this.schema = schema;
	}

	async analyseSiteMap() {
		const $ = await utils.get(SITE_MAP_URL);
		const links = utils.getLinks($, 'div.row li a');
		for (let link of links) {
			link = resolveUrl(link);
			if (link.match(/https\:\/\/www\.megadental\.fr\/[a-z0-9-]+\/[a-z0-9-]+\.html/)) {
				link = new Link({ origin: ORIGIN, type: 'item', url: link });
				await link.customSave();
			}
			else if (link.match(/https\:\/\/www\.megadental\.fr\/[a-z0-9-]+\.html/)) {
				link = new Link({ origin: ORIGIN, type: 'category', url: link });
				await link.customSave();
			}
		}
	}

	async retrieveAllCategoryLinks() {
		// old way
		// const $ = await utils.get(BASE_URL);
		// const categoryLinks = utils.getLinks($, 'div.menu-rayon li > a, #menu-marques > ul > li > a');
		// for(let categoryLink of categoryLinks) {
		// 	categoryLink = new Link({origin: ORIGIN, type: 'category', url: resolveUrl(categoryLink)});
		// 	await categoryLink.customSave();
		// }

		// better way
		// await this.analyseSiteMap();

		console.log('All category links have been retrieved.');
		console.log('%s category links are in database.', await Link.find({ type: 'category' }).countDocuments());
	}

	async retrieveAllItemLinks() {
		const categoryLinks = await Link.find({ type: 'category', processed: false });
		for (let categoryLink of categoryLinks) {
			await this.retrieveItemLinks(categoryLink.url);
			await categoryLink.markAsProcessed();
			sleep(3000);
		}
		console.log('All category links have been processed.');
		console.log('%s item links are in database.', await Link.find({ type: 'item' }).countDocuments());
	}

	async retrieveItemLinks(categoryUrl) {
		const $ = await utils.post(categoryUrl, { body: { nbrParPage: 100 } });
		if (!$)
			return;

		const itemLinks = utils.getLinks($, 'a.hover-infos');
		console.log('%s item links found on the page.', itemLinks.length);
		for (let itemLink of itemLinks) {
			itemLink = new Link({ origin: ORIGIN, type: 'item', url: resolveUrl(itemLink) });
			await itemLink.customSave();
		};

		const nextPageButton = $('ul.pagination li:last-child:not(.disabled)');
		if (nextPageButton.length) { // if next page exists, we process it
			console.log('Pagination found.');
			sleep(3000);
			await this.retrieveItemLinks(resolveUrl($(nextPageButton).find('a').attr('href')));
		}
	}

	async retrieveAllItems() {

	}
};