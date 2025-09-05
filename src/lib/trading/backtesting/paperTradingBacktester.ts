/**
 * Paper Trading Backtester
 * Runs live alongside market analysis to test strategies without real money
 * Provides performance metrics for strategy optimization
 */

import { exnessAPI } from '../exnessApi';
import { MeanReversionAlpha, MeanReversionSignal } from '../strategies/meanReversionAlpha';
import { DynamicAllocationEngine, AlphaPerformance } from '../strategies/dynamicAllocation';
import { supabase } from '@/integrations/supabase/client';

export interface PaperTrade {
  id: string;
  alphaId: string;
  symbol: string;
  direction: 'BUY' | 'SELL';
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  volume: number;
  entryTime: Date;
  exitTime?: Date;
  exitPrice?: number;
  pnl?: number;
  pnlPips?: number;
  duration?: number;
  status: 'OPEN' | 'CLOSED' | 'STOPPED_OUT' | 'TAKE_PROFIT';
  reasoning: string[];
  regime: string;
  session: string;
  volatility: {
    atr: number;
    bollingerWidth: number;
    rsi: number;
  };
}

export interface BacktestConfig {
  enabled: boolean;
  updateInterval: number; // seconds
  maxConcurrentTrades: number;
  enabledPairs: string[];
  alphas: {
    meanReversion: boolean;
    // Add more alphas here
  };
  riskManagement: {
    maxRiskPerTrade: number; // percentage
    maxDailyLoss: number; // percentage
    maxDrawdown: number; // percentage
  };
  journaling: {
    enabled: boolean;
    saveToSupabase: boolean;
  };
}

export interface BacktestResults {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  avgWin: number;
  avgLoss: number;
  profitFactor: number;
  maxDrawdown: number;
  sharpeRatio: number;
  totalPnl: number;
  totalPnlPips: number;
  bestAlpha: string;
  worstAlpha: string;
  alphaPerformance: Map<string, AlphaPerformance>;
}

export class PaperTradingBacktester {
  private config: BacktestConfig;
  private activeTrades: Map<string, PaperTrade> = new Map();
  private closedTrades: PaperTrade[] = [];
  private meanReversionAlpha: MeanReversionAlpha;
  private allocationEngine: DynamicAllocationEngine;
  private intervalId?: NodeJS.Timeout;
  private dailyPnL: number = 0;
  private lastResetDate: string;

  constructor(config?: Partial<BacktestConfig>) {
    this.config = {
      enabled: true,
      updateInterval: 30, // 30 seconds
      maxConcurrentTrades: 10,
      enabledPairs: ['EURUSD', 'GBPUSD', 'USDJPY', 'XAUUSD'],
      alphas: {
        meanReversion: true
      },
      riskManagement: {
        maxRiskPerTrade: 0.5, // 0.5%
        maxDailyLoss: 2.0, // 2%
        maxDrawdown: 5.0 // 5%
      },
      journaling: {
        enabled: true,
        saveToSupabase: true
      },
      ...config
    };

    this.meanReversionAlpha = new MeanReversionAlpha();
    this.allocationEngine = new DynamicAllocationEngine();
    this.lastResetDate = new Date().toDateString();
  }

  /**
   * Start the backtester
   */
  public async start(): Promise<void> {
    if (!this.config.enabled) return;

    console.log('🚀 Starting Paper Trading Backtester...');
    
    // Clear daily PnL if it's a new day
    this.resetDailyPnLIfNeeded();

    // Start the main loop
    this.intervalId = setInterval(async () => {
      await this.runBacktestCycle();
    }, this.config.updateInterval * 1000);

    console.log(`✅ Paper Trading Backtester started (${this.config.updateInterval}s intervals)`);
  }

