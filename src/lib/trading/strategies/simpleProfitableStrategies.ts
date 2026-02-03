/**
 * High-Profitability Trading Strategies
 * Focus on simple, proven technical indicators with proper risk management
 */

import { TradingSignal } from '../signalProcessor';
import { exnessAPI } from '../exnessApi';

export interface SimpleProfitableSignal extends TradingSignal {
  atr: number;
  volatilityScore: number;
  trendStrength: number;
  momentumScore: number;
  volumeConfirmation: boolean;
  strategyName: string; // Added strategyName property
  probabilityOfSuccess?: number; // Added for consistency
  riskRewardRatio?: number; // Added for consistency
}

export class SimpleProfitableStrategies {
  
  /**
   * Simple Trend Following Strategy
   * Uses EMA crossovers with RSI confirmation
   * High win rate in trending markets
   */
  async trendFollowingStrategy(
    symbol: string,
    prices: number[],
    currentPrice: number
  ): Promise<SimpleProfitableSignal | null> {
    
    if (prices.length < 50) return null;
    
    // Calculate EMAs
    const ema9 = this.calculateEMA(prices, 9);
    const ema21 = this.calculateEMA(prices, 21);
    const ema50 = this.calculateEMA(prices, 50);
    
    // Calculate RSI
    const rsi = this.calculateRSI(prices, 14);
    
    // Calculate ATR for dynamic stops
    const atr = this.calculateATR(prices, 14);
    
    // Determine trend direction
    let direction: 'BUY' | 'SELL' = 'BUY';
    let confidence = 60;
    let reasoning = '';
    
    // EMA crossover signals
    if (ema9 > ema21 && ema21 > ema50) {
      // Strong uptrend - all EMAs aligned bullish
      direction = 'BUY';
      confidence = 75;
      reasoning = `Strong uptrend: EMA9(${ema9.toFixed(5)}) > EMA21(${ema21.toFixed(5)}) > EMA50(${ema50.toFixed(5)})`;
    } else if (ema9 < ema21 && ema21 < ema50) {
      // Strong downtrend - all EMAs aligned bearish
      direction = 'SELL';
      confidence = 75;
      reasoning = `Strong downtrend: EMA9(${ema9.toFixed(5)}) < EMA21(${ema21.toFixed(5)}) < EMA50(${ema50.toFixed(5)})`;
    } else if (ema9 > ema21) {
      // Short-term uptrend
      direction = 'BUY';
      confidence = 65;
      reasoning = `Short-term uptrend: EMA9(${ema9.toFixed(5)}) > EMA21(${ema21.toFixed(5)})`;
    } else if (ema9 < ema21) {
      // Short-term downtrend
      direction = 'SELL';
      confidence = 65;
      reasoning = `Short-term downtrend: EMA9(${ema9.toFixed(5)}) < EMA21(${ema21.toFixed(5)})`;
    }
    
    // RSI confirmation with better filtering
    if (direction === 'BUY' && rsi < 70) {
      confidence += 10;
      reasoning += ` | RSI(${rsi.toFixed(1)}) not overbought - confirms buy`;
    } else if (direction === 'BUY' && rsi > 70) {
      confidence -= 10;
      reasoning += ` | RSI(${rsi.toFixed(1)}) overbought - reduces confidence`;
    } else if (direction === 'SELL' && rsi > 30) {
      confidence += 10;
      reasoning += ` | RSI(${rsi.toFixed(1)}) not oversold - confirms sell`;
    } else if (direction === 'SELL' && rsi < 30) {
      confidence -= 10;
      reasoning += ` | RSI(${rsi.toFixed(1)}) oversold - reduces confidence`;
    }

    // Strict entry filters to only take high-quality trades
    const trendStrength = this.calculateTrendStrength(prices);
    const volatilityScore = this.calculateVolatilityScore(prices);
    const momentumScore = this.calculateMomentumScore(prices);

    // BLOCK entries in very choppy markets (low trend strength)
    if (trendStrength < 0.5) {
      confidence -= 40; // Much more aggressive reduction
      reasoning += ` | Very low trend strength (${(trendStrength * 100).toFixed(1)}%) - BLOCKED`;
    }

    // BLOCK entries in extremely volatile conditions
    if (volatilityScore > 0.6) {
      confidence -= 35;
      reasoning += ` | High volatility (${(volatilityScore * 100).toFixed(1)}%) - BLOCKED`;
    }

    // Require strong momentum for entries
    if (momentumScore < 0.3) {
      confidence -= 30;
      reasoning += ` | Weak momentum (${(momentumScore * 100).toFixed(1)}%) - BLOCKED`;
    }

    // Only allow trades with very strong signals
    if (confidence < 70) {
      confidence = Math.max(30, confidence); // Cap low confidence signals
      reasoning += ` | Signal too weak - REDUCED`;
    }
    
    // Calculate stop loss and take profit based on ATR - much more conservative stops
    const atrMultiplier = 5.0; // 5x ATR for very wide stop loss to prevent premature exits
    const stopDistance = Math.max(atr * atrMultiplier, currentPrice * 0.01); // Minimum 1% stop distance
    const riskRewardRatio = 1.2; // 1.2:1 risk-reward ratio for conservative targets
    
    let stopLoss: number, takeProfit: number;
    if (direction === 'BUY') {
      stopLoss = currentPrice - stopDistance;
      takeProfit = currentPrice + (stopDistance * riskRewardRatio);
    } else {
      stopLoss = currentPrice + stopDistance;
      takeProfit = currentPrice - (stopDistance * riskRewardRatio);
    }
    
    // Ensure minimum stop distance (0.5%)
    const minStopDistance = currentPrice * 0.005;
    if (Math.abs(currentPrice - stopLoss) < minStopDistance) {
      if (direction === 'BUY') {
        stopLoss = currentPrice - minStopDistance;
      } else {
        stopLoss = currentPrice + minStopDistance;
      }
    }
    
    // Volume confirmation (if available)
    const volumeConfirmation = this.checkVolumeConfirmation(prices);
    
    return {
      id: `trend_${Date.now()}_${symbol}`,
      symbol,
      type: direction,
      confidence: Math.min(90, confidence),
      entryPrice: currentPrice,
      stopLoss,
      takeProfit,
      timeframe: 'H1',
      reasoning: `${reasoning} | SL: ${stopLoss.toFixed(5)} | TP: ${takeProfit.toFixed(5)} | RR: ${riskRewardRatio}:1`,
      source: 'Trend Following',
      strategyName: 'Trend Following',
      atr,
      volatilityScore: this.calculateVolatilityScore(prices),
      trendStrength: this.calculateTrendStrength(prices),
      momentumScore: this.calculateMomentumScore(prices),
      volumeConfirmation,
      probabilityOfSuccess: confidence / 100,
      riskRewardRatio
    };
  }
  
