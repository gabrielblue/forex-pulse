import { supabase } from '@/integrations/supabase/client';
import { exnessAPI, ExnessCredentials } from './exnessApi';
import { orderManager } from './orderManager';
import { signalProcessor } from './signalProcessor';

export interface BotStatus {
  isActive: boolean;
  isConnected: boolean;
  autoTradingEnabled: boolean;
  lastUpdate: Date;
  totalTrades: number;
  winRate: number;
  dailyPnL: number;
  weeklyPnL: number;
}

export interface BotConfiguration {
  minConfidence: number;
  maxRiskPerTrade: number;
  maxDailyLoss: number;
  enabledPairs: string[];
  tradingHours: {
    start: string;
    end: string;
    timezone: string;
  };
  useStopLoss: boolean;
  useTakeProfit: boolean;
  emergencyStopEnabled: boolean;
}

class TradingBot {
  private status: BotStatus = {
    isActive: false,
    isConnected: false,
    autoTradingEnabled: false,
    lastUpdate: new Date(),
    totalTrades: 0,
    winRate: 0,
    dailyPnL: 0,
    weeklyPnL: 0
  };

  private configuration: BotConfiguration = {
    minConfidence: 80,
    maxRiskPerTrade: 1, // Conservative 1% for real trading
    maxDailyLoss: 3, // Conservative 3% for real trading
    enabledPairs: ['EURUSD', 'GBPUSD', 'USDJPY'],
    tradingHours: {
      start: '00:00',
      end: '23:59',
      timezone: 'UTC'
    },
    useStopLoss: true,
    useTakeProfit: true,
    emergencyStopEnabled: true
  };

  private monitoringInterval: NodeJS.Timeout | null = null;
  private isPersistent: boolean = true; // Bot continues running across page navigation
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private lastHealthCheck: Date = new Date();

  async initialize(): Promise<void> {
    try {
      await this.loadConfiguration();
      await orderManager.initialize();
      await signalProcessor.initialize();
      
      console.log('🤖 Trading bot initialized successfully with enhanced Exness integration');
    } catch (error) {
      console.error('Failed to initialize trading bot:', error);
      throw error;
    }
  }

  private async loadConfiguration(): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Load bot settings
      const { data: botSettings } = await supabase
        .from('bot_settings')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (botSettings) {
        this.configuration = {
          minConfidence: parseFloat(botSettings.min_confidence_score?.toString() || '80'),
          maxRiskPerTrade: Math.min(parseFloat(botSettings.max_risk_per_trade?.toString() || '1'), 2.0), // Cap at 2%
          maxDailyLoss: Math.min(parseFloat(botSettings.max_daily_loss?.toString() || '3'), 5.0), // Cap at 5%
          enabledPairs: botSettings.allowed_pairs || ['EURUSD', 'GBPUSD', 'USDJPY'],
          tradingHours: botSettings.trading_hours as any || {
            start: '00:00',
            end: '23:59',
            timezone: 'UTC'
          },
          useStopLoss: true, // Always true for real trading
          useTakeProfit: true, // Always true for real trading
          emergencyStopEnabled: true
        };

        this.status.isActive = botSettings.is_active || false;
      }

      // Load performance data
      await this.updatePerformanceMetrics();
      
