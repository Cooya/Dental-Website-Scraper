const cheerio = require('cheerio');
const sleep = require('system-sleep');
const parseString = require('xml2js').parseString;
const querystring = require('querystring');
const util = require('util');
const utils = require('@coya/utils');

const Item = require('../models/MegaDentalItem');
const Link = require('../models/Link');
const Scraper = require('./Scraper');

const BASE_URL = 'https://www.megadental.fr';
const SITE_MAP_URL = 'https://www.megadental.fr/boutique/sitemap.php';
const ORIGIN = 'MegaDental';
const CATEGORY_LINKS_COUNT = 284;

const parseXML = util.promisify(parseString);
const resolveUrl = utils.resolveUrl.bind(null, BASE_URL);

module.exports = class MegaDental extends Scraper {
	async analyseSiteMap() {
		const $ = await utils.get(SITE_MAP_URL);
		const links = utils.getLinks($, 'div.row li a');
		for (let link of links) {
			link = resolveUrl(link);
			if (link.match(/https:\/\/www\.megadental\.fr\/[a-z0-9-]+\/[a-z0-9-]+\.html/)) {
				link = new Link({origin: ORIGIN, type: 'item', url: link});
				await link.customSave();
			} else if (link.match(/https:\/\/www\.megadental\.fr\/[a-z0-9-]+\.html/)) {
				link = new Link({origin: ORIGIN, type: 'category', url: link});
				await link.customSave();
			}
		}
	}

	async retrieveAllCategoryLinks() {
		// old way
		// const $ = await utils.get(BASE_URL);
		// const categoryLinks = utils.getLinks($, 'div.menu-rayon li > a, #menu-marques > ul > li > a');
		// for(let categoryLink of categoryLinks) {
		// 	categoryLink = new Link({origin: ORIGIN, type: 'category', url: resolveUrl(categoryLink)});
		// 	await categoryLink.customSave();
		// }

		// better way (retrieve all category links and all item links)
		const categoryLinksCount = await Link.countDocuments({origin: ORIGIN, type: 'category'});
		if (categoryLinksCount < CATEGORY_LINKS_COUNT) await this.analyseSiteMap();

		console.log('All category links have been retrieved.');
		console.log('%s category links are in database.', await Link.find({origin: ORIGIN, type: 'category'}).countDocuments());
	}

	async retrieveItemLinks(categoryUrl) {
		const $ = await utils.post(categoryUrl, {body: {nbrParPage: 100}});
		if (!$) return;

		const itemLinks = utils.getLinks($, 'a.hover-infos');
		console.log('%s item links found on the page.', itemLinks.length);
		for (let itemLink of itemLinks) {
			itemLink = new Link({origin: ORIGIN, type: 'item', url: resolveUrl(itemLink)});
			await itemLink.customSave();
		}

		const nextPageButton = $('ul.pagination li:last-child:not(.disabled)');
		if (nextPageButton.length) {
			// if next page exists, we process it
			console.log('Pagination found.');
			sleep(3000);
			await this.retrieveItemLinks(
				resolveUrl(
					$(nextPageButton)
						.find('a')
						.attr('href')
				)
			);
		}
	}

	async retrieveItem(itemUrl) {
		let itemsCounter = 0;

		let $;
		let articleId;
		let i = 0;
		while (true) {
			$ = await utils.get(itemUrl);
			if (!$) return 1; // 404 error or response body empty, we can mark the item as processed

			articleId = $('input[name="idArticle"]').val();
			if (articleId) break;

			if (++i == 5) throw new Error('Cannot get the article ID...');
			else console.warn('Cannot get the article ID...');
		}

		const designation = $('h1 > a').text();
		const description =
			$('div.description')
				.text()
				.trim() || null;
		const brand = $('div.marque > img').attr('alt') || null;
		const reference = $('div.reference > span').text();
		if (!reference) {
			let firstRoute = getFirstRoute($, articleId);
			//console.debug(firstRoute);

			const routes = [];
			await determineNextRoutes(articleId, routes, firstRoute);
			//console.debug(routes);

			const retrieveArticle = async (route) => {
				const dynamicData = await requestDynamicData(articleId, route);
				//console.debug(dynamicData);
				if (dynamicData) {
					await Item.newItem({
						origin: ORIGIN,
						url: itemUrl,
						designation,
						reference: dynamicData.reference,
						presentation: route[0],
						size: route[1],
						color: route[2],
						type: route[3],
						description,
						brand,
						price: dynamicData.price,
						discountPrice: dynamicData.discountPrice
					});
					itemsCounter++;
				}
			};

			await utils.asyncForEach(routes, retrieveArticle);
		} else {
			let price = $('div.prix-public').text() || $('div.prix').text();
			let discountPrice = $('div.prix-public').text() && $('div.prix').text();

			const route = getFirstRoute($, articleId);
			await Item.newItem({
				origin: ORIGIN,
				url: itemUrl,
				designation,
				reference,
				presentation: route[0],
				size: route[1],
				color: route[2],
				type: route[3],
				description,
				brand,
				price: /([0-9.]+)€/.exec(price)[1],
				discountPrice: discountPrice ? /([0-9.]+)€/.exec(discountPrice)[1] : null
			});
			itemsCounter++;
			//sleep(3000);
		}
		if (itemsCounter == 0) {
			console.error('Buggy item ignored for the url "%s".', itemUrl);
			return -1; // some items are fucked up and need to be ignored
		}
		return itemsCounter;
	}
};

