import { TradingSignal } from './signalProcessor';
import { AdvancedSignal } from './strategies/worldClassStrategies';
import { enhancedTradingSystem } from './strategies/enhancedStrategies';

// Interfaces for backtesting
export interface HistoricalDataPoint {
  timestamp: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface HistoricalData {
  symbol: string;
  timeframe: string;
  data: HistoricalDataPoint[];
}

export interface StrategyParameters {
  [key: string]: number | boolean | string | [number, number];
}

export interface Trade {
  id: string;
  symbol: string;
  type: 'BUY' | 'SELL';
  entryPrice: number;
  exitPrice: number;
  entryTime: Date;
  exitTime: Date;
  quantity: number;
  profit: number;
  commission: number;
  stopLoss?: number;
  takeProfit?: number;
}

export interface PerformanceMetrics {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  profitFactor: number;
  totalProfit: number;
  totalLoss: number;
  netProfit: number;
  maxDrawdown: number;
  sharpeRatio: number;
  sortinoRatio: number;
  calmarRatio: number;
  averageWin: number;
  averageLoss: number;
  largestWin: number;
  largestLoss: number;
  averageTradeDuration: number;
  expectancy: number;
  recoveryFactor: number;
}

export interface BacktestResult {
  trades: Trade[];
  metrics: PerformanceMetrics;
  equityCurve: number[];
  drawdownCurve: number[];
  parameters: StrategyParameters;
  startDate: Date;
  endDate: Date;
}

export interface WalkForwardResult {
  inSampleResults: BacktestResult[];
  outOfSampleResults: BacktestResult[];
  overallMetrics: PerformanceMetrics;
  parameterEvolution: StrategyParameters[];
}

export interface OptimizationResult {
  bestParameters: StrategyParameters;
  bestMetrics: PerformanceMetrics;
  parameterSpace: StrategyParameters[];
  fitnessScores: number[];
}

// Strategy function type
export type StrategyFunction = (
  historicalData: HistoricalData,
  parameters: StrategyParameters,
  currentIndex: number
) => TradingSignal | null;

// Core backtesting engine
export class BacktestingEngine {
  private commission: number = 0.0002; // 0.02% per trade
  private slippage: number = 0.0001; // 0.01% slippage

  // Core backtesting function
  async runBacktest(
    historicalData: HistoricalData,
    strategy: StrategyFunction,
    parameters: StrategyParameters,
    initialCapital: number = 10000
  ): Promise<BacktestResult> {
    const trades: Trade[] = [];
    let capital = initialCapital;
    let position: { type: 'BUY' | 'SELL'; entryPrice: number; entryTime: Date; quantity: number; stopLoss?: number; takeProfit?: number } | null = null;
    const equityCurve: number[] = [initialCapital];
    const drawdownCurve: number[] = [0];

    for (let i = 0; i < historicalData.data.length; i++) {
      const currentBar = historicalData.data[i];
      const signal = strategy(historicalData, parameters, i);

      // Handle position management
      if (position) {
        let exitPrice = currentBar.close;
        let shouldExit = false;

        // Check stop loss
        if (position.stopLoss) {
          if ((position.type === 'BUY' && currentBar.low <= position.stopLoss) ||
              (position.type === 'SELL' && currentBar.high >= position.stopLoss)) {
            exitPrice = position.stopLoss;
            shouldExit = true;
          }
        }

        // Check take profit
        if (position.takeProfit) {
          if ((position.type === 'BUY' && currentBar.high >= position.takeProfit) ||
              (position.type === 'SELL' && currentBar.low <= position.takeProfit)) {
            exitPrice = position.takeProfit;
            shouldExit = true;
          }
        }

        // Check signal reversal or manual exit
        if (signal && signal.type !== position.type) {
          shouldExit = true;
        }

        if (shouldExit) {
          const profit = position.type === 'BUY'
            ? (exitPrice - position.entryPrice) * position.quantity
            : (position.entryPrice - exitPrice) * position.quantity;

          const commission = Math.abs(exitPrice * position.quantity * this.commission) * 2; // Round trip

          const trade: Trade = {
            id: `trade_${Date.now()}_${trades.length}`,
            symbol: historicalData.symbol,
            type: position.type,
            entryPrice: position.entryPrice,
            exitPrice,
            entryTime: position.entryTime,
            exitTime: currentBar.timestamp,
            quantity: position.quantity,
            profit: profit - commission,
            commission,
            stopLoss: position.stopLoss,
            takeProfit: position.takeProfit
          };

          trades.push(trade);
          capital += trade.profit;

          position = null;
        }
      }

      // Enter new position
      if (!position && signal) {
        const entryPrice = currentBar.close + (signal.type === 'BUY' ? this.slippage : -this.slippage);
        const quantity = Math.floor((capital * 0.1) / entryPrice); // 10% risk per trade

        if (quantity > 0) {
          position = {
            type: signal.type,
            entryPrice,
            entryTime: currentBar.timestamp,
            quantity,
            stopLoss: signal.stopLoss,
            takeProfit: signal.takeProfit
          };
        }
      }

      // Update equity curve
      equityCurve.push(capital);
      const peak = Math.max(...equityCurve);
      const drawdown = (peak - capital) / peak;
      drawdownCurve.push(drawdown);
    }

    const metrics = this.calculatePerformanceMetrics(trades, equityCurve, drawdownCurve);

    return {
      trades,
      metrics,
      equityCurve,
      drawdownCurve,
      parameters,
      startDate: historicalData.data[0].timestamp,
      endDate: historicalData.data[historicalData.data.length - 1].timestamp
    };
  }

