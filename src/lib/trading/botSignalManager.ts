import { supabase } from '@/integrations/supabase/client';
import { orderManager } from './orderManager';
import { exnessAPI } from './exnessApi';
import { signalProcessor } from './signalProcessor';
import { professionalStrategies } from './strategies/professionalStrategies';
import { enhancedTradingSystem } from './strategies/enhancedStrategies';
import { aiAnalyzer } from './aiAnalyzer';

export interface SignalGenerationConfig {
  enabled: boolean;
  interval: number; // milliseconds - ultra aggressive for day trading
  symbols: string[];
  minConfidence: number;
  autoExecute: boolean;
  maxDailySignals: number;
  aggressiveMode: boolean;
}

class BotSignalManager {
  private config: SignalGenerationConfig = {
    enabled: false,
    interval: 1000, // Ultra aggressive: 1 second for maximum day trading
    symbols: ['EURUSD', 'GBPUSD', 'USDJPY', 'AUDUSD', 'USDCHF', 'NZDUSD', 'XAUUSD', 'EURJPY', 'GBPJPY', 'USDCAD'], // All major pairs
    minConfidence: 10, // Ultra aggressive: lowered to 10% for maximum trades
    autoExecute: false,
    maxDailySignals: 2000, // Ultra high limit for day trading
    aggressiveMode: true
  };

  private generationInterval: NodeJS.Timeout | null = null;
  private isGenerating = false;
  private lastGenerationTime = 0;
  private dailySignalCount = 0;
  private lastResetDate = new Date().toDateString();

  async initialize(config?: Partial<SignalGenerationConfig>): Promise<void> {
    if (config) {
      this.config = { ...this.config, ...config };
    }
    this.resetDailyCountersIfNeeded();
    console.log('📡 Signal Manager initialized with config:', this.config);
  }

  private resetDailyCountersIfNeeded(): void {
    const today = new Date().toDateString();
    if (this.lastResetDate !== today) {
      this.dailySignalCount = 0;
      this.lastResetDate = today;
      console.log('🔄 Daily signal counters reset for new trading day');
    }
  }

  startAutomaticGeneration(): void {
    if (this.generationInterval) {
      console.log('🔄 Signal generation already running');
      return;
    }

    console.log(`🚀 Starting ULTRA AGGRESSIVE signal generation (interval: ${this.config.interval/1000}s, min confidence: ${this.config.minConfidence}%, max daily: ${this.config.maxDailySignals})`);
    
    // Start generation loop
    this.generationInterval = setInterval(async () => {
      if (this.config.enabled && !this.isGenerating && this.canGenerateMoreSignals()) {
        await this.generateAndProcessSignals();
      }
    }, this.config.interval);

    // Generate immediately
    setTimeout(() => {
      if (this.canGenerateMoreSignals()) {
        this.generateAndProcessSignals();
      }
    }, 1000); // Start after 1 second
  }

  private canGenerateMoreSignals(): boolean {
    this.resetDailyCountersIfNeeded();
    return this.dailySignalCount < this.config.maxDailySignals;
  }

  stopAutomaticGeneration(): void {
    if (this.generationInterval) {
      clearInterval(this.generationInterval);
      this.generationInterval = null;
      console.log('🛑 Stopped automatic signal generation');
    }
  }

  async generateAndProcessSignals(): Promise<void> {
    if (this.isGenerating) {
      return;
    }

    // Rate limiting
    const timeSinceLastGeneration = Date.now() - this.lastGenerationTime;
    if (timeSinceLastGeneration < 1000) { // Ultra aggressive: 1 second minimum
      return;
    }

    if (!this.canGenerateMoreSignals()) {
      console.log(`📊 Daily signal limit reached: ${this.dailySignalCount}/${this.config.maxDailySignals}`);
      return;
    }

    this.isGenerating = true;
    this.lastGenerationTime = Date.now();
    this.dailySignalCount++;

    try {
      console.log(`🔍 Analyzing market for trading opportunities... (${this.dailySignalCount}/${this.config.maxDailySignals} today)`);
      
      // Check if we're connected and can trade
      if (!exnessAPI.isConnectedToExness()) {
        return;
      }

      const { canTrade, issues } = await exnessAPI.verifyTradingCapabilities();
      if (!canTrade) {
        return;
      }

      // Generate signals for each symbol with enhanced processing
      for (const symbol of this.config.symbols) {
        await this.analyzeAndGenerateSignal(symbol);
      }

      // Process any pending signals if auto-execution is enabled
      if (this.config.autoExecute && orderManager.isAutoTradingActive()) {
        await this.executePendingSignals();
      }

    } catch (error) {
      console.error('Error in signal generation cycle:', error);
    } finally {
      this.isGenerating = false;
    }
  }

