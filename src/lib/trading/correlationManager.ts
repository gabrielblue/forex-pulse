/**
 * Correlation Manager for Forex Trading Bot
 * Implements correlated and inversely correlated pair relationships
 * to improve signal quality and prevent overtrading
 */

import { exnessAPI } from './exnessApi';
import { getPipValue } from './tradingUtils';

export interface CorrelationData {
  pair1: string;
  pair2: string;
  correlation: number; // -1 to 1
  type: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL';
  lastUpdated: number;
}

export interface CurrencyExposure {
  currency: string;
  exposure: number; // Total volume in lots
  maxExposure: number; // Maximum allowed exposure
}

export interface CorrelationConfig {
  rollingWindow: number; // Candles for correlation calculation (30-90)
  positiveThreshold: number; // > 0.6 for positive correlation
  negativeThreshold: number; // < -0.6 for negative correlation
  confirmationRequired: boolean; // Require correlated pair confirmation
  maxCurrencyExposure: Record<string, number>; // Max exposure per currency (e.g. USD: 30%)
  goldRules: {
    requireUsdWeak: boolean; // Only trade XAUUSD if USD weak
    requireJpyConfirm: boolean; // Require JPY confirmation for risk-off
  };
}

export interface MarketRegime {
  isRiskOn: boolean;
  isRiskOff: boolean;
  dominantDirection: 'BUY' | 'SELL' | 'NEUTRAL';
}

class CorrelationManager {
  private correlations: Map<string, CorrelationData> = new Map();
  private currencyExposures: Map<string, CurrencyExposure> = new Map();
  private config: CorrelationConfig = {
    rollingWindow: 60, // 60 candles for correlation
    positiveThreshold: 0.6,
    negativeThreshold: -0.6,
    confirmationRequired: true,
    maxCurrencyExposure: {
      'USD': 0.3, // 30% max exposure to USD
      'EUR': 0.25,
      'GBP': 0.25,
      'JPY': 0.2,
      'CHF': 0.2,
      'AUD': 0.2,
      'NZD': 0.15,
      'CAD': 0.15,
      'XAU': 0.1 // Gold limited to 10%
    },
    goldRules: {
      requireUsdWeak: true,
      requireJpyConfirm: true
    }
  };

  // Predefined pair relationships based on forex knowledge
  private readonly pairRelationships: Record<string, { positive: string[], negative: string[] }> = {
    'EURUSD': {
      positive: ['GBPUSD', 'EURAUD', 'EURJPY'],
      negative: ['USDCHF', 'USDJPY']
    },
    'GBPUSD': {
      positive: ['EURUSD', 'GBPJPY', 'GBPAUD'],
      negative: ['USDCHF', 'USDJPY']
    },
    'AUDUSD': {
      positive: ['NZDUSD', 'AUDJPY', 'EURAUD'],
      negative: ['USDJPY']
    },
    'NZDUSD': {
      positive: ['AUDUSD', 'NZDJPY', 'GBPNZD'],
      negative: ['USDJPY']
    },
    'USDJPY': {
      positive: ['USDCHF'],
      negative: ['EURUSD', 'GBPUSD', 'AUDUSD', 'NZDUSD', 'EURJPY', 'GBPJPY']
    },
    'USDCHF': {
      positive: ['USDJPY'],
      negative: ['EURUSD', 'GBPUSD', 'EURCHF', 'GBPCHF']
    },
    'EURJPY': {
      positive: ['GBPJPY', 'EURUSD'],
      negative: ['USDJPY']
    },
    'GBPJPY': {
      positive: ['EURJPY', 'GBPUSD'],
      negative: ['USDJPY']
    },
    'XAUUSD': {
      positive: ['USDJPY'], // Risk-off pairs
      negative: ['EURUSD', 'GBPUSD', 'AUDUSD'] // Risk-on pairs
    }
  };