  // Walk-forward analysis
  async runWalkForwardAnalysis(
    historicalData: HistoricalData,
    strategy: StrategyFunction,
    initialParameters: StrategyParameters,
    windowSize: number = 1000, // bars for in-sample
    stepSize: number = 500, // bars to advance
    optimizationMethod: 'monte-carlo' | 'genetic' = 'genetic'
  ): Promise<WalkForwardResult> {
    const inSampleResults: BacktestResult[] = [];
    const outOfSampleResults: BacktestResult[] = [];
    const parameterEvolution: StrategyParameters[] = [];

    for (let start = 0; start < historicalData.data.length - windowSize; start += stepSize) {
      const inSampleEnd = start + windowSize;
      const outOfSampleEnd = Math.min(start + windowSize + stepSize, historicalData.data.length);

      // In-sample period
      const inSampleData: HistoricalData = {
        ...historicalData,
        data: historicalData.data.slice(start, inSampleEnd)
      };

      // Optimize parameters on in-sample data
      const optimizationResult = optimizationMethod === 'genetic'
        ? await this.geneticAlgorithmOptimization(inSampleData, strategy, initialParameters, 50, 20)
        : await this.monteCarloOptimization(inSampleData, strategy, initialParameters, 1000);

      const optimizedParams = optimizationResult.bestParameters;
      parameterEvolution.push(optimizedParams);

      // Run in-sample backtest
      const inSampleResult = await this.runBacktest(inSampleData, strategy, optimizedParams);
      inSampleResults.push(inSampleResult);

      // Out-of-sample period
      if (outOfSampleEnd > inSampleEnd) {
        const outOfSampleData: HistoricalData = {
          ...historicalData,
          data: historicalData.data.slice(inSampleEnd, outOfSampleEnd)
        };

        const outOfSampleResult = await this.runBacktest(outOfSampleData, strategy, optimizedParams);
        outOfSampleResults.push(outOfSampleResult);
      }
    }

    // Calculate overall metrics
    const allOutOfSampleTrades = outOfSampleResults.flatMap(r => r.trades);
    const overallMetrics = this.calculatePerformanceMetrics(
      allOutOfSampleTrades,
      [], // Would need to reconstruct equity curve
      []
    );

    return {
      inSampleResults,
      outOfSampleResults,
      overallMetrics,
      parameterEvolution
    };
  }

  // Monte Carlo parameter optimization
  async monteCarloOptimization(
    historicalData: HistoricalData,
    strategy: StrategyFunction,
    parameterRanges: StrategyParameters,
    iterations: number = 1000
  ): Promise<OptimizationResult> {
    const parameterSpace: StrategyParameters[] = [];
    const fitnessScores: number[] = [];
    let bestParameters = { ...parameterRanges };
    let bestFitness = -Infinity;

    for (let i = 0; i < iterations; i++) {
      // Generate random parameters
      const randomParams: StrategyParameters = {};
      for (const [key, value] of Object.entries(parameterRanges)) {
        if (typeof value === 'number') {
          // Assume ranges are provided as [min, max] for numbers
          const range = value as any;
          if (Array.isArray(range)) {
            randomParams[key] = range[0] + Math.random() * (range[1] - range[0]);
          } else {
            randomParams[key] = value;
          }
        } else {
          randomParams[key] = value;
        }
      }

      // Run backtest
      const result = await this.runBacktest(historicalData, strategy, randomParams);
      const fitness = this.calculateFitnessScore(result.metrics);

      parameterSpace.push(randomParams);
      fitnessScores.push(fitness);

      if (fitness > bestFitness) {
        bestFitness = fitness;
        bestParameters = { ...randomParams };
      }
    }

    const bestResult = await this.runBacktest(historicalData, strategy, bestParameters);

    return {
      bestParameters,
      bestMetrics: bestResult.metrics,
      parameterSpace,
      fitnessScores
    };
  }

