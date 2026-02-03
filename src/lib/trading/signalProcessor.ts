import { supabase } from '@/integrations/supabase/client';
import { orderManager } from './orderManager';
import { professionalStrategies, MarketData, TechnicalIndicators } from './strategies/professionalStrategies';
import { exnessAPI, TradeOrder } from './exnessApi';

export interface TradingSignal {
  id: string;
  symbol: string;
  type: 'BUY' | 'SELL';
  confidence: number;
  entryPrice: number;
  stopLoss?: number;
  takeProfit?: number;
  timeframe: string;
  reasoning: string;
  source: string;
  probabilityOfSuccess?: number; // Optional for profitable strategies
}

export interface SignalProcessorConfig {
  minConfidence: number;
  enabledTimeframes: string[];
  enabledPairs: string[];
  autoExecute: boolean;
}

class SignalProcessor {
  private config: SignalProcessorConfig = {
    minConfidence: 60, // Conservative threshold for quality entries
    enabledTimeframes: ['1M', '5M', '15M', '30M', '1H', '4H'], // All timeframes for maximum opportunities
    enabledPairs: ['EURUSD', 'GBPUSD', 'USDJPY', 'AUDUSD', 'USDCHF', 'NZDUSD', 'XAUUSD', 'EURJPY', 'GBPJPY', 'USDCAD', 'GBPAUD', 'AUDJPY', 'EURGBP'], // Extended major pairs
    autoExecute: false
  };

  private isProcessing = false;
  private lastProcessTime = 0;
  private processedSignalsToday = 0;
  private maxDailyProcessing = 5000; // Ultra-aggressive: 5000 signal processing limit per day for maximum opportunities
  private monitoringInterval: NodeJS.Timeout | null = null; // Track interval for cleanup

  async initialize(): Promise<void> {
    await this.loadConfiguration();
    this.startSignalMonitoring();
    console.log('🔧 Signal Processor initialized with professional quality standards');
  }

