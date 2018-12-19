require('./logs');
const mongoose = require('mongoose');

const config = require('../config');
const Scraper = require('./scrapers/' + config.origin);
const Item = require('./models/' + config.origin + 'Item');

(async function main() {
	try {
		await mongoose.connect(config.dbUrl, { useCreateIndex: true, useNewUrlParser: true });

		const scraper = new Scraper();

		await scraper.retrieveAllCategoryLinks();
		await scraper.retrieveAllItemLinks();
		await scraper.retrieveAllItems();

		await Item.saveItemsIntoFile(config.origin, config.outputFile);
		await mongoose.disconnect();
	}
	catch (e) {
		console.error(e);
		process.exit(1);
	}
})();