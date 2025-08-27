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
      
      // Set up global functions immediately after trading system is ready
      console.log('🔧 Setting up global functions...');
      
      (window as any).checkTradingSystem = () => {
        console.log('🔍 Trading System Status:');
        console.log('Trading Bot:', (window as any).tradingBot);
        console.log('Order Manager:', (window as any).orderManager);
        console.log('Signal Processor:', (window as any).signalProcessor);
        console.log('Initialized:', (window as any).tradingSystemInitialized);
        console.log('Initializing:', (window as any).tradingSystemInitializing);
        
        if ((window as any).tradingBot) {
          console.log('✅ Trading system is ready!');
          return true;
        } else {
          console.log('❌ Trading system not initialized');
          return false;
        }
      };
      
      (window as any).quickStatus = () => {
        const bot = (window as any).tradingBot;
        if (bot) {
          console.log('🤖 Trading Bot Status:', bot.getStatus ? bot.getStatus() : 'Available but no getStatus method');
          return true;
        } else {
          console.log('❌ Trading Bot not found');
          return false;
        }
      };
      
      (window as any).forceTradingMode = () => {
        if ((window as any).tradingBot && (window as any).tradingBot.setConfiguration) {
          console.log('🚀 Forcing trading mode...');
          (window as any).tradingBot.setConfiguration({
            minConfidence: 50, // Lower threshold for testing
            aggressiveMode: true
          });
          console.log('✅ Trading mode activated with 50% confidence');
        } else {
          console.log('❌ Trading bot not available or setConfiguration method missing');
        }
      };
      
      (window as any).checkInitStatus = () => {
        console.log('🔍 Initialization Status:');
        console.log('Initializing:', (window as any).tradingSystemInitializing);
        console.log('Initialized:', (window as any).tradingSystemInitialized);
        console.log('Error:', (window as any).tradingSystemError || 'None');
        console.log('Trading Bot:', (window as any).tradingBot ? 'Available' : 'Not Available');
        
        if ((window as any).tradingSystemInitialized) {
          console.log('✅ System fully initialized!');
          return true;
        } else if ((window as any).tradingSystemInitializing) {
          console.log('⏳ System still initializing...');
          return 'initializing';
        } else if ((window as any).tradingSystemError) {
          console.log('❌ Initialization failed:', (window as any).tradingSystemError);
          return false;
        } else {
          console.log('❓ Initialization not started');
          return 'not_started';
        }
      };
      
      console.log('✅ Global functions set up successfully!');
      console.log('Available: checkTradingSystem, quickStatus, forceTradingMode, checkInitStatus');
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