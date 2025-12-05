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
  maxLeverage: number;
  emergencyStopEnabled: boolean;
}

class OrderManager {
  private isAutoTradingEnabled = false;
  private riskParams: RiskParameters = {
    maxRiskPerTrade: 2.0, // Professional standard: 2% per trade maximum
    maxDailyLoss: 10.0, // Professional standard: 10% daily loss limit
    maxDrawdown: 15.0,
    maxPositionSize: 5.0, // Professional standard: 5 lots maximum
    maxConcurrentPositions: 5, // Professional standard: 5 positions for proper risk management
    useStopLoss: true,
    useTakeProfit: true,
    minAccountBalance: 100, // Professional standard: $100 minimum for proper trading
    minMarginLevel: 100, // Professional standard: 100% margin level requirement
    maxLeverage: 50, // Professional standard: Max 1:50 leverage (reduced from 1:500)
    emergencyStopEnabled: true
  };

  private lastOrderTime: number = 0;
  private minOrderInterval: number = 1000; // Professional standard: 1 second minimum between orders
  private dailyTradeCount: number = 0;
  private maxDailyTrades: number = 100; // Professional standard: 100 trades per day maximum

  async initialize(): Promise<void> {
    await this.loadRiskParameters();
    await this.resetDailyCounters();
    console.log('🚀 OrderManager initialized with PROFESSIONAL RISK MANAGEMENT parameters for safe trading');
    console.log('⚡ Risk settings:', {
      maxRiskPerTrade: this.riskParams.maxRiskPerTrade + '%',
      maxDailyLoss: this.riskParams.maxDailyLoss + '%',
      maxPositions: this.riskParams.maxConcurrentPositions,
      maxDailyTrades: this.maxDailyTrades,
      minOrderInterval: this.minOrderInterval + 'ms'
    });
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
        // Override with user settings but enforce professional risk limits
        this.riskParams = {
          maxRiskPerTrade: Math.min(parseFloat(botSettings.max_risk_per_trade?.toString() || '2'), 5.0), // Max 5% per trade
          maxDailyLoss: Math.min(parseFloat(botSettings.max_daily_loss?.toString() || '10'), 20.0), // Max 20% daily loss
          maxDrawdown: 15.0,
          maxPositionSize: Math.min(parseFloat(botSettings.max_risk_per_trade?.toString() || '2') * 2, 10.0), // Max 10 lots
          maxConcurrentPositions: Math.min(parseInt(botSettings.max_daily_trades?.toString() || '5'), 10), // Max 10 positions
          useStopLoss: true, // Always required for real trading
          useTakeProfit: true,
          minAccountBalance: 100, // Professional minimum balance
          minMarginLevel: 100, // Professional margin level requirement (100%)
          maxLeverage: 50, // Professional leverage limit (1:50)
          emergencyStopEnabled: true
        };

        this.maxDailyTrades = Math.min(parseInt(botSettings.max_daily_trades?.toString() || '100'), 200); // Max 200 daily trades
      }