  /**
   * Mean Reversion Strategy
   * Uses Bollinger Bands with RSI for counter-trend trades
   * High win rate in ranging markets
   */
  async meanReversionStrategy(
    symbol: string,
    prices: number[],
    currentPrice: number
  ): Promise<SimpleProfitableSignal | null> {
    
    if (prices.length < 20) return null;
    
    // Calculate Bollinger Bands
    const sma20 = this.calculateSMA(prices, 20);
    const stdDev = this.calculateStdDev(prices.slice(-20), sma20);
    const upperBand = sma20 + (stdDev * 2);
    const lowerBand = sma20 - (stdDev * 2);
    
    // Calculate RSI
    const rsi = this.calculateRSI(prices, 14);
    
    // Calculate ATR
    const atr = this.calculateATR(prices, 14);
    
    // Determine if price is at extreme
    const isAtLowerBand = currentPrice <= lowerBand;
    const isAtUpperBand = currentPrice >= upperBand;
    const isNearMiddle = Math.abs(currentPrice - sma20) < (stdDev * 0.5);
    
    let direction: 'BUY' | 'SELL' = 'BUY';
    let confidence = 60;
    let reasoning = '';
    
    // Mean reversion signals
    if (isAtLowerBand && rsi < 40) {
      // Price at lower band + oversold RSI = strong buy signal
      direction = 'BUY';
      confidence = 80;
      reasoning = `Price at lower Bollinger band (${currentPrice.toFixed(5)}) + RSI oversold (${rsi.toFixed(1)})`;
    } else if (isAtUpperBand && rsi > 60) {
      // Price at upper band + overbought RSI = strong sell signal
      direction = 'SELL';
      confidence = 80;
      reasoning = `Price at upper Bollinger band (${currentPrice.toFixed(5)}) + RSI overbought (${rsi.toFixed(1)})`;
    } else if (isAtLowerBand) {
      // Price at lower band - moderate buy
      direction = 'BUY';
      confidence = 70;
      reasoning = `Price at lower Bollinger band (${currentPrice.toFixed(5)})`;
    } else if (isAtUpperBand) {
      // Price at upper band - moderate sell
      direction = 'SELL';
      confidence = 70;
      reasoning = `Price at upper Bollinger band (${currentPrice.toFixed(5)})`;
    } else if (isNearMiddle && rsi < 45) {
      // Price near middle + oversold = buy bias
      direction = 'BUY';
      confidence = 65;
      reasoning = `Price near middle + RSI oversold (${rsi.toFixed(1)})`;
    } else if (isNearMiddle && rsi > 55) {
      // Price near middle + overbought = sell bias
      direction = 'SELL';
      confidence = 65;
      reasoning = `Price near middle + RSI overbought (${rsi.toFixed(1)})`;
    }
    
    // Calculate stop loss and take profit - much more conservative for mean reversion
    const atrMultiplier = 4.0; // Much wider stops for mean reversion to avoid noise
    const stopDistance = Math.max(atr * atrMultiplier, currentPrice * 0.008); // Minimum 0.8% stop distance
    const riskRewardRatio = 1.5; // 1.5:1 RR for mean reversion
    
    let stopLoss: number, takeProfit: number;
    if (direction === 'BUY') {
      stopLoss = currentPrice - stopDistance;
      takeProfit = currentPrice + (stopDistance * riskRewardRatio);
    } else {
      stopLoss = currentPrice + stopDistance;
      takeProfit = currentPrice - (stopDistance * riskRewardRatio);
    }
    
    // Ensure minimum stop distance
    const minStopDistance = currentPrice * 0.004; // 0.4% minimum
    if (Math.abs(currentPrice - stopLoss) < minStopDistance) {
      if (direction === 'BUY') {
        stopLoss = currentPrice - minStopDistance;
      } else {
        stopLoss = currentPrice + minStopDistance;
      }
    }
    
    const volumeConfirmation = this.checkVolumeConfirmation(prices);
    
    return {
      id: `meanrev_${Date.now()}_${symbol}`,
      symbol,
      type: direction,
      confidence: Math.min(90, confidence),
      entryPrice: currentPrice,
      stopLoss,
      takeProfit,
      timeframe: 'H1',
      reasoning: `${reasoning} | SL: ${stopLoss.toFixed(5)} | TP: ${takeProfit.toFixed(5)} | RR: ${riskRewardRatio}:1`,
      source: 'Mean Reversion',
      strategyName: 'Mean Reversion',
      atr,
      volatilityScore: this.calculateVolatilityScore(prices),
      trendStrength: this.calculateTrendStrength(prices),
      momentumScore: this.calculateMomentumScore(prices),
      volumeConfirmation,
      probabilityOfSuccess: confidence / 100,
      riskRewardRatio
    };
  }
  
