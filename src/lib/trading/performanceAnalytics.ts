import { exnessAPI } from './exnessApi';
import { supabase } from '@/integrations/supabase/client';

// Interfaces for performance analytics
export interface SharpeRatioData {
  ratio: number;
  annualizedRatio: number;
  riskFreeRate: number;
  volatility: number;
  expectedReturn: number;
}

export interface VaRData {
  valueAtRisk: number;
  confidenceLevel: number;
  timeHorizon: number;
  method: 'historical' | 'parametric' | 'montecarlo';
  portfolioValue: number;
}

export interface DrawdownData {
  currentDrawdown: number;
  maxDrawdown: number;
  peakValue: number;
  troughValue: number;
  recoveryTime: number;
  drawdownDuration: number;
}

export interface CorrelationMatrix {
  symbols: string[];
  matrix: number[][];
  timestamp: number;
}

export interface PortfolioRiskMetrics {
  totalValue: number;
  totalRisk: number;
  diversificationRatio: number;
  riskContribution: Record<string, number>;
  beta: number;
  alpha: number;
}

export interface RealTimeRiskMetrics {
  sharpeRatio: number;
  currentVaR: number;
  currentDrawdown: number;
  portfolioVolatility: number;
  correlationHeatmap: CorrelationMatrix;
  riskScore: number;
  timestamp: number;
}

export interface PerformanceSnapshot {
  timestamp: number;
  portfolioValue: number;
  dailyReturn: number;
  cumulativeReturn: number;
  volatility: number;
  sharpeRatio: number;
  maxDrawdown: number;
}

// Main Performance Analytics Class
export class PerformanceAnalytics {
  private performanceHistory: PerformanceSnapshot[] = [];
  private correlationCache = new Map<string, CorrelationMatrix>();
  private riskFreeRate = 0.02; // 2% annual risk-free rate
  private maxHistorySize = 1000; // Keep last 1000 snapshots

  // Ultra-fast performance tracking
  private streamingData: Map<string, number[]> = new Map(); // Symbol -> price history
  private portfolioValues: number[] = [];
  private lastUpdateTime = 0;
  private updateInterval = 100; // Update every 100ms for ultra-fast tracking

  constructor() {
    this.initializeStreaming();
  }

  /**
   * Initialize ultra-fast streaming data collection
   */
  private initializeStreaming(): void {
    const symbols = ['EURUSD', 'GBPUSD', 'USDJPY', 'XAUUSD', 'AUDUSD'];
    symbols.forEach(symbol => {
      this.streamingData.set(symbol, []);
    });

    // Start ultra-fast data collection
    setInterval(() => this.updateStreamingData(), this.updateInterval);
  }

  /**
   * Ultra-fast streaming data update
   */
  private async updateStreamingData(): Promise<void> {
    const now = Date.now();
    if (now - this.lastUpdateTime < this.updateInterval) return;

    this.lastUpdateTime = now;

    try {
      // Update price data for all symbols
      const updatePromises = Array.from(this.streamingData.keys()).map(async (symbol) => {
        try {
          const price = await exnessAPI.getCurrentPrice(symbol);
          if (price) {
            const currentPrice = (price.bid + price.ask) / 2;
            const history = this.streamingData.get(symbol)!;
            history.push(currentPrice);

            // Keep only last 1000 data points for performance
            if (history.length > 1000) {
              history.shift();
            }
            this.streamingData.set(symbol, history);
          }
        } catch (error) {
          // Silent fail for individual symbols
        }
      });

      await Promise.allSettled(updatePromises);

      // Update portfolio value
      await this.updatePortfolioValue();

      // Calculate and cache real-time metrics
      await this.updateRealTimeMetrics();

    } catch (error) {
      // Silent fail to maintain performance
    }
  }

  /**
   * Update portfolio value for tracking
   */
  private async updatePortfolioValue(): Promise<void> {
    try {
      const accountInfo = await exnessAPI.getAccountInfo();
      if (accountInfo) {
        this.portfolioValues.push(accountInfo.equity);
        if (this.portfolioValues.length > this.maxHistorySize) {
          this.portfolioValues.shift();
        }
      }
    } catch (error) {
      // Silent fail
    }
  }

