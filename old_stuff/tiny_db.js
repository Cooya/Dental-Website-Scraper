const fs = require('fs');
const util = require('util');

const readFile = util.promisify(fs.readFile);
const writeFile = util.promisify(fs.writeFile);

module.exports = class TinyDB {
	constructor(file_path, separator = '\n') {
		this.file_path = file_path;
		this.separator = separator;
		this.data = [];
	}

	get() {
		return this.data;
	}

	async load() {
		let file_content = null;
		try {
			file_content = (await readFile(this.file_path)).toString();
		}
		catch (e) {
			if (e.code != 'ENOENT')
				throw e;
			return;
		}
		if (file_content)
			this.data = file_content.split(this.separator);
	}

	async write(entries) {
		if (!entries || !entries.length)
			return;

		let counter = 0;
		for (let entry of entries)
			if (this.data.indexOf(entry) == -1) {
				this.data.push(entry);
				counter++;
			}
		await writeFile(this.file_path, this.data.join('\n'));
		console.log(counter + ' entries added to the database, database size : ' + this.data.length + ' entries.');
	}
};