const mongoose = require('mongoose');

const config = require('../config');
const PromoDentaireItem = require('../src/models/PromoDentaireItem');
require('../src/logs');
const Scraper = require('../src/scrapers/PromoDentaire');

(async function main() {
	try {
		await mongoose.connect(
			config.dbUrl,
			{useCreateIndex: true, useNewUrlParser: true}
		);

		const items = await PromoDentaireItem.find({origin: 'PromoDentaire'});
		let i = 0;
		for (let item of items) {
			if (item.lot > 1 && !item.discountPrice) {
				item.discountPrice = item.listPrice;
				item.listPrice = null;
				await item.save();
				i++;
			}
		}
		console.log(i);

		const scraper = new Scraper('PromoDentaire');
		await scraper.saveItemsIntoFile('PromoDentaire', config.outputFile);

		await mongoose.disconnect();
	} catch (e) {
		console.error(e);
		process.exit(1);
	}
})();
