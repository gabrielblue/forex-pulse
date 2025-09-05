/**
 * Dynamic Allocation Engine
 * Performance-weighted allocation across multiple alpha strategies
 * Includes risk caps and drawdown protection
 */

export interface AlphaPerformance {
  alphaId: string;
  name: string;
  winRate: number;
  avgReturn: number;
  maxDrawdown: number;
  sharpeRatio: number;
  totalTrades: number;
  recentTrades: Array<{
    timestamp: Date;
    pnl: number;
    pnlPips: number;
    duration: number;
  }>;
}

export interface AllocationConfig {
  enabled: boolean;
  rebalanceInterval: number; // hours
  lookbackPeriod: number; // days
  minTradesForAllocation: number;
  maxAllocationPerAlpha: number; // 0.4 = 40% max per alpha
  riskCaps: {
    maxDrawdown: number; // 0.15 = 15% max drawdown
    maxDailyLoss: number; // 0.05 = 5% max daily loss
    maxConcurrentPositions: number;
  };
  performanceWeights: {
    winRate: number; // 0.3 = 30% weight
    sharpeRatio: number; // 0.4 = 40% weight
    avgReturn: number; // 0.3 = 30% weight
  };
}

export interface AllocationResult {
  alphaId: string;
  name: string;
  allocation: number; // 0.0 to 1.0
  reason: string;
  performance: AlphaPerformance;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
}

export class DynamicAllocationEngine {
  private config: AllocationConfig;
  private alphaPerformances: Map<string, AlphaPerformance> = new Map();
  private lastRebalance: Date = new Date();

  constructor(config?: Partial<AllocationConfig>) {
    this.config = {
      enabled: true,
      rebalanceInterval: 24, // 24 hours
      lookbackPeriod: 30, // 30 days
      minTradesForAllocation: 10,
      maxAllocationPerAlpha: 0.4, // 40% max per alpha
      riskCaps: {
        maxDrawdown: 0.15, // 15% max drawdown
        maxDailyLoss: 0.05, // 5% max daily loss
        maxConcurrentPositions: 5
      },
      performanceWeights: {
        winRate: 0.3,
        sharpeRatio: 0.4,
        avgReturn: 0.3
      },
      ...config
    };
  }

  /**
   * Add or update alpha performance data
   */
  public updateAlphaPerformance(performance: AlphaPerformance): void {
    this.alphaPerformances.set(performance.alphaId, performance);
  }

  /**
   * Calculate Sharpe ratio from returns
   */
  private calculateSharpeRatio(returns: number[]): number {
    if (returns.length < 2) return 0;

    const avgReturn = returns.reduce((sum, ret) => sum + ret, 0) / returns.length;
    const variance = returns.reduce((sum, ret) => sum + Math.pow(ret - avgReturn, 2), 0) / returns.length;
    const stdDev = Math.sqrt(variance);

    if (stdDev === 0) return 0;
    return avgReturn / stdDev;
  }

  /**
   * Calculate maximum drawdown from equity curve
   */
  private calculateMaxDrawdown(equityCurve: number[]): number {
    if (equityCurve.length < 2) return 0;

    let maxDrawdown = 0;
    let peak = equityCurve[0];

    for (let i = 1; i < equityCurve.length; i++) {
      if (equityCurve[i] > peak) {
        peak = equityCurve[i];
      } else {
        const drawdown = (peak - equityCurve[i]) / peak;
        maxDrawdown = Math.max(maxDrawdown, drawdown);
      }
    }

    return maxDrawdown;
  }

