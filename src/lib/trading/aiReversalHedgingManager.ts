/**
 * AI Reversal Hedging Manager
 * Detects market reversals and automatically opens hedging positions to protect capital
 * Uses Smart Money Concepts + AI to identify when to hedge losing positions
 */

import { exnessAPI, TradeOrder } from './exnessApi';
import { orderManager } from './orderManager';
import { smartMoneyAnalyzer, CandleData, SMCAnalysis } from './smartMoneyAnalyzer';
import { aiAnalyzer, MarketAnalysisInput } from './aiAnalyzer';
import { marketRegimeDetector, MarketRegime } from './marketRegimeDetector';
import { getPipValue } from './tradingUtils';

export interface HedgePosition {
  ticketId: string;
  originalTicketId: string;
  symbol: string;
  type: 'BUY' | 'SELL'; // OPPOSITE of original
  volume: number;
  openPrice: number;
  stopLoss: number;
  takeProfit: number;
  openTime: Date;
  status: 'ACTIVE' | 'CLOSED' | 'PARTIAL';
  hedgeProfit: number;
  originalLossAtHedge: number;
}

export interface ReversalSignal {
  detected: boolean;
  direction: 'BUY' | 'SELL';
  confidence: number;
  reason: string;
  strength: number; // 0-100
}

export interface HedgeConfig {
  enabled: boolean;
  minLossThreshold: number; // Minimum loss % to trigger hedge
  maxLossThreshold: number; // Maximum loss % before forced exit
  hedgeVolumeRatio: number; // Hedge volume as % of original (0.5 = 50%)
  reversalConfidenceThreshold: number; // Minimum confidence to open hedge
  maxHedgePositionsPerSymbol: number;
  trailingStopEnabled: boolean;
  hedgeTakeProfitMultiplier: number; // TP distance as % of original SL
  closeHedgeWhenRecovery: boolean; // Close hedge when original recovers
  recoveryThreshold: number; // % profit recovery to trigger hedge close
}

class AIReversalHedgingManager {
  private config: HedgeConfig = {
    enabled: true,
    minLossThreshold: 0.05, // 5% of risk distance reached - earlier detection
    maxLossThreshold: 0.50, // 50% of risk distance - forced exit
    hedgeVolumeRatio: 0.50, // 50% of original position
    reversalConfidenceThreshold: 40, // 40% minimum confidence - more sensitive
    maxHedgePositionsPerSymbol: 2,
    trailingStopEnabled: true,
    hedgeTakeProfitMultiplier: 0.75, // TP at 75% of original SL distance
    closeHedgeWhenRecovery: true,
    recoveryThreshold: 0.30 // Close hedge when original recovers 30%
  };

  private hedgePositions: Map<string, HedgePosition[]> = new Map();
  private monitoredPositions: Map<string, { 
    originalTicketId: string;
    symbol: string;
    type: 'BUY' | 'SELL';
    volume: number;
    openPrice: number;
    stopLoss: number;
    takeProfit: number;
    lossDistance: number;
    currentLoss: number;
    lastUpdate: Date;
    hasHedged: boolean;
    reversalAttempts: number;
  }> = new Map();

  private checkInterval: NodeJS.Timeout | null = null;
  private lastReversalCheck: Map<string, ReversalSignal> = new Map();

  constructor() {
    console.log('🛡️ AI Reversal Hedging Manager initialized');
  }

