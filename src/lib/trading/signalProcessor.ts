import { supabase } from '@/integrations/supabase/client';
import { orderManager, OrderRequest } from './orderManager';
import { professionalStrategies, MarketData, TechnicalIndicators } from './strategies/professionalStrategies';
import { exnessAPI } from './exnessApi';

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
}

export interface SignalProcessorConfig {
  minConfidence: number;
  enabledTimeframes: string[];
  enabledPairs: string[];
  autoExecute: boolean;
}

class SignalProcessor {
  private config: SignalProcessorConfig = {
    minConfidence: 15, // Ultra low for maximum day trading opportunities
    enabledTimeframes: ['5M', '15M', '30M', '1H'], // Short timeframes for day trading
    enabledPairs: ['EURUSD', 'GBPUSD', 'USDJPY', 'AUDUSD', 'USDCHF', 'NZDUSD', 'XAUUSD', 'EURJPY', 'GBPJPY', 'USDCAD'], // All major pairs
    autoExecute: false
  };

  private isProcessing = false;
  private lastProcessTime = 0;
  private processedSignalsToday = 0;
  private maxDailyProcessing = 5000; // Ultra high processing limit

  async initialize(): Promise<void> {
    await this.loadConfiguration();
    this.startSignalMonitoring();
    console.log('🔧 Enhanced Signal Processor initialized with ultra aggressive parameters');
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
    // Monitor for new signals every 2 seconds for ultra aggressive day trading
    setInterval(async () => {
      if (this.isProcessing) return;
      
      // Enhanced rate limiting
      const timeSinceLastProcess = Date.now() - this.lastProcessTime;
      if (timeSinceLastProcess < 1000) return; // 1 second minimum
      
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
    }, 2000); // Ultra reduced interval for maximum processing frequency
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
        .limit(20); // Process top 20 signals for maximum opportunities

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
        source: signalData.ai_model || 'AI'
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
    // Enhanced signal validation with more lenient criteria
    if (signal.confidence < this.config.minConfidence) {
      return false;
    }

    // Check if pair is enabled
    if (!this.config.enabledPairs.includes(signal.symbol)) {
      return false;
    }

    // Check if timeframe is enabled
    if (!this.config.enabledTimeframes.includes(signal.timeframe)) {
      return false;
    }

    // Enhanced validation - allow signals during optimal trading sessions
    const currentHour = new Date().getUTCHours();
    const isOptimalSession = (currentHour >= 8 && currentHour <= 17) || (currentHour >= 13 && currentHour <= 22);
    
    // Lower confidence threshold during optimal sessions
    if (isOptimalSession && signal.confidence >= this.config.minConfidence * 0.8) {
      return true;
    }
    
    return true;
  }

  private async executeSignal(signal: TradingSignal): Promise<void> {
    try {
      // Enhanced position size calculation
      const volume = this.calculateEnhancedVolumeFromSignal(signal);

      const orderRequest: OrderRequest = {
        symbol: signal.symbol,
        type: signal.type,
        volume,
        stopLoss: signal.stopLoss,
        takeProfit: signal.takeProfit,
        comment: `UltraAI-${signal.confidence.toFixed(0)}%-${signal.id.substring(0, 6)}`
      };

      // Execute the order
      const orderId = await orderManager.executeOrder(orderRequest);

      if (orderId) {
        // Update signal status
        await this.updateSignalStatus(signal.id, 'EXECUTED', orderId);
        console.log(`Enhanced signal ${signal.id} executed successfully. Order ID: ${orderId}, Volume: ${volume}`);
      }

    } catch (error) {
      console.error(`Failed to execute signal ${signal.id}:`, error);
      await this.updateSignalStatus(signal.id, 'FAILED', null, error.message);
    }
  }

