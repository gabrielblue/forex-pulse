/**
 * Mean Reversion Alpha Strategy
 * Trades range-bound markets with strict volatility filters
 * Best performance during late US close and early Asia sessions
 */

import { exnessAPI } from '../exnessApi';

export interface MeanReversionConfig {
  enabled: boolean;
  riskPerTrade: number; // 0.25-0.5%
  maxPositions: number;
  timeWindows: {
    lateUS: { start: string; end: string }; // 21:00-23:00 UTC
    earlyAsia: { start: string; end: string }; // 00:00-02:00 UTC
  };
  filters: {
    atrPercentile: number; // Only trade when ATR < 30th percentile
    bollingerWidth: number; // Max BB width (low volatility)
    rsiExtreme: number; // RSI extreme levels (25/75)
    minRange: number; // Minimum range in pips
    maxSpread: number; // Maximum spread in pips
  };
  entry: {
    confirmationBars: number; // Bars to confirm reversal
    volumeThreshold: number; // Minimum volume for entry
  };
  exit: {
    atrMultiplier: number; // ATR multiplier for SL/TP
    partialLevels: Array<{ percentage: number; distance: number }>;
    maxHoldTime: number; // Max hold time in hours
  };
}

export interface MeanReversionSignal {
  symbol: string;
  direction: 'BUY' | 'SELL';
  confidence: number;
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  reasoning: string[];
  regime: 'MEAN_REVERSION';
  session: string;
  volatility: {
    atr: number;
    bollingerWidth: number;
    rsi: number;
  };
}

export class MeanReversionAlpha {
  private config: MeanReversionConfig;
  private activePositions: Map<string, any> = new Map();

  constructor(config?: Partial<MeanReversionConfig>) {
    this.config = {
      enabled: true,
      riskPerTrade: 0.3, // 0.3% risk per trade
      maxPositions: 3,
      timeWindows: {
        lateUS: { start: '21:00', end: '23:00' },
        earlyAsia: { start: '00:00', end: '02:00' }
      },
      filters: {
        atrPercentile: 30, // Only trade low volatility
        bollingerWidth: 0.02, // 2% max BB width
        rsiExtreme: 25, // RSI 25/75 extremes
        minRange: 10, // 10 pips minimum range
        maxSpread: 3 // 3 pips max spread
      },
      entry: {
        confirmationBars: 3,
        volumeThreshold: 1000
      },
      exit: {
        atrMultiplier: 1.5,
        partialLevels: [
          { percentage: 0.5, distance: 1.0 }, // 50% at 1R
          { percentage: 0.3, distance: 1.5 }, // 30% at 1.5R
          { percentage: 0.2, distance: 2.0 }  // 20% at 2R
        ],
        maxHoldTime: 4 // 4 hours max
      },
      ...config
    };
  }

  /**
   * Check if current time is within mean reversion windows
   */
  private isWithinTimeWindow(): boolean {
    const now = new Date();
    const utcHour = now.getUTCHours();
    const utcMinute = now.getUTCMinutes();
    const currentTime = `${utcHour.toString().padStart(2, '0')}:${utcMinute.toString().padStart(2, '0')}`;

    const { lateUS, earlyAsia } = this.config.timeWindows;
    
    // Check late US session (21:00-23:00 UTC)
    if (currentTime >= lateUS.start && currentTime <= lateUS.end) {
      return true;
    }
    
    // Check early Asia session (00:00-02:00 UTC)
    if (currentTime >= earlyAsia.start && currentTime <= earlyAsia.end) {
      return true;
    }

    return false;
  }

  /**
   * Calculate ATR from tick data
   */
  private async calculateATR(symbol: string, period: number = 14): Promise<number> {
    try {
      const ticks = await exnessAPI.getTicks(symbol, period * 60); // 1 minute bars
      if (ticks.length < period) return 0;

      // Convert ticks to 1-minute candles
      const candles = this.ticksToCandles(ticks, 60000); // 60 seconds
      if (candles.length < 2) return 0;

      // Calculate True Range
      const trueRanges: number[] = [];
      for (let i = 1; i < candles.length; i++) {
        const prev = candles[i - 1];
        const curr = candles[i];
        
        const tr1 = curr.high - curr.low;
        const tr2 = Math.abs(curr.high - prev.close);
        const tr3 = Math.abs(curr.low - prev.close);
        
        trueRanges.push(Math.max(tr1, tr2, tr3));
      }

      // Calculate ATR (simple average)
      const atr = trueRanges.slice(-period).reduce((sum, tr) => sum + tr, 0) / period;
      return atr;
    } catch (error) {
      console.error('ATR calculation failed:', error);
      return 0;
    }
  }

