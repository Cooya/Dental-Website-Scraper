const axios = require('axios');

const schema = {
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
		required: true
	},
	color: {
		type: String,
		required: true
	},
	type: {
		type: String,
		required: true
	},
	description: {
		type: String,
		required: true
	},
	brand: {
		type: String,
		required: true
	},
	price: {
		type: Number,
		required: true
	},
	discountPrice: {
		type: Number,
		required: true
	}
};

module.exports = class MegaRental {
	constructor() {
		this.schema = schema;
	}

	async retrieveAllCategoryLinks() {

	}

	async retrieveAllItemLinks() {

	}

	async retrieveAllItems() {

	}
};