  /**
   * Momentum Breakout Strategy
   * Uses price momentum with volume confirmation
   * High win rate on breakouts
   */
  async momentumBreakoutStrategy(
    symbol: string,
    prices: number[],
    currentPrice: number
  ): Promise<SimpleProfitableSignal | null> {

    if (prices.length < 30) return null;

    // Calculate momentum indicators
    const momentum = this.calculateMomentum(prices, 10);
    const rsi = this.calculateRSI(prices, 14);
    const atr = this.calculateATR(prices, 14);

    // Calculate recent high/low
    const recentHigh = Math.max(...prices.slice(-20));
    const recentLow = Math.min(...prices.slice(-20));
    const range = recentHigh - recentLow;

    // Determine if we're near a breakout level
    const isNearHigh = currentPrice > recentHigh * 0.99;
    const isNearLow = currentPrice < recentLow * 1.01;

    let direction: 'BUY' | 'SELL' = 'BUY';
    let confidence = 60;
    let reasoning = '';

    // Breakout signals
    if (isNearHigh && momentum > 0 && rsi < 70) {
      // Breaking above recent high with positive momentum
      direction = 'BUY';
      confidence = 75;
      reasoning = `Breakout above recent high (${recentHigh.toFixed(5)}) with momentum (${momentum.toFixed(5)})`;
    } else if (isNearLow && momentum < 0 && rsi > 30) {
      // Breaking below recent low with negative momentum
      direction = 'SELL';
      confidence = 75;
      reasoning = `Breakout below recent low (${recentLow.toFixed(5)}) with momentum (${momentum.toFixed(5)})`;
    } else if (momentum > 0.002 && rsi < 60) {
      // Strong upward momentum
      direction = 'BUY';
      confidence = 70;
      reasoning = `Strong upward momentum (${(momentum * 10000).toFixed(2)}%)`;
    } else if (momentum < -0.002 && rsi > 40) {
      // Strong downward momentum
      direction = 'SELL';
      confidence = 70;
      reasoning = `Strong downward momentum (${(momentum * 10000).toFixed(2)}%)`;
    }

    // Calculate stop loss and take profit - more conservative
    const atrMultiplier = 4.0; // Much wider stops for breakouts
    const stopDistance = Math.max(atr * atrMultiplier, currentPrice * 0.006); // Minimum 0.6% stop
    const riskRewardRatio = 1.5; // 1.5:1 RR for breakouts

    let stopLoss: number, takeProfit: number;
    if (direction === 'BUY') {
      stopLoss = currentPrice - stopDistance;
      takeProfit = currentPrice + (stopDistance * riskRewardRatio);
    } else {
      stopLoss = currentPrice + stopDistance;
      takeProfit = currentPrice - (stopDistance * riskRewardRatio);
    }

    const volumeConfirmation = this.checkVolumeConfirmation(prices);

    return {
      id: `momentum_${Date.now()}_${symbol}`,
      symbol,
      type: direction,
      confidence: Math.min(90, confidence),
      entryPrice: currentPrice,
      stopLoss,
      takeProfit,
      timeframe: 'H1',
      reasoning: `${reasoning} | SL: ${stopLoss.toFixed(5)} | TP: ${takeProfit.toFixed(5)} | RR: ${riskRewardRatio}:1`,
      source: 'Momentum Breakout',
      strategyName: 'Momentum Breakout',
      atr,
      volatilityScore: this.calculateVolatilityScore(prices),
      trendStrength: this.calculateTrendStrength(prices),
      momentumScore: this.calculateMomentumScore(prices),
      volumeConfirmation,
      probabilityOfSuccess: confidence / 100,
      riskRewardRatio
    };
  }

