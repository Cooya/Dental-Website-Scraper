module.exports = require('./Item')({
	designation: {
		type: String,
		required: true
	},
	reference: {
		type: String,
		required: true,
		unique: true
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
		// validate: {
		// 	validator: function (v) {
		// 		return v == null || this.price >= v;
		// 	},
		// 	message: 'The price is not superior or equal to the discount price.'
		// },
	}
});