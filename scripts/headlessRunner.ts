/*
  Headless trading bot runner
  - Connects to Exness via MT5 bridge using env credentials
  - Initializes trading system and keeps process alive
  - Robust: runs in Node without window/localStorage
*/
import fetch from 'cross-fetch';
import { tradingBot } from '../src/lib/trading/tradingBot';
import { exnessAPI, type ExnessCredentials } from '../src/lib/trading/exnessApi';

// Assign global fetch for libraries expecting it
// @ts-ignore
if (typeof globalThis.fetch === 'undefined') {
	// @ts-ignore
	globalThis.fetch = fetch as any;
}

function requiredEnv(name: string): string {
	const v = process.env[name];
	if (!v) {
		throw new Error(`Missing required env var: ${name}`);
	}
	return v;
}

async function main() {
	const dryRun = (process.env.HEADLESS_DRY_RUN || 'false').toLowerCase() === 'true';
	const accountNumber = dryRun ? '0000000' : requiredEnv('EXNESS_ACCOUNT');
	const password = dryRun ? 'x' : requiredEnv('EXNESS_PASSWORD');
	const server = dryRun ? 'demo' : requiredEnv('EXNESS_SERVER');
	const isDemo = dryRun ? true : (process.env.EXNESS_IS_DEMO || 'false').toLowerCase() === 'true';

	if (process.env.VITE_MT5_BRIDGE_URL) {
		console.log(`Using MT5 bridge: ${process.env.VITE_MT5_BRIDGE_URL}`);
	}

	const creds: ExnessCredentials = { accountNumber, password, server, isDemo };

	console.log('Starting headless bot runner...');
	await tradingBot.initialize();
	if (dryRun) {
		console.log('Dry-run mode enabled, skipping Exness connection and trading start.');
		return;
	}
	await exnessAPI.connect(creds);
	exnessAPI.startAutoReconnect();
	await tradingBot.startBot();
	await tradingBot.enableAutoTrading(true);

	console.log('Headless bot is running. Press Ctrl+C to stop.');
	process.on('SIGINT', async () => {
		console.log('Stopping headless bot...');
		await tradingBot.stopBot();
		process.exit(0);
	});
}

main().catch(err => {
	console.error('Headless runner error:', err);
	process.exit(1);
});

