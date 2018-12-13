const fs = require('fs');
const json2xls = require('json2xls');
const mongoose = require('mongoose');
const util = require('util');

const writeFile = util.promisify(fs.writeFile);

const ItemSchema = new mongoose.Schema({
	origin: {
		type: String,
		required: true
	},
	url: {
		type: String,
		required: true,
		//unique: true
	},
	designation: {
		type: String,
		required: true
	},
	reference: {
		type: String,
		required: true
	},
	presentation: {
		type: String,
		required: true
	},
	size: {
		type: String,
		required: false
	},
	color: {
		type: String,
		required: false
	},
	type: {
		type: String,
		required: false
	},
	description: {
		type: String,
		required: false // 	sometimes there is no description...
	},
	brand: {
		type: String,
		required: false // sometimes there is no brand...
	},
	price: {
		type: Number,
		required: true,
	},
	discountPrice: {
		type: Number,
		required: false,
		validate: {
			validator: function (v) {
				return v == null || this.price >= v;
			},
			message: 'The price is not superior or equal to the discount price.'
		},
	}
});

ItemSchema.pre('validate', function (next) {
	const docKeys = Object.keys(this.toObject()); // new Object(this) is not working
	for (let schemaKey in ItemSchema.obj)
		if (!docKeys.includes(schemaKey))
			throw new Error('"' + schemaKey + '" key is required.');
	next();
});

ItemSchema.post('save', function (doc, next) {
	console.log('Item "%s" has been saved.', doc.url);
	next();
});

ItemSchema.statics.newItem = async function (itemData) {
	console.debug(itemData);

	try {
		const item = new this(itemData);
		await item.save(); // this validates as well
		console.log('Item saved in database.');
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

ItemSchema.statics.saveAllIntoFile = async function (outputFile) {
	const xls = json2xls(await this.find());
	await writeFile(outputFile, xls, 'binary');
}

module.exports = mongoose.model('Item', ItemSchema);