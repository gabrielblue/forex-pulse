/**
 * Real Market Data Service - Fetches live data from MT5 and calculates proper indicators
 * This replaces mock data with actual market data from the broker
 */

import { exnessAPI } from './exnessApi';

export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface IndicatorSet {
  // Price data
  currentPrice: number;
  bid: number;
  ask: number;
  
  // Moving Averages
  ema9: number;
  ema21: number;
  ema50: number;
  ema200: number;
  sma20: number;
  
  // Momentum
  rsi: number;
  macd: { value: number; signal: number; histogram: number };
  stochastic: { k: number; d: number };
  
  // Volatility
  atr: number;
  bollinger: { upper: number; middle: number; lower: number };
  atrPercent: number;
  
  // Trend
  trendDirection: 'BULLISH' | 'BEARISH' | 'SIDEWAYS';
  trendStrength: number;
  momentumScore: number;
}

export interface MultiTimeframeData {
  '1M': Candle[];
  '5M': Candle[];
  '15M': Candle[];
  '30M': Candle[];
  '1H': Candle[];
  '4H': Candle[];
}

class RealMarketDataService {
  private dataCache = new Map<string, { data: any; timestamp: number }>();
  private readonly CACHE_DURATION = 10000; // 10 seconds

  /**
   * Fetch real market data for a symbol across all timeframes
   */
  async fetchAllTimeframes(symbol: string): Promise<MultiTimeframeData | null> {
    const cacheKey = `${symbol}_all_tf`;
    const cached = this.dataCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
      return cached.data;
    }

