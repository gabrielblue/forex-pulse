import { TradingSignal } from './signalProcessor';
import { MarketData, TechnicalIndicators, professionalStrategies } from './strategies/professionalStrategies';
import { supabase } from '@/integrations/supabase/client';

export interface MultiTimeframeAnalysis {
  timeframe: string;
  trend: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  strength: number;
  indicators: TechnicalIndicators;
  support?: number;
  resistance?: number;
}

export interface MarketStructureAnalysis {
  higherHighs: boolean;
  higherLows: boolean;
  lowerHighs: boolean;
  lowerLows: boolean;
  trendStructure: 'UPTREND' | 'DOWNTREND' | 'SIDEWAYS';
  keyLevels: { level: number; type: 'SUPPORT' | 'RESISTANCE'; strength: number }[];
}

export interface VolumeAnalysis {
  volumeTrend: 'INCREASING' | 'DECREASING' | 'STABLE';
  volumeConfirmation: boolean;
  abnormalVolume: boolean;
  volumeProfile: number[];
}

export interface SentimentAnalysis {
  overall: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  newsImpact: 'HIGH' | 'MEDIUM' | 'LOW';
  economicEvents: string[];
  riskOffOn: 'RISK_ON' | 'RISK_OFF' | 'NEUTRAL';
}

export interface ComprehensiveAnalysis {
  symbol: string;
  multiTimeframe: MultiTimeframeAnalysis[];
  marketStructure: MarketStructureAnalysis;
  volumeAnalysis: VolumeAnalysis;
  sentimentAnalysis: SentimentAnalysis;
  overallScore: number;
  recommendation: 'STRONG_BUY' | 'BUY' | 'HOLD' | 'SELL' | 'STRONG_SELL';
  confidence: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  entryConditions: string[];
  exitConditions: string[];
}

export class AdvancedTradingAnalyzer {
  private readonly timeframes = ['5M', '15M', '1H', '4H', '1D'];
  
  async performComprehensiveAnalysis(symbol: string): Promise<ComprehensiveAnalysis> {
    console.log(`🔍 Starting comprehensive analysis for ${symbol}...`);
    
    try {
      // Multi-timeframe analysis
      const multiTimeframe = await this.analyzeMultipleTimeframes(symbol);
      
      // Market structure analysis
      const marketStructure = await this.analyzeMarketStructure(symbol);
      
      // Volume analysis
      const volumeAnalysis = await this.analyzeVolume(symbol);
      
      // Sentiment analysis
      const sentimentAnalysis = await this.analyzeSentiment(symbol);
      
      // Calculate overall score and recommendation
      const { overallScore, recommendation, confidence, riskLevel } = this.calculateOverallAssessment(
        multiTimeframe,
        marketStructure,
        volumeAnalysis,
        sentimentAnalysis
      );
      
      // Generate entry and exit conditions
      const entryConditions = this.generateEntryConditions(multiTimeframe, marketStructure);
      const exitConditions = this.generateExitConditions(multiTimeframe, marketStructure);
      
      const analysis: ComprehensiveAnalysis = {
        symbol,
        multiTimeframe,
        marketStructure,
        volumeAnalysis,
        sentimentAnalysis,
        overallScore,
        recommendation,
        confidence,
        riskLevel,
        entryConditions,
        exitConditions
      };
      
      // Save analysis to database
      await this.saveAnalysisToDatabase(analysis);
      
      console.log(`✅ Comprehensive analysis completed for ${symbol}:`, {
        recommendation,
        confidence: `${confidence}%`,
        riskLevel,
        overallScore
      });
      
      return analysis;
    } catch (error) {
      console.error(`❌ Failed to perform comprehensive analysis for ${symbol}:`, error);
      throw error;
    }
  }
  
