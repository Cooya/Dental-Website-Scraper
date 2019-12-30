const mongoose = require('mongoose');

const config = require('../config');
const PromoDentaireItem = require('../src/models/PromoDentaireItem');
require('../src/logs');
const PromoDentaire = require('../src/scrapers/PromoDentaire');

(async () => {
	try {
		await mongoose.connect(config.dbUrl, { useCreateIndex: true, useNewUrlParser: true });

		let i = 0;
		for (let item of await PromoDentaireItem.find({ origin: 'PromoDentaire' })) {
			if (item.lot > 1 && !item.discountPrice) {
				item.discountPrice = item.listPrice;
				item.listPrice = null;
				await item.save();
				i++;
			}
		}
		console.log(i);

		const scraper = new PromoDentaire();
		await scraper.saveItemsIntoFile(config.outputFile);

		await mongoose.disconnect();
	} catch (e) {
		console.error(e);
		process.exit(1);
	}
})();
