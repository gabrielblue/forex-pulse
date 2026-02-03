/**
 * Market Regime Detection Module
 * Identifies and classifies current market conditions for better trading decisions
 */

import { exnessAPI } from './exnessApi';
import { multiTimeframeAnalyzer } from './multiTimeframeAnalyzer';

export type MarketRegime = 
  | 'TRENDING_UP' 
  | 'TRENDING_DOWN' 
  | 'RANGING' 
  | 'VOLATILE' 
  | 'QUIET' 
  | 'BREAKOUT_PENDING'
  | 'REVERSAL_IMMINENT'
  | 'UNKNOWN';

export interface RegimeDetectionResult {
  regime: MarketRegime;
  confidence: number; // 0-100
  trendStrength: number; // 0-100
  volatilityLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  adx: number;
  atrPercent: number;
  rsi: number;
  supports: number[];
  resistances: number[];
  keyLevels: { price: number; type: 'SUPPORT' | 'RESISTANCE'; strength: number }[];
  regimeChange: boolean;
  previousRegime?: MarketRegime;
  timestamp: Date;
}

export interface RegimeConfig {
  adxThreshold: number; // Above this = trending
  atrVolatilityThreshold: number; // ATR % threshold for volatility detection
  rsiOverbought: number;
  rsiOversold: number;
  trendStrengthSmoothing: number;
}

class MarketRegimeDetector {
  private config: RegimeConfig = {
    adxThreshold: 25, // ADX above 25 indicates trending
    atrVolatilityThreshold: 0.5, // 0.5% ATR per bar = volatile
    rsiOverbought: 70,
    rsiOversold: 30,
    trendStrengthSmoothing: 14
  };

  private lastRegimeCache: Map<string, RegimeDetectionResult> = new Map();
  private regimeChangeCallbacks: ((symbol: string, result: RegimeDetectionResult) => void)[] = [];

  async initialize(): Promise<void> {
    console.log('📊 MarketRegimeDetector: Initializing...');
    console.log('✅ MarketRegimeDetector: Initialized successfully');
  }

  /**
   * Detect market regime for a symbol
   */
  async detectRegime(symbol: string, timeframes: string[] = ['H1', 'H4', 'D1']): Promise<RegimeDetectionResult> {
    try {
      // Get multi-timeframe analysis
      const mtfAnalysis = await multiTimeframeAnalyzer.analyzeMarketStructure(symbol);
      
      // Get current price data
      const priceData = await exnessAPI.getCurrentPrice(symbol);
      if (!priceData) {
        return this.createUnknownResult(symbol);
      }

      // Calculate indicators
      const atr = await multiTimeframeAnalyzer.calculateATR(symbol, 'H1', 14);
      const atrPercent = (atr / priceData.bid) * 100;
      
      // Estimate ADX from trend strength (since calculateADX doesn't exist)
      const adx = (mtfAnalysis as any).strength || 25;
      
      // Calculate RSI from historical data for accurate regime detection
      const historicalBars = await exnessAPI.getHistoricalData(symbol, 'H1', 50);
      let rsi = 50;
      if (historicalBars && historicalBars.length >= 14) {
        const closes = historicalBars.map((bar: any) => bar.close);
        rsi = this.calculateRSI(closes);
      }

      // Determine trend direction and strength
      const { trendDirection, trendStrength } = this.calculateTrendStrength(mtfAnalysis);
      
      // Determine volatility level
      const volatilityLevel = this.determineVolatilityLevel(atrPercent);
      
      // Detect key levels
      const { supports, resistances, keyLevels } = await this.detectKeyLevels(symbol, priceData.bid);
      
      // Determine overall regime
      const regime = this.determineRegime(
        trendDirection,
        trendStrength,
        volatilityLevel,
        adx,
        rsi,
        mtfAnalysis
      );

      // Check for regime change
      const cachedResult = this.lastRegimeCache.get(symbol);
      const regimeChange = cachedResult?.regime !== regime;

      const result: RegimeDetectionResult = {
        regime,
        confidence: this.calculateConfidence(trendStrength, adx, volatilityLevel),
        trendStrength,
        volatilityLevel,
        adx,
        atrPercent,
        rsi,
        supports,
        resistances,
        keyLevels,
        regimeChange,
        previousRegime: cachedResult?.regime,
        timestamp: new Date()
      };

      // Update cache
      this.lastRegimeCache.set(symbol, result);

      // Notify callbacks if regime changed
      if (regimeChange) {
        this.notifyRegimeChange(symbol, result);
      }

      console.log(`📊 Market regime for ${symbol}: ${regime} (confidence: ${result.confidence}%)`);
      return result;

    } catch (error) {
      console.error(`❌ Error detecting market regime for ${symbol}:`, error);
      return this.createUnknownResult(symbol);
    }
  }

