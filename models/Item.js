const fs = require('fs');
const json2xls = require('json2xls');
const mongoose = require('mongoose');
const util = require('util');

const writeFile = util.promisify(fs.writeFile);

const ItemSchema = new mongoose.Schema({
	url: {
		type: String,
		required: true,
		unique: true
	},
	designation: {
		type: String,
		required: true
	},
	reference: {
		type: String,
		required: true
	},
	barcode: {
		type: String,
		required: true
	},
	brand: {
		type: String,
		required: false
	},
	currentPrice: {
		type: Number,
		required: false
	},
	priceBefore: {
		type: Number,
		required: false
	},
	lotBy3: {
		type: Number,
		required: false
	},
	lotBy4: {
		type: Number,
		required: false
	},
	lotBy6: {
		type: Number,
		required: false
	},
	lotBy8: {
		type: Number,
		required: false
	},
	lotBy10: {
		type: Number,
		required: false
	}
});

ItemSchema.pre('validate', function(next) {
	const docKeys = Object.keys(this.toObject()); // new Object(this) is not working
	for (let schemaKey in ItemSchema.obj)
		if (!docKeys.includes(schemaKey))
			return next(new Error('"' + schemaKey + '" key is required.'));
	next();
});

ItemSchema.statics.create = async (itemData) => {
	try {
		const item = new Item(itemData);
		await item.validate();
		await item.save();
		console.log('Item saved in database.');
		console.debug(itemData);
	}
	catch (e) {
		if (e.message.indexOf('E11000 duplicate key error collection') != -1) {
			console.error('Item already processed...');
			return;
		}

		console.error(e);
		process.exit(1);
	}
};

ItemSchema.statics.saveAllIntoFile = async (outputFile) => {
	const xls = json2xls(await this.find(), {
        fields: ['url', 'designation', 'reference', 'barcode', 'brand', 'currentPrice', 'priceBefore', 'lotBy3', 'lotBy4', 'lotBy6', 'lotBy8']
    });
    await writeFile(outputFile, xls, 'binary');
}

module.exports = mongoose.model('Item', ItemSchema);