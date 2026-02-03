import { exnessAPI } from './exnessApi';
import { orderManager } from './orderManager';
import { correlationManager } from './correlationManager';
import { multiTimeframeAnalyzer } from './multiTimeframeAnalyzer';
import { getPipValue } from './tradingUtils';

export interface PositionData {
  ticket: number;
  symbol: string;
  type: 'BUY' | 'SELL';
  volume: number;
  openPrice: number;
  stopLoss?: number;
  takeProfit?: number;
  openTime: Date;
  profit: number;
  swap: number;
  comment: string;
}

export interface TradeInvalidationReason {
  reason: string;
  detectedAt: Date;
  details?: any;
}

export interface CapitalProtectionAction {
  action: 'MOVE_TO_BREAKEVEN' | 'PARTIAL_CLOSE' | 'TRAIL_STOP' | 'FULL_CLOSE';
  executedAt: Date;
  details: any;
}

export interface TradeLogEntry {
  tradeId: number;
  timestamp: Date;
  action: string;
  reason: string;
  details: any;
}

class CapitalPreservationManager {
  private managedPositions: Map<number, PositionData> = new Map();
  private invalidatedTrades: Map<number, TradeInvalidationReason> = new Map();
  private protectionActions: Map<number, CapitalProtectionAction[]> = new Map();
  private tradeLogs: TradeLogEntry[] = [];
  private dailyDrawdown: number = 0;
  private maxDailyDrawdown: number = 0.02; // 2%
  private consecutiveLosingTrades: number = 0;
  private maxConsecutiveLosses: number = 3;

  // Configuration parameters
  private config = {
    minProfitForProtection: 0.1, // Minimum profit in account currency to trigger protection
    partialClosePercentage: 0.7, // Close 70% of position
    trailingStopDistance: 1.5, // 1.5x ATR
    breakEvenBuffer: 0.001, // 0.1R or cover fees + spread
  };

  async initialize(): Promise<void> {
    console.log('🛡️ CapitalPreservationManager: Initializing...');
    await this.detectExistingPositions();
    console.log('✅ CapitalPreservationManager: Initialized successfully');
  }

  async detectExistingPositions(): Promise<void> {
    console.log('🔍 CapitalPreservationManager: Detecting existing open positions...');
    
    try {
      const positions = await exnessAPI.getPositions();
      if (!positions || positions.length === 0) {
        console.log('ℹ️ CapitalPreservationManager: No existing open positions found');
        return;
      }

      console.log(`✅ CapitalPreservationManager: Found ${positions.length} existing open positions`);
      
      for (const position of positions) {
        const positionData: PositionData = {
          ticket: position.ticket,
          symbol: position.symbol,
          type: position.type,
          volume: position.volume,
          openPrice: position.openPrice,
          stopLoss: position.stopLoss,
          takeProfit: position.takeProfit,
          openTime: position.openTime,
          profit: position.profit,
          swap: position.swap,
          comment: (position as any).comment || ''
        };
        await this.addPositionToManagement(positionData);
      }
      
      console.log('📊 CapitalPreservationManager: All existing positions are now under active management');
    } catch (error) {
      console.error('❌ CapitalPreservationManager: Error detecting existing positions:', error);
    }
  }

  async addPositionToManagement(position: PositionData): Promise<void> {
    console.log(`📈 CapitalPreservationManager: Adding position ${position.ticket} to active management`);
    
    this.managedPositions.set(position.ticket, position);
    
    // Log the addition
    this.logTradeAction(position.ticket, 'POSITION_ADDED', 'Position added to active management', {
      symbol: position.symbol,
      type: position.type,
      volume: position.volume,
      openPrice: position.openPrice,
      stopLoss: position.stopLoss,
      takeProfit: position.takeProfit
    });
    
    // Immediately check if this position needs protection
    await this.checkPositionForProtection(position.ticket);
  }

  async removePositionFromManagement(ticket: number): Promise<void> {
    if (this.managedPositions.has(ticket)) {
      const position = this.managedPositions.get(ticket);
      console.log(`🗑️ CapitalPreservationManager: Removing position ${ticket} from management`);
      
      this.managedPositions.delete(ticket);
      this.invalidatedTrades.delete(ticket);
      this.protectionActions.delete(ticket);
      
      // Log the removal
      this.logTradeAction(ticket, 'POSITION_REMOVED', 'Position removed from management', {
        symbol: position?.symbol,
        profit: position?.profit
      });
    }
  }