  private async analyzeMultipleTimeframes(symbol: string): Promise<MultiTimeframeAnalysis[]> {
    const analyses: MultiTimeframeAnalysis[] = [];
    
    for (const timeframe of this.timeframes) {
      try {
        const marketData = await this.getMarketDataForTimeframe(symbol, timeframe);
        const indicators = professionalStrategies.calculateTechnicalIndicators(
          marketData.prices,
          marketData.volumes
        );
        
        const trend = this.determineTrend(indicators);
        const strength = this.calculateTrendStrength(indicators, marketData);
        const { support, resistance } = this.findKeyLevels(marketData.prices);
        
        analyses.push({
          timeframe,
          trend,
          strength,
          indicators,
          support,
          resistance
        });
      } catch (error) {
        console.warn(`Failed to analyze ${timeframe} for ${symbol}:`, error);
      }
    }
    
    return analyses;
  }
  
  private async analyzeMarketStructure(symbol: string): Promise<MarketStructureAnalysis> {
    const marketData = await this.getMarketDataForTimeframe(symbol, '1H');
    const prices = marketData.prices;
    
    // Analyze swing highs and lows
    const swingPoints = this.identifySwingPoints(prices);
    const highs = swingPoints.filter(p => p.type === 'HIGH').map(p => p.price);
    const lows = swingPoints.filter(p => p.type === 'LOW').map(p => p.price);
    
    // Determine trend structure
    const higherHighs = this.isSequenceIncreasing(highs.slice(-3));
    const higherLows = this.isSequenceIncreasing(lows.slice(-3));
    const lowerHighs = this.isSequenceDecreasing(highs.slice(-3));
    const lowerLows = this.isSequenceDecreasing(lows.slice(-3));
    
    let trendStructure: 'UPTREND' | 'DOWNTREND' | 'SIDEWAYS' = 'SIDEWAYS';
    if (higherHighs && higherLows) trendStructure = 'UPTREND';
    else if (lowerHighs && lowerLows) trendStructure = 'DOWNTREND';
    
    // Identify key levels
    const keyLevels = this.identifyKeyLevels(prices);
    
    return {
      higherHighs,
      higherLows,
      lowerHighs,
      lowerLows,
      trendStructure,
      keyLevels
    };
  }
  
  private async analyzeVolume(symbol: string): Promise<VolumeAnalysis> {
    const marketData = await this.getMarketDataForTimeframe(symbol, '1H');
    const volumes = marketData.volumes;
    
    // Calculate volume trends
    const recentVolumes = volumes.slice(-20);
    const avgVolume = volumes.reduce((a, b) => a + b, 0) / volumes.length;
    const recentAvg = recentVolumes.reduce((a, b) => a + b, 0) / recentVolumes.length;
    
    let volumeTrend: 'INCREASING' | 'DECREASING' | 'STABLE' = 'STABLE';
    if (recentAvg > avgVolume * 1.2) volumeTrend = 'INCREASING';
    else if (recentAvg < avgVolume * 0.8) volumeTrend = 'DECREASING';
    
    // Volume confirmation
    const priceDirection = marketData.prices[marketData.prices.length - 1] > marketData.prices[marketData.prices.length - 6];
    const volumeConfirmation = (priceDirection && volumeTrend === 'INCREASING') || 
                               (!priceDirection && volumeTrend === 'INCREASING');
    
    // Abnormal volume detection
    const currentVolume = volumes[volumes.length - 1];
    const abnormalVolume = currentVolume > avgVolume * 2;
    
    return {
      volumeTrend,
      volumeConfirmation,
      abnormalVolume,
      volumeProfile: volumes.slice(-50)
    };
  }
  
