#!/usr/bin/env node

/**
 * Test script to verify real account symbol availability fix
 * Run this after connecting to a real account to ensure symbols are properly filtered
 */

const { exnessAPI } = require('./src/lib/trading/exnessApi.ts');

async function testRealAccountSymbols() {
  console.log('🧪 Testing real account symbol availability fix...\n');

  try {
    // Check if connected
    const isConnected = exnessAPI.isConnectedToExness();
    console.log(`📡 Connection status: ${isConnected ? '✅ Connected' : '❌ Not connected'}`);

    if (!isConnected) {
      console.log('⚠️  Please connect to MT5 first before running this test');
      return;
    }

    // Get account info
    const accountInfo = await exnessAPI.getAccountInfo();
    console.log(`👤 Account: ${accountInfo?.accountNumber} (${accountInfo?.isDemo ? 'Demo' : 'Real'})`);
    console.log(`🏦 Server: ${accountInfo?.server}`);
    console.log(`💰 Balance: $${accountInfo?.balance?.toFixed(2)}`);
    console.log(`🔓 Trading allowed: ${accountInfo?.tradeAllowed ? '✅ Yes' : '❌ No'}\n`);

    // Debug available symbols
    const availableCount = exnessAPI.getAvailableSymbolsCount();
    const cachedSymbols = exnessAPI.debugAvailableSymbols();
    console.log(`📊 Available symbols in cache: ${availableCount}`);
    console.log(`📋 Sample available symbols: ${cachedSymbols.join(', ')}\n`);

    // Get available symbols
    console.log('🔍 Fetching available symbols...');
    const availableSymbols = await exnessAPI.getAvailableSymbols();
    console.log(`📊 Available symbols in MT5: ${availableSymbols.length}`);
    console.log(`📋 First 10: ${availableSymbols.slice(0, 10).join(', ')}\n`);

    // Get tradable symbols
    console.log('🎯 Testing tradable symbols (with data availability)...');
    const tradableSymbols = await exnessAPI.getTradableSymbols();
    console.log(`✅ Tradable symbols: ${tradableSymbols.length}`);
    console.log(`📋 Tradable: ${tradableSymbols.join(', ')}\n`);

    // Test price fetching for tradable symbols
    console.log('💰 Testing price fetching for tradable symbols...');
    let successCount = 0;
    let failCount = 0;

    for (const symbol of tradableSymbols.slice(0, 5)) { // Test first 5
      try {
        const price = await exnessAPI.getCurrentPrice(symbol);
        if (price) {
          console.log(`  ✅ ${symbol}: ${price.bid} (spread: ${price.spread})`);
          successCount++;
        } else {
          console.log(`  ❌ ${symbol}: No price available`);
          failCount++;
        }
      } catch (error) {
        console.log(`  ❌ ${symbol}: Error - ${error.message}`);
        failCount++;
      }
    }

    console.log(`\n📈 Price fetch results: ${successCount} success, ${failCount} failed`);

    // Summary
    console.log('\n🎉 Test completed!');
    console.log(`📊 Summary:`);
    console.log(`   - Available symbols: ${availableSymbols.length}`);
    console.log(`   - Tradable symbols: ${tradableSymbols.length}`);
    console.log(`   - Price fetch success rate: ${successCount}/${successCount + failCount}`);

    if (tradableSymbols.length > 0 && failCount === 0) {
      console.log('✅ Real account symbol fix appears to be working correctly!');
    } else {
      console.log('⚠️  Some issues detected. Check the logs above.');
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testRealAccountSymbols().catch(console.error);