  async checkPositionForProtection(ticket: number): Promise<void> {
    const position = this.managedPositions.get(ticket);
    if (!position) return;
    
    console.log(`🛡️ CapitalPreservationManager: Checking position ${ticket} for protection needs`);
    
    // Check if position was previously in profit
    const wasInProfit = position.profit > 0;
    
    // Check if position has reached X% of intended TP
    const tpProgress = await this.calculateTPProgress(position);
    
    // Check for market structure shifts
    const hasStructureShift = await this.detectMarketStructureShift(position.symbol);
    
    // Check for volatility spikes
    const hasVolatilitySpike = await this.detectVolatilitySpike(position.symbol);
    
    // Determine if protection is needed
    const needsProtection = wasInProfit || tpProgress >= 0.5 || hasStructureShift || hasVolatilitySpike;
    
    if (needsProtection) {
      console.log(`⚠️ CapitalPreservationManager: Position ${ticket} needs protection`);
      await this.applyCapitalProtection(ticket, {
        wasInProfit,
        tpProgress,
        hasStructureShift,
        hasVolatilitySpike
      });
    }
  }

  async applyCapitalProtection(ticket: number, context: any): Promise<void> {
    const position = this.managedPositions.get(ticket);
    if (!position) return;
    
    console.log(`🛡️ CapitalPreservationManager: Applying capital protection to position ${ticket}`);
    
    // Priority 1: Move Stop Loss to Break-Even if possible
    if (position.profit > this.config.minProfitForProtection) {
      await this.moveToBreakEven(ticket);
      return;
    }
    
    // Priority 2: Partial Close (50-80%)
    if (position.volume >= 0.02) { // Only partial close if volume is large enough
      await this.partialClose(ticket, this.config.partialClosePercentage);
      return;
    }
    
    // Priority 3: Trail Stop Dynamically
    await this.trailStopDynamically(ticket);
    
    // Priority 4: Full Close if risk exceeds reward
    if (context.hasStructureShift || context.hasVolatilitySpike) {
      await this.fullClose(ticket, 'Market structure shift or volatility spike detected');
    }
  }

  async moveToBreakEven(ticket: number): Promise<void> {
    const position = this.managedPositions.get(ticket);
    if (!position) return;
    
    console.log(`🎯 CapitalPreservationManager: Moving position ${ticket} to break-even`);
    
    try {
      // Calculate break-even price
      const pipValue = getPipValue(position.symbol);
      const spreadCost = await this.calculateSpreadCost(position.symbol);
      const breakEvenPrice = position.type === 'BUY' 
        ? position.openPrice + (spreadCost / pipValue) + this.config.breakEvenBuffer
        : position.openPrice - (spreadCost / pipValue) - this.config.breakEvenBuffer;
      
      // Update stop loss to break-even
      const success = await exnessAPI.modifyPosition(ticket, {
        stopLoss: breakEvenPrice
      });
      
      if (success) {
        this.logProtectionAction(ticket, 'MOVE_TO_BREAKEVEN', {
          oldStopLoss: position.stopLoss,
          newStopLoss: breakEvenPrice,
          breakEvenPrice
        });
        
        // Update local position data
        position.stopLoss = breakEvenPrice;
        this.managedPositions.set(ticket, position);
        
        console.log(`✅ CapitalPreservationManager: Position ${ticket} moved to break-even at ${breakEvenPrice}`);
      }
    } catch (error) {
      console.error(`❌ CapitalPreservationManager: Failed to move position ${ticket} to break-even:`, error);
    }
  }

  async partialClose(ticket: number, percentage: number): Promise<void> {
    const position = this.managedPositions.get(ticket);
    if (!position) return;
    
    console.log(`🔄 CapitalPreservationManager: Partial closing position ${ticket} (${percentage * 100}%)`);
    
    try {
      const closeVolume = position.volume * percentage;
      const success = await exnessAPI.closePositionPartial(ticket, closeVolume);
      
      if (success) {
        this.logProtectionAction(ticket, 'PARTIAL_CLOSE', {
          originalVolume: position.volume,
          closedVolume: closeVolume,
          remainingVolume: position.volume - closeVolume,
          percentage
        });
        
        // Update local position data
        position.volume -= closeVolume;
        this.managedPositions.set(ticket, position);
        
        console.log(`✅ CapitalPreservationManager: Position ${ticket} partially closed - ${closeVolume} of ${position.volume + closeVolume}`);
      }
    } catch (error) {
      console.error(`❌ CapitalPreservationManager: Failed to partially close position ${ticket}:`, error);
    }
  }