      console.log('🔧 Bot configuration loaded:', this.configuration);
    } catch (error) {
      console.error('Failed to load bot configuration:', error);
    }
  }

  async connectToExness(credentials: ExnessCredentials): Promise<boolean> {
    try {
      console.log('🤖 Bot connecting to Exness...', {
        accountType: credentials.isDemo ? 'DEMO' : 'LIVE',
        server: credentials.server,
        accountNumber: credentials.accountNumber.substring(0, 4) + '****'
      });
      
      // Test connection first
      const testResult = await exnessAPI.testConnection(credentials);
      if (!testResult.success) {
        throw new Error(testResult.message);
      }

      console.log('✅ Connection test passed, establishing full connection...');

      // Establish full connection
      const connected = await exnessAPI.connect(credentials);
      this.status.isConnected = connected;
      
      if (connected) {
        console.log('✅ Bot successfully connected to Exness API');
        
        // Verify account information
        const accountInfo = await exnessAPI.getAccountInfo();
        if (accountInfo) {
          console.log('📊 Account Info Verified by Bot:', {
            balance: accountInfo.balance,
            equity: accountInfo.equity,
            currency: accountInfo.currency,
            leverage: accountInfo.leverage,
            accountType: accountInfo.isDemo ? 'DEMO' : 'LIVE',
            tradingAllowed: accountInfo.tradeAllowed,
            server: accountInfo.server
          });
          
          // Verify trading capabilities
          const tradingCheck = await exnessAPI.verifyTradingCapabilities();
          if (!tradingCheck.canTrade) {
            console.warn('⚠️ Trading capabilities limited:', tradingCheck.issues);
          } else {
            console.log('✅ All trading capabilities verified by bot');
          }

          // Start health monitoring
          this.startHealthMonitoring();
        }
        
        await this.updateStatus();
      }
      
      return connected;
    } catch (error) {
      console.error('❌ Bot failed to connect to Exness:', error);
      this.status.isConnected = false;
      return false;
    }
  }

  async startBot(): Promise<void> {
    if (!this.status.isConnected) {
      throw new Error('🔌 Bot must be connected to Exness API before starting. Please connect your account first.');
    }

    // Verify connection is still active
    if (!exnessAPI.isConnectedToExness()) {
      throw new Error('🔌 Lost connection to Exness. Please reconnect your account.');
    }

    // Verify trading capabilities before starting
    const tradingCheck = await exnessAPI.verifyTradingCapabilities();
    if (!tradingCheck.canTrade) {
      throw new Error(`🚫 Cannot start trading: ${tradingCheck.issues.join(', ')}`);
    }

    // Get account info to verify it's suitable for trading
    const accountInfo = await exnessAPI.getAccountInfo();
    if (!accountInfo) {
      throw new Error('🚫 Cannot get account information from Exness');
    }

    if (!accountInfo.tradeAllowed) {
      throw new Error('🚫 Trading is not allowed on this account');
    }

    if (accountInfo.balance < 100) {
      throw new Error('🚫 Account balance too low for trading (minimum: $100)');
    }

    try {
      this.status.isActive = true;
      this.status.lastUpdate = new Date();

      // Update database
      await this.saveBotSettings();

      // Start monitoring
      this.startMonitoring();

      const accountType = exnessAPI.getAccountType();
      console.log(`🚀 Trading bot started successfully on ${accountType?.toUpperCase()} account`);
      console.log(`💰 Account Balance: ${accountInfo.currency} ${accountInfo.balance.toFixed(2)}`);
      console.log(`📊 Account Equity: ${accountInfo.currency} ${accountInfo.equity.toFixed(2)}`);
      console.log(`⚖️ Leverage: ${accountInfo.leverage}`);
    } catch (error) {
      console.error('❌ Failed to start trading bot:', error);
      throw error;
    }
  }

  async stopBot(): Promise<void> {
    try {
      this.status.isActive = false;
      this.status.autoTradingEnabled = false;
      this.status.lastUpdate = new Date();

      // Stop monitoring
      if (this.monitoringInterval) {
        clearInterval(this.monitoringInterval);
        this.monitoringInterval = null;
      }

      // Stop health monitoring
      if (this.healthCheckInterval) {
        clearInterval(this.healthCheckInterval);
        this.healthCheckInterval = null;
      }

      // Disable auto trading
      orderManager.setAutoTrading(false);
      await signalProcessor.enableAutoExecution(false);

      // Update database
      await this.saveBotSettings();

      const accountType = exnessAPI.getAccountType();
      console.log(`🛑 Trading bot stopped successfully on ${accountType?.toUpperCase()} account`);
    } catch (error) {
      console.error('Failed to stop trading bot:', error);
      throw error;
    }
  }

  async enableAutoTrading(enabled: boolean): Promise<void> {
    if (enabled && !this.status.isActive) {
      throw new Error('Bot must be active to enable auto trading');
    }

    if (enabled && !exnessAPI.isConnectedToExness()) {
      throw new Error('Must be connected to Exness to enable auto trading');
    }

    // Additional safety check for live accounts
    if (enabled) {
      const accountInfo = await exnessAPI.getAccountInfo();
      if (accountInfo && !accountInfo.isDemo) {
        console.warn('⚠️ Enabling auto trading on LIVE account with real money');
      }
    }

    this.status.autoTradingEnabled = enabled;
    orderManager.setAutoTrading(enabled);
    await signalProcessor.enableAutoExecution(enabled);
    
    await this.updateStatus();
    
    const accountType = exnessAPI.getAccountType();
    console.log(`${enabled ? '🤖 Auto trading enabled' : '✋ Auto trading disabled'} on ${accountType?.toUpperCase()} account`);
  }

  private startMonitoring(): void {
    // Monitor bot status every 30 seconds
    this.monitoringInterval = setInterval(async () => {
      try {
        await this.performHealthChecks();
        await this.updatePerformanceMetrics();
        this.status.lastUpdate = new Date();
      } catch (error) {
        console.error('Bot monitoring error:', error);
      }
    }, 30000);
  }

  private startHealthMonitoring(): void {
    // Health check every 2 minutes
    this.healthCheckInterval = setInterval(async () => {
      try {
        await this.performComprehensiveHealthCheck();
        this.lastHealthCheck = new Date();
      } catch (error) {
        console.error('Health check error:', error);
      }
    }, 120000);
  }

  private async performHealthChecks(): Promise<void> {
    // Check Exness connection
    if (!exnessAPI.isConnectedToExness()) {
      console.warn('⚠️ Lost connection to Exness API');
      this.status.isConnected = false;
      await this.stopBot();
      return;
    }

    // Verify we can still get account info
    const accountInfo = await exnessAPI.getAccountInfo();
    if (!accountInfo) {
      console.warn('⚠️ Cannot fetch account information from Exness');
      this.status.isConnected = false;
      await this.stopBot();
      return;
    }

    // Verify trading capabilities
    const tradingCheck = await exnessAPI.verifyTradingCapabilities();
    if (!tradingCheck.canTrade) {
      console.warn('⚠️ Trading capabilities compromised:', tradingCheck.issues);
      if (this.status.autoTradingEnabled) {
        await this.enableAutoTrading(false);
      }
    }

    // Enhanced daily loss protection for real money
    if (this.configuration.maxDailyLoss > 0) {
      const dailyLoss = await this.getDailyLoss();
      const dailyLossPercentage = (Math.abs(dailyLoss) / accountInfo.balance) * 100;
      
      if (dailyLossPercentage >= this.configuration.maxDailyLoss) {
        console.warn(`⚠️ Daily loss limit reached: ${dailyLossPercentage.toFixed(2)}%, stopping bot`);
        await this.emergencyStop('Daily loss limit exceeded');
        return;
      }
    }

    // Check margin level
    if (accountInfo.marginLevel > 0 && accountInfo.marginLevel < 200) {
      console.warn(`⚠️ Low margin level: ${accountInfo.marginLevel.toFixed(1)}%`);
      if (accountInfo.marginLevel < 100) {
        console.error('🚨 Critical margin level, stopping auto trading');
        await this.enableAutoTrading(false);
      }
    }

    // Check trading hours
    if (!this.isWithinTradingHours()) {
      if (this.status.autoTradingEnabled) {
        console.log('🕐 Outside trading hours, disabling auto trading');
        await this.enableAutoTrading(false);
      }
      return;
    }

    // Re-enable auto trading if within hours and bot is active
    if (this.status.isActive && !this.status.autoTradingEnabled && this.isWithinTradingHours()) {
      console.log('🕐 Within trading hours, enabling auto trading');
      await this.enableAutoTrading(true);
    }
  }

  private async performComprehensiveHealthCheck(): Promise<void> {
    try {
      console.log('🏥 Performing comprehensive health check...');
      
      // Check connection status
      const connectionInfo = exnessAPI.getConnectionInfo();
      console.log('🔗 Connection Status:', connectionInfo);
      
      // Check account status
      const accountStatus = await orderManager.getAccountStatus();
      if (accountStatus) {
        console.log('💰 Account Status:', {
          balance: accountStatus.accountInfo?.balance,
          equity: accountStatus.accountInfo?.equity,
          openPositions: accountStatus.openPositions,
          dailyTrades: accountStatus.dailyTradeCount
        });
      }
      
      // Check trading statistics
      const tradingStats = await orderManager.getTradingStatistics();
      if (tradingStats) {
        console.log('📊 Trading Stats:', {
          totalTrades: tradingStats.totalTrades,
          winRate: tradingStats.winRate.toFixed(1) + '%',
          profitFactor: tradingStats.profitFactor.toFixed(2)
        });
      }
      
      // Test market data access
      const testPrice = await exnessAPI.getCurrentPrice('EURUSD');
      if (!testPrice) {
        console.warn('⚠️ Cannot access market data for EURUSD');
      }
      
      console.log('✅ Comprehensive health check completed');
    } catch (error) {
      console.error('❌ Comprehensive health check failed:', error);
    }
  }

  private isWithinTradingHours(): boolean {
    const now = new Date();
    const currentTime = now.toTimeString().slice(0, 5); // HH:MM format
    
    // Check if it's weekend (Forex market is closed)
    const dayOfWeek = now.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) { // Sunday or Saturday
      return false;
    }
    
    return currentTime >= this.configuration.tradingHours.start && 
           currentTime <= this.configuration.tradingHours.end;
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

  private async updatePerformanceMetrics(): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get performance data from trading statistics
      const tradingStats = await orderManager.getTradingStatistics();
      if (tradingStats) {
        this.status.totalTrades = tradingStats.totalTrades;
        this.status.winRate = tradingStats.winRate;
        this.status.dailyPnL = await this.getDailyLoss();
        
        // Calculate weekly P&L
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        
        const { data: weeklyTrades } = await supabase
          .from('live_trades')
          .select('profit')
          .eq('user_id', user.id)
          .gte('opened_at', weekAgo.toISOString());

        this.status.weeklyPnL = weeklyTrades?.reduce((sum, trade) => 
          sum + (parseFloat(trade.profit?.toString() || '0')), 0) || 0;
      }
    } catch (error) {
      console.error('Failed to update performance metrics:', error);
    }
  }

  async emergencyStop(reason: string): Promise<void> {
    const accountType = exnessAPI.getAccountType();
    console.log(`🚨 EMERGENCY STOP ACTIVATED on ${accountType?.toUpperCase()} account: ${reason}`);
    
    try {
      // Stop the bot immediately
      await this.stopBot();
      
      // Execute emergency stop on order manager
      await orderManager.emergencyStop();
      
      // Log emergency stop with detailed information
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const accountInfo = await exnessAPI.getAccountInfo();
        console.log(`🚨 Emergency stop executed for user ${user.id}:`, {
          reason,
          accountType: accountType?.toUpperCase(),
          accountBalance: accountInfo?.balance,
          accountEquity: accountInfo?.equity,
          timestamp: new Date().toISOString()
        });
      }
      
    } catch (error) {
      console.error('❌ Emergency stop failed:', error);
    }
  }

  private async saveBotSettings(): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await supabase
        .from('bot_settings')
        .upsert({
          user_id: user.id,
          is_active: this.status.isActive,
          min_confidence_score: this.configuration.minConfidence,
          max_risk_per_trade: this.configuration.maxRiskPerTrade,
          max_daily_loss: this.configuration.maxDailyLoss,
          allowed_pairs: this.configuration.enabledPairs,
          trading_hours: this.configuration.tradingHours,
          updated_at: new Date().toISOString()
        });
    } catch (error) {
      console.error('Failed to save bot settings:', error);
    }
  }

  private async updateStatus(): Promise<void> {
    this.status.lastUpdate = new Date();
    this.status.isConnected = exnessAPI.isConnectedToExness();
  }

  getStatus(): BotStatus {
    return { ...this.status };
  }

  getConfiguration(): BotConfiguration {
    return { ...this.configuration };
  }

  async updateConfiguration(config: Partial<BotConfiguration>): Promise<void> {
    // Apply conservative limits for real trading
    const safeConfig = {
      ...config,
      maxRiskPerTrade: config.maxRiskPerTrade ? Math.min(config.maxRiskPerTrade, 2.0) : undefined,
      maxDailyLoss: config.maxDailyLoss ? Math.min(config.maxDailyLoss, 5.0) : undefined,
      useStopLoss: true, // Always enforce stop loss
      useTakeProfit: true, // Always enforce take profit
      emergencyStopEnabled: true // Always keep emergency stop enabled
    };

    this.configuration = { ...this.configuration, ...safeConfig };
    
    // Update signal processor configuration
    signalProcessor.setConfiguration({
      minConfidence: this.configuration.minConfidence,
      enabledPairs: this.configuration.enabledPairs,
      autoExecute: this.status.autoTradingEnabled
    });

    // Update order manager risk parameters
    orderManager.updateRiskParameters({
      maxRiskPerTrade: this.configuration.maxRiskPerTrade,
      maxDailyLoss: this.configuration.maxDailyLoss,
      useStopLoss: this.configuration.useStopLoss,
      useTakeProfit: this.configuration.useTakeProfit,
      emergencyStopEnabled: this.configuration.emergencyStopEnabled
    });

    await this.saveBotSettings();
    console.log('🔧 Bot configuration updated with safety limits:', this.configuration);
  }

  async generateTestSignal(): Promise<void> {
    const accountType = exnessAPI.getAccountType();
    console.log(`🧪 Generating test signal for ${accountType?.toUpperCase()} account...`);
    
    if (!this.status.isConnected) {
      throw new Error('Must be connected to Exness to generate test signals');
    }
    
    const randomPair = this.configuration.enabledPairs[
      Math.floor(Math.random() * this.configuration.enabledPairs.length)
    ];
    
    await signalProcessor.generateTestSignal(randomPair);
    
    console.log(`✅ Test signal generated for ${randomPair} on ${accountType?.toUpperCase()} account`);
  }

  async getRecentTrades(limit: number = 10) {
    try {
      // Get both open positions and recent closed trades
      const openPositions = await orderManager.getOpenPositions();
      
      // Get recent closed trades from database
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return { openPositions, recentClosedTrades: [] };

      const { data: closedTrades } = await supabase
        .from('live_trades')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'CLOSED')
        .order('closed_at', { ascending: false })
        .limit(limit);

      return {
        openPositions,
        recentClosedTrades: closedTrades || []
      };
    } catch (error) {
      console.error('Failed to get recent trades:', error);
      return { openPositions: [], recentClosedTrades: [] };
    }
  }

  async closeAllPositions(): Promise<void> {
    const accountType = exnessAPI.getAccountType();
    console.log(`🔒 Closing all positions on ${accountType?.toUpperCase()} account...`);
    
    await orderManager.closeAllPositions();
    
    console.log(`✅ All positions closed on ${accountType?.toUpperCase()} account`);
  }

  // Enhanced method to get comprehensive trading status
  async getTradingStatus(): Promise<any> {
    try {
      const accountStatus = await orderManager.getAccountStatus();
      const recentTrades = await this.getRecentTrades(5);
      const connectionInfo = exnessAPI.getConnectionInfo();
      const tradingStats = await orderManager.getTradingStatistics();
      
      return {
        ...accountStatus,
        botStatus: this.status,
        configuration: this.configuration,
        recentTrades,
        connectionInfo,
        tradingStats,
        lastHealthCheck: this.lastHealthCheck,
        systemHealth: {
          exnessConnected: exnessAPI.isConnectedToExness(),
          botActive: this.status.isActive,
          autoTradingEnabled: this.status.autoTradingEnabled,
          tradingAllowed: accountStatus?.accountInfo?.tradeAllowed || false
        }
      };
    } catch (error) {
      console.error('Failed to get comprehensive trading status:', error);
      return null;
    }
  }

  // Method to perform a manual trade (for testing)
  async executeManualTrade(symbol: string, type: 'BUY' | 'SELL', volume: number): Promise<string | null> {
    try {
      if (!this.status.isConnected) {
        throw new Error('Not connected to Exness');
      }

      const accountType = exnessAPI.getAccountType();
      console.log(`📋 Executing manual ${type} trade for ${symbol} on ${accountType?.toUpperCase()} account`);

      const orderRequest = {
        symbol,
        type,
        volume,
        comment: `Manual-${accountType?.toUpperCase()}-${Date.now()}`
      };

      const ticket = await orderManager.executeOrder(orderRequest);
      
      if (ticket) {
        console.log(`✅ Manual trade executed successfully: ${ticket}`);
        await this.updatePerformanceMetrics();
      }
      
      return ticket;
    } catch (error) {
      console.error('❌ Manual trade execution failed:', error);
      throw error;
    }
  }

  // Method to get bot health status
  getBotHealth(): any {
    return {
      isConnected: this.status.isConnected,
      isActive: this.status.isActive,
      autoTradingEnabled: this.status.autoTradingEnabled,
      lastUpdate: this.status.lastUpdate,
      lastHealthCheck: this.lastHealthCheck,
      exnessConnectionStatus: exnessAPI.getConnectionStatus(),
      accountType: exnessAPI.getAccountType(),
      monitoringActive: this.monitoringInterval !== null,
      healthMonitoringActive: this.healthCheckInterval !== null
    };
  }
}

export const tradingBot = new TradingBot();