import { TradingSignal } from '../signalProcessor';
import { WorldClassTradingStrategies, AdvancedSignal } from './worldClassStrategies';

export interface OptimizedSignal extends AdvancedSignal {
  volatilityAdjustedVolume: number;
  sessionMultiplier: number;
  newsRiskFactor: number;
  correlationScore: number;
  marketRegime: 'TRENDING' | 'RANGING' | 'VOLATILE' | 'QUIET';
  expectedOutcome: {
    winProbability: number;
    avgWinPips: number;
    avgLossPips: number;
    expectedValue: number;
  };
}

export class EnhancedTradingSystem {
  private worldClassStrategies = new WorldClassTradingStrategies();
  private marketRegimeCache = new Map<string, any>();
  private correlationMatrix = new Map<string, number>();
  
  // Main strategy orchestrator - combines all strategies for optimal results
  async generateOptimalSignal(
    symbol: string, 
    marketData: any, 
    indicators: any,
    sessionInfo: any,
    newsEvents: any[] = []
  ): Promise<OptimizedSignal | null> {
    
    try {
      // Validate input data
      if (!marketData || !marketData.prices || marketData.prices.length === 0) {
        console.warn('Invalid market data for', symbol);
        return null;
      }
      
      // Ensure indicators have all required properties
      const safeIndicators = this.ensureCompleteIndicators(indicators, marketData);
      
      // 1. Analyze market regime
      const marketRegime = this.analyzeMarketRegime(marketData, safeIndicators);
      
      // 2. Get session-specific analysis
      const sessionAnalysis = this.analyzeSessionContext(sessionInfo, symbol);
      
      // 3. Assess news impact
      const newsImpact = this.assessNewsImpact(newsEvents, symbol);
      
      // 4. Run multiple world-class strategies
      const strategySignals = await this.runAllStrategies(marketData, safeIndicators);
      
      // 5. Select best strategy based on market conditions
      const bestSignal = this.selectOptimalStrategy(strategySignals, marketRegime, sessionAnalysis);
      
      if (!bestSignal) return null;
      
      // 6. Enhance signal with advanced risk management
      const optimizedSignal = await this.enhanceSignalWithRiskManagement(
        bestSignal,
        marketRegime,
        sessionAnalysis,
        newsImpact
      );
      
      return optimizedSignal;
      
    } catch (error) {
      console.error('Error in enhanced strategy generation:', error);
      return null;
    }
  }
  
  private ensureCompleteIndicators(indicators: any, marketData: any): any {
    const currentPrice = marketData.prices[marketData.prices.length - 1] || 1.0000;
    
    return {
      rsi: indicators.rsi || 50,
      macd: indicators.macd || { value: 0, signal: 0, histogram: 0 },
      ema20: indicators.ema20 || currentPrice,
      ema50: indicators.ema50 || currentPrice,
      ema200: indicators.ema200 || currentPrice,
      sma200: indicators.sma200 || currentPrice,
      bollinger: indicators.bollinger || {
        upper: currentPrice * 1.01,
        middle: currentPrice,
        lower: currentPrice * 0.99
      },
      stochastic: indicators.stochastic || { k: 50, d: 50 },
      atr: indicators.atr || 0.001,
      adx: indicators.adx || 30
    };
  }
  
  private analyzeMarketRegime(marketData: any, indicators: any): 'TRENDING' | 'RANGING' | 'VOLATILE' | 'QUIET' {
    const { prices } = marketData;
    const { atr, adx, bollinger } = indicators;
    
    // Calculate regime indicators
    const volatilityScore = atr || this.calculateATR(prices, 14);
    const trendStrength = adx || this.calculateADX(prices, 14);
    const rangeCompression = this.calculateRangeCompression(prices, bollinger);
    
    // Regime classification
    if (trendStrength > 25 && volatilityScore > 0.001) {
      return 'TRENDING';
    } else if (rangeCompression > 0.8 && volatilityScore < 0.0005) {
      return 'RANGING';
    } else if (volatilityScore > 0.0015) {
      return 'VOLATILE';
    } else {
      return 'QUIET';
    }
  }
  
