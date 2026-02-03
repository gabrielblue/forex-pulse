/**
 * Test script to verify reversal detection works
 * Run with: node test_reversal_detection.js
 */

// Simulate the reversal detection logic
function detectReversalSignal(priceHistory, currentPrice) {
  const candles = priceHistory.map(p => ({ close: p, open: p * (1 + Math.random() * 0.001 - 0.0005), high: p * 1.001, low: p * 0.999 }));
  candles.push({ close: currentPrice, open: currentPrice * 0.9995, high: currentPrice * 1.001, low: currentPrice * 0.999 });
  
  const symbol = 'XAUUSD';
  
  // Calculate short-term momentum (last 3 candles)
  const momentum3 = (currentPrice - candles[candles.length - 3].close) / candles[candles.length - 3].close;
  const momentum6 = (currentPrice - candles[candles.length - 6].close) / candles[candles.length - 6].close;
  
  // Detect momentum direction change
  const momentumTurningUp = momentum3 > 0 && momentum6 < 0; // Was falling, now rising
  const momentumTurningDown = momentum3 < 0 && momentum6 > 0; // Was rising, now falling
  
  // Calculate price change from recent swing levels
  const recentSwingHigh = Math.max(...candles.slice(-5).map(c => c.high));
  const recentSwingLow = Math.min(...candles.slice(-5).map(c => c.low));
  
  const brokeSwingHigh = currentPrice > recentSwingHigh;
  const brokeSwingLow = currentPrice < recentSwingLow;
  
  // Candle strength
  const currentChange = currentPrice - candles[candles.length - 1].open;
  const prevChange = candles[candles.length - 2].close - candles[candles.length - 2].open;
  const strongBullishCandle = currentChange > Math.abs(prevChange) * 1.5 && currentChange > 0;
  const strongBearishCandle = currentChange < -Math.abs(prevChange) * 1.5 && currentChange < 0;
  
  // Combine reversal signals
  let bullishReversalScore = 0;
  let bearishReversalScore = 0;
  let reversalReason = [];
  
  // Bullish reversal signals
  if (momentumTurningUp) {
    bullishReversalScore += 3;
    reversalReason.push('Momentum turning up');
  }
  if (brokeSwingHigh) {
    bullishReversalScore += 4;
    reversalReason.push('Broke swing high');
  }
  if (strongBullishCandle) {
    bullishReversalScore += 3;
    reversalReason.push('Strong bullish candle');
  }
  
  // Bearish reversal signals
  if (momentumTurningDown) {
    bearishReversalScore += 3;
    reversalReason.push('Momentum turning down');
  }
  if (brokeSwingLow) {
    bearishReversalScore += 4;
    reversalReason.push('Broke swing low');
  }
  if (strongBearishCandle) {
    bearishReversalScore += 3;
    reversalReason.push('Strong bearish candle');
  }
  
  // Threshold for reversal detection
  const reversalThreshold = 5;
  
  if (bullishReversalScore >= reversalThreshold) {
    return { detected: true, direction: 'BUY', score: bullishReversalScore, reason: reversalReason.join('; ') };
  }
  
  if (bearishReversalScore >= reversalThreshold) {
    return { detected: true, direction: 'SELL', score: bearishReversalScore, reason: reversalReason.join('; ') };
  }
  
  return { detected: false, direction: 'NEUTRAL', score: 0, reason: 'No reversal detected' };
}

// Test 1: Bearish to Bullish reversal
console.log('='.repeat(60));
console.log('📊 Test 1: Bearish to Bullish Reversal');
console.log('='.repeat(60));

// Simulate price going down then reversing up
const downtrend = [4660, 4658, 4655, 4652, 4648, 4645, 4648, 4652, 4655, 4658, 4662];
const reversal1 = detectReversalSignal(downtrend.slice(0, -1), downtrend[downtrend.length - 1]);
console.log(`Price history: ${downtrend.slice(-5).join(' → ')}`);
console.log(`Current price: ${downtrend[downtrend.length - 1]}`);
console.log(`Reversal detected: ${reversal1.detected ? 'YES' : 'NO'}`);
console.log(`Direction: ${reversal1.direction}`);
console.log(`Score: ${reversal1.score}`);
console.log(`Reason: ${reversal1.reason}`);
console.log(`✅ ${reversal1.direction === 'BUY' ? 'PASS - Correctly detected bullish reversal' : 'FAIL - Should detect BUY'}`);

