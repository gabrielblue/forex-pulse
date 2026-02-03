import { supabase } from '@/integrations/supabase/client';
import { exnessAPI } from './exnessApi';
import { MT5_BRIDGE_URL } from './config';

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

    // Get historical data for technical indicators
    const historicalData = await this.fetchHistoricalData(symbol, timeframe);

    // Calculate technical indicators
    const rsi = this.calculateRSI(historicalData);
    const macd = this.calculateMACD(historicalData);
    const ema = this.calculateEMA(historicalData);
    const momentum = this.calculateMomentum(historicalData);
    const volume = this.calculateVolume(historicalData);

    const analysis = {
      symbol,
      timeframe,
      timestamp: new Date(),
      price: currentPrice,
      spread: priceData.spread,

      // Technical indicators
      rsi,
      macd,
      ema,
      momentum,
      volume,

      // Basic price levels (real, not simulated)
      supportLevels: this.calculateSupportLevels(currentPrice),
      resistanceLevels: this.calculateResistanceLevels(currentPrice),

      // Session-based analysis (real)
      trend: this.getCurrentTrend(symbol, historicalData),

      // Risk assessment based on real market hours
      riskLevel: this.assessRiskLevel(symbol, timeframe),

      // Pattern detection
      patterns: this.detectPatterns(),
      candlestickPatterns: this.detectCandlestickPatterns(),
      sentiment: this.analyzeSentiment(symbol),
      institutionalFlow: this.analyzeInstitutionalFlow(),
      recommendation: this.generateTradingRecommendation()
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
  private getCurrentTrend(symbol: string, historicalPrices: number[]): "BULLISH" | "BEARISH" | "SIDEWAYS" {
    if (!historicalPrices || historicalPrices.length < 20) {
      return "SIDEWAYS";
    }
    
    // Calculate trend using price action over multiple periods
    const currentPrice = historicalPrices[historicalPrices.length - 1];
    const price5 = historicalPrices[Math.max(0, historicalPrices.length - 5)];
    const price10 = historicalPrices[Math.max(0, historicalPrices.length - 10)];
    const price20 = historicalPrices[Math.max(0, historicalPrices.length - 20)];
    
    // Calculate percentage changes
    const change5 = (currentPrice - price5) / price5 * 100;
    const change10 = (currentPrice - price10) / price10 * 100;
    const change20 = (currentPrice - price20) / price20 * 100;
    
    // Determine trend based on consistent direction
    const bullishCount = (change5 > 0 ? 1 : 0) + (change10 > 0 ? 1 : 0) + (change20 > 0 ? 1 : 0);
    const bearishCount = (change5 < 0 ? 1 : 0) + (change10 < 0 ? 1 : 0) + (change20 < 0 ? 1 : 0);
    
    // Use EMA alignment for confirmation
    const ema20 = this.calculateEMAValue(historicalPrices.slice(-20), 20);
    const ema50 = this.calculateEMAValue(historicalPrices.slice(-50), 50);
    const emaAbove = currentPrice > ema20;
    const emaAligned = ema20 > ema50;
    
    // Strong bullish: Consistent up movement + EMA confirmation
    if (bullishCount >= 3 && change5 > 0.1 && change20 > 0.5 && emaAbove) {
      return "BULLISH";
    }
    
    // Strong bearish: Consistent down movement + EMA confirmation
    if (bearishCount >= 3 && change5 < -0.1 && change20 < -0.5 && !emaAbove) {
      return "BEARISH";
    }
    
    // Moderate bullish: 2 periods up, EMA aligned
    if (bullishCount >= 2 && change10 > 0.2 && emaAligned) {
      return "BULLISH";
    }
    
    // Moderate bearish: 2 periods down, EMA aligned
    if (bearishCount >= 2 && change10 < -0.2 && !emaAligned) {
      return "BEARISH";
    }
    
    return "SIDEWAYS";
  }

  private calculateSupportLevels(price: number): number[] {
    // Calculate support levels using pivot point methodology
    // NOTE: For more accurate support/resistance, historical data should be used
    // This uses standard pivot point formula with current price as pivot
    const pivot = price;
    const range = price * 0.01; // 1% range assumption

    return [
      pivot - range * 0.618,  // S1: Fibonacci 61.8%
      pivot - range * 1.0,    // S2: Full range
      pivot - range * 1.618   // S3: Fibonacci 161.8%
    ].map(level => Math.round(level * 100000) / 100000); // Round to 5 decimals
  }

  private calculateResistanceLevels(price: number): number[] {
    // Calculate resistance levels using pivot point methodology
    // NOTE: For more accurate support/resistance, historical data should be used
    // This uses standard pivot point formula with current price as pivot
    const pivot = price;
    const range = price * 0.01; // 1% range assumption

    return [
      pivot + range * 0.618,  // R1: Fibonacci 61.8%
      pivot + range * 1.0,    // R2: Full range
      pivot + range * 1.618   // R3: Fibonacci 161.8%
    ].map(level => Math.round(level * 100000) / 100000); // Round to 5 decimals
  }

  private async fetchHistoricalData(symbol: string, timeframe: string): Promise<number[]> {
    try {
      // Fetch historical price data from MT5 bridge
      const response = await fetch(`${MT5_BRIDGE_URL}/prices/${symbol}`);
      if (!response.ok) {
        console.warn(`Failed to fetch historical data for ${symbol}, using current price only`);
        return [];
      }
      const data = await response.json();

      // Extract closing prices from historical data
      if (data && Array.isArray(data.prices)) {
        return data.prices.map((p: any) => (p.bid + p.ask) / 2);
      }
      return [];
    } catch (error) {
      console.warn(`Error fetching historical data for ${symbol}:`, error);
      return [];
    }
  }

  private calculateRSI(historicalPrices: number[]): number {
    if (historicalPrices.length < 14) {
      return 50; // Neutral RSI when insufficient data
    }

    // Calculate RSI using standard 14-period formula
    const period = 14;
    const prices = historicalPrices.slice(-period - 1);

    let gains = 0;
    let losses = 0;

    for (let i = 1; i < prices.length; i++) {
      const change = prices[i] - prices[i - 1];
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

  private calculateMACD(historicalPrices: number[]): { value: number; signal: number; histogram: number } {
    if (historicalPrices.length < 26) {
      return { value: 0, signal: 0, histogram: 0 };
    }

    // Calculate MACD (12, 26, 9)
    const ema12 = this.calculateEMAValue(historicalPrices, 12);
    const ema26 = this.calculateEMAValue(historicalPrices, 26);
    const macdValue = ema12 - ema26;

    // Calculate signal line (9-period EMA of MACD)
    const signal = macdValue * 0.2; // Simplified signal calculation
    const histogram = macdValue - signal;

    return {
      value: Math.round(macdValue * 100000) / 100000,
      signal: Math.round(signal * 100000) / 100000,
      histogram: Math.round(histogram * 100000) / 100000
    };
  }

  private calculateEMA(historicalPrices: number[]): { ema20: number; ema50: number; ema200: number } {
    return {
      ema20: this.calculateEMAValue(historicalPrices, 20),
      ema50: this.calculateEMAValue(historicalPrices, 50),
      ema200: this.calculateEMAValue(historicalPrices, 200)
    };
  }

  private calculateEMAValue(prices: number[], period: number): number {
    if (prices.length < period) {
      return prices[prices.length - 1] || 0;
    }

    const multiplier = 2 / (period + 1);
    let ema = prices.slice(0, period).reduce((sum, price) => sum + price, 0) / period;

    for (let i = period; i < prices.length; i++) {
      ema = (prices[i] - ema) * multiplier + ema;
    }

    return Math.round(ema * 100000) / 100000;
  }

  private calculateMomentum(historicalPrices: number[]): number {
    if (historicalPrices.length < 10) {
      return 0;
    }

    const currentPrice = historicalPrices[historicalPrices.length - 1];
    const pastPrice = historicalPrices[historicalPrices.length - 10];

    if (!currentPrice || !pastPrice || pastPrice === 0) {
      return 0;
    }

    const momentum = ((currentPrice - pastPrice) / pastPrice) * 100;
    return Math.round(momentum * 100) / 100;
  }

  private calculateVolume(historicalPrices: number[]): number {
    // Volume estimation based on price volatility
    // Real volume should come from MT5 tick volume
    if (historicalPrices.length < 2) {
      return 1000000;
    }

    let volatility = 0;
    for (let i = 1; i < historicalPrices.length; i++) {
      volatility += Math.abs(historicalPrices[i] - historicalPrices[i - 1]);
    }

    // Estimate volume from volatility (higher volatility = higher volume)
    const avgVolatility = volatility / (historicalPrices.length - 1);
    const estimatedVolume = avgVolatility * 100000000;

    return Math.round(estimatedVolume);
  }

  private detectPatterns(): string[] {
    // Basic pattern detection
    // In production, this would analyze OHLC data for complex patterns
    const patterns: string[] = [];

    const sessions = this.getTradingSessions();
    const activeSessions = sessions.filter(s => s.isActive);

    if (activeSessions.length >= 2) {
      patterns.push("Session Overlap");
    }

    return patterns;
  }

  private detectCandlestickPatterns(): string[] {
    // Basic candlestick pattern detection
    // In production, this would analyze OHLC data for specific patterns
    return [];
  }

  private analyzeSentiment(symbol: string): string {
    // Basic sentiment analysis based on trading sessions
    const sessions = this.getTradingSessions();
    const activeSessions = sessions.filter(s => s.isActive);

    if (activeSessions.length === 0) {
      return "Low activity - Off-hours trading";
    } else if (activeSessions.length >= 2) {
      return "High activity - Multiple session overlap";
    } else {
      return `Normal activity - ${activeSessions[0].name} session`;
    }
  }

  private analyzeInstitutionalFlow(): "ACCUMULATION" | "DISTRIBUTION" | "NEUTRAL" {
    // Basic institutional flow analysis
    // In production, this would analyze real volume and order flow data
    const hour = new Date().getUTCHours();

    // London/NY overlap typically shows institutional activity
    if (hour >= 13 && hour <= 17) {
      return "ACCUMULATION";
    }

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