  /**
   * Calculate Sharpe Ratio
   */
  async calculateSharpeRatio(
    returns: number[],
    riskFreeRate?: number,
    annualizationFactor = 252
  ): Promise<SharpeRatioData> {
    if (returns.length < 2) {
      return {
        ratio: 0,
        annualizedRatio: 0,
        riskFreeRate: riskFreeRate || this.riskFreeRate,
        volatility: 0,
        expectedReturn: 0
      };
    }

    const rf = riskFreeRate || this.riskFreeRate;
    const dailyRf = rf / annualizationFactor;

    // Calculate excess returns
    const excessReturns = returns.map(r => r - dailyRf);

    // Expected return (mean of excess returns)
    const expectedReturn = excessReturns.reduce((sum, r) => sum + r, 0) / excessReturns.length;

    // Volatility (standard deviation of excess returns)
    const variance = excessReturns.reduce((sum, r) => sum + Math.pow(r - expectedReturn, 2), 0) / (excessReturns.length - 1);
    const volatility = Math.sqrt(variance);

    // Sharpe ratio
    const ratio = volatility > 0 ? expectedReturn / volatility : 0;
    const annualizedRatio = ratio * Math.sqrt(annualizationFactor);

    return {
      ratio,
      annualizedRatio,
      riskFreeRate: rf,
      volatility,
      expectedReturn
    };
  }

  /**
   * Calculate Value at Risk (VaR) using multiple methods
   */
  async calculateVaR(
    returns: number[],
    confidenceLevel = 0.95,
    method: 'historical' | 'parametric' | 'montecarlo' = 'historical',
    portfolioValue?: number
  ): Promise<VaRData> {
    if (returns.length < 30) {
      return {
        valueAtRisk: 0,
        confidenceLevel,
        timeHorizon: 1,
        method,
        portfolioValue: portfolioValue || 0
      };
    }

    const value = portfolioValue || this.portfolioValues[this.portfolioValues.length - 1] || 10000;
    let var95: number;

    switch (method) {
      case 'historical':
        var95 = this.calculateHistoricalVaR(returns, confidenceLevel);
        break;
      case 'parametric':
        var95 = this.calculateParametricVaR(returns, confidenceLevel);
        break;
      case 'montecarlo':
        var95 = this.calculateMonteCarloVaR(returns, confidenceLevel);
        break;
      default:
        var95 = this.calculateHistoricalVaR(returns, confidenceLevel);
    }

    return {
      valueAtRisk: Math.abs(var95 * value),
      confidenceLevel,
      timeHorizon: 1,
      method,
      portfolioValue: value
    };
  }

  private calculateHistoricalVaR(returns: number[], confidence: number): number {
    const sortedReturns = [...returns].sort((a, b) => a - b);
    const index = Math.floor((1 - confidence) * sortedReturns.length);
    return sortedReturns[index];
  }

  private calculateParametricVaR(returns: number[], confidence: number): number {
    const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
    const stdDev = Math.sqrt(variance);

    // Z-score for confidence level
    const zScore = confidence === 0.95 ? -1.645 : confidence === 0.99 ? -2.326 : -1.96;
    return mean + zScore * stdDev;
  }

  private calculateMonteCarloVaR(returns: number[], confidence: number): number {
    // Simplified Monte Carlo - generate 1000 scenarios
    const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const stdDev = Math.sqrt(returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length);

    const scenarios: number[] = [];
    for (let i = 0; i < 1000; i++) {
      // Generate random return using normal distribution approximation
      const randomReturn = mean + stdDev * (Math.random() * 6 - 3); // Rough normal approximation
      scenarios.push(randomReturn);
    }

    scenarios.sort((a, b) => a - b);
    const index = Math.floor((1 - confidence) * scenarios.length);
    return scenarios[index];
  }

