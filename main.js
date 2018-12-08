const mongoose = require('mongoose');

const config = require('./config');
const Item = require('./models/Item');
const Scraper = require('./scrapers/' + config.origin + '.js');

(async function main() {
	try {
		await mongoose.connect(config.dbUrl);
	}
	catch (e) {
		console.error(e);
		process.exit(1);
	}

	await Scraper.retrieveAllCategories();
	await Scraper.retrieveAllItemLinks();
	await Scraper.retrieveAllItems();

	await Item.saveAllIntoFile(config.outputFile);
	await mongoose.disconnect();
})();