// Test script for backtesting engine with synthetic historical data
console.log('🔬 Starting backtesting test with synthetic historical data...');

// Generate synthetic historical data for EURUSD
function generateSyntheticData(symbol, days = 30, timeframe = 'H1') {
  const data = [];
  const basePrice = symbol === 'EURUSD' ? 1.0850 : symbol === 'XAUUSD' ? 1950 : 150.00;
  let currentPrice = basePrice;
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  for (let i = 0; i < days * 24; i++) { // 24 hours per day for H1
    const timestamp = new Date(startDate.getTime() + i * 60 * 60 * 1000);

    // Generate realistic price movement
    const volatility = symbol === 'XAUUSD' ? 0.005 : 0.001; // Higher volatility for gold
    const change = (Math.random() - 0.5) * volatility;
    currentPrice *= (1 + change);

    // Ensure price stays within reasonable bounds
    if (symbol === 'EURUSD') {
      currentPrice = Math.max(1.00, Math.min(1.20, currentPrice));
    } else if (symbol === 'XAUUSD') {
      currentPrice = Math.max(1800, Math.min(2200, currentPrice));
    }

    const high = currentPrice * (1 + Math.random() * 0.002);
    const low = currentPrice * (1 - Math.random() * 0.002);
    const open = data.length > 0 ? data[data.length - 1].close : currentPrice;
    const close = currentPrice;
    const volume = Math.floor(Math.random() * 1000) + 100;

    data.push({
      timestamp,
      open,
      high,
      low,
      close,
      volume
    });
  }

  return {
    symbol,
    timeframe,
    data
  };
}

// Simple strategy for backtesting
function simpleTrendStrategy(historicalData, parameters, currentIndex) {
  if (currentIndex < 20) return null; // Need some history

  const prices = historicalData.data.slice(currentIndex - 20, currentIndex + 1).map(d => d.close);
  const currentPrice = historicalData.data[currentIndex].close;

  // Simple moving average crossover
  const shortMA = prices.slice(-5).reduce((a, b) => a + b, 0) / 5;
  const longMA = prices.slice(-20).reduce((a, b) => a + b, 0) / 20;

  if (shortMA > longMA && prices[prices.length - 2] <= prices.slice(-20).reduce((a, b) => a + b, 0) / 20) {
    // Bullish crossover
    return {
      id: `signal_${Date.now()}_${currentIndex}`,
      symbol: historicalData.symbol,
      type: 'BUY',
      confidence: 75,
      entryPrice: currentPrice,
      stopLoss: currentPrice * 0.995,
      takeProfit: currentPrice * 1.01,
      timeframe: 'H1',
      reasoning: 'Short MA crossed above Long MA',
      source: 'Simple Trend Strategy'
    };
  } else if (shortMA < longMA && prices[prices.length - 2] >= prices.slice(-20).reduce((a, b) => a + b, 0) / 20) {
    // Bearish crossover
    return {
      id: `signal_${Date.now()}_${currentIndex}`,
      symbol: historicalData.symbol,
      type: 'SELL',
      confidence: 75,
      entryPrice: currentPrice,
      stopLoss: currentPrice * 1.005,
      takeProfit: currentPrice * 0.99,
      timeframe: 'H1',
      reasoning: 'Short MA crossed below Long MA',
      source: 'Simple Trend Strategy'
    };
  }

  return null;
}

// Run backtesting test
async function runBacktestingTest() {
  try {
    // Import the backtesting engine
    const { backtestingEngine } = await import('./src/lib/trading/backtestingEngine.ts');

    console.log('📊 Generating synthetic historical data...');
    const symbols = ['EURUSD', 'XAUUSD'];
    const results = {};

    for (const symbol of symbols) {
      console.log(`🔬 Running backtest for ${symbol}...`);

      const historicalData = generateSyntheticData(symbol, 30);
      const parameters = {}; // Default parameters

      const result = await backtestingEngine.runBacktest(
        historicalData,
        simpleTrendStrategy,
        parameters,
        10000 // Initial capital
      );

      results[symbol] = result;

      console.log(`✅ ${symbol} Backtest Results:`);
      console.log(`   - Total Trades: ${result.metrics.totalTrades}`);
      console.log(`   - Win Rate: ${(result.metrics.winRate * 100).toFixed(1)}%`);
      console.log(`   - Net Profit: $${result.metrics.netProfit.toFixed(2)}`);
      console.log(`   - Max Drawdown: ${(result.metrics.maxDrawdown * 100).toFixed(2)}%`);
      console.log(`   - Sharpe Ratio: ${result.metrics.sharpeRatio.toFixed(2)}`);
      console.log(`   - Profit Factor: ${result.metrics.profitFactor.toFixed(2)}`);
      console.log('');
    }

    // Optimization test
    console.log('🎯 Running parameter optimization for EURUSD...');
    const eurUsdData = generateSyntheticData('EURUSD', 60); // More data for optimization

    const parameterRanges = {
      stopLossMultiplier: [0.5, 2.0],
      takeProfitMultiplier: [1.0, 3.0]
    };

    // Create optimized strategy
    const optimizedStrategy = (data, params, index) => {
      const signal = simpleTrendStrategy(data, {}, index);
      if (!signal) return null;

      // Apply optimized parameters
      const stopLossMultiplier = params.stopLossMultiplier || 1.0;
      const takeProfitMultiplier = params.takeProfitMultiplier || 2.0;

      return {
        ...signal,
        stopLoss: signal.type === 'BUY'
          ? signal.entryPrice * (1 - stopLossMultiplier * 0.005)
          : signal.entryPrice * (1 + stopLossMultiplier * 0.005),
        takeProfit: signal.type === 'BUY'
          ? signal.entryPrice * (1 + takeProfitMultiplier * 0.01)
          : signal.entryPrice * (1 - takeProfitMultiplier * 0.01)
      };
    };

    const optimizationResult = await backtestingEngine.monteCarloOptimization(
      eurUsdData,
      optimizedStrategy,
      parameterRanges,
      100 // Smaller sample for testing
    );

    console.log('🎯 Optimization Results:');
    console.log(`   - Best Parameters:`, optimizationResult.bestParameters);
    console.log(`   - Optimized Net Profit: $${optimizationResult.bestMetrics.netProfit.toFixed(2)}`);
    console.log(`   - Optimized Win Rate: ${(optimizationResult.bestMetrics.winRate * 100).toFixed(1)}%`);
    console.log(`   - Optimized Sharpe Ratio: ${optimizationResult.bestMetrics.sharpeRatio.toFixed(2)}`);

    console.log('✅ Backtesting test completed successfully!');

  } catch (error) {
    console.error('❌ Backtesting test failed:', error);
    process.exit(1);
  }
}

runBacktestingTest();