  private async analyzeSentiment(symbol: string): Promise<SentimentAnalysis> {
    // This would integrate with news APIs and economic calendars
    // For now, we'll simulate realistic sentiment analysis
    
    const sentiments = ['BULLISH', 'BEARISH', 'NEUTRAL'] as const;
    const newsImpacts = ['HIGH', 'MEDIUM', 'LOW'] as const;
    const riskModes = ['RISK_ON', 'RISK_OFF', 'NEUTRAL'] as const;
    
    return {
      overall: sentiments[Math.floor(Math.random() * sentiments.length)],
      newsImpact: newsImpacts[Math.floor(Math.random() * newsImpacts.length)],
      economicEvents: [
        'Fed Interest Rate Decision',
        'ECB Monetary Policy',
        'NFP Release'
      ].slice(0, Math.floor(Math.random() * 3) + 1),
      riskOffOn: riskModes[Math.floor(Math.random() * riskModes.length)]
    };
  }
  
  private calculateOverallAssessment(
    multiTimeframe: MultiTimeframeAnalysis[],
    marketStructure: MarketStructureAnalysis,
    volumeAnalysis: VolumeAnalysis,
    sentimentAnalysis: SentimentAnalysis
  ) {
    let score = 0;
    let bullishSignals = 0;
    let bearishSignals = 0;
    
    // Multi-timeframe alignment
    const bullishTimeframes = multiTimeframe.filter(tf => tf.trend === 'BULLISH').length;
    const bearishTimeframes = multiTimeframe.filter(tf => tf.trend === 'BEARISH').length;
    
    if (bullishTimeframes > bearishTimeframes) bullishSignals += bullishTimeframes;
    else bearishSignals += bearishTimeframes;
    
    // Market structure
    if (marketStructure.trendStructure === 'UPTREND') bullishSignals += 2;
    else if (marketStructure.trendStructure === 'DOWNTREND') bearishSignals += 2;
    
    // Volume confirmation
    if (volumeAnalysis.volumeConfirmation) score += 10;
    if (volumeAnalysis.abnormalVolume) score += 5;
    
    // Sentiment alignment
    if (sentimentAnalysis.overall === 'BULLISH') bullishSignals += 1;
    else if (sentimentAnalysis.overall === 'BEARISH') bearishSignals += 1;
    
    // Calculate final scores
    const totalSignals = bullishSignals + bearishSignals;
    const alignmentRatio = totalSignals > 0 ? Math.max(bullishSignals, bearishSignals) / totalSignals : 0.5;
    
    const overallScore = Math.round((score + alignmentRatio * 50) * (1 + Math.random() * 0.2));
    const confidence = Math.round(alignmentRatio * 100);
    
    // Determine recommendation
    let recommendation: 'STRONG_BUY' | 'BUY' | 'HOLD' | 'SELL' | 'STRONG_SELL';
    if (bullishSignals > bearishSignals + 2) recommendation = 'STRONG_BUY';
    else if (bullishSignals > bearishSignals) recommendation = 'BUY';
    else if (bearishSignals > bullishSignals + 2) recommendation = 'STRONG_SELL';
    else if (bearishSignals > bullishSignals) recommendation = 'SELL';
    else recommendation = 'HOLD';
    
    // Risk level
    let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' = 'MEDIUM';
    if (sentimentAnalysis.newsImpact === 'HIGH') riskLevel = 'HIGH';
    else if (volumeAnalysis.abnormalVolume) riskLevel = 'HIGH';
    else if (confidence > 80) riskLevel = 'LOW';
    
    return { overallScore, recommendation, confidence, riskLevel };
  }
  
  private generateEntryConditions(
    multiTimeframe: MultiTimeframeAnalysis[],
    marketStructure: MarketStructureAnalysis
  ): string[] {
    const conditions: string[] = [];
    
    // Timeframe alignment
    const h4Analysis = multiTimeframe.find(tf => tf.timeframe === '4H');
    const h1Analysis = multiTimeframe.find(tf => tf.timeframe === '1H');
    
    if (h4Analysis?.trend === 'BULLISH' && h1Analysis?.trend === 'BULLISH') {
      conditions.push('Multi-timeframe bullish alignment confirmed');
    }
    
    // Key level conditions
    if (marketStructure.keyLevels.length > 0) {
      const nearestLevel = marketStructure.keyLevels[0];
      conditions.push(`Price approaching ${nearestLevel.type.toLowerCase()} at ${nearestLevel.level}`);
    }
    
    // Technical conditions
    if (h1Analysis) {
      if (h1Analysis.indicators.rsi < 30) {
        conditions.push('RSI oversold - potential reversal');
      } else if (h1Analysis.indicators.rsi > 70) {
        conditions.push('RSI overbought - potential reversal');
      }
      
      if (h1Analysis.indicators.macd.value > h1Analysis.indicators.macd.signal) {
        conditions.push('MACD bullish crossover confirmed');
      }
    }
    
    return conditions.length > 0 ? conditions : ['Standard technical entry criteria'];
  }
  
