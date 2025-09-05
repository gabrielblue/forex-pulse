// Standalone Trading Bot Debug Script
// This script runs immediately when loaded

console.log('🔧 Loading Trading Bot Debug Script...');

// Wait for the page to be ready
window.addEventListener('load', function() {
  console.log('🌐 Page loaded, setting up debug functions...');
  
  // Set up debug functions
  window.debugTradingSystem = function() {
    console.log('🔍 Debug: Trading System Check');
    console.log('Window available:', typeof window !== 'undefined');
    console.log('Trading Bot:', window.tradingBot);
    console.log('Order Manager:', window.orderManager);
    console.log('Signal Processor:', window.signalProcessor);
    console.log('Initialized:', window.tradingSystemInitialized);
    console.log('Initializing:', window.tradingSystemInitializing);
    console.log('Available functions:', Object.keys(window).filter(key => 
      key.includes('trading') || key.includes('check') || key.includes('force') || key.includes('debug')
    ));
  };
  
  window.manualSetup = function() {
    console.log('🔧 Manual setup of trading functions...');
    if (window.tradingBot) {
      window.checkTradingSystem = function() {
        console.log('🔍 Trading System Status:');
        console.log('Trading Bot:', window.tradingBot);
        console.log('Order Manager:', window.orderManager);
        console.log('Signal Processor:', window.signalProcessor);
        return true;
      };
      
      window.forceTradingMode = function() {
        console.log('🚀 Forcing trading mode...');
        if (window.tradingBot.setConfiguration) {
          window.tradingBot.setConfiguration({
            minConfidence: 50,
            aggressiveMode: true
          });
          console.log('✅ Trading mode activated with 50% confidence');
        } else {
          console.log('❌ setConfiguration method not available');
        }
      };
      
      window.quickStatus = function() {
        console.log('🤖 Trading Bot Status:', window.tradingBot);
        if (window.tradingBot.getStatus) {
          console.log('Status:', window.tradingBot.getStatus());
        }
        return true;
      };
      
      console.log('✅ Manual setup complete');
    } else {
      console.log('❌ Trading bot not available for manual setup');
    }
  };
  
  window.checkInitStatus = function() {
    console.log('🔍 Initialization Status:');
    console.log('Initializing:', window.tradingSystemInitializing);
    console.log('Initialized:', window.tradingSystemInitialized);
    console.log('Error:', window.tradingSystemError || 'None');
    console.log('Trading Bot:', window.tradingBot ? 'Available' : 'Not Available');
    
    if (window.tradingSystemInitialized) {
      console.log('✅ System fully initialized!');
      return true;
    } else if (window.tradingSystemInitializing) {
      console.log('⏳ System still initializing...');
      return 'initializing';
    } else if (window.tradingSystemError) {
      console.log('❌ Initialization failed:', window.tradingSystemError);
      return false;
    } else {
      console.log('❓ Initialization not started');
      return 'not_started';
    }
  };
  
  console.log('✅ Debug functions loaded and ready!');
  console.log('Available functions: debugTradingSystem, manualSetup, checkInitStatus');
});

// Also set up immediately if DOM is already ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', function() {
    console.log('🌐 DOM ready, debug functions available');
  });
} else {
  console.log('🌐 DOM already ready, debug functions available');
}