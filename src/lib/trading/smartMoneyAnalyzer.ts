/**
 * Smart Money Concepts (SMC) Analyzer - ChartLord AI Style
 * Detects institutional trading patterns: Order Blocks, FVGs, Liquidity Zones, BOS/CHoCH
 */

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
   * Main analysis function - ChartLord style SMC analysis
   */
  analyze(candles: CandleData[], currentPrice: number): SMCAnalysis {
    if (candles.length < 20) {
      return this.getEmptyAnalysis();
    }

    this.priceHistory = candles;

    // Detect all SMC components
    const orderBlocks = this.detectOrderBlocks(candles);
    const fairValueGaps = this.detectFairValueGaps(candles, currentPrice);
    const liquidityZones = this.detectLiquidityZones(candles);
    const marketStructure = this.analyzeMarketStructure(candles);

    // Calculate confluence
    const { score, factors, bias, entryZone, invalidation } = this.calculateConfluence(
      orderBlocks,
      fairValueGaps,
      liquidityZones,
      marketStructure,
      currentPrice
    );

    return {
      orderBlocks,
      fairValueGaps,
      liquidityZones,
      marketStructure,
      confluenceScore: score,
      confluenceFactors: factors,
      tradeBias: bias,
      entryZone,
      invalidationLevel: invalidation
    };
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
        if (moveStrength > 0.1) { // 0.1% minimum move
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
        if (moveStrength > 0.1) {
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
    return orderBlocks
      .filter(ob => ob.strength > 30)
      .slice(-10);
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
    return fvgs.filter(fvg => !fvg.filled).slice(-5);
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

    return zones.filter(z => z.strength >= 50).slice(-6);
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
   * Calculate Confluence Score - ChartLord's 8-10 factor requirement
   */
  private calculateConfluence(
    orderBlocks: OrderBlock[],
    fvgs: FairValueGap[],
    liquidityZones: LiquidityZone[],
    structure: MarketStructure,
    currentPrice: number
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

    // Calculate final score and bias
    const totalPoints = Math.max(bullishPoints, bearishPoints);
    const score = Math.min(totalPoints, 100);
    
    let bias: 'BUY' | 'SELL' | 'NEUTRAL' = 'NEUTRAL';
    let entryZone: { high: number; low: number } | null = null;
    let invalidation: number | null = null;

    if (bullishPoints > bearishPoints && bullishPoints >= 40) {
      bias = 'BUY';
      if (nearBullishOB) {
        entryZone = { high: nearBullishOB.high, low: nearBullishOB.low };
        invalidation = nearBullishOB.low * 0.998; // Just below OB
      }
    } else if (bearishPoints > bullishPoints && bearishPoints >= 40) {
      bias = 'SELL';
      if (nearBearishOB) {
        entryZone = { high: nearBearishOB.high, low: nearBearishOB.low };
        invalidation = nearBearishOB.high * 1.002; // Just above OB
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
