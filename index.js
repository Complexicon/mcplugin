#!/usr/bin/env node

const { mkdirSync, existsSync } = require('fs');
const path = require('path');

const userCacheDir = path.join(require('os').homedir(), '.plug_cache');

const cacheDirs = {
    server: path.join(userCacheDir, 'server_jars'),
    api: path.join(userCacheDir, 'api_jars'),
    dependencies: path.join(userCacheDir, 'dependency_cache')
}

if(!existsSync(userCacheDir)) {
    mkdirSync(userCacheDir);
    mkdirSync(cacheDirs.server);
    mkdirSync(cacheDirs.api);
    mkdirSync(cacheDirs.dependencies);
}

switch(process.argv[2]) {
    case 'init':
        require('./init-project')(cacheDirs);
        break;
    case 'test':
        require('./test-project')(cacheDirs);
        break;
    case 'build':
        require('./build-project')(cacheDirs);
        break;
    case 'hydrate':
        require('./hydrate-project')(cacheDirs);
        break;
    default:
        // show help;
        break;
}