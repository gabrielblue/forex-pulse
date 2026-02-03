/**
 * Multi-Timeframe Analyzer - Analyzes multiple timeframes simultaneously
 * for superior entry timing and market direction prediction
 */

import { exnessAPI } from './exnessApi';
import { smartMoneyAnalyzer, SMCAnalysis, CandleData } from './smartMoneyAnalyzer';
import { newsSentimentAnalyzer } from './newsSentimentAnalyzer';

export interface TimeframeAnalysis {
  timeframe: string;
  candles: CandleData[];
  smcAnalysis: SMCAnalysis;
  trendStrength: number;
  momentumScore: number;
  volatility: number;
  supportResistance: {
    support: number[];
    resistance: number[];
  };
}

export interface MultiTimeframeAnalysis {
  symbol: string;
  currentPrice: number;
  timeframes: TimeframeAnalysis[];
  overallBias: 'BUY' | 'SELL' | 'NEUTRAL';
  confluenceScore: number;
  entryQuality: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR';
  optimalEntryZone: { high: number; low: number } | null;
  riskRewardRatio: number;
  confidence: number;
  analysisTimestamp: Date;
}

export interface TimeframeConfig {
  timeframe: string;
  weight: number; // Importance weight for confluence calculation
  minCandles: number;
  maxCandles: number;
}

class MultiTimeframeAnalyzer {
  private readonly TIMEFRAMES: TimeframeConfig[] = [
    // Entry timeframes - high precision for scalping entries
    { timeframe: '1M', weight: 0.15, minCandles: 50, maxCandles: 200 },
    { timeframe: '5M', weight: 0.2, minCandles: 50, maxCandles: 200 },
    { timeframe: '15M', weight: 0.25, minCandles: 50, maxCandles: 200 },
    { timeframe: '30M', weight: 0.2, minCandles: 50, maxCandles: 200 },
    // Higher timeframes - for market context (optional, graceful failure)
    { timeframe: '1H', weight: 0.15, minCandles: 5, maxCandles: 50 }, // Reduced for reliability
    { timeframe: '4H', weight: 0.05, minCandles: 3, maxCandles: 25 }  // Minimal requirements
  ];

  private analysisCache = new Map<string, { analysis: MultiTimeframeAnalysis; timestamp: number }>();
  private readonly CACHE_DURATION = 30000; // 30 seconds cache

