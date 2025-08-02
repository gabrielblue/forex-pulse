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
  maxConcurrentPositions: number;
  useStopLoss: boolean;
  useTakeProfit: boolean;
  minAccountBalance: number;
  minMarginLevel: number;
}

class OrderManager {
  private isAutoTradingEnabled = false;
  private riskParams: RiskParameters = {
    maxRiskPerTrade: 1.0, // 1% for real trading
    maxDailyLoss: 3.0, // 3% for real trading
    maxDrawdown: 10.0,
    maxPositionSize: 5.0, // Max 5 lots
    maxConcurrentPositions: 3, // Max 3 positions
    useStopLoss: true,
    useTakeProfit: true,
    minAccountBalance: 100, // $100 minimum
    minMarginLevel: 200 // 200% minimum margin level
  };

  async initialize(): Promise<void> {
    await this.loadRiskParameters();
    console.log('OrderManager initialized with enhanced risk parameters for real trading');
  }

  private async loadRiskParameters(): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: botSettings } = await supabase
        .from('bot_settings')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (botSettings) {
        // Override with user settings but keep conservative limits for real trading
        this.riskParams = {
          maxRiskPerTrade: Math.min(parseFloat(botSettings.max_risk_per_trade?.toString() || '1'), 2.0), // Max 2%
          maxDailyLoss: Math.min(parseFloat(botSettings.max_daily_loss?.toString() || '3'), 5.0), // Max 5%
          maxDrawdown: 15.0,
          maxPositionSize: Math.min(parseFloat(botSettings.max_risk_per_trade?.toString() || '1') * 10, 5.0), // Max 5 lots
          maxConcurrentPositions: Math.min(parseInt(botSettings.max_daily_trades?.toString() || '3'), 5), // Max 5 positions
          useStopLoss: true, // Always required for real trading
          useTakeProfit: true,
          minAccountBalance: 100,
          minMarginLevel: 200
        };
      }
      
      console.log('Risk parameters loaded for real trading:', this.riskParams);
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
      console.log('Executing REAL order on Exness:', orderRequest);

      // Ensure we're connected to real Exness account
      if (!exnessAPI.isConnectedToExness()) {
        throw new Error('Not connected to real Exness account. Please connect first.');
      }

      // Enhanced risk checks for real money trading
      const riskCheckResult = await this.performRiskChecks(orderRequest);
      if (!riskCheckResult.allowed) {
        console.error('Risk check failed:', riskCheckResult.reason);
        throw new Error(`Risk Management: ${riskCheckResult.reason}`);
      }

      // Get real-time market price before placing order
      const currentPrice = await exnessAPI.getCurrentPrice(orderRequest.symbol);
      if (!currentPrice) {
        throw new Error('Unable to get current market price');
      }

      // Calculate position size based on risk parameters and account balance
      const adjustedVolume = await this.calculatePositionSize(orderRequest);
      if (adjustedVolume <= 0) {
        throw new Error('Calculated position size is too small or invalid');
      }

      // Use current market price for market orders
      const executionPrice = orderRequest.type === 'BUY' ? currentPrice.ask : currentPrice.bid;
      
      // Enhanced order preparation with automatic stop loss if not provided
      const enhancedOrder: TradeOrder = {
        symbol: orderRequest.symbol,
        type: orderRequest.type,
        volume: adjustedVolume,
        price: executionPrice,
        stopLoss: orderRequest.stopLoss || this.calculateAutoStopLoss(executionPrice, orderRequest.type),
        takeProfit: orderRequest.takeProfit || this.calculateAutoTakeProfit(executionPrice, orderRequest.type),
        comment: orderRequest.comment || 'ForexPro-RealBot'
      };

      console.log('Placing real order with enhanced parameters:', enhancedOrder);

      // Execute order through real Exness API
      const ticket = await exnessAPI.placeOrder(enhancedOrder);
      
      if (ticket) {
        await this.logOrderExecution(enhancedOrder, ticket, 'SUCCESS');
        await this.updatePerformanceMetrics();
        console.log(`REAL order executed successfully on Exness: ${ticket}`);
        return ticket;
      } else {
        throw new Error('Real order execution failed - no ticket returned from Exness');
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('REAL order execution failed:', errorMessage);
      await this.logOrderExecution(orderRequest, null, 'FAILED', errorMessage);
      throw error;
    }
  }

  private calculateAutoStopLoss(price: number, type: 'BUY' | 'SELL'): number {
    const stopLossPips = 30; // 30 pips stop loss
    const pipValue = 0.0001; // Standard pip value
    
    if (type === 'BUY') {
      return price - (stopLossPips * pipValue);
    } else {
      return price + (stopLossPips * pipValue);
    }
  }

  private calculateAutoTakeProfit(price: number, type: 'BUY' | 'SELL'): number {
    const takeProfitPips = 60; // 60 pips take profit (2:1 ratio)
    const pipValue = 0.0001; // Standard pip value
    
    if (type === 'BUY') {
      return price + (takeProfitPips * pipValue);
    } else {
      return price - (takeProfitPips * pipValue);
    }
  }

  private async performRiskChecks(orderRequest: OrderRequest): Promise<{allowed: boolean, reason?: string}> {
    try {
      // Check if Exness is connected for real trading
      if (!exnessAPI.isConnectedToExness()) {
        return { allowed: false, reason: 'Not connected to real Exness account' };
      }

      // Get real account status from Exness
      const accountStatus = await this.getAccountStatus();
      if (!accountStatus.accountInfo) {
        return { allowed: false, reason: 'Unable to get real account information' };
      }

      // Enhanced daily loss protection for real money
      if (this.riskParams.maxDailyLoss > 0) {
        const dailyLoss = await this.getDailyLoss();
        const dailyLossPercentage = (Math.abs(dailyLoss) / accountStatus.accountInfo.balance) * 100;
        
        if (dailyLossPercentage >= this.riskParams.maxDailyLoss) {
          await this.emergencyStop(); // Auto-stop trading if daily limit reached
          return { allowed: false, reason: `Daily loss limit reached: ${dailyLossPercentage.toFixed(2)}% (max: ${this.riskParams.maxDailyLoss}%)` };
        }
      }

      // Enhanced position size validation for real trading
      const requiredMargin = await this.calculateRequiredMargin(orderRequest, accountStatus.accountInfo);
      const riskPercentage = (requiredMargin / accountStatus.accountInfo.equity) * 100; // Use equity instead of balance
      
      if (riskPercentage > this.riskParams.maxRiskPerTrade) {
        return { allowed: false, reason: `Risk per trade too high: ${riskPercentage.toFixed(2)}% (max: ${this.riskParams.maxRiskPerTrade}%)` };
      }

      // Ensure minimum account balance for trading
      if (accountStatus.accountInfo.balance < this.riskParams.minAccountBalance) {
        return { allowed: false, reason: `Account balance too low: $${accountStatus.accountInfo.balance} (min: $${this.riskParams.minAccountBalance})` };
      }

      // Check margin level - prevent margin calls
      if (accountStatus.accountInfo.marginLevel > 0 && accountStatus.accountInfo.marginLevel < this.riskParams.minMarginLevel) {
        return { allowed: false, reason: `Margin level too low: ${accountStatus.accountInfo.marginLevel}% (min: ${this.riskParams.minMarginLevel}%)` };
      }

      // Verify symbol is tradeable
      if (!await this.canTradeSymbol(orderRequest.symbol)) {
        return { allowed: false, reason: `Symbol ${orderRequest.symbol} not tradeable or market closed` };
      }

      // Enhanced margin check
      if (requiredMargin > (accountStatus.accountInfo.freeMargin * 0.8)) { // Use only 80% of free margin
        return { allowed: false, reason: `Insufficient free margin: Required ${requiredMargin.toFixed(2)}, Available ${accountStatus.accountInfo.freeMargin.toFixed(2)}` };
      }

      // Position limit check
      if (accountStatus.openPositions >= this.riskParams.maxConcurrentPositions) {
        return { allowed: false, reason: `Maximum concurrent positions reached: ${accountStatus.openPositions}/${this.riskParams.maxConcurrentPositions}` };
      }

      // Check minimum lot size
      if (orderRequest.volume < 0.01) {
        return { allowed: false, reason: 'Order volume too small (minimum: 0.01 lots)' };
      }

      // Check maximum lot size
      if (orderRequest.volume > this.riskParams.maxPositionSize) {
        return { allowed: false, reason: `Order volume too large: ${orderRequest.volume} (max: ${this.riskParams.maxPositionSize} lots)` };
      }

      console.log('All enhanced risk checks passed for real trading');
      return { allowed: true };

    } catch (error) {
      console.error('Error performing enhanced risk checks:', error);
      return { allowed: false, reason: 'Risk check failed due to system error - trading suspended for safety' };
    }
  }

  private async calculateRequiredMargin(orderRequest: OrderRequest, accountInfo: any): Promise<number> {
    try {
      // Get real-time price for accurate margin calculation
      const currentPrice = await exnessAPI.getCurrentPrice(orderRequest.symbol);
      if (!currentPrice) {
        throw new Error('Unable to get current price for margin calculation');
      }

      // Enhanced margin calculation for real trading
      const leverage = parseInt(accountInfo.leverage.split(':')[1] || '100');
      const contractSize = 100000; // Standard lot
      const priceToUse = orderRequest.type === 'BUY' ? currentPrice.ask : currentPrice.bid;
      const positionValue = orderRequest.volume * contractSize * priceToUse;
      
      const requiredMargin = positionValue / leverage;
      
      console.log('Margin calculation:', {
        symbol: orderRequest.symbol,
        volume: orderRequest.volume,
        price: priceToUse,
        leverage,
        positionValue,
        requiredMargin
      });
      
      return requiredMargin;
    } catch (error) {
      console.error('Error calculating required margin:', error);
      // Return conservative estimate
      return orderRequest.volume * 1000; // $1000 per lot conservative estimate
    }
  }
  private async calculatePositionSize(orderRequest: OrderRequest): Promise<number> {
    try {
      const accountInfo = await exnessAPI.getAccountInfo();
      if (!accountInfo) {
        throw new Error('Unable to get real account information');
      }

      // Enhanced position sizing for real money trading
      // Use equity instead of balance for more conservative approach
      const availableCapital = accountInfo.equity;
      const riskAmount = (availableCapital * this.riskParams.maxRiskPerTrade) / 100;
      
      console.log('Position sizing - Available capital:', availableCapital, 'Risk amount:', riskAmount);

      // Get real-time price for accurate calculations
      const currentPrice = await exnessAPI.getCurrentPrice(orderRequest.symbol);
      if (!currentPrice) {
        throw new Error('Unable to get current market price for position sizing');
      }

      // Calculate stop loss distance in pips
      let stopLossDistance = 30; // Default 30 pips
      if (orderRequest.stopLoss) {
        const pipValue = this.getPipValue(orderRequest.symbol);
        const priceToUse = orderRequest.type === 'BUY' ? currentPrice.ask : currentPrice.bid;
        stopLossDistance = Math.abs(priceToUse - orderRequest.stopLoss) / pipValue;
      }

      // Ensure minimum stop loss distance
      stopLossDistance = Math.max(stopLossDistance, 20); // Minimum 20 pips

      // Calculate position size based on risk management
      const pipValue = this.getPipValue(orderRequest.symbol);
      const dollarPerPip = pipValue * 100000; // Standard lot pip value
      
      // Position size = Risk Amount / (Stop Loss Distance * Dollar Per Pip)
      let positionSize = riskAmount / (stopLossDistance * dollarPerPip);

      // Apply conservative multiplier for real trading
      positionSize *= 0.5; // Use only 50% of calculated size for extra safety

      // Enhanced position size limits for real trading
      const minSize = 0.01;
      const maxSize = Math.min(
        this.riskParams.maxPositionSize, // Maximum from settings
        (accountInfo.freeMargin / 2000), // Conservative margin usage
        (availableCapital / 10000) // Max position based on capital
      );
      
      const adjustedSize = Math.max(minSize, Math.min(maxSize, positionSize));
      
      console.log('Enhanced position size calculation:', {
        availableCapital,
        riskAmount,
        stopLossDistance,
        currentPrice: currentPrice.ask,
        pipValue,
        calculatedSize: positionSize,
        adjustedSize,
        marginRequired: adjustedSize * 100000 * currentPrice.ask * 0.01 // Rough margin calculation
      });

      return parseFloat(adjustedSize.toFixed(2));

    } catch (error) {
      console.error('Error calculating position size for real trading:', error);
      return 0.01; // Return minimum size on error for safety
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
        // For now, just log performance update
        console.log('Performance metrics updated for user:', user.id);
      }
    } catch (error) {
      console.error('Failed to update performance metrics:', error);
    }
  }

  async getOpenPositions() {
    try {
      // Get positions from Exness API
      const exnessPositions = await exnessAPI.getPositions();
      
      // Sync with local database
      await this.syncPositionsWithDatabase(exnessPositions);
      
      return exnessPositions;
    } catch (error) {
      console.error('Failed to get open positions:', error);
      return [];
    }
  }

  private async syncPositionsWithDatabase(positions: any[]): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Update existing positions or create new ones
      for (const position of positions) {
        await supabase
          .from('live_trades')
          .upsert({
            user_id: user.id,
            ticket_id: position.ticketId,
            symbol: position.symbol,
            trade_type: position.type,
            lot_size: position.volume,
            entry_price: position.openPrice,
            current_price: position.currentPrice,
            profit: position.profit,
            stop_loss: position.stopLoss,
            take_profit: position.takeProfit,
            status: 'OPEN',
            opened_at: position.openTime.toISOString()
          });
      }
    } catch (error) {
      console.error('Failed to sync positions with database:', error);
    }
  }

  async closePosition(ticket: number): Promise<boolean> {
    try {
      const success = await exnessAPI.closePosition(ticket);
      
      if (success) {
        // Update local database
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await supabase
            .from('live_trades')
            .update({
              status: 'CLOSED',
              closed_at: new Date().toISOString()
            })
            .eq('ticket_id', ticket.toString())
            .eq('user_id', user.id);
        }
      }
      
      return success;
    } catch (error) {
      console.error('Failed to close position:', error);
      return false;
    }
  }

  async closeAllPositions(): Promise<void> {
    try {
      const positions = await this.getOpenPositions();
      
      const closePromises = positions.map(position => 
        this.closePosition(position.ticket)
      );
      
      const results = await Promise.allSettled(closePromises);
      
      const successCount = results.filter(result => 
        result.status === 'fulfilled' && result.value === true
      ).length;
      
      console.log(`Closed ${successCount} out of ${positions.length} positions`);
      
    } catch (error) {
      console.error('Failed to close all positions:', error);
    }
  }

  // New method to get real-time account status
  async getAccountStatus(): Promise<any> {
    try {
      const accountInfo = await exnessAPI.getAccountInfo();
      const positions = await this.getOpenPositions();
      
      return {
        accountInfo,
        openPositions: positions.length,
        totalUnrealizedPnL: positions.reduce((sum, pos) => sum + pos.profit, 0),
        isConnected: exnessAPI.isConnectedToExness(),
        connectionStatus: exnessAPI.getConnectionStatus()
      };
    } catch (error) {
      console.error('Failed to get account status:', error);
      return null;
    }
  }

  // Method to validate if we can trade a specific symbol
  async canTradeSymbol(symbol: string): Promise<boolean> {
    try {
      const price = await exnessAPI.getCurrentPrice(symbol);
      return price !== null;
    } catch (error) {
      console.error(`Cannot trade symbol ${symbol}:`, error);
      return false;
    }
  }

  async emergencyStop(): Promise<void> {
    console.log('EMERGENCY STOP ACTIVATED');
    
    try {
      // Disable auto trading
      this.setAutoTrading(false);
      
      // Close all positions
      await this.closeAllPositions();
      
      // Log emergency stop
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        console.log('Emergency stop executed for user:', user.id);
      }
    } catch (error) {
      console.error('Emergency stop failed:', error);
    }
  }
}

export const orderManager = new OrderManager();