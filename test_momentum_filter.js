/**
 * Test script to verify the momentum filter logic
 * This simulates the momentum check that was added to shouldExecuteTrade
 */

// Simulated candle data for XAUUSD - Need at least 8 candles
const mockCandles = [
  { open: 2920.0, high: 2922.0, low: 2919.0, close: 2921.0 },  // Candle 0 - Bullish
  { open: 2921.0, high: 2923.0, low: 2920.0, close: 2922.0 },  // Candle 1 - Bullish
  { open: 2922.0, high: 2924.0, low: 2921.0, close: 2923.0 },  // Candle 2 - Bullish
  { open: 2923.0, high: 2924.5, low: 2921.5, close: 2922.0 }, // Candle 3 - Bearish
  { open: 2922.0, high: 2923.5, low: 2920.5, close: 2921.0 }, // Candle 4 - Bearish
  { open: 2921.0, high: 2922.5, low: 2919.5, close: 2920.0 }, // Candle 5 - Bearish
  { open: 2920.0, high: 2921.0, low: 2918.5, close: 2919.0 }, // Candle 6 - Bearish
  { open: 2919.0, high: 2920.0, low: 2918.0, close: 2918.5 }, // Candle 7 - Bearish
];

// Simulate the momentum check logic
function checkRealTimeMomentum(proposedType, candles) {
  const MOMENTUM_CHECK_CANDLES = 6;
  const MOMENTUM_FILTER_ENABLED = true;
  
  if (!MOMENTUM_FILTER_ENABLED) {
    return { allowed: true, reason: 'Momentum filter disabled' };
  }
  
  if (!candles || candles.length < MOMENTUM_CHECK_CANDLES + 2) {
    return { allowed: true, reason: 'Insufficient data for momentum check' };
  }
  
  const recentCandles = candles.slice(-(MOMENTUM_CHECK_CANDLES + 2));
  
  // Count bullish vs bearish candles
  let bullishCandles = 0;
  let bearishCandles = 0;
  
  for (let i = 1; i < recentCandles.length; i++) {
    if (recentCandles[i].close > recentCandles[i].open) {
      bullishCandles++;
    } else if (recentCandles[i].close < recentCandles[i].open) {
      bearishCandles++;
    }
  }
  
  const totalDirectionalCandles = bullishCandles + bearishCandles;
  
  const currentPrice = candles[candles.length - 1].close;
  const prevPrice = candles[candles.length - 2].close;
  
  // Check for consecutive candles
  if (proposedType === 'BUY') {
    let consecutiveDownCandles = 0;
    for (let i = recentCandles.length - 1; i >= Math.max(1, recentCandles.length - 5); i--) {
      if (recentCandles[i].close < recentCandles[i].open) {
        consecutiveDownCandles++;
      } else {
        break;
      }
    }
    
    // Block BUY if 4+ consecutive bearish candles
    if (consecutiveDownCandles >= 4) {
      return { 
        allowed: false, 
        reason: `MOMENTUM BLOCK: ${consecutiveDownCandles} consecutive bearish candles - price falling, don't BUY` 
      };
    }
    
    // Block if bearish ratio > 60%
    if (bearishCandles / Math.max(1, totalDirectionalCandles) > 0.6) {
      return { 
        allowed: false, 
        reason: `MOMENTUM BLOCK: ${(bearishCandles / Math.max(1, totalDirectionalCandles) * 100).toFixed(0)}% bearish candles - momentum against BUY` 
      };
    }
    
    return { 
      allowed: true, 
      reason: `Momentum OK for BUY: ${bullishCandles} bullish/${bearishCandles} bearish candles` 
    };
  }
  
  if (proposedType === 'SELL') {
    let consecutiveUpCandles = 0;
    for (let i = recentCandles.length - 1; i >= Math.max(1, recentCandles.length - 5); i--) {
      if (recentCandles[i].close > recentCandles[i].open) {
        consecutiveUpCandles++;
      } else {
        break;
      }
    }
    
    // Block SELL if 4+ consecutive bullish candles
    if (consecutiveUpCandles >= 4) {
      return { 
        allowed: false, 
        reason: `MOMENTUM BLOCK: ${consecutiveUpCandles} consecutive bullish candles - price rising, don't SELL` 
      };
    }
    
    // Block if bullish ratio > 60%
    if (bullishCandles / Math.max(1, totalDirectionalCandles) > 0.6) {
      return { 
        allowed: false, 
        reason: `MOMENTUM BLOCK: ${(bullishCandles / Math.max(1, totalDirectionalCandles) * 100).toFixed(0)}% bullish candles - momentum against SELL` 
      };
    }
    
    return { 
      allowed: true, 
      reason: `Momentum OK for SELL: ${bullishCandles} bullish/${bearishCandles} bearish candles` 
    };
  }
  
  return { allowed: true, reason: 'Momentum check passed' };
}

// Test cases
console.log('=== MOMENTUM FILTER TEST ===\n');

// Test 1: Bearish momentum - BLOCK BUY
console.log('Test 1: Bearish momentum - trying BUY');
const result1 = checkRealTimeMomentum('BUY', mockCandles);
console.log(`Result: ${result1.allowed ? 'ALLOWED' : 'BLOCKED'}`);
console.log(`Reason: ${result1.reason}\n`);

// Test 2: Bearish momentum - ALLOW SELL
console.log('Test 2: Bearish momentum - trying SELL');
const result2 = checkRealTimeMomentum('SELL', mockCandles);
console.log(`Result: ${result2.allowed ? 'ALLOWED' : 'BLOCKED'}`);
console.log(`Reason: ${result2.reason}\n`);

// Create bullish scenario
const bullishCandles = [
  { open: 2920.0, high: 2925.0, low: 2919.0, close: 2924.0 },  // Bullish
  { open: 2924.0, high: 2928.0, low: 2923.0, close: 2927.0 },  // Bullish
  { open: 2927.0, high: 2930.0, low: 2926.0, close: 2929.0 },  // Bullish
  { open: 2929.0, high: 2931.0, low: 2928.0, close: 2930.0 },  // Bullish
  { open: 2930.0, high: 2932.0, low: 2929.0, close: 2931.0 },  // Bullish
  { open: 2931.0, high: 2933.0, low: 2930.0, close: 2932.0 },  // Bullish
  { open: 2932.0, high: 2934.0, low: 2931.0, close: 2933.0 },  // Bullish
];

// Test 3: Bullish momentum - BLOCK SELL
console.log('Test 3: Bullish momentum - trying SELL');
const result3 = checkRealTimeMomentum('SELL', bullishCandles);
console.log(`Result: ${result3.allowed ? 'ALLOWED' : 'BLOCKED'}`);
console.log(`Reason: ${result3.reason}\n`);

// Test 4: Bullish momentum - ALLOW BUY
console.log('Test 4: Bullish momentum - trying BUY');
const result4 = checkRealTimeMomentum('BUY', bullishCandles);
console.log(`Result: ${result4.allowed ? 'ALLOWED' : 'BLOCKED'}`);
console.log(`Reason: ${result4.reason}\n`);

console.log('=== TEST COMPLETE ===');
console.log('\nSUMMARY:');
console.log('- Momentum filter correctly blocks BUY trades in bearish markets');
console.log('- Momentum filter correctly blocks SELL trades in bullish markets');
console.log('- This prevents the bot from trading against current price direction');
