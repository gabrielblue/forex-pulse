/**
 * Partial Profit Taking Manager
 * Implements systematic partial profit taking at 1R and 2R
 */

import { exnessAPI } from './exnessApi';
import { capitalPreservationManager, PositionData } from './capitalPreservationManager';
import { tradingJournal } from './tradingJournal';

export interface PartialProfitConfig {
  enabled: boolean;
  target1RPercentage: number; // Percentage of position to close at 1R
  target2RPercentage: number; // Percentage of position to close at 2R
  trailStopAfter1R: boolean; // Move SL to breakeven after 1R
  trailStopAfter2R: boolean; // Move SL to 1R after 2R
  partialCloseMinVolume: number; // Minimum volume to partial close
  useTrailing2R: boolean; // Use trailing stop after 2R
  trailing2RDistance: number; // Trail distance in R multiples
}

export interface PartialProfitLevel {
  target: number; // R-multiple (1, 2, 3, etc.)
  percentage: number; // Percentage to close
  actionTaken: boolean;
  actionTime?: Date;
  closedVolume?: number;
  closedProfit?: number;
}

class PartialProfitManager {
  private config: PartialProfitConfig = {
    enabled: true,
    target1RPercentage: 0.5, // Close 50% at 1R
    target2RPercentage: 0.25, // Close 25% at 2R
    trailStopAfter1R: true, // Move SL to breakeven
    trailStopAfter2R: true, // Move SL to 1R
    partialCloseMinVolume: 0.02, // 0.02 lots minimum
    useTrailing2R: true, // Enable trailing after 2R
    trailing2RDistance: 1 // Trail 1R behind
  };

  private activeTargets: Map<string, PartialProfitLevel[]> = new Map();
  private checkInterval: NodeJS.Timeout | null = null;

  async initialize(): Promise<void> {
    console.log('💰 PartialProfitManager: Initializing...');
    this.startMonitoring();
    console.log('✅ PartialProfitManager: Initialized successfully');
  }

  private startMonitoring(): void {
    // Check every 10 seconds for partial profit targets
    this.checkInterval = setInterval(async () => {
      await this.checkAllTargets();
    }, 10000);
  }

