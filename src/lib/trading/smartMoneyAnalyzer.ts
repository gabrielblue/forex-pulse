/**
 * Smart Money Concepts (SMC) Analyzer - ChartLord AI Style
 * Detects institutional trading patterns: Order Blocks, FVGs, Liquidity Zones, BOS/CHoCH
 * Enhanced with news sentiment analysis for better market direction prediction
 */

import { newsSentimentAnalyzer, NewsSentimentAnalysis } from './newsSentimentAnalyzer';
import { newsImpactPredictor } from './newsImpactPredictor';

export interface OrderBlock {
  type: 'BULLISH' | 'BEARISH';
  high: number;
  low: number;
  timestamp: Date;
  strength: number; // 0-100
  tested: boolean;
}

export interface FairValueGap {
  type: 'BULLISH' | 'BEARISH';
  high: number;
  low: number;
  midpoint: number;
  timestamp: Date;
  filled: boolean;
  fillPercentage: number;
}

export interface LiquidityZone {
  type: 'BUYSIDE' | 'SELLSIDE';
  level: number;
  strength: number;
  sweeps: number;
  timestamp: Date;
}

export interface MarketStructure {
  trend: 'BULLISH' | 'BEARISH' | 'RANGING';
  lastBOS: { price: number; type: 'BULLISH' | 'BEARISH'; timestamp: Date } | null;
  lastCHoCH: { price: number; type: 'BULLISH' | 'BEARISH'; timestamp: Date } | null;
  swingHigh: number;
  swingLow: number;
}

export interface SMCAnalysis {
  orderBlocks: OrderBlock[];
  fairValueGaps: FairValueGap[];
  liquidityZones: LiquidityZone[];
  marketStructure: MarketStructure;
  newsSentiment?: {
    overallSentiment: number;
    marketDirection: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
    confidence: number;
    impactScore: number;
  };
  confluenceScore: number;
  confluenceFactors: string[];
  tradeBias: 'BUY' | 'SELL' | 'NEUTRAL';
  entryZone: { high: number; low: number } | null;
  invalidationLevel: number | null;
}

export interface CandleData {
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  timestamp: Date;
}

class SmartMoneyAnalyzer {
  private priceHistory: CandleData[] = [];
  private orderBlocks: OrderBlock[] = [];
  private fairValueGaps: FairValueGap[] = [];
  private liquidityZones: LiquidityZone[] = [];

  /**
   * Main analysis function - ChartLord style SMC analysis enhanced with news sentiment
    */
   async analyze(candles: CandleData[], currentPrice: number, symbol: string = 'UNKNOWN'): Promise<SMCAnalysis> {
    if (!candles || candles.length < 20) {
      return this.getEmptyAnalysis();
    }

    this.priceHistory = candles;

    // Detect all SMC components
    const orderBlocks = this.detectOrderBlocks(candles);
    const fairValueGaps = this.detectFairValueGaps(candles, currentPrice);
    const liquidityZones = this.detectLiquidityZones(candles);
    const marketStructure = this.analyzeMarketStructure(candles);

    // Get news sentiment analysis
    let newsSentiment;
    try {
      const sentimentAnalysis = await newsSentimentAnalyzer.getNewsSentiment(symbol);
      newsSentiment = {
        overallSentiment: sentimentAnalysis.overallSentiment,
        marketDirection: sentimentAnalysis.marketDirection,
        confidence: sentimentAnalysis.confidence,
        impactScore: sentimentAnalysis.confidence / 100 // Normalized 0-1
      };
    } catch (error) {
      console.warn(`⚠️ Failed to get news sentiment for ${symbol}:`, error);
      newsSentiment = {
        overallSentiment: 0,
        marketDirection: 'NEUTRAL' as const,
        confidence: 0,
        impactScore: 0
      };
    }

    // Analyze volatility patterns for news impact prediction
    newsImpactPredictor.analyzeVolatilityPatterns(symbol, candles);

    // Calculate confluence with news sentiment
    const { score, factors, bias, entryZone, invalidation } = this.calculateConfluence(
      orderBlocks,
      fairValueGaps,
      liquidityZones,
      marketStructure,
      currentPrice,
      symbol,
      candles,
      newsSentiment
    );

    const result = {
      orderBlocks,
      fairValueGaps,
      liquidityZones,
      marketStructure,
      newsSentiment,
      confluenceScore: score,
      confluenceFactors: factors,
      tradeBias: bias,
      entryZone,
      invalidationLevel: invalidation
    };

    console.log(`🔍 SMC Analysis Result for ${currentPrice ? 'price_' + currentPrice.toFixed(2) : 'unknown'}: bias=${bias}, score=${score}, entryZone=${!!entryZone}, newsSentiment=${newsSentiment.overallSentiment.toFixed(2)}, factors=${factors.length > 0 ? factors.join(', ') : 'none'}`);
    if (factors.length > 0) {
      console.log(`📊 Factors: ${factors.join(' | ')}`);
    }
    return result;
  }

