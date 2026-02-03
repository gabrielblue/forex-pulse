import { TradingSignal } from '../signalProcessor';
import { WorldClassTradingStrategies, AdvancedSignal } from './worldClassStrategies';
import { goldTradingStrategies } from './goldStrategies';
import { multiTimeframeAnalyzer } from '../multiTimeframeAnalyzer';
import { exnessAPI } from '../exnessApi';

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

      // 4. Get multi-timeframe analysis for sniper entries
      const currentPrice = marketData.prices[marketData.prices.length - 1];
      const multiTimeframeAnalysis = await multiTimeframeAnalyzer.analyzeSymbol(symbol, currentPrice);

      // 5. Run multiple world-class strategies
      const strategySignals = await this.runAllStrategies(marketData, safeIndicators);

      // 6. Select best strategy based on market conditions
      const bestSignal = this.selectOptimalStrategy(strategySignals, marketRegime, sessionAnalysis);

      if (!bestSignal) return null;

      // 7. Apply sniper entry logic
      const sniperSignal = await this.applySniperEntryLogic(
        bestSignal,
        multiTimeframeAnalysis,
        marketRegime,
        newsImpact
      );

      if (!sniperSignal) return null;

      // 8. Enhance signal with advanced risk management
      const optimizedSignal = await this.enhanceSignalWithRiskManagement(
        sniperSignal,
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
    const { symbol } = marketData;

    try {
      // For gold (XAUUSD), use specialized gold strategies
      if (symbol.includes('XAU') || symbol.includes('GOLD')) {
        console.log('🎯 Using specialized gold trading strategies for', symbol);
        const goldSignal = await goldTradingStrategies.generateGoldSignal(
          marketData,
          indicators,
          undefined, // USD data not available yet
          undefined, // session info
          [] // news events
        );

        if (goldSignal) {
          signals.push(goldSignal);
        }
        return signals; // Return only gold signals for gold trading
      }

      // For other symbols, run all world-class strategies
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
          if (signal && signal.confidence > 80) { // Higher confidence threshold for better win rate
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

    const bestSignal = scoredSignals[0].signal;

    // Cross-check validation: Ensure signal aligns with market regime
    if (!this.validateSignalAgainstMarketRegime(bestSignal, marketRegime)) {
      console.log(`❌ Signal rejected: ${bestSignal.strategyName} doesn't align with ${marketRegime} market regime`);
      return null;
    }

    // Cross-check validation: Ensure risk-reward ratio is acceptable
    if (bestSignal.riskRewardRatio < 1.5) {
      console.log(`❌ Signal rejected: Poor risk-reward ratio ${bestSignal.riskRewardRatio.toFixed(2)}`);
      return null;
    }

    // Cross-check validation: Ensure confidence is high enough
    if (bestSignal.confidence < 85) {
      console.log(`❌ Signal rejected: Low confidence ${bestSignal.confidence}%`);
      return null;
    }

    return bestSignal;
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
    
    // Conservative position sizing for small accounts - focus on take profits
    const baseVolume = signal.symbol.includes('XAU') ? 0.02 : 0.20; // Small base volume for gold with $18 account
    const confidenceMultiplier = Math.max(1.5, signal.confidence / 70); // Higher minimum multiplier for gold
    const sessionMultiplier = Math.max(2.0, sessionAnalysis.volatilityMultiplier); // Moderate multiplier for safety
    const newsRiskFactor = Math.max(0.9, newsImpact.riskMultiplier); // Conservative news impact

    const volatilityAdjustedVolume = Math.max(
      0.01, // Minimum broker size
      Math.min(signal.symbol.includes('XAU') ? 0.03 : 1.0, baseVolume * confidenceMultiplier * sessionMultiplier * newsRiskFactor) // Max 0.03 lots for gold
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
    // For sniper entries, keep the calculated SL from market structure
    // Only make minor adjustments for extreme conditions
    let stopLoss = signal.stopLoss;

    // Conservative adjustment for high volatility (max 10% adjustment)
    if (marketRegime === 'VOLATILE') {
      const adjustment = Math.abs(signal.entryPrice - stopLoss) * 0.1;
      stopLoss = signal.type === 'BUY' ? stopLoss - adjustment : stopLoss + adjustment;
    }

    // Minimal adjustment for poor session conditions
    if (sessionAnalysis.spreadAdjustment > 2.0) {
      const adjustment = Math.abs(signal.entryPrice - stopLoss) * 0.05;
      stopLoss = signal.type === 'BUY' ? stopLoss - adjustment : stopLoss + adjustment;
    }

    return stopLoss;
  }

  private optimizeTakeProfit(signal: AdvancedSignal, marketRegime: string, sessionAnalysis: any): number {
    // For sniper entries, keep the calculated TP from market structure
    // Only extend in strong trending conditions
    let takeProfit = signal.takeProfit;

    // Extend target only in strong trending markets with good confluence
    if (marketRegime === 'TRENDING' && sessionAnalysis.isOptimalTime) {
      const extension = Math.abs(takeProfit - signal.entryPrice) * 0.2;
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
      if (session.majorPairs && Array.isArray(session.majorPairs) && session.majorPairs.includes(symbol)) {
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

  // Sniper Entry Logic - Enter at precise support/resistance levels
  private async applySniperEntryLogic(
    signal: AdvancedSignal,
    multiTimeframeAnalysis: any,
    marketRegime: string,
    newsImpact: any
  ): Promise<AdvancedSignal | null> {

    // Reject signal if news impact is too high
    if (newsImpact.hasHighImpact) {
      console.log(`📰 Rejecting signal for ${signal.symbol} due to high news impact: ${newsImpact.newsType}`);
      return null;
    }

    // Get current price
    const currentPrice = await this.getCurrentPrice(signal.symbol);
    if (!currentPrice) return null;

    // Extract support and resistance levels from multi-timeframe analysis
    const allSupportLevels: number[] = [];
    const allResistanceLevels: number[] = [];

    multiTimeframeAnalysis.timeframes.forEach((tf: any) => {
      allSupportLevels.push(...tf.supportResistance.support);
      allResistanceLevels.push(...tf.supportResistance.resistance);
    });

    // Sort and deduplicate levels
    const supportLevels = Array.from(new Set(allSupportLevels)).sort((a, b) => b - a); // Descending
    const resistanceLevels = Array.from(new Set(allResistanceLevels)).sort((a, b) => a - b); // Ascending

    // Find sniper entry point
    let sniperEntryPrice: number | null = null;
    let sniperStopLoss: number | null = null;
    let sniperTakeProfit: number | null = null;

    if (signal.type === 'BUY') {
      // For BUY: Enter at support level, TP at resistance, SL below support
      const nearestSupport = this.findNearestLevel(currentPrice, supportLevels, 'below');
      const nextResistance = this.findNearestLevel(currentPrice, resistanceLevels, 'above');

      if (nearestSupport && nextResistance) {
        sniperEntryPrice = nearestSupport;
        sniperTakeProfit = nextResistance;
        sniperStopLoss = nearestSupport - Math.abs(nextResistance - nearestSupport) * 0.2; // 20% below support
      }
    } else {
      // For SELL: Enter at resistance level, TP at support, SL above resistance
      const nearestResistance = this.findNearestLevel(currentPrice, resistanceLevels, 'above');
      const nextSupport = this.findNearestLevel(currentPrice, supportLevels, 'below');

      if (nearestResistance && nextSupport) {
        sniperEntryPrice = nearestResistance;
        sniperTakeProfit = nextSupport;
        sniperStopLoss = nearestResistance + Math.abs(nearestResistance - nextSupport) * 0.2; // 20% above resistance
      }
    }

    if (!sniperEntryPrice || !sniperStopLoss || !sniperTakeProfit) {
      console.log(`🎯 No valid sniper entry found for ${signal.symbol} ${signal.type}`);
      return null;
    }

    // Validate risk-reward ratio (minimum 1:1.5)
    const risk = Math.abs(sniperEntryPrice - sniperStopLoss);
    const reward = Math.abs(sniperTakeProfit - sniperEntryPrice);
    const riskRewardRatio = reward / risk;

    if (riskRewardRatio < 1.5) {
      console.log(`📊 Poor risk-reward ratio ${riskRewardRatio.toFixed(2)} for ${signal.symbol}, rejecting`);
      return null;
    }

    // Check if entry is too far from current price (max 1% for sniper precision)
    const entryDistance = Math.abs(sniperEntryPrice - currentPrice) / currentPrice;
    if (entryDistance > 0.01) {
      console.log(`📍 Entry too far from current price (${(entryDistance * 100).toFixed(2)}%), rejecting sniper entry`);
      return null;
    }

    console.log(`🎯 Sniper entry found for ${signal.symbol} ${signal.type}: Entry=${sniperEntryPrice.toFixed(5)}, SL=${sniperStopLoss.toFixed(5)}, TP=${sniperTakeProfit.toFixed(5)}, RR=${riskRewardRatio.toFixed(2)}`);

    return {
      ...signal,
      entryPrice: sniperEntryPrice,
      stopLoss: sniperStopLoss,
      takeProfit: sniperTakeProfit,
      riskRewardRatio,
      reasoning: `${signal.reasoning} | Sniper Entry: ${sniperEntryPrice.toFixed(5)} | Market Structure Confirmed | RR: ${riskRewardRatio.toFixed(2)}`
    };
  }

  private findNearestLevel(currentPrice: number, levels: number[], direction: 'above' | 'below'): number | null {
    if (levels.length === 0) return null;

    if (direction === 'below') {
      // Find highest level below current price
      const belowLevels = levels.filter(level => level <= currentPrice);
      return belowLevels.length > 0 ? Math.max(...belowLevels) : null;
    } else {
      // Find lowest level above current price
      const aboveLevels = levels.filter(level => level >= currentPrice);
      return aboveLevels.length > 0 ? Math.min(...aboveLevels) : null;
    }
  }

  private async getCurrentPrice(symbol: string): Promise<number | null> {
    try {
      const price = await exnessAPI.getCurrentPrice(symbol);
      return price ? (price.bid + price.ask) / 2 : null;
    } catch (error) {
      console.error('Failed to get current price:', error);
      return null;
    }
  }

  private validateSignalAgainstMarketRegime(signal: AdvancedSignal, marketRegime: string): boolean {
    // Validate that signal type aligns with market regime
    if (marketRegime === 'TRENDING') {
      // In trending markets, prefer momentum-based strategies
      const momentumStrategies = ['Two Sigma Machine Learning', 'Bridgewater Macro Trend', 'AQR Momentum Factor'];
      return momentumStrategies.some(strategy => signal.strategyName.includes(strategy));
    }

    if (marketRegime === 'RANGING') {
      // In ranging markets, prefer mean reversion strategies
      const meanReversionStrategies = ['Millennium High-Frequency Mean Reversion', 'Renaissance Statistical Arbitrage'];
      return meanReversionStrategies.some(strategy => signal.strategyName.includes(strategy));
    }

    if (marketRegime === 'VOLATILE') {
      // In volatile markets, prefer volatility-based strategies
      const volatilityStrategies = ['Jane Street Volatility Trading'];
      return volatilityStrategies.some(strategy => signal.strategyName.includes(strategy));
    }

    // For QUIET markets, accept any high-confidence signal
    return signal.confidence >= 85;
  }
}

export const enhancedTradingSystem = new EnhancedTradingSystem();