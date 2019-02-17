require('./utils/logs');
const mongoose = require('mongoose');

const config = require('../config');
const Scraper = require('./scrapers/' + config.origin);

(async function main() {
	try {
		await mongoose.connect(config.dbUrl, {useCreateIndex: true, useNewUrlParser: true});

		const scraper = new Scraper(config.origin);
		await scraper.retrieveAllCategoryLinks();
		await scraper.retrieveAllItemLinks();
		await scraper.retrieveAllItems();
		await scraper.saveItemsIntoFile(config.origin, config.outputFile);

		await mongoose.disconnect();
	} catch (e) {
		console.error(e);
		process.exit(1);
	}
})();