  /**
   * Calculate trend strength from analysis
   */
  private calculateTrendStrength(analysis: any): { trendDirection: 'UP' | 'DOWN' | 'NONE'; trendStrength: number } {
    // Use EMA alignment, momentum, and structure for trend strength
    let strength = 50; // Base strength
    let direction: 'UP' | 'DOWN' | 'NONE' = 'NONE';

    // EMA alignment contribution (40%)
    if (analysis.emaAlignment) {
      if (analysis.emaAlignment === 'BULLISH') {
        direction = 'UP';
        strength += 30;
      } else if (analysis.emaAlignment === 'BEARISH') {
        direction = 'DOWN';
        strength += 30;
      } else {
        strength += 10;
      }
    }

    // Momentum contribution (30%)
    if (analysis.momentum) {
      if (analysis.momentum > 0) {
        strength += Math.min(30, analysis.momentum * 10);
        if (direction === 'NONE') direction = 'UP';
      } else if (analysis.momentum < 0) {
        strength += Math.min(30, Math.abs(analysis.momentum) * 10);
        if (direction === 'NONE') direction = 'DOWN';
      }
    }

    // Structure contribution (30%)
    if (analysis.higherHighsHigherLows) {
      strength += 25;
      direction = 'UP';
    } else if (analysis.lowerHighsLowerLows) {
      strength += 25;
      direction = 'DOWN';
    } else if (analysis.swingHighsSwingsLows) {
      strength += 15;
    }

    return {
      trendDirection: direction,
      trendStrength: Math.min(100, Math.max(0, strength))
    };
  }

  /**
   * Determine volatility level
   */
  private determineVolatilityLevel(atrPercent: number): 'LOW' | 'MEDIUM' | 'HIGH' {
    if (atrPercent < 0.3) return 'LOW';
    if (atrPercent < 0.8) return 'MEDIUM';
    return 'HIGH';
  }

  /**
   * Determine overall market regime
   */
  private determineRegime(
    trendDirection: 'UP' | 'DOWN' | 'NONE',
    trendStrength: number,
    volatilityLevel: 'LOW' | 'MEDIUM' | 'HIGH',
    adx: number,
    rsi: number,
    analysis: any
  ): MarketRegime {
    // High ADX + strong trend = Trending
    if (adx > this.config.adxThreshold && trendStrength > 60) {
      if (trendDirection === 'UP') return 'TRENDING_UP';
      if (trendDirection === 'DOWN') return 'TRENDING_DOWN';
    }

    // High volatility + weak trend = Volatile
    if (volatilityLevel === 'HIGH' && trendStrength < 50) {
      return 'VOLATILE';
    }

    // Breakout pending (tight consolidation) - low volatility + weak trend
    if (volatilityLevel === 'LOW' && trendStrength < 30) {
      return 'BREAKOUT_PENDING';
    }

    // Low volatility = Quiet
    if (volatilityLevel === 'LOW') {
      return 'QUIET';
    }

    // RSI extremes + weak trend = Reversal imminent
    if (trendStrength < 40) {
      if (rsi > this.config.rsiOverbought || rsi < this.config.rsiOversold) {
        return 'REVERSAL_IMMINENT';
      }
    }

    // Low ADX + ranging price action = Ranging
    if (adx < this.config.adxThreshold && trendStrength < 40) {
      return 'RANGING';
    }

    return 'UNKNOWN';
  }

  /**
   * Detect key support and resistance levels
   */
  private async detectKeyLevels(
    symbol: string, 
    currentPrice: number
  ): Promise<{ supports: number[]; resistances: number[]; keyLevels: any[] }> {
    const supports: number[] = [];
    const resistances: number[] = [];
    const keyLevels: any[] = [];

    // Detect pivot points (simplified)
    const pivot = this.calculatePivotPoint(currentPrice);
    const pivots = {
      pivot,
      r1: pivot * 1.002,
      r2: pivot * 1.005,
      r3: pivot * 1.008,
      s1: pivot * 0.998,
      s2: pivot * 0.995,
      s3: pivot * 0.992
    };

    resistances.push(pivots.r1, pivots.r2, pivots.r3);
    supports.push(pivots.s1, pivots.s2, pivots.s3);

    // Create key levels with strength
    keyLevels.push(
      { price: pivots.r3, type: 'RESISTANCE' as const, strength: 80 },
      { price: pivots.r2, type: 'RESISTANCE' as const, strength: 60 },
      { price: pivots.r1, type: 'RESISTANCE' as const, strength: 40 },
      { price: pivot, type: 'SUPPORT' as const, strength: 50 },
      { price: pivots.s1, type: 'SUPPORT' as const, strength: 40 },
      { price: pivots.s2, type: 'SUPPORT' as const, strength: 60 },
      { price: pivots.s3, type: 'SUPPORT' as const, strength: 80 }
    );

    return { supports, resistances, keyLevels };
  }

  /**
   * Calculate pivot point (simplified)
   */
  private calculatePivotPoint(price: number): number {
    // Using a simplified pivot calculation based on current price
    return Math.round(price * 1000) / 1000;
  }

