/**
 * Market Direction Analyzer
 * Thoroughly studies market direction before taking trades
 * Prevents false signals by analyzing multiple timeframes and indicators
 */

export interface MarketDirection {
  direction: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  confidence: number;
  reasoning: string;
  timeframe: string;
  trendStrength: number;
  momentum: number;
  supportLevel: number;
  resistanceLevel: number;
  isNearSupport: boolean;
  isNearResistance: boolean;
  recommendedAction: 'BUY' | 'SELL' | 'WAIT';
}

export class MarketDirectionAnalyzer {
  /**
   * Analyze market direction across multiple timeframes
   */
  async analyzeMarketDirection(
    symbol: string,
    prices: number[],
    currentPrice: number,
    htfPrices?: number[] // Higher timeframe prices (H1 for M15 analysis)
  ): Promise<MarketDirection> {
    
    if (prices.length < 50) {
      return {
        direction: 'NEUTRAL',
        confidence: 0,
        reasoning: 'Insufficient data',
        timeframe: 'M15',
        trendStrength: 0,
        momentum: 0,
        supportLevel: 0,
        resistanceLevel: 0,
        isNearSupport: false,
        isNearResistance: false,
        recommendedAction: 'WAIT'
      };
    }
    
    // Analyze current timeframe (M15)
    const ltfAnalysis = this.analyzeTimeframe(prices, currentPrice, 'M15');
    
    // Analyze higher timeframe (H1) if available
    let htfAnalysis: MarketDirection | null = null;
    if (htfPrices && htfPrices.length >= 50) {
      htfAnalysis = this.analyzeTimeframe(htfPrices, htfPrices[htfPrices.length - 1], 'H1');
    }
    
    // Combine analyses
    return this.combineAnalyses(ltfAnalysis, htfAnalysis);
  }
  
