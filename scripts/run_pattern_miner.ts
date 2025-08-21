import { runPatternMiner } from '@/lib/trading/patternMiner';
import fetch from 'cross-fetch';

// polyfill fetch if needed
// @ts-ignore
if (typeof globalThis.fetch === 'undefined') {
  // @ts-ignore
  globalThis.fetch = fetch as any;
}

async function main() {
  console.log('Running pattern miner...');
  await runPatternMiner();
  console.log('Pattern miner finished.');
}

main().catch((e) => {
  console.error('Pattern miner failed', e);
  process.exit(1);
});

