const fs = require('fs/promises');
const fetch = require('node-fetch').default;
const { XMLParser } = require('fast-xml-parser');

async function mkdirCD(path) {
	await fs.mkdir(path, { recursive: true });
	process.chdir(path);
}

module.exports = async function (cacheDirs) {

	if (process.argv.length != 6) {
		console.log('usage:');
		console.log('mcplugin init <version> <name> <groupID>');
		return;
	}

	const parser = new XMLParser();

	const response = await fetch('https://hub.spigotmc.org/nexus/content/repositories/snapshots/org/spigotmc/spigot-api/maven-metadata.xml');

	if (!response.ok) return console.log('error getting available versions');

	const data = parser.parse(await response.text());

	// remove all prereleases and the snapshot suffix
	const availableVersions = data.metadata.versioning.versions.version.map(v => v.replace('-R0.1-SNAPSHOT', '')).filter(v => !v.includes('-'));
	if (!availableVersions.includes(process.argv[3])) {
		console.log('please choose one of these minecraft versions:');
		console.log(availableVersions.join(', '));
		return;
	}

	const userVersion = process.argv[3];
	const projectName = process.argv[4];
	const groupID = process.argv[5];

	try {
		await fs.mkdir(projectName);
	} catch {
		console.log('folder with that name already exists.');
		return;
	}

	process.chdir(projectName);

	const projWD = process.cwd();

	const options = {
		name: projectName,
		minecraftVersion: userVersion,
		mvnRepositories: [],
		dependencies: []
	};

	await fs.writeFile('plug.conf.js', 'module.exports = ' + JSON.stringify(options, null, 4));

	await mkdirCD(`src/main/resources`);

	const pluginTemplate = await fs.readFile(require.resolve('./plugin.yml.template'), { encoding: 'utf-8' });
	const apiLevel = userVersion.split('.').length === 3 ? userVersion.substring(0, userVersion.lastIndexOf('.')) : userVersion;
	const finalPlugin = pluginTemplate
		.replaceAll('${NAME}', projectName)
		.replaceAll('${MCVERSION}', apiLevel)
		.replaceAll('${GROUP}', groupID);

	await fs.writeFile('plugin.yml', finalPlugin);

	await mkdirCD(`../java/${groupID.replaceAll('.', '/')}/${projectName}`);

	const mainTemplate = await fs.readFile(require.resolve('./Main.java.template'), { encoding: 'utf-8' });
	const finalMain = mainTemplate
		.replaceAll('${NAME}', projectName)
		.replaceAll('${GROUP}', groupID);

	await fs.writeFile('Main.java', finalMain);

	process.chdir(projWD);
	await require('./hydrate-project')(cacheDirs);

}
