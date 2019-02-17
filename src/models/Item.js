const mongoose = require('mongoose');

module.exports = (dynamicSchema, index) => {
	const itemSchema = new mongoose.Schema(
		Object.assign(
			{
				origin: {
					type: String,
					required: true
				},
				url: {
					type: String,
					required: true
					//unique: true
				}
			},
			dynamicSchema
		)
	);

	if (index) itemSchema.index(index, {unique: true});

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
			if (e.message.indexOf('E11000 duplicate key error collection') != -1) {
				console.warn('This item has already been processed.');
				return;
			}

			throw e;
		}
	};

	itemSchema.statics.getDynamicKeys = function() {
		return Object.keys(dynamicSchema);
	};

	return mongoose.model('Item', itemSchema);
};