  /**
   * Analyze a single timeframe
   */
  private analyzeTimeframe(prices: number[], currentPrice: number, timeframe: string): MarketDirection {
    // Calculate key indicators
    const ema20 = this.calculateEMA(prices, 20);
    const ema50 = this.calculateEMA(prices, 50);
    const ema200 = this.calculateEMA(prices, 200);
    
    const rsi = this.calculateRSI(prices, 14);
    const momentum = this.calculateMomentum(prices, 10);
    const atr = this.calculateATR(prices, 14);
    
    // Detect market structure
    const swingHighs = this.detectSwingHighs(prices);
    const swingLows = this.detectSwingLows(prices);
    
    // Calculate support and resistance
    const supportLevel = this.calculateSupportLevel(prices);
    const resistanceLevel = this.calculateResistanceLevel(prices);
    
    const isNearSupport = Math.abs(currentPrice - supportLevel) < atr * 2;
    const isNearResistance = Math.abs(currentPrice - resistanceLevel) < atr * 2;
    
    // Determine trend direction
    let direction: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';
    let confidence = 50;
    let reasoning = '';
    
    // EMA alignment (most important)
    if (ema20 > ema50 && ema50 > ema200) {
      direction = 'BULLISH';
      confidence = 75;
      reasoning = `Strong bullish trend: EMA20(${ema20.toFixed(5)}) > EMA50(${ema50.toFixed(5)}) > EMA200(${ema200.toFixed(5)})`;
    } else if (ema20 < ema50 && ema50 < ema200) {
      direction = 'BEARISH';
      confidence = 75;
      reasoning = `Strong bearish trend: EMA20(${ema20.toFixed(5)}) < EMA50(${ema50.toFixed(5)}) < EMA200(${ema200.toFixed(5)})`;
    } else if (ema20 > ema50) {
      direction = 'BULLISH';
      confidence = 60;
      reasoning = `Moderate bullish: EMA20(${ema20.toFixed(5)}) > EMA50(${ema50.toFixed(5)})`;
    } else if (ema20 < ema50) {
      direction = 'BEARISH';
      confidence = 60;
      reasoning = `Moderate bearish: EMA20(${ema20.toFixed(5)}) < EMA50(${ema50.toFixed(5)})`;
    }
    
    // Market structure confirmation
    const recentHighs = swingHighs.filter(i => i >= prices.length - 20);
    const recentLows = swingLows.filter(i => i >= prices.length - 20);
    
    if (recentHighs.length >= 2 && recentLows.length >= 2) {
      const lastHigh = prices[recentHighs[recentHighs.length - 1]];
      const prevHigh = prices[recentHighs[recentHighs.length - 2]];
      const lastLow = prices[recentLows[recentLows.length - 1]];
      const prevLow = prices[recentLows[recentLows.length - 2]];
      
      if (lastHigh > prevHigh && lastLow > prevLow) {
        // Higher highs and higher lows = bullish
        if (direction === 'BULLISH') {
          confidence += 15;
          reasoning += ' | Confirmed by higher highs and higher lows';
        } else if (direction === 'BEARISH') {
          // Contradiction - reduce confidence
          confidence -= 20;
          reasoning += ' | WARNING: Structure contradicts EMA (higher highs/lows)';
        }
      } else if (lastHigh < prevHigh && lastLow < prevLow) {
        // Lower highs and lower lows = bearish
        if (direction === 'BEARISH') {
          confidence += 15;
          reasoning += ' | Confirmed by lower highs and lower lows';
        } else if (direction === 'BULLISH') {
          // Contradiction - reduce confidence
          confidence -= 20;
          reasoning += ' | WARNING: Structure contradicts EMA (lower highs/lows)';
        }
      }
    }
    
    // RSI confirmation
    if (direction === 'BULLISH') {
      if (rsi > 50 && rsi < 70) {
        confidence += 10;
        reasoning += ` | RSI(${rsi.toFixed(1)}) supports bullish move`;
      } else if (rsi > 70) {
        confidence -= 15;
        reasoning += ` | WARNING: RSI(${rsi.toFixed(1)}) overbought - potential reversal`;
      } else if (rsi < 50) {
        confidence -= 10;
        reasoning += ` | WARNING: RSI(${rsi.toFixed(1)}) doesn't support bullish move`;
      }
    } else if (direction === 'BEARISH') {
      if (rsi < 50 && rsi > 30) {
        confidence += 10;
        reasoning += ` | RSI(${rsi.toFixed(1)}) supports bearish move`;
      } else if (rsi < 30) {
        confidence -= 15;
        reasoning += ` | WARNING: RSI(${rsi.toFixed(1)}) oversold - potential reversal`;
      } else if (rsi > 50) {
        confidence -= 10;
        reasoning += ` | WARNING: RSI(${rsi.toFixed(1)}) doesn't support bearish move`;
      }
    }
    
    // Momentum confirmation
    if (direction === 'BULLISH' && momentum > 0) {
      confidence += 5;
      reasoning += ` | Momentum(${(momentum * 10000).toFixed(2)}%) confirms bullish`;
    } else if (direction === 'BEARISH' && momentum < 0) {
      confidence += 5;
      reasoning += ` | Momentum(${(momentum * 10000).toFixed(2)}%) confirms bearish`;
    } else if (direction === 'BULLISH' && momentum < 0) {
      confidence -= 10;
      reasoning += ` | WARNING: Momentum(${(momentum * 10000).toFixed(2)}%) contradicts bullish`;
    } else if (direction === 'BEARISH' && momentum > 0) {
      confidence -= 10;
      reasoning += ` | WARNING: Momentum(${(momentum * 10000).toFixed(2)}%) contradicts bearish`;
    }
    
    // Support/Resistance analysis
    if (isNearSupport && direction === 'BULLISH') {
      confidence += 10;
      reasoning += ` | Price near support(${supportLevel.toFixed(5)}) - good buy opportunity`;
    } else if (isNearResistance && direction === 'BEARISH') {
      confidence += 10;
      reasoning += ` | Price near resistance(${resistanceLevel.toFixed(5)}) - good sell opportunity`;
    } else if (isNearResistance && direction === 'BULLISH') {
      confidence -= 15;
      reasoning += ` | WARNING: Price near resistance(${resistanceLevel.toFixed(5)}) - risky buy`;
    } else if (isNearSupport && direction === 'BEARISH') {
      confidence -= 15;
      reasoning += ` | WARNING: Price near support(${supportLevel.toFixed(5)}) - risky sell`;
    }
    
    // Calculate trend strength
    const trendStrength = this.calculateTrendStrength(prices);
    
    // Determine recommended action
    let recommendedAction: 'BUY' | 'SELL' | 'WAIT' = 'WAIT';
    
    if (confidence >= 70) {
      recommendedAction = direction === 'BULLISH' ? 'BUY' : 'SELL';
    } else if (confidence >= 60) {
      recommendedAction = 'WAIT'; // Need more confirmation
    } else {
      recommendedAction = 'WAIT'; // Too uncertain
    }
    
    return {
      direction,
      confidence: Math.max(0, Math.min(100, confidence)),
      reasoning,
      timeframe,
      trendStrength,
      momentum,
      supportLevel,
      resistanceLevel,
      isNearSupport,
      isNearResistance,
      recommendedAction
    };
  }
  
