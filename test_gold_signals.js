// Test script for gold signal generation
console.log('🧪 Testing gold signal generation...');

async function testGoldSignals() {
  try {
    // Import the gold trading strategies
    const { goldTradingStrategies } = await import('./src/lib/trading/strategies/goldStrategies.ts');

    // Create mock market data for XAUUSD
    const currentPrice = 2050; // Current gold price
    const prices = [];
    let price = currentPrice;

    // Generate 100 price points with some volatility
    for (let i = 0; i < 100; i++) {
      const change = (Math.random() - 0.5) * 4; // Random change
      price += change;
      prices.push(price);
    }

    const volumes = Array(100).fill(0).map(() => Math.floor(Math.random() * 2000) + 500);

    const marketData = {
      symbol: 'XAUUSD',
      prices,
      volumes,
      currentPrice
    };

    // Calculate basic indicators
    const indicators = {
      rsi: 45,
      macd: { value: -0.5, signal: -0.3, histogram: -0.2 },
      ema20: currentPrice - 2,
      ema50: currentPrice - 5,
      ema200: currentPrice - 10,
      sma200: currentPrice - 8,
      bollinger: {
        upper: currentPrice + 15,
        middle: currentPrice,
        lower: currentPrice - 15
      },
      stochastic: { k: 40, d: 35 },
      atr: 3.5,
      adx: 28
    };

    const sessionInfo = [{ name: 'London', isActive: true, volume: 'HIGH' }];
    const newsEvents = [];

    console.log('📊 Testing gold signal generation with mock data...');
    console.log(`💰 Current price: ${currentPrice}`);
    console.log(`📈 EMA20: ${indicators.ema20}, EMA50: ${indicators.ema50}`);
    console.log(`📊 RSI: ${indicators.rsi}`);

    const signal = await enhancedTradingSystem.generateOptimalSignal(
      'XAUUSD',
      marketData,
      indicators,
      sessionInfo,
      newsEvents
    );

    if (signal) {
      console.log('✅ Gold signal generated successfully!');
      console.log(`🎯 Type: ${signal.type}`);
      console.log(`📊 Confidence: ${signal.confidence}%`);
      console.log(`💰 Entry: ${signal.entryPrice}`);
      console.log(`🛑 Stop Loss: ${signal.stopLoss}`);
      console.log(`🎯 Take Profit: ${signal.takeProfit}`);
      console.log(`📝 Strategy: ${signal.strategyName}`);
      console.log(`💬 Reasoning: ${signal.reasoning}`);
    } else {
      console.log('❌ No gold signal generated');
      console.log('🔍 This could be due to:');
      console.log('   - Market conditions not meeting strategy requirements');
      console.log('   - Volatility too high/low');
      console.log('   - Indicators not in favorable range');
    }

  } catch (error) {
    console.error('❌ Error testing gold signals:', error);
  }
}

testGoldSignals();