  /**
   * Perform comprehensive multi-timeframe analysis
   */
  async analyzeSymbol(symbol: string, currentPrice: number): Promise<MultiTimeframeAnalysis> {
    const cacheKey = `${symbol}_${currentPrice.toFixed(5)}`;
    const cached = this.analysisCache.get(cacheKey);

    if (cached && (Date.now() - cached.timestamp) < this.CACHE_DURATION) {
      return cached.analysis;
    }

    console.log(`🔍 Starting multi-timeframe analysis for ${symbol}...`);

    const timeframeAnalyses: TimeframeAnalysis[] = [];

    // Filter timeframes based on symbol availability
    let availableTimeframes = this.TIMEFRAMES;

    // Special handling for XAUUSD - skip higher timeframes if gold is not available
    if (symbol === 'XAUUSD') {
      // First try to get data for lower timeframes only
      const lowerTimeframes = this.TIMEFRAMES.filter(tf => !['1H', '4H'].includes(tf.timeframe));
      console.log(`🥇 Analyzing XAUUSD with lower timeframes only (gold higher timeframes may not be available)`);

      // Test if we can get any data at all
      try {
        const testData = await this.fetchTimeframeData(symbol, lowerTimeframes[0]);
        if (testData.length === 0) {
          console.warn(`⚠️ XAUUSD data not available - gold trading likely disabled for this account`);
          return {
            symbol,
            currentPrice,
            timeframes: [],
            overallBias: 'NEUTRAL' as const,
            confluenceScore: 0,
            entryQuality: 'POOR' as const,
            optimalEntryZone: null,
            riskRewardRatio: 1.0,
            confidence: 0,
            analysisTimestamp: new Date()
          };
        }
        // If we can get data, proceed with lower timeframes only
        availableTimeframes = lowerTimeframes;
      } catch (error) {
        console.warn(`⚠️ XAUUSD not available - skipping gold analysis:`, error.message);
        return {
          symbol,
          currentPrice,
          timeframes: [],
          overallBias: 'NEUTRAL' as const,
          confluenceScore: 0,
          entryQuality: 'POOR' as const,
          optimalEntryZone: null,
          riskRewardRatio: 1.0,
          confidence: 0,
          analysisTimestamp: new Date()
        };
      }
    }

    // For forex symbols, test if higher timeframes are available
    if (['EURUSD', 'GBPUSD', 'USDJPY', 'AUDUSD', 'USDCAD', 'USDCHF', 'NZDUSD'].includes(symbol)) {
      // Test if higher timeframes work for this symbol
      try {
        const testHigherTimeframe = await this.fetchTimeframeData(symbol, this.TIMEFRAMES.find(tf => tf.timeframe === '1H')!);
        if (testHigherTimeframe.length === 0) {
          console.log(`📊 Higher timeframes not available for ${symbol} - using lower timeframes only`);
          availableTimeframes = this.TIMEFRAMES.filter(tf => !['1H', '4H'].includes(tf.timeframe));
        }
      } catch (error) {
        console.log(`📊 Higher timeframes failed for ${symbol} - using lower timeframes only: ${error.message}`);
        availableTimeframes = this.TIMEFRAMES.filter(tf => !['1H', '4H'].includes(tf.timeframe));
      }
    }

    // Analyze each timeframe in parallel with graceful failure handling
    const analysisPromises = availableTimeframes.map(async (config) => {
      try {
        const candles = await this.fetchTimeframeData(symbol, config);
        if (candles.length < config.minCandles) {
          // For higher timeframes, be more lenient but still log the issue
          if (['1H', '4H'].includes(config.timeframe)) {
            console.log(`📊 Higher timeframe ${config.timeframe} has limited data (${candles.length} candles) - using for context only`);
          } else {
            console.warn(`⚠️ Insufficient data for ${symbol} ${config.timeframe}: ${candles.length}/${config.minCandles}`);
            return null;
          }
        }

        const smcAnalysis = await smartMoneyAnalyzer.analyze(candles, currentPrice, symbol);
        const trendStrength = this.calculateTrendStrength(candles);
        const momentumScore = this.calculateMomentumScore(candles);
        const volatility = this.calculateVolatility(candles);
        const supportResistance = this.calculateSupportResistance(candles);

        return {
          timeframe: config.timeframe,
          candles,
          smcAnalysis,
          trendStrength,
          momentumScore,
          volatility,
          supportResistance
        } as TimeframeAnalysis;
      } catch (error) {
        // For higher timeframes, log but don't fail completely
        if (['1H', '4H'].includes(config.timeframe)) {
          console.log(`📊 Higher timeframe ${config.timeframe} analysis failed - proceeding without it:`, error.message);
          return null;
        }
        console.error(`❌ Failed to analyze ${symbol} ${config.timeframe}:`, error);
        return null;
      }
    });

    const results = await Promise.all(analysisPromises);
    const validAnalyses = results.filter(analysis => analysis !== null) as TimeframeAnalysis[];

    // Check if we have essential lower timeframe data for entries
    const lowerTimeframeAnalyses = validAnalyses.filter(a => ['1M', '5M', '15M', '30M'].includes(a.timeframe));
    const higherTimeframeAnalyses = validAnalyses.filter(a => ['1H', '4H'].includes(a.timeframe));

    if (lowerTimeframeAnalyses.length === 0) {
      console.warn(`⚠️ No valid lower timeframe analyses for ${symbol} - cannot provide entry signals`);
      return {
        symbol,
        currentPrice,
        timeframes: validAnalyses, // Include any higher timeframe data we might have
        overallBias: 'NEUTRAL' as const,
        confluenceScore: 0,
        entryQuality: 'POOR' as const,
        optimalEntryZone: null,
        riskRewardRatio: 1.0,
        confidence: 0,
        analysisTimestamp: new Date()
      };
    }

    console.log(`📊 Analysis summary: ${lowerTimeframeAnalyses.length} lower timeframes, ${higherTimeframeAnalyses.length} higher timeframes available`);

    // Calculate overall confluence using all valid analyses
    const overallAnalysis = this.calculateOverallConfluence(symbol, currentPrice, validAnalyses);

    // Cache the result
    this.analysisCache.set(cacheKey, {
      analysis: overallAnalysis,
      timestamp: Date.now()
    });

    console.log(`✅ Multi-timeframe analysis complete for ${symbol}: bias=${overallAnalysis.overallBias}, score=${overallAnalysis.confluenceScore}, quality=${overallAnalysis.entryQuality}`);

    return overallAnalysis;
  }

