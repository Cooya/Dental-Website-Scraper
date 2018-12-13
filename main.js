const colors = require('colors');
const mongoose = require('mongoose');

const config = require('./config');
const Scraper = require('./scrapers/' + config.origin + '.js');
const Item = require('./models/Item');

(() => {
	let log = console.log;
	console.log = function(str, ...args) {
		log.call(this, typeof str === 'string' ? str.green : str, ...args);
	};

	let info = console.info;
	console.info = function(str, ...args) {
		info.call(this, typeof str === 'string' ? str.green : str, ...args);
	};

	let warn = console.warn;
	console.warn = function(str, ...args) {
		warn.call(this, typeof str === 'string' ? str.yellow : str, ...args);
	};

	let error = console.error;
	console.error = function(str, ...args) {
		error.call(this, typeof str === 'string' ? str.red : str, ...args);
	};

	let debug = console.debug;
	console.debug = function(str, ...args) {
		debug.call(this, typeof str === 'string' ? str.blue : str, ...args);
	};
})();

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