  /**
   * Calculate rolling correlation between two pairs
   */
  async calculateRollingCorrelation(pair1: string, pair2: string, window: number = this.config.rollingWindow): Promise<number> {
    try {
      // Get historical data for both pairs
      const [data1, data2] = await Promise.all([
        exnessAPI.getHistoricalData(pair1, '15m', window),
        exnessAPI.getHistoricalData(pair2, '15m', window)
      ]);

      if (!data1 || !data2 || data1.length < window || data2.length < window) {
        console.warn(`Insufficient data for correlation calculation: ${pair1} vs ${pair2}`);
        return 0;
      }

      // Extract close prices
      const prices1 = data1.map(bar => bar.close);
      const prices2 = data2.map(bar => bar.close);

      // Calculate returns (percentage changes)
      const returns1 = this.calculateReturns(prices1);
      const returns2 = this.calculateReturns(prices2);

      // Calculate correlation coefficient
      const correlation = this.correlationCoefficient(returns1, returns2);

      // Cache the result
      const key = `${pair1}_${pair2}`;
      const type = this.classifyCorrelation(correlation);
      this.correlations.set(key, {
        pair1,
        pair2,
        correlation,
        type,
        lastUpdated: Date.now()
      });

      return correlation;
    } catch (error) {
      console.error(`Failed to calculate correlation between ${pair1} and ${pair2}:`, error);
      return 0;
    }
  }

  /**
   * Calculate percentage returns from price series
   */
  private calculateReturns(prices: number[]): number[] {
    const returns: number[] = [];
    for (let i = 1; i < prices.length; i++) {
      returns.push((prices[i] - prices[i - 1]) / prices[i - 1]);
    }
    return returns;
  }

