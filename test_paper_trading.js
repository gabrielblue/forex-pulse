// Test script to verify paper trading mode works without Supabase
console.log('🧪 Testing paper trading mode independence...');

// Mock environment variables to avoid Supabase connection
process.env.VITE_SUPABASE_URL = 'mock-url';
process.env.VITE_SUPABASE_ANON_KEY = 'mock-key';

// Import the trading bot
import('./src/lib/trading/tradingBot.ts').then(async ({ tradingBot }) => {
  try {
    console.log('✅ Successfully imported tradingBot');

    // Test initialization
    await tradingBot.initialize();
    console.log('✅ Bot initialized successfully');

    // Test starting bot (should work in paper mode)
    await tradingBot.startBot();
    console.log('✅ Bot started successfully in paper mode');

    // Test enabling auto-trading
    await tradingBot.enableAutoTrading(true);
    console.log('✅ Auto-trading enabled successfully');

    // Test getting status
    const status = tradingBot.getStatus();
    console.log('📊 Bot status:', status);

    // Test configuration
    const config = tradingBot.getConfiguration();
    console.log('⚙️ Bot configuration:', config);

    console.log('🎉 All tests passed! Paper trading mode is independent of Supabase.');

    // Stop the bot
    await tradingBot.stopBot();
    console.log('🛑 Bot stopped successfully');

    process.exit(0);
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}).catch(error => {
  console.error('❌ Failed to import tradingBot:', error);
  process.exit(1);
});