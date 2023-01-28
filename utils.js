const { readdir } = require('fs/promises');
const { resolve } = require('path');

async function getFiles(dir) {
	return Array.prototype.concat(...await Promise.all((await readdir(dir, { withFileTypes: true })).map((dirent) => {
		const res = resolve(dir, dirent.name);
		return dirent.isDirectory() ? getFiles(res) : res;
	})));
}

module.exports = {
	getFiles
}