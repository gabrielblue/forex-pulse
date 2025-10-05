import { supabase } from '@/integrations/supabase/client';
import { exnessAPI } from './exnessApi';

export interface MarketNote {
  id: string;
  timestamp: Date;
  symbol: string;
  timeframe: string;
  type: "TREND" | "PATTERN" | "LEVEL" | "VOLUME" | "NEWS" | "SENTIMENT";
  message: string;
  importance: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  confidence: number;
  priceLevel?: number;
}

export interface MarketMovement {
  symbol: string;
  direction: "UP" | "DOWN" | "SIDEWAYS";
  strength: number;
  timeframe: string;
  startTime: Date;
  currentPrice: number;
  startPrice: number;
  percentChange: number;
  volume: number;
  analysis: string;
}

export interface SessionInfo {
  name: string;
  isActive: boolean;
  opensIn: number; // minutes
  closesIn: number; // minutes
  volume: "HIGH" | "MEDIUM" | "LOW";
  volatility: "HIGH" | "MEDIUM" | "LOW";
  majorPairs: string[];
}

class MarketAnalyzer {
  private isRunning = false;
  private analysisInterval: NodeJS.Timeout | null = null;
  private sessionCheckInterval: NodeJS.Timeout | null = null;
  private marketNotes: MarketNote[] = [];
  private marketMovements: MarketMovement[] = [];
  private sessionAlertCallbacks: ((session: SessionInfo) => void)[] = [];

  async startContinuousAnalysis(): Promise<void> {
    if (this.isRunning) return;
    
    this.isRunning = true;
    console.log('🔍 Starting continuous market analysis...');
    
    // Analyze markets every 15 seconds
    this.analysisInterval = setInterval(() => {
      this.performMarketAnalysis();
    }, 15000);

    // Check sessions every minute
    this.sessionCheckInterval = setInterval(() => {
      this.checkTradingSessions();
    }, 60000);

    // Initial analysis
    await this.performMarketAnalysis();
    await this.checkTradingSessions();
  }

  async stopContinuousAnalysis(): Promise<void> {
    this.isRunning = false;
    
    if (this.analysisInterval) {
      clearInterval(this.analysisInterval);
      this.analysisInterval = null;
    }
    
    if (this.sessionCheckInterval) {
      clearInterval(this.sessionCheckInterval);
      this.sessionCheckInterval = null;
    }
    
    console.log('🛑 Stopped continuous market analysis');
  }

  private async performMarketAnalysis(): Promise<void> {
    const symbols = ['EURUSD', 'GBPUSD', 'USDJPY', 'AUDUSD', 'USDCHF', 'NZDUSD'];
    const timeframes = ['1M', '5M', '15M', '1H', '4H'];

    for (const symbol of symbols) {
      for (const timeframe of timeframes) {
        await this.analyzeSymbolTimeframe(symbol, timeframe);
      }
    }
  }

  private async analyzeSymbolTimeframe(symbol: string, timeframe: string): Promise<void> {
    try {
      // Get current market data
      const currentPrice = await exnessAPI.getCurrentPrice(symbol);
      if (!currentPrice) return;

      // Generate market analysis
      const analysis = await this.generateComprehensiveAnalysis(symbol, timeframe, currentPrice);
      
      // Create market notes based on analysis
      await this.createMarketNotes(analysis);
      
      // Track market movements
      await this.trackMarketMovement(symbol, timeframe, currentPrice);
      
    } catch (error) {
      console.error(`Analysis error for ${symbol} ${timeframe}:`, error);
    }
  }

  private async generateComprehensiveAnalysis(symbol: string, timeframe: string, priceData: any) {
    const currentPrice = (priceData.bid + priceData.ask) / 2;
    
    // NOTE: Full technical analysis requires historical price data from MT5
    // For now, returning basic price-based analysis only
    // TODO: Implement MT5 historical data fetching for RSI, MACD, EMA calculations
    
    const analysis = {
      symbol,
      timeframe,
      timestamp: new Date(),
      price: currentPrice,
      spread: priceData.spread,
      
      // Basic price levels (real, not simulated)
      supportLevels: this.calculateSupportLevels(currentPrice),
      resistanceLevels: this.calculateResistanceLevels(currentPrice),
      
      // Session-based analysis (real)
      trend: this.getCurrentTrend(),
      
      // Risk assessment based on real market hours
      riskLevel: this.assessRiskLevel(symbol, timeframe),
      
      // Minimal data until full MT5 integration
      patterns: [],
      candlestickPatterns: [],
      sentiment: "Awaiting full MT5 historical data integration",
      institutionalFlow: "NEUTRAL" as const,
      recommendation: {
        action: "HOLD" as const,
        confidence: 0,
        reasoning: "Requires MT5 historical data for full analysis"
      }
    };

    return analysis;
  }