    try {
      console.log(`📊 Fetching real market data for ${symbol} from MT5...`);
      
      const timeframes: Array<'1M' | '5M' | '15M' | '30M' | '1H' | '4H'> = ['1M', '5M', '15M', '30M', '1H', '4H'];
      const results: Record<string, Candle[]> = {};
      
      // Fetch all timeframes in parallel
      const promises = timeframes.map(async (tf) => {
        try {
          const candles = await exnessAPI.getHistoricalData(symbol, tf, 100);
          if (candles && candles.length > 0) {
            results[tf] = candles.map((c: any) => ({
              time: c.time,
              open: c.open,
              high: c.high,
              low: c.low,
              close: c.close,
              volume: c.tick_volume || c.volume || 0
            }));
            return { tf, success: true };
          }
          return { tf, success: false };
        } catch (error) {
          console.warn(`⚠️ Failed to fetch ${symbol} ${tf}:`, error);
          return { tf, success: false };
        }
      });

      await Promise.all(promises);
      
      const data = results as unknown as MultiTimeframeData;
      this.dataCache.set(cacheKey, { data, timestamp: Date.now() });
      
      console.log(`✅ Real market data fetched for ${symbol}:`, Object.keys(results).join(', '));
      return data;
    } catch (error) {
      console.error(`❌ Failed to fetch market data for ${symbol}:`, error);
      return null;
    }
  }

  /**
   * Calculate all indicators from real OHLCV data
   */
  calculateIndicators(candles: Candle[]): IndicatorSet | null {
    if (!candles || candles.length < 200) {
      console.warn(`⚠️ Insufficient candles for indicator calculation: ${candles?.length || 0}`);
      return null;
    }

    const closes = candles.map(c => c.close);
    const highs = candles.map(c => c.high);
    const lows = candles.map(c => c.low);
    const volumes = candles.map(c => c.volume);
    
    const currentPrice = closes[closes.length - 1];
    
    // Get current bid/ask (simplified - use last price)
    const bid = currentPrice;
    const ask = currentPrice;
    
    // Calculate EMAs
    const ema9 = this.calculateEMA(closes, 9);
    const ema21 = this.calculateEMA(closes, 21);
    const ema50 = this.calculateEMA(closes, 50);
    const ema200 = this.calculateEMA(closes, 200);
    const sma20 = this.calculateSMA(closes, 20);
    
    // Calculate RSI
    const rsi = this.calculateRSI(closes, 14);
    
    // Calculate MACD
    const macd = this.calculateMACD(closes, 12, 26, 9);
    
    // Calculate Stochastic
    const stochastic = this.calculateStochastic(highs, lows, closes, 14, 3);
    
    // Calculate ATR and Bollinger Bands
    const atr = this.calculateATR(highs, lows, closes, 14);
    const bollinger = this.calculateBollingerBands(closes, 20, 2);
    
    // Calculate ATR percentage
    const atrPercent = (atr / currentPrice) * 100;
    
    // Determine trend direction
    const trendDirection = this.determineTrendDirection(ema9, ema21, ema50, ema200, currentPrice);
    const trendStrength = this.calculateTrendStrength(ema9, ema21, ema50, ema200, currentPrice);
    const momentumScore = this.calculateMomentumFromCandles(candles);

    return {
      currentPrice,
      bid,
      ask,
      ema9,
      ema21,
      ema50,
      ema200,
      sma20,
      rsi,
      macd,
      stochastic,
      atr,
      bollinger,
      atrPercent,
      trendDirection,
      trendStrength,
      momentumScore
    };
  }

  /**
   * Get real-time analysis for a symbol with proper indicators
   */
  async getRealTimeAnalysis(symbol: string): Promise<{
    indicators: IndicatorSet | null;
    multiTimeframe: MultiTimeframeData | null;
    analysis: string;
  }> {
    const tfData = await this.fetchAllTimeframes(symbol);
    
    if (!tfData) {
      return {
        indicators: null,
        multiTimeframe: null,
        analysis: '❌ No market data available - MT5 connection may be down'
      };
    }

    // Use 1H candles for main indicators (more stable)
    const mainCandles = tfData['1M'] || tfData['5M'] || tfData['15M'];
    
    if (!mainCandles || mainCandles.length < 200) {
      return {
        indicators: null,
        multiTimeframe: tfData,
        analysis: '⚠️ Insufficient candle data for indicator calculation'
      };
    }

    const indicators = this.calculateIndicators(mainCandles);
    
    if (!indicators) {
      return {
        indicators: null,
        multiTimeframe: tfData,
        analysis: '❌ Failed to calculate indicators from market data'
      };
    }

    // Generate analysis string
    const analysis = this.generateAnalysisString(symbol, indicators);
    
    return {
      indicators,
      multiTimeframe: tfData,
      analysis
    };
  }

  /**
   * Generate human-readable analysis
   */
  private generateAnalysisString(symbol: string, ind: IndicatorSet): string {
    const direction = ind.trendDirection;
    const strength = ind.trendStrength;
    const rsi = ind.rsi;
    const macdSignal = ind.macd.histogram > 0 ? 'BULLISH' : 'BEARISH';
    
    let entrySignal = 'NEUTRAL';
    if (ind.rsi < 30 && direction === 'BULLISH') {
      entrySignal = 'STRONG BUY';
    } else if (ind.rsi > 70 && direction === 'BEARISH') {
      entrySignal = 'STRONG SELL';
    } else if (ind.rsi < 45 && direction === 'BULLISH') {
      entrySignal = 'BUY';
    } else if (ind.rsi > 55 && direction === 'BEARISH') {
      entrySignal = 'SELL';
    }

    return `📊 ${symbol} Analysis:
🎯 Trend: ${direction} (${strength.toFixed(1)}% strength)
📈 RSI: ${rsi.toFixed(1)} ${rsi < 30 ? '(OVERSOLD)' : rsi > 70 ? '(OVERBOUGHT)' : ''}
📉 MACD: ${macdSignal} (histogram: ${ind.macd.histogram.toFixed(5)})
💰 Current: ${ind.currentPrice.toFixed(5)}
🎯 Recommended: ${entrySignal}`;
  }

  /**
   * Get overall market bias from multi-timeframe analysis
   */
  getMultiTimeframeBias(tfData: Partial<MultiTimeframeData>): {
    bias: 'BUY' | 'SELL' | 'NEUTRAL';
    confidence: number;
    reason: string;
  } {
    let buyScore = 0;
    let sellScore = 0;

    const weights: Record<string, number> = {
      '1M': 0.1,
      '5M': 0.15,
      '15M': 0.2,
      '30M': 0.2,
      '1H': 0.2,
      '4H': 0.15
    };

    for (const [tf, candles] of Object.entries(tfData)) {
      if (!candles || candles.length < 20) continue;
      
      const weight = weights[tf] || 0.1;
      const bias = this.getTimeframeBias(candles);
      
      if (bias === 'BUY') {
        buyScore += weight;
      } else if (bias === 'SELL') {
        sellScore += weight;
      }
    }

    const netScore = buyScore - sellScore;
    const confidence = Math.min(Math.abs(netScore) * 100, 100);
    
    let bias: 'BUY' | 'SELL' | 'NEUTRAL';
    let reason: string;

    if (netScore > 0.1) {
      bias = 'BUY';
      reason = `${(netScore * 100).toFixed(0)}% bullish bias across ${Object.keys(tfData).length} timeframes`;
    } else if (netScore < -0.1) {
      bias = 'SELL';
      reason = `${(Math.abs(netScore) * 100).toFixed(0)}% bearish bias across ${Object.keys(tfData).length} timeframes`;
    } else {
      bias = 'NEUTRAL';
      reason = 'Mixed signals across timeframes';
    }

    return { bias, confidence, reason };
  }

  private getTimeframeBias(candles: Candle[]): 'BUY' | 'SELL' | 'NEUTRAL' {
    if (candles.length < 20) return 'NEUTRAL';
    
    const closes = candles.map(c => c.close);
    const ema9 = this.calculateEMA(closes, 9);
    const ema21 = this.calculateEMA(closes, 21);
    
    const lastEMA9 = ema9;
    const lastEMA21 = ema21;
    const lastClose = closes[closes.length - 1];
    
    // Check EMA alignment
    if (lastEMA9 > lastEMA21 && lastClose > lastEMA9) {
      return 'BUY';
    } else if (lastEMA9 < lastEMA21 && lastClose < lastEMA9) {
      return 'SELL';
    }
    
    return 'NEUTRAL';
  }

  private determineTrendDirection(
    ema9: number, ema21: number, ema50: number, ema200: number, currentPrice: number
  ): 'BULLISH' | 'BEARISH' | 'SIDEWAYS' {
    const bullishCount = [
      currentPrice > ema9,
      ema9 > ema21,
      ema21 > ema50,
      ema50 > ema200
    ].filter(Boolean).length;

    const bearishCount = [
      currentPrice < ema9,
      ema9 < ema21,
      ema21 < ema50,
      ema50 < ema200
    ].filter(Boolean).length;

    if (bullishCount >= 3) return 'BULLISH';
    if (bearishCount >= 3) return 'BEARISH';
    return 'SIDEWAYS';
  }

  private calculateTrendStrength(
    ema9: number, ema21: number, ema50: number, ema200: number, currentPrice: number
  ): number {
    const bullishSignals = [
      currentPrice > ema9 ? 25 : 0,
      ema9 > ema21 ? 25 : 0,
      ema21 > ema50 ? 25 : 0,
      ema50 > ema200 ? 25 : 0
    ].reduce((a, b) => a + b, 0);

    const bearishSignals = [
      currentPrice < ema9 ? 25 : 0,
      ema9 < ema21 ? 25 : 0,
      ema21 < ema50 ? 25 : 0,
      ema50 < ema200 ? 25 : 0
    ].reduce((a, b) => a + b, 0);

    return Math.max(bullishSignals, bearishSignals);
  }

  private calculateMomentumFromCandles(candles: Candle[]): number {
    if (candles.length < 10) return 0;
    
    let bullish = 0;
    let bearish = 0;
    
    for (let i = -10; i < 0; i++) {
      const candle = candles[candles.length + i];
      if (candle.close > candle.open) bullish++;
      else bearish++;
    }
    
    return ((bullish - bearish) / 10) * 100;
  }

  private calculateEMA(prices: number[], period: number): number {
    if (prices.length < period) return prices[prices.length - 1] || 0;
    
    const multiplier = 2 / (period + 1);
    const ema: number[] = [];
    
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
    
    return ema[ema.length - 1];
  }

  private calculateSMA(prices: number[], period: number): number {
    if (prices.length < period) return prices[prices.length - 1] || 0;
    
    const slice = prices.slice(-period);
    return slice.reduce((a, b) => a + b, 0) / period;
  }

  private calculateRSI(prices: number[], period: number): number {
    if (prices.length < period + 1) return 50;
    
    const changes: number[] = [];
    for (let i = 1; i < prices.length; i++) {
      changes.push(prices[i] - prices[i - 1]);
    }
    
    const gains = changes.slice(-period).filter(c => c > 0);
    const losses = changes.slice(-period).filter(c => c < 0).map(c => Math.abs(c));
    
    const avgGain = gains.length > 0 ? gains.reduce((a, b) => a + b, 0) / period : 0;
    const avgLoss = losses.length > 0 ? losses.reduce((a, b) => a + b, 0) / period : 0;
    
    if (avgLoss === 0) return 100;
    
    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
  }

  private calculateMACD(prices: number[], fastPeriod: number, slowPeriod: number, signalPeriod: number): {
    value: number;
    signal: number;
    histogram: number;
  } {
    const fastEMA = this.calculateEMA(prices, fastPeriod);
    const slowEMA = this.calculateEMA(prices, slowPeriod);
    
    const macdLine = fastEMA - slowEMA;
    
    // For signal line, we'd need historical MACD values
    // Simplified version
    const signal = macdLine * 0.9; // Approximate
    
    return {
      value: macdLine,
      signal,
      histogram: macdLine - signal
    };
  }

  private calculateStochastic(
    highs: number[], lows: number[], closes: number[], period: number, smoothPeriod: number
  ): { k: number; d: number } {
    if (closes.length < period) return { k: 50, d: 50 };
    
    const recentHighs = highs.slice(-period);
    const recentLows = lows.slice(-period);
    const recentCloses = closes.slice(-period);
    
    const highest = Math.max(...recentHighs);
    const lowest = Math.min(...recentLows);
    const current = recentCloses[recentCloses.length - 1];
    
    if (highest === lowest) return { k: 50, d: 50 };
    
    const k = ((current - lowest) / (highest - lowest)) * 100;
    // D is SMA of K (simplified)
    const d = k;
    
    return { k, d };
  }

  private calculateATR(
    highs: number[], lows: number[], closes: number[], period: number
  ): number {
    if (closes.length < period + 1) return 0;
    
    const trueRanges: number[] = [];
    
    for (let i = 1; i < closes.length; i++) {
      const tr1 = highs[i] - lows[i];
      const tr2 = Math.abs(highs[i] - closes[i - 1]);
      const tr3 = Math.abs(lows[i] - closes[i - 1]);
      trueRanges.push(Math.max(tr1, tr2, tr3));
    }
    
    const slice = trueRanges.slice(-period);
    return slice.reduce((a, b) => a + b, 0) / period;
  }

  private calculateBollingerBands(prices: number[], period: number, stdDevMultiplier: number): {
    upper: number;
    middle: number;
    lower: number;
  } {
    if (prices.length < period) {
      const price = prices[prices.length - 1] || 1;
      return { upper: price, middle: price, lower: price };
    }
    
    const slice = prices.slice(-period);
    const middle = slice.reduce((a, b) => a + b, 0) / period;
    
    const squaredDiffs = slice.map(p => Math.pow(p - middle, 2));
    const stdDev = Math.sqrt(squaredDiffs.reduce((a, b) => a + b, 0) / period);
    
    return {
      upper: middle + (stdDev * stdDevMultiplier),
      middle,
      lower: middle - (stdDev * stdDevMultiplier)
    };
  }

  clearCache(): void {
    this.dataCache.clear();
    console.log('🧹 Real market data cache cleared');
  }
}

export const realMarketDataService = new RealMarketDataService();
