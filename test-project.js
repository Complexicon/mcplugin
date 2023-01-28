const path = require('path');
const fs = require('fs/promises');
const { watchFile } = require('fs');
const { spawn } = require('child_process');
const { getFiles } = require('./utils');

const buildProject = require('./build-project');
const { join, resolve } = require('path');

module.exports = async function(cacheDirs) {
	const confPath = path.resolve('plug.conf.js');

	try {
		await fs.stat(confPath);
	} catch {
		console.log('no config for project present!');
		return;
	}

	const options = require(confPath);

	await buildProject(cacheDirs);

	const serverJarPath = path.join(cacheDirs.server, options.minecraftVersion + '.jar');

	const javaOptions = require(resolve('.vscode/settings.json'));
	const javaHome = javaOptions["java.configuration.runtimes"][0].path;

	const server = spawn(join(javaHome, 'bin/java'), ['-agentlib:jdwp=transport=dt_socket,server=y,suspend=y,address=5005', '-jar', serverJarPath, 'nogui'], { cwd: path.resolve('.plug/server') });

	server.stdout.pipe(process.stdout);
	server.stderr.pipe(process.stdout);
	
	//process.stdin.setRawMode(true);
	process.stdin.pipe(server.stdin);

	const srcLoc = path.join(process.cwd(), 'src/main/java');
	const srcFiles = (await getFiles(srcLoc)).filter(v => v.endsWith('.java'));

	for(const file of srcFiles) {
		watchFile(file, { interval: 1000 }, async() => {
			await buildProject(cacheDirs);
			server.stdin.write('reload confirm\n');
		});
	}

}