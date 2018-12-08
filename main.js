const mongoose = require('mongoose');

const config = require('./config');
const Scraper = require('./scrapers/' + config.origin + '.js');
const Item = require('./models/Item')(Scraper.schema);

(async function main() {
	try {
		await mongoose.connect(config.dbUrl, { useCreateIndex: true, useNewUrlParser: true });

		const scraper = new Scraper();

		await scraper.retrieveAllCategoryLinks();
		await scraper.retrieveAllItemLinks();
		await scraper.retrieveAllItems();

		await Item.saveAllIntoFile(config.outputFile);
		await mongoose.disconnect();
	}
	catch (e) {
		console.error(e);
		process.exit(1);
	}
})();