  async trailStopDynamically(ticket: number): Promise<void> {
    const position = this.managedPositions.get(ticket);
    if (!position) return;
    
    console.log(`📊 CapitalPreservationManager: Applying dynamic trailing stop to position ${ticket}`);
    
    try {
      // Calculate ATR-based trailing distance
      const atr = await multiTimeframeAnalyzer.calculateATR(position.symbol, 'H1', 14);
      const trailingDistance = atr * this.config.trailingStopDistance;
      
      // Calculate new stop loss based on current price and direction
      const currentPrice = await this.getCurrentPrice(position.symbol);
      const newStopLoss = position.type === 'BUY' 
        ? currentPrice - trailingDistance
        : currentPrice + trailingDistance;
      
      // Only update if new stop loss is better than current
      if ((position.type === 'BUY' && newStopLoss > (position.stopLoss || 0)) ||
          (position.type === 'SELL' && newStopLoss < (position.stopLoss || Infinity))) {
        
        const success = await exnessAPI.modifyPosition(ticket, {
          stopLoss: newStopLoss
        });
        
        if (success) {
          this.logProtectionAction(ticket, 'TRAIL_STOP', {
            oldStopLoss: position.stopLoss,
            newStopLoss,
            atr,
            trailingDistance
          });
          
          // Update local position data
          position.stopLoss = newStopLoss;
          this.managedPositions.set(ticket, position);
          
          console.log(`✅ CapitalPreservationManager: Position ${ticket} trailing stop updated to ${newStopLoss}`);
        }
      }
    } catch (error) {
      console.error(`❌ CapitalPreservationManager: Failed to trail stop position ${ticket}:`, error);
    }
  }

  async fullClose(ticket: number, reason: string): Promise<void> {
    const position = this.managedPositions.get(ticket);
    if (!position) return;
    
    console.log(`🚨 CapitalPreservationManager: Full closing position ${ticket} - ${reason}`);
    
    try {
      const success = await exnessAPI.closePosition(ticket);
      
      if (success) {
        this.logProtectionAction(ticket, 'FULL_CLOSE', {
          reason,
          profit: position.profit
        });
        
        // Remove from management
        await this.removePositionFromManagement(ticket);
        
        console.log(`✅ CapitalPreservationManager: Position ${ticket} fully closed - ${reason}`);
      }
    } catch (error) {
      console.error(`❌ CapitalPreservationManager: Failed to fully close position ${ticket}:`, error);
    }
  }

  async detectMarketStructureShift(symbol: string): Promise<boolean> {
    console.log(`📉 CapitalPreservationManager: Detecting market structure shift for ${symbol}`);
    
    try {
      // Use multi-timeframe analyzer to detect structure changes
      const analysis = await multiTimeframeAnalyzer.analyzeMarketStructure(symbol);
      
      // Check for trend breaks, EMA/VWAP flips, or momentum divergence
      const hasShift = analysis.trendBreakDetected || 
                      analysis.emaFlipDetected || 
                      analysis.momentumDivergenceDetected;
      
      if (hasShift) {
        console.log(`⚠️ CapitalPreservationManager: Market structure shift detected for ${symbol}`);
        return true;
      }
      
      return false;
    } catch (error) {
      console.error(`❌ CapitalPreservationManager: Error detecting market structure shift for ${symbol}:`, error);
      return false;
    }
  }