  /**
   * Detect Order Blocks - Areas where institutions placed large orders
   */
  private detectOrderBlocks(candles: CandleData[]): OrderBlock[] {
    const orderBlocks: OrderBlock[] = [];
    
    for (let i = 2; i < candles.length - 1; i++) {
      const prev = candles[i - 1];
      const curr = candles[i];
      const next = candles[i + 1];

      // Bullish Order Block: Down candle followed by strong up move
      if (this.isBearishCandle(prev) && this.isBullishCandle(curr) && this.isBullishCandle(next)) {
        const moveStrength = Math.abs(next.close - prev.close) / prev.close * 100;
        if (moveStrength > 0.05) { // 0.05% minimum move for 15m charts
          orderBlocks.push({
            type: 'BULLISH',
            high: prev.high,
            low: prev.low,
            timestamp: prev.timestamp,
            strength: Math.min(moveStrength * 10, 100),
            tested: false
          });
        }
      }

      // Bearish Order Block: Up candle followed by strong down move
      if (this.isBullishCandle(prev) && this.isBearishCandle(curr) && this.isBearishCandle(next)) {
        const moveStrength = Math.abs(prev.close - next.close) / prev.close * 100;
        if (moveStrength > 0.05) {
          orderBlocks.push({
            type: 'BEARISH',
            high: prev.high,
            low: prev.low,
            timestamp: prev.timestamp,
            strength: Math.min(moveStrength * 10, 100),
            tested: false
          });
        }
      }
    }

    // Keep only recent and strong order blocks
    const filteredOBs = orderBlocks
      .filter(ob => ob.strength > 20)
      .slice(-10);

    console.log(`🔍 Order Blocks detected: ${filteredOBs.length} (from ${orderBlocks.length} total)`);
    return filteredOBs;
  }

  /**
   * Detect Fair Value Gaps (FVGs) - Imbalanced price areas
   */
  private detectFairValueGaps(candles: CandleData[], currentPrice: number): FairValueGap[] {
    const fvgs: FairValueGap[] = [];

    for (let i = 2; i < candles.length; i++) {
      const candle1 = candles[i - 2];
      const candle2 = candles[i - 1];
      const candle3 = candles[i];

      // Bullish FVG: Gap between candle1 high and candle3 low
      if (candle3.low > candle1.high) {
        const gapSize = candle3.low - candle1.high;
        const filled = currentPrice <= candle3.low;
        const fillPercentage = filled ? 
          Math.min(100, ((candle3.low - currentPrice) / gapSize) * 100) : 0;

        fvgs.push({
          type: 'BULLISH',
          high: candle3.low,
          low: candle1.high,
          midpoint: (candle3.low + candle1.high) / 2,
          timestamp: candle2.timestamp,
          filled: fillPercentage >= 50,
          fillPercentage
        });
      }

      // Bearish FVG: Gap between candle3 high and candle1 low
      if (candle1.low > candle3.high) {
        const gapSize = candle1.low - candle3.high;
        const filled = currentPrice >= candle3.high;
        const fillPercentage = filled ?
          Math.min(100, ((currentPrice - candle3.high) / gapSize) * 100) : 0;

        fvgs.push({
          type: 'BEARISH',
          high: candle1.low,
          low: candle3.high,
          midpoint: (candle1.low + candle3.high) / 2,
          timestamp: candle2.timestamp,
          filled: fillPercentage >= 50,
          fillPercentage
        });
      }
    }

    // Return unfilled FVGs (tradeable)
    const unfilledFVGs = fvgs.filter(fvg => !fvg.filled).slice(-5);
    console.log(`🔍 FVGs detected: ${unfilledFVGs.length} unfilled (from ${fvgs.length} total)`);
    return unfilledFVGs;
  }

