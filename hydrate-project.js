const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs/promises');
const { XMLParser } = require('fast-xml-parser');
const { join } = require('path');
const fetch = require('node-fetch').default;

async function mkdirCD(path) {
	await fs.mkdir(path, { recursive: true });
	process.chdir(path);
}

async function downloadServer(version) {

	// const paperApi = await fetch('https://api.papermc.io/v2/projects/paper');
	// if(!paperApi.ok) throw new Error('Paper did not respond'); 

	// const availableVersions = (await paperApi.json()).versions;

	const buildsForVersion = await fetch('https://api.papermc.io/v2/projects/paper/versions/' + version);
	if (!buildsForVersion.ok) throw new Error('Paper did not respond');

	const latestBuild = (await buildsForVersion.json()).builds.pop();

	const downloadName = await fetch(`https://api.papermc.io/v2/projects/paper/versions/${version}/builds/${latestBuild}`);
	if (!downloadName.ok) throw new Error('Paper did not respond');

	const filename = (await downloadName.json()).downloads.application.name;

	const file = await fetch(`https://api.papermc.io/v2/projects/paper/versions/${version}/builds/${latestBuild}/downloads/${filename}`);
	if (!file.ok) throw new Error('Paper did not respond');

	const contentLength = file.headers.get('Content-Length');

	let receivedLength = 0;
	const chunks = [];
	file.body.on('data', value => {
		chunks.push(value);
		receivedLength += value.length;
		process.stdout.write(`Downloading Paper ${version} - ${Math.trunc((receivedLength / contentLength) * 100)}%\r`);
	});

	await new Promise(resolve => file.body.on('close', resolve));
	console.log();

	return Buffer.concat(chunks);
}

async function downloadApi(version, useShaded) {
	const response = await fetch(`https://hub.spigotmc.org/nexus/content/repositories/snapshots/org/spigotmc/spigot-api/${version}-R0.1-SNAPSHOT/maven-metadata.xml`);
	if(!response.ok) throw new Error('this api version does not exist.');

	const parser = new XMLParser();
	const data = parser.parse(await response.text());
	const result = data.metadata.versioning.snapshotVersions.snapshotVersion.filter(v => !v.classifier && v.extension == 'jar');

	if(result.length == 0) throw new Error('this api version does not exist.');

	const fileName = result[0].value;
	
	const apiFileResp = await fetch(`https://hub.spigotmc.org/nexus/content/repositories/snapshots/org/spigotmc/spigot-api/${version}-R0.1-SNAPSHOT/spigot-api-${fileName}${useShaded ? '-shaded' : ''}.jar`)

	if (!apiFileResp.ok) throw new Error('Spigot Maven Repository did not respond');

	const apiContentLength = apiFileResp.headers.get('Content-Length');

	let receivedLength = 0;
	const apiChunks = [];
	console.log('Downloading:');
	apiFileResp.body.on('data', value => {
		apiChunks.push(value);
		receivedLength += value.length;
		process.stdout.write(`Spigot API ${version} - ${Math.trunc((receivedLength / apiContentLength) * 100)}%\r`);
	});

	await new Promise(resolve => apiFileResp.body.on('close', resolve));
	console.log();

	const fileResponse = await fetch(`https://hub.spigotmc.org/nexus/content/repositories/snapshots/org/spigotmc/spigot-api/${version}-R0.1-SNAPSHOT/spigot-api-${fileName}-sources.jar`)

	if (!fileResponse.ok) throw new Error('Spigot Maven Repository did not respond');

	const contentLength = fileResponse.headers.get('Content-Length');

	receivedLength = 0;
	const chunks = [];
	fileResponse.body.on('data', value => {
		chunks.push(value);
		receivedLength += value.length;
		process.stdout.write(`Spigot API Sources ${version} - ${Math.trunc((receivedLength / contentLength) * 100)}%\r`);
	});

	await new Promise(resolve => fileResponse.body.on('close', resolve));
	console.log();

	return [Buffer.concat(apiChunks), Buffer.concat(chunks)];
}

