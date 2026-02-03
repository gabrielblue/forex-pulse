// Trading system exports
export { exnessAPI } from './exnessApi';
export { orderManager } from './orderManager';
import { realTimeDataFeed as coreRealTimeDataFeed } from './realTimeDataFeed';

// Types
export type { ExnessCredentials, TradeOrder, AccountInfo, Position } from './exnessApi';
export type { RiskParameters } from './orderManager';

// Re-export real trading bot implementation
export { tradingBot } from './tradingBot';

// Real-time data feed - integrated with Exness API
export { realTimeDataFeed } from './realTimeDataFeed';

// Smart Money Concepts exports
export { smartMoneyAnalyzer } from './smartMoneyAnalyzer';
export type { SMCAnalysis, CandleData, OrderBlock, FairValueGap, LiquidityZone, MarketStructure } from './smartMoneyAnalyzer';

// OnTick Engine exports
export { onTickEngine } from './onTickEngine';
export type { OnTickConfig, TickData, ActiveTrade } from './onTickEngine';

// Trading Filters exports (Session Killzones + News Blackout)
export { tradingFilters } from './tradingFilters';
export type { Killzone, UpcomingNews, TradingFilterResult } from './tradingFilters';

// Time-Based Exit Manager exports
export { timeBasedExitManager } from './timeBasedExitManager';
export type { SessionConfig, TimeExitRule, WeekendProtectionConfig } from './timeBasedExitManager';

// Market Regime Detector exports
export { marketRegimeDetector } from './marketRegimeDetector';
export type { MarketRegime, RegimeDetectionResult, RegimeConfig } from './marketRegimeDetector';

// Trading Journal exports
export { tradingJournal } from './tradingJournal';
export type { TradeJournalEntry, JournalStats } from './tradingJournal';

// Partial Profit Manager exports
export { partialProfitManager } from './partialProfitManager';
export type { PartialProfitConfig, PartialProfitLevel } from './partialProfitManager';

export const signalProcessor = {
  processSignal: async (signal: any) => {
    const { botSignalManager } = await import('./botSignalManager');
    console.log('📊 Processing real signal:', signal);
    return botSignalManager.forceGenerateSignal(signal.symbol);
  },
  generateSignal: async () => {
    const { botSignalManager } = await import('./botSignalManager');
    console.log('🎯 Generating real trading signal');
    return botSignalManager.generateAndProcessSignals();
  }
};

// Trade executor - integrated with order manager
export const tradeExecutor = {
  executeTrade: async (trade: any) => {
    const { orderManager } = await import('./orderManager');
    console.log('📈 Executing real trade:', trade);
    return orderManager.executeOrder(trade);
  },
  cancelTrade: async (tradeId: string) => {
    const { orderManager } = await import('./orderManager');
    console.log('❌ Canceling trade:', tradeId);
    // Implement trade cancellation logic
    return true;
  }
};

// Initialize trading system
export const initializeTradingSystem = async () => {
  try {
    const { orderManager } = await import('./orderManager');
    await orderManager.initialize();

    // Initialize OnTick Engine with symbols
    const { onTickEngine } = await import('./onTickEngine');
    const { TOP_100_SYMBOLS } = await import('./symbolWhitelist');

    // Set symbols for OnTick Engine (use top symbols for real-time monitoring)
    const tickSymbols = TOP_100_SYMBOLS.slice(0, 20); // Monitor top 20 symbols for performance
    onTickEngine.setSymbols(tickSymbols);

    // Initialize OnTick Engine
    await onTickEngine.initialize({
      enabled: true,
      symbols: tickSymbols,
      minConfluence: 10,
      autoExecute: true,
      trailingEnabled: true,
      maxPositionsPerSymbol: 3,
      killzoneFilterEnabled: false,
      newsBlackoutEnabled: false,
      newsBlackoutMinutes: 60
    });

    // Start OnTick Engine
    onTickEngine.start();

    console.log('Trading system initialized with OnTick Engine monitoring', tickSymbols.length, 'symbols');
    return true;
  } catch (error) {
    console.error('Failed to initialize trading system:', error);
    return false;
  }
};

// Cleanup trading system
export const cleanupTradingSystem = async () => {
  try {
    console.log('Cleaning up trading system...');
    coreRealTimeDataFeed.stop();
    const { tradingBot } = await import('./tradingBot');
    await tradingBot.stopBot();
    console.log('Trading system cleaned up');
  } catch (error) {
    console.error('Error during cleanup:', error);
  }
};