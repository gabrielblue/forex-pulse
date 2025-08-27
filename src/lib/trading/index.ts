// Trading system exports
export { exnessAPI } from './exnessApi';
export { orderManager } from './orderManager';
export { tradingBot } from './tradingBot';
export { signalProcessor } from './signalProcessor';
export { marketAnalyzer } from './marketAnalyzer';

// Note: Global functions are now set up in index.html for immediate availability

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

// Note: Global functions are set up in index.html for immediate availability

// Initialize trading system
export const initializeTradingSystem = async () => {
  try {
    console.log('🚀 Initializing trading system...');
    console.log('🔧 Window available:', typeof window !== 'undefined');
    
    // Set global initialization flag
    if (typeof window !== 'undefined') {
      console.log('🔧 Setting initialization flags...');
      (window as any).tradingSystemInitializing = true;
      (window as any).tradingSystemInitialized = false;
      console.log('🔧 Flags set:', { initializing: true, initialized: false });
    } else {
      console.log('❌ Window not available during initialization');
    }
    
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
      console.log('🔧 Setting up global trading system objects...');
      
      (window as any).tradingBot = tradingBot;
      (window as any).orderManager = orderManager;
      (window as any).signalProcessor = signalProcessor;
      (window as any).tradingSystemInitialized = true;
      (window as any).tradingSystemInitializing = false;
      
      console.log('✅ Trading system objects set on window');
      console.log('✅ Trading system initialization complete!');
    } else {
      console.log('❌ Window not available for global setup');
    }
    
    console.log('✅ Trading system initialized successfully');
    return true;
  } catch (error) {
    console.error('❌ Failed to initialize trading system:', error);
    if (typeof window !== 'undefined') {
      (window as any).tradingSystemInitializing = false;
      (window as any).tradingSystemError = error.message;
    }
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