  private analyzeSessionContext(sessionInfo: any, symbol: string): any {
    const activeSessions = sessionInfo.filter((s: any) => s.isActive);
    const sessionOverlaps = activeSessions.length > 1;
    
    // Session-specific characteristics
    const sessionAnalysis = {
      isOptimalTime: this.isOptimalTradingTime(symbol, activeSessions),
      liquidityScore: this.calculateLiquidityScore(activeSessions, symbol),
      volatilityMultiplier: this.getSessionVolatilityMultiplier(activeSessions),
      spreadAdjustment: this.getSessionSpreadAdjustment(activeSessions),
      sessionOverlaps
    };
    
    return sessionAnalysis;
  }
  
  private assessNewsImpact(newsEvents: any[], symbol: string): any {
    const relevantNews = newsEvents.filter(news => 
      news.affected_pairs?.includes(symbol) ||
      news.currency === symbol.substring(0, 3) ||
      news.currency === symbol.substring(3, 6)
    );
    
    const highImpactNews = relevantNews.filter(news => news.impact === 'HIGH');
    
    return {
      hasHighImpact: highImpactNews.length > 0,
      riskMultiplier: highImpactNews.length > 0 ? 0.5 : 1.0,
      timeToNews: this.getTimeToNextNews(relevantNews),
      newsType: highImpactNews[0]?.title || 'None'
    };
  }
  
  private async runAllStrategies(marketData: any, indicators: any): Promise<AdvancedSignal[]> {
    const signals: AdvancedSignal[] = [];
    
    try {
      // Run all world-class strategies
      const strategies = [
        () => this.worldClassStrategies.renaissanceStatArb(marketData, indicators),
        () => this.worldClassStrategies.citadelMarketMaking(marketData, indicators),
        () => this.worldClassStrategies.bridgewaterMacroTrend(marketData, indicators),
        () => this.worldClassStrategies.twoSigmaMomentum(marketData, indicators),
        () => this.worldClassStrategies.goldmanSachsFlow(marketData, indicators, {}),
        () => this.worldClassStrategies.millenniumHFMeanReversion(marketData, indicators),
        () => this.worldClassStrategies.janeStreetVolatility(marketData, indicators),
        () => this.worldClassStrategies.aqrMomentumFactor(marketData, indicators),
        () => this.worldClassStrategies.manGroupCTA(marketData, indicators)
      ];
      
      for (const strategy of strategies) {
        try {
          const signal = await strategy();
          if (signal && signal.confidence > 70) {
            signals.push(signal);
          }
        } catch (error) {
          console.warn('Strategy execution error:', error);
        }
      }
    } catch (error) {
      console.error('Error running strategies:', error);
    }
    
    return signals;
  }
  
  private selectOptimalStrategy(
    signals: AdvancedSignal[], 
    marketRegime: string, 
    sessionAnalysis: any
  ): AdvancedSignal | null {
    
    if (signals.length === 0) return null;
    
    // Score each signal based on market conditions
    const scoredSignals = signals.map(signal => ({
      signal,
      score: this.calculateSignalScore(signal, marketRegime, sessionAnalysis)
    }));
    
    // Sort by score and return best
    scoredSignals.sort((a, b) => b.score - a.score);
    
    return scoredSignals[0].signal;
  }
  
