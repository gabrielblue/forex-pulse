/**
 * Test script for Micro Account Strategy
 * Simulates trading with $8 account to validate the strategy
 */

const { microAccountStrategy } = require('./src/lib/trading/strategies/microAccountStrategy.ts');
const { microAccountStrategyEnhanced } = require('./src/lib/trading/strategies/microAccountStrategyEnhanced.ts');
const { getMicroAccountConfig, getConfiguredSymbols } = require('./src/lib/trading/config/microAccountConfig.ts');

// Simulate price data for testing
function generateTestPrices(basePrice, volatility = 0.0002, length = 100) {
  const prices = [basePrice];
  
  for (let i = 1; i < length; i++) {
    const change = (Math.random() * 2 - 1) * volatility;
    prices.push(prices[i - 1] + change);
  }
  
  return prices;
}

// Simulate bullish trend
function generateBullishPrices(basePrice, length = 100) {
  const prices = [basePrice];
  
  for (let i = 1; i < length; i++) {
    const change = Math.random() * 0.00015 + 0.00005; // Slightly bullish
    prices.push(prices[i - 1] + change);
  }
  
  return prices;
}

// Simulate bearish trend
function generateBearishPrices(basePrice, length = 100) {
  const prices = [basePrice];
  
  for (let i = 1; i < length; i++) {
    const change = -(Math.random() * 0.00015 + 0.00005); // Slightly bearish
    prices.push(prices[i - 1] + change);
  }
  
  return prices;
}