  private async analyzeAndGenerateSignal(symbol: string): Promise<void> {
    try {
      // Get current market price
      const marketPrice = await exnessAPI.getCurrentPrice(symbol);
      if (!marketPrice) {
        console.warn(`Cannot get price for ${symbol}`);
        return;
      }

      // Perform technical analysis
      const analysis = await this.performTechnicalAnalysis(symbol, marketPrice);

      // Validate analysis result
      if (!analysis) {
        // Analysis returned null (low confidence or error) - skip signal generation
        return;
      }

      if (typeof analysis.confidence !== 'number' || !analysis.direction) {
        console.warn(`Invalid analysis result structure for ${symbol}:`, analysis);
        return;
      }
      
      // Generate signal if confidence is high enough
      if (analysis.confidence >= this.config.minConfidence) {
        await this.saveSignal({
          symbol,
          type: analysis.direction,
          confidence: analysis.confidence,
          entryPrice: marketPrice.bid,
          stopLoss: analysis.stopLoss,
          takeProfit: analysis.takeProfit,
          reasoning: analysis.reasoning,
          volume: analysis.volume || 0.15 // Enhanced default volume
        });

        console.log(`📊 Enhanced signal generated for ${symbol}: ${analysis.direction} with ${analysis.confidence.toFixed(1)}% confidence, volume: ${analysis.volume || 0.15}`);
      }
    } catch (error) {
      console.error(`Failed to analyze ${symbol}:`, error);
    }
  }

  private async performTechnicalAnalysis(symbol: string, price: any): Promise<any> {
    try {
      // Get REAL historical data from MT5
      const historicalData = await exnessAPI.getHistoricalData(symbol, '15m', 100);

      let prices: number[];
      let volumes: number[];
      let high: number | undefined;
      let low: number | undefined;

      if (historicalData && historicalData.bars.length > 0) {
        // Use REAL data from MT5
        prices = historicalData.bars.map(bar => bar.close);
        volumes = historicalData.bars.map(bar => bar.tick_volume);

        // Get high and low from recent bars
        const recentBars = historicalData.bars.slice(-20);
        high = Math.max(...recentBars.map(bar => bar.high));
        low = Math.min(...recentBars.map(bar => bar.low));

        console.log(`✅ Using REAL MT5 historical data for ${symbol}: ${prices.length} price bars, ${volumes.length} volume bars`);
      } else {
        // Fallback to simple array with current price only
        console.warn(`⚠️ Could not get historical data for ${symbol}, using current price only`);
        prices = [price.bid];
        volumes = [0];
        high = price.bid;
        low = price.bid;
      }

      // Calculate technical indicators
      const indicators = this.calculateTechnicalIndicators(prices);

      // Get session information
      const sessionInfo = this.getCurrentSessions();

      // Get recent news events
      const newsEvents = await this.getRecentNews(symbol);

      // Use AI-powered analysis for intelligent trading decisions
      const aiAnalysis = await aiAnalyzer.analyzeMarket({
        symbol,
        timeframe: '15m',
        marketData: {
          currentPrice: price.bid,
          bid: price.bid,
          ask: price.ask,
          spread: price.spread,
          high,
          low
        },
        technicalIndicators: indicators
      });

      // Only trade if AI gives HIGH confidence
      if (aiAnalysis.signal === 'HOLD' || aiAnalysis.confidence < 70) {
        return null; // Skip low-confidence signals
      }

      return {
        direction: aiAnalysis.signal,
        confidence: aiAnalysis.confidence,
        stopLoss: aiAnalysis.stopLoss,
        takeProfit: aiAnalysis.takeProfit,
        reasoning: `AI Analysis (${aiAnalysis.confidence}% confidence): ${aiAnalysis.reasoning}. Market Regime: ${aiAnalysis.regime}. Risk: ${aiAnalysis.riskLevel}.`,
        volume: this.calculatePositionSizeFromAI(aiAnalysis.confidence, aiAnalysis.positionSizeRecommendation, symbol),
        expectedValue: this.calculateExpectedValue(
          aiAnalysis.entryPrice || price.bid,
          aiAnalysis.takeProfit,
          aiAnalysis.stopLoss,
          aiAnalysis.confidence
        )
      };

    } catch (error) {
      console.error('AI analysis failed:', error);
      return null; // Skip trading when AI is unavailable
    }
  }
  