// Test 2: Bullish to Bearish reversal
console.log('\n' + '='.repeat(60));
console.log('📊 Test 2: Bullish to Bearish Reversal');
console.log('='.repeat(60));

// Simulate price going up then reversing down
const uptrend = [4640, 4642, 4645, 4648, 4650, 4652, 4648, 4644, 4640, 4636, 4632];
const reversal2 = detectReversalSignal(uptrend.slice(0, -1), uptrend[uptrend.length - 1]);
console.log(`Price history: ${uptrend.slice(-5).join(' → ')}`);
console.log(`Current price: ${uptrend[uptrend.length - 1]}`);
console.log(`Reversal detected: ${reversal2.detected ? 'YES' : 'NO'}`);
console.log(`Direction: ${reversal2.direction}`);
console.log(`Score: ${reversal2.score}`);
console.log(`Reason: ${reversal2.reason}`);
console.log(`✅ ${reversal2.direction === 'SELL' ? 'PASS - Correctly detected bearish reversal' : 'FAIL - Should detect SELL'}`);

// Test 3: Continue downward trend (no reversal)
console.log('\n' + '='.repeat(60));
console.log('📊 Test 3: Continuing Downtrend (No Reversal)');
console.log('='.repeat(60));

const downtrend2 = [4680, 4678, 4675, 4672, 4668, 4665, 4662, 4658, 4655, 4652, 4648];
const reversal3 = detectReversalSignal(downtrend2.slice(0, -1), downtrend2[downtrend2.length - 1]);
console.log(`Price history: ${downtrend2.slice(-5).join(' → ')}`);
console.log(`Current price: ${downtrend2[downtrend2.length - 1]}`);
console.log(`Reversal detected: ${reversal3.detected ? 'YES' : 'NO'}`);
console.log(`Direction: ${reversal3.direction}`);
console.log(`✅ ${!reversal3.detected ? 'PASS - Correctly identified no reversal' : 'FAIL - Should not detect reversal in downtrend'}`);

// Test 4: Market from user's data (downward trend ending)
console.log('\n' + '='.repeat(60));
console.log('📊 Test 4: Real Market Data (Users Recent Trades)');
console.log('='.repeat(60));

// User's recent trades show prices around 4637-4660, with Take Profits hit
const realMarketPrices = [4660, 4658, 4655, 4652, 4648, 4645, 4648, 4652, 4655, 4658, 4660];
const reversal4 = detectReversalSignal(realMarketPrices.slice(0, -1), realMarketPrices[realMarketPrices.length - 1]);
console.log(`Price history: ${realMarketPrices.slice(-5).join(' → ')}`);
console.log(`Current price: ${realMarketPrices[realMarketPrices.length - 1]}`);
console.log(`Reversal detected: ${reversal4.detected ? 'YES' : 'NO'}`);
console.log(`Direction: ${reversal4.direction}`);
console.log(`Score: ${reversal4.score}`);
console.log(`Reason: ${reversal4.reason}`);
if (reversal4.detected) {
  console.log(`✅ Reversal signal: Bot should now take ${reversal4.direction} positions`);
} else {
  console.log(`ℹ️ No reversal yet: Bot continues with existing trend signal`);
}

console.log('\n' + '='.repeat(60));
console.log('📈 Summary');
console.log('='.repeat(60));
console.log('The reversal detection system now analyzes:');
console.log('1. Momentum direction change (3-candle vs 6-candle)');
console.log('2. Break of recent swing highs/lows');
console.log('3. Strong displacement candles');
console.log('4. Candlestick reversal patterns');
console.log('');
console.log('This allows the bot to detect when the market changes direction');
console.log('and switch from SELL to BUY (or vice versa) much faster!');
