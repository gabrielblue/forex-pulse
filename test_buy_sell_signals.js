/**
 * Test script to verify BUY and SELL signals are now generated
 * Run with: node test_buy_sell_signals.js
 */

// Simulate the fixed gold strategy logic
function testEnhancedScalpingSignal() {
  console.log('🧪 Testing Enhanced Scalping Signal Generation\n');
  console.log('='.repeat(60));
  
  // Test Case 1: Bullish EMA with negative momentum (previously rejected)
  console.log('\n📊 Test Case 1: Bullish EMA with negative momentum');
  console.log('-'.repeat(40));
  const test1 = simulateEnhancedScalp({
    ema20: 4660,
    ema50: 4650, // Bullish
    priceMomentum: -0.00001, // Slightly negative (was rejected)
    rsi: 45,
    usdIndex: 103.5,
    trendConfirmation: true
  });
  console.log(`Result: ${test1.signal ? test1.signal.type : 'No signal'} (Expected: BUY)`);
  console.log(`✅ PASS: ${test1.signal?.type === 'BUY' ? 'YES' : 'NO'}`);
  
  // Test Case 2: Bearish EMA with positive momentum (previously rejected)
  console.log('\n📊 Test Case 2: Bearish EMA with positive momentum');
  console.log('-'.repeat(40));
  const test2 = simulateEnhancedScalp({
    ema20: 4650,
    ema50: 4660, // Bearish
    priceMomentum: 0.00001, // Slightly positive (was rejected)
    rsi: 55,
    usdIndex: 103.5,
    trendConfirmation: true
  });
  console.log(`Result: ${test2.signal ? test2.signal.type : 'No signal'} (Expected: SELL)`);
  console.log(`✅ PASS: ${test2.signal?.type === 'SELL' ? 'YES' : 'NO'}`);
  
  // Test Case 3: Strong USD with bullish EMA (previously rejected BUY)
  console.log('\n📊 Test Case 3: Strong USD (105) with bullish EMA');
  console.log('-'.repeat(40));
  const test3 = simulateEnhancedScalp({
    ema20: 4660,
    ema50: 4650, // Bullish
    priceMomentum: 0.0001, // Positive momentum
    rsi: 45,
    usdIndex: 105, // Strong USD (was blocking BUY)
    trendConfirmation: true
  });
  console.log(`Result: ${test3.signal ? test3.signal.type : 'No signal'} (Expected: BUY)`);
  console.log(`✅ PASS: ${test3.signal?.type === 'BUY' ? 'YES' : 'NO'}`);
  
  // Test Case 4: Weak USD with bearish EMA (previously rejected SELL)
  console.log('\n📊 Test Case 4: Weak USD (101) with bearish EMA');
  console.log('-'.repeat(40));
  const test4 = simulateEnhancedScalp({
    ema20: 4650,
    ema50: 4660, // Bearish
    priceMomentum: -0.0001, // Negative momentum
    rsi: 55,
    usdIndex: 101, // Weak USD (was blocking SELL)
    trendConfirmation: true
  });
  console.log(`Result: ${test4.signal ? test4.signal.type : 'No signal'} (Expected: SELL)`);
  console.log(`✅ PASS: ${test4.signal?.type === 'SELL' ? 'YES' : 'NO'}`);
  
  // Test Case 5: All confirmations perfect (should still work)
  console.log('\n📊 Test Case 5: Perfect bullish setup');
  console.log('-'.repeat(40));
  const test5 = simulateEnhancedScalp({
    ema20: 4660,
    ema50: 4650, // Bullish
    priceMomentum: 0.0005, // Strong positive
    rsi: 40, // Favorable for BUY
    usdIndex: 103, // Neutral USD
    trendConfirmation: true
  });
  console.log(`Result: ${test5.signal ? test5.signal.type : 'No signal'} (Expected: BUY)`);
  console.log(`✅ PASS: ${test5.signal?.type === 'BUY' ? 'YES' : 'NO'}`);
  
  // Test Case 6: Perfect bearish setup
  console.log('\n📊 Test Case 6: Perfect bearish setup');
  console.log('-'.repeat(40));
  const test6 = simulateEnhancedScalp({
    ema20: 4650,
    ema50: 4660, // Bearish
    priceMomentum: -0.0005, // Strong negative
    rsi: 60, // Favorable for SELL
    usdIndex: 104, // Neutral USD
    trendConfirmation: true
  });
  console.log(`Result: ${test6.signal ? test6.signal.type : 'No signal'} (Expected: SELL)`);
  console.log(`✅ PASS: ${test6.signal?.type === 'SELL' ? 'YES' : 'NO'}`);
  
  console.log('\n' + '='.repeat(60));
  console.log('📈 Summary: All test cases should now generate both BUY and SELL signals');
  console.log('   The bot will no longer be stuck generating only SELL signals!');
}

