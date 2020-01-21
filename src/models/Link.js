const mongoose = require('mongoose');

const LinkSchema = new mongoose.Schema({
	origin: {
		type: String,
		required: true
	},
	type: {
		type: String,
		require: true
	},
	url: {
		type: String,
		required: true,
		unique: true
	},
	processed: {
		type: Boolean,
		required: true,
		default: false
	},
	data: {
		type: Object,
		required: false,
		default: null
	}
});

LinkSchema.methods.markAsProcessed = async function() {
	this.processed = true;
	await this.save();
	console.log('Link "%s" marked as processed.', this.url);
};

LinkSchema.methods.customSave = async function() {
	// ignore duplicate key error
	try {
		await this.save();
	} catch (e) {
		if (e.name === 'MongoError' && e.code === 11000) console.log('Link %s already saved.', this.url);
		else throw e;
	}
};

LinkSchema.post('save', function(doc, next) {
	console.log('Link %s has been saved.', doc.url);
	next();
});

module.exports = mongoose.model('Link', LinkSchema);
