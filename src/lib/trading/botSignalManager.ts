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
    interval: 180000, // 3 minutes - prevent rate limiting on AI gateway
    symbols: ['XAUUSD', 'EURUSD', 'GBPUSD', 'USDJPY'], // Gold first priority, then major forex pairs
    minConfidence: 65, // ChartLord-style: 65% minimum (5+ confluence factors)
    autoExecute: false,
    maxDailySignals: 100, // Increased for more opportunities
    aggressiveMode: false
  };

  private generationInterval: NodeJS.Timeout | null = null;
  private isGenerating = false;
  private lastGenerationTime = 0;
  private dailySignalCount = 0;
  private lastResetDate = new Date().toDateString();
  private analysisLocks: Set<string> = new Set(); // Track symbols currently being analyzed
  private lastAICallTime: Map<string, number> = new Map(); // Rate limit AI calls per symbol
  private readonly AI_CALL_COOLDOWN = 120000; // 2 minutes between AI calls per symbol
  private currentSymbolIndex = 0; // For sequential symbol analysis

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

    // Rate limiting - minimum 30 seconds between cycles to prevent AI rate limits
    const timeSinceLastGeneration = Date.now() - this.lastGenerationTime;
    if (timeSinceLastGeneration < 30000) {
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
        console.warn('⚠️ Not connected to Exness - skipping signal generation');
        console.warn('💡 Please connect to your Exness MT5 account to enable trading');
        return;
      }

      const { canTrade, issues } = await exnessAPI.verifyTradingCapabilities();
      if (!canTrade) {
        console.warn('⚠️ Trading not allowed:', issues.join(', '));
        console.warn('💡 Please resolve these issues to enable trading');
        return;
      }

      // Analyze ONE symbol per cycle to prevent rate limiting
      // Rotate through symbols sequentially
      const symbol = this.config.symbols[this.currentSymbolIndex];
      this.currentSymbolIndex = (this.currentSymbolIndex + 1) % this.config.symbols.length;
      
      console.log(`📈 Analyzing ${symbol} (${this.currentSymbolIndex + 1}/${this.config.symbols.length})`);
      await this.analyzeAndGenerateSignal(symbol);

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
    // Prevent race condition - skip if already analyzing this symbol
    if (this.analysisLocks.has(symbol)) {
      return; // Silent skip - already being analyzed
    }

    // Rate limit AI calls per symbol to prevent 429 errors
    const lastCallTime = this.lastAICallTime.get(symbol) || 0;
    const timeSinceLastCall = Date.now() - lastCallTime;
    if (timeSinceLastCall < this.AI_CALL_COOLDOWN) {
      return; // Silent skip - cooldown active
    }

    // Acquire lock
    this.analysisLocks.add(symbol);
    this.lastAICallTime.set(symbol, Date.now());

    try {
      // Get current market price
      const marketPrice = await exnessAPI.getCurrentPrice(symbol);
      if (!marketPrice || !marketPrice.bid || !marketPrice.ask) {
        console.warn(`⚠️ Cannot get valid price for ${symbol}`);
        return;
      }

      // Perform technical analysis
      const analysis = await this.performTechnicalAnalysis(symbol, marketPrice);

      // Skip if no valid trading signal (expected for HOLD or low confidence or missing data)
      if (!analysis || typeof analysis.confidence !== 'number') {
        return; // Silent skip - no valid signal
      }

      // Generate signal if confidence is high enough
      if (analysis.confidence >= this.config.minConfidence) {
        const signalPayload = {
          symbol,
          type: analysis.direction,
          confidence: analysis.confidence,
          entryPrice: marketPrice.bid,
          stopLoss: analysis.stopLoss || 0,
          takeProfit: analysis.takeProfit || 0,
          reasoning: analysis.reasoning || 'Technical analysis signal',
          volume: analysis.volume || this.calculatePositionSizeFromAI(analysis.confidence, analysis.positionSizeRecommendation || 'SMALL', symbol)
        };

        // Execute immediately when auto-execution is enabled (bypass DB dependency)
        if (this.config.autoExecute && orderManager.isAutoTradingActive()) {
          try {
            await orderManager.executeOrder({
              symbol,
              type: signalPayload.type,
              volume: signalPayload.volume,
              stopLoss: signalPayload.stopLoss,
              takeProfit: signalPayload.takeProfit,
              comment: `AutoAI-${signalPayload.confidence.toFixed(0)}%`
            });
            console.log(`✅ Auto-executed ${signalPayload.type} on ${symbol} (vol ${signalPayload.volume})`);
          } catch (execErr) {
            console.error(`❌ Auto-execution failed for ${symbol}:`, execErr);
          }
        }

        // Best-effort save to DB (if user is authenticated and RLS allows)
        await this.saveSignal(signalPayload);

        console.log(`📊 Enhanced signal generated for ${symbol}: ${analysis.direction} with ${analysis.confidence.toFixed(1)}% confidence, volume: ${signalPayload.volume}`);
      }
    } catch (error) {
      console.error(`Failed to analyze ${symbol}:`, error);
    } finally {
      // Always release lock
      this.analysisLocks.delete(symbol);
    }
  }

  private async performTechnicalAnalysis(symbol: string, price: any): Promise<any> {
    try {
      // Get comprehensive market data from REAL MT5 historical data
      const prices = await this.generateRecentPrices(price.bid, 100, symbol);
      const volumes = await this.generateRecentVolumes(100, symbol);

      // Critical data quality check - abort if we don't have enough data
      if (prices.length < 20 || volumes.length < 20) {
        console.error(`❌ Insufficient historical data for ${symbol}:`, {
          priceDataPoints: prices.length,
          volumeDataPoints: volumes.length,
          reason: 'MT5 Bridge may not be running or historical data fetch failed'
        });
        console.error('⚠️ CRITICAL: Cannot perform quality analysis without historical data. Check MT5 Bridge connection.');
        return null;
      }

      const marketData = {
        symbol,
        prices,
        volumes,
        spread: price.spread
      };

      // Calculate technical indicators
      const indicators = this.calculateTechnicalIndicators(marketData.prices);
      
      // Get session information
      const sessionInfo = this.getCurrentSessions();
      
      // Get recent news events
      const newsEvents = await this.getRecentNews(symbol);
      
      // Log data quality before sending to AI
      console.log(`📊 Quality data prepared for ${symbol}:`, {
        priceDataPoints: prices.length,
        volumeDataPoints: volumes.length,
        hasRSI: !!indicators.rsi,
        hasEMA: !!indicators.ema20,
        rsiValue: indicators.rsi?.toFixed(2),
        currentPrice: price.bid
      });

      // Use AI-powered analysis for intelligent trading decisions
      const aiAnalysis = await aiAnalyzer.analyzeMarket({
        symbol,
        timeframe: '15m',
        marketData: {
          currentPrice: price.bid,
          bid: price.bid,
          ask: price.ask,
          spread: price.spread,
          high: prices.length > 0 ? Math.max(...prices) : price.bid,
          low: prices.length > 0 ? Math.min(...prices) : price.bid
        },
        technicalIndicators: {
          ...indicators,
          volume: volumes.length > 0 ? volumes[volumes.length - 1] : 0
        }
      });

      console.log(`🎯 AI Analysis for ${symbol}:`, {
        signal: aiAnalysis.signal,
        confidence: aiAnalysis.confidence,
        regime: aiAnalysis.regime,
        reasoning: aiAnalysis.reasoning.substring(0, 100) + '...'
      });

      // Adjusted confidence threshold - 65% for quality trades (lowered from 70%)
      if (aiAnalysis.signal === 'HOLD' || aiAnalysis.confidence < 65) {
        console.log(`⏸️  Skipping ${symbol} - AI recommends: ${aiAnalysis.signal} (${aiAnalysis.confidence}% confidence, need 65%+)`);
        return null;
      }
      
      console.log(`✅ Trade signal qualified for ${symbol}: ${aiAnalysis.signal} at ${aiAnalysis.confidence}% confidence`);

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

          // Execute the trade - let orderManager calculate optimal position size
          console.log(`💰 Executing trade for signal ${signal.id}: ${signal.signal_type} ${symbol}`);
          
          const orderRequest = {
            symbol,
            type: signal.signal_type as 'BUY' | 'SELL',
            volume: 0.01, // Start with minimum - orderManager will adjust based on risk
            stopLoss: signal.stop_loss ? parseFloat(signal.stop_loss.toString()) : undefined,
            takeProfit: signal.take_profit ? parseFloat(signal.take_profit.toString()) : undefined,
            comment: `AI-${signal.confidence_score.toFixed(0)}%-${signal.id.substring(0, 8)}`
          };

          console.log(`📋 Order request prepared:`, orderRequest);
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

            console.log(`✅ Signal ${signal.id} executed successfully - Order ${orderId}`);
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

  // Removed - orderManager now handles all position sizing with proper risk management

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
  private historicalDataCache: Map<string, { data: any[]; timestamp: number }> = new Map();
  private readonly CACHE_TTL = 60000; // 1 minute cache

  private async fetchHistoricalDataWithCache(symbol: string, count: number): Promise<any[] | null> {
    const cacheKey = `${symbol}_${count}`;
    const cached = this.historicalDataCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.data;
    }

    const data = await exnessAPI.getHistoricalData(symbol, 15, count);
    if (data && data.length > 0) {
      this.historicalDataCache.set(cacheKey, { data, timestamp: Date.now() });
    }
    return data;
  }

  private async generateRecentPrices(currentPrice: number, count: number, symbol: string): Promise<number[]> {
    try {
      const historicalData = await this.fetchHistoricalDataWithCache(symbol, count);

      if (historicalData && historicalData.length > 0) {
        const prices = historicalData.map((bar: any) => bar.close);
        console.log(`📊 ${symbol}: Using ${prices.length} real M15 price bars from MT5`);
        return prices;
      } else {
        console.error(`❌ ${symbol}: MT5 Bridge not available or no data - SKIPPING ANALYSIS`);
        return []; // Return empty to trigger data quality check
      }
    } catch (error) {
      console.error(`❌ ${symbol}: Failed to fetch historical prices:`, error);
      return []; // Return empty to trigger data quality check
    }
  }

  private async generateRecentVolumes(count: number, symbol: string): Promise<number[]> {
    try {
      const historicalData = await this.fetchHistoricalDataWithCache(symbol, count);

      if (historicalData && historicalData.length > 0) {
        const volumes = historicalData.map((bar: any) => bar.tick_volume || bar.volume || 0);
        console.log(`📊 ${symbol}: Using ${volumes.length} real M15 volume bars from MT5`);
        return volumes;
      } else {
        return []; // Return empty to trigger data quality check
      }
    } catch (error) {
      console.error(`❌ ${symbol}: Failed to fetch volume data:`, error);
      return []; // Return empty to trigger data quality check
    }
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