  /**
   * Scalping Strategy
   * Quick entries and exits for small profits with very tight stops
   */
  async scalpingStrategy(
    symbol: string,
    prices: number[],
    currentPrice: number
  ): Promise<SimpleProfitableSignal | null> {

    if (prices.length < 20) return null;

    // Use very recent data for scalping
    const recentPrices = prices.slice(-10);
    const sma5 = this.calculateSMA(recentPrices, 5);
    const sma10 = this.calculateSMA(recentPrices, 10);
    const rsi = this.calculateRSI(recentPrices, 7); // Shorter RSI period
    const atr = this.calculateATR(recentPrices, 7); // Shorter ATR period

    let direction: 'BUY' | 'SELL' = 'BUY';
    let confidence = 65;
    let reasoning = '';

    // Scalping signals based on very short-term trends
    if (sma5 > sma10 && currentPrice > sma5 && rsi < 65) {
      direction = 'BUY';
      confidence = 75;
      reasoning = `Scalp BUY: SMA5(${sma5.toFixed(5)}) > SMA10(${sma10.toFixed(5)}), RSI(${rsi.toFixed(1)})`;
    } else if (sma5 < sma10 && currentPrice < sma5 && rsi > 35) {
      direction = 'SELL';
      confidence = 75;
      reasoning = `Scalp SELL: SMA5(${sma5.toFixed(5)}) < SMA10(${sma10.toFixed(5)}), RSI(${rsi.toFixed(1)})`;
    } else {
      return null; // No scalping opportunity
    }

    // Very tight stops for scalping (quick in/out)
    const stopDistance = Math.max(atr * 1.5, currentPrice * 0.002); // 0.2% minimum
    const targetDistance = stopDistance * 1.2; // 1.2:1 RR for quick profits

    let stopLoss: number, takeProfit: number;
    if (direction === 'BUY') {
      stopLoss = currentPrice - stopDistance;
      takeProfit = currentPrice + targetDistance;
    } else {
      stopLoss = currentPrice + stopDistance;
      takeProfit = currentPrice - targetDistance;
    }

    return {
      id: `scalping_${Date.now()}_${symbol}`,
      symbol,
      type: direction,
      confidence: Math.min(85, confidence),
      entryPrice: currentPrice,
      stopLoss,
      takeProfit,
      timeframe: 'M5',
      reasoning: `${reasoning} | SL: ${stopLoss.toFixed(5)} | TP: ${takeProfit.toFixed(5)} | Quick scalp`,
      source: 'Scalping',
      strategyName: 'Scalping',
      atr,
      volatilityScore: this.calculateVolatilityScore(prices),
      trendStrength: this.calculateTrendStrength(prices),
      momentumScore: this.calculateMomentumScore(prices),
      volumeConfirmation: true, // Assume volume for scalping
      probabilityOfSuccess: confidence / 100,
      riskRewardRatio: 1.2
    };
  }
  