  private calculateSignalScore(signal: AdvancedSignal, marketRegime: string, sessionAnalysis: any): number {
    let score = signal.confidence;
    
    // Regime-specific bonuses
    if (marketRegime === 'TRENDING' && signal.strategyName.includes('Bridgewater')) {
      score += 15; // Trend following strategies work better in trending markets
    }
    
    if (marketRegime === 'RANGING' && signal.strategyName.includes('Millennium')) {
      score += 12; // Mean reversion works better in ranging markets
    }
    
    if (marketRegime === 'VOLATILE' && signal.strategyName.includes('Jane Street')) {
      score += 10; // Volatility strategies work better in volatile markets
    }
    
    // Session bonuses
    if (sessionAnalysis.isOptimalTime) {
      score += 8;
    }
    
    if (sessionAnalysis.sessionOverlaps) {
      score += 5; // Session overlaps = higher liquidity
    }
    
    // Risk-reward bonus
    score += signal.riskRewardRatio * 3;
    
    // Probability bonus
    score += signal.probabilityOfSuccess * 0.2;
    
    return Math.min(100, score);
  }
  
  private async enhanceSignalWithRiskManagement(
    signal: AdvancedSignal,
    marketRegime: string,
    sessionAnalysis: any,
    newsImpact: any
  ): Promise<OptimizedSignal> {
    
    // Calculate aggressive position sizing for day trading
    const baseVolume = 0.20; // Start with much larger base volume
    const confidenceMultiplier = Math.max(1.0, signal.confidence / 80); // Minimum 100% multiplier
    const sessionMultiplier = Math.max(2.0, sessionAnalysis.volatilityMultiplier); // Minimum 2.0x
    const newsRiskFactor = Math.max(0.9, newsImpact.riskMultiplier); // Minimal news impact
    
    const volatilityAdjustedVolume = Math.max(
      0.15, // Minimum 0.15 lots
      Math.min(1.0, baseVolume * confidenceMultiplier * sessionMultiplier * newsRiskFactor) // Max 1.0 lots
    );
    
    // Calculate expected outcome
    const expectedOutcome = this.calculateExpectedOutcome(signal, marketRegime);
    
    // Enhanced signal with all optimizations
    const optimizedSignal: OptimizedSignal = {
      ...signal,
      volatilityAdjustedVolume,
      sessionMultiplier: sessionAnalysis.volatilityMultiplier,
      newsRiskFactor: newsImpact.riskMultiplier,
      correlationScore: this.getCorrelationScore(signal.symbol),
      marketRegime: marketRegime as any,
      expectedOutcome,
      
      // Adjust stop loss and take profit based on market conditions
      stopLoss: this.optimizeStopLoss(signal, marketRegime, sessionAnalysis),
      takeProfit: this.optimizeTakeProfit(signal, marketRegime, sessionAnalysis),
      
      // Enhanced reasoning
      reasoning: `${signal.reasoning} | Market Regime: ${marketRegime} | Session Score: ${sessionAnalysis.liquidityScore}/100 | Expected Value: ${expectedOutcome.expectedValue.toFixed(2)} pips`
    };
    
    return optimizedSignal;
  }
  
  private calculateExpectedOutcome(signal: AdvancedSignal, marketRegime: string): any {
    const baseWinRate = signal.probabilityOfSuccess / 100;
    
    // Regime adjustments
    let adjustedWinRate = baseWinRate;
    if (marketRegime === 'TRENDING' && signal.type === this.getTrendDirection()) {
      adjustedWinRate *= 1.15; // 15% boost in trending markets
    }
    
    const avgWinPips = signal.riskRewardRatio * 20; // Assuming 20 pip risk
    const avgLossPips = 20;
    
    const expectedValue = (adjustedWinRate * avgWinPips) - ((1 - adjustedWinRate) * avgLossPips);
    
    return {
      winProbability: Math.min(0.95, adjustedWinRate),
      avgWinPips,
      avgLossPips,
      expectedValue
    };
  }
  
