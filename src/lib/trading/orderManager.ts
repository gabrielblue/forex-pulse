import { supabase } from '@/integrations/supabase/client';
import { exnessAPI, TradeOrder } from './exnessApi';

export interface OrderRequest {
  symbol: string;
  type: 'BUY' | 'SELL';
  volume: number;
  stopLoss?: number;
  takeProfit?: number;
  comment?: string;
}

export interface RiskParameters {
  maxRiskPerTrade: number;
  maxDailyLoss: number;
  maxDrawdown: number;
  maxPositionSize: number;
  useStopLoss: boolean;
  useTakeProfit: boolean;
}

class OrderManager {
  private isAutoTradingEnabled = false;
  private riskParameters: RiskParameters | null = null;

  async initialize(): Promise<void> {
    await this.loadRiskParameters();
  }

  private async loadRiskParameters(): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: riskSettings } = await supabase
        .from('risk_settings')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (riskSettings) {
        this.riskParameters = {
          maxRiskPerTrade: parseFloat(riskSettings.max_risk_per_trade?.toString() || '2'),
          maxDailyLoss: parseFloat(riskSettings.max_daily_loss?.toString() || '5'),
          maxDrawdown: parseFloat(riskSettings.max_drawdown?.toString() || '15'),
          maxPositionSize: parseFloat(riskSettings.max_position_size?.toString() || '10000'),
          useStopLoss: riskSettings.use_stop_loss || true,
          useTakeProfit: riskSettings.use_take_profit || true
        };
      }
    } catch (error) {
      console.error('Failed to load risk parameters:', error);
    }
  }

  setAutoTrading(enabled: boolean): void {
    this.isAutoTradingEnabled = enabled;
  }

  isAutoTradingActive(): boolean {
    return this.isAutoTradingEnabled;
  }

  async executeOrder(orderRequest: OrderRequest): Promise<string | null> {
    try {
      // Pre-execution risk checks
      const riskCheck = await this.performRiskChecks(orderRequest);
      if (!riskCheck.passed) {
        throw new Error(`Risk check failed: ${riskCheck.reason}`);
      }

      // Calculate position size based on risk
      const adjustedVolume = await this.calculatePositionSize(orderRequest);

      // Prepare order for execution
      const order: TradeOrder = {
        symbol: orderRequest.symbol,
        type: orderRequest.type,
        volume: adjustedVolume,
        stopLoss: orderRequest.stopLoss,
        takeProfit: orderRequest.takeProfit,
        comment: orderRequest.comment || 'Auto-trade'
      };

      // Execute order through Exness API
      const orderId = await exnessAPI.placeOrder(order);

      if (orderId) {
        // Log successful execution
        await this.logOrderExecution(orderRequest, orderId, 'SUCCESS');
        
        // Update performance metrics
        await this.updatePerformanceMetrics();
      }

      return orderId;
    } catch (error) {
      console.error('Order execution failed:', error);
      await this.logOrderExecution(orderRequest, null, 'FAILED', error.message);
      throw error;
    }
  }

  private async performRiskChecks(orderRequest: OrderRequest): Promise<{passed: boolean, reason?: string}> {
    if (!this.riskParameters) {
      return { passed: false, reason: 'Risk parameters not loaded' };
    }

    // Check if Exness is connected
    if (!exnessAPI.isConnectedToExness()) {
      return { passed: false, reason: 'Not connected to Exness' };
    }

    // Check position size limit
    const positionValue = orderRequest.volume * 100000; // Standard lot
    if (positionValue > this.riskParameters.maxPositionSize) {
      return { passed: false, reason: 'Position size exceeds limit' };
    }

    // Check daily loss limit
    const dailyLoss = await this.getDailyLoss();
    const accountInfo = await exnessAPI.getAccountInfo();
    
    if (accountInfo && dailyLoss > (accountInfo.balance * this.riskParameters.maxDailyLoss / 100)) {
      return { passed: false, reason: 'Daily loss limit exceeded' };
    }

    // Check if stop loss is required and provided
    if (this.riskParameters.useStopLoss && !orderRequest.stopLoss) {
      return { passed: false, reason: 'Stop loss is required but not provided' };
    }

    return { passed: true };
  }

  private async calculatePositionSize(orderRequest: OrderRequest): Promise<number> {
    if (!this.riskParameters) return orderRequest.volume;

    const accountInfo = await exnessAPI.getAccountInfo();
    if (!accountInfo) return orderRequest.volume;

    // Calculate position size based on risk percentage
    const riskAmount = accountInfo.balance * (this.riskParameters.maxRiskPerTrade / 100);
    
    if (orderRequest.stopLoss) {
      // Calculate position size based on stop loss distance
      const currentPrice = this.getBasePrice(orderRequest.symbol);
      const stopDistance = Math.abs(currentPrice - orderRequest.stopLoss);
      const pipValue = this.getPipValue(orderRequest.symbol);
      const maxLots = riskAmount / (stopDistance * pipValue * 100000);
      
      return Math.min(orderRequest.volume, maxLots);
    }

    return orderRequest.volume;
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

  private getPipValue(symbol: string): number {
    // Simplified pip value calculation
    if (symbol.includes('JPY')) return 0.01;
    return 0.0001;
  }

  private async getDailyLoss(): Promise<number> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return 0;

      const { data: trades } = await supabase
        .from('live_trades')
        .select('profit')
        .eq('user_id', user.id)
        .gte('opened_at', new Date().toISOString().split('T')[0]);

      return trades?.reduce((sum, trade) => sum + (parseFloat(trade.profit?.toString() || '0')), 0) || 0;
    } catch (error) {
      console.error('Failed to get daily loss:', error);
      return 0;
    }
  }

  private async logOrderExecution(
    orderRequest: OrderRequest, 
    orderId: string | null, 
    status: string, 
    errorMessage?: string
  ): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Log to a trading_logs table (you might want to create this)
      console.log('Order execution log:', {
        user_id: user.id,
        order_request: orderRequest,
        order_id: orderId,
        status,
        error_message: errorMessage,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Failed to log order execution:', error);
    }
  }

  private async updatePerformanceMetrics(): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: account } = await supabase
        .from('trading_accounts')
        .select('id')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .single();

      if (account) {
        await supabase.rpc('calculate_daily_performance', {
          p_user_id: user.id,
          p_account_id: account.id
        });
      }
    } catch (error) {
      console.error('Failed to update performance metrics:', error);
    }
  }

  async getOpenPositions() {
    return await exnessAPI.getPositions();
  }

  async closePosition(ticket: number): Promise<boolean> {
    return await exnessAPI.closePosition(ticket);
  }

  async closeAllPositions(): Promise<void> {
    const positions = await this.getOpenPositions();
    
    for (const position of positions) {
      try {
        await this.closePosition(position.ticket);
      } catch (error) {
        console.error(`Failed to close position ${position.ticket}:`, error);
      }
    }
  }

  async emergencyStop(): Promise<void> {
    console.log('EMERGENCY STOP ACTIVATED');
    
    // Disable auto trading
    this.setAutoTrading(false);
    
    // Close all positions
    await this.closeAllPositions();
    
    // Log emergency stop
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      console.log('Emergency stop executed for user:', user.id);
    }
  }
}

export const orderManager = new OrderManager();