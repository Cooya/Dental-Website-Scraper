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
	attr1: {
		type: String,
		required: false
	},
	attr2: {
		type: String,
		required: false
	},
	attr3: {
		type: String,
		required: false
	},
	finalAttr: {
		type: String,
		required: false
	},
	reference: {
		type: String,
		required: true,
		validate: {
			validator: v => /[0-9-]+/.test(v),
			message: 'The reference is invalid.'
		}
	},
	description: {
		type: String,
		required: true
	},
	brand: {
		type: String,
		required: true
	},
	providerRef: {
		type: String,
		required: false
	},
	soldBy: {
		type: Number,
		required: true
	},
	commonPrice: {
		type: Number,
		required: false
	},
	discountPrice: {
		type: Number,
		required: false
	}
}, {
	origin: 'HenrySchein',
	index: { reference: 1, soldBy: 1 }
});