  /**
   * Calculate drawdown metrics
   */
  async calculateDrawdown(portfolioValues: number[]): Promise<DrawdownData> {
    if (portfolioValues.length < 2) {
      return {
        currentDrawdown: 0,
        maxDrawdown: 0,
        peakValue: portfolioValues[0] || 0,
        troughValue: portfolioValues[0] || 0,
        recoveryTime: 0,
        drawdownDuration: 0
      };
    }

    let peak = portfolioValues[0];
    let maxDrawdown = 0;
    let currentPeak = portfolioValues[0];
    let trough = portfolioValues[0];
    let drawdownStart = 0;
    let maxDrawdownDuration = 0;
    let recoveryTime = 0;

    for (let i = 1; i < portfolioValues.length; i++) {
      const value = portfolioValues[i];

      if (value > peak) {
        peak = value;
        currentPeak = value;
        trough = value;
        drawdownStart = i;
      }

      if (value < currentPeak) {
        trough = value;
        const currentDrawdown = (currentPeak - value) / currentPeak;

        if (currentDrawdown > maxDrawdown) {
          maxDrawdown = currentDrawdown;
          maxDrawdownDuration = i - drawdownStart;
        }
      } else if (value >= currentPeak) {
        // Recovery period
        recoveryTime = Math.max(recoveryTime, i - drawdownStart);
        currentPeak = value;
      }
    }

    const currentValue = portfolioValues[portfolioValues.length - 1];
    const currentDrawdown = peak > 0 ? (peak - currentValue) / peak : 0;

    return {
      currentDrawdown,
      maxDrawdown,
      peakValue: peak,
      troughValue: trough,
      recoveryTime,
      drawdownDuration: maxDrawdownDuration
    };
  }

  /**
   * Calculate correlation matrix across multiple pairs
   */
  async calculateCorrelationMatrix(symbols: string[]): Promise<CorrelationMatrix> {
    const cacheKey = symbols.sort().join('_');
    const cached = this.correlationCache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < 300000) { // 5 minute cache
      return cached;
    }

    const priceData: Record<string, number[]> = {};

    // Get price data for each symbol
    for (const symbol of symbols) {
      const history = this.streamingData.get(symbol);
      if (history && history.length >= 30) {
        priceData[symbol] = history.slice(-100); // Use last 100 data points
      } else {
        // Fallback to API if no streaming data
        try {
          const price = await exnessAPI.getCurrentPrice(symbol);
          if (price) {
            priceData[symbol] = [(price.bid + price.ask) / 2];
          }
        } catch (error) {
          priceData[symbol] = [1.0]; // Default
        }
      }
    }

    // Calculate returns for each symbol
    const returnsData: Record<string, number[]> = {};
    for (const symbol of symbols) {
      const prices = priceData[symbol];
      if (prices.length >= 2) {
        const returns: number[] = [];
        for (let i = 1; i < prices.length; i++) {
          returns.push((prices[i] - prices[i-1]) / prices[i-1]);
        }
        returnsData[symbol] = returns;
      } else {
        returnsData[symbol] = [0];
      }
    }

    // Calculate correlation matrix
    const matrix: number[][] = [];
    for (let i = 0; i < symbols.length; i++) {
      matrix[i] = [];
      for (let j = 0; j < symbols.length; j++) {
        if (i === j) {
          matrix[i][j] = 1.0;
        } else {
          const correlation = this.calculateCorrelation(
            returnsData[symbols[i]],
            returnsData[symbols[j]]
          );
          matrix[i][j] = correlation;
        }
      }
    }

    const result: CorrelationMatrix = {
      symbols: [...symbols],
      matrix,
      timestamp: Date.now()
    };

