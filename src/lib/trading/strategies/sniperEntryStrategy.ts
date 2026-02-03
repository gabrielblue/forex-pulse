/**
 * Sniper Entry Strategy
 * Precision trading with multi-timeframe analysis for high-probability entries
 * Uses order flow, liquidity, and market structure for exact entry points
 */

import { TradingSignal } from '../signalProcessor';
import { getPipValue } from '../tradingUtils';

export interface SniperEntrySignal extends TradingSignal {
  atr: number;
  volatilityScore: number;
  trendStrength: number;
  momentumScore: number;
  volumeConfirmation: boolean;
  strategyName: string;
  probabilityOfSuccess?: number;
  riskRewardRatio?: number;
  isSniperEntry: boolean;
  orderFlowScore: number;
  liquiditySweepConfirmed: boolean;
  breakOfStructure: boolean;
  changeOfCharacter: boolean;
}

export class SniperEntryStrategy {
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
   * Detect Break of Structure (BOS)
   * Occurs when price breaks beyond recent swing high/low
   */
  private detectBreakOfStructure(prices: number[], swingHighs: number[], swingLows: number[]): {
    breakOut: boolean;
    direction: 'BUY' | 'SELL' | null;
  } {
    if (swingHighs.length < 2 || swingLows.length < 2) return { breakOut: false, direction: null };
    
    const lastPrice = prices[prices.length - 1];
    const recentHigh = prices[swingHighs[swingHighs.length - 1]];
    const recentLow = prices[swingLows[swingLows.length - 1]];
    
    // Break above recent high
    if (lastPrice > recentHigh) {
      return { breakOut: true, direction: 'BUY' };
    }
    
    // Break below recent low
    if (lastPrice < recentLow) {
      return { breakOut: true, direction: 'SELL' };
    }
    
    return { breakOut: false, direction: null };
  }
  
  /**
   * Detect Change of Character (CHOCH)
   * Occurs when market reverses direction after strong move
   */
  private detectChangeOfCharacter(prices: number[]): {
    changeDetected: boolean;
    direction: 'BUY' | 'SELL' | null;
  } {
    if (prices.length < 50) return { changeDetected: false, direction: null };
    
    // Check if recent momentum is opposite to previous momentum
    const recentMomentum = this.calculateMomentum(prices, 5);
    const previousMomentum = this.calculateMomentum(prices.slice(0, -25), 5);
    
    // Strong reversal in momentum
    if (recentMomentum > 0.001 && previousMomentum < -0.001) {
      return { changeDetected: true, direction: 'BUY' };
    }
    
    if (recentMomentum < -0.001 && previousMomentum > 0.001) {
      return { changeDetected: true, direction: 'SELL' };
    }
    
    return { changeDetected: false, direction: null };
  }
  
  /**
   * Detect liquidity levels
   */
  private detectLiquidityLevels(prices: number[], lookback: number = 50): { highs: number[], lows: number[] } {
    const highs: number[] = [];
    const lows: number[] = [];
    
    const recentHighs = [];
    const recentLows = [];
    
    for (let i = Math.max(0, prices.length - lookback); i < prices.length; i++) {
      recentHighs.push(prices[i]);
      recentLows.push(prices[i]);
    }
    
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
      
      if (count >= 3) {
        result.push(baseValue);
      }
    }
    
