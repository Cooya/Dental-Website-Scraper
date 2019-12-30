const mongoose = require('mongoose');

const config = require('../config');
require('./utils/logs');

(async () => {
	try {
		let origin;
		for(let i = 0; i < process.argv.length; ++i) {
			if(process.argv[i] == '--origin')
				origin = process.argv[i + 1];
		}

		if(!origin) {
			console.log('Usage: npm start -- --origin [HenrySchein|MegaDental|PromoDentaire]');
			process.exit(0);
		}

		await mongoose.connect(config.dbUrl, { useCreateIndex: true, useNewUrlParser: true });

		const scraper = new (require('./scrapers/' + origin))();
		await scraper.retrieveAllCategoryLinks();
		// await scraper.retrieveAllItemLinks();
		await scraper.retrieveAllItems();
		await scraper.saveItemsIntoFile(config.outputFile);

		await mongoose.disconnect();
	} catch (e) {
		console.error(e);
		process.exit(1);
	}
})();
