const fs = require('fs');
const json2xls = require('json2xls');
const mongoose = require('mongoose');
const util = require('util');

const writeFile = util.promisify(fs.writeFile);

module.exports = (dynamicSchema) => {
	const fieldsToSave = ['url'].concat(Object.keys(dynamicSchema));
	
	const ItemSchema = new mongoose.Schema(Object.assign({
		origin: {
			type: String,
			required: true
		},
		url: {
			type: String,
			required: true,
			//unique: true
		}
	}, dynamicSchema));

	ItemSchema.pre('validate', function (next) {
		const docKeys = Object.keys(this.toObject()); // new Object(this) is not working
		for (let schemaKey in ItemSchema.obj)
			if (!docKeys.includes(schemaKey))
				throw new Error('"' + schemaKey + '" key is required.');
		next();
	});
	
	ItemSchema.post('save', (doc, next) => {
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
	
			throw e;
		}
	};

	ItemSchema.statics.saveItemsIntoFile = async function (origin, outputFile) {
		const items = await this.find({origin});
		for(let i = 0; i < 100; ++i)
			items[i] = items[i]._doc;
		const xls = json2xls(items, {fields: fieldsToSave});
		await writeFile(outputFile, xls, 'binary');
		console.log('All items have been saved into the output file.');
	};

	return mongoose.model('Item', ItemSchema);
};