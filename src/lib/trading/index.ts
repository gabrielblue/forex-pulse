// Trading system exports
export { exnessAPI } from './exnessApi';
export { orderManager } from './orderManager';
export { tradingBot } from './tradingBot';
export { signalProcessor } from './signalProcessor';
export { marketAnalyzer } from './marketAnalyzer';

// Types
export type { ExnessCredentials, TradeOrder, AccountInfo, Position } from './exnessApi';
export type { OrderRequest, RiskParameters } from './orderManager';
export type { BotStatus, BotConfiguration } from './tradingBot';
export type { TradingSignal, SignalProcessorConfig } from './signalProcessor';

// Real-time data feed
export const realTimeDataFeed = {
  start: () => console.log('Real-time data feed started'),
  stop: () => console.log('Real-time data feed stopped'),
  subscribe: (callback: Function) => console.log('Subscribed to data feed'),
  unsubscribe: () => console.log('Unsubscribed from data feed')
};

export const tradeExecutor = {
  executeTrade: (trade: any) => console.log('Executing trade:', trade),
  cancelTrade: (tradeId: string) => console.log('Canceling trade:', tradeId)
};

// Initialize trading system
export const initializeTradingSystem = async () => {
  try {
    console.log('🚀 Initializing trading system...');
    
    // Initialize order manager
    const { orderManager } = await import('./orderManager');
    await orderManager.initialize();
    
    // Initialize trading bot
    const { tradingBot } = await import('./tradingBot');
    await tradingBot.initialize();
    
    // Initialize signal processor
    const { signalProcessor } = await import('./signalProcessor');
    await signalProcessor.initialize();
    
    // Make trading system globally accessible for debugging
    if (typeof window !== 'undefined') {
      (window as any).tradingBot = tradingBot;
      (window as any).orderManager = orderManager;
      (window as any).signalProcessor = signalProcessor;
      console.log('🌐 Trading system made globally accessible');
    }
    
    console.log('✅ Trading system initialized successfully');
    return true;
  } catch (error) {
    console.error('❌ Failed to initialize trading system:', error);
    return false;
  }
};

// Cleanup trading system
export const cleanupTradingSystem = async () => {
  try {
    console.log('🧹 Cleaning up trading system...');
    
    const { tradingBot } = await import('./tradingBot');
    await tradingBot.stopBot();
    
    realTimeDataFeed.stop();
    
    console.log('✅ Trading system cleaned up');
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
  }
};

// Global helper functions for debugging
if (typeof window !== 'undefined') {
  (window as any).checkTradingSystem = () => {
    console.log('🔍 Trading System Status:');
    console.log('Trading Bot:', (window as any).tradingBot);
    console.log('Order Manager:', (window as any).orderManager);
    console.log('Signal Processor:', (window as any).signalProcessor);
    
    if ((window as any).tradingBot) {
      console.log('✅ Trading system is ready!');
      return true;
    } else {
      console.log('❌ Trading system not initialized');
      return false;
    }
  };
  
  (window as any).forceTradingMode = () => {
    if ((window as any).tradingBot) {
      console.log('🚀 Forcing trading mode...');
      (window as any).tradingBot.setConfiguration({
        minConfidence: 50, // Lower threshold for testing
        aggressiveMode: true
      });
      console.log('✅ Trading mode activated with 50% confidence');
    } else {
      console.log('❌ Trading bot not available');
    }
  };
}