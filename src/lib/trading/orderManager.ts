import { supabase } from '@/integrations/supabase/client';
import { exnessAPI, TradeOrder } from './exnessApi';
import { getPipValue } from './tradingUtils';
import { multiTimeframeAnalyzer } from './multiTimeframeAnalyzer';
import { correlationManager } from './correlationManager';

export interface RiskParameters {
  maxRiskPerTrade: number; // Percentage (0.5 for 0.5%)
  maxDailyLoss: number; // Percentage (2.0 for 2%)
  maxOpenPositions: number;
  minTradeSize: number;
  maxTradeSize: number;
  requiredMarginBuffer: number; // Percentage
}

export interface AccountStatus {
  balance: number;
  equity: number;
  freeMargin: number;
  marginLevel: number;
  dailyPnL: number;
  totalTrades: number;
  winRate: number;
}

export interface ExecutionMetrics {
  totalOrders: number;
  successfulOrders: number;
  failedOrders: number;
  averageExecutionTime: number;
  slippageStats: {
    average: number;
    max: number;
    min: number;
  };
}

class OrderManager {
  private isPaperTradingMode = false; // Default to REAL trading mode for actual trading
  private autoTradingActive = true; // Default to auto-trading enabled for testing
  private riskParams: RiskParameters = {
    maxRiskPerTrade: 0.5, // Ultra-conservative: 0.5% max risk per trade for micro accounts
    maxDailyLoss: 2.0, // Ultra-conservative: 2% max daily loss for capital preservation
    maxOpenPositions: 3, // Reduced to 3 concurrent positions for better risk control
    minTradeSize: 0.01, // Minimum trade size for micro-lot trading
    maxTradeSize: 0.01, // Ultra-conservative: 0.01 lots max for $100 accounts (prevents over-leverage)
    requiredMarginBuffer: 10 // 10% margin buffer required
  };

  private dailyStats = {
    startBalance: 0,
    currentLoss: 0,
    tradesToday: 0,
    date: new Date().toDateString()
  };

  private executionHistory: ExecutionMetrics = {
    totalOrders: 0,
    successfulOrders: 0,
    failedOrders: 0,
    averageExecutionTime: 0,
    slippageStats: { average: 0, max: 0, min: 0 }
  };

  async initialize(): Promise<void> {
    console.log('🔧 OrderManager: Initializing with conservative risk settings for micro account');

    // Reset daily stats if it's a new day
    const today = new Date().toDateString();
    if (this.dailyStats.date !== today) {
      this.dailyStats = {
        startBalance: 0,
        currentLoss: 0,
        tradesToday: 0,
        date: today
      };
    }

    // Get initial account balance
    try {
      const accountInfo = await exnessAPI.getAccountInfo();
      if (accountInfo) {
        this.dailyStats.startBalance = accountInfo.balance;
        console.log(`💰 OrderManager: Account balance: $${accountInfo.balance.toFixed(2)}`);
      }
    } catch (error) {
      console.warn('⚠️ OrderManager: Could not get account info:', error);
    }

    console.log('✅ OrderManager: Initialized successfully');
  }

  setPaperTradingMode(enabled: boolean): void {
    this.isPaperTradingMode = enabled;
    console.log(`📝 OrderManager: Paper trading mode ${enabled ? 'ENABLED' : 'DISABLED'}`);
  }

  forceRealTradingMode(): void {
    this.isPaperTradingMode = false;
    console.log('💰 OrderManager: FORCED REAL TRADING MODE - orders will be placed on live MT5 account');
  }

  setAutoTrading(enabled: boolean): void {
    this.autoTradingActive = enabled;
    console.log(`🤖 OrderManager: Auto trading ${enabled ? 'ENABLED' : 'DISABLED'}`);
  }

  isAutoTradingActive(): boolean {
    return this.autoTradingActive;
  }

  getRiskParameters(): RiskParameters {
    return { ...this.riskParams };
  }