  /**
   * Start monitoring for hedging opportunities
   */
  startMonitoring(intervalMs: number = 5000): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }

    this.checkInterval = setInterval(async () => {
      await this.checkAllPositionsForHedging();
    }, intervalMs);

    console.log(`✅ AI Reversal Hedging Manager started - checking every ${intervalMs}ms`);
  }

  /**
   * Stop monitoring
   */
  stopMonitoring(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    console.log('🛑 AI Reversal Hedging Manager stopped');
  }

  /**
   * Add a position to be monitored for potential hedging
   */
  addPositionToMonitor(params: {
    originalTicketId: string;
    symbol: string;
    type: 'BUY' | 'SELL';
    volume: number;
    openPrice: number;
    stopLoss: number;
    takeProfit: number;
  }): void {
    const riskDistance = Math.abs(params.openPrice - params.stopLoss);
    
    this.monitoredPositions.set(params.originalTicketId, {
      ...params,
      lossDistance: riskDistance,
      currentLoss: 0,
      lastUpdate: new Date(),
      hasHedged: false,
      reversalAttempts: 0
    });

    console.log(`🛡️ Added position ${params.originalTicketId} (${params.symbol} ${params.type}) to hedging monitor - Risk distance: ${riskDistance.toFixed(4)}`);
  }

  /**
   * Remove position from monitoring
   */
  removePositionFromMonitor(ticketId: string): void {
    this.monitoredPositions.delete(ticketId);
    this.hedgePositions.delete(ticketId);
    console.log(`🗑️ Removed position ${ticketId} from hedging monitor`);
  }

  /**
   * Check all monitored positions for hedging opportunities
   */
  private async checkAllPositionsForHedging(): Promise<void> {
    for (const [ticketId, position] of this.monitoredPositions) {
      try {
        await this.evaluatePositionForHedging(ticketId, position);
      } catch (error) {
        console.error(`❌ Error evaluating position ${ticketId} for hedging:`, error);
      }
    }
  }

  /**
   * Evaluate a single position for hedging opportunity
   */
  private async evaluatePositionForHedging(
    ticketId: string, 
    position: typeof this.monitoredPositions extends Map<string, infer T> ? T : never
  ): Promise<void> {
    // Get current price
    const currentPriceData = await exnessAPI.getCurrentPrice(position.symbol);
    if (!currentPriceData) return;

    const currentPrice = (currentPriceData.bid + currentPriceData.ask) / 2;
    
    // Calculate current loss
    let currentLoss: number;
    if (position.type === 'BUY') {
      currentLoss = position.openPrice - currentPrice;
    } else {
      currentLoss = currentPrice - position.openPrice;
    }

    // Update position data
    position.currentLoss = currentLoss;
    position.lastUpdate = new Date();

    // Calculate loss percentage (how far to stop loss)
    const lossPercentage = currentLoss / position.lossDistance;

    console.log(`🛡️ Evaluating ${position.symbol} ${position.type}: Loss ${(lossPercentage * 100).toFixed(1)}%, Current: ${currentPrice.toFixed(2)}`);

    // Check if already hedged
    if (position.hasHedged) {
      await this.evaluateHedgeExit(ticketId, position, currentPrice);
      return;
    }

    // Check if loss threshold met for hedging consideration
    if (lossPercentage < this.config.minLossThreshold) {
      console.log(`⏭️ Position ${ticketId} loss ${(lossPercentage * 100).toFixed(1)}% below threshold ${(this.config.minLossThreshold * 100).toFixed(1)}% - skipping`);
      return;
    }

    // Check if max loss threshold exceeded - force close
    if (lossPercentage >= this.config.maxLossThreshold) {
      console.log(`🚨 Position ${ticketId} reached max loss threshold ${(lossPercentage * 100).toFixed(1)}% - FORCING EXIT`);
      await this.forceExitPosition(ticketId, position);
      return;
    }

    // Detect market reversal
    const reversalSignal = await this.detectReversal(position.symbol, currentPriceData);
    this.lastReversalCheck.set(position.symbol, reversalSignal);

    if (!reversalSignal.detected) {
      console.log(`⏭️ No reversal detected for ${position.symbol} - continuing to monitor`);
      return;
    }

    // Check reversal confidence
    if (reversalSignal.confidence < this.config.reversalConfidenceThreshold) {
      console.log(`⚠️ Reversal confidence ${reversalSignal.confidence}% below threshold ${this.config.reversalConfidenceThreshold}% - waiting`);
      return;
    }

    // Check if reversal direction is OPPOSITE to position
    const expectedHedgeType = position.type === 'BUY' ? 'SELL' : 'BUY';
    
    if (reversalSignal.direction !== expectedHedgeType) {
      console.log(`⏭️ Reversal ${reversalSignal.direction} doesn't oppose position ${position.type} - no hedge needed`);
      return;
    }

    // Open hedge position
    console.log(`🚀 OPENING HEDGE: ${position.symbol} ${expectedHedgeType} - Reversal: ${reversalSignal.direction} (${reversalSignal.confidence}%)`);
    console.log(`   Reason: ${reversalSignal.reason}`);
    
    await this.openHedgePosition(ticketId, position, reversalSignal);
  }

  /**
   * Detect market reversal using SMC + AI analysis
   */
  private async detectReversal(symbol: string, priceData: { bid: number; ask: number }): Promise<ReversalSignal> {
    try {
      // Get SMC analysis
      const smcAnalysis = await this.getSMCAnalysis(symbol);
      
      // Get market regime
      const regimeResult = await marketRegimeDetector.detectRegime(symbol);
      
      // Get AI analysis
      const aiInput: MarketAnalysisInput = {
        symbol,
        timeframe: 'H1',
        marketData: {
          currentPrice: (priceData.bid + priceData.ask) / 2,
          bid: priceData.bid,
          ask: priceData.ask,
          spread: priceData.ask - priceData.bid
        },
        technicalIndicators: {}
      };
      const aiResult = await aiAnalyzer.analyzeMarket(aiInput);

      // Combine signals for reversal detection
      let bullishScore = 0;
      let bearishScore = 0;
      const reasons: string[] = [];

      // SMC Structure analysis
      if (smcAnalysis.marketStructure.trend === 'BEARISH' && smcAnalysis.marketStructure.lastCHoCH?.type === 'BULLISH') {
        bullishScore += 25;
        reasons.push('SMC: Bearish structure broken by bullish CHoCH');
      }
      if (smcAnalysis.marketStructure.trend === 'BULLISH' && smcAnalysis.marketStructure.lastCHoCH?.type === 'BEARISH') {
        bearishScore += 25;
        reasons.push('SMC: Bullish structure broken by bearish CHoCH');
      }

      // Order Block analysis
      const bullishOB = smcAnalysis.orderBlocks.filter(ob => ob.type === 'BULLISH' && !ob.tested);
      const bearishOB = smcAnalysis.orderBlocks.filter(ob => ob.type === 'BEARISH' && !ob.tested);
      
      if (bullishOB.length > 0) {
        bullishScore += 20;
        reasons.push(`SMC: ${bullishOB.length} untested bullish order blocks`);
      }
      if (bearishOB.length > 0) {
        bearishScore += 20;
        reasons.push(`SMC: ${bearishOB.length} untested bearish order blocks`);
      }

      // Market regime analysis
      if (regimeResult.regime === 'REVERSAL_IMMINENT') {
        const regimeBoost = regimeResult.confidence * 0.3;
        if (regimeResult.rsi > 70) {
          bearishScore += regimeBoost;
          reasons.push(`Regime: RSI overbought (${regimeResult.rsi.toFixed(0)}) - reversal likely DOWN`);
        } else if (regimeResult.rsi < 30) {
          bullishScore += regimeBoost;
          reasons.push(`Regime: RSI oversold (${regimeResult.rsi.toFixed(0)}) - reversal likely UP`);
        }
      }

      // AI Signal analysis
      if (aiResult.signal === 'BUY' && aiResult.confidence > 60) {
        bullishScore += aiResult.confidence * 0.3;
        reasons.push(`AI: ${aiResult.reasoning}`);
      }
      if (aiResult.signal === 'SELL' && aiResult.confidence > 60) {
        bearishScore += aiResult.confidence * 0.3;
        reasons.push(`AI: ${aiResult.reasoning}`);
      }

      // Calculate final confidence
      const maxScore = 100;
      const totalScore = bullishScore + bearishScore;
      const confidence = totalScore > 0 ? Math.min(100, totalScore) : 0;

      // Determine direction
      let direction: 'BUY' | 'SELL';
      if (bullishScore > bearishScore) {
        direction = 'BUY';
      } else if (bearishScore > bullishScore) {
        direction = 'SELL';
      } else {
        return { detected: false, direction: 'BUY', confidence: 0, reason: 'No clear reversal', strength: 0 };
      }

      // Strength calculation
      const strength = Math.min(100, Math.abs(bullishScore - bearishScore) + confidence);

      // Detection threshold
      const detectionThreshold = 50;
      const detected = confidence >= detectionThreshold && totalScore >= detectionThreshold;

      return {
        detected,
        direction,
        confidence,
        reason: reasons.join(' | '),
        strength
      };

    } catch (error) {
      console.error(`❌ Error detecting reversal for ${symbol}:`, error);
      return { detected: false, direction: 'BUY', confidence: 0, reason: 'Analysis error', strength: 0 };
    }
  }

  /**
   * Get SMC analysis for a symbol
   */
  private async getSMCAnalysis(symbol: string): Promise<SMCAnalysis> {
    try {
      // Get candle data
      const candles = await this.getCandleData(symbol);
      if (!candles || candles.length < 20) {
        return {
          orderBlocks: [],
          fairValueGaps: [],
          liquidityZones: [],
          marketStructure: { trend: 'RANGING', lastBOS: null, lastCHoCH: null, swingHigh: 0, swingLow: 0 },
          confluenceScore: 0,
          confluenceFactors: [],
          tradeBias: 'NEUTRAL',
          entryZone: null,
          invalidationLevel: null
        };
      }

      const currentPrice = candles[candles.length - 1].close;
      return await smartMoneyAnalyzer.analyze(candles, currentPrice, symbol);
    } catch (error) {
      console.error(`❌ Error getting SMC analysis for ${symbol}:`, error);
      // Return empty analysis on error
      return {
        orderBlocks: [],
        fairValueGaps: [],
        liquidityZones: [],
        marketStructure: { trend: 'RANGING', lastBOS: null, lastCHoCH: null, swingHigh: 0, swingLow: 0 },
        confluenceScore: 0,
        confluenceFactors: [],
        tradeBias: 'NEUTRAL',
        entryZone: null,
        invalidationLevel: null
      };
    }
  }

  /**
   * Get candle data for a symbol
   */
  private async getCandleData(symbol: string): Promise<CandleData[]> {
    try {
      const bars = await exnessAPI.getHistoricalData(symbol, 'H1', 50);
      if (!bars || bars.length === 0) return [];
      
      return bars.map((bar: any) => ({
        open: bar.open,
        high: bar.high,
        low: bar.low,
        close: bar.close,
        volume: bar.tick_volume,
        timestamp: new Date(bar.time * 1000)
      }));
    } catch (error) {
      console.error(`❌ Error getting candle data for ${symbol}:`, error);
      return [];
    }
  }

  /**
   * Open a hedge position
   */
  private async openHedgePosition(
    originalTicketId: string,
    position: typeof this.monitoredPositions extends Map<string, infer T> ? T : never,
    reversalSignal: ReversalSignal
  ): Promise<void> {
    try {
      // Check if already hedged
      if (position.hasHedged) {
        console.log(`⚠️ Position ${originalTicketId} already has a hedge - skipping`);
        return;
      }

      // Check max hedge positions per symbol
      const existingHedges = this.hedgePositions.get(originalTicketId) || [];
      if (existingHedges.length >= this.config.maxHedgePositionsPerSymbol) {
        console.log(`⚠️ Max hedge positions (${this.config.maxHedgePositionsPerSymbol}) reached for ${position.symbol}`);
        return;
      }

      // Calculate hedge volume
      const hedgeVolume = Math.max(0.01, position.volume * this.config.hedgeVolumeRatio);
      
      // Determine hedge type (opposite of original)
      const hedgeType = position.type === 'BUY' ? 'SELL' : 'BUY';
      
      // Calculate hedge prices
      const currentPriceData = await exnessAPI.getCurrentPrice(position.symbol);
      if (!currentPriceData) return;

      const currentPrice = (currentPriceData.bid + currentPriceData.ask) / 2;
      const pipValue = getPipValue(position.symbol);
      const isGold = position.symbol.includes('XAU') || position.symbol.includes('XAG');
      
      // Hedge SL: Opposite direction from entry
      // Hedge TP: Recovery target - close hedge when original position recovers
      let hedgeSL: number, hedgeTP: number;
      
      if (hedgeType === 'SELL') {
        // Original was BUY, opening SELL hedge
        hedgeSL = currentPrice + (position.lossDistance * this.config.hedgeTakeProfitMultiplier);
        // For sell hedge, TP is below entry
        hedgeTP = currentPrice - (position.lossDistance * 0.50); // Target 50% of original risk
      } else {
        // Original was SELL, opening BUY hedge
        hedgeSL = currentPrice - (position.lossDistance * this.config.hedgeTakeProfitMultiplier);
        // For buy hedge, TP is above entry
        hedgeTP = currentPrice + (position.lossDistance * 0.50);
      }

      // Execute hedge order
      const hedgeOrder: TradeOrder = {
        symbol: position.symbol,
        type: hedgeType,
        volume: hedgeVolume,
        stopLoss: hedgeSL,
        takeProfit: hedgeTP,
        comment: `AI_HEDGE-${reversalSignal.confidence.toFixed(0)}%-${reversalSignal.reason.substring(0, 30)}`
      };

      console.log(`🚀 Executing HEDGE order: ${hedgeType} ${position.symbol} ${hedgeVolume} lots @ ${currentPrice.toFixed(2)}`);
      console.log(`   SL: ${hedgeSL.toFixed(2)}, TP: ${hedgeTP.toFixed(2)}`);
      console.log(`   Reason: ${reversalSignal.reason}`);

      const ticketId = await orderManager.executeOrder(hedgeOrder);
      
      if (!ticketId) {
        console.log(`❌ Hedge order failed for ${position.symbol}`);
        position.reversalAttempts++;
        return;
      }

      // Create hedge position record
      const hedgePosition: HedgePosition = {
        ticketId: ticketId.toString(),
        originalTicketId,
        symbol: position.symbol,
        type: hedgeType,
        volume: hedgeVolume,
        openPrice: currentPrice,
        stopLoss: hedgeSL,
        takeProfit: hedgeTP,
        openTime: new Date(),
        status: 'ACTIVE',
        hedgeProfit: 0,
        originalLossAtHedge: position.currentLoss
      };

      // Store hedge position
      if (!this.hedgePositions.has(originalTicketId)) {
        this.hedgePositions.set(originalTicketId, []);
      }
      this.hedgePositions.get(originalTicketId)?.push(hedgePosition);

      // Mark original position as hedged
      position.hasHedged = true;

      console.log(`✅ HEDGE OPENED: Ticket ${ticketId} for original position ${originalTicketId}`);

    } catch (error) {
      console.error(`❌ Error opening hedge position:`, error);
    }
  }

  /**
   * Evaluate if hedge should be closed (original position recovered)
   */
  private async evaluateHedgeExit(
    originalTicketId: string,
    position: typeof this.monitoredPositions extends Map<string, infer T> ? T : never,
    currentPrice: number
  ): Promise<void> {
    const hedges = this.hedgePositions.get(originalTicketId);
    if (!hedges || hedges.length === 0) return;

    // Calculate current loss on original position
    let currentLoss: number;
    if (position.type === 'BUY') {
      currentLoss = position.openPrice - currentPrice;
    } else {
      currentLoss = currentPrice - position.openPrice;
    }

    // Calculate recovery percentage
    const lossPercentage = currentLoss / position.lossDistance;

    // Check if original position has recovered enough
    if (this.config.closeHedgeWhenRecovery && lossPercentage <= (1 - this.config.recoveryThreshold)) {
      console.log(`🎯 Original position ${originalTicketId} recovered ${((1 - lossPercentage) * 100).toFixed(1)}% - closing hedge`);

      // Close all hedges for this position
      for (const hedge of hedges) {
        if (hedge.status === 'ACTIVE') {
          await this.closeHedge(hedge);
        }
      }

      // Mark original as no longer hedged (allow re-hedge if needed)
      position.hasHedged = false;
    }
  }

  /**
   * Close a hedge position
   */
  private async closeHedge(hedge: HedgePosition): Promise<void> {
    try {
      const success = await orderManager.closePosition(parseInt(hedge.ticketId));
      
      if (success) {
        hedge.status = 'CLOSED';
        console.log(`✅ HEDGE CLOSED: Ticket ${hedge.ticketId} for original ${hedge.originalTicketId}`);
      } else {
        console.log(`❌ Failed to close hedge ${hedge.ticketId}`);
      }
    } catch (error) {
      console.error(`❌ Error closing hedge ${hedge.ticketId}:`, error);
    }
  }

  /**
   * Force exit a position (when max loss threshold reached)
   */
  private async forceExitPosition(
    originalTicketId: string,
    position: typeof this.monitoredPositions extends Map<string, infer T> ? T : never
  ): Promise<void> {
    try {
      console.log(`🚨 Force exiting position ${originalTicketId} due to max loss threshold`);
      
      // Close original position
      await orderManager.closePosition(parseInt(originalTicketId));
      
      // Close any existing hedges
      const hedges = this.hedgePositions.get(originalTicketId) || [];
      for (const hedge of hedges) {
        if (hedge.status === 'ACTIVE') {
          await this.closeHedge(hedge);
        }
      }

      // Remove from monitoring
      this.removePositionFromMonitor(originalTicketId);

    } catch (error) {
      console.error(`❌ Error force exiting position ${originalTicketId}:`, error);
    }
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<HedgeConfig>): void {
    this.config = { ...this.config, ...config };
    console.log('✅ AI Reversal Hedging Manager config updated:', this.config);
  }

  /**
   * Get configuration
   */
  getConfig(): HedgeConfig {
    return { ...this.config };
  }

  /**
   * Get status
   */
  getStatus(): any {
    let totalHedges = 0;
    let activeHedges = 0;
    const totalMonitored = this.monitoredPositions.size;

    for (const hedges of this.hedgePositions.values()) {
      totalHedges += hedges.length;
      activeHedges += hedges.filter(h => h.status === 'ACTIVE').length;
    }

    return {
      enabled: this.config.enabled,
      monitoredPositions: totalMonitored,
      totalHedgePositions: totalHedges,
      activeHedgePositions: activeHedges,
      config: this.config
    };
  }

  /**
   * Get all hedge positions
   */
  getHedgePositions(): HedgePosition[] {
    const allHedges: HedgePosition[] = [];
    for (const hedges of this.hedgePositions.values()) {
      allHedges.push(...hedges);
    }
    return allHedges;
  }

  /**
   * Get monitored positions
   */
  getMonitoredPositions(): any[] {
    return Array.from(this.monitoredPositions.values());
  }
}

export const aiReversalHedgingManager = new AIReversalHedgingManager();