  /**
   * Convert ticks to candles
   */
  private ticksToCandles(ticks: any[], intervalMs: number): Array<{ open: number; high: number; low: number; close: number }> {
    const candles = new Map<number, { open: number; high: number; low: number; close: number }>();
    
    for (const tick of ticks) {
      const timestamp = Math.floor(tick.time / intervalMs) * intervalMs;
      const midPrice = (tick.bid + tick.ask) / 2;
      
      if (!candles.has(timestamp)) {
        candles.set(timestamp, {
          open: midPrice,
          high: midPrice,
          low: midPrice,
          close: midPrice
        });
      } else {
        const candle = candles.get(timestamp)!;
        candle.high = Math.max(candle.high, midPrice);
        candle.low = Math.min(candle.low, midPrice);
        candle.close = midPrice;
      }
    }
    
    return Array.from(candles.values()).sort((a, b) => a.open - b.open);
  }

  /**
   * Calculate Bollinger Bands width
   */
  private calculateBollingerWidth(candles: Array<{ close: number }>, period: number = 20): number {
    if (candles.length < period) return 0;

    const closes = candles.slice(-period).map(c => c.close);
    const sma = closes.reduce((sum, close) => sum + close, 0) / period;
    
    const variance = closes.reduce((sum, close) => sum + Math.pow(close - sma, 2), 0) / period;
    const stdDev = Math.sqrt(variance);
    
    const upperBand = sma + (2 * stdDev);
    const lowerBand = sma - (2 * stdDev);
    
    return (upperBand - lowerBand) / sma; // Width as percentage
  }

  /**
   * Calculate RSI
   */
  private calculateRSI(candles: Array<{ close: number }>, period: number = 14): number {
    if (candles.length < period + 1) return 50;

    const gains: number[] = [];
    const losses: number[] = [];

    for (let i = 1; i < candles.length; i++) {
      const change = candles[i].close - candles[i - 1].close;
      gains.push(change > 0 ? change : 0);
      losses.push(change < 0 ? Math.abs(change) : 0);
    }

    const avgGain = gains.slice(-period).reduce((sum, gain) => sum + gain, 0) / period;
    const avgLoss = losses.slice(-period).reduce((sum, loss) => sum + loss, 0) / period;

    if (avgLoss === 0) return 100;
    
    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
  }

  /**
   * Check if market conditions are suitable for mean reversion
   */
  private async checkMarketConditions(symbol: string): Promise<{ suitable: boolean; reason: string; metrics: any }> {
    try {
      // Get recent ticks
      const ticks = await exnessAPI.getTicks(symbol, 1000);
      if (ticks.length < 50) {
        return { suitable: false, reason: 'Insufficient data', metrics: {} };
      }

      // Calculate metrics
      const atr = await this.calculateATR(symbol);
      const candles = this.ticksToCandles(ticks, 60000);
      const bbWidth = this.calculateBollingerWidth(candles);
      const rsi = this.calculateRSI(candles);

      // Check spread
      const currentSpread = ticks[ticks.length - 1].ask - ticks[ticks.length - 1].bid;
      const spreadPips = currentSpread * 10000; // Convert to pips

      // Check range
      const recentHigh = Math.max(...candles.slice(-20).map(c => c.high));
      const recentLow = Math.min(...candles.slice(-20).map(c => c.low));
      const rangePips = (recentHigh - recentLow) * 10000;

      const metrics = { atr, bbWidth, rsi, spreadPips, rangePips };

      // Apply filters
      if (spreadPips > this.config.filters.maxSpread) {
        return { suitable: false, reason: `Spread too high: ${spreadPips.toFixed(1)} pips`, metrics };
      }

      if (rangePips < this.config.filters.minRange) {
        return { suitable: false, reason: `Range too small: ${rangePips.toFixed(1)} pips`, metrics };
      }

      if (bbWidth > this.config.filters.bollingerWidth) {
        return { suitable: false, reason: `Volatility too high: ${(bbWidth * 100).toFixed(1)}%`, metrics };
      }

      if (rsi > 100 - this.config.filters.rsiExtreme && rsi < this.config.filters.rsiExtreme) {
        return { suitable: false, reason: `RSI not extreme: ${rsi.toFixed(1)}`, metrics };
      }

      return { suitable: true, reason: 'Conditions suitable', metrics };
    } catch (error) {
      console.error('Market condition check failed:', error);
      return { suitable: false, reason: 'Error checking conditions', metrics: {} };
    }
  }

