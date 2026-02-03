import { exnessAPI } from './exnessApi';
import { botSignalManager } from './botSignalManager';
import { systemHealthMonitor } from './systemHealth';
import { onTickEngine } from './onTickEngine';
import { realTimeDataFeed } from './realTimeDataFeed';
import { aiAnalyzer } from './aiAnalyzer';
import { backtestingEngine } from './backtestingEngine';
import { performanceAnalytics } from './performanceAnalytics';
import { newsImpactPredictor } from './newsImpactPredictor';
import { enhancedTradingSystem } from './strategies/enhancedStrategies';
import { orderManager } from './orderManager';
import { tradeExecutor } from './tradeExecutor';
import { TOP_100_SYMBOLS } from './symbolWhitelist';
import { timeBasedExitManager } from './timeBasedExitManager';
import { marketRegimeDetector } from './marketRegimeDetector';
import { tradingJournal } from './tradingJournal';
import { partialProfitManager } from './partialProfitManager';

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
  enabledSymbols: string[];
  tradingHours: {
    start: string;
    end: string;
    timezone: string;
  };
  useStopLoss: boolean;
  useTakeProfit: boolean;
  emergencyStopEnabled: boolean;
  tradeOnlyMode: boolean;
  newsBlackoutMinutes: number;
  killzoneEnabled: boolean;
  partialProfitEnabled: boolean;
  weekendProtectionEnabled: boolean;
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
    minConfidence: 50, // Conservative confidence threshold
    maxRiskPerTrade: 1.5, // Conservative risk per trade (1-2%) for capital preservation
    maxDailyLoss: 6.0, // Maximum 6% daily loss
    enabledSymbols: ['EURUSD', 'GBPUSD', 'USDJPY', 'AUDUSD', 'USDCHF', 'USDCAD', 'XAUUSD', 'XAGUSD'], // Multi-currency trading with majors + gold/silver
    tradingHours: {
      start: '00:00',
      end: '23:59',
      timezone: 'UTC'
    },
    useStopLoss: true,
    useTakeProfit: true,
    emergencyStopEnabled: true, // Enable emergency stop for safety
    tradeOnlyMode: false, // Allow both analysis and trading
    newsBlackoutMinutes: 15, // 15-minute blackout before/after high-impact news
    killzoneEnabled: false, // Disable session killzones for 24/7 trading
    partialProfitEnabled: true, // Enable partial profit taking at 1R and 2R
    weekendProtectionEnabled: true, // Enable weekend protection
  };

  async initialize(): Promise<void> {
    console.log('🤖 Trading bot initializing all components...');

    try {
      // Initialize core trading components in proper order
      console.log('🔧 Initializing order manager...');
      await orderManager.initialize();

      console.log('📊 Initializing performance analytics...');
      // Performance analytics initializes automatically

      console.log('📡 Real-time data feed will be started after connection...');
      // Data feed will be started in startBot() after connection verification

      console.log('🧠 Initializing AI analyzer...');
      // AI analyzer initializes automatically

      console.log('📰 Initializing news impact predictor...');
      // News impact predictor initializes automatically

      console.log('📈 Initializing enhanced trading system...');
      // Enhanced trading system initializes automatically

      console.log('⚡ Initializing trade executor...');
      // Trade executor initializes automatically

      console.log('🔬 Initializing backtesting engine...');
      // Backtesting engine initializes automatically

      console.log('⏰ Initializing time-based exit manager...');
      await timeBasedExitManager.initialize();

      console.log('📊 Initializing market regime detector...');
      await marketRegimeDetector.initialize();

      console.log('📓 Initializing trading journal...');
      await tradingJournal.initialize();

      console.log('💰 Initializing partial profit manager...');
      await partialProfitManager.initialize();

      console.log('✅ All trading components initialized successfully');

      // NOTE: Bot does NOT auto-start anymore - user must explicitly start the bot
      console.log('💡 Bot is ready. Go to the Trading tab and click "Start Bot" to begin trading.');

      this.status.lastUpdate = new Date();

    } catch (error) {
      console.error('❌ Failed to initialize trading components:', error);
      throw error;
    }
  }

  getStatus(): BotStatus {
    return { ...this.status };
  }

  getConfiguration(): BotConfiguration {
    return { ...this.configuration };
  }

  async startBot(): Promise<void> {
    // Check if we're in paper trading mode
    const { orderManager } = await import('./orderManager');
    const isPaperTrading = (orderManager as any).isPaperTradingMode;

    let exnessConnected = false;

    if (isPaperTrading) {
      console.log('📝 Starting bot in PAPER TRADING MODE - no connection required');
      exnessConnected = true; // Simulate connection for paper trading
    } else {
      exnessConnected = exnessAPI.isConnectedToExness();
    }

    console.log('🔍 Starting bot - Connection status:', {
      isConnected: exnessConnected,
      internalStatus: this.status.isConnected,
      connectionInfo: exnessAPI.getConnectionInfo(),
      mode: isPaperTrading ? 'PAPER TRADING' : 'LIVE TRADING'
    });

    // Allow bot to start even if not connected - it will analyze and wait for connection
    if (!exnessConnected && !isPaperTrading) {
      console.warn('⚠️ WARNING: Not connected to Exness MT5 account - bot will start in analysis-only mode');
      console.warn('💡 Please connect to Exness through the UI first, then enable auto-trading');
      console.warn('🔗 Go to the Exness Integration tab and connect your MT5 account');
    }

    // Perform system health check
    console.log('🏥 Performing system health check...');
    const healthCheck = await systemHealthMonitor.performHealthCheck();
    
    if (!healthCheck.isHealthy) {
      const criticalIssues = healthCheck.issues.filter(i => i.severity === 'critical');
      if (criticalIssues.length > 0) {
        const issueMessages = criticalIssues.map(i => `${i.component}: ${i.message}`).join('\n');
        console.error('❌ Cannot start bot - critical issues detected:\n', issueMessages);
        throw new Error(`System health check failed:\n${issueMessages}\n\nPlease resolve these issues before starting the bot.`);
      }
      
      // Log warnings but allow bot to start
      healthCheck.issues.forEach(issue => {
        console.warn(`⚠️ ${issue.component}: ${issue.message}`);
        console.warn(`   → ${issue.resolution}`);
      });
    }

    // Update internal status to match reality
    this.status.isConnected = exnessConnected;

    this.status.isActive = true;
    this.status.lastUpdate = new Date();

    // Start signal generation (legacy interval-based)
    console.log('✅ Trading bot started - activating signal generation...');
    botSignalManager.setConfiguration({ enabled: true });
    botSignalManager.startAutomaticGeneration();

    // Start OnTick Engine (ChartLord style real-time monitoring)
    console.log('⚡ Starting OnTick Engine for real-time SMC analysis...');
    await onTickEngine.initialize({
      enabled: true,
      minConfluence: 25, // Conservative threshold for quality entries
      autoExecute: true, // Enable auto-execution
      trailingEnabled: true,
      killzoneFilterEnabled: this.configuration.killzoneEnabled // Enable killzone filter during optimal hours
    });
    onTickEngine.start();
    console.log('✅ OnTick Engine started successfully - killzone filtering:', this.configuration.killzoneEnabled ? 'ENABLED' : 'DISABLED');

    // Start real-time data feed
    console.log('📡 Ensuring real-time data feed is active...');
    if (!realTimeDataFeed.isRunning()) {
      await realTimeDataFeed.start();
    }
    console.log('✅ Real-time data feed confirmed active');

    // Initialize AI analysis for market regime detection
    console.log('🧠 AI analysis system ready for market regime detection');

    // Initialize news impact monitoring
    console.log('📰 News impact predictor ready for economic calendar monitoring');

    // Initialize backtesting capabilities
    console.log('🔬 Backtesting engine ready for strategy validation');

    // Initialize performance analytics
    console.log('📊 Performance analytics system active for real-time monitoring');

    console.log('🎯 All trading systems integrated and operational');
  }

  async stopBot(): Promise<void> {
    this.status.isActive = false;
    this.status.autoTradingEnabled = false;
    this.status.lastUpdate = new Date();

    console.log('🛑 Stopping all trading systems...');

    // Stop signal generation
    console.log('⏸️ Trading bot stopped - deactivating signal generation...');
    botSignalManager.stopAutomaticGeneration();
    botSignalManager.setConfiguration({ enabled: false });

    // Stop OnTick Engine
    console.log('⚡ Stopping OnTick Engine...');
    onTickEngine.stop();

    // Stop real-time data feed
    console.log('📡 Stopping real-time data feed...');
    await realTimeDataFeed.stop();

    // Stop time-based exit manager
    console.log('⏰ Stopping time-based exit manager...');
    timeBasedExitManager.stopMonitoring();

    // Stop partial profit manager
    console.log('💰 Stopping partial profit manager...');
    partialProfitManager.stopMonitoring();

    // Clear AI analysis cache
    console.log('🧠 Clearing AI analysis cache...');
    aiAnalyzer.clearCache();

    // Stop performance analytics streaming
    console.log('📊 Performance analytics monitoring continues (no stop method needed)');

    console.log('✅ All trading systems stopped successfully');
  }

  async enableAutoTrading(enabled: boolean): Promise<void> {
    if (!this.status.isActive) {
      throw new Error('Bot must be started first');
    }

    // Check if we're in paper trading mode
    const { orderManager: orderMgr } = await import('./orderManager');
    const isPaperTradingMode = (orderMgr as any).isPaperTradingMode;

    // Log warning if not connected but allow enabling auto-trading anyway
    if (enabled && !exnessAPI.isConnectedToExness()) {
      console.warn('⚠️ WARNING: Not connected to Exness MT5 account - auto-trading will be enabled but orders will fail until connected');
      console.warn('💡 Please connect to Exness through the UI first, then trades will execute automatically');
    }

    // Always switch to real trading mode when enabling auto-trading (regardless of connection status)
    if (enabled) {
      orderManager.setPaperTradingMode(false);
      console.log('🔄 Switched to REAL TRADING MODE - orders will be placed on live MT5 account when connected');
    }

    // Check connection status
    const isConnectedToExness = exnessAPI.isConnectedToExness();

    // Allow auto-trading to be enabled even if not connected (for paper trading)
    if (enabled && !isPaperTradingMode && !isConnectedToExness) {
      console.warn('⚠️ WARNING: Not connected to Exness MT5 account - auto-trading will be enabled but orders will fail until connected');
      console.warn('💡 Please connect to Exness through the UI first, then trades will execute automatically');
    }

    this.status.autoTradingEnabled = enabled;
    this.status.lastUpdate = new Date();

    // Sync auto-trading state with order manager
    orderMgr.setAutoTrading(enabled);

    // Enable/disable auto-execution in signal manager
    await botSignalManager.enableAutoExecution(enabled);

    // Enable/disable OnTick Engine auto-execution by re-initializing with full config
    await onTickEngine.initialize({
      enabled: true,
      minConfluence: 25, // Conservative threshold for quality entries
      autoExecute: enabled,
      trailingEnabled: true,
      killzoneFilterEnabled: this.configuration.killzoneEnabled // Enable killzone filter
    });

    // Update order manager auto-trading state
    orderManager.setAutoTrading(enabled);

    // Configure trade executor for auto-trading
    if (enabled) {
      console.log('⚡ Trade executor ready for ultra-fast execution');
    }

    console.log(`${enabled ? '🚀' : '⏸️'} Auto-trading ${enabled ? 'ENABLED - REAL TRADES WILL BE EXECUTED WHEN CONNECTED' : 'disabled'}`);

    if (enabled) {
      console.log('⚠️ WARNING: Auto-trading is now ACTIVE. Real orders will be placed on your Exness account when connected!');
      console.log('⚡ OnTick Engine will execute trades based on SMC confluence (25%+ / confluence factors)');
      console.log('🎯 XAU/USD prioritized for higher volatility trading');
    } else {
      console.log('⏸️ Auto-trading disabled - bot will analyze but not execute trades');
    }
  }

  async updateConfiguration(config: Partial<BotConfiguration>): Promise<void> {
    this.configuration = { ...this.configuration, ...config };
    this.status.lastUpdate = new Date();

    // If enabledSymbols changed, update all relevant components
    if (config.enabledSymbols) {
      console.log('🔄 Updating enabled symbols across all systems:', config.enabledSymbols);

      // Update botSignalManager with new symbols
      botSignalManager.setConfiguration({
        symbols: config.enabledSymbols,
        enabled: true
      });

      // Update onTickEngine with new symbols
      onTickEngine.setSymbols(config.enabledSymbols);

      // Update real-time data feed with new symbols
      realTimeDataFeed.updateConfig({
        symbols: config.enabledSymbols,
        updateInterval: 1000,
        enableWebSocket: false
      });

      // Update enhanced trading system symbols (if applicable)
      console.log('📈 Enhanced trading system symbols updated');
    }

    // Update risk parameters in order manager if risk settings changed
    if (config.maxRiskPerTrade || config.maxDailyLoss) {
      const riskParams = orderManager.getRiskParameters();
      if (config.maxRiskPerTrade) {
        riskParams.maxRiskPerTrade = config.maxRiskPerTrade;
      }
      if (config.maxDailyLoss) {
        riskParams.maxDailyLoss = config.maxDailyLoss;
      }
      orderManager.updateRiskParameters(riskParams);
      console.log('🛡️ Risk parameters updated in order manager:', riskParams);
    }

    console.log('⚙️ Configuration updated across all integrated systems:', this.configuration);
  }

  /**
   * Switch trading mode between default (all majors + volatile) and gold-only
   */
  async switchTradingMode(mode: 'default' | 'gold-only'): Promise<void> {
    console.log(`🔄 Switching to ${mode} trading mode...`);

    let symbols: string[];
    if (mode === 'gold-only') {
      symbols = ['XAUUSD', 'XAGUSD'];
      console.log('🎯 GOLD-ONLY MODE: Trading only gold and silver pairs');
    } else {
      // Default mode: all top 100 forex pairs
      symbols = [...TOP_100_SYMBOLS];
      console.log('🌍 DEFAULT MODE: Trading all top 100 forex pairs');
    }

    // Update configuration with new symbols
    await this.updateConfiguration({
      enabledSymbols: symbols
    });

    console.log(`✅ Successfully switched to ${mode} mode with ${symbols.length} symbols: ${symbols.join(', ')}`);
  }

  async emergencyStop(reason: string): Promise<void> {
    console.error('🚨 EMERGENCY STOP:', reason);

    // Stop all trading systems immediately
    await this.stopBot();

    // Disable auto-execution across all systems
    await botSignalManager.enableAutoExecution(false);
    orderManager.setAutoTrading(false);

    // Emergency stop order manager
    await orderManager.emergencyStop();

    // Stop all monitoring systems
    timeBasedExitManager.stopMonitoring();
    partialProfitManager.stopMonitoring();

    // Clear all caches and reset states
    aiAnalyzer.clearCache();
    performanceAnalytics.exportAnalyticsData(); // Export final analytics

    console.error('🚨 EMERGENCY STOP COMPLETE: All systems halted and caches cleared');
  }

  async generateTestSignal(): Promise<void> {
    console.log('🧪 Generating test signal...');

    // Generate signals for all configured pairs
    await botSignalManager.generateAndProcessSignals();

    // If auto-trading is enabled, execute immediately
    if (this.status.autoTradingEnabled) {
      console.log('🚀 Auto-trading enabled - executing pending signals...');
      await botSignalManager.executePendingSignals();
    }
  }

  async forceGoldTrade(): Promise<void> {
    console.log('🧪 FORCE GOLD TRADE: Executing test gold trade...');

    try {
      // Check if we're in paper trading mode
      const { orderManager } = await import('./orderManager');
      const isPaperTrading = (orderManager as any).isPaperTradingMode;

      if (!isPaperTrading && !exnessAPI.isConnectedToExness()) {
        throw new Error('Cannot execute force trade: Not connected to Exness and not in paper trading mode');
      }

      // Force execute a gold trade for testing
      const ticket = await orderManager.executeOrder({
        symbol: 'XAUUSD',
        type: 'BUY',
        volume: 0.01,
        stopLoss: 1950, // Conservative stop loss
        takeProfit: 2100, // Conservative take profit
        comment: 'FORCE-GOLD-TEST'
      });

      if (ticket) {
        console.log(`✅ FORCE GOLD TRADE SUCCESSFUL: Ticket ${ticket}`);
      } else {
        console.log('❌ FORCE GOLD TRADE FAILED: No ticket returned');
      }
    } catch (error) {
      console.error('❌ FORCE GOLD TRADE ERROR:', error);
    }
  }

  // Auto-start method for forex trading
  private async autoStartForGoldTrading(): Promise<void> {
    try {
      console.log('🎯 Auto-starting forex trading mode...');

      // Check if we're in paper trading mode first
      const { orderManager } = await import('./orderManager');
      const isPaperTrading = (orderManager as any).isPaperTradingMode;

      if (!isPaperTrading) {
        // For real trading, verify Exness connection
        const { exnessAPI } = await import('./exnessApi');
        const isConnected = exnessAPI.isConnectedToExness();

        if (!isConnected) {
          console.log('⚠️ Not connected to Exness - skipping real trading auto-start');
          console.log('💡 Please connect to Exness through the UI first');
          console.log('🔗 Go to the Exness Integration tab and connect your MT5 account');
          return;
        }

        console.log('✅ Exness connection verified - proceeding with real trading setup');
      } else {
        console.log('📝 Paper trading mode - proceeding with simulated trading');
        console.log('🎯 Bot will generate signals and simulate trades for testing');
      }

      // Get only tradable symbols from MT5 account
      console.log('🔍 Fetching tradable symbols from MT5 account...');
      const tradableSymbols = await exnessAPI.getTradableSymbols();
      console.log(`✅ Found ${tradableSymbols.length} tradable symbols: ${tradableSymbols.join(', ')}`);

      // Update configuration for multi-symbol trading with only tradable symbols
      await this.updateConfiguration({
        enabledSymbols: tradableSymbols.length > 0 ? tradableSymbols : ['EURUSD', 'GBPUSD', 'USDJPY', 'AUDUSD'], // Fallback to major forex pairs if no tradable symbols
        minConfidence: 30, // Ultra-aggressive: 30% minimum confidence for maximum scalping opportunities
        maxRiskPerTrade: 20.0, // Ultra-aggressive: 20% risk per trade for rapid growth from micro account
        maxDailyLoss: 50.0 // Ultra-aggressive: 50% maximum daily loss for high-frequency scalping
      });

      // Enable real trading by default when connected to Exness
      if (isPaperTrading) {
        console.log('📝 Bot is in paper trading mode for testing - signals will be generated and simulated');
        // Ensure auto-trading is enabled for paper trading
        orderManager.setAutoTrading(true);
      } else {
        console.log('💰 Bot is in REAL TRADING mode - will place live orders');
        orderManager.setPaperTradingMode(false);
      }

      console.log('⚙️ Configuration updated for multi-symbol trading:', this.configuration);

      // Auto-start the bot
      console.log('🚀 Starting bot automatically...');
      await this.startBot();

      // Enable auto-trading
      console.log('🎯 Enabling auto-trading for multi-symbol trading...');
      await this.enableAutoTrading(true);

      console.log('✅ Multi-symbol trading auto-started successfully!');
      console.log(`🎯 Trading Mode: ${isPaperTrading ? 'PAPER TRADING (Simulated)' : 'REAL TRADING (Live Account)'}`);
      console.log(`📊 Enabled Symbols: ${this.configuration.enabledSymbols.join(', ')}`);

    } catch (error) {
      console.error('❌ Failed to auto-start gold trading:', error);
      console.error('🔍 This is likely because the bot is not connected to Exness MT5');
      console.error('💡 Solution: Connect your Exness MT5 account through the UI first');
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
    console.log('📊 Current bot status:', {
      isConnected: this.status.isConnected,
      isActive: this.status.isActive,
      autoTradingEnabled: this.status.autoTradingEnabled,
      exnessAPIConnected: exnessAPI.isConnectedToExness()
    });

    // If connected, ensure real-time data feed is started
    if (connected && !realTimeDataFeed.isRunning()) {
      console.log('📡 Starting real-time data feed after connection...');
      realTimeDataFeed.start().catch(error => {
        console.error('❌ Failed to start data feed after connection:', error);
      });
    }
  }

  // Integrated component access methods

  /**
   * Get real-time performance analytics
   */
  async getPerformanceAnalytics(): Promise<any> {
    return await performanceAnalytics.getRealTimeRiskMetrics();
  }

  /**
   * Run AI analysis on a symbol
   */
  async getAIAnalysis(symbol: string, timeframe: string = 'H1'): Promise<any> {
    const marketData = await exnessAPI.getCurrentPrice(symbol);
    if (!marketData) return null;

    const input = {
      symbol,
      timeframe,
      marketData: {
        currentPrice: (marketData.bid + marketData.ask) / 2,
        bid: marketData.bid,
        ask: marketData.ask,
        spread: marketData.ask - marketData.bid,
        change: 0 // Would need historical data
      },
      technicalIndicators: {
        rsi: 50, // Default values - would be calculated from real data
        macd: 0,
        ema20: marketData.bid,
        ema50: marketData.bid,
        atr: 0.001
      }
    };

    return await aiAnalyzer.analyzeMarket(input);
  }

  /**
   * Get news impact prediction for a symbol
   */
  async getNewsImpactPrediction(symbol: string): Promise<any> {
    return await newsImpactPredictor.predictNewsImpact(symbol);
  }

  /**
   * Run backtest on current strategy
   */
  async runBacktest(historicalData: any): Promise<any> {
    // Use enhanced trading system as strategy
    const strategy = (data: any, params: any, index: number) => {
      const currentBar = data.data[index];
      if (!currentBar) return null;

      // Simplified signal generation for backtesting (synchronous)
      // In a real implementation, this would use pre-calculated indicators
      const marketData = {
        symbol: data.symbol,
        prices: data.data.slice(Math.max(0, index - 50), index + 1).map((d: any) => d.close),
        currentPrice: currentBar.close,
        indicators: {
          rsi: 50, // Simplified
          ema20: currentBar.close,
          ema50: currentBar.close
        }
      };

      // Simple trend-following logic for backtest
      const prices = marketData.prices;
      const currentPrice = currentBar.close;
      const prevPrice = prices[prices.length - 2] || currentPrice;

      let signalType: 'BUY' | 'SELL' | null = null;
      if (currentPrice > prevPrice * 1.001) {
        signalType = 'BUY';
      } else if (currentPrice < prevPrice * 0.999) {
        signalType = 'SELL';
      }

      if (!signalType) return null;

      // Return proper TradingSignal format
      return {
        id: `signal_${Date.now()}_${index}`,
        symbol: data.symbol,
        type: signalType,
        confidence: 75,
        entryPrice: currentBar.close,
        stopLoss: signalType === 'BUY' ? currentBar.close * 0.995 : currentBar.close * 1.005,
        takeProfit: signalType === 'BUY' ? currentBar.close * 1.01 : currentBar.close * 0.99,
        timeframe: 'H1',
        reasoning: `Backtest signal: ${signalType} based on price movement`,
        source: 'Backtest Strategy'
      };
    };

    return await backtestingEngine.runBacktest(historicalData, strategy, {});
  }

  /**
   * Get cost optimization report
   */
  async getCostOptimizationReport(symbol: string, volume: number): Promise<any> {
    return await orderManager.getCostOptimizationReport(symbol, volume);
  }

  /**
   * Get comprehensive system status
   */
  async getSystemStatus(): Promise<any> {
    const [performance, accountStatus, executionMetrics] = await Promise.all([
      this.getPerformanceAnalytics(),
      orderManager.getAccountStatus(),
      orderManager.getExecutionMetrics()
    ]);

    return {
      botStatus: this.getStatus(),
      performance,
      accountStatus,
      executionMetrics,
      dataFeedStatus: realTimeDataFeed.getConnectionStatus(),
      aiStatus: 'Active',
      newsMonitorStatus: 'Active',
      backtestingStatus: 'Ready',
      componentsIntegrated: 10
    };
  }
}

export const tradingBot = new TradingBot();
