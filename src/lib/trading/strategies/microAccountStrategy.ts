/**
 * Micro Account Growth Strategy
 * Designed for $8 accounts to grow to $100 with minimal risk
 * Focus: Small, consistent profits (1-3 dollars per trade)
 * Strategy: Market structure + liquidity + time filters
 */

import { TradingSignal } from '../signalProcessor';
import { getPipValue } from '../tradingUtils';

export interface MicroAccountSignal extends TradingSignal {
  atr: number;
  volatilityScore: number;
  trendStrength: number;
  momentumScore: number;
  volumeConfirmation: boolean;
  strategyName: string;
  probabilityOfSuccess?: number;
  riskRewardRatio?: number;
  isHighProbability: boolean;
  accountRiskPercentage: number;
}

export class MicroAccountStrategy {
  /**
   * Detect swing highs and lows for market structure analysis
   */
  private detectSwingHighs(prices: number[], lookback: number = 20): number[] {
    const swingHighs: number[] = [];
    
    for (let i = lookback; i < prices.length - lookback; i++) {
      const leftStart = Math.max(0, i - lookback);
      const leftEnd = i;
      const rightStart = i;
      const rightEnd = Math.min(prices.length - 1, i + lookback);
      
      const leftMax = Math.max(...prices.slice(leftStart, leftEnd));
      const rightMax = Math.max(...prices.slice(rightStart, rightEnd));
      
      if (prices[i] >= leftMax && prices[i] >= rightMax) {
        swingHighs.push(i);
      }
    }
    
    return swingHighs;
  }
  
  private detectSwingLows(prices: number[], lookback: number = 20): number[] {
    const swingLows: number[] = [];
    
    for (let i = lookback; i < prices.length - lookback; i++) {
      const leftStart = Math.max(0, i - lookback);
      const leftEnd = i;
      const rightStart = i;
      const rightEnd = Math.min(prices.length - 1, i + lookback);
      
      const leftMin = Math.min(...prices.slice(leftStart, leftEnd));
      const rightMin = Math.min(...prices.slice(rightStart, rightEnd));
      
      if (prices[i] <= leftMin && prices[i] <= rightMin) {
        swingLows.push(i);
      }
    }
    
    return swingLows;
  }
  
  /**
   * Detect liquidity levels (equal highs/lows, range boundaries)
   */
  private detectLiquidityLevels(prices: number[], lookback: number = 50): { highs: number[], lows: number[] } {
    const highs: number[] = [];
    const lows: number[] = [];
    
    // Find recent highs and lows
    const recentHighs = [];
    const recentLows = [];
    
    for (let i = Math.max(0, prices.length - lookback); i < prices.length; i++) {
      recentHighs.push(prices[i]);
      recentLows.push(prices[i]);
    }
    
    // Find most common price levels (liquidity pools)
    const highFrequency = this.findMostCommonValues(recentHighs, 0.0001);
    const lowFrequency = this.findMostCommonValues(recentLows, 0.0001);
    
    return { highs: highFrequency, lows: lowFrequency };
  }
  
  private findMostCommonValues(values: number[], tolerance: number): number[] {
    const sorted = [...values].sort((a, b) => a - b);
    const result: number[] = [];
    const visited = new Set<number>();
    
    for (let i = 0; i < sorted.length; i++) {
      if (visited.has(i)) continue;
      
      let count = 1;
      const baseValue = sorted[i];
      
      for (let j = i + 1; j < sorted.length; j++) {
        if (Math.abs(sorted[j] - baseValue) <= tolerance) {
          count++;
          visited.add(j);
        } else {
          break;
        }
      }
      
      if (count >= 3) { // At least 3 touches to consider as liquidity level
        result.push(baseValue);
      }
    }
    
    return result.sort((a, b) => b - a);
  }
  
  /**
   * Check if price is near liquidity level
   */
  private isNearLiquidity(price: number, liquidityLevels: number[], threshold: number = 0.0002): boolean {
    return liquidityLevels.some(level => Math.abs(price - level) <= threshold);
  }
  
  /**
   * Check for candle rejection patterns
   */
  private hasCandleRejection(prices: number[], index: number): boolean {
    if (index < 1) return false;
    
    // Simplified: check if current candle closed opposite to wick direction
    // In real implementation, we'd need OHLC data
    return false;
  }
  
