import { exnessAPI } from './exnessApi';
import { botSignalManager } from './botSignalManager';

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

  async initialize(): Promise<void> {
    console.log('🤖 Trading bot initialized');
    this.status.lastUpdate = new Date();
  }

  getStatus(): BotStatus {
    return { ...this.status };
  }

  getConfiguration(): BotConfiguration {
    return { ...this.configuration };
  }

  async startBot(): Promise<void> {
    if (!this.status.isConnected) {
      throw new Error('Please connect to Exness first');
    }
    
    // Verify Exness connection
    if (!exnessAPI.isConnectedToExness()) {
      throw new Error('Exness API not connected. Please ensure MT5 Bridge is running.');
    }

    this.status.isActive = true;
    this.status.lastUpdate = new Date();
    
    // Start signal generation
    console.log('✅ Trading bot started - activating signal generation...');
    botSignalManager.setConfiguration({ enabled: true });
    botSignalManager.startAutomaticGeneration();
  }

  async stopBot(): Promise<void> {
    this.status.isActive = false;
    this.status.autoTradingEnabled = false;
    this.status.lastUpdate = new Date();
    
    // Stop signal generation
    console.log('⏸️ Trading bot stopped - deactivating signal generation...');
    botSignalManager.stopAutomaticGeneration();
    botSignalManager.setConfiguration({ enabled: false });
  }

  async enableAutoTrading(enabled: boolean): Promise<void> {
    if (!this.status.isActive) {
      throw new Error('Bot must be started first');
    }
    
    // Verify Exness connection before enabling auto-trading
    if (enabled && !exnessAPI.isConnectedToExness()) {
      throw new Error('Cannot enable auto-trading: Not connected to Exness');
    }

    this.status.autoTradingEnabled = enabled;
    this.status.lastUpdate = new Date();
    
    // Sync auto-trading state with order manager
    const { orderManager } = await import('./orderManager');
    orderManager.setAutoTrading(enabled);
    
    // Enable/disable auto-execution in signal manager
    await botSignalManager.enableAutoExecution(enabled);
    
    console.log(`${enabled ? '🚀' : '⏸️'} Auto-trading ${enabled ? 'ENABLED - REAL TRADES WILL BE EXECUTED' : 'disabled'}`);
    
    if (enabled) {
      console.log('⚠️ WARNING: Auto-trading is now ACTIVE. Real orders will be placed on your Exness account!');
    }
  }

  async updateConfiguration(config: Partial<BotConfiguration>): Promise<void> {
    this.configuration = { ...this.configuration, ...config };
    this.status.lastUpdate = new Date();
    console.log('⚙️ Configuration updated');
  }

  async emergencyStop(reason: string): Promise<void> {
    console.error('🚨 EMERGENCY STOP:', reason);
    await this.stopBot();
    await botSignalManager.enableAutoExecution(false);
  }

  async generateTestSignal(): Promise<void> {
    console.log('🧪 Generating test signal...');
    
    // Generate signals for all configured pairs
    await botSignalManager.generateAndProcessSignals();
    
    // If auto-trading is enabled, execute immediately
    if (this.status.autoTradingEnabled) {
      console.log('🚀 Auto-trading enabled - executing pending signals...');
      await botSignalManager.forceExecutePendingSignals();
    }
  }

  async closeAllPositions(): Promise<void> {
    console.log('📤 Closing all positions via Exness API...');
    
    if (!exnessAPI.isConnectedToExness()) {
      throw new Error('Not connected to Exness');
    }

    // Close all positions through order manager
    const { orderManager } = await import('./orderManager');
    await orderManager.closeAllPositions();
    
    console.log('✅ All positions closed');
  }

  async connectToExness(credentials: any): Promise<boolean> {
    try {
      const connected = await exnessAPI.connect(credentials);
      this.updateConnectionStatus(connected);
      return connected;
    } catch (error) {
      console.error('Failed to connect to Exness:', error);
      this.updateConnectionStatus(false);
      throw error;
    }
  }

  updateConnectionStatus(connected: boolean): void {
    this.status.isConnected = connected;
    this.status.lastUpdate = new Date();
    console.log(`🔌 Bot connection status updated: ${connected ? 'CONNECTED' : 'DISCONNECTED'}`);
  }
}

export const tradingBot = new TradingBot();
