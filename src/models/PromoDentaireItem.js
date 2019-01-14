function validateString(v) {
	return /^[\S ]+$/.exec(v);
}

module.exports = require('./Item')({
	family: {
		type: String,
		required: true,
		validator: validateString
	},
	subFamily: {
		type: String,
		required: false,
		validator: validateString
	},
	designation: {
		type: String,
		required: true,
		validator: validateString
	},
	strip: {
		type: String,
		required: false,
		validator: validateString
	},
	subStrip: {
		type: String,
		required: false,
		validator: validateString
	},
	attributesArray: {
		type: Array,
		required: true
	},
	lastAttr: {
		type: String,
		requried: false,
		validator: [
			validateString,
			function(v) {
				return this.attributesArray.length ? this.attributesArray[this.attributesArray.length - 1] != v : true;
			}
		]
	},
	ref: {
		type: Number,
		required: true
	},
	ref2: {
		type: Number,
		required: false
	},
	description: {
		type: String,
		required: false,
		validator: validateString
	},
	brand: {
		type: String,
		required: false,
		validate: validateString
	},
	lot: {
		type: Number,
		required: true
	},
	listPrice: {
		type: Number,
		required: false
	},
	discountPrice: {
		type: Number,
		required: false
	}
});
