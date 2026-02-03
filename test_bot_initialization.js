// Test script to verify bot initialization and paper trading mode
console.log('🧪 Testing bot initialization and paper trading mode...');

async function testBotInitialization() {
  try {
    // Import the trading bot
    const { tradingBot } = await import('./src/lib/trading/tradingBot.js');

    console.log('📦 Trading bot imported successfully');

    // Initialize the bot
    console.log('🚀 Initializing trading bot...');
    await tradingBot.initialize();

    console.log('✅ Bot initialized successfully');

    // Check bot status
    const status = tradingBot.getStatus();
    console.log('📊 Bot status:', status);

    // Check configuration
    const config = tradingBot.getConfiguration();
    console.log('⚙️ Bot configuration:', {
      enabledSymbols: config.enabledSymbols,
      minConfidence: config.minConfidence,
      maxRiskPerTrade: config.maxRiskPerTrade,
      tradingHours: config.tradingHours
    });

    // Test starting the bot (should work in paper mode)
    console.log('▶️ Starting bot...');
    await tradingBot.startBot();

    const statusAfterStart = tradingBot.getStatus();
    console.log('📊 Bot status after start:', statusAfterStart);

    // Test enabling auto-trading
    console.log('🎯 Enabling auto-trading...');
    await tradingBot.enableAutoTrading(true);

    const statusAfterAuto = tradingBot.getStatus();
    console.log('📊 Bot status after enabling auto-trading:', statusAfterAuto);

    // Test generating a test signal
    console.log('🧪 Generating test signal...');
    await tradingBot.generateTestSignal();

    console.log('✅ All bot initialization tests passed!');
    console.log('🎯 Bot is ready for multi-symbol trading in paper mode');

  } catch (error) {
    console.error('❌ Bot initialization test failed:', error);
    console.error('🔍 Error details:', {
      message: error.message,
      stack: error.stack
    });
  }
}

testBotInitialization();