  async detectVolatilitySpike(symbol: string): Promise<boolean> {
    console.log(`📊 CapitalPreservationManager: Detecting volatility spike for ${symbol}`);
    
    try {
      // Calculate current ATR and compare to historical average
      const currentATR = await multiTimeframeAnalyzer.calculateATR(symbol, 'H1', 14);
      const historicalATR = await multiTimeframeAnalyzer.calculateHistoricalATR(symbol, 'H1', 14, 30);
      
      // Volatility spike if current ATR is significantly higher than historical
      const volatilityRatio = currentATR / historicalATR;
      const hasSpike = volatilityRatio > 2.0; // 2x higher than normal
      
      if (hasSpike) {
        console.log(`⚠️ CapitalPreservationManager: Volatility spike detected for ${symbol} (${volatilityRatio}x normal)`);
        return true;
      }
      
      return false;
    } catch (error) {
      console.error(`❌ CapitalPreservationManager: Error detecting volatility spike for ${symbol}:`, error);
      return false;
    }
  }

  async calculateTPProgress(position: PositionData): Promise<number> {
    if (!position.takeProfit) return 0;
    
    const currentPrice = await this.getCurrentPrice(position.symbol);
    const entryPrice = position.openPrice;
    const tpPrice = position.takeProfit;
    
    if (position.type === 'BUY') {
      const totalDistance = tpPrice - entryPrice;
      const currentDistance = currentPrice - entryPrice;
      return totalDistance > 0 ? Math.min(1, currentDistance / totalDistance) : 0;
    } else {
      const totalDistance = entryPrice - tpPrice;
      const currentDistance = entryPrice - currentPrice;
      return totalDistance > 0 ? Math.min(1, currentDistance / totalDistance) : 0;
    }
  }

  async calculateSpreadCost(symbol: string): Promise<number> {
    const priceData = await exnessAPI.getCurrentPrice(symbol);
    const pipValue = getPipValue(symbol);
    return priceData.spread * pipValue;
  }

  async getCurrentPrice(symbol: string): Promise<number> {
    const priceData = await exnessAPI.getCurrentPrice(symbol);
    return (priceData.bid + priceData.ask) / 2;
  }

  async checkDailyRiskLimits(): Promise<void> {
    console.log('📊 CapitalPreservationManager: Checking daily risk limits');
    
    try {
      const accountInfo = await orderManager.getAccountStatus();
      const currentDrawdown = accountInfo.balance - accountInfo.equity;
      
      // Check max daily drawdown
      if (currentDrawdown > accountInfo.balance * this.maxDailyDrawdown) {
        console.log('🚨 CapitalPreservationManager: Max daily drawdown reached!');
        await this.emergencyCloseAllPositions('Max daily drawdown reached');
        return;
      }
      
      // Check max floating loss per session
      const maxFloatingLoss = accountInfo.balance * 0.01; // 1%
      if (accountInfo.dailyPnL < -maxFloatingLoss) {
        console.log('🚨 CapitalPreservationManager: Max floating loss per session reached!');
        await this.emergencyCloseAllPositions('Max floating loss per session reached');
        return;
      }
      
      // Check consecutive losing trades
      if (this.consecutiveLosingTrades >= this.maxConsecutiveLosses) {
        console.log('🚨 CapitalPreservationManager: Max consecutive losing trades reached!');
        await this.emergencyCloseAllPositions('Max consecutive losing trades reached');
      }
      
    } catch (error) {
      console.error('❌ CapitalPreservationManager: Error checking daily risk limits:', error);
    }
  }

  async emergencyCloseAllPositions(reason: string): Promise<void> {
    console.log(`🚨 CapitalPreservationManager: EMERGENCY CLOSE ALL - ${reason}`);
    
    try {
      // Close all managed positions
      for (const [ticket, position] of this.managedPositions) {
        await this.fullClose(ticket, reason);
      }
      
      // Disable trading for the day
      await orderManager.setAutoTrading(false);
      
      // Log the emergency action
      this.logTradeAction(0, 'EMERGENCY_STOP', reason, {
        positionsClosed: this.managedPositions.size,
        timestamp: new Date()
      });
      
      console.log(`✅ CapitalPreservationManager: All positions closed due to ${reason}`);
    } catch (error) {
      console.error('❌ CapitalPreservationManager: Error in emergency close all:', error);
    }
  }