  /**
   * Stop the backtester
   */
  public stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
      console.log('🛑 Paper Trading Backtester stopped');
    }
  }

  /**
   * Main backtest cycle
   */
  private async runBacktestCycle(): Promise<void> {
    try {
      // Reset daily PnL if needed
      this.resetDailyPnLIfNeeded();

      // Check risk limits
      if (!this.checkRiskLimits()) {
        console.log('⚠️ Risk limits exceeded, skipping cycle');
        return;
      }

      // Update existing trades
      await this.updateActiveTrades();

      // Generate new signals
      await this.generateNewSignals();

      // Update allocation engine
      this.updateAllocationEngine();

      // Save to database if enabled
      if (this.config.journaling.saveToSupabase) {
        await this.saveToSupabase();
      }

    } catch (error) {
      console.error('❌ Backtest cycle error:', error);
    }
  }

  /**
   * Reset daily PnL if it's a new day
   */
  private resetDailyPnLIfNeeded(): void {
    const currentDate = new Date().toDateString();
    if (currentDate !== this.lastResetDate) {
      this.dailyPnL = 0;
      this.lastResetDate = currentDate;
      console.log('📅 Daily PnL reset for new day');
    }
  }

  /**
   * Check risk management limits
   */
  private checkRiskLimits(): boolean {
    // Check daily loss limit
    if (this.dailyPnL < -this.config.riskManagement.maxDailyLoss) {
      console.log(`❌ Daily loss limit exceeded: ${this.dailyPnL.toFixed(2)}%`);
      return false;
    }

    // Check max concurrent trades
    if (this.activeTrades.size >= this.config.maxConcurrentTrades) {
      return false;
    }

    // Check max drawdown (simplified)
    const totalPnL = this.closedTrades.reduce((sum, trade) => sum + (trade.pnl || 0), 0);
    if (totalPnL < -this.config.riskManagement.maxDrawdown) {
      console.log(`❌ Max drawdown exceeded: ${totalPnL.toFixed(2)}%`);
      return false;
    }

    return true;
  }

  /**
   * Update active trades (check for exits)
   */
  private async updateActiveTrades(): Promise<void> {
    for (const [tradeId, trade] of this.activeTrades) {
      try {
        const currentPrice = await exnessAPI.getCurrentPrice(trade.symbol);
        if (!currentPrice) continue;

        const { bid, ask } = currentPrice;
        const midPrice = (bid + ask) / 2;

        let shouldExit = false;
        let exitReason = '';
        let exitPrice = 0;

        // Check stop loss
        if (trade.direction === 'BUY' && midPrice <= trade.stopLoss) {
          shouldExit = true;
          exitReason = 'STOP_LOSS';
          exitPrice = trade.stopLoss;
        } else if (trade.direction === 'SELL' && midPrice >= trade.stopLoss) {
          shouldExit = true;
          exitReason = 'STOP_LOSS';
          exitPrice = trade.stopLoss;
        }

        // Check take profit
        if (!shouldExit) {
          if (trade.direction === 'BUY' && midPrice >= trade.takeProfit) {
            shouldExit = true;
            exitReason = 'TAKE_PROFIT';
            exitPrice = trade.takeProfit;
          } else if (trade.direction === 'SELL' && midPrice <= trade.takeProfit) {
            shouldExit = true;
            exitReason = 'TAKE_PROFIT';
            exitPrice = trade.takeProfit;
          }
        }

        // Check time-based exit (max hold time)
        if (!shouldExit) {
          const holdTime = Date.now() - trade.entryTime.getTime();
          const maxHoldTimeMs = 4 * 60 * 60 * 1000; // 4 hours
          if (holdTime > maxHoldTimeMs) {
            shouldExit = true;
            exitReason = 'TIME_EXIT';
            exitPrice = midPrice;
          }
        }

        if (shouldExit) {
          await this.closeTrade(tradeId, exitPrice, exitReason);
        }

      } catch (error) {
        console.error(`Error updating trade ${tradeId}:`, error);
      }
    }
  }

  /**
   * Generate new trading signals
   */
  private async generateNewSignals(): Promise<void> {
    for (const symbol of this.config.enabledPairs) {
      try {
        // Skip if we already have a position in this symbol
        const hasPosition = Array.from(this.activeTrades.values()).some(t => t.symbol === symbol);
        if (hasPosition) continue;

        // Generate mean reversion signal
        if (this.config.alphas.meanReversion) {
          const signal = await this.meanReversionAlpha.generateSignal(symbol);
          if (signal) {
            await this.openTrade(signal);
          }
        }

        // Add more alpha signals here

      } catch (error) {
        console.error(`Error generating signals for ${symbol}:`, error);
      }
    }
  }

  /**
   * Open a new paper trade
   */
  private async openTrade(signal: MeanReversionSignal): Promise<void> {
    const tradeId = `paper_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const trade: PaperTrade = {
      id: tradeId,
      alphaId: 'mean_reversion',
      symbol: signal.symbol,
      direction: signal.direction,
      entryPrice: signal.entryPrice,
      stopLoss: signal.stopLoss,
      takeProfit: signal.takeProfit,
      volume: 0.01, // Standard lot size for paper trading
      entryTime: new Date(),
      status: 'OPEN',
      reasoning: signal.reasoning,
      regime: signal.regime,
      session: signal.session,
      volatility: signal.volatility
    };

    this.activeTrades.set(tradeId, trade);
    console.log(`📈 Paper trade opened: ${signal.symbol} ${signal.direction} at ${signal.entryPrice}`);
  }

  /**
   * Close a paper trade
   */
  private async closeTrade(tradeId: string, exitPrice: number, reason: string): Promise<void> {
    const trade = this.activeTrades.get(tradeId);
    if (!trade) return;

    trade.exitTime = new Date();
    trade.exitPrice = exitPrice;
    trade.status = reason === 'STOP_LOSS' ? 'STOPPED_OUT' : 
                   reason === 'TAKE_PROFIT' ? 'TAKE_PROFIT' : 'CLOSED';

    // Calculate PnL
    const priceDiff = trade.direction === 'BUY' ? 
      exitPrice - trade.entryPrice : 
      trade.entryPrice - exitPrice;
    
    trade.pnl = priceDiff * trade.volume * 100000; // Convert to account currency
    trade.pnlPips = priceDiff * 10000; // Convert to pips
    trade.duration = trade.exitTime.getTime() - trade.entryTime.getTime();

    // Update daily PnL
    this.dailyPnL += (trade.pnl || 0);

    // Move to closed trades
    this.activeTrades.delete(tradeId);
    this.closedTrades.push(trade);

    console.log(`📉 Paper trade closed: ${trade.symbol} ${trade.direction} - PnL: ${trade.pnl?.toFixed(2)} (${trade.pnlPips?.toFixed(1)} pips) - ${reason}`);
  }

  /**
   * Update allocation engine with performance data
   */
  private updateAllocationEngine(): void {
    // Group trades by alpha
    const alphaTrades = new Map<string, PaperTrade[]>();
    
    for (const trade of this.closedTrades) {
      if (!alphaTrades.has(trade.alphaId)) {
        alphaTrades.set(trade.alphaId, []);
      }
      alphaTrades.get(trade.alphaId)!.push(trade);
    }

    // Update performance for each alpha
    for (const [alphaId, trades] of alphaTrades) {
      if (trades.length < 5) continue; // Need minimum trades

      const performance: AlphaPerformance = {
        alphaId,
        name: this.getAlphaName(alphaId),
        winRate: trades.filter(t => (t.pnl || 0) > 0).length / trades.length,
        avgReturn: trades.reduce((sum, t) => sum + (t.pnl || 0), 0) / trades.length,
        maxDrawdown: this.calculateMaxDrawdown(trades),
        sharpeRatio: this.calculateSharpeRatio(trades),
        totalTrades: trades.length,
        recentTrades: trades.slice(-20).map(t => ({
          timestamp: t.entryTime,
          pnl: t.pnl || 0,
          pnlPips: t.pnlPips || 0,
          duration: t.duration || 0
        }))
      };

      this.allocationEngine.updateAlphaPerformance(performance);
    }
  }

  /**
   * Calculate max drawdown from trades
   */
  private calculateMaxDrawdown(trades: PaperTrade[]): number {
    let maxDrawdown = 0;
    let peak = 0;
    let runningPnL = 0;

    for (const trade of trades) {
      runningPnL += (trade.pnl || 0);
      
      if (runningPnL > peak) {
        peak = runningPnL;
      } else {
        const drawdown = (peak - runningPnL) / Math.max(peak, 1);
        maxDrawdown = Math.max(maxDrawdown, drawdown);
      }
    }

    return maxDrawdown;
  }

  /**
   * Calculate Sharpe ratio from trades
   */
  private calculateSharpeRatio(trades: PaperTrade[]): number {
    if (trades.length < 2) return 0;

    const returns = trades.map(t => t.pnl || 0);
    const avgReturn = returns.reduce((sum, ret) => sum + ret, 0) / returns.length;
    const variance = returns.reduce((sum, ret) => sum + Math.pow(ret - avgReturn, 2), 0) / returns.length;
    const stdDev = Math.sqrt(variance);

    if (stdDev === 0) return 0;
    return avgReturn / stdDev;
  }

  /**
   * Get alpha name
   */
  private getAlphaName(alphaId: string): string {
    switch (alphaId) {
      case 'mean_reversion': return 'Mean Reversion';
      default: return alphaId;
    }
  }

  /**
   * Save backtest data to Supabase
   */
  private async saveToSupabase(): Promise<void> {
    try {
      // Save closed trades to trade_journal
      const recentTrades = this.closedTrades.slice(-10); // Last 10 trades
      
      for (const trade of recentTrades) {
        if (trade.exitTime && trade.pnl !== undefined) {
          await supabase.from('trade_journal').insert({
            symbol: trade.symbol,
            side: trade.direction,
            volume: trade.volume,
            entry_price: trade.entryPrice,
            exit_price: trade.exitPrice,
            pnl: trade.pnl,
            pnl_pips: trade.pnlPips,
            opened_at: trade.entryTime.toISOString(),
            closed_at: trade.exitTime.toISOString(),
            regime_tag: trade.regime,
            session_tag: trade.session,
            decision_features: {
              reasoning: trade.reasoning,
              volatility: trade.volatility,
              alpha_id: trade.alphaId
            }
          });
        }
      }

      // Save allocation results
      const allocations = this.allocationEngine.calculateAllocations();
      for (const allocation of allocations) {
        await supabase.from('risk_limits').insert({
          max_risk_per_trade: allocation.allocation,
          max_daily_loss: this.config.riskManagement.maxDailyLoss,
          max_drawdown: this.config.riskManagement.maxDrawdown
        });
      }

    } catch (error) {
      console.error('Error saving to Supabase:', error);
    }
  }

  /**
   * Get backtest results
   */
  public getResults(): BacktestResults {
    const totalTrades = this.closedTrades.length;
    const winningTrades = this.closedTrades.filter(t => (t.pnl || 0) > 0).length;
    const losingTrades = totalTrades - winningTrades;
    const winRate = totalTrades > 0 ? winningTrades / totalTrades : 0;

    const wins = this.closedTrades.filter(t => (t.pnl || 0) > 0);
    const losses = this.closedTrades.filter(t => (t.pnl || 0) <= 0);

    const avgWin = wins.length > 0 ? wins.reduce((sum, t) => sum + (t.pnl || 0), 0) / wins.length : 0;
    const avgLoss = losses.length > 0 ? losses.reduce((sum, t) => sum + (t.pnl || 0), 0) / losses.length : 0;
    const profitFactor = avgLoss !== 0 ? Math.abs(avgWin / avgLoss) : 0;

    const totalPnl = this.closedTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
    const totalPnlPips = this.closedTrades.reduce((sum, t) => sum + (t.pnlPips || 0), 0);
    const maxDrawdown = this.calculateMaxDrawdown(this.closedTrades);
    const sharpeRatio = this.calculateSharpeRatio(this.closedTrades);

    // Find best and worst alphas
    const alphaPerformance = this.allocationEngine.getAllPerformanceData();
    let bestAlpha = '';
    let worstAlpha = '';
    let bestPnL = -Infinity;
    let worstPnL = Infinity;

    for (const [alphaId, performance] of alphaPerformance) {
      const alphaTrades = this.closedTrades.filter(t => t.alphaId === alphaId);
      const alphaPnL = alphaTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
      
      if (alphaPnL > bestPnL) {
        bestPnL = alphaPnL;
        bestAlpha = alphaId;
      }
      if (alphaPnL < worstPnL) {
        worstPnL = alphaPnL;
        worstAlpha = alphaId;
      }
    }

    return {
      totalTrades,
      winningTrades,
      losingTrades,
      winRate,
      avgWin,
      avgLoss,
      profitFactor,
      maxDrawdown,
      sharpeRatio,
      totalPnl,
      totalPnlPips,
      bestAlpha,
      worstAlpha,
      alphaPerformance
    };
  }

  /**
   * Get current status
   */
  public getStatus(): {
    isRunning: boolean;
    activeTrades: number;
    totalTrades: number;
    dailyPnL: number;
    allocationSummary: any;
  } {
    return {
      isRunning: !!this.intervalId,
      activeTrades: this.activeTrades.size,
      totalTrades: this.closedTrades.length,
      dailyPnL: this.dailyPnL,
      allocationSummary: this.allocationEngine.getAllocationSummary()
    };
  }

  /**
   * Update configuration
   */
  public updateConfig(newConfig: Partial<BacktestConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Get current configuration
   */
  public getConfig(): BacktestConfig {
    return { ...this.config };
  }

  /**
   * Clear all data
   */
  public clearData(): void {
    this.activeTrades.clear();
    this.closedTrades = [];
    this.dailyPnL = 0;
    this.allocationEngine.clearPerformanceData();
  }
}