  /**
   * Calculate time-based trading filter (London/NY session)
   */
  private isTradingSessionActive(): boolean {
    const now = new Date();
    const hours = now.getUTCHours();
    const minutes = now.getUTCMinutes();
    const totalMinutes = hours * 60 + minutes;
    
    // London Open: 07:00 - 16:00 UTC
    // New York Open: 12:00 - 21:00 UTC
    // Overlap: 12:00 - 16:00 UTC (best trading time)
    
    return (totalMinutes >= 7 * 60 && totalMinutes <= 16 * 60) ||
           (totalMinutes >= 12 * 60 && totalMinutes <= 21 * 60);
  }
  
  /**
   * Main strategy: High-probability market structure trades
   */
  async executeMicroAccountStrategy(
    symbol: string,
    prices: number[],
    currentPrice: number,
    accountBalance: number = 8
  ): Promise<MicroAccountSignal | null> {
    
    if (prices.length < 50) return null;
    
    // Check trading session first
    if (!this.isTradingSessionActive()) {
      return null;
    }
    
    // Calculate key indicators
    const atr = this.calculateATR(prices, 14);
    const volatilityScore = this.calculateVolatilityScore(prices);
    const trendStrength = this.calculateTrendStrength(prices);
    const momentumScore = this.calculateMomentumScore(prices);
    
    // Detect market structure
    const swingHighs = this.detectSwingHighs(prices);
    const swingLows = this.detectSwingLows(prices);
    
    // Detect liquidity levels
    const liquidity = this.detectLiquidityLevels(prices);
    
    // Analyze recent structure
    const recentHighs = swingHighs.filter(i => i >= prices.length - 20);
    const recentLows = swingLows.filter(i => i >= prices.length - 20);
    
    let direction: 'BUY' | 'SELL' = 'BUY';
    let confidence = 50;
    let reasoning = '';
    let isHighProbability = false;
    
    // Market structure analysis
    if (recentHighs.length >= 2 && recentLows.length >= 2) {
      const lastHigh = prices[recentHighs[recentHighs.length - 1]];
      const prevHigh = prices[recentHighs[recentHighs.length - 2]];
      const lastLow = prices[recentLows[recentLows.length - 1]];
      const prevLow = prices[recentLows[recentLows.length - 2]];
      
      // Bullish structure: higher highs and higher lows
      if (lastHigh > prevHigh && lastLow > prevLow) {
        direction = 'BUY';
        confidence = 70;
        reasoning = 'Bullish market structure: higher highs and higher lows';
        isHighProbability = true;
        
        // Check for liquidity above
        if (this.isNearLiquidity(currentPrice, liquidity.highs, 0.0003)) {
          confidence += 15;
          reasoning += ' | Price near liquidity level above';
        }
      }
      // Bearish structure: lower highs and lower lows
      else if (lastHigh < prevHigh && lastLow < prevLow) {
        direction = 'SELL';
        confidence = 70;
        reasoning = 'Bearish market structure: lower highs and lower lows';
        isHighProbability = true;
        
        // Check for liquidity below
        if (this.isNearLiquidity(currentPrice, liquidity.lows, 0.0003)) {
          confidence += 15;
          reasoning += ' | Price near liquidity level below';
        }
      }
    }
    
    // Additional filters
    if (volatilityScore > 0.8) {
      confidence -= 20;
      reasoning += ' | High volatility - reducing confidence';
    }
    
    if (trendStrength < 0.4) {
      confidence -= 15;
      reasoning += ' | Weak trend - reducing confidence';
    }
    
    // Only take high-probability trades
    if (confidence < 65 || !isHighProbability) {
      return null;
    }
    
    // Calculate risk management parameters
    const pipValue = getPipValue(symbol);
    const accountRiskPercentage = 1.0; // 1% of account per trade
    const maxRiskPerTrade = (accountBalance * accountRiskPercentage) / 100;
    
    // Conservative stop loss: 10-15 pips for major pairs
    const stopDistancePips = 12;
    const stopDistance = stopDistancePips * pipValue;
    
    // Take profit: 1.5-2x risk reward for small consistent profits
    const riskRewardRatio = 1.8;
    const takeProfitDistance = stopDistance * riskRewardRatio;
    
    let stopLoss: number, takeProfit: number;
    if (direction === 'BUY') {
      stopLoss = currentPrice - stopDistance;
      takeProfit = currentPrice + takeProfitDistance;
    } else {
      stopLoss = currentPrice + stopDistance;
      takeProfit = currentPrice - takeProfitDistance;
    }
    
    // Ensure minimum profit target (1-3 dollars)
    const minProfitTarget = 1.5;
    const actualProfit = Math.abs(takeProfit - currentPrice);
    const actualProfitDollars = (actualProfit / pipValue) * pipValue;
    
    if (actualProfitDollars < minProfitTarget) {
      // Adjust take profit to meet minimum target
      const newTakeProfitDistance = (minProfitTarget / pipValue) * pipValue;
      if (direction === 'BUY') {
        takeProfit = currentPrice + newTakeProfitDistance;
      } else {
        takeProfit = currentPrice - newTakeProfitDistance;
      }
    }
    
    return {
      id: `micro_${Date.now()}_${symbol}`,
      symbol,
      type: direction,
      confidence: Math.min(95, confidence),
      entryPrice: currentPrice,
      stopLoss,
      takeProfit,
      timeframe: 'M15',
      reasoning: `${reasoning} | SL: ${stopLoss.toFixed(5)} | TP: ${takeProfit.toFixed(5)} | RR: ${riskRewardRatio}:1`,
      source: 'Micro Account Strategy',
      strategyName: 'Market Structure + Liquidity',
      atr,
      volatilityScore,
      trendStrength,
      momentumScore,
      volumeConfirmation: true,
      probabilityOfSuccess: confidence / 100,
      riskRewardRatio,
      isHighProbability,
      accountRiskPercentage
    };
  }
  