  /**
   * Detect Liquidity Zones - Areas with clustered stop losses
   */
  private detectLiquidityZones(candles: CandleData[]): LiquidityZone[] {
    const zones: LiquidityZone[] = [];
    const highs: number[] = [];
    const lows: number[] = [];

    // Collect swing highs and lows
    for (let i = 2; i < candles.length - 2; i++) {
      const curr = candles[i];
      const isSwingHigh = curr.high > candles[i-1].high && curr.high > candles[i-2].high &&
                          curr.high > candles[i+1].high && curr.high > candles[i+2].high;
      const isSwingLow = curr.low < candles[i-1].low && curr.low < candles[i-2].low &&
                         curr.low < candles[i+1].low && curr.low < candles[i+2].low;

      if (isSwingHigh) highs.push(curr.high);
      if (isSwingLow) lows.push(curr.low);
    }

    // Cluster similar levels as liquidity zones
    const clusterHighs = this.clusterLevels(highs);
    const clusterLows = this.clusterLevels(lows);

    clusterHighs.forEach(level => {
      zones.push({
        type: 'BUYSIDE',
        level,
        strength: Math.min(highs.filter(h => Math.abs(h - level) / level < 0.001).length * 25, 100),
        sweeps: 0,
        timestamp: new Date()
      });
    });

    clusterLows.forEach(level => {
      zones.push({
        type: 'SELLSIDE',
        level,
        strength: Math.min(lows.filter(l => Math.abs(l - level) / level < 0.001).length * 25, 100),
        sweeps: 0,
        timestamp: new Date()
      });
    });

    const filteredZones = zones.filter(z => z.strength >= 30).slice(-6);
    console.log(`🔍 Liquidity Zones detected: ${filteredZones.length} (from ${zones.length} total)`);
    return filteredZones;
  }

