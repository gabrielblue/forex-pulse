/**
 * Smart Hedging Manager - Intelligent Hedge Position Management
 * Analyzes market conditions to determine which side of a hedge to close
 * when market direction changes, and when to unwind hedges profitably
 */

import { exnessAPI } from './exnessApi';
import { smartMoneyAnalyzer, SMCAnalysis, CandleData } from './smartMoneyAnalyzer';
import { multiTimeframeAnalyzer, MultiTimeframeAnalysis } from './multiTimeframeAnalyzer';

export interface HedgePosition {
  ticketId: string;
  symbol: string;
  type: 'BUY' | 'SELL';
  entryPrice: number;
  currentPrice: number;
  profit: number;
  stopLoss: number;
  takeProfit: number;
  volume: number;
  openTime: Date;
}

export interface HedgePair {
  symbol: string;
  buyPosition: HedgePosition | null;
  sellPosition: HedgePosition | null;
  netProfit: number;
  isProfitable: boolean;
  marketDirection: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
}

export interface HedgeDecision {
  action: 'CLOSE_BUY' | 'CLOSE_SELL' | 'CLOSE_BOTH' | 'WAIT';
  reason: string;
  confidence: number;
  expectedProfit: number;
}

class SmartHedgingManager {
  private hedgePairs: Map<string, HedgePair> = new Map();
  private analysisCache: Map<string, { analysis: any; timestamp: number }> = new Map();
  private readonly CACHE_DURATION = 30000; // 30 seconds
  private readonly MIN_PROFIT_THRESHOLD = 0.50; // $0.50 minimum profit to consider closing
  private readonly MARKET_CHANGE_THRESHOLD = 0.30; // 30% change in confluence triggers action

  /**
   * Main method to analyze and manage hedge positions
   */
  async analyzeAndManageHedges(positions: any[]): Promise<HedgeDecision[]> {
    const decisions: HedgeDecision[] = [];
    
    // Group positions by symbol into hedge pairs
    const hedgePairs = this.groupPositionsIntoHedges(positions);
    
    for (const [symbol, hedgePair] of hedgePairs) {
      // Skip if not a true hedge (both BUY or both SELL)
      if (!hedgePair.buyPosition || !hedgePair.sellPosition) {
        continue;
      }

      // Analyze current market conditions
      const marketAnalysis = await this.analyzeMarketDirection(symbol);
      
      // Update hedge pair with market direction
      hedgePair.marketDirection = marketAnalysis.direction;
      
      // Calculate net profit/loss
      hedgePair.netProfit = (hedgePair.buyPosition?.profit || 0) + (hedgePair.sellPosition?.profit || 0);
      hedgePair.isProfitable = hedgePair.netProfit > this.MIN_PROFIT_THRESHOLD;

      // Determine best action
      const decision = await this.determineBestAction(hedgePair, marketAnalysis);
      decisions.push(decision);
    }

    return decisions;
  }

  /**
   * Group positions into hedge pairs by symbol
   */
  private groupPositionsIntoHedges(positions: any[]): Map<string, HedgePair> {
    const hedgePairs = new Map<string, HedgePair>();

    for (const position of positions) {
      const symbol = position.symbol;
      
      if (!hedgePairs.has(symbol)) {
        hedgePairs.set(symbol, {
          symbol,
          buyPosition: null,
          sellPosition: null,
          netProfit: 0,
          isProfitable: false,
          marketDirection: 'NEUTRAL'
        });
      }

      const hedgePair = hedgePairs.get(symbol)!;
      
      // Update current prices
      position.currentPrice = position.type === 'BUY' 
        ? position.currentPrice 
        : position.currentPrice;

      if (position.type === 'BUY') {
        hedgePair.buyPosition = this.mapPositionToHedgePosition(position);
      } else if (position.type === 'SELL') {
        hedgePair.sellPosition = this.mapPositionToHedgePosition(position);
      }
    }

    return hedgePairs;
  }

  /**
   * Map MT5 position to HedgePosition format
   */
  private mapPositionToHedgePosition(position: any): HedgePosition {
    return {
      ticketId: position.ticket?.toString() || position.ticketId,
      symbol: position.symbol,
      type: position.type?.toUpperCase() as 'BUY' | 'SELL',
      entryPrice: position.entryPrice || position.openPrice,
      currentPrice: position.currentPrice || position.closePrice || position.openPrice,
      profit: position.profit || 0,
      stopLoss: position.stopLoss || 0,
      takeProfit: position.takeProfit || 0,
      volume: position.volume || 0.01,
      openTime: new Date(position.openTime || Date.now())
    };
  }

  /**
   * Analyze market direction using SMC and multi-timeframe analysis
   */
  private async analyzeMarketDirection(symbol: string): Promise<{
    direction: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
    confidence: number;
    confluenceScore: number;
    trendStrength: number;
  }> {
    // Check cache first
    const cacheKey = `${symbol}_marketDirection`;
    const cached = this.analysisCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < this.CACHE_DURATION) {
      return cached.analysis;
    }

