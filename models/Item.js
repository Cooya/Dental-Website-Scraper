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
		unique: true
	},
	data: mongoose.Schema.Types.Mixed
});

ItemSchema.pre('validate', function (next) {
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

ItemSchema.statics.saveAllIntoFile = async function(outputFile) {
	const xls = json2xls(await this.find());
	await writeFile(outputFile, xls, 'binary');
}

module.exports = (dataSchema) => {
	ItemSchema.data = new mongoose.Schema(dataSchema);
	return mongoose.model('Item', ItemSchema);
};