const xlsx = require('xlsx');

const Link = require('../models/Link');
const utils = require('../utils');

const PARALLEL_REQUESTS = 5;

class Scraper {
	constructor(origin) {
		if (!origin) throw new Error('An origin has to be specified.');
		this.origin = origin;
		this.Item = require('../models/' + this.origin + 'Item');
		this.header = ['url'].concat(this.Item.getDynamicKeys());
	}

	async retrieveAllCategoryLinks() {
		throw new Error('This method has to be overridden.');
	}

	async retrieveAllItemLinks() {
		console.log('Fetching item links...');
		const categoryLinks = await Link.find({
			origin: this.origin,
			type: 'category',
			processed: false
		});
		let i = 0;
		await utils.asyncThreads(
			categoryLinks,
			async (categoryLink) => {
				await this.retrieveItemLinks(categoryLink.url);
				await categoryLink.markAsProcessed();
				console.log('%s/%s category links processed.', ++i, categoryLinks.length);
			},
			PARALLEL_REQUESTS
		);
		console.log('All category links have been processed.');
		console.log('%s item links are in database.', await Link.find({origin: this.origin, type: 'item'}).countDocuments());
	}

	async retrieveAllItems() {
		const itemLinks = await Link.find({type: 'item', origin: this.origin, processed: false});
		console.log('%s item links to process.', itemLinks.length);
		let i = 0;
		await utils.asyncThreads(
			itemLinks,
			async (itemLink) => {
				if ((await this.retrieveItem(itemLink.url)) == 0) throw new Error('No item has been created for the url "' + itemLink.url + '".');
				await itemLink.markAsProcessed();
				console.log('%s/%s item links processed.', ++i, itemLinks.length);
			},
			PARALLEL_REQUESTS
		);
		console.log('All item links have been processed.');
		console.log('%s items are in database.', await this.Item.find({origin: this.origin}).countDocuments());
	}

	async retrieveItem() {
		throw new Error('This method has to be overridden.');
	}

	async saveItemsIntoFile(origin, outputFile) {
		const items = await this.Item.find({origin});
		for (let i = 0; i < items.length; ++i) {
			items[i] = items[i]._doc;
			if (this.lintItem) this.lintItem(items[i]);
			for (let key of Object.keys(items[i])) if (this.header.indexOf(key) == -1) delete items[i][key];
		}

		var ws = xlsx.utils.json_to_sheet(items, {
			header: this.header
		});
		const wb = xlsx.utils.book_new();
		xlsx.utils.book_append_sheet(wb, ws, origin);
		xlsx.writeFile(wb, outputFile);
		console.log('All items have been saved into the output file.');
	}
}

module.exports = Scraper;