  /**
   * Fetch candle data for specific timeframe
   */
  private async fetchTimeframeData(symbol: string, config: TimeframeConfig): Promise<CandleData[]> {
    try {
      console.log(`📈 Fetching ${config.timeframe} data for ${symbol}, requesting ${config.maxCandles} candles`);
      const bars = await exnessAPI.getHistoricalData(symbol, config.timeframe, config.maxCandles);
      console.log(`📊 Received ${bars?.length || 0} bars for ${symbol} ${config.timeframe}`);

      if (!bars || bars.length === 0) {
        console.warn(`⚠️ No historical data returned for ${symbol} ${config.timeframe} - check bridge connection and date ranges`);
        return [];
      }

      const candles = bars.map((bar: any) => ({
        open: bar.open,
        high: bar.high,
        low: bar.low,
        close: bar.close,
        volume: bar.tick_volume,
        timestamp: new Date(bar.time * 1000)
      }));

      console.log(`✅ Processed ${candles.length} candles for ${symbol} ${config.timeframe}`);
      return candles;
    } catch (error) {
      console.error(`❌ Failed to fetch ${config.timeframe} data for ${symbol}:`, error);
      return [];
    }
  }

  /**
   * Calculate trend strength for a timeframe
   */
  private calculateTrendStrength(candles: CandleData[]): number {
    if (candles.length < 20) return 0;

    const recent = candles.slice(-20);
    const highs = recent.map(c => c.high);
    const lows = recent.map(c => c.low);

    const maxHigh = Math.max(...highs);
    const minLow = Math.min(...lows);
    const currentPrice = recent[recent.length - 1].close;

    // Trend strength based on position within recent range
    const range = maxHigh - minLow;
    if (range === 0) return 0;

    const position = (currentPrice - minLow) / range;

    // Strong uptrend if price is in upper 70% of range
    // Strong downtrend if price is in lower 30% of range
    if (position > 0.7) return Math.min(position * 100, 100);
    if (position < 0.3) return Math.min((1 - position) * -100, -100);

    return 0; // Sideways
  }

  /**
   * Calculate momentum score
   */
  private calculateMomentumScore(candles: CandleData[]): number {
    if (candles.length < 10) return 0;

    const recent = candles.slice(-10);
    let bullishCandles = 0;
    let bearishCandles = 0;

    for (const candle of recent) {
      if (candle.close > candle.open) bullishCandles++;
      else if (candle.close < candle.open) bearishCandles++;
    }

    const momentum = (bullishCandles - bearishCandles) / recent.length;
    return momentum * 100; // -100 to +100
  }