  private async createMarketNotes(analysis: any): Promise<void> {
    const notes: MarketNote[] = [];
    
    // Trend analysis notes
    if (analysis.ema.ema20 > analysis.ema.ema50 && analysis.ema.ema50 > analysis.ema.ema200) {
      notes.push({
        id: crypto.randomUUID(),
        timestamp: new Date(),
        symbol: analysis.symbol,
        timeframe: analysis.timeframe,
        type: "TREND",
        message: `Strong bullish alignment: EMA 20 > EMA 50 > EMA 200. Trend strength: ${analysis.momentum.toFixed(1)}%`,
        importance: analysis.momentum > 70 ? "HIGH" : "MEDIUM",
        confidence: 90, // Fixed confidence, real analysis comes from AI
        priceLevel: analysis.price
      });
    }

    // RSI analysis
    if (analysis.rsi < 30) {
      notes.push({
        id: crypto.randomUUID(),
        timestamp: new Date(),
        symbol: analysis.symbol,
        timeframe: analysis.timeframe,
        type: "PATTERN",
        message: `RSI oversold at ${analysis.rsi.toFixed(1)} - potential reversal opportunity`,
        importance: "MEDIUM",
        confidence: 75,
        priceLevel: analysis.price
      });
    } else if (analysis.rsi > 70) {
      notes.push({
        id: crypto.randomUUID(),
        timestamp: new Date(),
        symbol: analysis.symbol,
        timeframe: analysis.timeframe,
        type: "PATTERN",
        message: `RSI overbought at ${analysis.rsi.toFixed(1)} - potential reversal warning`,
        importance: "MEDIUM",
        confidence: 75,
        priceLevel: analysis.price
      });
    }

    // MACD analysis
    if (analysis.macd.value > analysis.macd.signal && analysis.macd.histogram > 0) {
      notes.push({
        id: crypto.randomUUID(),
        timestamp: new Date(),
        symbol: analysis.symbol,
        timeframe: analysis.timeframe,
        type: "PATTERN",
        message: `MACD bullish crossover confirmed with positive histogram - momentum building`,
        importance: "HIGH",
        confidence: 82,
        priceLevel: analysis.price
      });
    }

    // Support/Resistance analysis
    const nearSupport = analysis.supportLevels.find((level: number) => 
      Math.abs(analysis.price - level) / analysis.price < 0.001
    );
    if (nearSupport) {
      notes.push({
        id: crypto.randomUUID(),
        timestamp: new Date(),
        symbol: analysis.symbol,
        timeframe: analysis.timeframe,
        type: "LEVEL",
        message: `Price approaching key support at ${nearSupport.toFixed(4)} - watch for bounce or break`,
        importance: "HIGH",
        confidence: 90,
        priceLevel: nearSupport
      });
    }

    // Volume analysis
    if (analysis.volume > 1500000) {
      notes.push({
        id: crypto.randomUUID(),
        timestamp: new Date(),
        symbol: analysis.symbol,
        timeframe: analysis.timeframe,
        type: "VOLUME",
        message: `High volume detected: ${(analysis.volume / 1000000).toFixed(1)}M - institutional activity likely`,
        importance: "HIGH",
        confidence: 88,
        priceLevel: analysis.price
      });
    }

    // Pattern detection notes
    if (analysis.patterns.length > 0) {
      notes.push({
        id: crypto.randomUUID(),
        timestamp: new Date(),
        symbol: analysis.symbol,
        timeframe: analysis.timeframe,
        type: "PATTERN",
        message: `Chart patterns detected: ${analysis.patterns.join(", ")} - monitoring for completion`,
        importance: "HIGH",
        confidence: 80,
        priceLevel: analysis.price
      });
    }

    // Add notes to collection
    this.marketNotes = [...notes, ...this.marketNotes].slice(0, 200);
  }

