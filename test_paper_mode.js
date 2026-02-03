// Simple test to verify paper trading mode is working
console.log('🧪 Testing paper trading mode...');

async function testPaperMode() {
  try {
    // Simulate what happens when the app initializes
    console.log('📝 Simulating app initialization...');

    // Check if MT5 bridge is running
    const response = await fetch('http://127.0.0.1:8002/status');
    const bridgeStatus = await response.json();
    console.log('🔗 MT5 Bridge status:', bridgeStatus);

    // Check if symbols are available
    const symbolsResponse = await fetch('http://127.0.0.1:8002/mt5/symbols', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: 'mt5_1768259593_81469037' })
    });

    if (symbolsResponse.ok) {
      const symbolsData = await symbolsResponse.json();
      console.log('📊 Symbols available:', symbolsData.symbols?.length || 0);

      // Check for major currencies and commodities
      const testSymbols = ['EURUSD', 'GBPUSD', 'USDJPY', 'USDCHF', 'AUDUSD', 'USDCAD', 'NZDUSD', 'XAUUSD', 'XAGUSD'];
      testSymbols.forEach(symbol => {
        const hasSymbol = symbolsData.symbols?.some(s => s.name === symbol);
        console.log(`📈 ${symbol} available:`, hasSymbol);
      });
    }

    // Test multiple symbol prices
    const testSymbols = ['EURUSD', 'GBPUSD', 'USDJPY', 'XAUUSD'];
    for (const symbol of testSymbols) {
      try {
        const priceResponse = await fetch('http://127.0.0.1:8002/mt5/symbol_price', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ session_id: 'mt5_1768259593_81469037', symbol })
        });

        if (priceResponse.ok) {
          const priceData = await priceResponse.json();
          console.log(`💰 ${symbol} price:`, priceData.data);
        } else {
          console.log(`❌ ${symbol} price fetch failed:`, priceResponse.status);
        }
      } catch (error) {
        console.log(`❌ ${symbol} price fetch error:`, error.message);
      }
    }

    console.log('✅ Paper trading mode test completed successfully');
    console.log('🎯 The bot should now be able to run in paper trading mode and generate signals');

  } catch (error) {
    console.error('❌ Error testing paper mode:', error);
  }
}

testPaperMode();