  private optimizeStopLoss(signal: AdvancedSignal, marketRegime: string, sessionAnalysis: any): number {
    let stopLoss = signal.stopLoss;
    
    // Adjust for volatility
    if (marketRegime === 'VOLATILE') {
      const adjustment = Math.abs(signal.entryPrice - stopLoss) * 0.2;
      stopLoss = signal.type === 'BUY' ? stopLoss - adjustment : stopLoss + adjustment;
    }
    
    // Adjust for session
    if (sessionAnalysis.spreadAdjustment > 1.5) {
      const adjustment = Math.abs(signal.entryPrice - stopLoss) * 0.1;
      stopLoss = signal.type === 'BUY' ? stopLoss - adjustment : stopLoss + adjustment;
    }
    
    return stopLoss;
  }
  
  private optimizeTakeProfit(signal: AdvancedSignal, marketRegime: string, sessionAnalysis: any): number {
    let takeProfit = signal.takeProfit;
    
    // Extend target in trending markets
    if (marketRegime === 'TRENDING') {
      const extension = Math.abs(takeProfit - signal.entryPrice) * 0.3;
      takeProfit = signal.type === 'BUY' ? takeProfit + extension : takeProfit - extension;
    }
    
    return takeProfit;
  }
  
  // Helper methods
  private calculateATR(prices: number[], period: number): number {
    const trueRanges = [];
    for (let i = 1; i < prices.length; i++) {
      const high = Math.max(prices[i], prices[i-1]);
      const low = Math.min(prices[i], prices[i-1]);
      trueRanges.push(high - low);
    }
    return trueRanges.slice(-period).reduce((a, b) => a + b, 0) / period;
  }
  
  private calculateADX(prices: number[], period: number): number {
    // Simplified ADX calculation
    // NOTE: Real ADX calculation requires historical price data from MT5
    return 50; // Neutral value until MT5 integration
  }
  
  private calculateRangeCompression(prices: number[], bollinger: any): number {
    if (!bollinger) return 0.5;
    const range = bollinger.upper - bollinger.lower;
    const price = prices[prices.length - 1];
    return Math.abs(price - bollinger.middle) / (range / 2);
  }
  
  private isOptimalTradingTime(symbol: string, activeSessions: any[]): boolean {
    // Major pairs are best during London/NY overlap
    const majorPairs = ['EURUSD', 'GBPUSD', 'USDJPY', 'USDCHF'];
    if (majorPairs.includes(symbol)) {
      return activeSessions.some(s => s.name === 'London') && activeSessions.some(s => s.name === 'New York');
    }
    return activeSessions.length > 0;
  }
  
  private calculateLiquidityScore(activeSessions: any[], symbol: string): number {
    let score = 0;
    activeSessions.forEach(session => {
      if (session.majorPairs.includes(symbol)) {
        score += session.volume === 'HIGH' ? 40 : session.volume === 'MEDIUM' ? 25 : 15;
      }
    });
    return Math.min(100, score);
  }
  
  private getSessionVolatilityMultiplier(activeSessions: any[]): number {
    const hasHighVolSession = activeSessions.some(s => s.volatility === 'HIGH');
    return hasHighVolSession ? 1.2 : 1.0;
  }
  
  private getSessionSpreadAdjustment(activeSessions: any[]): number {
    return activeSessions.length > 1 ? 0.8 : 1.2;
  }
  
  private getTimeToNextNews(newsEvents: any[]): number {
    if (newsEvents.length === 0) return Infinity;
    const nextNews = newsEvents.sort((a, b) => new Date(a.event_time).getTime() - new Date(b.event_time).getTime())[0];
    return new Date(nextNews.event_time).getTime() - Date.now();
  }
  
  private getCorrelationScore(symbol: string): number {
    return this.correlationMatrix.get(symbol) || 50;
  }
  
  private getTrendDirection(): 'BUY' | 'SELL' {
    // This fallback should never be used in production
    // Real trend direction comes from AI analysis
    console.warn('⚠️ getTrendDirection fallback should not be used - use AI analysis');
    return 'BUY'; // Conservative default
  }
}

export const enhancedTradingSystem = new EnhancedTradingSystem();