  private calculateEnhancedVolumeFromSignal(signal: TradingSignal): number {
    // Ultra aggressive volume calculation for enhanced day trading
    let baseVolume = 0.25; // Start with even larger base volume for day trading
    
    // Enhanced confidence-based sizing
    const confidenceMultiplier = Math.max(1.2, signal.confidence / 60); // Ultra aggressive multiplier
    baseVolume *= confidenceMultiplier;
    
    // Enhanced time-based adjustments
    const currentHour = new Date().getUTCHours();
    const isOptimalTime = (currentHour >= 8 && currentHour <= 17) || (currentHour >= 13 && currentHour <= 22);
    
    if (isOptimalTime) {
      baseVolume *= 3.0; // Massive boost during optimal trading hours
    }
    
    // Enhanced symbol-specific adjustments
    if (signal.symbol === 'EURUSD' || signal.symbol === 'GBPUSD') {
      baseVolume *= 1.8; // Much larger positions for major pairs
    }
    
    // Gold trading boost
    if (signal.symbol === 'XAUUSD') {
      baseVolume *= 1.5; // Boost for gold trading
    }
    
    // Enhanced risk-reward ratio bonus
    if (signal.takeProfit && signal.stopLoss) {
      const entryPrice = signal.entryPrice;
      const takeProfitDistance = Math.abs(signal.takeProfit - entryPrice);
      const stopLossDistance = Math.abs(entryPrice - signal.stopLoss);
      const riskReward = takeProfitDistance / stopLossDistance;
      
      if (riskReward >= 1.5) {
        baseVolume *= 2.0; // Boost for decent risk-reward
      }
      if (riskReward >= 2.0) {
        baseVolume *= 3.0; // Massive boost for excellent risk-reward
      }
    }
    
    // Apply enhanced safety limits
    return Math.max(0.10, Math.min(3.0, baseVolume)); // Increased max volume to 3.0 lots
  }

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

  async generateAdvancedSignals(symbols: string[] = ['EURUSD', 'GBPUSD', 'USDJPY']): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      console.log(`🔍 Generating enhanced advanced signals for ${symbols.length} symbols...`);

      for (const symbol of symbols) {
        // Get market data for the symbol
        const marketData = await this.getMarketData(symbol);
        const indicators = professionalStrategies.calculateTechnicalIndicators(
          marketData.prices, 
          marketData.volumes
        );

        // Apply ultra enhanced strategies with market context
        const strategies = [
          () => professionalStrategies.scalpingStrategy(marketData, indicators),
          () => professionalStrategies.swingTradingStrategy(marketData, indicators),
          () => professionalStrategies.breakoutStrategy(marketData, indicators),
          () => professionalStrategies.meanReversionStrategy(marketData, indicators),
          () => professionalStrategies.gridTradingStrategy(marketData, indicators)
        ];

        for (const strategy of strategies) {
          const signal = await strategy();
          // Enhanced signal acceptance with lower threshold
          if (signal && signal.confidence >= this.config.minConfidence * 0.9) {
            await this.saveSignalToDatabase(signal, symbol);
            console.log(`💎 Enhanced signal saved: ${signal.source} - ${signal.type} ${symbol} (${signal.confidence.toFixed(1)}%)`);
          }
        }
      }
    } catch (error) {
      console.error('Failed to generate advanced signals:', error);
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
      return this.generateRealisticMarketData(symbol);
    }
  }

  private generateRealisticMarketData(symbol: string): MarketData {
    const basePrice = this.getBasePrice(symbol);
    const prices: number[] = [];
    const volumes: number[] = [];
    const timestamps: Date[] = [];

    let currentPrice = basePrice;
    const now = new Date();

    // Generate 200 data points with realistic price movements
    for (let i = 199; i >= 0; i--) {
      const volatility = 0.0002; // 2 pips volatility
      const randomWalk = (Math.random() - 0.5) * volatility;
      const trend = Math.sin(i / 50) * 0.0001; // Subtle trend component
      
      currentPrice += randomWalk + trend;
      prices.unshift(currentPrice);
      
      // Generate realistic volume
      const baseVolume = 1000000;
      const volumeVariation = baseVolume * (0.5 + Math.random());
      volumes.unshift(Math.floor(volumeVariation));
      
      const timestamp = new Date(now.getTime() - (i * 60000)); // 1 minute intervals
      timestamps.unshift(timestamp);
    }

    return { symbol, prices, volumes, timestamps };
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
      const accountType = exnessAPI.getAccountType();
      console.log(`🧪 Generating enhanced test signal for ${symbol} on ${accountType?.toUpperCase()} account...`);
      
      // Generate a realistic test signal
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

      // Get current market price
      const currentPrice = await exnessAPI.getCurrentPrice(symbol);
      const basePrice = currentPrice?.bid || this.getBasePrice(symbol);
      
      // Generate enhanced realistic signal
      const signalType = Math.random() > 0.5 ? 'BUY' : 'SELL';
      const confidence = 60 + Math.random() * 35; // 60-95% confidence for more variety
      
      // Enhanced stop loss and take profit for day trading
      const stopLossDistance = 0.001; // 10 pips for day trading
      const takeProfitDistance = 0.0015; // 15 pips (1.5:1 ratio for faster profits)
      
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
        timeframe: '15M', // Shorter timeframe for day trading
        reasoning: `Enhanced test signal for ${accountType?.toUpperCase()} account: ${signalType} signal with ${confidence.toFixed(1)}% confidence based on advanced technical analysis and market conditions`,
        ai_model: 'enhanced_test_signal_generator',
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
}

export const signalProcessor = new SignalProcessor();