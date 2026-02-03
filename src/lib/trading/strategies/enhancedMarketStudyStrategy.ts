/**
 * Enhanced Market Study Strategy
 * Thoroughly studies market direction before taking trades
 * Prevents false signals by analyzing multiple timeframes and indicators
 * Only takes trades when confidence is high (>= 70%)
 */

import { MarketDirectionAnalyzer, MarketDirection } from './marketDirectionAnalyzer';

export interface TradeSignal {
  action: 'BUY' | 'SELL' | 'WAIT';
  confidence: number;
  reasoning: string;
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  riskReward: number;
  marketDirection: MarketDirection;
  warnings: string[];
}

export interface EnhancedMarketStudyConfig {
  minConfidence: number; // Minimum confidence to take trade (default: 70)
  riskPerTrade: number; // Risk per trade as percentage (default: 1)
  riskRewardRatio: number; // Risk-reward ratio (default: 2)
  stopLossPips: number; // Stop loss in pips (default: 8)
  takeProfitPips: number; // Take profit in pips (default: 16)
  pipValue: number; // Pip value for the pair (default: 0.0001)
  tradingSessions: {
    london: { start: number; end: number };
    newYork: { start: number; end: number };
  };
}

export class EnhancedMarketStudyStrategy {
  private analyzer: MarketDirectionAnalyzer;
  private config: EnhancedMarketStudyConfig;
  
  constructor(config?: Partial<EnhancedMarketStudyConfig>) {
    this.analyzer = new MarketDirectionAnalyzer();
    this.config = {
      minConfidence: 70,
      riskPerTrade: 1,
      riskRewardRatio: 2,
      stopLossPips: 8,
      takeProfitPips: 16,
      pipValue: 0.0001,
      tradingSessions: {
        london: { start: 7, end: 16 }, // 07:00-16:00 UTC
        newYork: { start: 12, end: 21 } // 12:00-21:00 UTC
      },
      ...config
    };
  }
  
  /**
   * Analyze market and generate trade signal
   * This is the main entry point - thoroughly studies market before taking trade
   */
  async analyzeAndGenerateSignal(
    symbol: string,
    prices: number[],
    currentPrice: number,
    htfPrices?: number[],
    accountBalance: number = 8
  ): Promise<TradeSignal> {
    
    // Step 1: Analyze market direction
    const marketDirection = await this.analyzer.analyzeMarketDirection(
      symbol,
      prices,
      currentPrice,
      htfPrices
    );
    
    // Step 2: Check if we should trade
    const shouldTrade = this.shouldTrade(marketDirection);
    
    if (!shouldTrade) {
      return {
        action: 'WAIT',
        confidence: marketDirection.confidence,
        reasoning: marketDirection.reasoning,
        entryPrice: currentPrice,
        stopLoss: 0,
        takeProfit: 0,
        riskReward: 0,
        marketDirection,
        warnings: this.generateWarnings(marketDirection)
      };
    }
    
    // Step 3: Calculate trade parameters
    const tradeParams = this.calculateTradeParameters(
      currentPrice,
      marketDirection,
      accountBalance
    );
    
    // Step 4: Generate final signal
    return {
      action: marketDirection.recommendedAction,
      confidence: marketDirection.confidence,
      reasoning: marketDirection.reasoning,
      entryPrice: tradeParams.entryPrice,
      stopLoss: tradeParams.stopLoss,
      takeProfit: tradeParams.takeProfit,
      riskReward: tradeParams.riskReward,
      marketDirection,
      warnings: this.generateWarnings(marketDirection)
    };
  }
  
  /**
   * Determine if we should take a trade based on market analysis
   */
  private shouldTrade(marketDirection: MarketDirection): boolean {
    // Must have high confidence
    if (marketDirection.confidence < this.config.minConfidence) {
      return false;
    }
    
    // Must have a clear recommended action
    if (marketDirection.recommendedAction === 'WAIT') {
      return false;
    }
    
    // Must have clear trend direction
    if (marketDirection.direction === 'NEUTRAL') {
      return false;
    }
    
    // Check for warnings
    const warnings = this.generateWarnings(marketDirection);
    if (warnings.length > 0) {
      // If there are warnings, don't trade
      return false;
    }
    
    return true;
  }
  