  /**
   * Calculate performance metrics from recent trades
   */
  private calculatePerformanceMetrics(trades: Array<{ pnl: number; pnlPips: number; duration: number }>): {
    winRate: number;
    avgReturn: number;
    maxDrawdown: number;
    sharpeRatio: number;
  } {
    if (trades.length === 0) {
      return { winRate: 0, avgReturn: 0, maxDrawdown: 0, sharpeRatio: 0 };
    }

    // Calculate win rate
    const winningTrades = trades.filter(t => t.pnl > 0);
    const winRate = winningTrades.length / trades.length;

    // Calculate average return
    const avgReturn = trades.reduce((sum, t) => sum + t.pnl, 0) / trades.length;

    // Calculate Sharpe ratio (using pnl as returns)
    const returns = trades.map(t => t.pnl);
    const sharpeRatio = this.calculateSharpeRatio(returns);

    // Calculate max drawdown from cumulative returns
    const cumulativeReturns = trades.reduce((acc, t, i) => {
      acc.push(i === 0 ? t.pnl : acc[i - 1] + t.pnl);
      return acc;
    }, [] as number[]);
    const maxDrawdown = this.calculateMaxDrawdown(cumulativeReturns);

    return { winRate, avgReturn, maxDrawdown, sharpeRatio };
  }

  /**
   * Check if alpha should be excluded due to risk limits
   */
  private checkRiskLimits(performance: AlphaPerformance): { excluded: boolean; reason: string } {
    // Check drawdown limit
    if (performance.maxDrawdown > this.config.riskCaps.maxDrawdown) {
      return { excluded: true, reason: `Drawdown too high: ${(performance.maxDrawdown * 100).toFixed(1)}%` };
    }

    // Check minimum trades requirement
    if (performance.totalTrades < this.config.minTradesForAllocation) {
      return { excluded: true, reason: `Insufficient trades: ${performance.totalTrades}` };
    }

    // Check recent performance (last 5 trades)
    const recentTrades = performance.recentTrades.slice(-5);
    if (recentTrades.length >= 3) {
      const recentLosses = recentTrades.filter(t => t.pnl < 0);
      if (recentLosses.length >= 3) {
        return { excluded: true, reason: 'Too many recent losses' };
      }
    }

    return { excluded: false, reason: 'Passed risk checks' };
  }

  /**
   * Calculate performance score for an alpha
   */
  private calculatePerformanceScore(performance: AlphaPerformance): number {
    const { winRate, sharpeRatio, avgReturn } = this.config.performanceWeights;
    
    // Normalize metrics to 0-1 scale
    const normalizedWinRate = Math.max(0, Math.min(1, performance.winRate));
    const normalizedSharpe = Math.max(0, Math.min(1, (performance.sharpeRatio + 2) / 4)); // Assume -2 to +2 range
    const normalizedReturn = Math.max(0, Math.min(1, (performance.avgReturn + 0.1) / 0.2)); // Assume -10% to +10% range

    // Calculate weighted score
    const score = 
      normalizedWinRate * winRate +
      normalizedSharpe * sharpeRatio +
      normalizedReturn * avgReturn;

    return Math.max(0, score); // Ensure non-negative
  }

  /**
   * Determine risk level based on performance
   */
  private determineRiskLevel(performance: AlphaPerformance): 'LOW' | 'MEDIUM' | 'HIGH' {
    if (performance.winRate >= 0.6 && performance.sharpeRatio >= 1.0 && performance.maxDrawdown <= 0.05) {
      return 'LOW';
    } else if (performance.winRate >= 0.5 && performance.sharpeRatio >= 0.5 && performance.maxDrawdown <= 0.1) {
      return 'MEDIUM';
    } else {
      return 'HIGH';
    }
  }