  /**
   * Analyze Market Structure - BOS and CHoCH detection
   */
  private analyzeMarketStructure(candles: CandleData[]): MarketStructure {
    if (candles.length < 10) {
      return {
        trend: 'RANGING',
        lastBOS: null,
        lastCHoCH: null,
        swingHigh: Math.max(...candles.map(c => c.high)),
        swingLow: Math.min(...candles.map(c => c.low))
      };
    }

    const swingPoints = this.findSwingPoints(candles);
    let trend: 'BULLISH' | 'BEARISH' | 'RANGING' = 'RANGING';
    let lastBOS: MarketStructure['lastBOS'] = null;
    let lastCHoCH: MarketStructure['lastCHoCH'] = null;

    // Analyze swing point sequence for trend and BOS/CHoCH
    if (swingPoints.highs.length >= 2 && swingPoints.lows.length >= 2) {
      const recentHighs = swingPoints.highs.slice(-3);
      const recentLows = swingPoints.lows.slice(-3);

      // Higher highs and higher lows = Bullish
      const higherHighs = recentHighs.length >= 2 && 
        recentHighs[recentHighs.length - 1].price > recentHighs[recentHighs.length - 2].price;
      const higherLows = recentLows.length >= 2 &&
        recentLows[recentLows.length - 1].price > recentLows[recentLows.length - 2].price;

      // Lower highs and lower lows = Bearish
      const lowerHighs = recentHighs.length >= 2 &&
        recentHighs[recentHighs.length - 1].price < recentHighs[recentHighs.length - 2].price;
      const lowerLows = recentLows.length >= 2 &&
        recentLows[recentLows.length - 1].price < recentLows[recentLows.length - 2].price;

      if (higherHighs && higherLows) {
        trend = 'BULLISH';
        lastBOS = {
          price: recentHighs[recentHighs.length - 1].price,
          type: 'BULLISH',
          timestamp: recentHighs[recentHighs.length - 1].timestamp
        };
      } else if (lowerHighs && lowerLows) {
        trend = 'BEARISH';
        lastBOS = {
          price: recentLows[recentLows.length - 1].price,
          type: 'BEARISH',
          timestamp: recentLows[recentLows.length - 1].timestamp
        };
      }

      // CHoCH detection (trend reversal)
      if (trend === 'BULLISH' && lowerLows) {
        lastCHoCH = {
          price: recentLows[recentLows.length - 1].price,
          type: 'BEARISH',
          timestamp: recentLows[recentLows.length - 1].timestamp
        };
      } else if (trend === 'BEARISH' && higherHighs) {
        lastCHoCH = {
          price: recentHighs[recentHighs.length - 1].price,
          type: 'BULLISH',
          timestamp: recentHighs[recentHighs.length - 1].timestamp
        };
      }
    }

    return {
      trend,
      lastBOS,
      lastCHoCH,
      swingHigh: Math.max(...candles.slice(-20).map(c => c.high)),
      swingLow: Math.min(...candles.slice(-20).map(c => c.low))
    };
  }