  /**
   * Calculate Pearson correlation coefficient
   */
  private correlationCoefficient(x: number[], y: number[]): number {
    if (x.length !== y.length || x.length === 0) return 0;

    const n = x.length;
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
    const sumX2 = x.reduce((sum, xi) => sum + xi * xi, 0);
    const sumY2 = y.reduce((sum, yi) => sum + yi * yi, 0);

    const numerator = n * sumXY - sumX * sumY;
    const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));

    return denominator === 0 ? 0 : numerator / denominator;
  }

  /**
   * Classify correlation type
   */
  private classifyCorrelation(correlation: number): 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL' {
    if (correlation > this.config.positiveThreshold) return 'POSITIVE';
    if (correlation < this.config.negativeThreshold) return 'NEGATIVE';
    return 'NEUTRAL';
  }

  /**
   * Get correlated pairs for a given symbol
   */
  getCorrelatedPairs(symbol: string): { positive: string[], negative: string[] } {
    return this.pairRelationships[symbol] || { positive: [], negative: [] };
  }

  /**
   * Check if a trade signal is confirmed by correlated pairs
   */
  async checkCorrelationConfirmation(symbol: string, direction: 'BUY' | 'SELL', confidence: number): Promise<{
    confirmed: boolean;
    confirmations: number;
    totalChecked: number;
    details: string[];
  }> {
    const details: string[] = [];
    let confirmations = 0;
    let totalChecked = 0;

    const relationships = this.getCorrelatedPairs(symbol);

    // Check positive correlations (should move in same direction)
    for (const correlatedPair of relationships.positive) {
      if (!this.isSymbolAvailable(correlatedPair)) continue;

      totalChecked++;
      const correlatedDirection = await this.getPairDirection(correlatedPair);

      if (correlatedDirection === direction) {
        confirmations++;
        details.push(`✅ ${correlatedPair} confirms ${direction} (positive correlation)`);
      } else if (correlatedDirection !== 'NEUTRAL') {
        details.push(`❌ ${correlatedPair} diverges (${correlatedDirection} vs ${direction})`);
      }
    }

    // Check negative correlations (should move in opposite direction)
    for (const correlatedPair of relationships.negative) {
      if (!this.isSymbolAvailable(correlatedPair)) continue;

      totalChecked++;
      const correlatedDirection = await this.getPairDirection(correlatedPair);
      const expectedDirection = direction === 'BUY' ? 'SELL' : 'BUY';

      if (correlatedDirection === expectedDirection) {
        confirmations++;
        details.push(`✅ ${correlatedPair} confirms ${direction} (negative correlation)`);
      } else if (correlatedDirection !== 'NEUTRAL') {
        details.push(`❌ ${correlatedPair} diverges (${correlatedDirection} vs expected ${expectedDirection})`);
      }
    }

    // For high confidence signals, require fewer confirmations
    const requiredConfirmations = confidence >= 80 ? 1 : confidence >= 70 ? 2 : 3;
    const confirmed = this.config.confirmationRequired ? confirmations >= requiredConfirmations : true;

    return {
      confirmed,
      confirmations,
      totalChecked,
      details
    };
  }

  /**
   * Get current direction of a pair based on recent price action
   */
  private async getPairDirection(symbol: string): Promise<'BUY' | 'SELL' | 'NEUTRAL'> {
    try {
      const data = await exnessAPI.getHistoricalData(symbol, '15m', 10); // Last 10 candles
      if (!data || data.length < 5) return 'NEUTRAL';

      const recentPrices = data.slice(-5).map(bar => bar.close);
      const olderPrices = data.slice(-10, -5).map(bar => bar.close);

      const recentAvg = recentPrices.reduce((a, b) => a + b, 0) / recentPrices.length;
      const olderAvg = olderPrices.reduce((a, b) => a + b, 0) / olderPrices.length;

      const change = (recentAvg - olderAvg) / olderAvg;

      if (Math.abs(change) < 0.0001) return 'NEUTRAL'; // Less than 0.01% change
      return change > 0 ? 'BUY' : 'SELL';
    } catch (error) {
      console.error(`Failed to get direction for ${symbol}:`, error);
      return 'NEUTRAL';
    }
  }

  /**
   * Check currency exposure limits
   */
  checkCurrencyExposure(symbol: string, volume: number): { allowed: boolean; currentExposure: number; maxExposure: number; details: string } {
    const currencies = this.extractCurrenciesFromSymbol(symbol);
    let maxExposureReached = false;
    let currentTotalExposure = 0;
    let maxAllowedExposure = 0;

    for (const currency of currencies) {
      const exposure = this.currencyExposures.get(currency);
      if (!exposure) continue;

      const maxExp = this.config.maxCurrencyExposure[currency] || 0.2; // Default 20%
      const currentExp = exposure.exposure;

      currentTotalExposure = Math.max(currentTotalExposure, currentExp);
      maxAllowedExposure = Math.max(maxAllowedExposure, maxExp);

      if (currentExp + volume > maxExp) {
        maxExposureReached = true;
      }
    }

    const allowed = !maxExposureReached;

    return {
      allowed,
      currentExposure: currentTotalExposure,
      maxExposure: maxAllowedExposure,
      details: maxExposureReached ? `Currency exposure limit reached` : `Exposure OK`
    };
  }

  /**
   * Update currency exposure after trade execution
   */
  updateCurrencyExposure(symbol: string, volume: number, type: 'BUY' | 'SELL'): void {
    const currencies = this.extractCurrenciesFromSymbol(symbol);

    for (const currency of currencies) {
      const current = this.currencyExposures.get(currency)?.exposure || 0;
      const maxExp = this.config.maxCurrencyExposure[currency] || 0.2;

      this.currencyExposures.set(currency, {
        currency,
        exposure: current + volume,
        maxExposure: maxExp
      });
    }
  }

  /**
   * Reduce currency exposure after position close
   */
  reduceCurrencyExposure(symbol: string, volume: number): void {
    const currencies = this.extractCurrenciesFromSymbol(symbol);

    for (const currency of currencies) {
      const current = this.currencyExposures.get(currency);
      if (current) {
        current.exposure = Math.max(0, current.exposure - volume);
      }
    }
  }

  /**
   * Extract currencies from symbol (e.g., EURUSD -> ['EUR', 'USD'])
   */
  private extractCurrenciesFromSymbol(symbol: string): string[] {
    if (symbol === 'XAUUSD') return ['XAU', 'USD'];

    const base = symbol.substring(0, 3);
    const quote = symbol.substring(3, 6);

    return [base, quote];
  }

  /**
   * Special rules for XAUUSD trading - GOLD-ONLY MODE: Relaxed rules
   */
  async checkGoldTradingRules(): Promise<{ allowed: boolean; reason: string }> {
    // GOLD-ONLY MODE: Allow gold trading with relaxed rules for quick scalping
    // Only check USD strength if specifically required
    if (this.config.goldRules.requireUsdWeak) {
      const usdStrength = await this.getUSDStrength();
      // Allow trade even if USD is slightly strong (threshold reduced from 0 to 0.5)
      if (usdStrength > 0.5) { // USD is very strong
        return { allowed: false, reason: 'USD is very strong - not favorable for gold' };
      } else if (usdStrength > 0) {
        console.log(`⚠️ USD is slightly strong (${usdStrength.toFixed(2)}) but allowing gold trade in gold-only mode`);
      }
    }

    // GOLD-ONLY MODE: Relax JPY confirmation - allow trades even without JPY confirmation
    if (this.config.goldRules.requireJpyConfirm) {
      const jpyDirection = await this.getPairDirection('USDJPY');
      // Allow SELL signals on gold even if JPY is not confirming
      // For BUY gold, JPY should be weakening (USDJPY rising)
      if (jpyDirection !== 'NEUTRAL') {
        console.log(`🎯 GOLD-ONLY MODE: JPY direction is ${jpyDirection} - allowing gold trade anyway`);
      }
    }

    return { allowed: true, reason: 'Gold trading allowed in gold-only mode' };
  }

  /**
   * Get USD strength index (simplified)
   */
  private async getUSDStrength(): Promise<number> {
    const usdPairs = ['EURUSD', 'GBPUSD', 'AUDUSD', 'USDJPY', 'USDCHF'];
    let strength = 0;

    for (const pair of usdPairs) {
      try {
        const direction = await this.getPairDirection(pair);
        if (pair.includes('USD') && pair.indexOf('USD') === 0) { // USD is quote (USDJPY, USDCHF)
          strength += direction === 'BUY' ? 1 : direction === 'SELL' ? -1 : 0;
        } else { // USD is base (EURUSD, GBPUSD, AUDUSD)
          strength += direction === 'SELL' ? 1 : direction === 'BUY' ? -1 : 0;
        }
      } catch (error) {
        console.warn(`Failed to get direction for USD strength calculation: ${pair}`);
      }
    }

    return strength / usdPairs.length; // Normalize to -1 to 1
  }

  /**
   * Determine market regime (Risk-On vs Risk-Off)
   */
  async getMarketRegime(): Promise<MarketRegime> {
    const riskOnPairs = ['AUDUSD', 'NZDUSD', 'GBPUSD'];
    const riskOffPairs = ['USDJPY', 'USDCHF', 'XAUUSD'];

    let riskOnScore = 0;
    let riskOffScore = 0;

    // Check risk-on pairs
    for (const pair of riskOnPairs) {
      const direction = await this.getPairDirection(pair);
      riskOnScore += direction === 'BUY' ? 1 : direction === 'SELL' ? -1 : 0;
    }

    // Check risk-off pairs
    for (const pair of riskOffPairs) {
      const direction = await this.getPairDirection(pair);
      riskOffScore += direction === 'BUY' ? 1 : direction === 'SELL' ? -1 : 0;
    }

    const isRiskOn = riskOnScore > riskOffScore + 1;
    const isRiskOff = riskOffScore > riskOnScore + 1;

    let dominantDirection: 'BUY' | 'SELL' | 'NEUTRAL' = 'NEUTRAL';
    if (isRiskOn) dominantDirection = 'BUY';
    else if (isRiskOff) dominantDirection = 'SELL';

    return {
      isRiskOn,
      isRiskOff,
      dominantDirection
    };
  }

  /**
   * Check if symbol is available for trading
   */
  private isSymbolAvailable(symbol: string): boolean {
    // Check if symbol exists in our whitelist or can be traded
    return true; // Simplified - in real implementation, check against available symbols
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<CorrelationConfig>): void {
    this.config = { ...this.config, ...newConfig };
    console.log('Correlation config updated:', this.config);
  }

  /**
   * Get current configuration
   */
  getConfig(): CorrelationConfig {
    return { ...this.config };
  }

  /**
   * Get currency exposure report
   */
  getCurrencyExposureReport(): CurrencyExposure[] {
    return Array.from(this.currencyExposures.values());
  }

  /**
   * Reset daily exposures (call at start of trading day)
   */
  resetDailyExposures(): void {
    this.currencyExposures.clear();
    console.log('Daily currency exposures reset');
  }
}

export const correlationManager = new CorrelationManager();