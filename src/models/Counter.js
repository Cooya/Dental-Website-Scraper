const mongoose = require('mongoose');

const CounterSchema = new mongoose.Schema({
	id: {
		type: String,
		required: true,
		unique: true
	},
	value: {
		type: Number,
		required: true
	}
});

CounterSchema.methods.inc = async function() {
	this.value++;
	this.save();
};

CounterSchema.statics.get = async function(id, initialValue = 0) {
	let counter = await this.findOne({ id });
	if (!counter) {
		counter = new this({ id, value: initialValue });
		await counter.save();
	}
	return counter;
};

module.exports = mongoose.model('Counter', CounterSchema);
