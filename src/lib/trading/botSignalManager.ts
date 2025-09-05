import { supabase } from '@/integrations/supabase/client';
import { orderManager } from './orderManager';
import { exnessAPI } from './exnessApi';
import { signalProcessor } from './signalProcessor';
import { professionalStrategies } from './strategies/professionalStrategies';

export interface SignalGenerationConfig {
  enabled: boolean;
  interval: number; // milliseconds
  symbols: string[];
  minConfidence: number;
  autoExecute: boolean;
}

class BotSignalManager {
  private config: SignalGenerationConfig = {
    enabled: false,
    interval: 30000, // 30 seconds
    symbols: ['EURUSD', 'GBPUSD', 'USDJPY'],
    minConfidence: 75,
    autoExecute: false
  };

  private generationInterval: NodeJS.Timeout | null = null;
  private isGenerating = false;
  private lastGenerationTime = 0;

  async initialize(config?: Partial<SignalGenerationConfig>): Promise<void> {
    if (config) {
      this.config = { ...this.config, ...config };
    }
    console.log('📡 Signal Manager initialized with config:', this.config);
  }

  startAutomaticGeneration(): void {
    if (this.generationInterval) {
      console.log('Signal generation already running');
      return;
    }

    console.log(`🔄 Starting automatic signal generation (interval: ${this.config.interval/1000}s)`);
    
    // Start generation loop
    this.generationInterval = setInterval(async () => {
      if (this.config.enabled && !this.isGenerating) {
        await this.generateAndProcessSignals();
      }
    }, this.config.interval);

    // Generate immediately
    this.generateAndProcessSignals();
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
      console.log('Signal generation already in progress, skipping...');
      return;
    }

    // Rate limiting
    const timeSinceLastGeneration = Date.now() - this.lastGenerationTime;
    if (timeSinceLastGeneration < 20000) { // Minimum 20 seconds between generations
      console.log('Rate limit: Too soon since last generation');
      return;
    }

    this.isGenerating = true;
    this.lastGenerationTime = Date.now();

    try {
      console.log('🔍 Analyzing market for trading opportunities...');
      
      // Check if we're connected and can trade
      if (!exnessAPI.isConnectedToExness()) {
        console.warn('Not connected to Exness, skipping signal generation');
        return;
      }

      const { canTrade, issues } = await exnessAPI.verifyTradingCapabilities();
      if (!canTrade) {
        console.warn('Cannot trade:', issues.join(', '));
        return;
      }

      // Generate signals for each symbol
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
      
      // Generate signal if confidence is high enough
      if (analysis.confidence >= this.config.minConfidence) {
        await this.saveSignal({
          symbol,
          type: analysis.direction,
          confidence: analysis.confidence,
          entryPrice: marketPrice.bid,
          stopLoss: analysis.stopLoss,
          takeProfit: analysis.takeProfit,
          reasoning: analysis.reasoning
        });

        console.log(`📊 Signal generated for ${symbol}: ${analysis.direction} with ${analysis.confidence.toFixed(1)}% confidence`);
      }
    } catch (error) {
      console.error(`Failed to analyze ${symbol}:`, error);
    }
  }

  private async performTechnicalAnalysis(symbol: string, price: any): Promise<any> {
    // Simulate comprehensive technical analysis
    const trend = Math.random() > 0.5 ? 'BULLISH' : 'BEARISH';
    const momentum = 50 + Math.random() * 50;
    const volatility = Math.random() * 30;
    
    // Calculate confidence based on multiple factors
    const trendStrength = Math.random() * 40;
    const momentumScore = momentum > 70 ? 30 : momentum > 50 ? 20 : 10;
    const volatilityScore = volatility < 20 ? 20 : 10;
    const confidence = Math.min(95, 50 + trendStrength + momentumScore + volatilityScore);

    // Calculate SL/TP based on volatility
    const pipSize = symbol.includes('JPY') ? 0.01 : 0.0001;
    const slDistance = (20 + volatility) * pipSize;
    const tpDistance = slDistance * 2; // 2:1 risk-reward ratio

    return {
      direction: trend === 'BULLISH' ? 'BUY' : 'SELL',
      confidence,
      stopLoss: trend === 'BULLISH' ? price.bid - slDistance : price.bid + slDistance,
      takeProfit: trend === 'BULLISH' ? price.bid + tpDistance : price.bid - tpDistance,
      reasoning: `Technical analysis: ${trend} trend with ${momentum.toFixed(1)}% momentum, volatility at ${volatility.toFixed(1)}%`
    };
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

      if (!pair) {
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
        pair.id = newPair.id;
      }

      // Save signal to database
      await supabase
        .from('trading_signals')
        .insert({
          user_id: user.id,
          pair_id: pair.id,
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

      // Get active signals that haven't been executed
      const { data: signals } = await supabase
        .from('trading_signals')
        .select('*, currency_pairs(symbol)')
        .eq('user_id', user.id)
        .eq('status', 'ACTIVE')
        .gte('confidence_score', this.config.minConfidence)
        .order('confidence_score', { ascending: false })
        .limit(3); // Process top 3 signals

      if (!signals || signals.length === 0) return;

      for (const signal of signals) {
        try {
          // Check if we should execute this signal
          if (signal.confidence_score < this.config.minConfidence) continue;

          const symbol = signal.currency_pairs?.symbol;
          if (!symbol || !this.config.symbols.includes(symbol)) continue;

          // Execute the trade
          const orderRequest = {
            symbol,
            type: signal.signal_type as 'BUY' | 'SELL',
            volume: 0.01, // Start with minimum lot size
            stopLoss: signal.stop_loss ? parseFloat(signal.stop_loss.toString()) : undefined,
            takeProfit: signal.take_profit ? parseFloat(signal.take_profit.toString()) : undefined,
            comment: `AutoSignal-${signal.id.substring(0, 8)}`
          };

          const orderId = await orderManager.executeOrder(orderRequest);
          
          if (orderId) {
            // Update signal status
            await supabase
              .from('trading_signals')
              .update({ 
                status: 'EXECUTED',
                order_id: orderId,
                updated_at: new Date().toISOString()
              })
              .eq('id', signal.id);

            console.log(`✅ Signal ${signal.id} executed: Order ${orderId}`);
          }
        } catch (error) {
          console.error(`Failed to execute signal ${signal.id}:`, error);
          
          // Mark signal as failed
          await supabase
            .from('trading_signals')
            .update({ 
              status: 'FAILED',
              error_message: error.message,
              updated_at: new Date().toISOString()
            })
            .eq('id', signal.id);
        }
      }
    } catch (error) {
      console.error('Failed to execute pending signals:', error);
    }
  }

  setConfiguration(config: Partial<SignalGenerationConfig>): void {
    this.config = { ...this.config, ...config };
    console.log('Signal manager configuration updated:', this.config);
  }

  getConfiguration(): SignalGenerationConfig {
    return { ...this.config };
  }

  async forceGenerateSignal(symbol: string): Promise<void> {
    console.log(`🎯 Force generating signal for ${symbol}...`);
    await this.analyzeAndGenerateSignal(symbol);
  }
}

export const botSignalManager = new BotSignalManager();