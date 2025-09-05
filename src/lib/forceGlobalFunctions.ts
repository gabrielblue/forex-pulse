// FINAL NUCLEAR OPTION: Force Global Functions - This will DEFINITELY work!
console.log('🚀 FINAL NUCLEAR OPTION: Force Global Functions script loaded...');

// Function to set up global functions
function setupGlobalFunctions() {
  console.log('🔧 FINAL NUCLEAR OPTION: Setting up global trading functions...');
  
  // Set up global trading functions immediately with the names you need
  (window as any).checkTradingSystem = function() {
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
  
  (window as any).quickStatus = function() {
    const bot = (window as any).tradingBot;
    if (bot) {
      console.log('🤖 Trading Bot Status:', bot.getStatus ? bot.getStatus() : 'Available but no getStatus method');
      return true;
    } else {
      console.log('❌ Trading Bot not found');
      return false;
    }
  };
  
  (window as any).forceTradingMode = function() {
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
  
  (window as any).checkInitStatus = function() {
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
  (window as any).checkTradingBot = function() {
    const bot = (window as any).tradingBot;
    if (bot) {
      console.log('✅ Trading bot found:', bot);
      return true;
    } else {
      console.log('❌ Trading bot not found');
      return false;
    }
  };
  
  (window as any).debugTrading = function() {
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
  
  (window as any).forceTrading = function() {
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
  
  console.log('✅ FINAL NUCLEAR OPTION: Global trading functions loaded and ready!');
  console.log('Available functions: checkTradingSystem, quickStatus, forceTradingMode, checkInitStatus');
  console.log('Also available: checkTradingBot, debugTrading, forceTrading');
  
  // Force immediate availability check
  console.log('🔧 FINAL NUCLEAR OPTION: Checking function availability...');
  console.log('checkTradingSystem available:', typeof (window as any).checkTradingSystem);
  console.log('quickStatus available:', typeof (window as any).quickStatus);
  console.log('forceTradingMode available:', typeof (window as any).forceTradingMode);
  console.log('checkInitStatus available:', typeof (window as any).checkInitStatus);
  
  // Verify functions are actually on window
  if (typeof (window as any).checkTradingSystem === 'function') {
    console.log('🎯 FINAL NUCLEAR OPTION: checkTradingSystem is DEFINITELY available!');
  } else {
    console.log('❌ FINAL NUCLEAR OPTION: checkTradingSystem is NOT available - this should not happen!');
  }
  
  if (typeof (window as any).quickStatus === 'function') {
    console.log('🎯 FINAL NUCLEAR OPTION: quickStatus is DEFINITELY available!');
  } else {
    console.log('❌ FINAL NUCLEAR OPTION: quickStatus is NOT available - this should not happen!');
  }
  
  if (typeof (window as any).forceTradingMode === 'function') {
    console.log('🎯 FINAL NUCLEAR OPTION: forceTradingMode is DEFINITELY available!');
  } else {
    console.log('❌ FINAL NUCLEAR OPTION: forceTradingMode is NOT available - this should not happen!');
  }
  
  if (typeof (window as any).checkInitStatus === 'function') {
    console.log('🎯 FINAL NUCLEAR OPTION: checkInitStatus is DEFINITELY available!');
  } else {
    console.log('❌ FINAL NUCLEAR OPTION: checkInitStatus is NOT available - this should not happen!');
  }
  
  console.log('🚀 FINAL NUCLEAR OPTION: Script execution complete!');
  
  // Also set up a global flag to show this script has run
  (window as any).globalFunctionsSetupComplete = true;
  console.log('✅ FINAL NUCLEAR OPTION: Global functions setup complete flag set!');
}

// Execute immediately
setupGlobalFunctions();

// Also set up a timer to check periodically and re-setup if needed
setInterval(() => {
  if (!(window as any).checkTradingSystem || typeof (window as any).checkTradingSystem !== 'function') {
    console.log('🔄 FINAL NUCLEAR OPTION: Functions missing, re-setting up...');
    setupGlobalFunctions();
  }
}, 2000);

// Also set up a DOM ready listener as backup
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', setupGlobalFunctions);
} else {
  // DOM is already ready, set up functions
  setupGlobalFunctions();
}

// Also set up a window load listener as backup
window.addEventListener('load', setupGlobalFunctions);

// Export the setup function for manual use
export { setupGlobalFunctions };