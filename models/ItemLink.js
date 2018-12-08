const mongoose = require('mongoose');

const ItemLinkSchema = new mongoose.Schema({
	origin: {
		type: String,
		required: true
	},
	url: {
		type: String,
		required: true,
		unique: true
	},
	processed: {
		type: Boolean,
		required: true
	}
});

ItemLinkSchema.methods.markAsProcessed = async () => {
	console.log('Marking the last processed item link as processed...');
	try {
		this.processed = true;
		await this.save();
	}
	catch (e) {
		console.error(e);
		process.exit(1);
	}
}

module.exports = mongoose.model('ItemLink', ItemLinkSchema);