  private calculatePositionSizeFromAI(
    confidence: number,
    aiRecommendation: 'SMALL' | 'MEDIUM' | 'LARGE',
    symbol: string
  ): number {
    let baseVolume = 0.01;

    // AI-driven position sizing
    switch (aiRecommendation) {
      case 'LARGE':
        baseVolume = 0.10;
        break;
      case 'MEDIUM':
        baseVolume = 0.05;
        break;
      case 'SMALL':
      default:
        baseVolume = 0.01;
        break;
    }

    // Confidence scaling (only increase for very high confidence)
    if (confidence >= 90) {
      baseVolume *= 1.5;
    } else if (confidence >= 85) {
      baseVolume *= 1.2;
    }

    // Cap maximum volume for safety
    return Math.min(baseVolume, 0.20);
  }

  private calculateExpectedValue(entry: number, tp: number, sl: number, confidence: number): number {
    const potentialProfit = Math.abs(tp - entry);
    const potentialLoss = Math.abs(entry - sl);
    const winProbability = confidence / 100;
    return (potentialProfit * winProbability) - (potentialLoss * (1 - winProbability));
  }

  private async saveSignal(signal: any): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get currency pair ID
      const { data: pair } = await supabase
        .from('currency_pairs')
        .select('id')
        .eq('symbol', signal.symbol)
        .single();

      let pairId = pair?.id;
      
      if (!pairId) {
        // Create currency pair if it doesn't exist
        const baseCurrency = signal.symbol.substring(0, 3);
        const quoteCurrency = signal.symbol.substring(3, 6);
        
        const { data: newPair } = await supabase
          .from('currency_pairs')
          .insert({ 
            symbol: signal.symbol,
            base_currency: baseCurrency,
            quote_currency: quoteCurrency,
            display_name: signal.symbol
          })
          .select('id')
          .single();
        
        if (!newPair) return;
        pairId = newPair.id;
      }