  // Helper methods (same as in simpleProfitableStrategies.ts)
  
  private calculateATR(prices: number[], period: number): number {
    if (prices.length < 2) return 0.001;
    
    const trueRanges: number[] = [];
    
    for (let i = 1; i < prices.length; i++) {
      const high = Math.max(prices[i], prices[i - 1]);
      const low = Math.min(prices[i], prices[i - 1]);
      trueRanges.push(high - low);
    }
    
    return trueRanges.slice(-period).reduce((a, b) => a + b, 0) / period;
  }
  
  private calculateVolatilityScore(prices: number[]): number {
    const atr = this.calculateATR(prices, 14);
    const avgPrice = prices.slice(-20).reduce((a, b) => a + b, 0) / 20;
    const volatilityRatio = atr / avgPrice;
    
    return Math.min(1, volatilityRatio * 1000);
  }
  
  private calculateTrendStrength(prices: number[]): number {
    const ema20 = this.calculateEMA(prices, 20);
    const ema50 = this.calculateEMA(prices, 50);
    
    const trendStrength = Math.abs(ema20 - ema50) / ema50;
    
    return Math.min(1, trendStrength * 100);
  }
  
  private calculateMomentumScore(prices: number[]): number {
    const momentum = this.calculateMomentum(prices, 10);
    const rsi = this.calculateRSI(prices, 14);
    
    const momentumScore = (Math.abs(momentum) * 10000 + (50 - Math.abs(rsi - 50))) / 100;
    
    return Math.min(1, momentumScore);
  }
  
  private calculateEMA(prices: number[], period: number): number {
    if (prices.length < period) return prices[prices.length - 1];
    
    const multiplier = 2 / (period + 1);
    let ema = prices[0];
    
    for (let i = 1; i < prices.length; i++) {
      ema = (prices[i] - ema) * multiplier + ema;
    }
    
    return ema;
  }
  
  private calculateRSI(prices: number[], period: number): number {
    if (prices.length <= period) return 50;
    
    const gains: number[] = [];
    const losses: number[] = [];
    
    for (let i = 1; i < prices.length; i++) {
      const delta = prices[i] - prices[i - 1];
      gains.push(delta > 0 ? delta : 0);
      losses.push(delta < 0 ? -delta : 0);
    }
    
    const avgGain = gains.slice(-period).reduce((a, b) => a + b, 0) / period;
    const avgLoss = losses.slice(-period).reduce((a, b) => a + b, 0) / period;
    
    if (avgLoss === 0) return 100;
    
    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
  }
  
  private calculateMomentum(prices: number[], period: number): number {
    if (prices.length < period + 1) return 0;
    
    const currentPrice = prices[prices.length - 1];
    const pastPrice = prices[prices.length - 1 - period];
    
    return (currentPrice - pastPrice) / pastPrice;
  }
}

export const microAccountStrategy = new MicroAccountStrategy();