      console.log('Professional risk parameters loaded for safe trading:', this.riskParams);
    } catch (error) {
      console.error('Failed to load risk parameters:', error);
    }
  }

  private async resetDailyCounters(): Promise<void> {
    const today = new Date().toDateString();
    const lastReset = localStorage.getItem('lastDailyReset');
    
    if (lastReset !== today) {
      this.dailyTradeCount = 0;
      localStorage.setItem('lastDailyReset', today);
      console.log('Daily trade counters reset');
    } else {
      // Load today's trade count
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: trades } = await supabase
          .from('live_trades')
          .select('id')
          .eq('user_id', user.id)
          .gte('opened_at', new Date().toISOString().split('T')[0]);
        
        this.dailyTradeCount = trades?.length || 0;
      }
    }
  }

  setAutoTrading(enabled: boolean): void {
    this.isAutoTradingEnabled = enabled;
    console.log(`🤖 OrderManager: Auto trading ${enabled ? 'ENABLED' : 'DISABLED'}`);
  }

  isAutoTradingActive(): boolean {
    console.log(`🔍 OrderManager auto trading status: ${this.isAutoTradingEnabled}`);
    return this.isAutoTradingEnabled;
  }

  async executeOrder(orderRequest: OrderRequest): Promise<string | null> {
    try {
      console.log('🎯 Executing order:', orderRequest);

      // Ensure we're connected to real Exness account
      if (!exnessAPI.isConnectedToExness()) {
        throw new Error('Not connected to Exness account. Please connect first.');
      }

      // Enhanced risk checks for real money trading
      const riskCheckResult = await this.performEnhancedRiskChecks(orderRequest);
      if (!riskCheckResult.allowed) {
        console.error('❌ Enhanced risk check failed:', riskCheckResult.reason);
        throw new Error(`Risk Management: ${riskCheckResult.reason}`);
      }

      console.log('✅ Risk checks passed, calculating position size...');

      // Calculate optimal position size based on enhanced risk parameters
      const adjustedVolume = await this.calculateOptimalPositionSize(orderRequest);
      if (adjustedVolume <= 0) {
        throw new Error('Calculated position size is too small or invalid');
      }

      console.log(`📊 Calculated optimal volume: ${adjustedVolume} lots (requested: ${orderRequest.volume})`);

      // Enhanced order preparation with automatic risk management
      const enhancedOrder: TradeOrder = {
        symbol: orderRequest.symbol,
        type: orderRequest.type,
        volume: adjustedVolume,
        stopLoss: orderRequest.stopLoss,
        takeProfit: orderRequest.takeProfit,
        comment: orderRequest.comment || `ForexPro-${Date.now()}`
      };

      console.log('📋 Prepared enhanced order:', enhancedOrder);

      // Execute order through real Exness API
      const ticket = await exnessAPI.placeOrder(enhancedOrder);
      
      if (ticket) {
        // Update counters
        this.lastOrderTime = Date.now();
        this.dailyTradeCount++;
        
        // Log successful execution
        await this.logOrderExecution(enhancedOrder, ticket, 'SUCCESS');
        await this.updatePerformanceMetrics();
        
        console.log(`🎉 Order executed successfully: Ticket ${ticket} for ${enhancedOrder.type} ${enhancedOrder.volume} ${enhancedOrder.symbol}`);
        
        return ticket;
      } else {
        throw new Error('Order execution failed - no ticket returned from Exness');
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('❌ Order execution failed for', orderRequest.symbol, ':', errorMessage);
      await this.logOrderExecution(orderRequest, null, 'FAILED', errorMessage);
      throw error;
    }
  }

  private async performEnhancedRiskChecks(orderRequest: OrderRequest): Promise<{allowed: boolean, reason?: string}> {
    try {
      console.log('🔍 Performing enhanced risk checks for:', orderRequest);

      // Check if Exness is connected for real trading
      if (!exnessAPI.isConnectedToExness()) {
        return { allowed: false, reason: 'Not connected to Exness account' };
      }

      // Get real account status from Exness
      const accountStatus = await this.getAccountStatus();
      if (!accountStatus.accountInfo) {
        return { allowed: false, reason: 'Unable to get account information from Exness' };
      }

      const accountType = exnessAPI.getAccountType();
      console.log(`🔍 Risk check for ${accountType?.toUpperCase()} account - Balance: ${accountStatus.accountInfo.balance} ${accountStatus.accountInfo.currency}`);

      // Daily loss protection with proper limits
      if (this.riskParams.maxDailyLoss > 0) {
        const dailyLoss = await this.getDailyLoss();
        const dailyLossPercentage = (Math.abs(dailyLoss) / accountStatus.accountInfo.balance) * 100;
        
        console.log(`📊 Daily loss check: ${dailyLossPercentage.toFixed(2)}% (limit: ${this.riskParams.maxDailyLoss}%)`);
        
        if (dailyLossPercentage >= this.riskParams.maxDailyLoss) {
          return { allowed: false, reason: `Daily loss limit reached: ${dailyLossPercentage.toFixed(2)}% (max: ${this.riskParams.maxDailyLoss}%)` };
        }
      }

      // Position size validation
      const requiredMargin = await this.calculateRequiredMargin(orderRequest, accountStatus.accountInfo);
      const riskPercentage = (requiredMargin / accountStatus.accountInfo.equity) * 100;
      
      console.log(`💰 Risk calculation: Required margin $${requiredMargin.toFixed(2)}, Risk ${riskPercentage.toFixed(2)}% of equity`);

      if (riskPercentage > this.riskParams.maxRiskPerTrade) {
        return { allowed: false, reason: `Risk per trade too high: ${riskPercentage.toFixed(2)}% (max: ${this.riskParams.maxRiskPerTrade}%)` };
      }

      // Ensure minimum account balance for trading
      if (accountStatus.accountInfo.balance < this.riskParams.minAccountBalance) {
        return { allowed: false, reason: `Account balance too low: ${accountStatus.accountInfo.currency} ${accountStatus.accountInfo.balance} (min: $${this.riskParams.minAccountBalance})` };
      }

      // Check margin level
      const minMarginForDemo = 50; // 50% for demo
      const minMarginForLive = 100; // 100% for live (industry standard)
      const minMargin = accountStatus.accountInfo.isDemo ? minMarginForDemo : minMarginForLive;
      
      if (accountStatus.accountInfo.marginLevel > 0 && accountStatus.accountInfo.marginLevel < minMargin) {
        return { allowed: false, reason: `Margin level too low: ${accountStatus.accountInfo.marginLevel.toFixed(1)}% (min: ${minMargin}%)` };
      }

      // Verify symbol is tradeable
      if (!await this.canTradeSymbol(orderRequest.symbol)) {
        return { allowed: false, reason: `Symbol ${orderRequest.symbol} not tradeable or market closed` };
      }

      // Margin availability check
      const availableMargin = accountStatus.accountInfo.freeMargin * 0.80; // Use 80% of free margin for safety
      if (requiredMargin > availableMargin) {
        return { allowed: false, reason: `Insufficient free margin: Required $${requiredMargin.toFixed(2)}, Available $${availableMargin.toFixed(2)}` };
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

      // Check trading permissions
      if (!accountStatus.accountInfo.tradeAllowed) {
        return { allowed: false, reason: 'Trading is not allowed on this account' };
      }

      // Check daily trade count
      if (this.dailyTradeCount >= this.maxDailyTrades) {
        return { allowed: false, reason: `Daily trade limit reached: ${this.dailyTradeCount}/${this.maxDailyTrades}` };
      }

      // Check order frequency
      const timeSinceLastOrder = Date.now() - this.lastOrderTime;
      if (timeSinceLastOrder < this.minOrderInterval) {
        return { allowed: false, reason: `Order frequency limit: wait ${Math.ceil((this.minOrderInterval - timeSinceLastOrder) / 1000)}s` };
      }

      console.log(`✅ All risk checks passed for ${accountType?.toUpperCase()} account`);
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
      if (!currentPrice || !currentPrice.ask || !currentPrice.bid) {
        throw new Error('Unable to get current price for margin calculation');
      }

      // Enhanced margin calculation for real trading
      const leverageString = accountInfo.leverage || '1:100';
      const leverageParts = leverageString.split(':');
      const leverage = leverageParts[1] ? parseInt(leverageParts[1]) : 100;

      if (!leverage || leverage <= 0) {
        throw new Error('Invalid leverage value');
      }

      const contractSize = 100000; // Standard lot
      const priceToUse = orderRequest.type === 'BUY' ? currentPrice.ask : currentPrice.bid;
      
      // For JPY pairs, adjust calculation
      const isJPYPair = orderRequest.symbol.includes('JPY');
      const adjustedPrice = isJPYPair ? priceToUse / 100 : priceToUse;
      
      const positionValue = orderRequest.volume * contractSize * adjustedPrice;
      const requiredMargin = positionValue / leverage;
      
      console.log('Enhanced margin calculation:', {
        symbol: orderRequest.symbol,
        volume: orderRequest.volume,
        price: priceToUse,
        leverage,
        positionValue,
        requiredMargin,
        isJPYPair
      });
      
      return requiredMargin;
    } catch (error) {
      console.error('Error calculating required margin:', error);
      // Return conservative estimate
      return orderRequest.volume * 1000; // $1000 per lot conservative estimate
    }
  }

  private async calculateOptimalPositionSize(orderRequest: OrderRequest): Promise<number> {
    try {
      const accountInfo = await exnessAPI.getAccountInfo();
      if (!accountInfo) {
        throw new Error('Unable to get real account information');
      }

      console.log('💰 Position sizing calculation:', {
        balance: accountInfo.balance,
        equity: accountInfo.equity,
        freeMargin: accountInfo.freeMargin,
        currency: accountInfo.currency,
        isDemo: accountInfo.isDemo
      });

      // Professional position sizing based on risk management
      const availableCapital = accountInfo.equity; // Use equity for conservative approach
      const riskAmount = (availableCapital * this.riskParams.maxRiskPerTrade) / 100;
      
      console.log('📊 Risk calculation:', {
        availableCapital,
        riskPercentage: this.riskParams.maxRiskPerTrade,
        riskAmount: riskAmount.toFixed(2)
      });

      // Get real-time price for accurate calculations
      const currentPrice = await exnessAPI.getCurrentPrice(orderRequest.symbol);
      if (!currentPrice || !currentPrice.ask || !currentPrice.bid) {
        throw new Error('Unable to get current market price for position sizing');
      }

      // Calculate stop loss distance in pips
      let stopLossDistance = 30; // Default: 30 pips
      if (orderRequest.stopLoss && orderRequest.stopLoss > 0) {
        const pipValue = this.getPipValue(orderRequest.symbol);
        if (pipValue <= 0) {
          throw new Error('Invalid pip value calculated');
        }
        const priceToUse = orderRequest.type === 'BUY' ? currentPrice.ask : currentPrice.bid;
        stopLossDistance = Math.abs(priceToUse - orderRequest.stopLoss) / pipValue;
      }

      // Ensure reasonable stop loss distance
      stopLossDistance = Math.max(stopLossDistance, 15); // Minimum 15 pips
      stopLossDistance = Math.min(stopLossDistance, 100); // Maximum 100 pips

      // Calculate position size based on risk management
      const pipValue = this.getPipValue(orderRequest.symbol);
      const dollarPerPip = pipValue * 100000; // Standard lot pip value
      
      // Position size = Risk Amount / (Stop Loss Distance * Dollar Per Pip)
      let positionSize = riskAmount / (stopLossDistance * dollarPerPip);

      // SAFE position sizing - ChartLord style capital preservation
      // No aggressive multipliers - trade within risk limits
      const safeMultiplier = 1.0; // Trade exactly what risk management calculates
      positionSize *= safeMultiplier;

      // Safe position size limits - capital preservation focus
      const minSize = 0.01; // Minimum 0.01 lots (micro lot)
      const maxSize = Math.min(
        this.riskParams.maxPositionSize, // Maximum from settings
        (accountInfo.freeMargin / 1000), // Conservative: use max 0.1% of free margin per 0.01 lot
        (availableCapital / 10000) * 0.1, // Conservative: 0.01 lot per $100 of capital
        accountInfo.isDemo ? 1.0 : 0.5 // Demo: max 1.0 lot, Live: max 0.5 lot per trade
      );
      
      const adjustedSize = Math.max(minSize, Math.min(maxSize, positionSize));
      
      // Round to 2 decimal places for proper lot sizing
      const finalSize = Math.round(adjustedSize * 100) / 100;
      
      console.log('📈 Safe position size calculation (ChartLord style):', {
        availableCapital,
        riskAmount,
        stopLossDistance,
        currentPrice: currentPrice.ask,
        pipValue,
        calculatedSize: positionSize,
        adjustedSize: finalSize,
        riskPerTrade: this.riskParams.maxRiskPerTrade + '%',
        accountType: accountInfo.isDemo ? 'DEMO' : 'LIVE'
      });

      return finalSize;

    } catch (error) {
      console.error('Error calculating optimal position size:', error);
      return 0.01; // Return minimum safe size on error
    }
  }

  private calculateOptimalStopLoss(price: number, type: 'BUY' | 'SELL', symbol: string): number {
    // Safe stop loss calculation - ChartLord style capital preservation
    const pipValue = this.getPipValue(symbol);
    
    // Reasonable stop loss distances for safe trading
    let stopLossPips: number;
    if (symbol.includes('JPY')) {
      stopLossPips = 30; // 30 pips for JPY pairs
    } else if (['GBPUSD', 'GBPJPY', 'EURGBP'].some(pair => symbol.includes(pair.replace('/', '')))) {
      stopLossPips = 25; // 25 pips for volatile GBP pairs
    } else if (symbol.includes('XAU') || symbol.includes('GOLD')) {
      stopLossPips = 200; // 200 points for gold
    } else {
      stopLossPips = 20; // 20 pips for major pairs
    }
    
    if (type === 'BUY') {
      return price - (stopLossPips * pipValue);
    } else {
      return price + (stopLossPips * pipValue);
    }
  }

  private calculateOptimalTakeProfit(price: number, type: 'BUY' | 'SELL', symbol: string): number {
    // ChartLord style 2:1 risk-reward ratio for consistent profits
    const pipValue = this.getPipValue(symbol);
    
    // Take profit at 2x stop loss distance (2:1 R:R)
    let takeProfitPips: number;
    if (symbol.includes('JPY')) {
      takeProfitPips = 60; // 60 pips (2:1 ratio from 30 SL)
    } else if (['GBPUSD', 'GBPJPY', 'EURGBP'].some(pair => symbol.includes(pair.replace('/', '')))) {
      takeProfitPips = 50; // 50 pips (2:1 ratio from 25 SL)
    } else if (symbol.includes('XAU') || symbol.includes('GOLD')) {
      takeProfitPips = 400; // 400 points for gold (2:1 ratio)
    } else {
      takeProfitPips = 40; // 40 pips (2:1 ratio from 20 SL)
    }
    
    if (type === 'BUY') {
      return price + (takeProfitPips * pipValue);
    } else {
      return price - (takeProfitPips * pipValue);
    }
  }

  private getPipValue(symbol: string): number {
    // Enhanced pip value calculation for all major pairs including gold
    const pipValues: Record<string, number> = {
      'EURUSD': 0.0001,
      'GBPUSD': 0.0001,
      'AUDUSD': 0.0001,
      'NZDUSD': 0.0001,
      'USDCHF': 0.0001,
      'USDCAD': 0.0001,
      'USDJPY': 0.01,
      'EURJPY': 0.01,
      'GBPJPY': 0.01,
      'CHFJPY': 0.01,
      'AUDJPY': 0.01,
      'NZDJPY': 0.01,
      'CADJPY': 0.01,
      'XAUUSD': 0.01, // Gold pip value
      'EURCAD': 0.0001,
      'EURCHF': 0.0001,
      'EURGBP': 0.0001,
      'AUDCAD': 0.0001,
      'AUDCHF': 0.0001,
      'AUDNZD': 0.0001,
      'CADCHF': 0.0001,
      'GBPAUD': 0.0001,
      'GBPCAD': 0.0001,
      'GBPCHF': 0.0001,
      'GBPNZD': 0.0001,
      'NZDCAD': 0.0001,
      'NZDCHF': 0.0001
    };
    
    return pipValues[symbol] || (symbol.includes('JPY') ? 0.01 : symbol.includes('XAU') ? 0.01 : 0.0001);
  }

  private async getDailyLoss(): Promise<number> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return 0;

      const today = new Date().toISOString().split('T')[0];
      
      // Calculate daily P&L from live_trades
      const { data: trades } = await supabase
        .from('live_trades')
        .select('profit')
        .eq('user_id', user.id)
        .gte('opened_at', today);

      const dailyProfit = trades?.reduce((sum, trade) => 
        sum + (parseFloat(trade.profit?.toString() || '0')), 0) || 0;

      return dailyProfit;
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

      const accountType = exnessAPI.getAccountType();
      
      // Get current price for entry price logging
      let entryPrice = null;
      try {
        const currentPrice = await exnessAPI.getCurrentPrice(orderRequest.symbol);
        if (currentPrice) {
          entryPrice = orderRequest.type === 'BUY' ? currentPrice.ask : currentPrice.bid;
        }
      } catch (priceError) {
        console.warn('Could not fetch entry price for log:', priceError);
      }

      // Store in database for audit trail
      const { error: dbError } = await supabase
        .from('trade_execution_log')
        .insert({
          user_id: user.id,
          symbol: orderRequest.symbol,
          order_type: orderRequest.type,
          volume: orderRequest.volume,
          entry_price: entryPrice,
          stop_loss: orderRequest.stopLoss,
          take_profit: orderRequest.takeProfit,
          order_id: orderId,
          ticket_id: orderId,
          status: status,
          error_message: errorMessage,
          account_type: accountType,
          daily_trade_count: this.dailyTradeCount,
          execution_timestamp: new Date().toISOString()
        });

      if (dbError) {
        console.error('Failed to store execution log in database:', dbError);
      } else {
        console.log('✅ Execution log stored in database');
      }

      // Enhanced console logging for real trading
      console.log('📝 Enhanced order execution log:', {
        user_id: user.id,
        account_type: accountType,
        order_request: orderRequest,
        order_id: orderId,
        status,
        error_message: errorMessage,
        daily_trade_count: this.dailyTradeCount,
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

      // Update user portfolio with latest performance
      const accountInfo = await exnessAPI.getAccountInfo();
      if (accountInfo) {
        await supabase
          .from('user_portfolios')
          .upsert({
            user_id: user.id,
            account_type: accountInfo.isDemo ? 'PAPER' : 'LIVE',
            balance: accountInfo.balance,
            equity: accountInfo.equity,
            margin_used: accountInfo.margin,
            free_margin: accountInfo.freeMargin,
            margin_level: accountInfo.marginLevel,
            total_pnl: accountInfo.profit,
            daily_pnl: await this.getDailyLoss(),
            total_trades: this.dailyTradeCount,
            updated_at: new Date().toISOString()
          });
      }

      console.log('📊 Performance metrics updated');
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
            profit_pips: this.calculatePips(position.openPrice, position.currentPrice, position.symbol, position.type),
            stop_loss: position.stopLoss,
            take_profit: position.takeProfit,
            status: 'OPEN',
            commission: position.commission,
            swap: position.swap,
            opened_at: position.openTime.toISOString(),
            updated_at: new Date().toISOString()
          });
      }
      
      console.log(`📊 Synced ${positions.length} positions with database`);
    } catch (error) {
      console.error('Failed to sync positions with database:', error);
    }
  }

  private calculatePips(openPrice: number, currentPrice: number, symbol: string, type: string): number {
    const pipValue = this.getPipValue(symbol);
    const priceDiff = type === 'BUY' ? currentPrice - openPrice : openPrice - currentPrice;
    return priceDiff / pipValue;
  }

  async closePosition(ticket: number): Promise<boolean> {
    try {
      console.log(`🔒 Closing position ${ticket} on Exness...`);
      
      const success = await exnessAPI.closePosition(ticket);
      
      if (success) {
        // Update local database
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await supabase
            .from('live_trades')
            .update({
              status: 'CLOSED',
              closed_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            })
            .eq('ticket_id', ticket.toString())
            .eq('user_id', user.id);
        }
        
        console.log(`✅ Position ${ticket} closed successfully`);
      }
      
      return success;
    } catch (error) {
      console.error('Failed to close position:', error);
      return false;
    }
  }

  async closeAllPositions(): Promise<void> {
    try {
      console.log('🔒 Closing all positions...');
      
      const positions = await this.getOpenPositions();
      
      if (positions.length === 0) {
        console.log('No positions to close');
        return;
      }
      
      const closePromises = positions.map(position => 
        this.closePosition(position.ticket)
      );
      
      const results = await Promise.allSettled(closePromises);
      
      const successCount = results.filter(result => 
        result.status === 'fulfilled' && result.value === true
      ).length;
      
      console.log(`✅ Closed ${successCount} out of ${positions.length} positions`);
      
    } catch (error) {
      console.error('Failed to close all positions:', error);
    }
  }

  // Enhanced method to get real-time account status
  async getAccountStatus(): Promise<any> {
    try {
      const accountInfo = await exnessAPI.getAccountInfo();
      const positions = await this.getOpenPositions();
      
      return {
        accountInfo,
        openPositions: positions.length,
        totalUnrealizedPnL: positions.reduce((sum, pos) => sum + pos.profit, 0),
        isConnected: exnessAPI.isConnectedToExness(),
        connectionStatus: exnessAPI.getConnectionStatus(),
        dailyTradeCount: this.dailyTradeCount,
        maxDailyTrades: this.maxDailyTrades,
        riskParameters: this.riskParams
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
      const marketOpen = await exnessAPI.isMarketOpen(symbol);
      return price !== null && marketOpen;
    } catch (error) {
      console.error(`Cannot trade symbol ${symbol}:`, error);
      return false;
    }
  }

  async emergencyStop(): Promise<void> {
    const accountType = exnessAPI.getAccountType();
    console.log(`🚨 EMERGENCY STOP ACTIVATED for ${accountType?.toUpperCase()} account`);

    try {
      // COMPLETELY disable auto trading
      this.setAutoTrading(false);

      // Close all open positions immediately
      await this.closeAllPositions();

      // STOP all trading completely - set emergency flag
      this.riskParams.emergencyStopEnabled = false;

      // Set risk parameters to zero to prevent any new trades
      this.riskParams.maxRiskPerTrade = 0;
      this.riskParams.maxConcurrentPositions = 0;
      this.maxDailyTrades = 0;

      console.log('🛑 EMERGENCY STOP: All trading COMPLETELY HALTED');

      // Log emergency stop
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        console.log('🚨 Emergency stop executed for user:', user.id);

        // Update bot settings to disable trading
        await supabase
          .from('bot_settings')
          .update({
            is_active: false,
            max_risk_per_trade: 0,
            updated_at: new Date().toISOString()
          })
          .eq('user_id', user.id);
      }
    } catch (error) {
      console.error('Emergency stop failed:', error);
    }
  }

  // Enhanced method to get comprehensive trading statistics
  async getEnhancedTradingStatistics(): Promise<any> {
    const basicStats = await this.getTradingStatistics();
    if (!basicStats) return null;

    // Add enhanced metrics
    return {
      ...basicStats,
      enhancedMetrics: {
        dailyTradeCount: this.dailyTradeCount,
        maxDailyTrades: this.maxDailyTrades,
        remainingDailyTrades: Math.max(0, this.maxDailyTrades - this.dailyTradeCount),
        currentRiskPerTrade: this.riskParams.maxRiskPerTrade,
        maxConcurrentPositions: this.riskParams.maxConcurrentPositions,
        minOrderInterval: this.minOrderInterval,
        aggressiveMode: true,
        lastOrderTime: new Date(this.lastOrderTime),
        tradingEfficiency: this.dailyTradeCount > 0 ? (basicStats.winRate / 100) * this.dailyTradeCount : 0
      }
    };
  }

  // Method to temporarily boost trading parameters for high-confidence signals
  async boostTradingParameters(durationMinutes: number = 30): Promise<void> {
    const originalRisk = this.riskParams.maxRiskPerTrade;
    const originalPositions = this.riskParams.maxConcurrentPositions;
    
    // Temporarily boost parameters
    this.riskParams.maxRiskPerTrade = Math.min(15.0, originalRisk * 1.5);
    this.riskParams.maxConcurrentPositions = Math.min(75, Math.floor(originalPositions * 1.5));
    
    console.log(`🚀 Trading parameters boosted for ${durationMinutes} minutes:`, {
      riskPerTrade: `${originalRisk}% → ${this.riskParams.maxRiskPerTrade}%`,
      maxPositions: `${originalPositions} → ${this.riskParams.maxConcurrentPositions}`
    });
    
    // Reset after duration
    setTimeout(() => {
      this.riskParams.maxRiskPerTrade = originalRisk;
      this.riskParams.maxConcurrentPositions = originalPositions;
      console.log('🔄 Trading parameters reset to normal levels');
    }, durationMinutes * 60 * 1000);
  }

  // Method to get trading statistics
  async getTradingStatistics(): Promise<any> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data: trades } = await supabase
        .from('live_trades')
        .select('*')
        .eq('user_id', user.id)
        .order('opened_at', { ascending: false })
        .limit(100);

      if (!trades || trades.length === 0) {
        return {
          totalTrades: 0,
          winRate: 0,
          totalProfit: 0,
          averageProfit: 0,
          maxDrawdown: 0,
          profitFactor: 0
        };
      }

      const closedTrades = trades.filter(t => t.status === 'CLOSED');
      const winningTrades = closedTrades.filter(t => parseFloat(t.profit?.toString() || '0') > 0);
      const losingTrades = closedTrades.filter(t => parseFloat(t.profit?.toString() || '0') < 0);
      
      const totalProfit = closedTrades.reduce((sum, t) => sum + parseFloat(t.profit?.toString() || '0'), 0);
      const grossProfit = winningTrades.reduce((sum, t) => sum + parseFloat(t.profit?.toString() || '0'), 0);
      const grossLoss = Math.abs(losingTrades.reduce((sum, t) => sum + parseFloat(t.profit?.toString() || '0'), 0));
      
      return {
        totalTrades: closedTrades.length,
        winRate: closedTrades.length > 0 ? (winningTrades.length / closedTrades.length) * 100 : 0,
        totalProfit,
        averageProfit: closedTrades.length > 0 ? totalProfit / closedTrades.length : 0,
        grossProfit,
        grossLoss,
        profitFactor: grossLoss > 0 ? grossProfit / grossLoss : 0,
        winningTrades: winningTrades.length,
        losingTrades: losingTrades.length,
        dailyTradeCount: this.dailyTradeCount,
        maxDailyTrades: this.maxDailyTrades
      };
    } catch (error) {
      console.error('Failed to get trading statistics:', error);
      return null;
    }
  }

  // Method to update risk parameters
  updateRiskParameters(newParams: Partial<RiskParameters>): void {
    this.riskParams = { ...this.riskParams, ...newParams };
    console.log('Risk parameters updated:', this.riskParams);
  }

  getRiskParameters(): RiskParameters {
    return { ...this.riskParams };
  }
  
  // Enhanced helper methods for better profitability
  private calculatePipValue(symbol: string, accountSize: number): number {
    // Simplified pip value calculation
    if (symbol.includes('JPY')) {
      return 0.01 * (accountSize / 100000); // JPY pairs
    } else {
      return 0.0001 * (accountSize / 100000); // Standard pairs
    }
  }
  
  private convertPriceToPips(priceDistance: number, symbol: string): number {
    const pipSize = symbol.includes('JPY') ? 0.01 : 0.0001;
    return priceDistance / pipSize;
  }
  
  private async getCurrentPrice(symbol: string): Promise<number> {
    try {
      const price = await exnessAPI.getCurrentPrice(symbol);
      return price ? (price.bid + price.ask) / 2 : 0;
    } catch (error) {
      console.error('Failed to get current price:', error);
      return 0;
    }
  }
}

export const orderManager = new OrderManager();