  /**
   * Calculate RSI from price array
   */
  private calculateRSI(prices: number[]): number {
    if (prices.length < 14) {
      return 50;
    }
    
    const period = 14;
    const priceData = prices.slice(-period - 1);
    
    let gains = 0;
    let losses = 0;
    
    for (let i = 1; i < priceData.length; i++) {
      const change = priceData[i] - priceData[i - 1];
      if (change > 0) {
        gains += change;
      } else {
        losses += Math.abs(change);
      }
    }
    
    const avgGain = gains / period;
    const avgLoss = losses / period;
    
    if (avgLoss === 0) return 100;
    
    const rs = avgGain / avgLoss;
    const rsi = 100 - (100 / (1 + rs));
    
    return Math.round(rsi * 100) / 100;
  }

  /**
   * Calculate confidence score
   */
  private calculateConfidence(trendStrength: number, adx: number, volatilityLevel: 'LOW' | 'MEDIUM' | 'HIGH'): number {
    let confidence = 50;

    // Trend strength contribution
    confidence += (trendStrength - 50) * 0.5;

    // ADX contribution
    confidence += (adx - 25) * 0.3;

    // Volatility penalty (high volatility = less confidence)
    if (volatilityLevel === 'HIGH') confidence -= 15;
    if (volatilityLevel === 'LOW') confidence += 10;

    return Math.min(100, Math.max(0, Math.round(confidence)));
  }

  /**
   * Create unknown result
   */
  private createUnknownResult(symbol: string): RegimeDetectionResult {
    return {
      regime: 'UNKNOWN',
      confidence: 0,
      trendStrength: 0,
      volatilityLevel: 'MEDIUM',
      adx: 0,
      atrPercent: 0,
      rsi: 50,
      supports: [],
      resistances: [],
      keyLevels: [],
      regimeChange: false,
      timestamp: new Date()
    };
  }

  /**
   * Get best trading strategy for current regime
   */
  getStrategyForRegime(regime: MarketRegime): string {
    switch (regime) {
      case 'TRENDING_UP':
      case 'TRENDING_DOWN':
        return 'TREND_FOLLOWING - Use moving average crossovers and momentum indicators';
      
      case 'RANGING':
        return 'RANGE_TRADING - Buy support, sell resistance with tight stops';
      
      case 'VOLATILE':
        return 'VOLATILITY_TRADING - Use wider stops, smaller position sizes';
      
      case 'QUIET':
        return 'WAIT_AND_WATCH - Low volatility may indicate breakout pending';
      
      case 'BREAKOUT_PENDING':
        return 'BREAKOUT_TRADING - Prepare for momentum entries on breakout';
      
      case 'REVERSAL_IMMINENT':
        return 'REVERSAL_TRADING - Look for reversal signals at extremes';
      
      default:
        return 'CONSERVATIVE - Trade with reduced position sizes until regime is clear';
    }
  }

  /**
   * Get recommended position size modifier based on regime
   */
  getPositionSizeModifier(regime: MarketRegime): number {
    switch (regime) {
      case 'VOLATILE':
        return 0.5; // Reduce size by 50%
      case 'QUIET':
        return 0.75; // Reduce size by 25%
      case 'BREAKOUT_PENDING':
        return 0.6; // Prepare for reduced size
      case 'REVERSAL_IMMINENT':
        return 0.7; // Moderate reduction
      default:
        return 1.0; // Normal size
    }
  }

  /**
   * Get stop loss distance multiplier based on regime
   */
  getStopLossMultiplier(regime: MarketRegime): number {
    switch (regime) {
      case 'VOLATILE':
        return 1.5; // Wider stops
      case 'QUIET':
        return 0.75; // Tighter stops
      case 'BREAKOUT_PENDING':
        return 0.8; // Tighter until breakout
      default:
        return 1.0; // Normal stops
    }
  }

  /**
   * Register regime change callback
   */
  onRegimeChange(callback: (symbol: string, result: RegimeDetectionResult) => void): void {
    this.regimeChangeCallbacks.push(callback);
  }

  /**
   * Notify all callbacks of regime change
   */
  private notifyRegimeChange(symbol: string, result: RegimeDetectionResult): void {
    this.regimeChangeCallbacks.forEach(callback => {
      try {
        callback(symbol, result);
      } catch (error) {
        console.error('Error in regime change callback:', error);
      }
    });
  }

  /**
   * Get cached regime result for symbol
   */
  getCachedRegime(symbol: string): RegimeDetectionResult | undefined {
    return this.lastRegimeCache.get(symbol);
  }

  /**
   * Get all cached regime results
   */
  getAllCachedRegimes(): Map<string, RegimeDetectionResult> {
    return new Map(this.lastRegimeCache);
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<RegimeConfig>): void {
    this.config = { ...this.config, ...config };
    console.log('✅ Market regime detector config updated');
  }

  /**
   * Get detector status
   */
  getStatus(): any {
    return {
      config: this.config,
      cachedSymbols: this.lastRegimeCache.size,
      regimeChangeListeners: this.regimeChangeCallbacks.length
    };
  }
}

export const marketRegimeDetector = new MarketRegimeDetector();