  /**
   * Calculate volatility
   */
  private calculateVolatility(candles: CandleData[]): number {
    if (candles.length < 10) return 0;

    const returns = [];
    for (let i = 1; i < candles.length; i++) {
      const ret = (candles[i].close - candles[i-1].close) / candles[i-1].close;
      returns.push(ret);
    }

    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((sum, ret) => sum + Math.pow(ret - mean, 2), 0) / returns.length;

    return Math.sqrt(variance) * 100; // As percentage
  }

  /**
   * Calculate support and resistance levels
   */
  private calculateSupportResistance(candles: CandleData[]): { support: number[]; resistance: number[] } {
    if (candles.length < 20) return { support: [], resistance: [] };

    const highs = candles.map(c => c.high);
    const lows = candles.map(c => c.low);

    // Find swing points
    const swingHighs: number[] = [];
    const swingLows: number[] = [];

    for (let i = 2; i < candles.length - 2; i++) {
      if (highs[i] > highs[i-1] && highs[i] > highs[i-2] && highs[i] > highs[i+1] && highs[i] > highs[i+2]) {
        swingHighs.push(highs[i]);
      }
      if (lows[i] < lows[i-1] && lows[i] < lows[i-2] && lows[i] < lows[i+1] && lows[i] < lows[i+2]) {
        swingLows.push(lows[i]);
      }
    }

    // Cluster levels and take top 3
    const resistance = this.clusterLevels(swingHighs).slice(-3);
    const support = this.clusterLevels(swingLows).slice(0, 3);

    return { support, resistance };
  }

  /**
   * Cluster similar price levels
   */
  private clusterLevels(levels: number[], tolerance: number = 0.002): number[] {
    if (levels.length === 0) return [];

    const sorted = [...levels].sort((a, b) => a - b);
    const clusters: number[] = [];
    let currentCluster: number[] = [sorted[0]];

    for (let i = 1; i < sorted.length; i++) {
      const diff = Math.abs(sorted[i] - currentCluster[0]) / currentCluster[0];

      if (diff <= tolerance) {
        currentCluster.push(sorted[i]);
      } else {
        clusters.push(currentCluster.reduce((a, b) => a + b, 0) / currentCluster.length);
        currentCluster = [sorted[i]];
      }
    }

    if (currentCluster.length > 0) {
      clusters.push(currentCluster.reduce((a, b) => a + b, 0) / currentCluster.length);
    }

    return clusters;
  }

