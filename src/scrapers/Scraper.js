const utils = require('@coya/utils');
const xlsx = require('xlsx');

const config = require('../../config');
const Link = require('../models/Link');

class Scraper {
	constructor(origin) {
		if (!origin)
			throw new Error('An origin has to be specified.');

		this.origin = origin;
		this.Item = require('../models/' + this.origin + 'Item');
		this.mapping = this.Item.getMapping();
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
		await utils.asyncThreads(categoryLinks, async categoryLink => {
			await this.retrieveItemLinks(categoryLink.url, categoryLink.data);
			await categoryLink.markAsProcessed();
			console.log('%s/%s category links processed.', ++i, categoryLinks.length);
		}, config.parallelRequests);
		console.log('All category links have been processed.');

		console.log('%s item links are in database.', await Link.find({ origin: this.origin, type: 'item' }).countDocuments());
	}

	async retrieveAllItems() {
		const itemLinks = await Link.find({ type: 'item', origin: this.origin, processed: false });
		console.log('%s item links to process.', itemLinks.length);
		let i = 0;
		await utils.asyncThreads(itemLinks, async itemLink => {
			let itemsCounter = await this.retrieveItem(itemLink.url, itemLink.data);
			if (itemsCounter == 0) throw new Error('No item has been created for the url "' + itemLink.url + '".');
			if (itemsCounter > 0) await itemLink.markAsProcessed(); // when it is -1, we just ignore the item without mark it as processed
			console.log('%s/%s item links processed.', ++i, itemLinks.length);
		}, config.parallelRequests);
		console.log('All item links have been processed.');
		console.log('%s items are in database.', await this.Item.find({ origin: this.origin }).countDocuments());
	}

	async retrieveItem() {
		throw new Error('This method has to be overridden.');
	}

	async saveItemsIntoFile() {
		const items = await this.Item.find({ origin: this.origin });
		for (let i = 0; i < items.length; ++i) {
			items[i] = items[i]._doc;
			if (this.lintItem) this.lintItem(items[i]);

			// rename and reorganize keys order
			if(this.mapping) {
				let obj = {};
				for (let [key, val] of Object.entries(this.mapping))
					obj[val] = items[i][key];
				items[i] = obj;
			}
		}

		const ws = xlsx.utils.json_to_sheet(items);
		const wb = xlsx.utils.book_new();
		xlsx.utils.book_append_sheet(wb, ws, this.origin);
		const date = new Date().toISOString().split('T')[0].split('-').reverse().join('_');
		const outputFile = `assets/${this.origin.toLowerCase()}_output_${date}.xlsx`;
		xlsx.writeFile(wb, outputFile);
		console.log(`All items have been saved into the output file "${outputFile}".`);
	}
}

module.exports = Scraper;
