const cheerio = require('cheerio');
const sleep = require('system-sleep');

const Item = require('../models/Item');
const Link = require('../models/Link');
const utils = require('../utils');

const BASE_URL = 'https://www.megadental.fr';
const SITE_MAP_URL = 'https://www.megadental.fr/boutique/sitemap.php';
const ORIGIN = 'megadental';

const resolveUrl = utils.resolveUrl.bind(null, BASE_URL);

module.exports = class MegaRental {
	async analyseSiteMap() {
		const $ = await utils.get(SITE_MAP_URL);
		const links = utils.getLinks($, 'div.row li a');
		for (let link of links) {
			link = resolveUrl(link);
			if (link.match(/https\:\/\/www\.megadental\.fr\/[a-z0-9-]+\/[a-z0-9-]+\.html/)) {
				link = new Link({ origin: ORIGIN, type: 'item', url: link });
				await link.customSave();
			}
			else if (link.match(/https\:\/\/www\.megadental\.fr\/[a-z0-9-]+\.html/)) {
				link = new Link({ origin: ORIGIN, type: 'category', url: link });
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

		// better way
		//await this.analyseSiteMap();

		console.log('All category links have been retrieved.');
		console.log('%s category links are in database.', await Link.find({ type: 'category' }).countDocuments());
	}

	async retrieveAllItemLinks() {
		const categoryLinks = await Link.find({ type: 'category', processed: false });
		for (let categoryLink of categoryLinks) {
			await this.retrieveItemLinks(categoryLink.url);
			await categoryLink.markAsProcessed();
			sleep(3000);
		}
		console.log('All category links have been processed.');
		console.log('%s item links are in database.', await Link.find({ type: 'item' }).countDocuments());
	}

	async retrieveItemLinks(categoryUrl) {
		const $ = await utils.post(categoryUrl, { body: { nbrParPage: 100 } });
		if (!$)
			return;

		const itemLinks = utils.getLinks($, 'a.hover-infos');
		console.log('%s item links found on the page.', itemLinks.length);
		for (let itemLink of itemLinks) {
			itemLink = new Link({ origin: ORIGIN, type: 'item', url: resolveUrl(itemLink) });
			await itemLink.customSave();
		};

		const nextPageButton = $('ul.pagination li:last-child:not(.disabled)');
		if (nextPageButton.length) { // if next page exists, we process it
			console.log('Pagination found.');
			sleep(3000);
			await this.retrieveItemLinks(resolveUrl($(nextPageButton).find('a').attr('href')));
		}
	}

	async retrieveAllItems() {
		const itemLinks = await Link.find({ type: 'item', processed: false });
		console.log('%s item links to process.', itemLinks.length);
		let i = 0;
		for (let itemLink of itemLinks) {
			await this.retrieveItem(itemLink.url);
			await itemLink.markAsProcessed();
			console.log('%s item links processed, %s remaining.', ++i, itemLinks.length);
			sleep(3000);
		}
		console.log('All item links have been processed.');
		console.log('%s item are in database.', await Item.find().countDocuments());
	}

	async retrieveItem(itemUrl) {
		const $ = await utils.get(itemUrl);
		if (!$) {
			console.error('404 error for url "%s".', itemUrl);
			return;
		}

		const articleId = $('input[name="idArticle"]').val();
		if (!articleId)
			throw new Error('The article ID has not been found.');

		const designation = $('h1 > a').attr('title');
		const description = $('div.description').text().trim() || null;
		const brand = $('div.marque > img').attr('alt') || null;
		const reference = $('div.reference > span').text();
		if (!reference) {
			let firstRoute = getFirstRoute($, articleId);
			//console.debug(firstRoute);

			const routes = [];
			await determineNextRoutes(articleId, routes, firstRoute);
			console.debug(routes);

			for (let route of routes) {
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
				}
				sleep(3000);
			}
		}
		else {
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
			sleep(3000);
		}
	}
};

function getFirstRoute($, articleId) {
	const route = [];
	for (let i = 0; i < 4; ++i) {
		const formGroup = $('#select' + i + '_' + articleId);
		if (!formGroup.length)
			throw new Error('A form group has not been found...');

		let text = $(formGroup).find('p.form-control-static');
		if (text.length)
			route.push($(text).text());
		else
			route.push($(formGroup).find('option').length ? 'javascript:void(0)' : null);
	}
	return route;
}

async function determineNextRoutes(articleId, routesArray, route) {
	for(let i = 0; i < route.length; ++i) {
		if(route[i] == 'javascript:void(0)') {
			let newRoutes = (await requestPossibilities(articleId, route, i)).map((possibility) => {
				const newRoute = route.slice(0);
				newRoute[i] = possibility;
				return newRoute;
			});
			await utils.asyncForEach(newRoutes, determineNextRoutes.bind(null, articleId, routesArray));
			return;
		}
	}
	console.debug('Route complete.');
	routesArray.push(route);
}

async function requestPossibilities(articleId, route, i) {
	const article = await utils.requestArticleToBoutique(articleId, route, i > 0 ? i - 1 : null);
	const $ = cheerio.load(article.selected.tab[i]._);

	const options = $('select:enabled > option:enabled');
	if(!options.length) {
		console.error(route, i);
		throw new Error('No option found at this index.');
	}

	const possibilities = [];
	options.map((i, option) => {
		if($(option).val() == 'javascript:void(0)')
			return;
		possibilities.push($(option).val());
	});

	return possibilities;
}

async function requestDynamicData(articleId, route) {
	console.log('Requesting dynamic data...');
	const article = await utils.requestArticleToBoutique(articleId, route);
	if (article.id == '-999') {
		console.error('The parameters for this article are not valid.');
		return null;
	}

	return {
		reference: article.reference.trim(),
		price: /([0-9.]+)€/.exec(article.prix_public)[1],
		discountPrice: /([0-9.]+)€/.exec(article.prix)[1]
	};
}

// old stuff unused
function determineOptionsPossibilities(optionsArray) {
	optionsArray = optionsArray.filter(value => !!value);

	const result = [];
	for (let row1 of optionsArray[0]) {
		if(optionsArray.length > 1) {
			for (let row2 of optionsArray[1]) {
				if(optionsArray.length > 2) {
					for (let row3 of optionsArray[2]) {
						if(optionsArray.length > 3) {
							for (let row4 of optionsArray[3])
								result.push([row1, row2, row3, row4]);
						}
						else
							result.push([row1, row2, row3]);
					}
				}
				else
					result.push([row1, row2]);
			}
		}
		else
			result.push([row1]);
	}
	return result;
}