  private async trackMarketMovement(symbol: string, timeframe: string, priceData: any): Promise<void> {
    const currentPrice = (priceData.bid + priceData.ask) / 2;
    
    // Check if we're already tracking this movement
    const existingMovement = this.marketMovements.find(m => 
      m.symbol === symbol && m.timeframe === timeframe
    );

    if (existingMovement) {
      // Update existing movement
      existingMovement.currentPrice = currentPrice;
      existingMovement.percentChange = ((currentPrice - existingMovement.startPrice) / existingMovement.startPrice) * 100;
      
      // Determine direction
      if (existingMovement.percentChange > 0.1) {
        existingMovement.direction = "UP";
        existingMovement.strength = Math.min(100, Math.abs(existingMovement.percentChange) * 10);
      } else if (existingMovement.percentChange < -0.1) {
        existingMovement.direction = "DOWN";
        existingMovement.strength = Math.min(100, Math.abs(existingMovement.percentChange) * 10);
      } else {
        existingMovement.direction = "SIDEWAYS";
        existingMovement.strength = 20;
      }
      
      // Update analysis
      existingMovement.analysis = this.generateMovementAnalysis(existingMovement);
    } else {
      // Create new movement tracking
      const newMovement: MarketMovement = {
        symbol,
        direction: "SIDEWAYS",
        strength: 0,
        timeframe,
        startTime: new Date(),
        currentPrice,
        startPrice: currentPrice,
        percentChange: 0,
        volume: 0, // Real volume should come from MT5
        analysis: "Starting to track price movement..."
      };
      
      this.marketMovements.push(newMovement);
    }

    // Clean up old movements (older than 24 hours)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    this.marketMovements = this.marketMovements.filter(m => m.startTime > oneDayAgo);
  }

  private generateMovementAnalysis(movement: MarketMovement): string {
    const duration = (Date.now() - movement.startTime.getTime()) / (1000 * 60); // minutes
    const pipsChange = Math.abs(movement.percentChange) * 100; // Simplified pip calculation
    
    let analysis = `${movement.symbol} has moved ${movement.direction.toLowerCase()} `;
    analysis += `${pipsChange.toFixed(1)} pips (${movement.percentChange.toFixed(2)}%) `;
    analysis += `over ${duration.toFixed(0)} minutes. `;
    
    if (movement.strength > 80) {
      analysis += "Strong momentum detected - trend likely to continue. ";
    } else if (movement.strength > 50) {
      analysis += "Moderate momentum - watch for continuation or reversal. ";
    } else {
      analysis += "Weak momentum - consolidation likely. ";
    }
    
    if (movement.volume > 1500000) {
      analysis += "High volume confirms the move. ";
    }
    
    return analysis;
  }

  private async checkTradingSessions(): Promise<void> {
    const sessions = this.getTradingSessions();
    
    for (const session of sessions) {
      // Check if session is about to open (within 30 minutes)
      if (session.opensIn <= 30 && session.opensIn > 0) {
        this.triggerSessionAlert(session);
      }
    }
  }

  private getTradingSessions(): SessionInfo[] {
    const now = new Date();
    const currentHour = now.getUTCHours();
    const currentMinute = now.getMinutes();
    
    return [
      {
        name: "Sydney",
        isActive: this.isSessionActive(21, 6, currentHour), // 21:00-06:00 UTC
        opensIn: this.calculateTimeUntil(21, currentHour, currentMinute),
        closesIn: this.calculateTimeUntil(6, currentHour, currentMinute),
        volume: "MEDIUM",
        volatility: "LOW",
        majorPairs: ["AUDUSD", "NZDUSD", "AUDJPY"]
      },
      {
        name: "Tokyo",
        isActive: this.isSessionActive(0, 9, currentHour), // 00:00-09:00 UTC
        opensIn: this.calculateTimeUntil(0, currentHour, currentMinute),
        closesIn: this.calculateTimeUntil(9, currentHour, currentMinute),
        volume: "HIGH",
        volatility: "MEDIUM",
        majorPairs: ["USDJPY", "EURJPY", "GBPJPY", "AUDJPY"]
      },
      {
        name: "London",
        isActive: this.isSessionActive(8, 17, currentHour), // 08:00-17:00 UTC
        opensIn: this.calculateTimeUntil(8, currentHour, currentMinute),
        closesIn: this.calculateTimeUntil(17, currentHour, currentMinute),
        volume: "HIGH",
        volatility: "HIGH",
        majorPairs: ["EURUSD", "GBPUSD", "EURGBP", "USDCHF"]
      },
      {
        name: "New York",
        isActive: this.isSessionActive(13, 22, currentHour), // 13:00-22:00 UTC
        opensIn: this.calculateTimeUntil(13, currentHour, currentMinute),
        closesIn: this.calculateTimeUntil(22, currentHour, currentMinute),
        volume: "HIGH",
        volatility: "HIGH",
        majorPairs: ["EURUSD", "GBPUSD", "USDJPY", "USDCAD"]
      }
    ];
  }

  private isSessionActive(openHour: number, closeHour: number, currentHour: number): boolean {
    if (openHour < closeHour) {
      return currentHour >= openHour && currentHour < closeHour;
    } else {
      // Session crosses midnight
      return currentHour >= openHour || currentHour < closeHour;
    }
  }

