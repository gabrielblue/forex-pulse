// Test sniper entry logic
console.log('🎯 Testing sniper entry logic...');

const { enhancedTradingSystem } = require('./src/lib/trading/strategies/enhancedStrategies.ts');

async function testSniperLogic() {
  try {
    console.log('🔍 Testing enhanced trading system with sniper entries...');

    // Mock market data for EURUSD
    const mockMarketData = {
      symbol: 'EURUSD',
      prices: [1.0800, 1.0810, 1.0820, 1.0815, 1.0825, 1.0830, 1.0828, 1.0835, 1.0840, 1.0838]
    };

    const mockIndicators = {
      rsi: 65,
      macd: { value: 0.0002, signal: 0.0001, histogram: 0.0001 },
      ema20: 1.0820,
      ema50: 1.0810,
      ema200: 1.0800,
      bollinger: { upper: 1.0850, middle: 1.0825, lower: 1.0800 },
      stochastic: { k: 70, d: 65 },
      atr: 0.0010,
      adx: 35
    };

    const mockSessionInfo = [
      { name: 'London', isActive: true, volume: 'HIGH' },
      { name: 'New York', isActive: true, volume: 'HIGH' }
    ];

    const mockNewsEvents = []; // No high impact news

    console.log('📊 Generating signal with sniper entry logic...');

    const signal = await enhancedTradingSystem.generateOptimalSignal(
      'EURUSD',
      mockMarketData,
      mockIndicators,
      mockSessionInfo,
      mockNewsEvents
    );

    if (signal) {
      console.log('✅ Signal generated successfully!');
      console.log('📈 Signal details:', {
        symbol: signal.symbol,
        type: signal.type,
        confidence: signal.confidence,
        entryPrice: signal.entryPrice,
        stopLoss: signal.stopLoss,
        takeProfit: signal.takeProfit,
        riskRewardRatio: signal.riskRewardRatio,
        reasoning: signal.reasoning
      });

      // Check if sniper entry logic worked
      if (signal.entryPrice !== mockMarketData.prices[mockMarketData.prices.length - 1]) {
        console.log('🎯 Sniper entry logic activated - entry price differs from current price');
      } else {
        console.log('⚠️ Entry price matches current price - sniper logic may not have activated');
      }

      // Check risk-reward ratio
      if (signal.riskRewardRatio >= 1.5) {
        console.log('💰 Good risk-reward ratio:', signal.riskRewardRatio.toFixed(2));
      } else {
        console.log('⚠️ Poor risk-reward ratio:', signal.riskRewardRatio.toFixed(2));
      }

    } else {
      console.log('❌ No signal generated');
    }

  } catch (error) {
    console.error('❌ Error testing sniper logic:', error);
  }
}

testSniperLogic();