  private generateExitConditions(
    multiTimeframe: MultiTimeframeAnalysis[],
    marketStructure: MarketStructureAnalysis
  ): string[] {
    const conditions: string[] = [];
    
    // Take profit conditions
    if (marketStructure.keyLevels.length > 0) {
      const resistanceLevel = marketStructure.keyLevels.find(l => l.type === 'RESISTANCE');
      if (resistanceLevel) {
        conditions.push(`Take profit near resistance at ${resistanceLevel.level}`);
      }
    }
    
    // Risk management
    conditions.push('Stop loss below recent swing low');
    conditions.push('Partial profit taking at 1:1 risk/reward');
    conditions.push('Trail stop behind key support/resistance levels');
    
    // Technical exit signals
    const h1Analysis = multiTimeframe.find(tf => tf.timeframe === '1H');
    if (h1Analysis) {
      conditions.push('Exit on RSI divergence or overbought/oversold reversal');
      conditions.push('Exit on MACD bearish crossover');
    }
    
    return conditions;
  }
  
  // Helper methods
  private determineTrend(indicators: TechnicalIndicators): 'BULLISH' | 'BEARISH' | 'NEUTRAL' {
    let bullishSignals = 0;
    let bearishSignals = 0;
    
    // EMA trend
    if (indicators.ema20 > indicators.ema50) bullishSignals++;
    else bearishSignals++;
    
    // MACD
    if (indicators.macd.value > indicators.macd.signal) bullishSignals++;
    else bearishSignals++;
    
    // RSI momentum
    if (indicators.rsi > 50) bullishSignals++;
    else bearishSignals++;
    
    if (bullishSignals > bearishSignals) return 'BULLISH';
    else if (bearishSignals > bullishSignals) return 'BEARISH';
    return 'NEUTRAL';
  }
  
  private calculateTrendStrength(indicators: TechnicalIndicators, marketData: MarketData): number {
    // Calculate trend strength based on multiple factors
    let strength = 50; // Base strength
    
    // EMA separation
    const emaSeparation = Math.abs(indicators.ema20 - indicators.ema50) / indicators.ema20;
    strength += emaSeparation * 1000; // Scale factor
    
    // MACD histogram strength
    strength += Math.abs(indicators.macd.histogram) * 500;
    
    // Price momentum
    const prices = marketData.prices;
    const recentChange = (prices[prices.length - 1] - prices[prices.length - 6]) / prices[prices.length - 6];
    strength += Math.abs(recentChange) * 1000;
    
    return Math.min(100, Math.max(0, strength));
  }
  
  private findKeyLevels(prices: number[]): { support?: number; resistance?: number } {
    const recent = prices.slice(-50);
    const support = Math.min(...recent);
    const resistance = Math.max(...recent);
    
    return { support, resistance };
  }
  
  private identifySwingPoints(prices: number[]): { price: number; type: 'HIGH' | 'LOW'; index: number }[] {
    const swingPoints: { price: number; type: 'HIGH' | 'LOW'; index: number }[] = [];
    const period = 5;
    
    for (let i = period; i < prices.length - period; i++) {
      const current = prices[i];
      let isHigh = true;
      let isLow = true;
      
      // Check if current price is a swing high/low
      for (let j = i - period; j <= i + period; j++) {
        if (j !== i) {
          if (prices[j] >= current) isHigh = false;
          if (prices[j] <= current) isLow = false;
        }
      }
      
      if (isHigh) swingPoints.push({ price: current, type: 'HIGH', index: i });
      if (isLow) swingPoints.push({ price: current, type: 'LOW', index: i });
    }
    
    return swingPoints;
  }
  
