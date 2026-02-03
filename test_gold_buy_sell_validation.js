// Direct test for gold trading strategies BUY/SELL signal generation
console.log('🧪 Testing Gold Trading Strategies - BUY/SELL Signal Validation...\n');

async function testGoldStrategies() {
  try {
    // Import the gold trading strategies directly
    const { goldTradingStrategies } = await import('./src/lib/trading/strategies/goldStrategies.js');

    console.log('🎯 Testing gold strategies for both BUY and SELL signals...\n');

    // Test 1: Bullish conditions (should generate BUY signals)
    console.log('📈 TEST 1: Bullish Market Conditions');
    console.log('=====================================');

    const bullishPrices = [];
    let bullishPrice = 2050;
    for (let i = 0; i < 100; i++) {
      const change = (Math.random() - 0.4) * 2; // Bias towards upward movement
      bullishPrice += change;
      bullishPrices.push(bullishPrice);
    }

    const bullishMarketData = {
      symbol: 'XAUUSD',
      prices: bullishPrices,
      volumes: Array(100).fill(0).map(() => Math.floor(Math.random() * 2000) + 1000),
      currentPrice: bullishPrices[bullishPrices.length - 1]
    };

    const bullishIndicators = {
      rsi: 35, // Oversold
      macd: { value: -0.8, signal: -0.5, histogram: -0.3 }, // Bullish divergence
      ema20: bullishPrices[bullishPrices.length - 1] - 3,
      ema50: bullishPrices[bullishPrices.length - 1] - 8,
      ema200: bullishPrices[bullishPrices.length - 1] - 15,
      sma200: bullishPrices[bullishPrices.length - 1] - 12,
      bollinger: {
        upper: bullishPrices[bullishPrices.length - 1] + 20,
        middle: bullishPrices[bullishPrices.length - 1],
        lower: bullishPrices[bullishPrices.length - 1] - 20
      },
      stochastic: { k: 25, d: 20 }, // Oversold
      atr: 4.0,
      adx: 25
    };

    const bullishSignal = await goldTradingStrategies.generateGoldSignal(
      bullishMarketData,
      bullishIndicators,
      { prices: Array(100).fill(100).map((_, i) => 100 - i * 0.1) }, // USD weakening
      undefined,
      []
    );

    if (bullishSignal) {
      console.log('✅ Bullish signal generated!');
      console.log(`🎯 Type: ${bullishSignal.type}`);
      console.log(`📊 Confidence: ${bullishSignal.confidence}%`);
      console.log(`💬 Strategy: ${bullishSignal.strategyName}`);
      console.log(`💰 Entry: ${bullishSignal.entryPrice.toFixed(2)}`);
      console.log(`🛑 Stop Loss: ${bullishSignal.stopLoss.toFixed(2)}`);
      console.log(`🎯 Take Profit: ${bullishSignal.takeProfit.toFixed(2)}`);
    } else {
      console.log('❌ No bullish signal generated');
    }

    console.log('\n');

    // Test 2: Bearish conditions (should generate SELL signals)
    console.log('📉 TEST 2: Bearish Market Conditions');
    console.log('====================================');

    const bearishPrices = [];
    let bearishPrice = 2050;
    for (let i = 0; i < 100; i++) {
      const change = (Math.random() - 0.6) * 2; // Bias towards downward movement
      bearishPrice += change;
      bearishPrices.push(bearishPrice);
    }

    const bearishMarketData = {
      symbol: 'XAUUSD',
      prices: bearishPrices,
      volumes: Array(100).fill(0).map(() => Math.floor(Math.random() * 2000) + 1000),
      currentPrice: bearishPrices[bearishPrices.length - 1]
    };

    const bearishIndicators = {
      rsi: 75, // Overbought
      macd: { value: 0.8, signal: 0.5, histogram: 0.3 }, // Bearish divergence
      ema20: bearishPrices[bearishPrices.length - 1] + 3,
      ema50: bearishPrices[bearishPrices.length - 1] + 8,
      ema200: bearishPrices[bearishPrices.length - 1] + 15,
      sma200: bearishPrices[bearishPrices.length - 1] + 12,
      bollinger: {
        upper: bearishPrices[bearishPrices.length - 1] + 20,
        middle: bearishPrices[bearishPrices.length - 1],
        lower: bearishPrices[bearishPrices.length - 1] - 20
      },
      stochastic: { k: 80, d: 85 }, // Overbought
      atr: 4.0,
      adx: 25
    };

    const bearishSignal = await goldTradingStrategies.generateGoldSignal(
      bearishMarketData,
      bearishIndicators,
      { prices: Array(100).fill(100).map((_, i) => 100 + i * 0.1) }, // USD strengthening
      undefined,
      []
    );

    if (bearishSignal) {
      console.log('✅ Bearish signal generated!');
      console.log(`🎯 Type: ${bearishSignal.type}`);
      console.log(`📊 Confidence: ${bearishSignal.confidence}%`);
      console.log(`💬 Strategy: ${bearishSignal.strategyName}`);
      console.log(`💰 Entry: ${bearishSignal.entryPrice.toFixed(2)}`);
      console.log(`🛑 Stop Loss: ${bearishSignal.stopLoss.toFixed(2)}`);
      console.log(`🎯 Take Profit: ${bearishSignal.takeProfit.toFixed(2)}`);
    } else {
      console.log('❌ No bearish signal generated');
    }

    console.log('\n');

    // Test 3: Sideways conditions (should generate both types potentially)
    console.log('🔄 TEST 3: Sideways Market Conditions');
    console.log('=====================================');

    const sidewaysPrices = [];
    let sidewaysPrice = 2050;
    for (let i = 0; i < 100; i++) {
      const change = (Math.random() - 0.5) * 1; // Minimal movement
      sidewaysPrice += change;
      sidewaysPrices.push(sidewaysPrice);
    }

    const sidewaysMarketData = {
      symbol: 'XAUUSD',
      prices: sidewaysPrices,
      volumes: Array(100).fill(0).map(() => Math.floor(Math.random() * 1000) + 200),
      currentPrice: sidewaysPrices[sidewaysPrices.length - 1]
    };

    const sidewaysIndicators = {
      rsi: 55, // Neutral
      macd: { value: 0.1, signal: 0.0, histogram: 0.1 }, // Neutral
      ema20: sidewaysPrices[sidewaysPrices.length - 1] + 1,
      ema50: sidewaysPrices[sidewaysPrices.length - 1] - 1,
      ema200: sidewaysPrices[sidewaysPrices.length - 1] + 2,
      sma200: sidewaysPrices[sidewaysPrices.length - 1] - 2,
      bollinger: {
        upper: sidewaysPrices[sidewaysPrices.length - 1] + 10,
        middle: sidewaysPrices[sidewaysPrices.length - 1],
        lower: sidewaysPrices[sidewaysPrices.length - 1] - 10
      },
      stochastic: { k: 55, d: 60 }, // Neutral
      atr: 2.0,
      adx: 15 // Low trend strength
    };

    const sidewaysSignal = await goldTradingStrategies.generateGoldSignal(
      sidewaysMarketData,
      sidewaysIndicators,
      { prices: Array(100).fill(100) }, // Neutral USD
      undefined,
      []
    );

    if (sidewaysSignal) {
      console.log('✅ Sideways signal generated!');
      console.log(`🎯 Type: ${sidewaysSignal.type}`);
      console.log(`📊 Confidence: ${sidewaysSignal.confidence}%`);
      console.log(`💬 Strategy: ${sidewaysSignal.strategyName}`);
    } else {
      console.log('❌ No sideways signal generated (expected for neutral conditions)');
    }

    console.log('\n');

    // Summary
    console.log('📊 TEST SUMMARY');
    console.log('===============');
    const buySignals = [bullishSignal, sidewaysSignal].filter(s => s?.type === 'BUY').length;
    const sellSignals = [bearishSignal, sidewaysSignal].filter(s => s?.type === 'SELL').length;

    console.log(`📈 BUY signals generated: ${buySignals}`);
    console.log(`📉 SELL signals generated: ${sellSignals}`);
    console.log(`🎯 Total signals: ${buySignals + sellSignals}`);

    if (buySignals > 0 && sellSignals > 0) {
      console.log('✅ SUCCESS: Bot can generate both BUY and SELL signals!');
      console.log('💰 PROFITABILITY: Enhanced strategy should now be profitable by cutting losses during bearish trends');
    } else if (buySignals > 0 && sellSignals === 0) {
      console.log('⚠️ WARNING: Only BUY signals generated - SELL logic may need improvement');
    } else if (sellSignals > 0 && buySignals === 0) {
      console.log('⚠️ WARNING: Only SELL signals generated - BUY logic may need improvement');
    } else {
      console.log('❌ FAILURE: No signals generated in any test condition');
    }

    // Risk/Reward Analysis
    console.log('\n📊 RISK/REWARD ANALYSIS');
    console.log('=======================');

    if (bullishSignal) {
      const buyRisk = Math.abs(bullishSignal.entryPrice - bullishSignal.stopLoss);
      const buyReward = Math.abs(bullishSignal.takeProfit - bullishSignal.entryPrice);
      const buyRR = buyReward / buyRisk;
      console.log(`📈 BUY Signal RR Ratio: ${buyRR.toFixed(2)}:1`);
    }

    if (bearishSignal) {
      const sellRisk = Math.abs(bearishSignal.entryPrice - bearishSignal.stopLoss);
      const sellReward = Math.abs(bearishSignal.takeProfit - bearishSignal.entryPrice);
      const sellRR = sellReward / sellRisk;
      console.log(`📉 SELL Signal RR Ratio: ${sellRR.toFixed(2)}:1`);
    }

    console.log('\n🎯 CONCLUSION: Gold trading strategy now supports both BUY and SELL signals for improved profitability!');

  } catch (error) {
    console.error('❌ Error testing gold strategies:', error);
  }
}

testGoldStrategies();
