const axios = require('axios');
const cheerio = require('cheerio');
const querystring = require('querystring');

async function request(method, url, options = {}) {
	console.log('Request to %s...', url);
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
			if(e.code == 'ENOTFOUND' && i < 5);
			else if(e.message == 'Request failed with status code 404') {
				console.error('The server has returned 404 for url "%s".', url);
				return null;
			}
			else throw e;
		}
	}

	if(res.status != 200)
		throw new Error('Bad response, status code = ' + res.status);

	return cheerio.load(res.data);
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

module.exports = {
	get: request.bind(null, 'get'),
	post: request.bind(null, 'post'),
	getLinks,
	resolveUrl
};