// Test script for gold trading functionality
console.log('🧪 Testing gold trading functionality...');

async function testGoldTrading() {
  try {
    // Import the trading bot
    const { tradingBot } = await import('./src/lib/trading/tradingBot.ts');

    console.log('✅ Trading bot imported successfully');

    // Check bot status
    const status = tradingBot.getStatus();
    console.log('🤖 Bot status:', status);

    // Check configuration
    const config = tradingBot.getConfiguration();
    console.log('⚙️ Bot configuration:', config);

    // Force a gold trade test
    console.log('🧪 Testing force gold trade...');
    await tradingBot.forceGoldTrade();

    console.log('✅ Gold trading test completed');

  } catch (error) {
    console.error('❌ Error testing gold trading:', error);
  }
}

testGoldTrading();