  // Genetic Algorithm optimization
  async geneticAlgorithmOptimization(
    historicalData: HistoricalData,
    strategy: StrategyFunction,
    parameterRanges: StrategyParameters,
    populationSize: number = 50,
    generations: number = 20
  ): Promise<OptimizationResult> {
    // Initialize population
    let population = this.initializePopulation(parameterRanges, populationSize);

    for (let gen = 0; gen < generations; gen++) {
      // Evaluate fitness
      const fitnessScores = await Promise.all(
        population.map(async (params) => {
          const result = await this.runBacktest(historicalData, strategy, params);
          return this.calculateFitnessScore(result.metrics);
        })
      );

      // Select parents
      const parents = this.tournamentSelection(population, fitnessScores, populationSize / 2);

      // Create new population
      const newPopulation: StrategyParameters[] = [];

      while (newPopulation.length < populationSize) {
        const parent1 = parents[Math.floor(Math.random() * parents.length)];
        const parent2 = parents[Math.floor(Math.random() * parents.length)];

        // Crossover
        const child = this.crossover(parent1, parent2);

        // Mutation
        this.mutate(child, parameterRanges, 0.1);

        newPopulation.push(child);
      }

      population = newPopulation;
    }

    // Find best
    let bestParams = population[0];
    let bestFitness = -Infinity;

    for (const params of population) {
      const result = await this.runBacktest(historicalData, strategy, params);
      const fitness = this.calculateFitnessScore(result.metrics);
      if (fitness > bestFitness) {
        bestFitness = fitness;
        bestParams = params;
      }
    }

    const bestResult = await this.runBacktest(historicalData, strategy, bestParams);

    return {
      bestParameters: bestParams,
      bestMetrics: bestResult.metrics,
      parameterSpace: population,
      fitnessScores: [] // Would need to recalculate
    };
  }

  // Automated strategy evolution
  async evolveStrategy(
    historicalData: HistoricalData,
    baseStrategy: StrategyFunction,
    generations: number = 10,
    populationSize: number = 20
  ): Promise<StrategyFunction> {
    // This is a simplified evolution - in practice, you'd evolve strategy logic
    // For now, we'll evolve parameters and return a parameterized version

    const parameterRanges: StrategyParameters = {
      rsiPeriod: [10, 30],
      emaShort: [5, 20],
      emaLong: [20, 50],
      stopLossMultiplier: [1, 3],
      takeProfitMultiplier: [2, 5]
    };

    const optimization = await this.geneticAlgorithmOptimization(
      historicalData,
      baseStrategy,
      parameterRanges,
      populationSize,
      generations
    );

    // Return strategy with optimized parameters
    return (data: HistoricalData, params: StrategyParameters, index: number) => {
      const mergedParams = { ...optimization.bestParameters, ...params };
      return baseStrategy(data, mergedParams, index);
    };
  }

  // Performance metrics calculation
  private calculatePerformanceMetrics(
    trades: Trade[],
    equityCurve: number[],
    drawdownCurve: number[]
  ): PerformanceMetrics {
    if (trades.length === 0) {
      return {
        totalTrades: 0,
        winningTrades: 0,
        losingTrades: 0,
        winRate: 0,
        profitFactor: 0,
        totalProfit: 0,
        totalLoss: 0,
        netProfit: 0,
        maxDrawdown: 0,
        sharpeRatio: 0,
        sortinoRatio: 0,
        calmarRatio: 0,
        averageWin: 0,
        averageLoss: 0,
        largestWin: 0,
        largestLoss: 0,
        averageTradeDuration: 0,
        expectancy: 0,
        recoveryFactor: 0
      };
    }

    const winningTrades = trades.filter(t => t.profit > 0);
    const losingTrades = trades.filter(t => t.profit < 0);

    const totalProfit = winningTrades.reduce((sum, t) => sum + t.profit, 0);
    const totalLoss = Math.abs(losingTrades.reduce((sum, t) => sum + t.profit, 0));

    const netProfit = totalProfit - totalLoss;
    const maxDrawdown = Math.max(...drawdownCurve);

    // Calculate returns for Sharpe ratio
    const returns: number[] = [];
    for (let i = 1; i < equityCurve.length; i++) {
      returns.push((equityCurve[i] - equityCurve[i-1]) / equityCurve[i-1]);
    }

    const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
    const stdDev = Math.sqrt(returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length);
    const sharpeRatio = stdDev > 0 ? (avgReturn / stdDev) * Math.sqrt(252) : 0; // Annualized

    // Sortino ratio (downside deviation)
    const downsideReturns = returns.filter(r => r < 0);
    const downsideDev = downsideReturns.length > 0
      ? Math.sqrt(downsideReturns.reduce((sum, r) => sum + Math.pow(r, 2), 0) / downsideReturns.length)
      : 0;
    const sortinoRatio = downsideDev > 0 ? (avgReturn / downsideDev) * Math.sqrt(252) : 0;

    // Calmar ratio
    const calmarRatio = maxDrawdown > 0 ? (netProfit / equityCurve[0]) / maxDrawdown : 0;

    // Trade durations
    const durations = trades.map(t => t.exitTime.getTime() - t.entryTime.getTime());
    const averageTradeDuration = durations.reduce((a, b) => a + b, 0) / durations.length;

    // Expectancy
    const expectancy = trades.length > 0 ? netProfit / trades.length : 0;

    // Recovery factor
    const recoveryFactor = maxDrawdown > 0 ? netProfit / maxDrawdown : 0;

    return {
      totalTrades: trades.length,
      winningTrades: winningTrades.length,
      losingTrades: losingTrades.length,
      winRate: trades.length > 0 ? winningTrades.length / trades.length : 0,
      profitFactor: totalLoss > 0 ? totalProfit / totalLoss : totalProfit > 0 ? Infinity : 0,
      totalProfit,
      totalLoss,
      netProfit,
      maxDrawdown,
      sharpeRatio,
      sortinoRatio,
      calmarRatio,
      averageWin: winningTrades.length > 0 ? totalProfit / winningTrades.length : 0,
      averageLoss: losingTrades.length > 0 ? totalLoss / losingTrades.length : 0,
      largestWin: winningTrades.length > 0 ? Math.max(...winningTrades.map(t => t.profit)) : 0,
      largestLoss: losingTrades.length > 0 ? Math.max(...losingTrades.map(t => Math.abs(t.profit))) : 0,
      averageTradeDuration,
      expectancy,
      recoveryFactor
    };
  }