  /**
   * Calculate trade parameters (entry, stop loss, take profit)
   */
  private calculateTradeParameters(
    currentPrice: number,
    marketDirection: MarketDirection,
    accountBalance: number
  ): {
    entryPrice: number;
    stopLoss: number;
    takeProfit: number;
    riskReward: number;
  } {
    const isBuy = marketDirection.recommendedAction === 'BUY';
    
    // Calculate position size based on risk
    const riskAmount = accountBalance * (this.config.riskPerTrade / 100);
    const stopLossDistance = this.config.stopLossPips * this.config.pipValue;
    const positionSize = riskAmount / stopLossDistance;
    
    // Calculate entry, stop loss, and take profit
    let entryPrice: number;
    let stopLoss: number;
    let takeProfit: number;
    
    if (isBuy) {
      entryPrice = currentPrice;
      stopLoss = currentPrice - stopLossDistance;
      takeProfit = currentPrice + (stopLossDistance * this.config.riskRewardRatio);
    } else {
      entryPrice = currentPrice;
      stopLoss = currentPrice + stopLossDistance;
      takeProfit = currentPrice - (stopLossDistance * this.config.riskRewardRatio);
    }
    
    return {
      entryPrice,
      stopLoss,
      takeProfit,
      riskReward: this.config.riskRewardRatio
    };
  }
  
  /**
   * Generate warnings based on market analysis
   */
  private generateWarnings(marketDirection: MarketDirection): string[] {
    const warnings: string[] = [];
    
    // Low confidence warning
    if (marketDirection.confidence < this.config.minConfidence) {
      warnings.push(`Low confidence (${marketDirection.confidence}% < ${this.config.minConfidence}%)`);
    }
    
    // Neutral direction warning
    if (marketDirection.direction === 'NEUTRAL') {
      warnings.push('Neutral market direction - no clear trend');
    }
    
    // Weak trend warning
    if (marketDirection.trendStrength < 0.3) {
      warnings.push(`Weak trend strength (${marketDirection.trendStrength.toFixed(2)} < 0.30)`);
    }
    
    // Contradictory indicators warning
    if (marketDirection.reasoning.includes('WARNING')) {
      warnings.push('Contradictory indicators detected');
    }
    
    // RSI extreme warning
    if (marketDirection.reasoning.includes('overbought')) {
      warnings.push('RSI overbought - potential reversal');
    }
    if (marketDirection.reasoning.includes('oversold')) {
      warnings.push('RSI oversold - potential reversal');
    }
    
    // Near resistance for buy warning
    if (marketDirection.isNearResistance && marketDirection.recommendedAction === 'BUY') {
      warnings.push('Price near resistance - risky buy');
    }
    
    // Near support for sell warning
    if (marketDirection.isNearSupport && marketDirection.recommendedAction === 'SELL') {
      warnings.push('Price near support - risky sell');
    }
    
    // Momentum contradiction warning
    if (marketDirection.reasoning.includes('Momentum') && marketDirection.reasoning.includes('contradicts')) {
      warnings.push('Momentum contradicts direction');
    }
    
    return warnings;
  }
  
  /**
   * Check if current time is within trading session
   */
  isWithinTradingSession(): boolean {
    const now = new Date();
    const utcHour = now.getUTCHours();
    
    const { london, newYork } = this.config.tradingSessions;
    
    // Check if within London session
    const inLondon = utcHour >= london.start && utcHour < london.end;
    
    // Check if within New York session
    const inNewYork = utcHour >= newYork.start && utcHour < newYork.end;
    
    return inLondon || inNewYork;
  }
  
  /**
   * Get current trading session
   */
  getCurrentTradingSession(): string {
    const now = new Date();
    const utcHour = now.getUTCHours();
    
    const { london, newYork } = this.config.tradingSessions;
    
    if (utcHour >= london.start && utcHour < london.end) {
      return 'London';
    } else if (utcHour >= newYork.start && utcHour < newYork.end) {
      return 'New York';
    } else {
      return 'Off-hours';
    }
  }
  
  /**
   * Update configuration
   */
  updateConfig(config: Partial<EnhancedMarketStudyConfig>): void {
    this.config = { ...this.config, ...config };
  }
  
  /**
   * Get current configuration
   */
  getConfig(): EnhancedMarketStudyConfig {
    return { ...this.config };
  }
}

// Export default instance
export const enhancedMarketStudyStrategy = new EnhancedMarketStudyStrategy();