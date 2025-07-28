import { supabase } from '@/integrations/supabase/client';
import { orderManager, OrderRequest } from './orderManager';

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
    minConfidence: 75,
    enabledTimeframes: ['1H', '4H', '1D'],
    enabledPairs: ['EURUSD', 'GBPUSD', 'USDJPY'],
    autoExecute: false
  };

  private isProcessing = false;

  async initialize(): Promise<void> {
    await this.loadConfiguration();
    this.startSignalMonitoring();
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
    // Monitor for new signals every 30 seconds
    setInterval(async () => {
      if (this.isProcessing) return;
      
      this.isProcessing = true;
      try {
        await this.processNewSignals();
      } catch (error) {
        console.error('Signal processing error:', error);
      } finally {
        this.isProcessing = false;
      }
    }, 30000);
  }

  private async processNewSignals(): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get unprocessed signals
      const { data: signals } = await supabase
        .from('trading_signals')
        .select(`
          *,
          currency_pairs(symbol)
        `)
        .eq('user_id', user.id)
        .eq('status', 'ACTIVE')
        .gte('confidence_score', this.config.minConfidence)
        .in('timeframe', this.config.enabledTimeframes);

      if (!signals || signals.length === 0) return;

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
    // Check confidence threshold
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

    // Additional signal validation logic can be added here
    return true;
  }

  private async executeSignal(signal: TradingSignal): Promise<void> {
    try {
      // Calculate position size based on confidence and risk
      const volume = this.calculateVolumeFromSignal(signal);

      const orderRequest: OrderRequest = {
        symbol: signal.symbol,
        type: signal.type,
        volume,
        stopLoss: signal.stopLoss,
        takeProfit: signal.takeProfit,
        comment: `AI Signal ${signal.id} (${signal.confidence}%)`
      };

      // Execute the order
      const orderId = await orderManager.executeOrder(orderRequest);

      if (orderId) {
        // Update signal status
        await this.updateSignalStatus(signal.id, 'EXECUTED', orderId);
        console.log(`Signal ${signal.id} executed successfully. Order ID: ${orderId}`);
      }

    } catch (error) {
      console.error(`Failed to execute signal ${signal.id}:`, error);
      await this.updateSignalStatus(signal.id, 'FAILED', null, error.message);
    }
  }

  private calculateVolumeFromSignal(signal: TradingSignal): number {
    // Base volume calculation
    let baseVolume = 0.1; // Standard lot size

    // Adjust based on confidence
    const confidenceMultiplier = signal.confidence / 100;
    baseVolume *= confidenceMultiplier;

    // Ensure minimum and maximum limits
    return Math.max(0.01, Math.min(baseVolume, 1.0));
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

  async generateTestSignal(symbol: string = 'EURUSD'): Promise<void> {
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

      // Generate random signal
      const signalType = Math.random() > 0.5 ? 'BUY' : 'SELL';
      const basePrice = this.getBasePrice(symbol);
      const confidence = 75 + Math.random() * 20; // 75-95%

      const { error } = await supabase
        .from('trading_signals')
        .insert({
          user_id: user.id,
          pair_id: pair.id,
          signal_type: signalType,
          confidence_score: confidence,
          entry_price: basePrice,
          stop_loss: signalType === 'BUY' ? basePrice - 0.005 : basePrice + 0.005,
          take_profit: signalType === 'BUY' ? basePrice + 0.01 : basePrice - 0.01,
          timeframe: '1H',
          reasoning: `AI-generated ${signalType} signal based on technical analysis`,
          ai_model: 'GPT-4 Trading Model',
          status: 'ACTIVE'
        });

      if (error) throw error;
      console.log(`Test signal generated for ${symbol}`);
    } catch (error) {
      console.error('Failed to generate test signal:', error);
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
    
    // Update bot settings in database
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await supabase
        .from('bot_settings')
        .upsert({
          user_id: user.id,
          is_active: enabled,
          updated_at: new Date().toISOString()
        });
    } catch (error) {
      console.error('Failed to update auto execution setting:', error);
    }
  }
}

export const signalProcessor = new SignalProcessor();