  // Fitness score for optimization
  private calculateFitnessScore(metrics: PerformanceMetrics): number {
    // Multi-objective fitness function
    const profitScore = metrics.netProfit / 1000; // Normalize profit
    const riskScore = metrics.maxDrawdown > 0 ? 1 / metrics.maxDrawdown : 0;
    const consistencyScore = metrics.sharpeRatio;
    const winRateScore = metrics.winRate * 10;

    return profitScore + riskScore + consistencyScore + winRateScore;
  }

  // Genetic algorithm helpers
  private initializePopulation(parameterRanges: StrategyParameters, size: number): StrategyParameters[] {
    const population: StrategyParameters[] = [];

    for (let i = 0; i < size; i++) {
      const individual: StrategyParameters = {};
      for (const [key, value] of Object.entries(parameterRanges)) {
        if (typeof value === 'number') {
          const range = value as any;
          if (Array.isArray(range)) {
            individual[key] = range[0] + Math.random() * (range[1] - range[0]);
          } else {
            individual[key] = value;
          }
        } else {
          individual[key] = value;
        }
      }
      population.push(individual);
    }

    return population;
  }

  private tournamentSelection(
    population: StrategyParameters[],
    fitnessScores: number[],
    numParents: number
  ): StrategyParameters[] {
    const parents: StrategyParameters[] = [];

    for (let i = 0; i < numParents; i++) {
      const tournament = [];
      for (let j = 0; j < 3; j++) { // Tournament size 3
        const randomIndex = Math.floor(Math.random() * population.length);
        tournament.push({ individual: population[randomIndex], fitness: fitnessScores[randomIndex] });
      }

      tournament.sort((a, b) => b.fitness - a.fitness);
      parents.push(tournament[0].individual);
    }

    return parents;
  }

  private crossover(parent1: StrategyParameters, parent2: StrategyParameters): StrategyParameters {
    const child: StrategyParameters = {};

    for (const key of Object.keys(parent1)) {
      child[key] = Math.random() < 0.5 ? parent1[key] : parent2[key];
    }

    return child;
  }

  private mutate(
    individual: StrategyParameters,
    parameterRanges: StrategyParameters,
    mutationRate: number
  ): void {
    for (const [key, value] of Object.entries(individual)) {
      if (Math.random() < mutationRate && typeof value === 'number') {
        const range = parameterRanges[key] as any;
        if (Array.isArray(range)) {
          const currentValue = value as number;
          const mutation = (Math.random() - 0.5) * (range[1] - range[0]) * 0.1; // 10% mutation range
          individual[key] = Math.max(range[0], Math.min(range[1], currentValue + mutation));
        }
      }
    }
  }

  // Utility methods
  setCommission(commission: number): void {
    this.commission = commission;
  }

  setSlippage(slippage: number): void {
    this.slippage = slippage;
  }
}

// Export singleton instance
export const backtestingEngine = new BacktestingEngine();