    this.correlationCache.set(cacheKey, result);
    return result;
  }

  private calculateCorrelation(returns1: number[], returns2: number[]): number {
    if (returns1.length !== returns2.length || returns1.length < 2) {
      return 0;
    }

    const n = returns1.length;
    const mean1 = returns1.reduce((sum, r) => sum + r, 0) / n;
    const mean2 = returns2.reduce((sum, r) => sum + r, 0) / n;

    let numerator = 0;
    let sumSq1 = 0;
    let sumSq2 = 0;

    for (let i = 0; i < n; i++) {
      const diff1 = returns1[i] - mean1;
      const diff2 = returns2[i] - mean2;
      numerator += diff1 * diff2;
      sumSq1 += diff1 * diff1;
      sumSq2 += diff2 * diff2;
    }

    const denominator = Math.sqrt(sumSq1 * sumSq2);
    return denominator > 0 ? numerator / denominator : 0;
  }

  /**
   * Calculate portfolio-level risk management metrics
   */
  async calculatePortfolioRiskMetrics(): Promise<PortfolioRiskMetrics> {
    try {
      const accountInfo = await exnessAPI.getAccountInfo();
      const positions = await exnessAPI.getPositions();

      if (!accountInfo || !positions) {
        return {
          totalValue: 0,
          totalRisk: 0,
          diversificationRatio: 0,
          riskContribution: {},
          beta: 0,
          alpha: 0
        };
      }

      const totalValue = accountInfo.equity;
      const symbols = [...new Set(positions.map(p => p.symbol))];

      // Calculate correlation matrix
      const correlationMatrix = await this.calculateCorrelationMatrix(symbols);

      // Calculate position weights and volatilities
      const weights: Record<string, number> = {};
      const volatilities: Record<string, number> = {};
      let totalExposure = 0;

      for (const position of positions) {
        const exposure = Math.abs(position.volume) * position.openPrice;
        weights[position.symbol] = (weights[position.symbol] || 0) + exposure;
        totalExposure += exposure;
      }

      // Normalize weights
      Object.keys(weights).forEach(symbol => {
        weights[symbol] = weights[symbol] / totalExposure;
      });

      // Calculate volatilities from streaming data
      for (const symbol of symbols) {
        const history = this.streamingData.get(symbol);
        if (history && history.length >= 30) {
          const returns = this.calculateReturns(history);
          const variance = returns.reduce((sum, r) => sum + Math.pow(r, 2), 0) / returns.length;
          volatilities[symbol] = Math.sqrt(variance);
        } else {
          volatilities[symbol] = 0.02; // Default 2% daily volatility
        }
      }

      // Calculate portfolio volatility
      let portfolioVariance = 0;
      for (let i = 0; i < symbols.length; i++) {
        for (let j = 0; j < symbols.length; j++) {
          const symbol1 = symbols[i];
          const symbol2 = symbols[j];
          const correlation = correlationMatrix.matrix[i][j];
          portfolioVariance += weights[symbol1] * weights[symbol2] * volatilities[symbol1] * volatilities[symbol2] * correlation;
        }
      }

      const portfolioVolatility = Math.sqrt(portfolioVariance);

      // Calculate diversification ratio
      const weightedVolatility = Object.entries(weights).reduce((sum, [symbol, weight]) => {
        return sum + weight * volatilities[symbol];
      }, 0);
      const diversificationRatio = weightedVolatility > 0 ? portfolioVolatility / weightedVolatility : 0;

      // Calculate risk contribution
      const riskContribution: Record<string, number> = {};
      for (const symbol of symbols) {
        const marginalRisk = this.calculateMarginalRisk(symbol, weights, volatilities, correlationMatrix);
        riskContribution[symbol] = weights[symbol] * marginalRisk;
      }

      // Simplified beta and alpha (would need market data for accurate calculation)
      const beta = 1.0; // Assume market beta of 1
      const alpha = 0.0; // Simplified

      return {
        totalValue,
        totalRisk: portfolioVolatility * totalValue,
        diversificationRatio,
        riskContribution,
        beta,
        alpha
      };

    } catch (error) {
      console.error('Failed to calculate portfolio risk metrics:', error);
      return {
        totalValue: 0,
        totalRisk: 0,
        diversificationRatio: 0,
        riskContribution: {},
        beta: 0,
        alpha: 0
      };
    }
  }

  private calculateMarginalRisk(
    symbol: string,
    weights: Record<string, number>,
    volatilities: Record<string, number>,
    correlationMatrix: CorrelationMatrix
  ): number {
    // Simplified marginal risk calculation
    const symbolIndex = correlationMatrix.symbols.indexOf(symbol);
    if (symbolIndex === -1) return 0;

    let marginalRisk = 0;
    for (let j = 0; j < correlationMatrix.symbols.length; j++) {
      const otherSymbol = correlationMatrix.symbols[j];
      const correlation = correlationMatrix.matrix[symbolIndex][j];
      marginalRisk += weights[otherSymbol] * volatilities[symbol] * volatilities[otherSymbol] * correlation;
    }

    return marginalRisk;
  }

  private calculateReturns(prices: number[]): number[] {
    const returns: number[] = [];
    for (let i = 1; i < prices.length; i++) {
      returns.push((prices[i] - prices[i-1]) / prices[i-1]);
    }
    return returns;
  }

  /**
   * Get real-time risk metrics
   */
  async getRealTimeRiskMetrics(): Promise<RealTimeRiskMetrics> {
    const portfolioValues = this.portfolioValues.slice(-100); // Last 100 data points
    if (portfolioValues.length < 30) {
      return this.getDefaultRiskMetrics();
    }

    const returns = this.calculateReturns(portfolioValues);

    // Calculate metrics in parallel for performance
    const [sharpeData, varData, drawdownData, correlationMatrix, portfolioRisk] = await Promise.all([
      this.calculateSharpeRatio(returns),
      this.calculateVaR(returns),
      this.calculateDrawdown(portfolioValues),
      this.calculateCorrelationMatrix(['EURUSD', 'GBPUSD', 'USDJPY', 'XAUUSD']),
      this.calculatePortfolioRiskMetrics()
    ]);

    // Calculate risk score (0-100, higher is better)
    const riskScore = this.calculateRiskScore(sharpeData, varData, drawdownData, portfolioRisk);

    return {
      sharpeRatio: sharpeData.annualizedRatio,
      currentVaR: varData.valueAtRisk,
      currentDrawdown: drawdownData.currentDrawdown,
      portfolioVolatility: portfolioRisk.totalRisk / portfolioRisk.totalValue,
      correlationHeatmap: correlationMatrix,
      riskScore,
      timestamp: Date.now()
    };
  }

  private getDefaultRiskMetrics(): RealTimeRiskMetrics {
    return {
      sharpeRatio: 0,
      currentVaR: 0,
      currentDrawdown: 0,
      portfolioVolatility: 0,
      correlationHeatmap: {
        symbols: [],
        matrix: [],
        timestamp: Date.now()
      },
      riskScore: 50,
      timestamp: Date.now()
    };
  }

  private calculateRiskScore(
    sharpe: SharpeRatioData,
    varData: VaRData,
    drawdown: DrawdownData,
    portfolioRisk: PortfolioRiskMetrics
  ): number {
    // Risk score components (0-100 scale)
    const sharpeScore = Math.min(100, Math.max(0, (sharpe.annualizedRatio + 2) * 20)); // -2 to +3 range
    const varScore = Math.min(100, Math.max(0, 100 - (varData.valueAtRisk / varData.portfolioValue) * 1000));
    const drawdownScore = Math.min(100, Math.max(0, 100 - drawdown.currentDrawdown * 100));
    const diversificationScore = Math.min(100, portfolioRisk.diversificationRatio * 50);

    // Weighted average
    return (sharpeScore * 0.4 + varScore * 0.3 + drawdownScore * 0.2 + diversificationScore * 0.1);
  }

  /**
   * Update real-time metrics cache
   */
  private async updateRealTimeMetrics(): Promise<void> {
    // This is called automatically by the streaming update
    // Cache the latest metrics for fast access
    try {
      const metrics = await this.getRealTimeRiskMetrics();
      this.performanceHistory.push({
        timestamp: metrics.timestamp,
        portfolioValue: this.portfolioValues[this.portfolioValues.length - 1] || 0,
        dailyReturn: 0, // Would need daily calculation
        cumulativeReturn: 0, // Would need baseline
        volatility: metrics.portfolioVolatility,
        sharpeRatio: metrics.sharpeRatio,
        maxDrawdown: metrics.currentDrawdown
      });

      // Maintain history size
      if (this.performanceHistory.length > this.maxHistorySize) {
        this.performanceHistory.shift();
      }
    } catch (error) {
      // Silent fail
    }
  }

  /**
   * Get performance history
   */
  getPerformanceHistory(limit?: number): PerformanceSnapshot[] {
    const history = [...this.performanceHistory];
    return limit ? history.slice(-limit) : history;
  }

  /**
   * Export analytics data for external analysis
   */
  exportAnalyticsData(): {
    performanceHistory: PerformanceSnapshot[];
    correlationMatrix: CorrelationMatrix | null;
    riskMetrics: RealTimeRiskMetrics;
  } {
    const correlationMatrix = this.correlationCache.get('EURUSD_GBPUSD_USDJPY_XAUUSD') || null;

    return {
      performanceHistory: this.performanceHistory,
      correlationMatrix,
      riskMetrics: this.getDefaultRiskMetrics() // Would need to cache the latest
    };
  }
}

// Export singleton instance
export const performanceAnalytics = new PerformanceAnalytics();