import React, { useState, useEffect } from 'react';

export const DirectFunctionInjector = () => {
  const [injectionStatus, setInjectionStatus] = useState<string>('Ready to inject');
  const [functionsAvailable, setFunctionsAvailable] = useState<boolean>(false);

  // Function to inject global functions directly
  const injectFunctions = () => {
    try {
      console.log('🚀 DIRECT INJECTION: Injecting global functions directly...');
      
      // Set up global trading functions directly
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
      
      console.log('✅ DIRECT INJECTION: Global trading functions injected successfully!');
      console.log('Available functions: checkTradingSystem, quickStatus, forceTradingMode, checkInitStatus');
      console.log('Also available: checkTradingBot, debugTrading, forceTrading');
      
      setInjectionStatus('✅ Functions injected successfully!');
      setFunctionsAvailable(true);
      
      // Also set up a global flag
      (window as any).directInjectionComplete = true;
      
    } catch (error) {
      console.error('❌ DIRECT INJECTION: Error injecting functions:', error);
      setInjectionStatus(`❌ Injection failed: ${error}`);
    }
  };

  // Check if functions are available
  const checkFunctions = () => {
    const functions = [
      'checkTradingSystem',
      'quickStatus', 
      'forceTradingMode',
      'checkInitStatus',
      'checkTradingBot',
      'debugTrading',
      'forceTrading'
    ];
    
    const available = functions.every(func => typeof (window as any)[func] === 'function');
    setFunctionsAvailable(available);
    
    if (available) {
      setInjectionStatus('✅ All global functions are available!');
    } else {
      setInjectionStatus('❌ Some global functions are missing');
    }
  };

  // Test a specific function
  const testFunction = (funcName: string) => {
    if (typeof (window as any)[funcName] === 'function') {
      console.log(`🧪 Testing ${funcName}...`);
      try {
        const result = (window as any)[funcName]();
        console.log(`✅ ${funcName} result:`, result);
        setInjectionStatus(`✅ ${funcName} executed successfully!`);
      } catch (error) {
        console.error(`❌ ${funcName} error:`, error);
        setInjectionStatus(`❌ ${funcName} error: ${error}`);
      }
    } else {
      setInjectionStatus(`❌ ${funcName} is not available`);
    }
  };

  // Auto-inject on component mount
  useEffect(() => {
    console.log('🚀 DIRECT INJECTION: Component mounted, auto-injecting functions...');
    injectFunctions();
    
    // Also check periodically
    const interval = setInterval(checkFunctions, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="p-6 border-2 border-red-500 rounded-lg bg-red-50 dark:bg-red-900/20">
      <h3 className="text-xl font-bold text-red-700 dark:text-red-400 mb-4">
        🚨 DIRECT FUNCTION INJECTOR - EMERGENCY SOLUTION
      </h3>
      
      <div className="mb-6">
        <p className="text-sm text-red-600 dark:text-red-300 mb-2">
          <strong>Status:</strong> {injectionStatus}
        </p>
        <p className="text-sm text-red-600 dark:text-red-300">
          <strong>Functions Available:</strong> {functionsAvailable ? '✅ Yes' : '❌ No'}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <button
          onClick={injectFunctions}
          className="px-4 py-3 text-lg font-semibold bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
        >
          🔧 Inject Functions Now
        </button>
        
        <button
          onClick={checkFunctions}
          className="px-4 py-3 text-lg font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          🔍 Check Functions
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-6">
        <button
          onClick={() => testFunction('checkTradingSystem')}
          className="px-3 py-2 text-sm bg-green-600 text-white rounded hover:bg-green-700"
        >
          Test checkTradingSystem
        </button>
        
        <button
          onClick={() => testFunction('quickStatus')}
          className="px-3 py-2 text-sm bg-green-600 text-white rounded hover:bg-green-700"
        >
          Test quickStatus
        </button>
        
        <button
          onClick={() => testFunction('forceTradingMode')}
          className="px-3 py-2 text-sm bg-green-600 text-white rounded hover:bg-green-700"
        >
          Test forceTradingMode
        </button>
        
        <button
          onClick={() => testFunction('checkInitStatus')}
          className="px-3 py-2 text-sm bg-green-600 text-white rounded hover:bg-green-700"
        >
          Test checkInitStatus
        </button>
      </div>

      <div className="p-4 bg-red-100 dark:bg-red-800/30 rounded border border-red-300 dark:border-red-700">
        <h4 className="font-semibold text-red-800 dark:text-red-200 mb-2">🚨 EMERGENCY INSTRUCTIONS:</h4>
        <ol className="text-sm text-red-700 dark:text-red-300 space-y-1 list-decimal list-inside">
          <li>Click "Inject Functions Now" button above</li>
          <li>Check browser console for "DIRECT INJECTION" messages</li>
          <li>Test functions using the test buttons</li>
          <li>If still not working, copy the console code below</li>
        </ol>
      </div>

      <div className="mt-4 p-3 bg-gray-100 dark:bg-gray-700 rounded">
        <p className="text-xs text-gray-600 dark:text-gray-400">
          <strong>Console Code to Copy:</strong> If the buttons don't work, copy and paste this into your browser console:
        </p>
        <code className="block mt-2 p-2 bg-gray-200 dark:bg-gray-600 text-xs rounded overflow-x-auto">
          {`// DIRECT INJECTION CODE - Copy this into browser console
window.checkTradingSystem = function() {
  console.log('🔍 Trading System Status:');
  console.log('Trading Bot:', window.tradingBot);
  console.log('Order Manager:', window.orderManager);
  console.log('Signal Processor:', window.signalProcessor);
  console.log('Initialized:', window.tradingSystemInitialized);
  console.log('Initializing:', window.tradingSystemInitializing);
  
  if (window.tradingBot) {
    console.log('✅ Trading system is ready!');
    return true;
  } else {
    console.log('❌ Trading system not initialized');
    return false;
  }
};

window.quickStatus = function() {
  const bot = window.tradingBot;
  if (bot) {
    console.log('🤖 Trading Bot Status:', bot.getStatus ? bot.getStatus() : 'Available but no getStatus method');
    return true;
  } else {
    console.log('❌ Trading Bot not found');
    return false;
  }
};

window.forceTradingMode = function() {
  if (window.tradingBot && window.tradingBot.setConfiguration) {
    console.log('🚀 Forcing trading mode...');
    window.tradingBot.setConfiguration({
      minConfidence: 50,
      aggressiveMode: true
    });
    console.log('✅ Trading mode activated with 50% confidence');
  } else {
    console.log('❌ Trading bot not available or setConfiguration method missing');
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

console.log('✅ DIRECT INJECTION: Functions injected! Test with: checkTradingSystem(), quickStatus(), forceTradingMode(), checkInitStatus()');`}
        </code>
      </div>
    </div>
  );
};