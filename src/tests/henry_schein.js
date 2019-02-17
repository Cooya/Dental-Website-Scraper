const assert = require('assert');
const mongoose = require('mongoose');

require('../utils/logs');
const config = require('../../config');
const HenryScheinScraper = require('../scrapers/HenrySchein');

const urlToTest = 'https://www.henryschein.fr/fr-fr/Shopping/ProductDetails.aspx?productid=872-3910';

(async function main() {
	try {
		await mongoose.connect(config.dbUrl, {useCreateIndex: true, useNewUrlParser: true});

		const scraper = new HenryScheinScraper();
		const counter = await scraper.retrieveItem(urlToTest);
		assert.equal(counter, 2);

		await mongoose.disconnect();
	} catch (e) {
		console.error(e);
		process.exit(1);
	}
})();
