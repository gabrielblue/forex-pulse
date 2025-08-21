#!/usr/bin/env node
const { execSync } = require('node:child_process');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
try {
	execSync(`npx tsc -p ${path.join(__dirname, 'tsconfig.runner.json')}`,
		{ stdio: 'inherit', cwd: root });
	console.log('Runner built to dist-runner');
} catch (e) {
	console.error('Failed to build runner');
	process.exit(1);
}