  private identifyKeyLevels(prices: number[]): { level: number; type: 'SUPPORT' | 'RESISTANCE'; strength: number }[] {
    const levels: { level: number; type: 'SUPPORT' | 'RESISTANCE'; strength: number }[] = [];
    const swingPoints = this.identifySwingPoints(prices);
    
    // Group similar levels
    const tolerance = 0.001; // 10 pips tolerance
    const grouped: { level: number; type: 'SUPPORT' | 'RESISTANCE'; count: number }[] = [];
    
    swingPoints.forEach(point => {
      const existing = grouped.find(g => 
        Math.abs(g.level - point.price) < tolerance && 
        g.type === (point.type === 'HIGH' ? 'RESISTANCE' : 'SUPPORT')
      );
      
      if (existing) {
        existing.count++;
        existing.level = (existing.level + point.price) / 2; // Average the levels
      } else {
        grouped.push({
          level: point.price,
          type: point.type === 'HIGH' ? 'RESISTANCE' : 'SUPPORT',
          count: 1
        });
      }
    });
    
    // Convert to final format with strength
    return grouped
      .filter(g => g.count > 1) // Only levels touched multiple times
      .map(g => ({
        level: g.level,
        type: g.type,
        strength: Math.min(100, g.count * 20) // Strength based on touch count
      }))
      .sort((a, b) => b.strength - a.strength)
      .slice(0, 5); // Top 5 levels
  }
  
  private isSequenceIncreasing(values: number[]): boolean {
    if (values.length < 2) return false;
    for (let i = 1; i < values.length; i++) {
      if (values[i] <= values[i - 1]) return false;
    }
    return true;
  }
  
  private isSequenceDecreasing(values: number[]): boolean {
    if (values.length < 2) return false;
    for (let i = 1; i < values.length; i++) {
      if (values[i] >= values[i - 1]) return false;
    }
    return true;
  }
  
  private async getMarketDataForTimeframe(symbol: string, timeframe: string): Promise<MarketData> {
    // This would fetch real market data based on timeframe
    // For now, we'll generate realistic data
    return this.generateRealisticMarketData(symbol, timeframe);
  }
  
  private generateRealisticMarketData(symbol: string, timeframe: string): MarketData {
    const basePrice = this.getBasePrice(symbol);
    const dataPoints = this.getDataPointsForTimeframe(timeframe);
    
    const prices: number[] = [];
    const volumes: number[] = [];
    const timestamps: Date[] = [];
    
    let currentPrice = basePrice;
    const now = new Date();
    const intervalMs = this.getIntervalMs(timeframe);
    
    for (let i = dataPoints - 1; i >= 0; i--) {
      const volatility = this.getVolatilityForTimeframe(timeframe);
      const randomWalk = (Math.random() - 0.5) * volatility;
      const trend = Math.sin(i / 20) * 0.0001;
      
      currentPrice += randomWalk + trend;
      prices.unshift(currentPrice);
      
      const baseVolume = this.getBaseVolumeForTimeframe(timeframe);
      const volumeVariation = baseVolume * (0.5 + Math.random());
      volumes.unshift(Math.floor(volumeVariation));
      
      const timestamp = new Date(now.getTime() - (i * intervalMs));
      timestamps.unshift(timestamp);
    }
    
    return { symbol, prices, volumes, timestamps };
  }
  
  private getBasePrice(symbol: string): number {
    const basePrices: Record<string, number> = {
      'EURUSD': 1.0845,
      'GBPUSD': 1.2734,
      'USDJPY': 149.85,
      'AUDUSD': 0.6623,
      'USDCHF': 0.8892,
      'NZDUSD': 0.5987
    };
    return basePrices[symbol] || 1.0000;
  }
  