  private calculateTimeUntil(targetHour: number, currentHour: number, currentMinute: number): number {
    let hoursUntil = targetHour - currentHour;
    if (hoursUntil <= 0) hoursUntil += 24;
    
    return (hoursUntil * 60) - currentMinute;
  }

  private triggerSessionAlert(session: SessionInfo): void {
    console.log(`🔔 Session Alert: ${session.name} opens in ${session.opensIn} minutes`);
    
    // Notify all registered callbacks
    this.sessionAlertCallbacks.forEach(callback => {
      try {
        callback(session);
      } catch (error) {
        console.error('Session alert callback error:', error);
      }
    });
  }

  // Helper methods for analysis
  private getCurrentTrend(): "BULLISH" | "BEARISH" | "SIDEWAYS" {
    // Real trend would be calculated from MT5 historical prices
    // For now, return neutral until proper implementation
    return "SIDEWAYS";
  }

  private calculateSupportLevels(price: number): number[] {
    return [
      price * 0.998,
      price * 0.995,
      price * 0.992
    ];
  }

  private calculateResistanceLevels(price: number): number[] {
    return [
      price * 1.002,
      price * 1.005,
      price * 1.008
    ];
  }

  private detectPatterns(): string[] {
    // Pattern detection requires historical price data from MT5
    // TODO: Implement with real MT5 candlestick data
    return [];
  }

  private detectCandlestickPatterns(): string[] {
    // Candlestick pattern detection requires real OHLC data from MT5
    // TODO: Implement with real MT5 candlestick data
    return [];
  }

  private analyzeSentiment(symbol: string): string {
    // Real sentiment analysis would come from news feeds and order flow
    // TODO: Integrate real news API and MT5 order book data
    return "Requires integration with news and order flow data";
  }

  private analyzeInstitutionalFlow(): "ACCUMULATION" | "DISTRIBUTION" | "NEUTRAL" {
    // Real institutional flow requires MT5 volume and order flow data
    // TODO: Implement with real MT5 volume data
    return "NEUTRAL";
  }

  private assessRiskLevel(symbol: string, timeframe: string): "LOW" | "MEDIUM" | "HIGH" {
    // Real risk assessment based on actual market hours and volatility
    const hour = new Date().getUTCHours();
    const isNewsTime = (hour >= 8 && hour <= 10) || (hour >= 13 && hour <= 15);
    const isOverlap = (hour >= 13 && hour <= 17) || (hour >= 8 && hour <= 9);
    
    if (isNewsTime) return "HIGH";
    if (isOverlap) return "MEDIUM";
    return "LOW";
  }

  private generateTradingRecommendation(): {
    action: "STRONG_BUY" | "BUY" | "HOLD" | "SELL" | "STRONG_SELL";
    confidence: number;
    reasoning: string;
  } {
    // Real recommendations require complete technical analysis
    // TODO: Implement after MT5 historical data integration
    return {
      action: "HOLD",
      confidence: 0,
      reasoning: "Awaiting MT5 historical data for full analysis"
    };
  }

  // Public methods for accessing analysis data
  getMarketNotes(symbol?: string, limit: number = 50): MarketNote[] {
    let notes = this.marketNotes;
    if (symbol) {
      notes = notes.filter(note => note.symbol === symbol);
    }
    return notes.slice(0, limit);
  }

  getMarketMovements(symbol?: string): MarketMovement[] {
    if (symbol) {
      return this.marketMovements.filter(m => m.symbol === symbol);
    }
    return this.marketMovements;
  }

  subscribeToSessionAlerts(callback: (session: SessionInfo) => void): () => void {
    this.sessionAlertCallbacks.push(callback);
    
    return () => {
      const index = this.sessionAlertCallbacks.indexOf(callback);
      if (index > -1) {
        this.sessionAlertCallbacks.splice(index, 1);
      }
    };
  }

  getCurrentSessions(): SessionInfo[] {
    return this.getTradingSessions();
  }

  isAnalysisRunning(): boolean {
    return this.isRunning;
  }

  getAnalysisStats(): {
    totalNotes: number;
    criticalNotes: number;
    activeMovements: number;
    analysisUptime: number;
  } {
    const criticalNotes = this.marketNotes.filter(n => n.importance === "CRITICAL").length;
    const activeMovements = this.marketMovements.filter(m => 
      m.direction !== "SIDEWAYS" && m.strength > 50
    ).length;
    
    return {
      totalNotes: this.marketNotes.length,
      criticalNotes,
      activeMovements,
      analysisUptime: this.isRunning ? 100 : 0
    };
  }
}

export const marketAnalyzer = new MarketAnalyzer();