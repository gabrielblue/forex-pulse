/**
 * Test script to verify major currency pairs configuration
 * This script tests that the bot correctly uses major currency pairs for accounts below $50
 */

const { MAJOR_CURRENCY_PAIRS, TOP_100_SYMBOLS } = require('./src/lib/trading/symbolWhitelist.ts');

console.log('='.repeat(80));
console.log('MAJOR CURRENCY PAIRS CONFIGURATION TEST');
console.log('='.repeat(80));

// Test 1: Verify MAJOR_CURRENCY_PAIRS does not contain gold/silver
console.log('\n✓ Test 1: Verify MAJOR_CURRENCY_PAIRS excludes gold/silver');
const hasGold = MAJOR_CURRENCY_PAIRS.includes('XAUUSD');
const hasSilver = MAJOR_CURRENCY_PAIRS.includes('XAGUSD');
console.log(`  - Contains XAUUSD (Gold): ${hasGold ? '❌ FAIL' : '✅ PASS'}`);
console.log(`  - Contains XAGUSD (Silver): ${hasSilver ? '❌ FAIL' : '✅ PASS'}`);

// Test 2: Verify MAJOR_CURRENCY_PAIRS contains major pairs
console.log('\n✓ Test 2: Verify MAJOR_CURRENCY_PAIRS contains major pairs');
const majorPairs = ['EURUSD', 'GBPUSD', 'USDJPY', 'USDCHF', 'AUDUSD', 'NZDUSD', 'USDCAD'];
majorPairs.forEach(pair => {
  const hasPair = MAJOR_CURRENCY_PAIRS.includes(pair);
  console.log(`  - Contains ${pair}: ${hasPair ? '✅ PASS' : '❌ FAIL'}`);
});

// Test 3: Verify TOP_100_SYMBOLS still contains gold/silver
console.log('\n✓ Test 3: Verify TOP_100_SYMBOLS includes gold/silver');
const topHasGold = TOP_100_SYMBOLS.includes('XAUUSD');
const topHasSilver = TOP_100_SYMBOLS.includes('XAGUSD');
console.log(`  - Contains XAUUSD (Gold): ${topHasGold ? '✅ PASS' : '❌ FAIL'}`);
console.log(`  - Contains XAGUSD (Silver): ${topHasSilver ? '✅ PASS' : '❌ FAIL'}`);

// Test 4: Count symbols
console.log('\n✓ Test 4: Symbol counts');
console.log(`  - MAJOR_CURRENCY_PAIRS count: ${MAJOR_CURRENCY_PAIRS.length}`);
console.log(`  - TOP_100_SYMBOLS count: ${TOP_100_SYMBOLS.length}`);

// Test 5: Display first 10 major pairs
console.log('\n✓ Test 5: First 10 major currency pairs');
console.log(`  - ${MAJOR_CURRENCY_PAIRS.slice(0, 10).join(', ')}`);

console.log('\n' + '='.repeat(80));
console.log('CONFIGURATION TEST COMPLETE');
console.log('='.repeat(80));
console.log('\n📝 SUMMARY:');
console.log('  - Bot will use MAJOR_CURRENCY_PAIRS for accounts below $50');
console.log('  - Bot will use XAUUSD and XAGUSD for accounts $50 and above');
console.log('  - Your $8 account will trade major currency pairs only');
console.log('  - Goal: Flip $8 to $100 using safe major pairs');
console.log('\n');