module.exports = async function(cacheDirs) {

	console.log('hydrating project...');

	const confPath = path.resolve('plug.conf.js');

	try {
		await fs.stat(confPath);
	} catch {
		console.log('no config for project present!');
		return;
	}

	const options = require(confPath);

	// clear all old configs
	await Promise.all([
		fs.rm('.plug', { recursive: true, force: true }),
		fs.rm('.vscode', { recursive: true, force: true })
	])

	await mkdirCD('.plug/server');

	const [jdk17, jdk8] = await require('./get-jdk-paths')();
	const semver = require('semver');

	// get appropriate java executable for minecraft version
	const javaExecutable = join(semver.lte(options.minecraftVersion, '1.16.5') ? jdk8 : jdk17, 'bin/java');

	console.log('setting up local dev server...');

	const serverJarPath = path.join(cacheDirs.server, options.minecraftVersion + '.jar');

	try {
		await fs.stat(serverJarPath);
	} catch {
		try {
			const serverJar = await downloadServer(options.minecraftVersion);
			await fs.writeFile(serverJarPath, serverJar);
		} catch (e) {
			console.log('download failed. sorry. info:', e.message);
			return;
		}
	}
	
	await fs.writeFile('eula.txt', 'eula=true');

	const serverProcess = spawn(javaExecutable, ['-jar', serverJarPath, 'nogui']);
	
	await new Promise(resolve => serverProcess.stdout.on('data', d => {
		process.stdout.write(d);
		d.includes('For help, type "help"') && resolve();
	}));

	serverProcess.kill('SIGINT'); // kill with fake ctrl+c

	await mkdirCD('../classes');
	
	await mkdirCD(`../../.vscode`);

	const apiJarPath = path.join(cacheDirs.api, options.minecraftVersion + '.jar');
	const apiSourceJarPath = path.join(cacheDirs.api, options.minecraftVersion + '_src.jar');

	try {
		await fs.stat(apiJarPath);
	} catch {
		try {
			// spigot api had weird dependencies before 1.11.2 -> use shaded jar
			const [apiJar,apiSourceJar] = await downloadApi(options.minecraftVersion, semver.lte(options.minecraftVersion, '1.11.2'));
			await fs.writeFile(apiJarPath, apiJar);
			await fs.writeFile(apiSourceJarPath, apiSourceJar);
		} catch (e) {
			console.log('download failed. sorry. info:', e.message);
			return;
		}
	}

	const settingsTemplate = require('./vscode.settings.json');
	settingsTemplate['java.project.referencedLibraries'].include.push(apiJarPath);
	settingsTemplate['java.project.referencedLibraries'].sources[apiJarPath] = apiSourceJarPath;

	if(semver.lte(options.minecraftVersion, '1.16.5')) {
		settingsTemplate['java.configuration.runtimes'][0].name += '1.8';
		settingsTemplate['java.configuration.runtimes'][0].path = jdk8;
	} else if(semver.lte(options.minecraftVersion, '1.17.1')) {
		settingsTemplate['java.configuration.runtimes'][0].name += '16';
		settingsTemplate['java.configuration.runtimes'][0].path = jdk17;
	} else {
		settingsTemplate['java.configuration.runtimes'][0].name += '17';
		settingsTemplate['java.configuration.runtimes'][0].path = jdk17;
	}

	await fs.writeFile('settings.json', JSON.stringify(settingsTemplate, null, 4));


	const launchTemplate = require('./vscode.launch.json');
	//TODO
	await fs.writeFile('launch.json', JSON.stringify(launchTemplate, null, 4));


	const tasksTemplate = require('./vscode.tasks.json');
	//TODO
	await fs.writeFile('tasks.json', JSON.stringify(tasksTemplate, null, 4));

}