      // Save signal to database
      await supabase
        .from('trading_signals')
        .insert({
          user_id: user.id,
          pair_id: pairId,
          signal_type: signal.type,
          confidence_score: signal.confidence,
          entry_price: signal.entryPrice,
          stop_loss: signal.stopLoss,
          take_profit: signal.takeProfit,
          timeframe: '1H',
          reasoning: signal.reasoning,
          ai_model: 'BotSignalManager',
          status: 'ACTIVE'
        });

    } catch (error) {
      console.error('Failed to save signal:', error);
    }
  }

  private async executePendingSignals(): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      console.log('🎯 Checking for pending signals to execute...');

      // Get active signals that haven't been executed
      const { data: signals } = await supabase
        .from('trading_signals')
        .select('*, currency_pairs(symbol)')
        .eq('user_id', user.id)
        .eq('status', 'ACTIVE')
        .gte('confidence_score', this.config.minConfidence)
        .order('confidence_score', { ascending: false })
        .limit(10); // Process top 10 signals for maximum opportunities

      if (!signals || signals.length === 0) {
        console.log('📭 No pending signals found for execution');
        return;
      }

      console.log(`🔍 Found ${signals.length} pending signals to process`);

      for (const signal of signals) {
        try {
          // Enhanced signal validation
          if (signal.confidence_score < this.config.minConfidence) {
            continue;
          }

          const symbol = signal.currency_pairs?.symbol;
          if (!symbol || !this.config.symbols.includes(symbol)) {
            continue;
          }

          console.log(`🎯 Executing enhanced signal ${signal.id}: ${signal.signal_type} ${symbol} with ${signal.confidence_score}% confidence`);

          // Execute the trade with enhanced volume calculation
          const enhancedVolume = this.calculateEnhancedVolume(signal);
          const orderRequest = {
            symbol,
            type: signal.signal_type as 'BUY' | 'SELL',
            volume: enhancedVolume,
            stopLoss: signal.stop_loss ? parseFloat(signal.stop_loss.toString()) : undefined,
            takeProfit: signal.take_profit ? parseFloat(signal.take_profit.toString()) : undefined,
            comment: `EnhancedAuto-${signal.confidence_score.toFixed(0)}%-${signal.id.substring(0, 8)}`
          };

          const orderId = await orderManager.executeOrder(orderRequest);
          
          if (orderId) {
            // Update signal status
            await supabase
              .from('trading_signals')
              .update({ 
                status: 'EXECUTED',
                updated_at: new Date().toISOString()
              })
              .eq('id', signal.id);

            console.log(`✅ Enhanced signal ${signal.id} executed successfully: Order ${orderId}, Volume: ${enhancedVolume}`);
          } else {
            console.error(`❌ Failed to execute signal ${signal.id}: No order ID returned`);
          }
        } catch (error) {
          console.error(`❌ Failed to execute signal ${signal.id}:`, error);
          
          // Mark signal as failed
          await supabase
            .from('trading_signals')
            .update({ 
              status: 'CANCELLED',
              updated_at: new Date().toISOString()
            })
            .eq('id', signal.id);
        }
      }
    } catch (error) {
      console.error('Failed to execute pending signals:', error);
    }
  }

  private calculateEnhancedVolume(signal: any): number {
    // Enhanced volume calculation for aggressive day trading
    let baseVolume = 0.20; // Increased base volume
    
    // Confidence-based multiplier
    const confidenceMultiplier = Math.max(1.5, signal.confidence_score / 60); // More aggressive multiplier
    baseVolume *= confidenceMultiplier;
    
    // Session-based adjustments
    const currentHour = new Date().getUTCHours();
    const isOptimalSession = (currentHour >= 8 && currentHour <= 17) || (currentHour >= 13 && currentHour <= 22);
    
    if (isOptimalSession) {
      baseVolume *= 2.5; // Massive boost during optimal sessions
    }
    
    // Symbol-specific adjustments for major pairs
    const majorPairs = ['EURUSD', 'GBPUSD', 'USDJPY'];
    if (majorPairs.includes(signal.currency_pairs?.symbol)) {
      baseVolume *= 1.5; // Boost for major pairs
    }
    
    // Apply aggressive limits
    return Math.max(0.10, Math.min(2.0, baseVolume)); // Increased max to 2.0 lots
  }

  async enableAutoExecution(enabled: boolean): Promise<void> {
    this.config.autoExecute = enabled;
    
    // Force immediate signal processing when enabling auto-execution
    if (enabled && this.config.enabled) {
      console.log('🚀 Auto-execution enabled - forcing immediate signal processing...');
      setTimeout(() => {
        this.generateAndProcessSignals();
      }, 500);
    }
    
    console.log(`🤖 Enhanced auto-execution ${enabled ? 'ENABLED' : 'DISABLED'} in signal manager`);
    
    if (enabled && this.config.enabled) {
      // Start generation if not already running
      if (!this.generationInterval) {
        this.startAutomaticGeneration();
      }
      
      // Force execute any pending signals immediately
      await this.executePendingSignals();
    }
  }

  async forceExecutePendingSignals(): Promise<void> {
    console.log('🎯 Force executing all pending signals...');
    await this.executePendingSignals();
  }

  setConfiguration(config: Partial<SignalGenerationConfig>): void {
    this.config = { ...this.config, ...config };
    console.log('🔧 Enhanced signal manager configuration updated:', {
      enabled: this.config.enabled,
      interval: this.config.interval + 'ms',
      minConfidence: this.config.minConfidence + '%',
      autoExecute: this.config.autoExecute,
      symbolCount: this.config.symbols.length,
      maxDailySignals: this.config.maxDailySignals,
      aggressiveMode: this.config.aggressiveMode
    });
    
    // Restart generation with new config if currently running
    if (this.generationInterval && this.config.enabled) {
      this.stopAutomaticGeneration();
      this.startAutomaticGeneration();
    }
  }

  getConfiguration(): SignalGenerationConfig {
    return { ...this.config };
  }

  async forceGenerateSignal(symbol: string): Promise<void> {
    console.log(`🎯 Force generating enhanced signal for ${symbol}...`);
    await this.analyzeAndGenerateSignal(symbol);
  }

  getDailyStats(): { signalsGenerated: number; maxDaily: number; remaining: number } {
    this.resetDailyCountersIfNeeded();
    return {
      signalsGenerated: this.dailySignalCount,
      maxDaily: this.config.maxDailySignals,
      remaining: Math.max(0, this.config.maxDailySignals - this.dailySignalCount)
    };
  }
  
  // Helper methods for enhanced analysis
  // NOTE: generateRecentPrices and generateRecentVolumes are now replaced with real MT5 data
  // fetched via exnessAPI.getHistoricalData() in performTechnicalAnalysis()
  
  private calculateTechnicalIndicators(prices: number[]): any {
    if (prices.length < 20) return {};
    
    // Simple Moving Averages
    const sma20 = prices.slice(-20).reduce((a, b) => a + b, 0) / 20;
    const sma50 = prices.length >= 50 ? prices.slice(-50).reduce((a, b) => a + b, 0) / 50 : sma20;
    const sma200 = prices.length >= 200 ? prices.slice(-200).reduce((a, b) => a + b, 0) / 200 : sma20;
    
    // RSI
    const rsi = this.calculateRSI(prices, 14);
    
    // Bollinger Bands
    const std = this.calculateStandardDeviation(prices.slice(-20));
    const bollinger = {
      upper: sma20 + (std * 2),
      middle: sma20,
      lower: sma20 - (std * 2)
    };
    
    return {
      sma20,
      sma50,
      sma200,
      ema20: sma20, // Simplified
      ema50: sma50,
      ema200: sma200,
      rsi,
      bollinger,
      atr: this.calculateATR(prices, 14),
      adx: 0 // ADX requires real price data, not random
    };
  }
  
  private calculateRSI(prices: number[], period: number): number {
    if (prices.length < period + 1) return 50;
    
    const gains = [];
    const losses = [];
    
    for (let i = 1; i < prices.length; i++) {
      const change = prices[i] - prices[i - 1];
      gains.push(change > 0 ? change : 0);
      losses.push(change < 0 ? Math.abs(change) : 0);
    }
    
    const avgGain = gains.slice(-period).reduce((a, b) => a + b, 0) / period;
    const avgLoss = losses.slice(-period).reduce((a, b) => a + b, 0) / period;
    
    if (avgLoss === 0) return 100;
    
    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
  }
  
  private calculateStandardDeviation(prices: number[]): number {
    const mean = prices.reduce((a, b) => a + b, 0) / prices.length;
    const squaredDiffs = prices.map(price => Math.pow(price - mean, 2));
    const avgSquaredDiff = squaredDiffs.reduce((a, b) => a + b, 0) / squaredDiffs.length;
    return Math.sqrt(avgSquaredDiff);
  }
  
  private calculateATR(prices: number[], period: number): number {
    if (prices.length < 2) return 0.0001;
    
    const trueRanges = [];
    for (let i = 1; i < prices.length; i++) {
      const high = Math.max(prices[i], prices[i-1]);
      const low = Math.min(prices[i], prices[i-1]);
      trueRanges.push(high - low);
    }
    
    return trueRanges.slice(-period).reduce((a, b) => a + b, 0) / Math.min(period, trueRanges.length);
  }
  
  private getCurrentSessions(): any[] {
    const now = new Date();
    const currentHour = now.getUTCHours();
    
    return [
      {
        name: "London",
        isActive: currentHour >= 8 && currentHour < 17,
        volume: "HIGH",
        volatility: "HIGH",
        majorPairs: ["EURUSD", "GBPUSD", "EURGBP", "USDCHF"]
      },
      {
        name: "New York", 
        isActive: currentHour >= 13 && currentHour < 22,
        volume: "HIGH",
        volatility: "HIGH",
        majorPairs: ["EURUSD", "GBPUSD", "USDJPY", "USDCAD"]
      },
      {
        name: "Tokyo",
        isActive: currentHour >= 0 && currentHour < 9,
        volume: "HIGH", 
        volatility: "MEDIUM",
        majorPairs: ["USDJPY", "EURJPY", "GBPJPY", "AUDJPY"]
      }
    ];
  }
  
  private async getRecentNews(symbol: string): Promise<any[]> {
    try {
      const { data } = await supabase
        .from('economic_events')
        .select('*')
        .or(`affected_pairs.cs.{${symbol}},currency.eq.${symbol.substring(0,3)},currency.eq.${symbol.substring(3,6)}`)
        .gte('event_time', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .order('event_time', { ascending: true })
        .limit(10);
      
      return data || [];
    } catch (error) {
      console.warn('Failed to get recent news:', error);
      return [];
    }
  }
}

export const botSignalManager = new BotSignalManager();