  async validateTradeEntry(signal: any): Promise<boolean> {
    console.log(`🔍 CapitalPreservationManager: Validating trade entry for ${signal.symbol}`);
    
    // Check risk-to-reward ratio
    if (!signal.stopLoss || !signal.takeProfit) {
      console.log('❌ CapitalPreservationManager: Trade rejected - missing SL or TP');
      return false;
    }
    
    const entryPrice = signal.entryPrice;
    const slDistance = Math.abs(entryPrice - signal.stopLoss);
    const tpDistance = Math.abs(signal.takeProfit - entryPrice);
    const riskRewardRatio = tpDistance / slDistance;
    
    if (riskRewardRatio < 2.0) { // Minimum 1:2
      console.log(`❌ CapitalPreservationManager: Trade rejected - RR ${riskRewardRatio.toFixed(2)} < 2.0`);
      return false;
    }
    
    // Check spread
    const spread = await this.calculateSpreadCost(signal.symbol);
    const maxSpread = 0.0005; // 5 pips max
    if (spread > maxSpread) {
      console.log(`❌ CapitalPreservationManager: Trade rejected - spread ${spread} > ${maxSpread}`);
      return false;
    }
    
    // Check news proximity
    const hasHighImpactNews = await this.checkHighImpactNews(signal.symbol);
    if (hasHighImpactNews) {
      console.log('❌ CapitalPreservationManager: Trade rejected - high impact news imminent');
      return false;
    }
    
    // Check position size
    const accountInfo = await orderManager.getAccountStatus();
    const riskAmount = accountInfo.balance * 0.01; // 1% risk per trade
    const pipValue = getPipValue(signal.symbol);
    const maxVolume = riskAmount / (slDistance * pipValue);
    
    if (signal.volume > maxVolume) {
      console.log(`❌ CapitalPreservationManager: Trade rejected - volume ${signal.volume} > ${maxVolume}`);
      return false;
    }
    
    console.log('✅ CapitalPreservationManager: Trade entry validated successfully');
    return true;
  }

  async checkHighImpactNews(symbol: string): Promise<boolean> {
    // Implement news checking logic
    // This would integrate with newsImpactPredictor
    return false; // Placeholder
  }

  logProtectionAction(ticket: number, action: CapitalProtectionAction['action'], details: any): void {
    const actionLog: CapitalProtectionAction = {
      action,
      executedAt: new Date(),
      details
    };
    
    if (!this.protectionActions.has(ticket)) {
      this.protectionActions.set(ticket, []);
    }
    
    this.protectionActions.get(ticket)?.push(actionLog);
    
    // Also log to general trade logs
    this.logTradeAction(ticket, `PROTECTION_${action}`, `Applied ${action} protection`, details);
  }

  logTradeAction(ticket: number, action: string, reason: string, details: any): void {
    const logEntry: TradeLogEntry = {
      tradeId: ticket,
      timestamp: new Date(),
      action,
      reason,
      details
    };
    
    this.tradeLogs.push(logEntry);
    
    // Keep logs manageable
    if (this.tradeLogs.length > 1000) {
      this.tradeLogs = this.tradeLogs.slice(-1000);
    }
    
    console.log(`📝 CapitalPreservationManager: ${action} - ${reason}`);
  }

  getTradeLogs(): TradeLogEntry[] {
    return [...this.tradeLogs];
  }

  getProtectionActions(ticket: number): CapitalProtectionAction[] | undefined {
    return this.protectionActions.get(ticket);
  }

  getManagedPositions(): PositionData[] {
    return Array.from(this.managedPositions.values());
  }

  getInvalidatedTrades(): Map<number, TradeInvalidationReason> {
    return new Map(this.invalidatedTrades);
  }

  async markTradeAsInvalidated(ticket: number, reason: string, details?: any): Promise<void> {
    this.invalidatedTrades.set(ticket, {
      reason,
      detectedAt: new Date(),
      details
    });
    
    this.logTradeAction(ticket, 'TRADE_INVALIDATED', reason, details || {});
  }

  async updatePositionData(ticket: number, updatedData: Partial<PositionData>): Promise<void> {
    const position = this.managedPositions.get(ticket);
    if (position) {
      const updatedPosition = { ...position, ...updatedData };
      this.managedPositions.set(ticket, updatedPosition);
    }
  }

  async onTradeClosed(ticket: number, profit: number): Promise<void> {
    // Update consecutive losing trades counter
    if (profit < 0) {
      this.consecutiveLosingTrades++;
    } else {
      this.consecutiveLosingTrades = 0;
    }
    
    // Update daily drawdown
    if (profit < 0) {
      this.dailyDrawdown += Math.abs(profit);
    }
    
    // Remove from management
    await this.removePositionFromManagement(ticket);
  }