  /**
   * Calculate overall confluence across all timeframes
   */
  private calculateOverallConfluence(
    symbol: string,
    currentPrice: number,
    analyses: TimeframeAnalysis[]
  ): MultiTimeframeAnalysis {
    let totalBuyWeight = 0;
    let totalSellWeight = 0;
    let totalConfluenceScore = 0;
    let totalConfidence = 0;

    const entryZones: { high: number; low: number }[] = [];
    const riskRewardRatios: number[] = [];

    for (const analysis of analyses) {
      const config = this.TIMEFRAMES.find(tf => tf.timeframe === analysis.timeframe);
      if (!config) continue;

      const weight = config.weight;

      // Bias weighting
      if (analysis.smcAnalysis.tradeBias === 'BUY') {
        totalBuyWeight += weight * (analysis.smcAnalysis.confluenceScore / 100);
      } else if (analysis.smcAnalysis.tradeBias === 'SELL') {
        totalSellWeight += weight * (analysis.smcAnalysis.confluenceScore / 100);
      }

      // Confluence score (weighted average)
      totalConfluenceScore += analysis.smcAnalysis.confluenceScore * weight;

      // Confidence based on trend alignment
      const trendAlignment = this.calculateTrendAlignment(analyses, analysis.timeframe);
      totalConfidence += trendAlignment * weight;

      // Collect entry zones
      if (analysis.smcAnalysis.entryZone) {
        entryZones.push(analysis.smcAnalysis.entryZone);
      }

      // Risk-reward ratios
      if (analysis.smcAnalysis.confluenceScore > 30) {
        riskRewardRatios.push(2.0); // Conservative default
      }
    }

    // Determine overall bias with optimized weights for gold trading
    let overallBias: 'BUY' | 'SELL' | 'NEUTRAL' = 'NEUTRAL';
    const biasThreshold = 0.15; // Optimized threshold for reliable gold trading

    // Calculate weighted bias from all available analyses
    totalBuyWeight = 0;
    totalSellWeight = 0;

    for (const analysis of analyses) {
      const config = this.TIMEFRAMES.find(tf => tf.timeframe === analysis.timeframe);
      if (!config) continue;

      const weight = config.weight;

      if (analysis.smcAnalysis.tradeBias === 'BUY') {
        totalBuyWeight += weight * (analysis.smcAnalysis.confluenceScore / 100);
      } else if (analysis.smcAnalysis.tradeBias === 'SELL') {
        totalSellWeight += weight * (analysis.smcAnalysis.confluenceScore / 100);
      }
    }

    // Determine bias based on weighted scores
    if (totalBuyWeight > totalSellWeight + biasThreshold) {
      overallBias = 'BUY';
    } else if (totalSellWeight > totalBuyWeight + biasThreshold) {
      overallBias = 'SELL';
    }

    // Calculate entry quality
    const entryQuality = this.calculateEntryQuality(analyses, overallBias);

    // Calculate optimal entry zone
    const optimalEntryZone = this.calculateOptimalEntryZone(entryZones, currentPrice);

    // Calculate average risk-reward ratio
    const avgRiskReward = riskRewardRatios.length > 0
      ? riskRewardRatios.reduce((a, b) => a + b, 0) / riskRewardRatios.length
      : 2.0;

    return {
      symbol,
      currentPrice,
      timeframes: analyses,
      overallBias,
      confluenceScore: Math.min(totalConfluenceScore, 100),
      entryQuality,
      optimalEntryZone,
      riskRewardRatio: avgRiskReward,
      confidence: Math.min(totalConfidence, 100),
      analysisTimestamp: new Date()
    };
  }

  /**
   * Calculate trend alignment across timeframes
   */
  private calculateTrendAlignment(analyses: TimeframeAnalysis[], currentTimeframe: string): number {
    const current = analyses.find(a => a.timeframe === currentTimeframe);
    if (!current) return 0;

    let alignmentScore = 0;
    let totalWeight = 0;

    for (const analysis of analyses) {
      if (analysis.timeframe === currentTimeframe) continue;

      const config = this.TIMEFRAMES.find(tf => tf.timeframe === analysis.timeframe);
      if (!config) continue;

      const weight = config.weight;

      // Check if trends align
      if (current.smcAnalysis.marketStructure.trend === analysis.smcAnalysis.marketStructure.trend) {
        alignmentScore += 100 * weight;
      } else if (current.smcAnalysis.marketStructure.trend === 'RANGING' ||
                 analysis.smcAnalysis.marketStructure.trend === 'RANGING') {
        alignmentScore += 50 * weight; // Partial credit for ranging
      }

      totalWeight += weight;
    }

    return totalWeight > 0 ? alignmentScore / totalWeight : 0;
  }

  /**
    * Calculate entry quality based on confluence factors
    */
  private calculateEntryQuality(
    analyses: TimeframeAnalysis[],
    bias: 'BUY' | 'SELL' | 'NEUTRAL'
  ): 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR' {
    if (bias === 'NEUTRAL') return 'POOR';

    let qualityScore = 0;

    // Separate lower and higher timeframes
    const lowerTimeframes = analyses.filter(a => ['1M', '5M', '15M', '30M'].includes(a.timeframe));
    const higherTimeframes = analyses.filter(a => ['1H', '4H'].includes(a.timeframe));