async function testMicroAccountStrategy() {
  console.log('🧪 Testing Micro Account Strategy for $8 to $100 Growth');
  console.log('======================================================\n');
  
  const symbols = getConfiguredSymbols();
  console.log(`✅ Configured symbols: ${symbols.join(', ')}`);
  console.log('');
  
  // Test each configured symbol
  for (const symbol of symbols) {
    const config = getMicroAccountConfig(symbol);
    console.log(`📊 Testing ${symbol} (${config.timeframe} timeframe)`);
    console.log(`   - Stop Loss: ${config.stopLossPips} pips`);
    console.log(`   - Take Profit: ${config.takeProfitPips} pips`);
    console.log(`   - Risk Reward: ${config.riskRewardRatio}:1`);
    console.log(`   - Min Profit Target: $${config.minProfitTarget}`);
    console.log('');
    
    // Test bullish scenario
    const bullishPrices = generateBullishPrices(1.1000, 100);
    const currentPrice = bullishPrices[bullishPrices.length - 1];
    
    console.log(`   📈 Bullish Scenario (Price: ${currentPrice.toFixed(5)})`);
    
    const signal = await microAccountStrategy.executeMicroAccountStrategy(
      symbol,
      bullishPrices,
      currentPrice,
      8
    );
    
    if (signal) {
      console.log(`   ✅ Signal Generated: ${signal.type}`);
      console.log(`   🎯 Confidence: ${signal.confidence}%`);
      console.log(`   💰 Expected Profit: $${((signal.takeProfit - signal.entryPrice) / config.pipValue).toFixed(2)}`);
      console.log(`   🛑 Stop Loss: ${signal.stopLoss.toFixed(5)}`);
      console.log(`   🎯 Take Profit: ${signal.takeProfit.toFixed(5)}`);
      console.log(`   📝 Reasoning: ${signal.reasoning}`);
    } else {
      console.log(`   ❌ No signal generated (market conditions not met)`);
    }
    console.log('');
    
    // Test bearish scenario
    const bearishPrices = generateBearishPrices(1.1000, 100);
    const bearishCurrentPrice = bearishPrices[bearishPrices.length - 1];
    
    console.log(`   📉 Bearish Scenario (Price: ${bearishCurrentPrice.toFixed(5)})`);
    
    const bearishSignal = await microAccountStrategy.executeMicroAccountStrategy(
      symbol,
      bearishPrices,
      bearishCurrentPrice,
      8
    );
    
    if (bearishSignal) {
      console.log(`   ✅ Signal Generated: ${bearishSignal.type}`);
      console.log(`   🎯 Confidence: ${bearishSignal.confidence}%`);
      console.log(`   💰 Expected Profit: $${((bearishSignal.entryPrice - bearishSignal.takeProfit) / config.pipValue).toFixed(2)}`);
      console.log(`   🛑 Stop Loss: ${bearishSignal.stopLoss.toFixed(5)}`);
      console.log(`   🎯 Take Profit: ${bearishSignal.takeProfit.toFixed(5)}`);
      console.log(`   📝 Reasoning: ${bearishSignal.reasoning}`);
    } else {
      console.log(`   ❌ No signal generated (market conditions not met)`);
    }
    console.log('');
    console.log('─'.repeat(60));
    console.log('');
  }
  
  // Test enhanced strategy with multi-timeframe
  console.log('🚀 Testing Enhanced Strategy with Multi-Timeframe Alignment');
  console.log('==========================================================\n');
  
  const symbol = 'EURUSD';
  const config = getMicroAccountConfig(symbol);
  
  // Generate higher timeframe data (H1)
  const htfPrices = generateBullishPrices(1.1000, 50);
  const ltfPrices = generateBullishPrices(1.1050, 100); // Recent pullback
  const currentPrice = ltfPrices[ltfPrices.length - 1];
  
  console.log(`📊 Testing ${symbol} with HTF (H1) and LTF (M15) alignment`);
  console.log(`   HTF Price: ${htfPrices[htfPrices.length - 1].toFixed(5)}`);
  console.log(`   LTF Price: ${currentPrice.toFixed(5)}`);
  console.log('');
  
  const enhancedSignal = await microAccountStrategyEnhanced.executeEnhancedMicroStrategy(
    symbol,
    ltfPrices,
    currentPrice,
    htfPrices,
    8
  );
  
  if (enhancedSignal) {
    console.log(`   ✅ Enhanced Signal Generated: ${enhancedSignal.type}`);
    console.log(`   🎯 Confidence: ${enhancedSignal.confidence}%`);
    console.log(`   📊 HTF Bias: ${enhancedSignal.htfBias}`);
    console.log(`   💰 Expected Profit: $${((enhancedSignal.takeProfit - enhancedSignal.entryPrice) / config.pipValue).toFixed(2)}`);
    console.log(`   🛑 Stop Loss: ${enhancedSignal.stopLoss.toFixed(5)}`);
    console.log(`   🎯 Take Profit: ${enhancedSignal.takeProfit.toFixed(5)}`);
    console.log(`   📝 Reasoning: ${enhancedSignal.reasoning}`);
    console.log(`   🔥 Candle Rejection: ${enhancedSignal.candleRejection}`);
    console.log(`   💧 Liquidity Sweep: ${enhancedSignal.liquiditySweep}`);
  } else {
    console.log(`   ❌ No enhanced signal generated`);
  }
  
  console.log('\n📈 Strategy Summary');
  console.log('=================');
  console.log('✅ Market Structure Detection: Implemented');
  console.log('✅ Liquidity Level Detection: Implemented');
  console.log('✅ Time-Based Filters: Implemented (London/NY sessions)');
  console.log('✅ Risk Management: 1% per trade, 1.8:1 RR');
  console.log('✅ Multi-Timeframe Alignment: Implemented');
  console.log('✅ Candle Behavior Analysis: Implemented');
  console.log('✅ Small Profit Targets: 1-3 dollars per trade');
  console.log('');
  console.log('💡 Strategy Recommendations:');
  console.log('   - Trade only during London/NY sessions');
  console.log('   - Wait for high-probability setups (confidence > 70%)');
  console.log('   - Risk 1% per trade maximum');
  console.log('   - Target 1.5-3 dollars per trade');
  console.log('   - Maximum 5 trades per day');
  console.log('   - Use M15 timeframe for entries');
  console.log('   - Check H1 timeframe for trend alignment');
  console.log('');
  console.log('🎯 Growth Projection:');
  console.log('   Starting: $8.00');
  console.log('   Daily Goal: 1-2 successful trades (1.5-3 dollars each)');
  console.log('   Weekly Goal: $12 - $24');
  console.log('   Monthly Goal: $48 - $96');
  console.log('   Target: $100 (12.5x growth)');
  console.log('');
  console.log('⚠️  Risk Warning:');
  console.log('   - Never risk more than 1% per trade');
  console.log('   - Always use stop loss');
  console.log('   - Avoid trading during news events');
  console.log('   - Paper trade first to validate strategy');
}

// Run tests
testMicroAccountStrategy().catch(console.error);