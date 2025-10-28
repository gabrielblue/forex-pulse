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
    interval: 300000, // Professional: 5 minutes for quality signal analysis
    symbols: ['EURUSD', 'GBPUSD', 'USDJPY', 'AUDUSD', 'USDCHF', 'NZDUSD', 'XAUUSD', 'EURJPY', 'GBPJPY', 'USDCAD'], // All major pairs
    minConfidence: 75, // Professional: 75% minimum for high-quality trades
    autoExecute: false,
    maxDailySignals: 30, // Professional: 30 high-quality signals per day
    aggressiveMode: false
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

    console.log(`🚀 Starting PROFESSIONAL signal generation (interval: ${this.config.interval/1000}s, min confidence: ${this.config.minConfidence}%, max daily: ${this.config.maxDailySignals})`);

    // Start generation loop
    this.generationInterval = setInterval(async () => {
      if (this.config.enabled && !this.isGenerating && this.canGenerateMoreSignals()) {
        await this.generateAndProcessSignals();
      }
    }, this.config.interval);

    // Generate first signal after 30 seconds to allow system to stabilize
    setTimeout(() => {
      if (this.canGenerateMoreSignals()) {
        this.generateAndProcessSignals();
      }
    }, 30000); // Start after 30 seconds
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

    // Rate limiting for quality analysis
    const timeSinceLastGeneration = Date.now() - this.lastGenerationTime;
    if (timeSinceLastGeneration < 60000) { // Professional: 1 minute minimum between analysis
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
      if (!analysis || typeof analysis.confidence !== 'number') {
        console.warn(`Invalid analysis result for ${symbol}:`, analysis);
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
      // Get comprehensive market data
      const marketData = {
        symbol,
        prices: this.generateRecentPrices(price.bid, 100),
        volumes: this.generateRecentVolumes(100),
        spread: price.spread
      };
      
      // Calculate technical indicators
      const indicators = this.calculateTechnicalIndicators(marketData.prices);
      
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
          spread: price.spread
        },
        technicalIndicators: indicators
      });

      // Only trade with VERY HIGH confidence for profitability
      if (aiAnalysis.signal === 'HOLD' || aiAnalysis.confidence < 80) {
        return null; // Skip low and medium confidence signals
      }

      // Calculate expected value - only accept positive EV trades
      const expectedValue = this.calculateExpectedValue(
        aiAnalysis.entryPrice || price.bid,
        aiAnalysis.takeProfit,
        aiAnalysis.stopLoss,
        aiAnalysis.confidence
      );

      if (expectedValue <= 0) {
        console.log(`❌ Rejecting signal for ${symbol}: Negative expected value ${expectedValue.toFixed(4)}`);
        return null; // Skip negative EV trades
      }

      return {
        direction: aiAnalysis.signal,
        confidence: aiAnalysis.confidence,
        stopLoss: aiAnalysis.stopLoss,
        takeProfit: aiAnalysis.takeProfit,
        reasoning: `AI Analysis (${aiAnalysis.confidence}% confidence): ${aiAnalysis.reasoning}. Market Regime: ${aiAnalysis.regime}. Risk: ${aiAnalysis.riskLevel}. Expected Value: ${expectedValue.toFixed(4)}`,
        volume: this.calculatePositionSizeFromAI(aiAnalysis.confidence, aiAnalysis.positionSizeRecommendation, symbol),
        expectedValue
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
    // Conservative base volumes for professional trading
    let baseVolume = 0.01;

    // AI-driven position sizing - conservative approach
    switch (aiRecommendation) {
      case 'LARGE':
        baseVolume = 0.05; // Reduced from 0.10 for safety
        break;
      case 'MEDIUM':
        baseVolume = 0.03; // Reduced from 0.05 for safety
        break;
      case 'SMALL':
      default:
        baseVolume = 0.01;
        break;
    }

    // Minimal confidence scaling (only for extremely high confidence)
    if (confidence >= 95) {
      baseVolume *= 1.3;
    } else if (confidence >= 90) {
      baseVolume *= 1.15;
    }

    // Cap maximum volume for risk management
    return Math.min(baseVolume, 0.10); // Reduced max from 0.20 to 0.10
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

      // Get active signals that haven't been executed - only highest quality
      const { data: signals } = await supabase
        .from('trading_signals')
        .select('*, currency_pairs(symbol)')
        .eq('user_id', user.id)
        .eq('status', 'ACTIVE')
        .gte('confidence_score', this.config.minConfidence)
        .order('confidence_score', { ascending: false })
        .limit(3); // Process top 3 highest quality signals only

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
    // Professional volume calculation for sustainable trading
    let baseVolume = 0.02; // Conservative base volume

    // Confidence-based scaling - only for very high confidence
    if (signal.confidence_score >= 90) {
      baseVolume = 0.05;
    } else if (signal.confidence_score >= 85) {
      baseVolume = 0.03;
    } else if (signal.confidence_score >= 80) {
      baseVolume = 0.02;
    } else {
      baseVolume = 0.01; // Minimum for lower confidence
    }

    // Small session-based adjustment for optimal trading hours
    const currentHour = new Date().getUTCHours();
    const isOptimalSession = (currentHour >= 8 && currentHour <= 17) || (currentHour >= 13 && currentHour <= 22);

    if (isOptimalSession) {
      baseVolume *= 1.2; // Modest 20% boost during optimal sessions
    }

    // Apply conservative limits for risk management
    return Math.max(0.01, Math.min(0.10, baseVolume)); // Max 0.10 lots for safety
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
  private generateRecentPrices(currentPrice: number, count: number): number[] {
    // NOTE: This should fetch REAL historical prices from MT5
    // For now, we cannot generate realistic price movements without real data
    // TODO: Replace with MT5 historical price API call
    console.warn('⚠️ generateRecentPrices should use real MT5 historical data');
    
    // Return minimal array with just current price until MT5 integration
    return [currentPrice];
  }
  
  private generateRecentVolumes(count: number): number[] {
    // NOTE: This should fetch REAL volume data from MT5
    // TODO: Replace with MT5 volume data API call
    console.warn('⚠️ generateRecentVolumes should use real MT5 volume data');
    
    // Return minimal array until MT5 integration
    return [0];
  }
  
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