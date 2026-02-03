// Parameter optimization test based on backtesting results
console.log('🎯 Starting parameter optimization test...');

// Generate historical data (reuse from backtesting test)
function generateHistoricalData(symbol, days = 60, timeframe = 'H1') {
  const data = [];
  const basePrice = symbol === 'EURUSD' ? 1.0850 : symbol === 'XAUUSD' ? 1950 : 150.00;
  let currentPrice = basePrice;
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  for (let i = 0; i < days * 24; i++) {
    const timestamp = new Date(startDate.getTime() + i * 60 * 60 * 1000);

    // Add trend and volatility
    const trend = Math.sin(i / 100) * 0.001; // Slow trend
    const volatility = symbol === 'XAUUSD' ? 0.008 : 0.002;
    const change = trend + (Math.random() - 0.5) * volatility;
    currentPrice *= (1 + change);

    // Bounds
    if (symbol === 'EURUSD') {
      currentPrice = Math.max(1.00, Math.min(1.20, currentPrice));
    } else if (symbol === 'XAUUSD') {
      currentPrice = Math.max(1800, Math.min(2200, currentPrice));
    }

    const high = currentPrice * (1 + Math.random() * 0.003);
    const low = currentPrice * (1 - Math.random() * 0.003);
    const open = data.length > 0 ? data[data.length - 1].close : currentPrice;
    const close = currentPrice;
    const volume = Math.floor(Math.random() * 1000) + 100;

    data.push({ timestamp, open, high, low, close, volume });
  }

  return { symbol, timeframe, data };
}

// Improved strategy with RSI and trend filters
function improvedTrendStrategy(historicalData, parameters, currentIndex) {
  if (currentIndex < 50) return null;

  const prices = historicalData.data.slice(currentIndex - 50, currentIndex + 1).map(d => d.close);
  const currentPrice = historicalData.data[currentIndex].close;

  // Calculate RSI
  function calculateRSI(prices, period = 14) {
    let gains = 0;
    let losses = 0;

    for (let i = 1; i <= period; i++) {
      const change = prices[i] - prices[i - 1];
      if (change > 0) gains += change;
      else losses += Math.abs(change);
    }

    const avgGain = gains / period;
    const avgLoss = losses / period;
    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
  }

  const rsi = calculateRSI(prices, parameters.rsiPeriod || 14);

  // Simple moving averages
  const shortMA = prices.slice(-parameters.shortPeriod || 10).reduce((a, b) => a + b, 0) / (parameters.shortPeriod || 10);
  const longMA = prices.slice(-parameters.longPeriod || 20).reduce((a, b) => a + b, 0) / (parameters.longPeriod || 20);

  // Trend strength
  const trendStrength = Math.abs(shortMA - longMA) / currentPrice;

  let signalType = null;

  // Buy conditions
  if (shortMA > longMA &&
      rsi < (parameters.overbought || 70) &&
      trendStrength > (parameters.minTrendStrength || 0.001) &&
      prices[prices.length - 2] <= longMA) { // Crossover
    signalType = 'BUY';
  }
  // Sell conditions
  else if (shortMA < longMA &&
           rsi > (parameters.oversold || 30) &&
           trendStrength > (parameters.minTrendStrength || 0.001) &&
           prices[prices.length - 2] >= longMA) { // Crossover
    signalType = 'SELL';
  }

  if (!signalType) return null;

  // Dynamic stop loss and take profit based on volatility
  const atr = calculateATR(historicalData.data.slice(currentIndex - 20, currentIndex + 1));
  const stopLossMultiplier = parameters.stopLossMultiplier || 1.5;
  const takeProfitMultiplier = parameters.takeProfitMultiplier || 2.0;

  return {
    id: `signal_${Date.now()}_${currentIndex}`,
    symbol: historicalData.symbol,
    type: signalType,
    confidence: 75 + Math.random() * 20, // 75-95%
    entryPrice: currentPrice,
    stopLoss: signalType === 'BUY'
      ? currentPrice - (atr * stopLossMultiplier)
      : currentPrice + (atr * stopLossMultiplier),
    takeProfit: signalType === 'BUY'
      ? currentPrice + (atr * takeProfitMultiplier)
      : currentPrice - (atr * takeProfitMultiplier),
    timeframe: 'H1',
    reasoning: `${signalType} signal: MA crossover + RSI filter + trend strength`,
    source: 'Improved Trend Strategy'
  };
}

function calculateATR(priceData, period = 14) {
  if (priceData.length < period + 1) return 0.001;

  const trs = [];
  for (let i = 1; i < Math.min(priceData.length, period + 1); i++) {
    const high = priceData[i].high;
    const low = priceData[i].low;
    const prevClose = priceData[i - 1].close;
    const tr = Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose));
    trs.push(tr);
  }

  return trs.reduce((a, b) => a + b, 0) / trs.length;
}