  /**
   * Calculate Confluence Score - ChartLord's 8-10 factor requirement enhanced with news sentiment
    */
   private calculateConfluence(
     orderBlocks: OrderBlock[],
     fvgs: FairValueGap[],
     liquidityZones: LiquidityZone[],
     structure: MarketStructure,
     currentPrice: number,
     symbol: string = '',
     candles: CandleData[] = [],
     newsSentiment?: { overallSentiment: number; marketDirection: 'BULLISH' | 'BEARISH' | 'NEUTRAL'; confidence: number; impactScore: number }
   ): { score: number; factors: string[]; bias: 'BUY' | 'SELL' | 'NEUTRAL'; entryZone: { high: number; low: number } | null; invalidation: number | null } {
    const factors: string[] = [];
    let bullishPoints = 0;
    let bearishPoints = 0;

    // Factor 1: Market Structure Trend
    if (structure.trend === 'BULLISH') {
      bullishPoints += 15;
      factors.push('✅ Bullish market structure');
    } else if (structure.trend === 'BEARISH') {
      bearishPoints += 15;
      factors.push('✅ Bearish market structure');
    }

    // Factor 2: Recent BOS
    if (structure.lastBOS) {
      if (structure.lastBOS.type === 'BULLISH') {
        bullishPoints += 12;
        factors.push('✅ Bullish Break of Structure');
      } else {
        bearishPoints += 12;
        factors.push('✅ Bearish Break of Structure');
      }
    }

    // Factor 3: Price at Order Block
    const nearBullishOB = orderBlocks.find(ob => 
      ob.type === 'BULLISH' && 
      currentPrice >= ob.low && 
      currentPrice <= ob.high * 1.001
    );
    const nearBearishOB = orderBlocks.find(ob => 
      ob.type === 'BEARISH' && 
      currentPrice <= ob.high && 
      currentPrice >= ob.low * 0.999
    );

    if (nearBullishOB) {
      bullishPoints += 15;
      factors.push(`✅ Price at bullish order block (${nearBullishOB.strength.toFixed(0)}% strength)`);
    }
    if (nearBearishOB) {
      bearishPoints += 15;
      factors.push(`✅ Price at bearish order block (${nearBearishOB.strength.toFixed(0)}% strength)`);
    }

    // Factor 4: Fair Value Gap present
    const bullishFVG = fvgs.find(fvg => fvg.type === 'BULLISH' && !fvg.filled);
    const bearishFVG = fvgs.find(fvg => fvg.type === 'BEARISH' && !fvg.filled);

    if (bullishFVG && currentPrice <= bullishFVG.high) {
      bullishPoints += 12;
      factors.push('✅ Unfilled bullish FVG below');
    }
    if (bearishFVG && currentPrice >= bearishFVG.low) {
      bearishPoints += 12;
      factors.push('✅ Unfilled bearish FVG above');
    }

    // Factor 5: Liquidity zone nearby
    const buysideLiquidity = liquidityZones.find(z => 
      z.type === 'BUYSIDE' && z.level > currentPrice && (z.level - currentPrice) / currentPrice < 0.01
    );
    const sellsideLiquidity = liquidityZones.find(z => 
      z.type === 'SELLSIDE' && z.level < currentPrice && (currentPrice - z.level) / currentPrice < 0.01
    );

    if (buysideLiquidity) {
      bullishPoints += 10;
      factors.push('✅ Buyside liquidity above (target)');
    }
    if (sellsideLiquidity) {
      bearishPoints += 10;
      factors.push('✅ Sellside liquidity below (target)');
    }

    // Factor 6: No CHoCH against trade direction
    if (!structure.lastCHoCH) {
      factors.push('✅ No Change of Character (clean structure)');
      bullishPoints += 5;
      bearishPoints += 5;
    } else if (structure.lastCHoCH.type === 'BULLISH') {
      bullishPoints += 8;
      factors.push('✅ Bullish CHoCH confirmed');
    } else {
      bearishPoints += 8;
      factors.push('✅ Bearish CHoCH confirmed');
    }

    // Factor 7: Multiple order blocks aligned
    const bullishOBs = orderBlocks.filter(ob => ob.type === 'BULLISH').length;
    const bearishOBs = orderBlocks.filter(ob => ob.type === 'BEARISH').length;

    if (bullishOBs >= 2) {
      bullishPoints += 8;
      factors.push(`✅ ${bullishOBs} bullish order blocks stacked`);
    }
    if (bearishOBs >= 2) {
      bearishPoints += 8;
      factors.push(`✅ ${bearishOBs} bearish order blocks stacked`);
    }

    // Factor 8: Volume confirmation (recent candles)
    const recentCandles = candles.slice(-5);
    const avgVolume = recentCandles.reduce((sum, c) => sum + c.volume, 0) / recentCandles.length;
    const currentVolume = candles[candles.length - 1].volume;
    if (currentVolume > avgVolume * 1.2) {
      factors.push('✅ Above average volume');
      bullishPoints += 3;
      bearishPoints += 3;
    }

    // Factor 9: Price momentum (RSI-like)
    const gains = recentCandles.filter(c => c.close > c.open).length;
    const losses = recentCandles.filter(c => c.close < c.open).length;
    const momentumScore = (gains - losses) / recentCandles.length;
    if (momentumScore > 0.4) {
      bullishPoints += 5;
      factors.push('✅ Strong bullish momentum');
    } else if (momentumScore < -0.4) {
      bearishPoints += 5;
      factors.push('✅ Strong bearish momentum');
    }

    // Factor 10: Market regime (trending vs ranging)
    const priceRange = Math.max(...recentCandles.map(c => c.high)) - Math.min(...recentCandles.map(c => c.low));
    const avgRange = recentCandles.reduce((sum, c) => sum + (c.high - c.low), 0) / recentCandles.length;
    if (priceRange > avgRange * 1.5) {
      factors.push('✅ Trending market regime');
      // Boost points for trending markets
      if (bullishPoints > bearishPoints) bullishPoints += 5;
      if (bearishPoints > bullishPoints) bearishPoints += 5;
    }

    // Factor 11: News sentiment alignment
    if (newsSentiment && newsSentiment.confidence > 30) {
      const sentimentWeight = newsSentiment.impactScore * 15; // Up to 15 points

      if (newsSentiment.marketDirection === 'BULLISH') {
        bullishPoints += sentimentWeight;
        factors.push(`✅ Bullish news sentiment (${(newsSentiment.overallSentiment * 100).toFixed(0)}% sentiment, ${(newsSentiment.confidence).toFixed(0)}% confidence)`);
      } else if (newsSentiment.marketDirection === 'BEARISH') {
        bearishPoints += sentimentWeight;
        factors.push(`✅ Bearish news sentiment (${(newsSentiment.overallSentiment * 100).toFixed(0)}% sentiment, ${(newsSentiment.confidence).toFixed(0)}% confidence)`);
      } else {
        factors.push(`✅ Neutral news sentiment (${(newsSentiment.confidence).toFixed(0)}% confidence)`);
        // Small boost to both sides for neutral but confident news
        bullishPoints += sentimentWeight * 0.3;
        bearishPoints += sentimentWeight * 0.3;
      }
    }

    // Calculate final score and bias
    const totalPoints = Math.max(bullishPoints, bearishPoints);
    const score = Math.min(totalPoints, 100);

    let bias: 'BUY' | 'SELL' | 'NEUTRAL' = 'NEUTRAL';
    let entryZone: { high: number; low: number } | null = null;
    let invalidation: number | null = null;

    console.log(`🔍 SMC Confluence: bullish=${bullishPoints}, bearish=${bearishPoints}, score=${score}, factors=${factors.length}`);

    // Conservative approach: Only trade with genuine high confluence
    // No artificial score boosting for any symbol
if (bullishPoints > bearishPoints && bullishPoints >= 40) {

      bias = 'BUY';
      if (nearBullishOB) {
        entryZone = { high: nearBullishOB.high, low: nearBullishOB.low };
        invalidation = nearBullishOB.low * 0.998; // Just below OB
        console.log(`🔍 BUY entry zone set from bullish OB: ${entryZone.low} - ${entryZone.high}, currentPrice: ${currentPrice}`);
      } else if (fvgs.some(fvg => fvg.type === 'BULLISH' && !fvg.filled)) {
        // Fallback to FVG if no OB but strong confluence
        const fvg = fvgs.find(fvg => fvg.type === 'BULLISH' && !fvg.filled)!;
        entryZone = { high: fvg.high, low: fvg.low };
        invalidation = fvg.low * 0.998;
        console.log(`🔍 BUY entry zone set from bullish FVG: ${entryZone.low} - ${entryZone.high}, currentPrice: ${currentPrice}`);
      } else {
        // Aggressive fallback: Create entry zone from current price if minimal confluence
        const spread = currentPrice * 0.001; // 0.1% spread
        entryZone = { high: currentPrice + spread, low: currentPrice - spread };
        invalidation = currentPrice * 0.995; // 0.5% below current price
        console.log(`🔍 Aggressive BUY entry zone created: ${entryZone.low} - ${entryZone.high} (no OB/FVG but ${bullishPoints} points)`);
      }
    } else if (bearishPoints > bullishPoints && bearishPoints >= 40) {
      bias = 'SELL';
      if (nearBearishOB) {
        entryZone = { high: nearBearishOB.high, low: nearBearishOB.low };
        invalidation = nearBearishOB.high * 1.002; // Just above OB
        console.log(`🔍 SELL entry zone set from bearish OB: ${entryZone.low} - ${entryZone.high}, currentPrice: ${currentPrice}`);
      } else if (fvgs.some(fvg => fvg.type === 'BEARISH' && !fvg.filled)) {
        // Fallback to FVG if no OB but strong confluence
        const fvg = fvgs.find(fvg => fvg.type === 'BEARISH' && !fvg.filled)!;
        entryZone = { high: fvg.high, low: fvg.low };
        invalidation = fvg.high * 1.002;
        console.log(`🔍 SELL entry zone set from bearish FVG: ${entryZone.low} - ${entryZone.high}, currentPrice: ${currentPrice}`);
      } else {
        // Aggressive fallback: Create entry zone from current price if minimal confluence
        const spread = currentPrice * 0.001; // 0.1% spread
        entryZone = { high: currentPrice + spread, low: currentPrice - spread };
        invalidation = currentPrice * 1.005; // 0.5% above current price
        console.log(`🔍 Aggressive SELL entry zone created: ${entryZone.low} - ${entryZone.high} (no OB/FVG but ${bearishPoints} points)`);
      }
    }

    return { score, factors, bias, entryZone, invalidation };
  }