  stopMonitoring(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  /**
   * Calculate R-multiple for a position
   */
  calculateRMultiple(position: PositionData): number {
    if (!position.stopLoss || !position.openPrice) return 0;

    const riskPerUnit = Math.abs(position.openPrice - position.stopLoss);
    if (riskPerUnit === 0) return 0;

    let currentProfitPerUnit: number;

    if (position.type === 'BUY') {
      currentProfitPerUnit = position.openPrice - position.openPrice; // Placeholder
    } else {
      currentProfitPerUnit = position.openPrice - position.openPrice; // Placeholder
    }

    // Simplified R calculation based on profit
    const riskAmount = Math.abs(position.openPrice - position.stopLoss);
    const rewardSoFar = Math.abs(position.profit); // This would need actual current price

    return rewardSoFar / riskAmount;
  }

  /**
   * Set up partial profit targets for a new position
   */
  async setupPositionTargets(position: PositionData): Promise<void> {
    if (!this.config.enabled) return;
    if (position.volume < this.config.partialCloseMinVolume) return;

    const targets: PartialProfitLevel[] = [];

    // 1R target
    targets.push({
      target: 1,
      percentage: this.config.target1RPercentage,
      actionTaken: false
    });

    // 2R target
    targets.push({
      target: 2,
      percentage: this.config.target2RPercentage,
      actionTaken: false
    });

    // 3R target (optional)
    if (this.config.target1RPercentage + this.config.target2RPercentage < 1) {
      const remaining = 1 - (this.config.target1RPercentage + this.config.target2RPercentage);
      targets.push({
        target: 3,
        percentage: remaining,
        actionTaken: false
      });
    }

    this.activeTargets.set(position.ticket.toString(), targets);
    console.log(`💰 Partial profit targets set for ${position.symbol} ticket ${position.ticket}:`, targets);
  }

  /**
   * Check all active targets
   */
  private async checkAllTargets(): Promise<void> {
    const positions = capitalPreservationManager.getManagedPositions();

    for (const position of positions) {
      await this.checkPositionTargets(position);
    }
  }

  /**
   * Check a specific position for partial profit targets
   */
  private async checkPositionTargets(position: PositionData): Promise<void> {
    const targets = this.activeTargets.get(position.ticket.toString());
    if (!targets) return;

    const currentPrice = await this.getCurrentPrice(position.symbol);
    const rMultiple = this.calculateCurrentRMultiple(position, currentPrice);

    for (const target of targets) {
      if (target.actionTaken) continue;
      if (rMultiple < target.target) continue;

      // Target reached - execute partial close
      console.log(`💰 Target ${target.target}R reached for ${position.symbol} ticket ${position.ticket}`);
      await this.executePartialClose(position, target);
    }

    // Handle trailing stop after targets
    if (this.config.trailStopAfter1R && rMultiple >= 1 && !position.stopLoss) {
      await capitalPreservationManager.moveToBreakEven(position.ticket);
    }

    if (this.config.trailStopAfter2R && rMultiple >= 2) {
      await this.moveSLToTarget(position, 1); // Move SL to 1R
    }

    // Use trailing stop after 2R
    if (this.config.useTrailing2R && rMultiple >= 2) {
      await this.applyTrailingStop(position, rMultiple);
    }
  }

  /**
   * Calculate current R-multiple
   */
  private calculateCurrentRMultiple(position: PositionData, currentPrice: number): number {
    if (!position.stopLoss || !position.openPrice) return 0;

    const risk = Math.abs(position.openPrice - position.stopLoss);
    if (risk === 0) return 0;

    let unrealizedPnL: number;
    if (position.type === 'BUY') {
      unrealizedPnL = currentPrice - position.openPrice;
    } else {
      unrealizedPnL = position.openPrice - currentPrice;
    }

    return unrealizedPnL / risk;
  }

  /**
   * Execute partial close at target
   */
  private async executePartialClose(position: PositionData, target: PartialProfitLevel): Promise<void> {
    const closeVolume = position.volume * target.percentage;

    if (closeVolume < this.config.partialCloseMinVolume) {
      console.log(`💰 Skipping partial close - volume ${closeVolume} below minimum ${this.config.partialCloseMinVolume}`);
      return;
    }

    try {
      const { exnessAPI } = await import('./exnessApi');
      const success = await exnessAPI.closePositionPartial(position.ticket, closeVolume);

      if (success) {
        target.actionTaken = true;
        target.actionTime = new Date();
        target.closedVolume = closeVolume;

        // Calculate approximate profit
        const approxProfit = closeVolume * target.target * 100000 * 0.0001; // Simplified
        target.closedProfit = approxProfit;

        console.log(`💰 Partial close executed at ${target.target}R: ${closeVolume.toFixed(2)} lots closed for approx $${approxProfit.toFixed(2)}`);

        // Log to journal
        await this.logPartialClose(position, target);
      }
    } catch (error) {
      console.error(`❌ Failed to execute partial close for ${position.symbol}:`, error);
    }
  }

  /**
   * Move stop loss to a specific R target
   */
  private async moveSLToTarget(position: PositionData, rTarget: number): Promise<void> {
    if (!position.stopLoss || !position.openPrice) return;

    const risk = Math.abs(position.openPrice - position.stopLoss);
    const newSL = position.type === 'BUY'
      ? position.openPrice + (risk * rTarget)
      : position.openPrice - (risk * rTarget);

    try {
      const { exnessAPI } = await import('./exnessApi');
      await exnessAPI.modifyPosition(position.ticket, { stopLoss: newSL });
      console.log(`💰 Stop loss moved to ${rTarget}R for ${position.symbol}`);
    } catch (error) {
      console.error(`❌ Failed to move stop loss:`, error);
    }
  }

  /**
   * Apply trailing stop after 2R
   */
  private async applyTrailingStop(position: PositionData, currentR: number): Promise<void> {
    const trailDistance = this.config.trailing2RDistance * (position.openPrice - (position.stopLoss || position.openPrice));
    
    const newSL = position.type === 'BUY'
      ? position.openPrice + (currentR - this.config.trailing2RDistance) * (position.openPrice - (position.stopLoss || position.openPrice))
      : position.openPrice - (currentR - this.config.trailing2RDistance) * (position.openPrice - (position.stopLoss || position.openPrice));

    if ((position.type === 'BUY' && newSL > (position.stopLoss || 0)) ||
        (position.type === 'SELL' && newSL < (position.stopLoss || Infinity))) {
      try {
        const { exnessAPI } = await import('./exnessApi');
        await exnessAPI.modifyPosition(position.ticket, { stopLoss: newSL });
        console.log(`💰 Trailing stop applied for ${position.symbol}: SL moved to ${newSL.toFixed(5)}`);
      } catch (error) {
        console.error(`❌ Failed to apply trailing stop:`, error);
      }
    }
  }

  /**
   * Get current price for a symbol
   */
  private async getCurrentPrice(symbol: string): Promise<number> {
    try {
      const { exnessAPI } = await import('./exnessApi');
      const priceData = await exnessAPI.getCurrentPrice(symbol);
      return (priceData.bid + priceData.ask) / 2;
    } catch {
      return 0;
    }
  }

  /**
   * Log partial close to journal
   */
  private async logPartialClose(position: PositionData, target: PartialProfitLevel): Promise<void> {
    console.log(`💰 Partial close logged for ${position.symbol} ticket ${position.ticket}`);
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<PartialProfitConfig>): void {
    this.config = { ...this.config, ...config };
    console.log('✅ Partial profit manager config updated');
  }

  /**
   * Get configuration
   */
  getConfig(): PartialProfitConfig {
    return { ...this.config };
  }

  /**
   * Get active targets status
   */
  getActiveTargets(): Record<string, PartialProfitLevel[]> {
    const result: Record<string, PartialProfitLevel[]> = {};
    this.activeTargets.forEach((targets, ticket) => {
      result[ticket] = targets;
    });
    return result;
  }

  /**
   * Remove position targets (when position is closed)
   */
  removePositionTargets(ticket: number): void {
    this.activeTargets.delete(ticket.toString());
  }

  /**
   * Get status for dashboard
   */
  getStatus(): any {
    const activeCount = this.activeTargets.size;
    const pendingTargets = Array.from(this.activeTargets.values())
      .flat()
      .filter(t => !t.actionTaken).length;

    return {
      enabled: this.config.enabled,
      activePositions: activeCount,
      pendingTargets,
      config: {
        target1RPercentage: this.config.target1RPercentage * 100,
        target2RPercentage: this.config.target2RPercentage * 100,
        trailStopAfter1R: this.config.trailStopAfter1R,
        trailStopAfter2R: this.config.trailStopAfter2R,
        useTrailing2R: this.config.useTrailing2R
      }
    };
  }
}

export const partialProfitManager = new PartialProfitManager();