  /**
   * Calculate optimal allocations
   */
  public calculateAllocations(): AllocationResult[] {
    if (!this.config.enabled) {
      return [];
    }

    const results: AllocationResult[] = [];
    const validAlphas: Array<{ alphaId: string; performance: AlphaPerformance; score: number }> = [];

    // Filter and score alphas
    for (const [alphaId, performance] of this.alphaPerformances) {
      const riskCheck = this.checkRiskLimits(performance);
      if (riskCheck.excluded) {
        results.push({
          alphaId,
          name: performance.name,
          allocation: 0,
          reason: riskCheck.reason,
          performance,
          riskLevel: 'HIGH'
        });
        continue;
      }

      const score = this.calculatePerformanceScore(performance);
      validAlphas.push({ alphaId, performance, score });
    }

    // Sort by performance score
    validAlphas.sort((a, b) => b.score - a.score);

    // Calculate allocations
    let totalScore = validAlphas.reduce((sum, alpha) => sum + alpha.score, 0);
    
    for (const { alphaId, performance, score } of validAlphas) {
      let allocation = totalScore > 0 ? score / totalScore : 0;
      
      // Apply maximum allocation cap
      allocation = Math.min(allocation, this.config.maxAllocationPerAlpha);
      
      const riskLevel = this.determineRiskLevel(performance);
      
      results.push({
        alphaId,
        name: performance.name,
        allocation,
        reason: `Performance score: ${score.toFixed(3)}, Risk level: ${riskLevel}`,
        performance,
        riskLevel
      });
    }

    // Normalize allocations to sum to 1
    const totalAllocation = results.reduce((sum, r) => sum + r.allocation, 0);
    if (totalAllocation > 0) {
      for (const result of results) {
        result.allocation = result.allocation / totalAllocation;
      }
    }

    return results;
  }

  /**
   * Check if rebalancing is needed
   */
  public shouldRebalance(): boolean {
    const now = new Date();
    const hoursSinceRebalance = (now.getTime() - this.lastRebalance.getTime()) / (1000 * 60 * 60);
    return hoursSinceRebalance >= this.config.rebalanceInterval;
  }

  /**
   * Mark rebalancing as completed
   */
  public markRebalanced(): void {
    this.lastRebalance = new Date();
  }

  /**
   * Get current allocation summary
   */
  public getAllocationSummary(): {
    totalAlphas: number;
    activeAlphas: number;
    totalAllocation: number;
    averageRiskLevel: string;
    nextRebalance: Date;
  } {
    const allocations = this.calculateAllocations();
    const activeAlphas = allocations.filter(a => a.allocation > 0);
    const totalAllocation = activeAlphas.reduce((sum, a) => sum + a.allocation, 0);
    
    const riskLevels = activeAlphas.map(a => a.riskLevel);
    const averageRiskLevel = riskLevels.length > 0 
      ? this.calculateAverageRiskLevel(riskLevels)
      : 'UNKNOWN';

    const nextRebalance = new Date(this.lastRebalance.getTime() + this.config.rebalanceInterval * 60 * 60 * 1000);

    return {
      totalAlphas: this.alphaPerformances.size,
      activeAlphas: activeAlphas.length,
      totalAllocation,
      averageRiskLevel,
      nextRebalance
    };
  }

  /**
   * Calculate average risk level
   */
  private calculateAverageRiskLevel(riskLevels: Array<'LOW' | 'MEDIUM' | 'HIGH'>): string {
    const scores = riskLevels.map(level => {
      switch (level) {
        case 'LOW': return 1;
        case 'MEDIUM': return 2;
        case 'HIGH': return 3;
        default: return 2;
      }
    });

    const avgScore = scores.reduce((sum, score) => sum + score, 0) / scores.length;
    
    if (avgScore <= 1.5) return 'LOW';
    if (avgScore <= 2.5) return 'MEDIUM';
    return 'HIGH';
  }

  /**
   * Update configuration
   */
  public updateConfig(newConfig: Partial<AllocationConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Get current configuration
   */
  public getConfig(): AllocationConfig {
    return { ...this.config };
  }

  /**
   * Clear performance data
   */
  public clearPerformanceData(): void {
    this.alphaPerformances.clear();
  }

  /**
   * Get performance data for a specific alpha
   */
  public getAlphaPerformance(alphaId: string): AlphaPerformance | undefined {
    return this.alphaPerformances.get(alphaId);
  }

  /**
   * Get all performance data
   */
  public getAllPerformanceData(): Map<string, AlphaPerformance> {
    return new Map(this.alphaPerformances);
  }
}