function getFirstRoute($, articleId) {
	const route = [];
	for (let i = 0; i < 4; ++i) {
		const formGroup = $('#select' + i + '_' + articleId);
		if (!formGroup.length) {
			console.warn('A form group has not been found...');
			route.push(null);
		} else {
			let text = $(formGroup)
				.find('input')
				.attr('value');
			if (text) route.push(text);
			else route.push($(formGroup).find('option').length ? 'javascript:void(0)' : null);
		}
	}
	return route;
}

async function determineNextRoutes(articleId, routesArray, route) {
	for (let i = 0; i < route.length; ++i) {
		if (route[i] == 'javascript:void(0)') {
			let newRoutes = (await requestPossibilities(articleId, route, i)).map((possibility) => {
				const newRoute = route.slice(0);
				newRoute[i] = possibility;
				return newRoute;
			});
			await utils.asyncForEach(newRoutes, determineNextRoutes.bind(null, articleId, routesArray));
			return;
		}
	}
	//console.debug('Route complete.');
	routesArray.push(route);
}

async function requestPossibilities(articleId, route, i) {
	const article = await requestArticleToBoutique(articleId, route, i > 0 ? i - 1 : null);
	const $ = cheerio.load((article.selected.tab.length && article.selected.tab[i]._) || article.selected.tab._);

	let options = $('select:enabled > option:enabled');
	if (!options.length) {
		options = [$('p.form-control-static input').val()];
		if (!options[0]) {
			console.error(route, i);
			throw new Error('No option found at this index.');
		}
		return options;
	}

	const possibilities = [];
	options.map((i, option) => {
		if ($(option).val() == 'javascript:void(0)') return;
		possibilities.push($(option).val());
	});

	return possibilities;
}

async function requestDynamicData(articleId, route) {
	console.log('Requesting dynamic data...');
	const article = await requestArticleToBoutique(articleId, route);
	if (article.id == '-999') {
		console.error('The parameters for this article are not valid.');
		return null;
	}

	//console.debug(article);
	let price = article.prix_public.trim() || article.prix.trim();
	let discountPrice = article.prix_public.trim() && article.prix.trim();

	return {
		reference: article.reference.trim(),
		price: /([0-9.]+)€/.exec(price)[1],
		discountPrice: discountPrice ? /([0-9.]+)€/.exec(discountPrice)[1] : null
	};
}

async function requestArticleToBoutique(articleId, route, last = null) {
	const str = route.filter((val) => !!val).join('|') + '|';
	const data = await utils.request('get', BASE_URL + '/boutique/lib.tpl.php?art=' + articleId + '&str=' + querystring.escape(str) + (last ? '&last=' + last : ''));
	const json = await parseXML(data, {explicitArray: false});
	if (!json.article) throw new Error('No article returned.');
	return json.article;
}

// old unused stuff
function determineOptionsPossibilities(optionsArray) {
	optionsArray = optionsArray.filter((value) => !!value);

	const result = [];
	for (let row1 of optionsArray[0]) {
		if (optionsArray.length > 1) {
			for (let row2 of optionsArray[1]) {
				if (optionsArray.length > 2) {
					for (let row3 of optionsArray[2]) {
						if (optionsArray.length > 3) {
							for (let row4 of optionsArray[3]) result.push([row1, row2, row3, row4]);
						} else result.push([row1, row2, row3]);
					}
				} else result.push([row1, row2]);
			}
		} else result.push([row1]);
	}
	return result;
}