    // Base score from lower timeframes (required for entry signals)
    const lowerTimeframeScore = lowerTimeframes.reduce((sum, a) => {
      if (a.smcAnalysis.tradeBias === bias) {
        return sum + 20; // Base points for alignment
      }
      return sum;
    }, 0);
    qualityScore += Math.min(lowerTimeframeScore, 60);

    // Bonus points for higher timeframes (optional, graceful degradation)
    const higherTimeframeScore = higherTimeframes.filter(a =>
      a.smcAnalysis.tradeBias === bias
    ).length * 15; // Reduced weight since optional
    qualityScore += higherTimeframeScore;

    // SMC confluence factors
    const totalFactors = analyses.reduce((sum, a) => sum + a.smcAnalysis.confluenceFactors.length, 0);
    qualityScore += Math.min(totalFactors * 5, 50);

    // Trend strength
    const avgTrendStrength = analyses.reduce((sum, a) => sum + Math.abs(a.trendStrength), 0) / analyses.length;
    qualityScore += Math.min(avgTrendStrength, 25);

    // Determine quality - adjusted thresholds for forex trading
    // For forex symbols without higher timeframes, be more lenient
    const hasHigherTimeframes = higherTimeframes.length > 0;

    if (qualityScore >= 70) return 'EXCELLENT';
    if (qualityScore >= 50) return 'GOOD';
    if (qualityScore >= 25) return 'FAIR'; // Lower threshold when no higher timeframes
    return 'POOR';
  }

  /**
   * Calculate optimal entry zone from multiple timeframes
   */
  private calculateOptimalEntryZone(
    entryZones: { high: number; low: number }[],
    currentPrice: number
  ): { high: number; low: number } | null {
    if (entryZones.length === 0) return null;

    // Find the most conservative entry zone (intersection of all zones)
    const minHigh = Math.min(...entryZones.map(z => z.high));
    const maxLow = Math.max(...entryZones.map(z => z.low));

    // If zones don't overlap, use the zone closest to current price
    if (maxLow >= minHigh) {
      return { high: minHigh, low: maxLow };
    }

    // Find zone closest to current price
    const closestZone = entryZones.reduce((closest, zone) => {
      const closestDistance = Math.abs((closest.high + closest.low) / 2 - currentPrice);
      const currentDistance = Math.abs((zone.high + zone.low) / 2 - currentPrice);
      return currentDistance < closestDistance ? zone : closest;
    });

    return closestZone;
  }

  /**
   * Get analysis statistics
   */
  getAnalysisStats(): {
    cacheSize: number;
    cacheHitRate: number;
    avgAnalysisTime: number;
  } {
    return {
      cacheSize: this.analysisCache.size,
      cacheHitRate: 0, // Would need to track hits/misses
      avgAnalysisTime: 0 // Would need to track timing
    };
  }

  /**
   * Calculate ATR (Average True Range) for a symbol and timeframe
   */
  async calculateATR(symbol: string, timeframe: string, period: number): Promise<number> {
    try {
      const candles = await this.fetchTimeframeData(symbol, {
        timeframe,
        weight: 1,
        minCandles: period + 1,
        maxCandles: period + 50
      });

      if (candles.length < period + 1) {
        console.warn(`⚠️ Insufficient data for ATR calculation: ${candles.length}/${period + 1} candles`);
        return 0;
      }

      const trueRanges: number[] = [];

      for (let i = 1; i < candles.length; i++) {
        const current = candles[i];
        const previous = candles[i - 1];

        const tr1 = current.high - current.low;
        const tr2 = Math.abs(current.high - previous.close);
        const tr3 = Math.abs(current.low - previous.close);

        const trueRange = Math.max(tr1, tr2, tr3);
        trueRanges.push(trueRange);
      }

      // Calculate ATR using simple moving average
      const atr = trueRanges.slice(-period).reduce((sum, tr) => sum + tr, 0) / period;
      return atr;
    } catch (error) {
      console.error(`❌ Failed to calculate ATR for ${symbol} ${timeframe}:`, error);
      return 0;
    }
  }

  /**
   * Calculate historical ATR average over multiple periods
   */
  async calculateHistoricalATR(symbol: string, timeframe: string, period: number, historyPeriods: number): Promise<number> {
    try {
      const candles = await this.fetchTimeframeData(symbol, {
        timeframe,
        weight: 1,
        minCandles: period * historyPeriods + 50,
        maxCandles: period * historyPeriods + 100
      });

      if (candles.length < period * historyPeriods) {
        console.warn(`⚠️ Insufficient data for historical ATR: ${candles.length}/${period * historyPeriods} candles`);
        return 0;
      }

      const atrValues: number[] = [];

      // Calculate ATR for each historical period
      for (let i = 0; i < historyPeriods; i++) {
        const startIdx = i * period;
        const endIdx = startIdx + period;

        if (endIdx >= candles.length) break;

        const periodCandles = candles.slice(startIdx, endIdx);
        const trueRanges: number[] = [];

        for (let j = 1; j < periodCandles.length; j++) {
          const current = periodCandles[j];
          const previous = periodCandles[j - 1];

          const tr1 = current.high - current.low;
          const tr2 = Math.abs(current.high - previous.close);
          const tr3 = Math.abs(current.low - previous.close);

          const trueRange = Math.max(tr1, tr2, tr3);
          trueRanges.push(trueRange);
        }

        const atr = trueRanges.reduce((sum, tr) => sum + tr, 0) / trueRanges.length;
        atrValues.push(atr);
      }

      // Return average of historical ATR values
      const avgATR = atrValues.reduce((sum, atr) => sum + atr, 0) / atrValues.length;
      return avgATR;
    } catch (error) {
      console.error(`❌ Failed to calculate historical ATR for ${symbol} ${timeframe}:`, error);
      return 0;
    }
  }

  /**
   * Analyze market structure for a symbol
   */
  async analyzeMarketStructure(symbol: string): Promise<{
    trendBreakDetected: boolean;
    emaFlipDetected: boolean;
    momentumDivergenceDetected: boolean;
    trend: 'UPTREND' | 'DOWNTREND' | 'RANGING';
    strength: number;
  }> {
    try {
      // Get data from multiple timeframes for structure analysis
      const timeframes = ['15M', '1H', '4H'];
      const analyses: TimeframeAnalysis[] = [];

      for (const tf of timeframes) {
        try {
          const candles = await this.fetchTimeframeData(symbol, {
            timeframe: tf,
            weight: 1,
            minCandles: 50,
            maxCandles: 100
          });

          if (candles.length >= 20) {
            const smcAnalysis = await smartMoneyAnalyzer.analyze(candles, candles[candles.length - 1].close, symbol);
            analyses.push({
              timeframe: tf,
              candles,
              smcAnalysis,
              trendStrength: this.calculateTrendStrength(candles),
              momentumScore: this.calculateMomentumScore(candles),
              volatility: this.calculateVolatility(candles),
              supportResistance: this.calculateSupportResistance(candles)
            });
          }
        } catch (error) {
          console.log(`📊 Skipping ${tf} for market structure analysis: ${error.message}`);
        }
      }

      if (analyses.length === 0) {
        return {
          trendBreakDetected: false,
          emaFlipDetected: false,
          momentumDivergenceDetected: false,
          trend: 'RANGING',
          strength: 0
        };
      }

      // Analyze trend consistency across timeframes
      const trends = analyses.map(a => a.smcAnalysis.marketStructure.trend);
      const bullishCount = trends.filter(t => t === 'BULLISH').length;
      const bearishCount = trends.filter(t => t === 'BEARISH').length;

      let overallTrend: 'UPTREND' | 'DOWNTREND' | 'RANGING' = 'RANGING';
      if (bullishCount > bearishCount) overallTrend = 'UPTREND';
      else if (bearishCount > bullishCount) overallTrend = 'DOWNTREND';

      // Check for trend breaks (recent price action against trend)
      const trendBreakDetected = this.detectTrendBreak(analyses, overallTrend);

      // Check for EMA flips (moving average crossovers)
      const emaFlipDetected = this.detectEMAFlip(analyses);

      // Check for momentum divergence
      const momentumDivergenceDetected = this.detectMomentumDivergence(analyses);

      // Calculate trend strength
      const avgStrength = analyses.reduce((sum, a) => sum + Math.abs(a.trendStrength), 0) / analyses.length;

      return {
        trendBreakDetected,
        emaFlipDetected,
        momentumDivergenceDetected,
        trend: overallTrend,
        strength: avgStrength
      };
    } catch (error) {
      console.error(`❌ Failed to analyze market structure for ${symbol}:`, error);
      return {
        trendBreakDetected: false,
        emaFlipDetected: false,
        momentumDivergenceDetected: false,
        trend: 'RANGING',
        strength: 0
      };
    }
  }

  /**
   * Detect trend breaks
   */
  private detectTrendBreak(analyses: TimeframeAnalysis[], overallTrend: string): boolean {
    for (const analysis of analyses) {
      const recentCandles = analysis.candles.slice(-5);
      const trendStrength = analysis.trendStrength;

      // Check if recent candles break the established trend
      if (overallTrend === 'UPTREND' && trendStrength < -50) {
        return true;
      }
      if (overallTrend === 'DOWNTREND' && trendStrength > 50) {
        return true;
      }
    }
    return false;
  }

  /**
   * Detect EMA flips (moving average crossovers)
   */
  private detectEMAFlip(analyses: TimeframeAnalysis[]): boolean {
    for (const analysis of analyses) {
      // Simple EMA crossover detection using price action
      const candles = analysis.candles.slice(-10);
      if (candles.length < 10) continue;

      const recentPrices = candles.map(c => c.close);
      const ema9 = this.calculateEMA(recentPrices, 9);
      const ema21 = this.calculateEMA(recentPrices, 21);

      if (ema9 && ema21) {
        const lastEMA9 = ema9[ema9.length - 1];
        const lastEMA21 = ema21[ema21.length - 1];
        const prevEMA9 = ema9[ema9.length - 2];
        const prevEMA21 = ema21[ema21.length - 2];

        // Check for crossover
        if ((prevEMA9 <= prevEMA21 && lastEMA9 > lastEMA21) ||
            (prevEMA9 >= prevEMA21 && lastEMA9 < lastEMA21)) {
          return true;
        }
      }
    }
    return false;
  }

  /**
   * Detect momentum divergence
   */
  private detectMomentumDivergence(analyses: TimeframeAnalysis[]): boolean {
    for (const analysis of analyses) {
      const momentumScore = analysis.momentumScore;

      // Check if momentum is weakening while price continues in trend direction
      if (Math.abs(momentumScore) < 20 && Math.abs(analysis.trendStrength) > 60) {
        return true;
      }
    }
    return false;
  }

  /**
   * Calculate EMA for given prices and period
   */
  private calculateEMA(prices: number[], period: number): number[] | null {
    if (prices.length < period) return null;

    const ema: number[] = [];
    const multiplier = 2 / (period + 1);

    // Start with SMA
    let sum = 0;
    for (let i = 0; i < period; i++) {
      sum += prices[i];
    }
    ema.push(sum / period);

    // Calculate EMA
    for (let i = period; i < prices.length; i++) {
      const currentEMA = (prices[i] - ema[ema.length - 1]) * multiplier + ema[ema.length - 1];
      ema.push(currentEMA);
    }

    return ema;
  }

  /**
   * Clear analysis cache
   */
  clearCache(): void {
    this.analysisCache.clear();
    console.log('🧹 Multi-timeframe analysis cache cleared');
  }
}

export const multiTimeframeAnalyzer = new MultiTimeframeAnalyzer();