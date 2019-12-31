const assert = require('assert');
const utils = require('@coya/utils');

const Item = require('../models/PromoDentaireItem');
const Link = require('../models/Link');
const Scraper = require('./Scraper');

const BASE_URL = 'https://www.promodentaire.com';
const EXPECTED_CATEGORIES_COUNT = 17; // and 1853 item links

const resolveUrl = utils.resolveUrl.bind(null, BASE_URL);

module.exports = class PromoDentaire extends Scraper {
	constructor() {
		super('PromoDentaire');
		this.header.splice(6, 1); // delete the entry "attributesArray"
		this.header.splice(6, 0, ...['key1', 'attr1', 'key2', 'attr2', 'key3', 'attr3', 'key4', 'attr4', 'key5', 'attr5']);
	}

	async retrieveAllCategoryLinks() {
		if ((await Link.find({ origin: this.origin, type: 'category' }).countDocuments()) == EXPECTED_CATEGORIES_COUNT) {
			console.log('All category links have been retrieved.');
			return;
		}

		console.log('Fetching category links...');
		const $ = await utils.get(BASE_URL);
		const categoryLinks = utils.getLinks($, '#divSousMenu td > a');
		for (let categoryLink of categoryLinks) {
			console.debug(categoryLink);
			categoryLink = new Link({
				origin: this.origin,
				type: 'category',
				url: resolveUrl(categoryLink)
			});
			await categoryLink.customSave();
		}
		console.log('All category links have been retrieved.');
		console.log('%s category links are in database.', await Link.find({ origin: this.origin, type: 'category' }).countDocuments());
	}

	async retrieveItemLinks(categoryUrl) {
		let $ = await utils.get(categoryUrl);
		const nbPages = parseInt($('#divGammesListe > div > a').last().attr('href').match(/numPageCourante=([0-9]+)/)[1]);
		assert(Number.isInteger(nbPages));
		console.log('%s pages found on the page.', nbPages);

		let itemLinks = utils.getLinks($, '#divGamme > div > div > a');
		console.log('%s item links found on the page.', itemLinks.length);
		for (let itemLink of itemLinks) {
			itemLink = new Link({ origin: this.origin, type: 'item', url: resolveUrl(itemLink) });
			await itemLink.customSave();
		}

		for (let i = 2; i < nbPages + 1; ++i) {
			console.log('Page %s/%s', i, nbPages);
			$ = await utils.get(categoryUrl + '&numPageCourante=' + i);
			itemLinks = utils.getLinks($, '#divGamme > div > div > a');
			console.log('%s item links found on the page.', itemLinks.length);
			for (let itemLink of itemLinks) {
				itemLink = new Link({ origin: this.origin, type: 'item', url: resolveUrl(itemLink) });
				await itemLink.customSave();
			}
		}
	}

	async retrieveItem(itemUrl) {
		let counter = 0;
		const $ = await utils.get(itemUrl);

		const designation = $('span.niveau_courant_fil_ariane')
			.text()
			.trim();
		const filAriane = $('a.lien_fil_ariane').get();
		let brand = /Fabricant : ([\S ]+)/m.exec($('div.contenu_descriptions').text().trim());
		brand = brand
			? brand[1].trim()
			: $('h4')
				.text()
				.trim()
				.substring(designation.length)
				.trim();
		if (brand.indexOf('\n') != -1) {
			const split = brand.split('\n');
			brand = split[split.length - 1].trim();
		}
		const data = {
			origin: this.origin,
			url: itemUrl,
			family: $(filAriane[1]).text(),
			subFamily: $(filAriane[2]).text(),
			designation,
			description: getShallowText($('#divFicheArticleDetailGammeAccrocheGamme')).trim(),
			brand: brand || null
		};

		const articleGroups = $('#divFicheArticleDescriptionArticles');
		await utils.asyncForEach(articleGroups.get(), async (articleGroup, i) => {
			data.strip =
				$($('div.titre_produit').get(i))
					.text()
					.trim() || null;
			data.subStrip =
				$($('#divFicheArticleDetailProduitDescriptionProduit').get(i))
					.text()
					.trim() || null;

			const articles = $(articleGroup).find('#divFicheArticleDescriptionArticle');
			await utils.asyncForEach(articles.get(), async (article) => {
				const details = $(article).find('#divFicheArticleCaracteristiquesArticle');
				data.attributesArray = $(details)
					.find('div:not(.divRetourALaLigne):not(#caracteristique_contenant)')
					.get()
					.map((elt) => $(elt).text());
				data.lastAttr = $(details)
					.find('#caracteristique_contenant')
					.text();
				data.ref = $(article)
					.find('span[style="font-size:12px;font-weight:bold;"]')
					.text()
					.match(/réf. ([0-9]+)/)[1];
				const ref2 = $(article)
					.find('div[style="width:513px;"] > div[style="float:left;"] > div:nth-child(1)')
					.text();
				data.ref2 = ref2.indexOf('Cette référence remplace') != -1 ? /: ([0-9]+)/.exec(ref2)[1] : null;

				const priceRows = $(article).find('div.article_prix, #divFicheArticleDescriptionArticle td:nth-child(2) div[style="float:right;"], #divFicheArticleDescriptionArticle td:nth-child(3) div[style="float:right;"]');
				await utils.asyncForEach(priceRows.get(), async (priceRow) => {
					if ($(priceRow).hasClass('article_prix')) {
						// price for one without discount
						data.lot = 1;
						data.listPrice = extractPriceAsNumber($(priceRow).text());
						data.discountPrice = null;
					} else {
						// prices for lot or with discount
						//console.debug($(priceRow).html());
						const priceDescription = $(priceRow).find('div:nth-child(1)').text();
						const divsCount = $(priceRow).find('div').length;
						if (priceDescription.indexOf('Par ') == -1) {
							// price for one with discount
							data.lot = 1;
							data.listPrice = extractPriceAsNumber($(priceRow).find('div:nth-child(1)').text());
							data.discountPrice = extractPriceAsNumber($(priceRow).find('div:nth-child(' + divsCount + ')').text());
						} else {
							// price for lot
							data.lot = priceDescription.match(/Par ([0-9]+),/)[1];
							data.listPrice = null;
							data.discountPrice = extractPriceAsNumber($(priceRow).find('div:nth-child(' + divsCount + ')').text());
						}
					}
					try {
						await Item.newItem(data);
						counter++;
					} catch (e) {
						console.error(e);
						process.exit();
					}
				});
			});
		});

		return counter;
	}

	async lintItem(item) {
		for (let i = 0, j = 1; i < item.attributesArray.length; i += 2, ++j) {
			item['key' + j] = item.attributesArray[i].replace(':', '').trim();
			item['attr' + j] = item.attributesArray[i + 1];
		}
	}
};

function extractPriceAsNumber(price) {
	price = /[0-9\s]+[,|.][0-9]+/
		.exec(price)[0]
		.replace(/,/g, '.')
		.replace(/\s/g, '');
	return parseFloat(price);
}

function getShallowText(elt) {
	return elt
		.clone() // clone the element
		.children() // select all the children
		.remove() // remove all the children
		.end() // again go back to selected element
		.text();
}
