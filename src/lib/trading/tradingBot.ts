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
    this.status.isActive = true;
    this.status.lastUpdate = new Date();
    console.log('✅ Trading bot started');
  }

  async stopBot(): Promise<void> {
    this.status.isActive = false;
    this.status.autoTradingEnabled = false;
    this.status.lastUpdate = new Date();
    console.log('⏸️ Trading bot stopped');
  }

  async enableAutoTrading(enabled: boolean): Promise<void> {
    if (!this.status.isActive) {
      throw new Error('Bot must be started first');
    }
    this.status.autoTradingEnabled = enabled;
    this.status.lastUpdate = new Date();
    console.log(`${enabled ? '🚀' : '⏸️'} Auto-trading ${enabled ? 'enabled' : 'disabled'}`);
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
    await botSignalManager.generateAndProcessSignals();
  }

  async closeAllPositions(): Promise<void> {
    console.log('📤 Closing all positions...');
    // Implementation would close all open positions via Exness API
  }

  updateConnectionStatus(connected: boolean): void {
    this.status.isConnected = connected;
    this.status.lastUpdate = new Date();
  }
}

export const tradingBot = new TradingBot();