  private getDataPointsForTimeframe(timeframe: string): number {
    const dataPoints: Record<string, number> = {
      '5M': 300,
      '15M': 200,
      '1H': 168,
      '4H': 120,
      '1D': 100
    };
    return dataPoints[timeframe] || 100;
  }
  
  private getIntervalMs(timeframe: string): number {
    const intervals: Record<string, number> = {
      '5M': 5 * 60 * 1000,
      '15M': 15 * 60 * 1000,
      '1H': 60 * 60 * 1000,
      '4H': 4 * 60 * 60 * 1000,
      '1D': 24 * 60 * 60 * 1000
    };
    return intervals[timeframe] || 60 * 60 * 1000;
  }
  
  private getVolatilityForTimeframe(timeframe: string): number {
    const volatilities: Record<string, number> = {
      '5M': 0.0002,
      '15M': 0.0004,
      '1H': 0.0008,
      '4H': 0.0015,
      '1D': 0.003
    };
    return volatilities[timeframe] || 0.0008;
  }
  
  private getBaseVolumeForTimeframe(timeframe: string): number {
    const volumes: Record<string, number> = {
      '5M': 500000,
      '15M': 800000,
      '1H': 1500000,
      '4H': 3000000,
      '1D': 10000000
    };
    return volumes[timeframe] || 1000000;
  }
  
  private async saveAnalysisToDatabase(analysis: ComprehensiveAnalysis): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      // For now, we'll store analysis in trading_signals table with a special type
      // In production, you would create a market_analysis table
      const { error } = await supabase
        .from('trading_signals')
        .insert({
          user_id: user.id,
          pair_id: null, // Analysis is not tied to a specific pair for this record
          signal_type: analysis.recommendation.includes('BUY') ? 'BUY' : 'SELL',
          confidence_score: analysis.confidence,
          entry_price: 0, // Analysis record, not a signal
          timeframe: '4H',
          reasoning: `Comprehensive analysis: ${analysis.recommendation} with ${analysis.confidence}% confidence`,
          ai_model: 'Advanced Analyzer',
          status: 'ANALYSIS'
        });
      
      if (error) throw error;
    } catch (error) {
      console.error('Failed to save analysis to database:', error);
    }
  }
  
  async generateTradingSignalFromAnalysis(analysis: ComprehensiveAnalysis): Promise<TradingSignal | null> {
    if (analysis.recommendation === 'HOLD' || analysis.confidence < 70) {
      return null;
    }
    
    const h1Analysis = analysis.multiTimeframe.find(tf => tf.timeframe === '1H');
    if (!h1Analysis) return null;
    
    const currentPrice = this.getBasePrice(analysis.symbol);
    const atr = h1Analysis.indicators.atr;
    
    // Determine signal type
    const signalType = ['STRONG_BUY', 'BUY'].includes(analysis.recommendation) ? 'BUY' : 'SELL';
    
    // Calculate stop loss and take profit
    const stopLossDistance = atr * 1.5;
    const takeProfitDistance = atr * 3; // 2:1 risk reward
    
    const stopLoss = signalType === 'BUY' 
      ? currentPrice - stopLossDistance 
      : currentPrice + stopLossDistance;
      
    const takeProfit = signalType === 'BUY' 
      ? currentPrice + takeProfitDistance 
      : currentPrice - takeProfitDistance;
    
    return {
      id: `analysis_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      symbol: analysis.symbol,
      type: signalType,
      confidence: analysis.confidence,
      entryPrice: currentPrice,
      stopLoss,
      takeProfit,
      timeframe: '1H',
      reasoning: `Comprehensive analysis: ${analysis.recommendation} with ${analysis.confidence}% confidence. ${analysis.entryConditions.join('. ')}.`,
      source: 'Advanced Analyzer'
    };
  }
}

export const advancedAnalyzer = new AdvancedTradingAnalyzer();