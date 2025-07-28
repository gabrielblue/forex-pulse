// Trading system exports
export { exnessAPI } from './exnessApi';
export { orderManager } from './orderManager';
export { signalProcessor } from './signalProcessor';
export { tradingBot } from './tradingBot';
export { realTimeDataFeed } from './realTimeDataFeed';
export { tradeExecutor } from './tradeExecutor';

// Types
export type { ExnessCredentials, TradeOrder, AccountInfo, Position } from './exnessApi';
export type { OrderRequest, RiskParameters } from './orderManager';
export type { TradingSignal, SignalProcessorConfig } from './signalProcessor';
export type { BotStatus, BotConfiguration } from './tradingBot';
export type { PriceUpdate, DataFeedConfig } from './realTimeDataFeed';
export type { TradeExecution, ExecutionRequest } from './tradeExecutor';

// Initialize trading system
export const initializeTradingSystem = async () => {
  try {
    console.log('Initializing trading system...');
    
    // Start real-time data feed
    await realTimeDataFeed.start();
    
    // Initialize trading bot
    await tradingBot.initialize();
    
    console.log('Trading system initialized successfully');
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
    
    // Stop data feed
    await realTimeDataFeed.stop();
    
    // Stop trading bot
    await tradingBot.stopBot();
    
    console.log('Trading system cleaned up');
  } catch (error) {
    console.error('Error during cleanup:', error);
  }
};