  // Helper methods
  private isBullishCandle(candle: CandleData): boolean {
    return candle.close > candle.open;
  }

  private isBearishCandle(candle: CandleData): boolean {
    return candle.close < candle.open;
  }

  private calculateRSI(candles: CandleData[], period: number = 14): number {
    if (candles.length < period + 1) return 50;

    const gains: number[] = [];
    const losses: number[] = [];

    for (let i = 1; i <= period; i++) {
      const change = candles[candles.length - i].close - candles[candles.length - i - 1].close;
      if (change > 0) gains.push(change);
      else losses.push(-change);
    }

    const avgGain = gains.length > 0 ? gains.reduce((sum, g) => sum + g, 0) / gains.length : 0;
    const avgLoss = losses.length > 0 ? losses.reduce((sum, l) => sum + l, 0) / losses.length : 0;

    if (avgLoss === 0) return 100;
    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
  }

  private calculateATR(candles: CandleData[], period: number = 14): number {
    if (candles.length < period + 1) return 0;

    const trs: number[] = [];
    for (let i = 1; i < candles.length; i++) {
      const high = candles[i].high;
      const low = candles[i].low;
      const prevClose = candles[i-1].close;
      const tr = Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose));
      trs.push(tr);
    }

    return trs.slice(-period).reduce((sum, tr) => sum + tr, 0) / period;
  }

  private clusterLevels(levels: number[]): number[] {
    if (levels.length === 0) return [];
    
    const sorted = [...levels].sort((a, b) => a - b);
    const clusters: number[] = [];
    let clusterStart = sorted[0];
    let clusterSum = sorted[0];
    let clusterCount = 1;

    for (let i = 1; i < sorted.length; i++) {
      if ((sorted[i] - clusterStart) / clusterStart < 0.002) {
        clusterSum += sorted[i];
        clusterCount++;
      } else {
        clusters.push(clusterSum / clusterCount);
        clusterStart = sorted[i];
        clusterSum = sorted[i];
        clusterCount = 1;
      }
    }
    clusters.push(clusterSum / clusterCount);

    return clusters;
  }

  private findSwingPoints(candles: CandleData[]): { 
    highs: { price: number; timestamp: Date }[]; 
    lows: { price: number; timestamp: Date }[] 
  } {
    const highs: { price: number; timestamp: Date }[] = [];
    const lows: { price: number; timestamp: Date }[] = [];

    for (let i = 2; i < candles.length - 2; i++) {
      const curr = candles[i];
      
      if (curr.high > candles[i-1].high && curr.high > candles[i-2].high &&
          curr.high > candles[i+1].high && curr.high > candles[i+2].high) {
        highs.push({ price: curr.high, timestamp: curr.timestamp });
      }
      
      if (curr.low < candles[i-1].low && curr.low < candles[i-2].low &&
          curr.low < candles[i+1].low && curr.low < candles[i+2].low) {
        lows.push({ price: curr.low, timestamp: curr.timestamp });
      }
    }

    return { highs, lows };
  }

  private getEmptyAnalysis(): SMCAnalysis {
    return {
      orderBlocks: [],
      fairValueGaps: [],
      liquidityZones: [],
      marketStructure: {
        trend: 'RANGING',
        lastBOS: null,
        lastCHoCH: null,
        swingHigh: 0,
        swingLow: 0
      },
      confluenceScore: 0,
      confluenceFactors: ['⚠️ Insufficient data for SMC analysis'],
      tradeBias: 'NEUTRAL',
      entryZone: null,
      invalidationLevel: null
    };
  }
}

export const smartMoneyAnalyzer = new SmartMoneyAnalyzer();
