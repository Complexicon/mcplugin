const { join, resolve, relative, basename } = require('path');
const { readdir, stat, cp, rm } = require('fs/promises');
const { getFiles } = require('./utils');
const { createWriteStream, createReadStream } = require('fs');

module.exports = async function(cacheDirs) {

	const confPath = resolve('plug.conf.js');

	try {
		await stat(confPath);
	} catch {
		console.log('no config for project present!');
		return;
	}

	try {
		await stat('.plug');
	} catch {
		console.log('project not hydrated!');
		await require('./hydrate-project')(cacheDirs);
	}

	const options = require(confPath);

	const srcLoc = join(process.cwd(), 'src/main/java');
	const srcFiles = (await getFiles(srcLoc)).filter(v => v.endsWith('.java'));

	const spawn = require('child_process').spawnSync;
	console.log('building plugin...');

	const apiJarPath = join(cacheDirs.api, options.minecraftVersion + '.jar');

	// use a makefile like approach of comparing last modified time
	const toBuild = [];
	const classPath = [apiJarPath];

	for(const file of srcFiles) {
		
		// assume this is safe because they were queried less than a second ago.
		const srcStat = await stat(file);

		try {
			const base = relative(srcLoc, file);
			const classFile = join('.plug/classes', base.substring(0, base.length - 5) + '.class');
			const classFileStat = await stat(classFile);
			if(srcStat.mtime > classFileStat.mtime) toBuild.push(file);
			else classPath.push(resolve(classFile));
		} catch {
			toBuild.push(file);
		}
	}

	const javaOptions = require(resolve('.vscode/settings.json'));

	const javaHome = javaOptions["java.configuration.runtimes"][0].path;
	const compilerPath = join(javaHome, 'bin/javac') + (process.platform === 'win32' ? '.exe' : '');
	const packagingToolPath = join(javaHome, 'bin/jar') + (process.platform === 'win32' ? '.exe' : '');

	if(toBuild.length !== 0) {
		const result = spawn(compilerPath, ['-encoding', 'UTF-8', '-cp', classPath.join(process.platform === 'win32' ? ';' : ':'), '-sourcepath', srcLoc, '-d', '.plug/classes', ...toBuild]);

		if(result.status !== 0) {
			console.log('build failed!:');
			console.log(result.stderr.toString('utf-8'));
		}
	} else {
		console.log('up to date, skipping build step.');
	}

	try {
		await cp('src/main/resources/plugin.yml', '.plug/classes/plugin.yml');
	} catch (e) {
		console.log('warning: could\'nt copy plugin.yml! plugin might not work.');
	}

	console.log('packing jar...');

	const packingResult = spawn(packagingToolPath, ['cf', '.plug/plugin.jar', '-C', '.plug/classes', '.']);
	if(packingResult.status !== 0) {
		console.log('warning: packing failed!');
		console.log(packingResult.stderr.toString('utf8'));
	}

	// file is locked... bypass the unlink command of "cp"
	createReadStream('.plug/plugin.jar').pipe(createWriteStream('.plug/server/plugins/plugin.jar'));
	
	console.log('build completed.');
}