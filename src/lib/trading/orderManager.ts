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
    maxRiskPerTrade: 2.0, // Conservative: 2% per trade for sustainable growth
    maxDailyLoss: 6.0, // Conservative: 6% daily loss limit for capital protection
    maxDrawdown: 15.0,
    maxPositionSize: 5.0, // Conservative: 5 lots maximum for risk management
    maxConcurrentPositions: 5, // Conservative: 5 positions for focused trading
    useStopLoss: true,
    useTakeProfit: true,
    minAccountBalance: 100, // Minimum $100 for safe trading
    minMarginLevel: 100, // Safe: 100% margin level for real trading
    maxLeverage: 100, // Safe: 1:100 leverage for real accounts
    emergencyStopEnabled: true
  };

  private lastOrderTime: number = 0;
  private minOrderInterval: number = 60000; // Conservative: 1 minute between orders for quality
  private dailyTradeCount: number = 0;
  private maxDailyTrades: number = 20; // Conservative: 20 high-quality trades per day

  async initialize(): Promise<void> {
    await this.loadRiskParameters();
    await this.resetDailyCounters();
    console.log('🚀 OrderManager initialized with PROFESSIONAL CONSERVATIVE parameters for profitable real trading');
    console.log('⚡ Risk settings:', {
      maxRiskPerTrade: this.riskParams.maxRiskPerTrade + '%',
      maxDailyLoss: this.riskParams.maxDailyLoss + '%',
      maxPositions: this.riskParams.maxConcurrentPositions,
      maxDailyTrades: this.maxDailyTrades,
      minOrderInterval: (this.minOrderInterval / 1000) + 's'
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
        // Override with user settings but enforce strict limits for real profitable trading
        this.riskParams = {
          maxRiskPerTrade: Math.min(parseFloat(botSettings.max_risk_per_trade?.toString() || '2'), 3.0), // Max 3% for safety
          maxDailyLoss: Math.min(parseFloat(botSettings.max_daily_loss?.toString() || '6'), 8.0), // Max 8% daily loss
          maxDrawdown: 15.0,
          maxPositionSize: Math.min(parseFloat(botSettings.max_risk_per_trade?.toString() || '2') * 2, 5.0), // Max 5 lots
          maxConcurrentPositions: Math.min(parseInt(botSettings.max_daily_trades?.toString() || '5'), 10), // Max 10 positions
          useStopLoss: true, // Always required for real trading
          useTakeProfit: true,
          minAccountBalance: 100, // Minimum $100 for real trading
          minMarginLevel: 100, // Safe 100% margin level
          maxLeverage: 100,
          emergencyStopEnabled: true
        };

        this.maxDailyTrades = Math.min(parseInt(botSettings.max_daily_trades?.toString() || '20'), 30); // Max 30 quality trades per day
      }

      console.log('Professional conservative risk parameters loaded for profitable trading:', this.riskParams);
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

      // Professional daily loss protection for capital preservation
      if (this.riskParams.maxDailyLoss > 0) {
        const dailyLoss = await this.getDailyLoss();
        const dailyLossPercentage = (Math.abs(dailyLoss) / accountStatus.accountInfo.balance) * 100;

        if (dailyLossPercentage >= this.riskParams.maxDailyLoss) {
          // Stop trading when daily loss limit is reached - capital preservation is key
          return { allowed: false, reason: `Daily loss limit reached: ${dailyLossPercentage.toFixed(2)}% (max: ${this.riskParams.maxDailyLoss}%). Trading paused for today to preserve capital.` };
        }

        // Warning at 75% of daily loss limit
        if (dailyLossPercentage >= this.riskParams.maxDailyLoss * 0.75) {
          console.warn(`⚠️ Approaching daily loss limit: ${dailyLossPercentage.toFixed(2)}% / ${this.riskParams.maxDailyLoss}%`);
        }
      }

      // Enhanced position size validation with more lenient limits
      const requiredMargin = await this.calculateRequiredMargin(orderRequest, accountStatus.accountInfo);
      const riskPercentage = (requiredMargin / accountStatus.accountInfo.balance) * 100; // Use balance for more aggressive calculation
      
      console.log(`💰 Risk calculation: Required margin ${requiredMargin.toFixed(2)}, Risk ${riskPercentage.toFixed(2)}%`);

      if (riskPercentage > this.riskParams.maxRiskPerTrade) {
        // For aggressive day trading, allow slightly higher risk
        if (riskPercentage > this.riskParams.maxRiskPerTrade * 1.2) {
          return { allowed: false, reason: `Risk per trade too high: ${riskPercentage.toFixed(2)}% (max: ${(this.riskParams.maxRiskPerTrade * 1.2).toFixed(1)}%)` };
        }
      }

      // Ensure minimum account balance for trading
      if (accountStatus.accountInfo.balance < this.riskParams.minAccountBalance) {
        return { allowed: false, reason: `Account balance too low: ${accountStatus.accountInfo.currency} ${accountStatus.accountInfo.balance} (min: $${this.riskParams.minAccountBalance})` };
      }

      // Check margin level - professional limits for account safety
      const minMarginForDemo = 50; // Professional: 50% for demo
      const minMarginForLive = 100; // Professional: 100% for live (safe margin call distance)
      const minMargin = accountStatus.accountInfo.isDemo ? minMarginForDemo : minMarginForLive;

      if (accountStatus.accountInfo.marginLevel > 0 && accountStatus.accountInfo.marginLevel < minMargin) {
        return { allowed: false, reason: `Margin level too low: ${accountStatus.accountInfo.marginLevel.toFixed(1)}% (min: ${minMargin}%). Cannot open new positions until margin improves.` };
      }

      // Verify symbol is tradeable
      if (!await this.canTradeSymbol(orderRequest.symbol)) {
        return { allowed: false, reason: `Symbol ${orderRequest.symbol} not tradeable or market closed` };
      }

      // Professional margin check - use only safe portion of free margin
      const availableMargin = accountStatus.accountInfo.freeMargin * 0.50; // Use max 50% of free margin for safety
      if (requiredMargin > availableMargin) {
        return { allowed: false, reason: `Insufficient free margin: Required ${requiredMargin.toFixed(2)}, Available ${availableMargin.toFixed(2)}` };
      }

      // Strict position limit check
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

      // Strict daily trade count check
      if (this.dailyTradeCount >= this.maxDailyTrades) {
        return { allowed: false, reason: `Daily trade limit reached: ${this.dailyTradeCount}/${this.maxDailyTrades}. Focus on quality over quantity.` };
      }

      // Strict order frequency check for quality trading
      const timeSinceLastOrder = Date.now() - this.lastOrderTime;
      if (timeSinceLastOrder < this.minOrderInterval) {
        return { allowed: false, reason: `Order frequency limit: Please wait ${Math.ceil((this.minOrderInterval - timeSinceLastOrder) / 1000)}s before next trade` };
      }

      console.log(`✅ All professional risk checks passed for ${accountType?.toUpperCase()} account - Ready for profitable trading`);
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
      const leverageString = accountInfo.leverage || '1:100';
      const leverage = parseInt(leverageString.split(':')[1] || '100');
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

      console.log('💰 Professional position sizing calculation:', {
        balance: accountInfo.balance,
        equity: accountInfo.equity,
        freeMargin: accountInfo.freeMargin,
        currency: accountInfo.currency,
        isDemo: accountInfo.isDemo
      });

      // Professional position sizing using equity for safer calculation
      const availableCapital = accountInfo.equity;
      const riskAmount = (availableCapital * this.riskParams.maxRiskPerTrade) / 100;

      console.log('📊 Professional risk calculation:', {
        availableCapital,
        riskPercentage: this.riskParams.maxRiskPerTrade,
        riskAmount
      });

      // Get real-time price for accurate calculations
      const currentPrice = await exnessAPI.getCurrentPrice(orderRequest.symbol);
      if (!currentPrice) {
        throw new Error('Unable to get current market price for position sizing');
      }

      // Calculate stop loss distance in pips - professional approach
      let stopLossDistance = 25; // Professional: 25 pips for swing trading
      if (orderRequest.stopLoss) {
        const pipValue = this.getPipValue(orderRequest.symbol);
        const priceToUse = orderRequest.type === 'BUY' ? currentPrice.ask : currentPrice.bid;
        stopLossDistance = Math.abs(priceToUse - orderRequest.stopLoss) / pipValue;
      }

      // Ensure appropriate stop loss distance for profitable trading
      stopLossDistance = Math.max(stopLossDistance, 15); // Minimum 15 pips for breathing room
      stopLossDistance = Math.min(stopLossDistance, 80); // Maximum 80 pips for risk control

      // Calculate position size based on professional risk management
      const pipValue = this.getPipValue(orderRequest.symbol);
      const dollarPerPip = pipValue * 100000; // Standard lot pip value

      // Position size = Risk Amount / (Stop Loss Distance * Dollar Per Pip)
      let positionSize = riskAmount / (stopLossDistance * dollarPerPip);

      // No aggressive multipliers - use calculated position size as-is
      // This ensures proper risk management per trade

      // Professional position size limits
      const minSize = 0.01; // Minimum 0.01 lots (micro lot)
      const maxSize = Math.min(
        this.riskParams.maxPositionSize, // Maximum from settings
        (accountInfo.freeMargin / 1000), // Conservative: use max 1/1000th of free margin
        (availableCapital / 500), // Conservative: 1/500th of capital
        accountInfo.isDemo ? 5.0 : 2.0 // Demo: up to 5 lots, Live: up to 2 lots
      );

      const adjustedSize = Math.max(minSize, Math.min(maxSize, positionSize));

      console.log('📈 Professional final position size calculation:', {
        availableCapital,
        riskAmount,
        stopLossDistance,
        currentPrice: currentPrice.ask,
        pipValue,
        calculatedSize: positionSize,
        adjustedSize,
        accountType: accountInfo.isDemo ? 'DEMO' : 'LIVE'
      });

      return parseFloat(adjustedSize.toFixed(2));

    } catch (error) {
      console.error('Error calculating optimal position size for real trading:', error);
      return 0.01; // Return minimum size on error for safety
    }
  }

  private calculateOptimalStopLoss(price: number, type: 'BUY' | 'SELL', symbol: string): number {
    // Professional stop loss calculation for sustainable trading
    const pipValue = this.getPipValue(symbol);

    // Appropriate stop loss distances for professional trading
    let stopLossPips: number;
    if (symbol.includes('JPY')) {
      stopLossPips = 40; // Professional: 40 pips for JPY pairs
    } else if (['GBPUSD', 'GBPJPY', 'EURGBP'].some(pair => symbol.includes(pair.replace('/', '')))) {
      stopLossPips = 35; // Professional: 35 pips for volatile GBP pairs
    } else if (symbol.includes('XAU')) {
      stopLossPips = 80; // Professional: 80 pips for gold (more volatile)
    } else {
      stopLossPips = 25; // Professional: 25 pips for major pairs
    }

    if (type === 'BUY') {
      return price - (stopLossPips * pipValue);
    } else {
      return price + (stopLossPips * pipValue);
    }
  }

  private calculateOptimalTakeProfit(price: number, type: 'BUY' | 'SELL', symbol: string): number {
    // Professional take profit calculation with 2.5:1 risk-reward ratio for profitable trading
    const pipValue = this.getPipValue(symbol);

    // Calculate take profit with professional risk-reward ratios
    let takeProfitPips: number;
    if (symbol.includes('JPY')) {
      takeProfitPips = 100; // Professional: 2.5:1 ratio (40 * 2.5)
    } else if (['GBPUSD', 'GBPJPY', 'EURGBP'].some(pair => symbol.includes(pair.replace('/', '')))) {
      takeProfitPips = 88; // Professional: 2.5:1 ratio (35 * 2.5)
    } else if (symbol.includes('XAU')) {
      takeProfitPips = 200; // Professional: 2.5:1 ratio for gold (80 * 2.5)
    } else {
      takeProfitPips = 63; // Professional: 2.5:1 ratio (25 * 2.5)
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
      
      // Enhanced logging for real trading
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

      // Store in database for audit trail
      // You might want to create a trading_logs table for this
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
    console.log(`🚨 ENHANCED EMERGENCY STOP ACTIVATED for ${accountType?.toUpperCase()} account`);
    
    try {
      // Disable auto trading immediately
      this.setAutoTrading(false);
      
      // Close all positions
      await this.closeAllPositions();
      
      // Temporarily reduce trading limits instead of stopping completely
      this.riskParams.maxRiskPerTrade = Math.max(1.0, this.riskParams.maxRiskPerTrade * 0.3);
      this.riskParams.maxConcurrentPositions = Math.max(1, Math.floor(this.riskParams.maxConcurrentPositions * 0.3));
      
      console.log(`📉 Emergency risk reduction: Risk per trade reduced to ${this.riskParams.maxRiskPerTrade}%, max positions to ${this.riskParams.maxConcurrentPositions}`);
      
      // Log emergency stop
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        console.log('🚨 Enhanced emergency stop executed for user:', user.id);
        
        // Update bot settings to reduce risk instead of disabling
        await supabase
          .from('bot_settings')
          .update({
            max_risk_per_trade: this.riskParams.maxRiskPerTrade,
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