  /**
   * Generate mean reversion signal
   */
  public async generateSignal(symbol: string): Promise<MeanReversionSignal | null> {
    if (!this.config.enabled) return null;
    if (!this.isWithinTimeWindow()) return null;
    if (this.activePositions.size >= this.config.maxPositions) return null;

    try {
      // Check market conditions
      const conditions = await this.checkMarketConditions(symbol);
      if (!conditions.suitable) {
        console.log(`Mean reversion conditions not met for ${symbol}: ${conditions.reason}`);
        return null;
      }

      // Get current price
      const currentPrice = await exnessAPI.getCurrentPrice(symbol);
      if (!currentPrice) return null;

      const { bid, ask } = currentPrice;
      const midPrice = (bid + ask) / 2;

      // Get recent candles for pattern analysis
      const ticks = await exnessAPI.getTicks(symbol, 200);
      const candles = this.ticksToCandles(ticks, 60000);
      
      if (candles.length < 20) return null;

      const rsi = this.calculateRSI(candles);
      const bbWidth = this.calculateBollingerWidth(candles);
      const atr = conditions.metrics.atr;

      let direction: 'BUY' | 'SELL' | null = null;
      let confidence = 0;
      const reasoning: string[] = [];

      // RSI-based mean reversion logic
      if (rsi < this.config.filters.rsiExtreme) {
        // Oversold - potential buy
        direction = 'BUY';
        confidence = 60 + (this.config.filters.rsiExtreme - rsi) * 2;
        reasoning.push(`RSI oversold: ${rsi.toFixed(1)}`);
      } else if (rsi > 100 - this.config.filters.rsiExtreme) {
        // Overbought - potential sell
        direction = 'SELL';
        confidence = 60 + (rsi - (100 - this.config.filters.rsiExtreme)) * 2;
        reasoning.push(`RSI overbought: ${rsi.toFixed(1)}`);
      }

      // Add confirmation from price action
      if (direction) {
        const recentCandles = candles.slice(-this.config.entry.confirmationBars);
        
        if (direction === 'BUY') {
          // Check for bullish reversal pattern
          const hasReversal = recentCandles.some((candle, i) => 
            i > 0 && candle.close > candle.open && candle.close > recentCandles[i-1].close
          );
          
          if (hasReversal) {
            confidence += 15;
            reasoning.push('Bullish reversal pattern confirmed');
          }
        } else {
          // Check for bearish reversal pattern
          const hasReversal = recentCandles.some((candle, i) => 
            i > 0 && candle.close < candle.open && candle.close < recentCandles[i-1].close
          );
          
          if (hasReversal) {
            confidence += 15;
            reasoning.push('Bearish reversal pattern confirmed');
          }
        }
      }

      if (!direction || confidence < 70) return null;

      // Calculate entry, SL, TP
      const entryPrice = direction === 'BUY' ? ask : bid;
      const slDistance = atr * this.config.exit.atrMultiplier;
      const stopLoss = direction === 'BUY' ? entryPrice - slDistance : entryPrice + slDistance;
      const takeProfit = direction === 'BUY' ? entryPrice + slDistance * 1.5 : entryPrice - slDistance * 1.5;

      // Determine session
      const utcHour = new Date().getUTCHours();
      const session = utcHour >= 21 || utcHour <= 2 ? 'LATE_US' : 'EARLY_ASIA';

      return {
        symbol,
        direction,
        confidence: Math.min(confidence, 95),
        entryPrice,
        stopLoss,
        takeProfit,
        reasoning,
        regime: 'MEAN_REVERSION',
        session,
        volatility: {
          atr,
          bollingerWidth: bbWidth,
          rsi
        }
      };
    } catch (error) {
      console.error('Mean reversion signal generation failed:', error);
      return null;
    }
  }

  /**
   * Update configuration
   */
  public updateConfig(newConfig: Partial<MeanReversionConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Get current configuration
   */
  public getConfig(): MeanReversionConfig {
    return { ...this.config };
  }

  /**
   * Track active position
   */
  public addPosition(symbol: string, position: any): void {
    this.activePositions.set(symbol, position);
  }

  /**
   * Remove position tracking
   */
  public removePosition(symbol: string): void {
    this.activePositions.delete(symbol);
  }

  /**
   * Get active positions count
   */
  public getActivePositionsCount(): number {
    return this.activePositions.size;
  }
}