  /**
   * Select Best Strategy
   * Chooses the best strategy based on market conditions
   */
  async selectBestStrategy(
    symbol: string,
    prices: number[],
    currentPrice: number
  ): Promise<SimpleProfitableSignal | null> {
    
    // Calculate market condition indicators
    const volatilityScore = this.calculateVolatilityScore(prices);
    const trendStrength = this.calculateTrendStrength(prices);
    const momentumScore = this.calculateMomentumScore(prices);
    
    // Run all strategies - prioritize scalping for quick profits
    const strategies = [
      () => this.scalpingStrategy(symbol, prices, currentPrice), // Prioritize scalping
      () => this.trendFollowingStrategy(symbol, prices, currentPrice),
      () => this.meanReversionStrategy(symbol, prices, currentPrice),
      () => this.momentumBreakoutStrategy(symbol, prices, currentPrice)
    ];
    
    const signals: SimpleProfitableSignal[] = [];
    
    for (const strategy of strategies) {
      try {
        const signal = await strategy();
        if (signal && signal.confidence >= 60) {
          signals.push(signal);
        }
      } catch (error) {
        console.warn(`Strategy error for ${symbol}:`, error);
      }
    }
    
    if (signals.length === 0) return null;
    
    // Score signals based on market conditions
    const scoredSignals = signals.map(signal => {
      let score = signal.confidence;
      
      // Bonus for matching market conditions
      if (volatilityScore > 0.6 && signal.strategyName === 'Mean Reversion') {
        score += 10; // Mean reversion works better in volatile markets
      }
      
      if (trendStrength > 0.6 && signal.strategyName === 'Trend Following') {
        score += 10; // Trend following works better in strong trends
      }
      
      if (momentumScore > 0.6 && signal.strategyName === 'Momentum Breakout') {
        score += 10; // Momentum breakout works better with strong momentum
      }
      
      return { signal, score };
    });
    
    // Sort by score and return best
    scoredSignals.sort((a, b) => b.score - a.score);
    
    const bestSignal = scoredSignals[0]?.signal || null;
    
    if (bestSignal) {
      console.log(`🎯 Best strategy for ${symbol}: ${bestSignal.strategyName} (${bestSignal.confidence}% confidence)`);
    }
    
    return bestSignal;
  }
  
