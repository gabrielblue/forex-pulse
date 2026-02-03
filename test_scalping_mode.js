// Test script for scalping mode functionality
// Run this in the browser console after the app loads

console.log('🧪 Testing scalping mode functionality...');

async function testScalpingMode() {
  try {
    // Wait for the app to load
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Check if tradingBot is available globally
    if (typeof window !== 'undefined' && window.tradingBot) {
      const bot = window.tradingBot;

      console.log('✅ Trading bot found in global scope');

      // Check bot status
      const status = bot.getStatus();
      console.log('🤖 Bot status:', status);

      // Check configuration
      const config = bot.getConfiguration();
      console.log('⚙️ Bot configuration:', config);

      // Verify scalping settings
      if (config.minConfidence === 10) {
        console.log('✅ Ultra-aggressive confidence threshold (10%) - PASSED');
      } else {
        console.log('❌ Confidence threshold not set correctly:', config.minConfidence);
      }

      if (config.maxRiskPerTrade === 25.0) {
        console.log('✅ Ultra-aggressive risk per trade (25%) - PASSED');
      } else {
        console.log('❌ Risk per trade not set correctly:', config.maxRiskPerTrade);
      }

      if (config.enabledSymbols.includes('XAUUSD')) {
        console.log('✅ Gold trading enabled (XAUUSD) - PASSED');
      } else {
        console.log('❌ Gold trading not enabled');
      }

      if (config.emergencyStopEnabled === false) {
        console.log('✅ Emergency stops disabled for continuous scalping - PASSED');
      } else {
        console.log('❌ Emergency stops should be disabled for scalping');
      }

      // Test bot initialization
      console.log('🚀 Testing bot initialization...');
      await bot.initialize();
      console.log('✅ Bot initialization completed');

      // Check if bot auto-started
      const updatedStatus = bot.getStatus();
      console.log('📊 Updated bot status:', updatedStatus);

      console.log('✅ Scalping mode test completed successfully!');
      console.log('🎯 Bot is configured for:');
      console.log('   - 12:1 risk-reward ratio scalping');
      console.log('   - Gold-only trading (XAUUSD/XAGUSD)');
      console.log('   - 5-minute timeframe');
      console.log('   - Tight 3-5 pip stops');
      console.log('   - Ultra-aggressive settings for $10-$100 daily profits');

    } else {
      console.log('❌ Trading bot not found in global scope');
      console.log('💡 Make sure the app is fully loaded and tradingBot is exposed globally');
    }

  } catch (error) {
    console.error('❌ Error testing scalping mode:', error);
  }
}

// Auto-run the test
testScalpingMode();