  async resetDailyCounters(): Promise<void> {
    this.dailyDrawdown = 0;
    this.consecutiveLosingTrades = 0;
    console.log('📅 CapitalPreservationManager: Daily counters reset');
  }

  async startDynamicManagementLoop(): Promise<void> {
    console.log('🔄 CapitalPreservationManager: Starting dynamic management loop');
    
    // Run management loop every 30 seconds
    setInterval(async () => {
      try {
        // Check all managed positions
        for (const [ticket, position] of this.managedPositions) {
          await this.checkPositionForProtection(ticket);
        }
        
        // Check daily risk limits
        await this.checkDailyRiskLimits();
        
        // Check for correlation risks
        await this.checkCorrelationRisks();
      } catch (error) {
        console.error('❌ CapitalPreservationManager: Error in management loop:', error);
      }
    }, 30000);
  }

  async checkCorrelationRisks(): Promise<void> {
    console.log('🔗 CapitalPreservationManager: Checking correlation risks');
    
    try {
      // Get all managed positions
      const positions = this.getManagedPositions();
      
      // Group by currency
      const currencyExposure: Record<string, { long: number, short: number }> = {};
      
      for (const position of positions) {
        const baseCurrency = position.symbol.substring(0, 3);
        const quoteCurrency = position.symbol.substring(3, 6);
        
        if (!currencyExposure[baseCurrency]) {
          currencyExposure[baseCurrency] = { long: 0, short: 0 };
        }
        if (!currencyExposure[quoteCurrency]) {
          currencyExposure[quoteCurrency] = { long: 0, short: 0 };
        }
        
        if (position.type === 'BUY') {
          currencyExposure[baseCurrency].long += position.volume;
          currencyExposure[quoteCurrency].short += position.volume;
        } else {
          currencyExposure[baseCurrency].short += position.volume;
          currencyExposure[quoteCurrency].long += position.volume;
        }
      }
      
      // Check for overexposure
      const maxExposurePerCurrency = 0.5; // 50% of account
      const accountInfo = await orderManager.getAccountStatus();
      
      for (const [currency, exposure] of Object.entries(currencyExposure)) {
        const netExposure = Math.abs(exposure.long - exposure.short);
        const exposurePercentage = netExposure / accountInfo.balance;
        
        if (exposurePercentage > maxExposurePerCurrency) {
          console.log(`⚠️ CapitalPreservationManager: Overexposure detected for ${currency} (${exposurePercentage.toFixed(2)}%)`);
          
          // Reduce positions for this currency
          await this.reduceCorrelatedExposure(currency);
        }
      }
      
    } catch (error) {
      console.error('❌ CapitalPreservationManager: Error checking correlation risks:', error);
    }
  }

  async reduceCorrelatedExposure(currency: string): Promise<void> {
    console.log(`🔄 CapitalPreservationManager: Reducing exposure for ${currency}`);
    
    try {
      // Find all positions involving this currency
      const positionsToReduce = Array.from(this.managedPositions.values())
        .filter(p => p.symbol.includes(currency));
      
      // Sort by profit (close least profitable first)
      positionsToReduce.sort((a, b) => a.profit - b.profit);
      
      // Close the weakest positions
      for (const position of positionsToReduce.slice(0, 2)) { // Close top 2 weakest
        await this.fullClose(position.ticket, `Reducing ${currency} exposure`);
      }
      
    } catch (error) {
      console.error(`❌ CapitalPreservationManager: Error reducing ${currency} exposure:`, error);
    }
  }

  async getCurrentRiskMetrics(): Promise<any> {
    const accountInfo = await orderManager.getAccountStatus();
    
    return {
      dailyDrawdown: this.dailyDrawdown,
      maxDailyDrawdown: this.maxDailyDrawdown,
      consecutiveLosingTrades: this.consecutiveLosingTrades,
      maxConsecutiveLosses: this.maxConsecutiveLosses,
      managedPositions: this.managedPositions.size,
      invalidatedTrades: this.invalidatedTrades.size,
      accountBalance: accountInfo.balance,
      accountEquity: accountInfo.equity,
      marginLevel: accountInfo.marginLevel
    };
  }
}

export const capitalPreservationManager = new CapitalPreservationManager();