    try {
      // Get current price
      const price = await exnessAPI.getCurrentPrice(symbol);
      if (!price) {
        return { direction: 'NEUTRAL', confidence: 0, confluenceScore: 0, trendStrength: 0 };
      }

      // Get candle data for analysis
      const candles = await exnessAPI.getHistoricalData(symbol, '15m', 50);
      if (!candles || candles.length < 20) {
        return { direction: 'NEUTRAL', confidence: 0, confluenceScore: 0, trendStrength: 0 };
      }

      const candleData: CandleData[] = candles.map((bar: any) => ({
        open: bar.open,
        high: bar.high,
        low: bar.low,
        close: bar.close,
        volume: bar.tick_volume,
        timestamp: new Date(bar.time * 1000)
      }));

      // Run SMC analysis
      const smcAnalysis = await smartMoneyAnalyzer.analyze(candleData, price.bid, symbol);
      
      // Run multi-timeframe analysis
      const mtfAnalysis = await multiTimeframeAnalyzer.analyzeSymbol(symbol, price.bid);

      // Calculate overall direction
      let bullishScore = 0;
      let bearishScore = 0;

      // SMC analysis contribution
      if (smcAnalysis.tradeBias === 'BUY') {
        bullishScore += smcAnalysis.confluenceScore;
      } else if (smcAnalysis.tradeBias === 'SELL') {
        bearishScore += smcAnalysis.confluenceScore;
      }

      // Market structure contribution
      if (smcAnalysis.marketStructure.trend === 'BULLISH') {
        bullishScore += 25;
      } else if (smcAnalysis.marketStructure.trend === 'BEARISH') {
        bearishScore += 25;
      }

      // Multi-timeframe bias contribution
      if (mtfAnalysis.overallBias === 'BUY') {
        bullishScore += mtfAnalysis.confluenceScore;
      } else if (mtfAnalysis.overallBias === 'SELL') {
        bearishScore += mtfAnalysis.confluenceScore;
      }

      // Determine direction
      let direction: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
      let confidence = 0;
      const totalScore = bullishScore + bearishScore;

      if (totalScore > 0) {
        const bullishRatio = bullishScore / totalScore;
        const bearishRatio = bearishScore / totalScore;

        if (bullishRatio > 0.6) {
          direction = 'BULLISH';
          confidence = bullishRatio * 100;
        } else if (bearishRatio > 0.6) {
          direction = 'BEARISH';
          confidence = bearishRatio * 100;
        } else {
          direction = 'NEUTRAL';
          confidence = Math.abs(bullishRatio - bearishRatio) * 100;
        }
      } else {
        direction = 'NEUTRAL';
        confidence = 0;
      }

      const result = {
        direction,
        confidence,
        confluenceScore: Math.max(smcAnalysis.confluenceScore, mtfAnalysis.confluenceScore),
        trendStrength: mtfAnalysis.confluenceScore
      };

      // Cache result
      this.analysisCache.set(cacheKey, {
        analysis: result,
        timestamp: Date.now()
      });

      return result;
    } catch (error) {
      console.error(`❌ HedgeManager: Failed to analyze market direction for ${symbol}:`, error);
      return { direction: 'NEUTRAL', confidence: 0, confluenceScore: 0, trendStrength: 0 };
    }
  }

  /**
   * Determine the best action for a hedge pair based on market conditions
   */
  private async determineBestAction(
    hedgePair: HedgePair,
    marketAnalysis: { direction: 'BULLISH' | 'BEARISH' | 'NEUTRAL'; confidence: number; confluenceScore: number }
  ): Promise<HedgeDecision> {
    const { buyPosition, sellPosition } = hedgePair;

    if (!buyPosition || !sellPosition) {
      return {
        action: 'WAIT',
        reason: 'Not a complete hedge pair',
        confidence: 0,
        expectedProfit: 0
      };
    }

    // Case 1: Market is BULLISH - Close SELL position, keep BUY
    if (marketAnalysis.direction === 'BULLISH' && marketAnalysis.confidence > 50) {
      // Check if SELL is losing
      if (sellPosition.profit < 0) {
        const potentialRecovery = Math.abs(sellPosition.profit);
        return {
          action: 'CLOSE_SELL',
          reason: `Market turning BULLISH (${marketAnalysis.confidence.toFixed(0)}% confidence). Close losing SELL to reduce losses and let BUY profit.`,
          confidence: marketAnalysis.confidence,
          expectedProfit: potentialRecovery
        };
      }

      // Even if profitable, close SELL to maximize BUY potential
      if (sellPosition.profit > 0) {
        return {
          action: 'CLOSE_SELL',
          reason: `Market strongly BULLISH (${marketAnalysis.confidence.toFixed(0)}% confidence). Close profitable SELL to let BUY run.`,
          confidence: marketAnalysis.confidence,
          expectedProfit: sellPosition.profit
        };
      }
    }

    // Case 2: Market is BEARISH - Close BUY position, keep SELL
    if (marketAnalysis.direction === 'BEARISH' && marketAnalysis.confidence > 50) {
      if (buyPosition.profit < 0) {
        const potentialRecovery = Math.abs(buyPosition.profit);
        return {
          action: 'CLOSE_BUY',
          reason: `Market turning BEARISH (${marketAnalysis.confidence.toFixed(0)}% confidence). Close losing BUY to reduce losses and let SELL profit.`,
          confidence: marketAnalysis.confidence,
          expectedProfit: potentialRecovery
        };
      }

      if (buyPosition.profit > 0) {
        return {
          action: 'CLOSE_BUY',
          reason: `Market strongly BEARISH (${marketAnalysis.confidence.toFixed(0)}% confidence). Close profitable BUY to let SELL run.`,
          confidence: marketAnalysis.confidence,
          expectedProfit: buyPosition.profit
        };
      }
    }

    // Case 3: Hedge is profitable overall - Consider closing both
    if (hedgePair.isProfitable && hedgePair.netProfit > this.MIN_PROFIT_THRESHOLD) {
      return {
        action: 'CLOSE_BOTH',
        reason: `Hedge pair is profitable ($${hedgePair.netProfit.toFixed(2)}). Take profit and exit position.`,
        confidence: 75,
        expectedProfit: hedgePair.netProfit
      };
    }

    // Case 4: One side is significantly more profitable
    const buyProfitRatio = buyPosition.profit / Math.max(Math.abs(buyPosition.profit), 1);
    const sellProfitRatio = sellPosition.profit / Math.max(Math.abs(sellPosition.profit), 1);

    if (buyProfitRatio > sellProfitRatio * 2 && buyPosition.profit > 0) {
      return {
        action: 'CLOSE_SELL',
        reason: `BUY is significantly more profitable (${buyProfitRatio.toFixed(1)}x). Close SELL to free up margin and reduce hedging drag.`,
        confidence: 60,
        expectedProfit: Math.abs(sellPosition.profit)
      };
    }

    if (sellProfitRatio > buyProfitRatio * 2 && sellPosition.profit > 0) {
      return {
        action: 'CLOSE_BUY',
        reason: `SELL is significantly more profitable (${sellProfitRatio.toFixed(1)}x). Close BUY to free up margin and reduce hedging drag.`,
        confidence: 60,
        expectedProfit: Math.abs(buyPosition.profit)
      };
    }

    // Default: Wait for clearer signals
    return {
      action: 'WAIT',
      reason: `Market direction unclear (${marketAnalysis.direction}) or hedge not ready for action. Net P&L: $${hedgePair.netProfit.toFixed(2)}`,
      confidence: Math.max(marketAnalysis.confidence, 30),
      expectedProfit: 0
    };
  }

  /**
   * Execute hedge management decision
   */
  async executeDecision(decision: HedgeDecision, symbol: string): Promise<boolean> {
    try {
      // Get current positions for this symbol
      const positions = await exnessAPI.getPositions();
      const symbolPositions = (positions || []).filter((p: any) => p.symbol === symbol);

      switch (decision.action) {
        case 'CLOSE_BUY': {
          const buyPos = symbolPositions.find((p: any) => p.type?.toLowerCase() === 'buy');
          if (buyPos) {
            await exnessAPI.closePosition(buyPos.ticket);
            console.log(`🪓 HedgeManager: Closed BUY position ${buyPos.ticket} - ${decision.reason}`);
            return true;
          }
          break;
        }

        case 'CLOSE_SELL': {
          const sellPos = symbolPositions.find((p: any) => p.type?.toLowerCase() === 'sell');
          if (sellPos) {
            await exnessAPI.closePosition(sellPos.ticket);
            console.log(`🪓 HedgeManager: Closed SELL position ${sellPos.ticket} - ${decision.reason}`);
            return true;
          }
          break;
        }

        case 'CLOSE_BOTH': {
          const buyToClose = symbolPositions.find((p: any) => p.type?.toLowerCase() === 'buy');
          const sellToClose = symbolPositions.find((p: any) => p.type?.toLowerCase() === 'sell');
          if (buyToClose) await exnessAPI.closePosition(buyToClose.ticket);
          if (sellToClose) await exnessAPI.closePosition(sellToClose.ticket);
          console.log(`🪓 HedgeManager: Closed both positions for ${symbol} - ${decision.reason}`);
          return true;
        }

        case 'WAIT':
          console.log(`⏳ HedgeManager: Waiting for ${symbol} - ${decision.reason}`);
          return true;
      }

      return false;
    } catch (error) {
      console.error(`❌ HedgeManager: Failed to execute decision for ${symbol}:`, error);
      return false;
    }
  }

  /**
   * Check if a symbol has a hedge pair
   */
  hasHedgePair(symbol: string): boolean {
    return this.hedgePairs.has(symbol);
  }

  /**
   * Get hedge pair info for a symbol
   */
  getHedgePair(symbol: string): HedgePair | undefined {
    return this.hedgePairs.get(symbol);
  }

  /**
   * Clear analysis cache
   */
  clearCache(): void {
    this.analysisCache.clear();
    console.log('🧹 HedgeManager: Analysis cache cleared');
  }
}

export const smartHedgingManager = new SmartHedgingManager();
