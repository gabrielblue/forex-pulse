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
    maxRiskPerTrade: 2,
    maxDailyLoss: 5,
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

  async initialize(): Promise<void> {
    try {
      await this.loadConfiguration();
      await orderManager.initialize();
      await signalProcessor.initialize();
      
      console.log('Trading bot initialized successfully');
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
          maxRiskPerTrade: parseFloat(botSettings.max_risk_per_trade?.toString() || '2'),
          maxDailyLoss: parseFloat(botSettings.max_daily_loss?.toString() || '5'),
          enabledPairs: botSettings.allowed_pairs || ['EURUSD', 'GBPUSD', 'USDJPY'],
          tradingHours: botSettings.trading_hours as any || {
            start: '00:00',
            end: '23:59',
            timezone: 'UTC'
          },
          useStopLoss: botSettings.stop_loss_pips ? true : false,
          useTakeProfit: botSettings.take_profit_pips ? true : false,
          emergencyStopEnabled: true
        };

        this.status.isActive = botSettings.is_active || false;
      }

      // Load performance data
      await this.updatePerformanceMetrics();
    } catch (error) {
      console.error('Failed to load bot configuration:', error);
    }
  }

  async connectToExness(credentials: ExnessCredentials): Promise<boolean> {
    try {
      const connected = await exnessAPI.connect(credentials);
      this.status.isConnected = connected;
      
      if (connected) {
        console.log('Successfully connected to Exness');
        await this.updateStatus();
      }
      
      return connected;
    } catch (error) {
      console.error('Failed to connect to Exness:', error);
      this.status.isConnected = false;
      return false;
    }
  }

  async startBot(): Promise<void> {
    if (!this.status.isConnected) {
      throw new Error('Bot must be connected to Exness before starting');
    }

    try {
      this.status.isActive = true;
      this.status.lastUpdate = new Date();

      // Update database
      await this.saveBotSettings();

      // Start monitoring
      this.startMonitoring();

      console.log('Trading bot started successfully');
    } catch (error) {
      console.error('Failed to start trading bot:', error);
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

      // Disable auto trading
      orderManager.setAutoTrading(false);
      await signalProcessor.enableAutoExecution(false);

      // Update database
      await this.saveBotSettings();

      console.log('Trading bot stopped successfully');
    } catch (error) {
      console.error('Failed to stop trading bot:', error);
      throw error;
    }
  }

  async enableAutoTrading(enabled: boolean): Promise<void> {
    if (enabled && !this.status.isActive) {
      throw new Error('Bot must be active to enable auto trading');
    }

    this.status.autoTradingEnabled = enabled;
    orderManager.setAutoTrading(enabled);
    await signalProcessor.enableAutoExecution(enabled);
    
    await this.updateStatus();
    console.log(`Auto trading ${enabled ? 'enabled' : 'disabled'}`);
  }

  private startMonitoring(): void {
    // Monitor bot status every minute
    this.monitoringInterval = setInterval(async () => {
      try {
        await this.performHealthChecks();
        await this.updatePerformanceMetrics();
        this.status.lastUpdate = new Date();
      } catch (error) {
        console.error('Bot monitoring error:', error);
      }
    }, 60000);
  }

  private async performHealthChecks(): Promise<void> {
    // Check Exness connection
    if (!exnessAPI.isConnectedToExness()) {
      console.warn('Lost connection to Exness');
      this.status.isConnected = false;
      await this.stopBot();
      return;
    }

    // Check daily loss limits
    const dailyLoss = await this.getDailyLoss();
    const accountInfo = await exnessAPI.getAccountInfo();
    
    if (accountInfo && Math.abs(dailyLoss) > (accountInfo.balance * this.configuration.maxDailyLoss / 100)) {
      console.warn('Daily loss limit exceeded, stopping bot');
      await this.emergencyStop('Daily loss limit exceeded');
      return;
    }

    // Check trading hours
    if (!this.isWithinTradingHours()) {
      if (this.status.autoTradingEnabled) {
        console.log('Outside trading hours, disabling auto trading');
        await this.enableAutoTrading(false);
      }
      return;
    }

    // Re-enable auto trading if within hours and bot is active
    if (this.status.isActive && !this.status.autoTradingEnabled && this.isWithinTradingHours()) {
      console.log('Within trading hours, enabling auto trading');
      await this.enableAutoTrading(true);
    }
  }

  private isWithinTradingHours(): boolean {
    const now = new Date();
    const currentTime = now.toTimeString().slice(0, 5); // HH:MM format
    
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

      // Get performance data from user_portfolios
      const { data: portfolio } = await supabase
        .from('user_portfolios')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (portfolio) {
        this.status.totalTrades = portfolio.total_trades || 0;
        this.status.winRate = parseFloat(portfolio.win_rate?.toString() || '0');
        this.status.dailyPnL = parseFloat(portfolio.daily_pnl?.toString() || '0');
        this.status.weeklyPnL = parseFloat(portfolio.total_pnl?.toString() || '0');
      }
    } catch (error) {
      console.error('Failed to update performance metrics:', error);
    }
  }

  async emergencyStop(reason: string): Promise<void> {
    console.log(`EMERGENCY STOP ACTIVATED: ${reason}`);
    
    try {
      // Stop the bot
      await this.stopBot();
      
      // Execute emergency stop on order manager
      await orderManager.emergencyStop();
      
      // Log emergency stop
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        console.log(`Emergency stop executed for user ${user.id}: ${reason}`);
      }
      
    } catch (error) {
      console.error('Emergency stop failed:', error);
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
    // Additional status update logic can be added here
  }

  getStatus(): BotStatus {
    return { ...this.status };
  }

  getConfiguration(): BotConfiguration {
    return { ...this.configuration };
  }

  async updateConfiguration(config: Partial<BotConfiguration>): Promise<void> {
    this.configuration = { ...this.configuration, ...config };
    
    // Update signal processor configuration
    signalProcessor.setConfiguration({
      minConfidence: this.configuration.minConfidence,
      enabledPairs: this.configuration.enabledPairs,
      autoExecute: this.status.autoTradingEnabled
    });

    await this.saveBotSettings();
  }

  async generateTestSignal(): Promise<void> {
    const randomPair = this.configuration.enabledPairs[
      Math.floor(Math.random() * this.configuration.enabledPairs.length)
    ];
    await signalProcessor.generateTestSignal(randomPair);
  }

  async getRecentTrades(limit: number = 10) {
    return await orderManager.getOpenPositions();
  }

  async closeAllPositions(): Promise<void> {
    await orderManager.closeAllPositions();
  }
}

export const tradingBot = new TradingBot();