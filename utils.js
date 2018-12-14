const axios = require('axios');
const cheerio = require('cheerio');
const parseString = require('xml2js').parseString;
const querystring = require('querystring');
const sleep = require('system-sleep');
const util = require('util');

const BASE_URL = 'https://www.megadental.fr';

const parseXML = util.promisify(parseString);

async function request(method, url, options = {}) {
	console.log('Request to "%s"...', url);
	let i = 0;
	let res;
	while(++i) {
		try {
			res = await axios({
				method,
				url,
				params: options.params,
				data: options.body && querystring.stringify(options.body), // application/x-www-form-urlencoded by default
				headers: {
					'Content-Type': 'application/x-www-form-urlencoded'
				}
			});
			break;
		}
		catch(e) {
			if(e.code == 'ENOTFOUND' && i < 5) {
				console.warn('Server unreachable, trying again in 3 seconds...');
				sleep(3000);
			}
			else if(e.message == 'Request failed with status code 404') {
				console.error('The server has returned 404 for url "%s".', url);
				return 404;
			}
			else throw e;
		}
	}

	if(res.status != 200)
		throw new Error('Bad response, status code = ' + res.status);

	return res.data;
}

async function requestPage(method, url, options = {}) {
	const data = await request(method, url, options);
	if(data == 404)
		return null;
	if(data.length == 0) { // sometimes it appears that the response body is empty (https://www.megadental.fr/adhesifs/sdr-prime-bond-active.html)
		console.error('The server has returned an empty body for url "%s".', url);
		return null;
	}
	return cheerio.load(data);
}

async function requestArticleToBoutique(articleId, route, last = null) {
	const str = route.filter((val) => !!val).join('|') + '|';
	const data = await request('get', BASE_URL + '/boutique/lib.tpl.php?art=' + articleId + '&str=' + querystring.escape(str) + (last ? '&last=' + last : ''));
	const json = await parseXML(data, { explicitArray: false });
	if(!json.article)
		throw new Error('No article returned.');
	return json.article;
}

function getLinks($, selector) {
	const links = $(selector);
	if(!links)
		throw new Error('No link found on the page.');
	
	const array = [];
	links.map((i, link) => { // cheerio map() does not return a new array
		const href = $(link).attr('href');
		if(!href)
			throw new Error('Href attribute missing.');
		array.push(href);
	});

	return array;
}

function resolveUrl(base, url) {
	if(url.startsWith('http'))
		return url;
	return base + url;
}

async function asyncForEach(array, callback) {
	const arr = [];
	for (let i = 0; i < array.length; i++)
		arr.push(callback(array[i], i, array));
	return Promise.all(arr);
}

module.exports = {
	get: requestPage.bind(null, 'get'),
	post: requestPage.bind(null, 'post'),
	getLinks,
	resolveUrl,
	requestArticleToBoutique,
	asyncForEach
};