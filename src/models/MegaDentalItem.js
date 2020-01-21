module.exports = require('./Item')({
	category: {
		type: String,
		required: true
	},
	subcategory: {
		type: String,
		required: true
	},
	designation: {
		type: String,
		required: true
	},
	reference: {
		type: String,
		required: true
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
	prices: {
		type: Array,
		required: true
	}
}, {
	origin: 'MegaDental',
	index: { reference: 1 },
	mapping: {
		url: 'URL',
		category: 'RUBRIQUE',
		subcategory: 'SOUS-RUBRIQUE',
		designation: 'DESIGNATION',
		reference: 'REFERENCE',
		supplierArticleCode: 'CODE ARTICLE FOURNISSEUR',
		presentation: 'PRESENTATION',
		attributeName1: 'NOM ATTRIBUT 1',
		attributeValue1: 'VALEUR ATTRIBUT 1',
		attributeName2: 'NOM ATTRIBUT 2',
		attributeValue2: 'VALEUR ATTRIBUT 2',
		attributeName3: 'NOM ATTRIBUT 3',
		attributeValue3: 'VALEUR ATTRIBUT 3',
		attributeName4: 'NOM ATTRIBUT 4',
		attributeValue4: 'VALEUR ATTRIBUT 4',
		attributeName5: 'NOM ATTRIBUT 5',
		attributeValue5: 'VALEUR ATTRIBUT 5',
		attributeName6: 'NOM ATTRIBUT 6',
		attributeValue6: 'VALEUR ATTRIBUT 6',
		attributeName7: 'NOM ATTRIBUT 7',
		attributeValue7: 'VALEUR ATTRIBUT 7',
		description: 'DESCRIPTIF',
		brand: 'MARQUE',
		price1: 'PRIX DE REFERENCE UNITAIRE',
		discountPrice1: 'PRIX PROMOTIONNEL UNITAIRE',
		quantity2: 'QUANTITE DEGRESSIF 1',
		discountPrice2: 'PRIX PROMOTIONNEL DEGRESSIF 1',
		quantity3: 'QUANTITE DEGRESSIF 2',
		discountPrice3: 'PRIX PROMOTIONNEL DEGRESSIF 2',
		quantity4: 'QUANTITE DEGRESSIF 3',
		discountPrice4: 'PRIX PROMOTIONNEL DEGRESSIF 3'
	}
});
