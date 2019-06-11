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
	supplierArticleCode: {
		type: String,
		required: false
	},
	presentation: {
		type: String,
		required: false
	},
	attributes: {
		type: Array,
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
		required: true
	},
	discountPrice: {
		type: Number,
		required: false
		// validate: {
		// 	validator: function (v) {
		// 		return v == null || this.price >= v;
		// 	},
		// 	message: 'The price is not superior or equal to the discount price.'
		// },
	}
}, null, {
	'url': 'URL',
	'designation': 'DESIGNATION',
	'reference': 'REFERENCE',
	'supplierArticleCode': 'CODE ARTICLE FOURNISSEUR',
	'presentation': 'PRESENTATION',
	'attributeName1': 'NOM ATTRIBUT 1',
	'attributeValue1': 'VALEUR ATTRIBUT 1',
	'attributeName2': 'NOM ATTRIBUT 2',
	'attributeValue2': 'VALEUR ATTRIBUT 2',
	'attributeName3': 'NOM ATTRIBUT 3',
	'attributeValue3': 'VALEUR ATTRIBUT 3',
	'attributeName4': 'NOM ATTRIBUT 4',
	'attributeValue4': 'VALEUR ATTRIBUT 4',
	'attributeName5': 'NOM ATTRIBUT 5',
	'attributeValue5': 'VALEUR ATTRIBUT 5',
	'attributeName6': 'NOM ATTRIBUT 6',
	'attributeValue6': 'VALEUR ATTRIBUT 6',
	'attributeName7': 'NOM ATTRIBUT 7',
	'attributeValue7': 'VALEUR ATTRIBUT 7',
	'description': 'DESCRIPTIF',
	'brand': 'MARQUE',
	'price': 'PRIX DE VENTE CATALOGUE',
	'discountPrice': 'PRIX DE VENTE PROMOTIONNEL'
});
