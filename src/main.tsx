import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'

// Set up global trading functions immediately when the app starts
console.log('🔧 Main.tsx loaded, setting up global trading functions...');

// Set up global functions with the names you're trying to use
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

// Also keep the old names for compatibility
(window as any).checkTradingBot = () => {
  const bot = (window as any).tradingBot;
  if (bot) {
    console.log('✅ Trading bot found:', bot);
    return true;
  } else {
    console.log('❌ Trading bot not found');
    return false;
  }
};

(window as any).debugTrading = () => {
  console.log('🔍 Debug Trading System:');
  console.log('Trading Bot:', (window as any).tradingBot);
  console.log('Order Manager:', (window as any).orderManager);
  console.log('Signal Processor:', (window as any).signalProcessor);
  console.log('Initialized:', (window as any).tradingSystemInitialized);
  console.log('Initializing:', (window as any).tradingSystemInitializing);
  console.log('Available functions:', Object.keys(window).filter(key => 
    key.includes('trading') || key.includes('check') || key.includes('force') || key.includes('debug')
  ));
};

(window as any).forceTrading = () => {
  if ((window as any).tradingBot && (window as any).tradingBot.setConfiguration) {
    console.log('🚀 Forcing trading mode...');
    (window as any).tradingBot.setConfiguration({
      minConfidence: 50,
      aggressiveMode: true
    });
    console.log('✅ Trading mode activated with 50% confidence');
  } else {
    console.log('❌ Trading bot not available or setConfiguration method missing');
  }
};

console.log('✅ Global trading functions set up from main.tsx');
console.log('Available: checkTradingSystem, quickStatus, forceTradingMode, checkInitStatus');
console.log('Also available: checkTradingBot, debugTrading, forceTrading');

createRoot(document.getElementById("root")!).render(<App />);
