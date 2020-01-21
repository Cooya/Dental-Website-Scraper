const mongoose = require('mongoose');

const config = require('../config');
const Item = require('./models/Item');
const Link = require('./models/Link');
require('./utils/logs');

(async () => {
	try {
		let origin, flush = false, skipCategories = false;
		for(let i = 0; i < process.argv.length; ++i) {
			if(process.argv[i] == '--origin')
				origin = process.argv[i + 1];
			if(process.argv[i] == '--flush')
				flush = true;
			if(process.argv[i] == '--skip-categories')
				skipCategories = true;
		}

		if(!origin) {
			console.log('Usage: npm start -- --origin HenrySchein|MegaDental|PromoDentaire [--flush]');
			process.exit(0);
		}

		await mongoose.connect(config.dbUrl, { useCreateIndex: true, useNewUrlParser: true, useUnifiedTopology: true });

		if(flush) {
			console.log(`Flushing data for "${origin}"...`);
			console.log(`${(await Link.deleteMany({ origin })).deletedCount} documents deleted from Link collection.`);
			console.log(`${(await Item().deleteMany({ origin })).deletedCount} documents deleted from Item collection.`);
			console.log('Flushing done.');
		} else {
			const scraper = new (require('./scrapers/' + origin))();
			if(!skipCategories) await scraper.retrieveAllCategoryLinks();
			await scraper.retrieveAllItemLinks();
			await scraper.retrieveAllItems();
			await scraper.saveItemsIntoFile();
		}

		await mongoose.disconnect();
	} catch (e) {
		console.error(e);
		process.exit(1);
	}
})();