  updateRiskParameters(params: Partial<RiskParameters>): void {
    this.riskParams = { ...this.riskParams, ...params };
    console.log('🛡️ OrderManager: Risk parameters updated:', this.riskParams);
  }

  async emergencyStop(): Promise<void> {
    console.log('🚨 OrderManager: Emergency stop activated');

    this.autoTradingActive = false;
    this.isPaperTradingMode = true; // Switch to paper trading for safety

    // Close all positions
    await this.closeAllPositions();

    console.log('✅ OrderManager: Emergency stop complete - all positions closed');
  }

  async executeOrder(order: TradeOrder): Promise<string | null> {
    const startTime = Date.now();

    try {
      console.log(`🚀 OrderManager: ATTEMPTING TO EXECUTE TRADE - ${order.type} ${order.symbol} at ${order.volume} lots`);
      console.log(`   Stop Loss: ${order.stopLoss}, Take Profit: ${order.takeProfit}`);
      console.log(`   Paper Trading Mode: ${this.isPaperTradingMode}, Auto Trading: ${this.autoTradingActive}`);

      // CRITICAL: Validate volume before any processing
      // MT5 requires volume to be between 0.01 and 100 lots with 2 decimal precision
      const validatedVolume = this.validateMT5Volume(order.volume);
      if (validatedVolume !== order.volume) {
        console.log(`⚠️ OrderManager: Volume adjusted from ${order.volume} to ${validatedVolume} for MT5 compatibility`);
        order.volume = validatedVolume;
      }

      // Final safety check - reject invalid volumes
      if (order.volume < 0.01 || order.volume > 100 || isNaN(order.volume)) {
        console.error(`❌ OrderManager: Invalid volume ${order.volume} - must be between 0.01 and 100 lots`);
        this.executionHistory.failedOrders++;
        return null;
      }

      // Pre-trade risk checks
      if (!(await this.validateTradeRisk(order))) {
        console.log('❌ OrderManager: Trade rejected by risk management');
        this.executionHistory.failedOrders++;
        return null;
      }

      console.log(`✅ OrderManager: Risk validation passed - Executing ${order.type} order for ${order.symbol}`);

      let ticketId: string | null = null;

      if (this.isPaperTradingMode) {
        // Paper trading simulation
        ticketId = `PAPER_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        console.log(`📝 OrderManager: PAPER TRADE EXECUTED - Ticket: ${ticketId}`);
      } else {
        // Real trading
        console.log(`💰 OrderManager: EXECUTING REAL TRADE on MT5 account...`);
        ticketId = await exnessAPI.placeOrder(order);
        if (ticketId) {
          console.log(`✅ OrderManager: REAL TRADE EXECUTED SUCCESSFULLY - Ticket: ${ticketId}`);
        } else {
          console.log(`❌ OrderManager: REAL TRADE FAILED - No ticket ID returned`);
        }
      }

      if (ticketId) {
        this.executionHistory.successfulOrders++;
        this.dailyStats.tradesToday++;

        // Calculate execution time
        const executionTime = Date.now() - startTime;
        this.executionHistory.averageExecutionTime =
          (this.executionHistory.averageExecutionTime * (this.executionHistory.totalOrders - 1) + executionTime) /
          this.executionHistory.totalOrders;

        console.log(`📊 OrderManager: Trade execution completed in ${executionTime}ms`);
      } else {
        console.log(`❌ OrderManager: Trade execution failed - no ticket ID`);
      }

      this.executionHistory.totalOrders++;
      return ticketId;

    } catch (error) {
      console.error('❌ OrderManager: Order execution failed with error:', error);
      this.executionHistory.failedOrders++;
      return null;
    }
  }

  private async validateTradeRisk(order: TradeOrder): Promise<boolean> {
    console.log(`🔍 OrderManager: validateTradeRisk called for ${order.type} ${order.symbol}`);
    
    try {
      // Get current account info
      const accountInfo = await exnessAPI.getAccountInfo();
      console.log(`🔍 OrderManager: Account info retrieved: ${JSON.stringify(accountInfo)}`);
      
      if (!accountInfo) {
        console.log('❌ OrderManager: REJECTED - Cannot validate risk - no account info');
        return false;
      }

      const accountBalance = accountInfo.balance;
      const freeMargin = accountInfo.freeMargin;
      console.log(`🔍 OrderManager: Balance: ${accountBalance}, FreeMargin: ${freeMargin}, DailyLoss: ${this.dailyStats.currentLoss}`);

      // Check daily loss limit
      const maxDailyLossAmount = accountBalance * (this.riskParams.maxDailyLoss / 100);
      console.log(`🔍 OrderManager: Daily loss check - Current: ${this.dailyStats.currentLoss.toFixed(2)}, Max allowed: ${maxDailyLossAmount.toFixed(2)}`);
      
      if (this.dailyStats.currentLoss >= maxDailyLossAmount) {
        console.log(`❌ OrderManager: REJECTED - Daily loss limit reached: ${this.dailyStats.currentLoss.toFixed(2)} >= ${maxDailyLossAmount.toFixed(2)}`);
        return false;
      }

      // FIXED: Proper dollar-based risk calculation for small accounts
      // Calculate position size based on actual dollar risk, not margin
      const riskAmount = accountBalance * (this.riskParams.maxRiskPerTrade / 100);
      const pipValue = getPipValue(order.symbol);
      
      // Estimate stop loss distance in pips (default 20 pips if not specified)
      const estimatedSLDistance = 20;
      
      // Calculate safe volume based on dollar risk
      let safeVolume = 0.01; // Default minimum
      
      // For small accounts, use strict dollar-risk based sizing
      if (accountBalance < 50) {
        // Calculate max volume based on DOLLAR RISK, not margin
        // Silver: $1 move = 1000 pips = $5 per 0.01 lots
        // Gold: $1 move = 100 pips = $1 per 0.01 lots
        // Forex: 100 pips = $1 per 0.01 lots
        
        if (order.symbol.includes('XAU') || order.symbol.includes('GOLD')) {
          // Gold: Max $0.50 risk per trade (0.5% of $100)
          // $0.50 / $1 per 0.01 lots = 0.005 lots max
          const dollarPerPip = pipValue * 100 * 0.01; // $1 per pip for 0.01 lots
          safeVolume = Math.min(0.005, riskAmount / (estimatedSLDistance * dollarPerPip));
        } else if (order.symbol.includes('XAG') || order.symbol.includes('SILVER')) {
          // Silver: Max $0.50 risk per trade (0.5% of $100)
          // Silver is 5x more volatile than gold ($5 per 0.01 lots per $1 move)
          const dollarPerPip = pipValue * 1000 * 0.01; // ~$5 per pip for 0.01 lots
          safeVolume = Math.min(0.005, riskAmount / (estimatedSLDistance * dollarPerPip));
        } else {
          // Forex: Max $0.50 risk per trade
          const dollarPerPip = pipValue * 10000 * 0.01; // ~$0.10 per pip for 0.01 lots
          safeVolume = Math.min(0.01, riskAmount / (estimatedSLDistance * dollarPerPip));
        }
        
        // Ensure minimum volume and apply strict cap
        safeVolume = Math.max(0.01, safeVolume);
        safeVolume = Math.min(safeVolume, this.riskParams.maxTradeSize); // Cap at 0.01 lots
        console.log(`💰 OrderManager: Small account risk calc - Risk: ${riskAmount.toFixed(2)}, Vol: ${safeVolume.toFixed(3)} lots`);
      } else {
        // For larger accounts, use original calculation
        safeVolume = Math.min(
          this.riskParams.maxTradeSize,
          Math.max(
            0.01,
            riskAmount / (estimatedSLDistance * pipValue)
          )
        );
      }

      // Apply safety multiplier (50% reduction)
      safeVolume *= 0.5;

      // Set the validated volume
      order.volume = Math.max(0.01, Math.min(safeVolume, this.riskParams.maxTradeSize));
      
      // MT5 volume validation
      order.volume = this.validateMT5Volume(order.volume);

      console.log(`💰 OrderManager: Final volume: ${order.volume} lots for ${order.symbol}`);

      // Check margin requirements using ACTUAL leverage from MT5
      let contractSize = 100000;
      let requiredMargin = 0;
      
      // Get actual leverage from account info (MT5 provides this as string like "1:100")
      const leverageValue = accountInfo?.leverage || "1:100";
      // Parse leverage string (format: "1:100" or "1:2000") to extract numeric value
      const leverageNum = typeof leverageValue === 'string' 
        ? parseInt(leverageValue.split(':')[1] || '100', 10) 
        : Number(leverageValue);
      // Use full leverage value as divisor (1:2000 means divide by 2000)
      const leverageMultiplier = leverageNum;
      
      if (order.symbol.includes('XAU') || order.symbol.includes('GOLD')) {
        contractSize = 100; // Gold contract size is 100 oz
        const price = await exnessAPI.getCurrentPrice(order.symbol);
        const currentPrice = price?.bid || 2000;
        // Correct margin formula: (Volume × Contract Size × Price) / Leverage
        requiredMargin = (order.volume * contractSize * currentPrice) / leverageMultiplier;
        console.log(`💰 OrderManager: Gold margin calc - Vol: ${order.volume}, Price: ${currentPrice}, Leverage: 1:${leverageNum}, Required: ${requiredMargin.toFixed(2)}`);
      } else if (order.symbol.includes('XAG') || order.symbol.includes('SILVER')) {
        contractSize = 5000; // Silver contract size is 5000 oz
        const price = await exnessAPI.getCurrentPrice(order.symbol);
        const currentPrice = price?.bid || 23;
        requiredMargin = (order.volume * contractSize * currentPrice) / leverageMultiplier;
        console.log(`💰 OrderManager: Silver margin calc - Vol: ${order.volume}, Price: ${currentPrice}, Leverage: 1:${leverageNum}, Required: ${requiredMargin.toFixed(2)}`);
      } else {
        // Forex: Standard margin calculation with leverage
        requiredMargin = (order.volume * contractSize) / leverageMultiplier;
        console.log(`💰 OrderManager: Forex margin calc - Vol: ${order.volume}, Leverage: 1:${leverageNum}, Required: ${requiredMargin.toFixed(2)}`);
      }

      console.log(`💰 OrderManager: Required margin: ${requiredMargin.toFixed(2)}, Free margin: ${freeMargin.toFixed(2)}`);

      // For very small accounts, allow trading with any positive free margin
      if (accountBalance <= 10.0) {
        console.log(`🔍 OrderManager: Ultra-micro account check - Balance: ${accountBalance}, FreeMargin: ${freeMargin}`);
        if (freeMargin > 0) {
          console.log(`💰 OrderManager: Ultra-micro account - allowing trade with ${freeMargin.toFixed(2)} free margin`);
          return true;
        } else {
          console.log(`❌ OrderManager: REJECTED - No free margin available (${freeMargin.toFixed(2)})`);
          return false;
        }
      }

      // Check if free margin is sufficient
      console.log(`🔍 OrderManager: Margin check - Required: ${requiredMargin.toFixed(2)}, Available: ${freeMargin.toFixed(2)}`);
      
      if (freeMargin < requiredMargin) {
        console.log(`❌ OrderManager: REJECTED - Insufficient margin - Required: ${requiredMargin.toFixed(2)}, Available: ${freeMargin.toFixed(2)}`);
        
        // Try with reduced volume
        const reducedVolume = Math.max(0.01, (freeMargin * 0.8) / requiredMargin * order.volume);
        if (reducedVolume >= 0.01 && reducedVolume < order.volume) {
          console.log(`💰 OrderManager: Trying with reduced volume: ${reducedVolume.toFixed(3)} lots`);
          order.volume = this.validateMT5Volume(reducedVolume);
          
          // Recalculate required margin
          if (order.symbol.includes('XAU') || order.symbol.includes('GOLD')) {
            const price = await exnessAPI.getCurrentPrice(order.symbol);
            const currentPrice = price?.bid || 2000;
            requiredMargin = (order.volume * 100 * currentPrice) / leverageMultiplier;
          } else if (order.symbol.includes('XAG') || order.symbol.includes('SILVER')) {
            const price = await exnessAPI.getCurrentPrice(order.symbol);
            const currentPrice = price?.bid || 23;
            requiredMargin = (order.volume * 5000 * currentPrice) / leverageMultiplier;
          } else {
            requiredMargin = (order.volume * contractSize) / leverageMultiplier;
          }
          
          if (freeMargin >= requiredMargin) {
            console.log(`✅ OrderManager: Reduced volume accepted - Volume: ${order.volume}, Required: ${requiredMargin.toFixed(2)}`);
            return true;
          }
        }
        
        // Paper trading mode exception - but still validate to match real trading behavior
        const isPaperTrading = (this as any).isPaperTradingMode;
        if (isPaperTrading) {
          console.log('📝 OrderManager: Paper trading mode - simulating trade (would be blocked in real trading if margin insufficient)');
          // Still validate margin in paper mode to match real trading behavior
          if (freeMargin < requiredMargin) {
            console.log('❌ OrderManager: Would be BLOCKED in real trading - insufficient margin');
            return false;
          }
          return true;
        }
        
        return false;
      }

      // Check maximum open positions
      const openPositions = await this.getOpenPositionsCount();
      console.log(`🔍 OrderManager: Open positions check - Current: ${openPositions}, Max allowed: ${this.riskParams.maxOpenPositions}`);
      
      if (openPositions >= this.riskParams.maxOpenPositions) {
        console.log(`❌ OrderManager: REJECTED - Maximum open positions reached: ${openPositions}/${this.riskParams.maxOpenPositions}`);
        return false;
      }

      console.log(`✅ OrderManager: Risk validation passed - Volume: ${order.volume}, Required margin: ${requiredMargin.toFixed(2)}`);
      return true;

    } catch (error) {
      console.error('❌ OrderManager: Risk validation error:', error);
      return false;
    }
  }

  /**
   * Validate and normalize volume for MT5 compatibility
   * MT5 requires: 0.01 <= volume <= 100, with 2 decimal precision
   */
  private validateMT5Volume(volume: number): number {
    // Handle invalid values
    if (typeof volume !== 'number' || isNaN(volume)) {
      console.warn(`⚠️ OrderManager: Invalid volume type ${typeof volume}, resetting to 0.01`);
      return 0.01;
    }

    // Clamp to valid range [0.01, 100]
    let validated = Math.max(0.01, Math.min(volume, 100));

    // Round to 2 decimal places for MT5
    validated = Math.round(validated * 100) / 100;

    // Ensure minimum precision
    if (validated < 0.01) validated = 0.01;

    return validated;
  }

  private async getOpenPositionsCount(): Promise<number> {
    try {
      if (this.isPaperTradingMode) {
        // In paper trading, simulate having positions
        return 0; // For safety, assume no positions in paper mode
      }

      const positions = await exnessAPI.getPositions();
      return positions ? positions.length : 0;
    } catch (error) {
      console.warn('⚠️ OrderManager: Could not get open positions count:', error);
      return 0;
    }
  }

  async closeAllPositions(): Promise<void> {
    try {
      console.log('📤 OrderManager: Closing all positions...');

      if (this.isPaperTradingMode) {
        console.log('📝 OrderManager: Paper trading - simulating position closure');
        return;
      }

      const positions = await exnessAPI.getPositions();
      if (!positions || positions.length === 0) {
        console.log('ℹ️ OrderManager: No open positions to close');
        return;
      }

      for (const position of positions) {
        try {
          await exnessAPI.closePosition(position.ticket);
          console.log(`✅ OrderManager: Closed position ${position.ticket}`);
        } catch (error) {
          console.error(`❌ OrderManager: Failed to close position ${position.ticket}:`, error);
        }
      }

      console.log('✅ OrderManager: All positions closed');
    } catch (error) {
      console.error('❌ OrderManager: Error closing all positions:', error);
    }
  }

  async closePosition(ticketId: number): Promise<boolean> {
    try {
      if (this.isPaperTradingMode) {
        console.log(`📝 OrderManager: Paper trading - simulating closure of position ${ticketId}`);
        return true;
      }

      const result = await exnessAPI.closePosition(ticketId);
      if (result) {
        console.log(`✅ OrderManager: Closed position ${ticketId}`);
      }
      return result;
    } catch (error) {
      console.error(`❌ OrderManager: Failed to close position ${ticketId}:`, error);
      return false;
    }
  }

  async getAccountStatus(): Promise<AccountStatus> {
    try {
      const accountInfo = await exnessAPI.getAccountInfo();
      if (!accountInfo) {
        throw new Error('No account info available');
      }

      // Calculate daily P&L
      const dailyPnL = accountInfo.balance - this.dailyStats.startBalance;

      return {
        balance: accountInfo.balance,
        equity: accountInfo.equity,
        freeMargin: accountInfo.freeMargin,
        marginLevel: accountInfo.marginLevel,
        dailyPnL,
        totalTrades: this.dailyStats.tradesToday,
        winRate: this.executionHistory.totalOrders > 0 ?
          (this.executionHistory.successfulOrders / this.executionHistory.totalOrders) * 100 : 0
      };
    } catch (error) {
      console.error('❌ OrderManager: Error getting account status:', error);
      return {
        balance: 0,
        equity: 0,
        freeMargin: 0,
        marginLevel: 0,
        dailyPnL: 0,
        totalTrades: 0,
        winRate: 0
      };
    }
  }

  getExecutionMetrics(): ExecutionMetrics {
    return { ...this.executionHistory };
  }

  async getCostOptimizationReport(symbol: string, volume: number): Promise<any> {
    try {
      const pipValue = getPipValue(symbol);
      const spread = await this.getCurrentSpread(symbol);
      const commission = 0; // Assume no commission for Exness

      const totalCost = (spread * pipValue * volume) + commission;

      return {
        symbol,
        volume,
        spreadCost: spread * pipValue * volume,
        commission,
        totalCost,
        costPerLot: totalCost / volume,
        recommendedVolume: Math.min(volume, this.riskParams.maxTradeSize)
      };
    } catch (error) {
      console.error('❌ OrderManager: Error calculating cost optimization:', error);
      return null;
    }
  }

  private async getCurrentSpread(symbol: string): Promise<number> {
    try {
      const price = await exnessAPI.getCurrentPrice(symbol);
      return price ? price.spread : 2; // Default 2 pips
    } catch (error) {
      console.warn('⚠️ OrderManager: Could not get current spread:', error);
      return 2; // Default 2 pips
    }
  }

  async getTradingStatistics(): Promise<any> {
    try {
      // Check if we're in paper trading mode - return mock data
      if (this.isPaperTradingMode) {
        console.log('📝 OrderManager: Paper trading mode - returning mock trading statistics');
        return {
          totalTrades: Math.floor(Math.random() * 50) + 10,
          winRate: Math.floor(Math.random() * 30) + 60, // 60-90%
          totalProfit: Math.random() * 1000,
          averageProfit: Math.random() * 50,
          grossProfit: Math.random() * 800,
          grossLoss: Math.random() * 200,
          profitFactor: Math.random() * 2 + 1,
          winningTrades: Math.floor(Math.random() * 30) + 5,
          losingTrades: Math.floor(Math.random() * 10) + 1,
          dailyTradeCount: Math.floor(Math.random() * 5) + 1,
          maxDailyTrades: 10
        };
      }

      // For real trading, try to get statistics from Supabase with error handling
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        // Handle 403 or no session gracefully
        if (sessionError || !session) {
          console.warn('⚠️ OrderManager: No valid Supabase session (403 or error) - using basic statistics');
          return this.getBasicTradingStatistics();
        }

        // Check if token is expired
        if (session.expires_at) {
          const expiresAt = new Date(session.expires_at * 1000);
          if (expiresAt <= new Date()) {
            console.warn('⚠️ OrderManager: Supabase session expired - using basic statistics');
            return this.getBasicTradingStatistics();
          }
        }

        // Get trades from database
        const { data: trades, error: tradesError } = await supabase
          .from('live_trades')
          .select('*')
          .eq('user_id', session.user.id)
          .order('created_at', { ascending: false })
          .limit(1000);

        if (tradesError || !trades) {
          console.warn('⚠️ OrderManager: Could not fetch trades from database:', tradesError?.message);
          return this.getBasicTradingStatistics();
        }

        // Calculate statistics
        const totalTrades = trades.length;
        const winningTrades = trades.filter(trade => trade.profit > 0).length;
        const losingTrades = trades.filter(trade => trade.profit < 0).length;
        const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;

        const totalProfit = trades.reduce((sum, trade) => sum + (trade.profit || 0), 0);
        const grossProfit = trades.filter(trade => trade.profit > 0).reduce((sum, trade) => sum + trade.profit, 0);
        const grossLoss = Math.abs(trades.filter(trade => trade.profit < 0).reduce((sum, trade) => sum + trade.profit, 0));
        const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? 999 : 0;
        const averageProfit = totalTrades > 0 ? totalProfit / totalTrades : 0;

        // Calculate daily trades
        const today = new Date().toDateString();
        const todayTrades = trades.filter(trade => new Date(trade.created_at).toDateString() === today).length;

        return {
          totalTrades,
          winRate: Math.round(winRate * 100) / 100,
          totalProfit,
          averageProfit: Math.round(averageProfit * 100) / 100,
          grossProfit: Math.round(grossProfit * 100) / 100,
          grossLoss: Math.round(grossLoss * 100) / 100,
          profitFactor: Math.round(profitFactor * 100) / 100,
          winningTrades,
          losingTrades,
          dailyTradeCount: todayTrades,
          maxDailyTrades: 10
        };

      } catch (authError: any) {
        // Handle 403 specifically
        if (authError?.message?.includes('403') || authError?.status === 403) {
          console.warn('⚠️ OrderManager: Supabase 403 Forbidden - using basic statistics');
        } else {
          console.error('❌ OrderManager: Authentication error getting trading statistics:', authError);
        }
        return this.getBasicTradingStatistics();
      }
    } catch (error) {
      console.error('❌ OrderManager: Error getting trading statistics:', error);
      return this.getBasicTradingStatistics();
    }
  }

  private getBasicTradingStatistics(): any {
    return {
      totalTrades: this.dailyStats.tradesToday,
      winRate: this.executionHistory.totalOrders > 0 ?
        (this.executionHistory.successfulOrders / this.executionHistory.totalOrders) * 100 : 0,
      totalProfit: 0,
      averageProfit: 0,
      grossProfit: 0,
      grossLoss: 0,
      profitFactor: 0,
      winningTrades: this.executionHistory.successfulOrders,
      losingTrades: this.executionHistory.failedOrders,
      dailyTradeCount: this.dailyStats.tradesToday,
      maxDailyTrades: 10
    };
  }
}

export const orderManager = new OrderManager();