  private async loadConfiguration(): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: botSettings } = await supabase
        .from('bot_settings')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (botSettings) {
        this.config = {
          minConfidence: parseFloat(botSettings.min_confidence_score?.toString() || '75'),
          enabledTimeframes: ['1H', '4H', '1D'], // Could be stored in bot_settings
          enabledPairs: botSettings.allowed_pairs || ['EURUSD', 'GBPUSD', 'USDJPY'],
          autoExecute: botSettings.is_active || false
        };
      }
    } catch (error) {
      console.error('Failed to load signal processor configuration:', error);
    }
  }

  private startSignalMonitoring(): void {
    // Clear existing interval if any
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
// Monitor for new signals every 0.5 seconds for ultra aggressive day trading

    this.monitoringInterval = setInterval(async () => {
      if (this.isProcessing) return;

      // Enhanced rate limiting
      const timeSinceLastProcess = Date.now() - this.lastProcessTime;
      if (timeSinceLastProcess < 500) return; // 0.5 second minimum

      if (this.processedSignalsToday >= this.maxDailyProcessing) {
        console.log(`📊 Daily signal processing limit reached: ${this.processedSignalsToday}/${this.maxDailyProcessing}`);
        return;
      }

      this.isProcessing = true;
      this.lastProcessTime = Date.now();
      this.processedSignalsToday++;

      try {
        await this.processNewSignals();
      } catch (error) {
        console.error('Signal processing error:', error);
      } finally {
        this.isProcessing = false;
      }
    }, 500); // Ultra-aggressive: 500ms interval for maximum processing frequency
  }

  stopSignalMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
      console.log('🛑 Signal monitoring stopped');
    }
  }

  private async processNewSignals(): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get unprocessed signals with enhanced filtering
      const { data: signals } = await supabase
        .from('trading_signals')
        .select(`
          *,
          currency_pairs(symbol)
        `)
        .eq('user_id', user.id)
        .eq('status', 'ACTIVE')
        .gte('confidence_score', this.config.minConfidence)
        .in('timeframe', this.config.enabledTimeframes)
        .order('confidence_score', { ascending: false })
        .limit(50); // Process top 50 signals for maximum opportunities

      if (!signals || signals.length === 0) return;

      console.log(`🔍 Processing ${signals.length} enhanced signals...`);

      for (const signal of signals) {
        await this.processSignal(signal);
      }
    } catch (error) {
      console.error('Failed to process new signals:', error);
    }
  }

  private async processSignal(signalData: any): Promise<void> {
    try {
      const signal: TradingSignal = {
        id: signalData.id,
        symbol: signalData.currency_pairs?.symbol || '',
        type: signalData.signal_type as 'BUY' | 'SELL',
        confidence: parseFloat(signalData.confidence_score.toString()),
        entryPrice: parseFloat(signalData.entry_price.toString()),
        stopLoss: signalData.stop_loss ? parseFloat(signalData.stop_loss.toString()) : undefined,
        takeProfit: signalData.take_profit ? parseFloat(signalData.take_profit.toString()) : undefined,
        timeframe: signalData.timeframe,
        reasoning: signalData.reasoning || '',
        source: signalData.ai_model || 'AI',
        probabilityOfSuccess: signalData.confidence_score ? parseFloat(signalData.confidence_score.toString()) / 100 : undefined
      };

      // Check if signal meets criteria
      if (!this.shouldExecuteSignal(signal)) {
        console.log(`Signal ${signal.id} does not meet execution criteria`);
        return;
      }

      // Execute signal if auto-trading is enabled
      if (this.config.autoExecute && orderManager.isAutoTradingActive()) {
        await this.executeSignal(signal);
      } else {
        console.log(`Signal ${signal.id} ready for manual execution`);
      }

    } catch (error) {
      console.error('Failed to process signal:', error);
    }
  }

  private shouldExecuteSignal(signal: TradingSignal): boolean {
    // Ultra-lenient signal validation for maximum trading opportunities
    if (signal.confidence < this.config.minConfidence * 0.5) {
      return false; // Only reject very low confidence signals
    }

    // Check if pair is enabled - allow if not in list but confidence is high
    if (!this.config.enabledPairs.includes(signal.symbol) && signal.confidence < this.config.minConfidence * 1.5) {
      return false;
    }

    // Check if timeframe is enabled - be more flexible
    if (!this.config.enabledTimeframes.includes(signal.timeframe) && signal.confidence < this.config.minConfidence) {
      return false;
    }

    // Always allow signals during trading hours with minimal restrictions
    const currentHour = new Date().getUTCHours();
    const isTradingHour = currentHour >= 0 && currentHour <= 23; // 24/7 trading

    if (isTradingHour) {
      return true; // Allow all signals during trading hours
    }

    return signal.confidence >= this.config.minConfidence; // Fallback for non-trading hours
  }

  private async executeSignal(signal: TradingSignal): Promise<void> {
    try {
      console.log(`💰 Executing signal ${signal.id}: ${signal.type} ${signal.symbol} @ ${signal.confidence}% confidence`);

      const orderRequest: TradeOrder = {
        symbol: signal.symbol,
        type: signal.type,
        volume: 0.01, // Start with minimum - orderManager will calculate optimal size
        stopLoss: signal.stopLoss,
        takeProfit: signal.takeProfit,
        comment: `AI-${signal.confidence.toFixed(0)}%-${signal.id.substring(0, 6)}`
      };

      console.log(`📋 Submitting order request:`, orderRequest);
      
      // Execute the order through orderManager (handles all risk management)
      const orderId = await orderManager.executeOrder(orderRequest);

      if (orderId) {
        // Update signal status
        await this.updateSignalStatus(signal.id, 'EXECUTED', orderId);
        console.log(`✅ Signal ${signal.id} executed successfully - Order ID: ${orderId}`);
      } else {
        console.error(`❌ Signal ${signal.id} execution failed - No order ID returned`);
        await this.updateSignalStatus(signal.id, 'FAILED', null, 'No order ID returned');
      }

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      console.error(`❌ Failed to execute signal ${signal.id}:`, errorMsg);
      await this.updateSignalStatus(signal.id, 'FAILED', null, errorMsg);
    }
  }

  // Removed - orderManager now handles all position sizing with proper risk management

  private async updateSignalStatus(
    signalId: string, 
    status: string, 
    orderId?: string | null, 
    errorMessage?: string
  ): Promise<void> {
    try {
      const updateData: any = {
        status,
        updated_at: new Date().toISOString()
      };

      if (orderId) {
        updateData.order_id = orderId;
      }

      if (errorMessage) {
        updateData.error_message = errorMessage;
      }

      const { error } = await supabase
        .from('trading_signals')
        .update(updateData)
        .eq('id', signalId);

      if (error) throw error;
    } catch (error) {
      console.error('Failed to update signal status:', error);
    }
  }

  async generateAdvancedSignals(symbols: string[] = ['EURUSD', 'GBPUSD', 'USDJPY', 'XAUUSD']): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      console.log(`🔍 Generating enhanced advanced signals for ${symbols.length} symbols...`);

      // Check if gold trading conditions are favorable
      const goldSymbols = symbols.filter(s => s.includes('XAU') || s.includes('GOLD'));
      const otherSymbols = symbols.filter(s => !s.includes('XAU') && !s.includes('GOLD'));

      let prioritizeGold = false;
      if (goldSymbols.length > 0) {
        // Get gold market data to check conditions
        const goldData = await this.getMarketData(goldSymbols[0]);
        const usdData = await this.getMarketData('USDJPY'); // USD proxy
        const indicators = professionalStrategies.calculateTechnicalIndicators(
          goldData.prices,
          goldData.volumes
        );

        // Import gold strategies to check conditions
        const { goldTradingStrategies } = await import('./strategies/goldStrategies');
        const goldCondition = goldTradingStrategies.analyzeGoldMarketCondition(goldData, indicators, { symbol: 'USDJPY', prices: usdData.prices, volumes: usdData.volumes });

        // Prioritize gold if: high safe haven demand, strong USD correlation (gold up when USD down), or high volatility
        prioritizeGold = goldCondition.safeHavenDemand === 'HIGH' ||
                        goldCondition.usdCorrelation < -0.3 ||
                        goldCondition.volatility > 2.0;

        console.log(`🥇 Gold condition check: Safe Haven ${goldCondition.safeHavenDemand}, USD Corr ${goldCondition.usdCorrelation.toFixed(2)}, Volatility ${goldCondition.volatility.toFixed(2)} - Prioritize Gold: ${prioritizeGold}`);
      }

      // Process symbols based on priority
      if (prioritizeGold && goldSymbols.length > 0) {
        // Prioritize gold signals
        for (const symbol of goldSymbols) {
          const marketData = await this.getMarketData(symbol);
          const indicators = professionalStrategies.calculateTechnicalIndicators(
            marketData.prices,
            marketData.volumes
          );
          await this.generateGoldSignals(marketData, indicators, symbol);
        }

        // Then process other symbols with reduced priority
        for (const symbol of otherSymbols) {
          const marketData = await this.getMarketData(symbol);
          const indicators = professionalStrategies.calculateTechnicalIndicators(
            marketData.prices,
            marketData.volumes
          );

          const strategies = [
            () => professionalStrategies.scalpingStrategy(marketData, indicators),
            () => professionalStrategies.swingTradingStrategy(marketData, indicators),
            () => professionalStrategies.breakoutStrategy(marketData, indicators),
            () => professionalStrategies.meanReversionStrategy(marketData, indicators),
            () => professionalStrategies.gridTradingStrategy(marketData, indicators),
            () => this.momentumStrategy(marketData, indicators),
            () => this.trendFollowingStrategy(marketData, indicators),
            () => this.rangeTradingStrategy(marketData, indicators)
          ];

          for (const strategy of strategies) {
            const signal = await strategy();
            // Higher threshold for other symbols when gold is prioritized
            if (signal && signal.confidence >= this.config.minConfidence) {
              await this.saveSignalToDatabase(signal, symbol);
              console.log(`💎 Other symbol signal saved: ${signal.source} - ${signal.type} ${symbol} (${signal.confidence.toFixed(1)}%)`);
            }
          }
        }
      } else {
        // Normal processing - prioritize other symbols, include gold with lower priority
        for (const symbol of otherSymbols) {
          const marketData = await this.getMarketData(symbol);
          const indicators = professionalStrategies.calculateTechnicalIndicators(
            marketData.prices,
            marketData.volumes
          );

          const strategies = [
            () => professionalStrategies.scalpingStrategy(marketData, indicators),
            () => professionalStrategies.swingTradingStrategy(marketData, indicators),
            () => professionalStrategies.breakoutStrategy(marketData, indicators),
            () => professionalStrategies.meanReversionStrategy(marketData, indicators),
            () => professionalStrategies.gridTradingStrategy(marketData, indicators),
            () => this.momentumStrategy(marketData, indicators),
            () => this.trendFollowingStrategy(marketData, indicators),
            () => this.rangeTradingStrategy(marketData, indicators)
          ];

          for (const strategy of strategies) {
            const signal = await strategy();
            if (signal && signal.confidence >= this.config.minConfidence * 0.9) {
              await this.saveSignalToDatabase(signal, symbol);
              console.log(`💎 Enhanced signal saved: ${signal.source} - ${signal.type} ${symbol} (${signal.confidence.toFixed(1)}%)`);
            }
          }
        }

        // Include gold with lower priority when conditions are not favorable
        for (const symbol of goldSymbols) {
          const marketData = await this.getMarketData(symbol);
          const indicators = professionalStrategies.calculateTechnicalIndicators(
            marketData.prices,
            marketData.volumes
          );
          await this.generateGoldSignals(marketData, indicators, symbol);
        }
      }
    } catch (error) {
      console.error('Failed to generate advanced signals:', error);
    }
  }

  private async generateGoldSignals(marketData: MarketData, indicators: TechnicalIndicators, symbol: string): Promise<void> {
    try {
      // Import gold strategies dynamically
      const { goldTradingStrategies } = await import('./strategies/goldStrategies');

      // Get USD data for correlation analysis
      const usdData = await this.getMarketData('USDJPY'); // Use USDJPY as USD proxy

      // Generate gold signal using LSIC strategy
      const signal = await goldTradingStrategies.generateGoldSignal(
        {
          symbol,
          prices: marketData.prices,
          volumes: marketData.volumes
        },
        indicators,
        {
          symbol: 'USDJPY',
          prices: usdData.prices,
          volumes: usdData.volumes
        }
      );

      // Only save high-confidence gold signals
      if (signal && signal.confidence >= 90) { // Very high threshold for gold
        await this.saveSignalToDatabase(signal, symbol);
        console.log(`🥇 Gold LSIC signal saved: ${signal.type} ${symbol} (${signal.confidence.toFixed(1)}%) - ${signal.reasoning}`);
      } else if (signal) {
        console.log(`⏸️ Gold signal rejected: ${signal.type} ${symbol} (${signal.confidence.toFixed(1)}%) - confidence too low`);
      }
    } catch (error) {
      console.error('Failed to generate gold signals:', error);
    }
  }

  private async getMarketData(symbol: string): Promise<MarketData> {
    try {
      // Get recent price data from database
      const { data: priceData } = await supabase
        .from('price_data')
        .select('*')
        .eq('timeframe', '1m')
        .order('timestamp', { ascending: false })
        .limit(200);

      // Generate realistic market data if no data exists
      if (!priceData || priceData.length === 0) {
        return this.generateRealisticMarketData(symbol);
      }

      return {
        symbol,
        prices: priceData.map(d => parseFloat(d.close_price.toString())),
        volumes: priceData.map(d => parseInt(d.volume?.toString() || '0')),
        timestamps: priceData.map(d => new Date(d.timestamp))
      };
    } catch (error) {
      console.error('Failed to get market data:', error);
      return await this.generateRealisticMarketData(symbol);
    }
  }

  private async generateRealisticMarketData(symbol: string): Promise<MarketData> {
    // Attempt to fetch REAL historical data from MT5
    try {
      if (exnessAPI.isConnectedToExness()) {
        const historicalData = await exnessAPI.getHistoricalData(symbol, '1h', 200); // H1 timeframe, 200 bars

        if (historicalData && historicalData.length > 0) {
          console.log(`✅ Using real MT5 historical data for ${symbol} (${historicalData.length} bars)`);

          return {
            symbol,
            prices: historicalData.map((bar: any) => bar.close),
            volumes: historicalData.map((bar: any) => bar.tick_volume),
            timestamps: historicalData.map((bar: any) => new Date(bar.time * 1000))
          };
        }
      }

      // Fallback: If MT5 not connected, use minimal data
      console.warn('⚠️ MT5 not connected, using fallback minimal data for', symbol);
      const basePrice = this.getBasePrice(symbol);
      const now = new Date();
      const prices: number[] = [];
      const volumes: number[] = [];
      const timestamps: Date[] = [];

      for (let i = 0; i < 200; i++) {
        prices.push(basePrice);
        volumes.push(0);
        timestamps.push(new Date(now.getTime() - ((199 - i) * 3600000))); // 1 hour intervals for H1 timeframe
      }

      return { symbol, prices, volumes, timestamps };
    } catch (error) {
      console.error('❌ Error fetching historical data, using fallback:', error);
      const basePrice = this.getBasePrice(symbol);
      const now = new Date();
      return {
        symbol,
        prices: Array(200).fill(basePrice),
        volumes: Array(200).fill(0),
        timestamps: Array(200).fill(0).map((_, i) => new Date(now.getTime() - ((199 - i) * 3600000))) // 1 hour intervals for H1 timeframe
      };
    }
  }

  private async saveSignalToDatabase(signal: TradingSignal, symbol: string): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get currency pair
      const { data: pair } = await supabase
        .from('currency_pairs')
        .select('id')
        .eq('symbol', symbol)
        .single();

      if (!pair) return;

      const { error } = await supabase
        .from('trading_signals')
        .insert({
          user_id: user.id,
          pair_id: pair.id,
          signal_type: signal.type,
          confidence_score: signal.confidence,
          entry_price: signal.entryPrice,
          stop_loss: signal.stopLoss,
          take_profit: signal.takeProfit,
          timeframe: signal.timeframe,
          reasoning: signal.reasoning,
          ai_model: signal.source,
          status: 'ACTIVE'
        });

      if (error) throw error;
      console.log(`Advanced signal saved: ${signal.source} - ${signal.type} ${symbol}`);
    } catch (error) {
      console.error('Failed to save signal to database:', error);
    }
  }

  async generateTestSignal(symbol: string = 'EURUSD'): Promise<void> {
    try {
      // Verify connection to Exness
      if (!exnessAPI.isConnectedToExness()) {
        throw new Error('Not connected to Exness - cannot generate signal');
      }

      const accountType = exnessAPI.getAccountType();
      console.log(`🧪 Generating test signal for ${symbol} on ${accountType?.toUpperCase()} account using REAL price data...`);
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get currency pair
      const { data: pair } = await supabase
        .from('currency_pairs')
        .select('id')
        .eq('symbol', symbol)
        .single();

      if (!pair) {
        console.error('Currency pair not found:', symbol);
        return;
      }

      // Get REAL current market price from Exness
      const currentPrice = await exnessAPI.getCurrentPrice(symbol);
      if (!currentPrice) {
        throw new Error(`Unable to get real price for ${symbol}`);
      }
      
      const basePrice = currentPrice.bid;
      
      // Use real price action to determine signal type
      const priceSpread = currentPrice.ask - currentPrice.bid;
      const signalType = priceSpread > (currentPrice.bid * 0.0001) ? 'SELL' : 'BUY'; // Based on real spread
      const confidence = 75; // Fixed confidence for test signals
      
      // Calculate stop loss and take profit based on real market conditions
      const pipSize = symbol.includes('JPY') ? 0.01 : symbol.includes('XAU') ? 0.01 : 0.0001;
      const stopLossDistance = 20 * pipSize; // 20 pips
      const takeProfitDistance = 30 * pipSize; // 30 pips (1.5:1 ratio)
      
      const stopLoss = signalType === 'BUY' 
        ? basePrice - stopLossDistance 
        : basePrice + stopLossDistance;
        
      const takeProfit = signalType === 'BUY' 
        ? basePrice + takeProfitDistance 
        : basePrice - takeProfitDistance;

      const testSignal = {
        user_id: user.id,
        pair_id: pair.id,
        signal_type: signalType,
        confidence_score: confidence,
        entry_price: basePrice,
        stop_loss: stopLoss,
        take_profit: takeProfit,
        timeframe: '15M',
        reasoning: `Test signal for ${accountType?.toUpperCase()} account: ${signalType} at real price ${basePrice.toFixed(5)} with ${confidence}% confidence`,
        ai_model: 'test_signal_generator',
        status: 'ACTIVE'
      };

      const { error } = await supabase
        .from('trading_signals')
        .insert(testSignal);

      if (error) throw error;
      
      console.log(`✅ Enhanced test signal generated successfully:`, {
        symbol,
        type: signalType,
        confidence: confidence.toFixed(1) + '%',
        entryPrice: basePrice.toFixed(4),
        stopLoss: stopLoss.toFixed(4),
        takeProfit: takeProfit.toFixed(4),
        accountType: accountType?.toUpperCase()
      });
      
    } catch (error) {
      console.error('❌ Failed to generate enhanced test signal:', error);
      throw error;
    }
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

  setConfiguration(config: Partial<SignalProcessorConfig>): void {
    this.config = { ...this.config, ...config };
  }

  getConfiguration(): SignalProcessorConfig {
    return { ...this.config };
  }

  async enableAutoExecution(enabled: boolean): Promise<void> {
    this.config.autoExecute = enabled;
    console.log(`🤖 Enhanced auto-execution ${enabled ? 'ENABLED' : 'DISABLED'} in signal processor`);
    
    // Update bot settings in database
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await supabase
        .from('bot_settings')
        .upsert({
          user_id: user.id,
          is_active: enabled,
          min_confidence_score: this.config.minConfidence,
          updated_at: new Date().toISOString()
        });
        
      console.log(`📊 Enhanced signal processor settings saved: auto-execute ${enabled}, min confidence ${this.config.minConfidence}%`);
    } catch (error) {
      console.error('Failed to update auto execution setting:', error);
    }
  }

  // Enhanced method to get processing statistics
  getProcessingStats(): any {
    return {
      processedToday: this.processedSignalsToday,
      maxDaily: this.maxDailyProcessing,
      remaining: Math.max(0, this.maxDailyProcessing - this.processedSignalsToday),
      lastProcessTime: new Date(this.lastProcessTime),
      isProcessing: this.isProcessing,
      config: this.config
    };
  }

  // Method to boost processing for high-opportunity periods
  async boostProcessing(durationMinutes: number = 60): Promise<void> {
    const originalMinConfidence = this.config.minConfidence;
    const originalInterval = 2000;

    // Temporarily reduce confidence threshold and increase processing
    this.config.minConfidence = Math.max(10, originalMinConfidence * 0.7);

    console.log(`🚀 Signal processing boosted for ${durationMinutes} minutes: confidence threshold ${originalMinConfidence}% → ${this.config.minConfidence}%`);

    // Reset after duration
    setTimeout(() => {
      this.config.minConfidence = originalMinConfidence;
      console.log('🔄 Signal processing parameters reset to normal levels');
    }, durationMinutes * 60 * 1000);
  }

  // Additional strategies for maximum signal generation
  private async momentumStrategy(marketData: MarketData, indicators: TechnicalIndicators): Promise<TradingSignal | null> {
    const { rsi, macd, atr } = indicators;
    const currentPrice = marketData.prices[marketData.prices.length - 1];

    // Strong momentum signals
    if (rsi > 50 && macd.value > macd.signal && macd.histogram > 0) {
      return {
        id: this.generateSignalId(),
        symbol: marketData.symbol,
        type: 'BUY',
        confidence: 65,
        entryPrice: currentPrice,
        stopLoss: currentPrice - (atr * 0.5),
        takeProfit: currentPrice + (atr * 1.0),
        timeframe: '5M',
        reasoning: 'Momentum: Strong bullish momentum with RSI and MACD confirmation',
        source: 'Momentum Strategy',
        probabilityOfSuccess: 0.65
      };
    }

    if (rsi < 50 && macd.value < macd.signal && macd.histogram < 0) {
      return {
        id: this.generateSignalId(),
        symbol: marketData.symbol,
        type: 'SELL',
        confidence: 65,
        entryPrice: currentPrice,
        stopLoss: currentPrice + (atr * 0.5),
        takeProfit: currentPrice - (atr * 1.0),
        timeframe: '5M',
        reasoning: 'Momentum: Strong bearish momentum with RSI and MACD confirmation',
        source: 'Momentum Strategy',
        probabilityOfSuccess: 0.65
      };
    }

    return null;
  }

  private async trendFollowingStrategy(marketData: MarketData, indicators: TechnicalIndicators): Promise<TradingSignal | null> {
    const { ema20, ema50, sma200, atr } = indicators;
    const currentPrice = marketData.prices[marketData.prices.length - 1];

    // Strong trend following
    if (ema20 > ema50 && ema50 > sma200 && currentPrice > ema20) {
      return {
        id: this.generateSignalId(),
        symbol: marketData.symbol,
        type: 'BUY',
        confidence: 70,
        entryPrice: currentPrice,
        stopLoss: currentPrice - (atr * 0.8),
        takeProfit: currentPrice + (atr * 1.5),
        timeframe: '1H',
        reasoning: 'Trend Following: Strong uptrend with EMA alignment',
        source: 'Trend Following Strategy',
        probabilityOfSuccess: 0.70
      };
    }

    if (ema20 < ema50 && ema50 < sma200 && currentPrice < ema20) {
      return {
        id: this.generateSignalId(),
        symbol: marketData.symbol,
        type: 'SELL',
        confidence: 70,
        entryPrice: currentPrice,
        stopLoss: currentPrice + (atr * 0.8),
        takeProfit: currentPrice - (atr * 1.5),
        timeframe: '1H',
        reasoning: 'Trend Following: Strong downtrend with EMA alignment',
        source: 'Trend Following Strategy',
        probabilityOfSuccess: 0.70
      };
    }

    return null;
  }

  private async rangeTradingStrategy(marketData: MarketData, indicators: TechnicalIndicators): Promise<TradingSignal | null> {
    const { bollinger, rsi, stochastic } = indicators;
    const currentPrice = marketData.prices[marketData.prices.length - 1];

    // Range trading within Bollinger Bands
    if (currentPrice < bollinger.lower && rsi < 35 && stochastic.k < 25) {
      return {
        id: this.generateSignalId(),
        symbol: marketData.symbol,
        type: 'BUY',
        confidence: 60,
        entryPrice: currentPrice,
        stopLoss: bollinger.lower - (bollinger.middle - bollinger.lower) * 0.1,
        takeProfit: bollinger.middle,
        timeframe: '15M',
        reasoning: 'Range Trading: Price at lower Bollinger Band with oversold indicators',
        source: 'Range Trading Strategy',
        probabilityOfSuccess: 0.60
      };
    }

    if (currentPrice > bollinger.upper && rsi > 65 && stochastic.k > 75) {
      return {
        id: this.generateSignalId(),
        symbol: marketData.symbol,
        type: 'SELL',
        confidence: 60,
        entryPrice: currentPrice,
        stopLoss: bollinger.upper + (bollinger.upper - bollinger.middle) * 0.1,
        takeProfit: bollinger.middle,
        timeframe: '15M',
        reasoning: 'Range Trading: Price at upper Bollinger Band with overbought indicators',
        source: 'Range Trading Strategy',
        probabilityOfSuccess: 0.60
      };
    }

    return null;
  }

  private generateSignalId(): string {
    return `signal_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }
}

export const signalProcessor = new SignalProcessor();
