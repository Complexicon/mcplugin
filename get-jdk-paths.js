const { spawnSync, execSync } = require("child_process");
const { join, resolve } = require("path");

async function detectJDKVersion(path) {
	const result = spawnSync(path, ['-version']);
	let verString = result.stderr.toString('utf-8');
	verString = verString.split('\r\n')[0];
	verString = verString.substring(verString.indexOf('"') + 1, verString.lastIndexOf('"'));
	verString = verString.startsWith('1.') ? verString.substring(2).split('.')[0] : verString.split('.')[0];

	return Number(verString);
}

const platformJDKLookup = {
	async win32() {
		const foundPaths = execSync('where java').toString('utf8').split('\r\n');
		foundPaths.length -= 1; // last entry is always empty

		let jdk17 = '';
		let jdk8 = '';

		for(const path of foundPaths) {
			const ver = await detectJDKVersion(path);
			
			if(ver >= 17) {
				jdk17 = resolve(path, '../..');
			}

			if(ver === 8) {
				jdk8 = resolve(path, '../..');
			}
		}

		if(!jdk8) console.log('warning! JDK 8 not found!');
		if(!jdk17) console.log('warning! JDK 17 not found!');

		return [jdk17,jdk8]
	},

	async linux() {
		return ['','']
	},
	
	async darwin() {
		return ['','']
	}
}

module.exports = async function() {
	return (platformJDKLookup[process.platform] ?? (() => (['',''])))();
}