  /**
   * Combine lower and higher timeframe analyses
   */
  private combineAnalyses(ltf: MarketDirection, htf: MarketDirection | null): MarketDirection {
    if (!htf) {
      return ltf;
    }
    
    // If both timeframes agree, increase confidence
    if (ltf.direction === htf.direction && ltf.recommendedAction !== 'WAIT') {
      return {
        ...ltf,
        confidence: Math.min(95, ltf.confidence + 10),
        reasoning: `${ltf.reasoning} | HTF(${htf.timeframe}) confirms: ${htf.direction}`,
        recommendedAction: ltf.recommendedAction
      };
    }
    
    // If timeframes disagree, reduce confidence and recommend WAIT
    if (ltf.direction !== htf.direction) {
      return {
        ...ltf,
        confidence: Math.max(0, ltf.confidence - 20),
        reasoning: `${ltf.reasoning} | WARNING: HTF(${htf.timeframe}) disagrees (${htf.direction})`,
        recommendedAction: 'WAIT'
      };
    }
    
    return ltf;
  }
  
  /**
   * Calculate support level
   */
  private calculateSupportLevel(prices: number[]): number {
    const swingLows = this.detectSwingLows(prices);
    if (swingLows.length === 0) return Math.min(...prices);
    
    // Return the most recent swing low
    return prices[swingLows[swingLows.length - 1]];
  }
  
  /**
   * Calculate resistance level
   */
  private calculateResistanceLevel(prices: number[]): number {
    const swingHighs = this.detectSwingHighs(prices);
    if (swingHighs.length === 0) return Math.max(...prices);
    
    // Return the most recent swing high
    return prices[swingHighs[swingHighs.length - 1]];
  }
  
  /**
   * Detect swing highs
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
  
  /**
   * Detect swing lows
   */
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
   * Calculate EMA
   */
  private calculateEMA(prices: number[], period: number): number {
    if (prices.length < period) return prices[prices.length - 1];
    
    const multiplier = 2 / (period + 1);
    let ema = prices[0];
    
    for (let i = 1; i < prices.length; i++) {
      ema = (prices[i] - ema) * multiplier + ema;
    }
    
    return ema;
  }
  
  /**
   * Calculate RSI
   */
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
  
  /**
   * Calculate momentum
   */
  private calculateMomentum(prices: number[], period: number): number {
    if (prices.length < period + 1) return 0;
    
    const currentPrice = prices[prices.length - 1];
    const pastPrice = prices[prices.length - 1 - period];
    
    return (currentPrice - pastPrice) / pastPrice;
  }
  
  /**
   * Calculate ATR
   */
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
  
  /**
   * Calculate trend strength
   */
  private calculateTrendStrength(prices: number[]): number {
    const ema20 = this.calculateEMA(prices, 20);
    const ema50 = this.calculateEMA(prices, 50);
    
    const trendStrength = Math.abs(ema20 - ema50) / ema50;
    
    return Math.min(1, trendStrength * 100);
  }
}

export const marketDirectionAnalyzer = new MarketDirectionAnalyzer();