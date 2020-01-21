const mongoose = require('mongoose');

module.exports = (dynamicSchema, options = {}) => {
	const itemSchema = new mongoose.Schema(Object.assign({
		origin: {
			type: String,
			required: true
		},
		url: {
			type: String,
			required: true
		}
	}, dynamicSchema));

	// if an index is provided
	if (options.index && options.origin)
		itemSchema.index(options.index, { unique: true, partialFilterExpression: { origin: options.origin } });

	itemSchema.pre('validate', function(next) {
		const docKeys = Object.keys(this.toObject()); // new Object(this) is not working
		for (let schemaKey in itemSchema.obj) if (!docKeys.includes(schemaKey)) throw new Error('"' + schemaKey + '" key is required.');
		next();
	});

	itemSchema.post('save', (doc, next) => {
		console.log('Item "%s" has been saved.', doc.url);
		next();
	});

	itemSchema.statics.newItem = async function(itemData) {
		console.debug(itemData);

		try {
			const item = new this(itemData);
			await item.save(); // this validates as well
		} catch (e) {
			// "E11000 duplicate key error collection" or "E11000 duplicate key error index" (it depends of MongoDB version)
			if (e.message.indexOf('E11000 duplicate key error') != -1) {
				console.log(e);
				console.warn('This item has already been processed.');
				return;
			}

			throw e;
		}
	};

	itemSchema.statics.getMapping = () => {
		return options.mapping;
	};

	return mongoose.model('Item', itemSchema);
};