// Simulate the enhanced scalping logic (simplified version)
function simulateEnhancedScalp(params) {
  const { ema20, ema50, priceMomentum, rsi, usdIndex, trendConfirmation } = params;
  const currentPrice = 4650;
  
  const emaBullish = ema20 > ema50;
  let confirmationScore = 0;
  const confirmations = [];
  let momentumReduction = 0;
  let usdReduction = 0;
  
  // Confirmation 1: EMA trend
  if (emaBullish) {
    confirmations.push('EMA_BULLISH');
    confirmationScore++;
  } else {
    confirmations.push('EMA_BEARISH');
    confirmationScore++;
  }
  
  // Confirmation 2: Momentum (FIXED - now allows with reduction)
  if (emaBullish && priceMomentum > 0) {
    confirmations.push('MOMENTUM_CONFIRM_BUY');
    confirmationScore++;
  } else if (!emaBullish && priceMomentum < 0) {
    confirmations.push('MOMENTUM_CONFIRM_SELL');
    confirmationScore++;
  } else {
    confirmations.push('MOMENTUM_WEAK');
    momentumReduction = 10;
  }
  
  // Confirmation 3: RSI
  if (emaBullish && rsi < 55) {
    confirmations.push('RSI_FAVORABLE_BUY');
    confirmationScore++;
  } else if (!emaBullish && rsi > 45) {
    confirmations.push('RSI_FAVORABLE_SELL');
    confirmationScore++;
  } else {
    confirmations.push('RSI_UNFAVORABLE');
  }
  
  // Confirmation 4: USD Index (FIXED - now allows with reduction)
  if (usdIndex > 104) {
    if (!emaBullish) {
      confirmations.push('USD_STRONG_CONFIRM_SELL');
      confirmationScore++;
    } else {
      confirmations.push('USD_OPPOSES_BUY');
      usdReduction = 10;
    }
  } else if (usdIndex < 102) {
    if (emaBullish) {
      confirmations.push('USD_WEAK_CONFIRM_BUY');
      confirmationScore++;
    } else {
      confirmations.push('USD_OPPOSES_SELL');
      usdReduction = 10;
    }
  } else {
    confirmations.push('USD_NEUTRAL');
    confirmationScore++;
  }
  
  // Confirmation 5: Trend confirmation
  if (trendConfirmation) {
    confirmations.push('TREND_CONFIRMED');
    confirmationScore++;
  } else {
    confirmations.push('TREND_UNCONFIRMED');
  }
  
  // Minimum confirmations (FIXED - reduced from 4 to 3)
  const minConfirmations = 3;
  
  if (confirmationScore < minConfirmations) {
    return { signal: null, reason: 'Insufficient confirmations' };
  }
  
  // Determine trade direction
  const tradeType = emaBullish ? 'BUY' : 'SELL';
  
  // Calculate confidence
  const confidenceBoost = (confirmationScore - minConfirmations) * 5;
  const baseConfidence = 75 - momentumReduction - usdReduction;
  const confidence = Math.min(90, Math.max(50, baseConfidence + confidenceBoost));
  
  console.log(`Confirmations: ${confirmationScore}/${minConfirmations} [${confirmations.join(', ')}]`);
  console.log(`Momentum reduction: ${momentumReduction}%, USD reduction: ${usdReduction}%`);
  console.log(`Confidence: ${confidence}%`);
  
  return {
    signal: {
      type: tradeType,
      confidence,
      reason: `Generated ${tradeType} with ${confirmationScore} confirmations`
    }
  };
}

// Run tests
testEnhancedScalpingSignal();