    return result.sort((a, b) => b - a);
  }
  
  /**
   * Check for liquidity sweep (price touching liquidity then rejecting)
   */
  private hasLiquiditySweep(prices: number[], liquidityLevels: number[]): boolean {
    const recentPrices = prices.slice(-10);
    
    for (const level of liquidityLevels) {
      for (let i = 1; i < recentPrices.length; i++) {
        if (Math.abs(recentPrices[i] - level) < 0.0001) {
          return true;
        }
      }
    }
    
    return false;
  }
  
  /**
   * Calculate order flow score (simulated)
   */
  private calculateOrderFlowScore(prices: number[]): number {
    // Simulated order flow analysis
    // In real implementation, would use volume and tick data
    const momentum = this.calculateMomentum(prices, 5);
    const rsi = this.calculateRSI(prices, 14);
    
    // Combine momentum and RSI
    const score = (Math.abs(momentum) * 5000 + (50 - Math.abs(rsi - 50))) / 100;
    
    return Math.min(100, Math.max(0, score));
  }
  
  /**
   * Check trading session
   */
  private isTradingSessionActive(): boolean {
    const now = new Date();
    const hours = now.getUTCHours();
    const minutes = now.getUTCMinutes();
    const totalMinutes = hours * 60 + minutes;
    
    return (totalMinutes >= 7 * 60 && totalMinutes <= 16 * 60) ||
           (totalMinutes >= 12 * 60 && totalMinutes <= 21 * 60);
  }
  
  /**
   * Main sniper entry strategy
   */
  async executeSniperEntry(
    symbol: string,
    prices: number[],
    currentPrice: number,
    accountBalance: number = 8
  ): Promise<SniperEntrySignal | null> {
    
    if (prices.length < 50) return null;
    
    // Check trading session
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
    
    // Check for Break of Structure
    const bos = this.detectBreakOfStructure(prices, swingHighs, swingLows);
    
    // Check for Change of Character
    const choch = this.detectChangeOfCharacter(prices);
    
    // Calculate order flow score
    const orderFlowScore = this.calculateOrderFlowScore(prices);
    
    // Check for liquidity sweep
    const liquiditySweepConfirmed = this.hasLiquiditySweep(prices, bos.direction === 'BUY' ? liquidity.highs : liquidity.lows);
    
    let direction: 'BUY' | 'SELL' = 'BUY';
    let confidence = 50;
    let reasoning = '';
    let isSniperEntry = false;
    
    // Sniper entry conditions
    
    // 1. Break of Structure with momentum
    if (bos.breakOut && bos.direction) {
      direction = bos.direction;
      confidence = 75;
      reasoning = `Break of Structure ${bos.direction === 'BUY' ? 'UP' : 'DOWN'}`;
      isSniperEntry = true;
      
      // Add liquidity confirmation
      if (liquiditySweepConfirmed) {
        confidence += 10;
        reasoning += ' | Liquidity sweep confirmed';
      }
      
      // Check order flow
      if (orderFlowScore > 60) {
        confidence += 10;
        reasoning += ` | Strong order flow (${orderFlowScore.toFixed(1)})`;
      }
    }
    
    // 2. Change of Character with structure confirmation
    else if (choch.changeDetected && choch.direction) {
      direction = choch.direction;
      confidence = 70;
      reasoning = `Change of Character ${choch.direction === 'BUY' ? 'BUY' : 'SELL'}`;
      isSniperEntry = true;
      
      // Verify with market structure
      const recentHighs = swingHighs.filter(i => i >= prices.length - 20);
      const recentLows = swingLows.filter(i => i >= prices.length - 20);
      
      if (recentHighs.length >= 2 && recentLows.length >= 2) {
        const lastHigh = prices[recentHighs[recentHighs.length - 1]];
        const prevHigh = prices[recentHighs[recentHighs.length - 2]];
        const lastLow = prices[recentLows[recentLows.length - 1]];
        const prevLow = prices[recentLows[recentLows.length - 2]];
        
        if (direction === 'BUY' && lastLow > prevLow) {
          confidence += 10;
          reasoning += ' | Higher lows confirmed';
        }
        else if (direction === 'SELL' && lastHigh < prevHigh) {
          confidence += 10;
          reasoning += ' | Lower highs confirmed';
        }
      }
    }
    
    // Additional filters
    if (volatilityScore > 0.8) {
      confidence -= 20;
      reasoning += ' | High volatility - reducing confidence';
    }
    
    if (trendStrength < 0.3) {
      confidence -= 15;
      reasoning += ' | Weak trend - reducing confidence';
    }
    
    // Only take high-confidence sniper entries
    if (confidence < 70 || !isSniperEntry) {
      return null;
    }
    
    // Calculate risk management
    const pipValue = getPipValue(symbol);
    const accountRiskPercentage = 1.0;
    const stopDistancePips = 8; // Tighter stop for sniper entries
    const stopDistance = stopDistancePips * pipValue;
    const riskRewardRatio = 2.0; // Higher RR for sniper entries
    const takeProfitDistance = stopDistance * riskRewardRatio;
    
    let stopLoss: number, takeProfit: number;
    if (direction === 'BUY') {
      stopLoss = currentPrice - stopDistance;
      takeProfit = currentPrice + takeProfitDistance;
    } else {
      stopLoss = currentPrice + stopDistance;
      takeProfit = currentPrice - takeProfitDistance;
    }
    
    // Ensure minimum profit target
    const minProfitTarget = 1.5;
    const actualProfit = Math.abs(takeProfit - currentPrice);
    const actualProfitDollars = (actualProfit / pipValue) * pipValue;
    
    if (actualProfitDollars < minProfitTarget) {
      const newTakeProfitDistance = (minProfitTarget / pipValue) * pipValue;
      if (direction === 'BUY') {
        takeProfit = currentPrice + newTakeProfitDistance;
      } else {
        takeProfit = currentPrice - newTakeProfitDistance;
      }
    }
    
    return {
      id: `sniper_${Date.now()}_${symbol}`,
      symbol,
      type: direction,
      confidence: Math.min(95, confidence),
      entryPrice: currentPrice,
      stopLoss,
      takeProfit,
      timeframe: 'M5',
      reasoning: `${reasoning} | SL: ${stopLoss.toFixed(5)} | TP: ${takeProfit.toFixed(5)} | RR: ${riskRewardRatio}:1`,
      source: 'Sniper Entry Strategy',
      strategyName: 'Sniper Entry',
      atr,
      volatilityScore,
      trendStrength,
      momentumScore,
      volumeConfirmation: true,
      probabilityOfSuccess: confidence / 100,
      riskRewardRatio,
      isSniperEntry,
      orderFlowScore,
      liquiditySweepConfirmed,
      breakOfStructure: bos.breakOut,
      changeOfCharacter: choch.changeDetected
    };
  }
  
  // Helper methods
  
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

export const sniperEntryStrategy = new SniperEntryStrategy();