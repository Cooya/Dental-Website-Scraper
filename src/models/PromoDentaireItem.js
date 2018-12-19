module.exports = require('./Item')({
	family: {
		type: String,
		required: true
	},
	subfamily: {
		type: String,
		required: true
	},
	designation: {
		type: String,
		required: true
	},
	strip: {
		type: String,
		required: true
	},
	subStrip: {
		type: String,
		required: true
	},
	attributesArray: {
		type: Array,
		required: true
	},
	ref: {
		type: Number,
		required: true
	},
	ref2: {
		type: Number,
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
	lot: {
		type: Number,
		required: true
	},
	listPrice: {
		type: Number,
		required: true
	},
	discountPrice: {
		type: Number,
		required: true
	}
});