// Run optimization
async function runOptimization() {
  try {
    const { backtestingEngine } = await import('./src/lib/trading/backtestingEngine.ts');

    console.log('📊 Generating extended historical data for optimization...');
    const historicalData = generateHistoricalData('EURUSD', 90); // 90 days for better optimization

    // Parameter ranges for optimization
    const parameterRanges = {
      shortPeriod: [5, 15],
      longPeriod: [15, 30],
      rsiPeriod: [10, 20],
      overbought: [65, 75],
      oversold: [25, 35],
      minTrendStrength: [0.0005, 0.002],
      stopLossMultiplier: [1.0, 2.5],
      takeProfitMultiplier: [1.5, 3.0]
    };

    console.log('🎯 Running parameter optimization with improved strategy...');

    const optimizationResult = await backtestingEngine.monteCarloOptimization(
      historicalData,
      improvedTrendStrategy,
      parameterRanges,
      200 // More iterations for better optimization
    );

    console.log('🎯 Optimization Results:');
    console.log('Best Parameters:', optimizationResult.bestParameters);
    console.log(`Optimized Net Profit: $${optimizationResult.bestMetrics.netProfit.toFixed(2)}`);
    console.log(`Optimized Win Rate: ${(optimizationResult.bestMetrics.winRate * 100).toFixed(1)}%`);
    console.log(`Optimized Sharpe Ratio: ${optimizationResult.bestMetrics.sharpeRatio.toFixed(2)}`);
    console.log(`Optimized Max Drawdown: ${(optimizationResult.bestMetrics.maxDrawdown * 100).toFixed(2)}%`);
    console.log(`Optimized Profit Factor: ${optimizationResult.bestMetrics.profitFactor.toFixed(2)}`);

    // Test the optimized parameters
    console.log('\n🔬 Testing optimized parameters on fresh data...');
    const testData = generateHistoricalData('EURUSD', 30); // Fresh 30-day data
    const testResult = await backtestingEngine.runBacktest(
      testData,
      improvedTrendStrategy,
      optimizationResult.bestParameters
    );

    console.log('📊 Out-of-Sample Test Results:');
    console.log(`   - Net Profit: $${testResult.metrics.netProfit.toFixed(2)}`);
    console.log(`   - Win Rate: ${(testResult.metrics.winRate * 100).toFixed(1)}%`);
    console.log(`   - Total Trades: ${testResult.metrics.totalTrades}`);
    console.log(`   - Sharpe Ratio: ${testResult.metrics.sharpeRatio.toFixed(2)}`);
    console.log(`   - Max Drawdown: ${(testResult.metrics.maxDrawdown * 100).toFixed(2)}%`);

    // Risk management recommendations
    console.log('\n🛡️ Risk Management Recommendations:');
    if (testResult.metrics.maxDrawdown > 0.05) {
      console.log('   - High drawdown detected: Consider reducing position sizes');
    }
    if (testResult.metrics.sharpeRatio < 1.0) {
      console.log('   - Sharpe ratio below 1.0: Strategy may need further refinement');
    }
    if (testResult.metrics.winRate < 0.6) {
      console.log('   - Win rate below 60%: Consider stricter entry filters');
    }

    // Performance assessment
    const performanceScore = calculatePerformanceScore(testResult.metrics);
    console.log(`\n📈 Overall Performance Score: ${performanceScore.toFixed(1)}/10`);

    if (performanceScore >= 8) {
      console.log('   ✅ EXCELLENT: Strategy ready for live trading');
    } else if (performanceScore >= 6) {
      console.log('   ✅ GOOD: Strategy suitable for paper trading with monitoring');
    } else if (performanceScore >= 4) {
      console.log('   ⚠️ FAIR: Strategy needs further optimization');
    } else {
      console.log('   ❌ POOR: Strategy requires significant improvements');
    }

    console.log('\n✅ Parameter optimization completed successfully!');

  } catch (error) {
    console.error('❌ Optimization failed:', error);
    process.exit(1);
  }
}

function calculatePerformanceScore(metrics) {
  // Multi-factor performance score (0-10)
  const profitScore = Math.min(metrics.netProfit / 500, 2); // Max 2 points for profit
  const winRateScore = metrics.winRate * 2; // Max 2 points for win rate
  const riskScore = Math.max(0, 2 - metrics.maxDrawdown * 20); // Max 2 points for low drawdown
  const consistencyScore = Math.min(metrics.sharpeRatio / 2, 2); // Max 2 points for Sharpe
  const efficiencyScore = Math.min(metrics.profitFactor / 2, 2); // Max 2 points for profit factor

  return profitScore + winRateScore + riskScore + consistencyScore + efficiencyScore;
}

runOptimization();