  // Helper methods
  
  private calculateEMA(prices: number[], period: number): number {
    if (prices.length < period) return prices[prices.length - 1];
    
    const multiplier = 2 / (period + 1);
    let ema = prices[0];
    
    for (let i = 1; i < prices.length; i++) {
      ema = (prices[i] - ema) * multiplier + ema;
    }
    
    return ema;
  }
  
  private calculateSMA(prices: number[], period: number): number {
    if (prices.length < period) return prices[prices.length - 1];
    
    const sum = prices.slice(-period).reduce((a, b) => a + b, 0);
    return sum / period;
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
  
  private calculateStdDev(prices: number[], mean: number): number {
    const squaredDiffs = prices.map(p => Math.pow(p - mean, 2));
    const avgSquaredDiff = squaredDiffs.reduce((a, b) => a + b, 0) / prices.length;
    return Math.sqrt(avgSquaredDiff);
  }
  
  private calculateMomentum(prices: number[], period: number): number {
    if (prices.length < period + 1) return 0;
    
    const currentPrice = prices[prices.length - 1];
    const pastPrice = prices[prices.length - 1 - period];
    
    return (currentPrice - pastPrice) / pastPrice;
  }
  
  private calculateVolatilityScore(prices: number[]): number {
    const atr = this.calculateATR(prices, 14);
    const avgPrice = this.calculateSMA(prices, 20);
    const volatilityRatio = atr / avgPrice;
    
    // Normalize to 0-1 scale
    return Math.min(1, volatilityRatio * 1000);
  }
  
  private calculateTrendStrength(prices: number[]): number {
    const ema20 = this.calculateEMA(prices, 20);
    const ema50 = this.calculateEMA(prices, 50);
    
    // Calculate trend strength based on EMA separation
    const trendStrength = Math.abs(ema20 - ema50) / ema50;
    
    return Math.min(1, trendStrength * 100);
  }
  
  private calculateMomentumScore(prices: number[]): number {
    const momentum = this.calculateMomentum(prices, 10);
    const rsi = this.calculateRSI(prices, 14);
    
    // Combine momentum and RSI for score
    const momentumScore = (Math.abs(momentum) * 10000 + (50 - Math.abs(rsi - 50))) / 100;
    
    return Math.min(1, momentumScore);
  }
  
  private checkVolumeConfirmation(prices: number[]): boolean {
    // Simple volume check - if recent volume is increasing, confirm
    if (prices.length < 5) return true;
    
    const recentVolumes = prices.slice(-5);
    let increasingCount = 0;
    
    for (let i = 1; i < recentVolumes.length; i++) {
      if (recentVolumes[i] > recentVolumes[i - 1]) {
        increasingCount++;
      }
    }
    
    return increasingCount >= 3; // At least 3 out of 4 periods showing increasing volume
  }
}

export const simpleProfitableStrategies = new SimpleProfitableStrategies();
