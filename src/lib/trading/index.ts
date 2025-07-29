// Trading system exports
export { exnessAPI } from './exnessApi';
export { orderManager } from './orderManager';

// Types
export type { ExnessCredentials, TradeOrder, AccountInfo, Position } from './exnessApi';
export type { OrderRequest, RiskParameters } from './orderManager';

// Mock implementations for now
export const realTimeDataFeed = {
  start: () => console.log('Real-time data feed started'),
  stop: () => console.log('Real-time data feed stopped'),
  subscribe: (callback: Function) => console.log('Subscribed to data feed'),
  unsubscribe: () => console.log('Unsubscribed from data feed')
};

export const tradingBot = {
  start: () => console.log('Trading bot started'),
  stop: () => console.log('Trading bot stopped'),
  initialize: () => Promise.resolve(),
  stopBot: () => Promise.resolve(),
  isRunning: () => false,
  getStatus: () => ({ status: 'idle', trades: 0, profit: 0 })
};

export const signalProcessor = {
  processSignal: (signal: any) => console.log('Processing signal:', signal),
  generateSignal: () => console.log('Generating test signal')
};

export const tradeExecutor = {
  executeTrade: (trade: any) => console.log('Executing trade:', trade),
  cancelTrade: (tradeId: string) => console.log('Canceling trade:', tradeId)
};

// Initialize trading system
export const initializeTradingSystem = async () => {
  try {
    const { orderManager } = await import('./orderManager');
    await orderManager.initialize();
    console.log('Trading system initialized');
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
    realTimeDataFeed.stop();
    await tradingBot.stopBot();
    console.log('Trading system cleaned up');
  } catch (error) {
    console.error('Error during cleanup:', error);
  }
};