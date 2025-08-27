import React, { useState, useEffect } from 'react';

export const GlobalFunctionsTest = () => {
  const [status, setStatus] = useState<string>('Checking...');
  const [functionsAvailable, setFunctionsAvailable] = useState<boolean>(false);

  useEffect(() => {
    // Check if global functions are available
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
        setStatus('✅ All global functions are available!');
      } else {
        setStatus('❌ Some global functions are missing');
      }
    };

    // Check immediately
    checkFunctions();
    
    // Check again after a short delay
    const timer = setTimeout(checkFunctions, 1000);
    
    return () => clearTimeout(timer);
  }, []);

  const testFunction = (funcName: string) => {
    if (typeof (window as any)[funcName] === 'function') {
      console.log(`🧪 Testing ${funcName}...`);
      try {
        const result = (window as any)[funcName]();
        console.log(`✅ ${funcName} result:`, result);
        setStatus(`✅ ${funcName} executed successfully!`);
      } catch (error) {
        console.error(`❌ ${funcName} error:`, error);
        setStatus(`❌ ${funcName} error: ${error}`);
      }
    } else {
      setStatus(`❌ ${funcName} is not available`);
    }
  };

  return (
    <div className="p-4 border rounded-lg bg-gray-50 dark:bg-gray-800">
      <h3 className="text-lg font-semibold mb-4">Global Functions Test</h3>
      
      <div className="mb-4">
        <p className="text-sm text-gray-600 dark:text-gray-400">Status: {status}</p>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Functions Available: {functionsAvailable ? '✅ Yes' : '❌ No'}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => testFunction('checkTradingSystem')}
          className="px-3 py-2 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Test checkTradingSystem
        </button>
        
        <button
          onClick={() => testFunction('quickStatus')}
          className="px-3 py-2 text-sm bg-green-500 text-white rounded hover:bg-green-600"
        >
          Test quickStatus
        </button>
        
        <button
          onClick={() => testFunction('forceTradingMode')}
          className="px-3 py-2 text-sm bg-yellow-500 text-white rounded hover:bg-yellow-600"
        >
          Test forceTradingMode
        </button>
        
        <button
          onClick={() => testFunction('checkInitStatus')}
          className="px-3 py-2 text-sm bg-purple-500 text-white rounded hover:bg-purple-600"
        >
          Test checkInitStatus
        </button>
        
        <button
          onClick={() => testFunction('checkTradingBot')}
          className="px-3 py-2 text-sm bg-red-500 text-white rounded hover:bg-red-600"
        >
          Test checkTradingBot
        </button>
        
        <button
          onClick={() => testFunction('debugTrading')}
          className="px-3 py-2 text-sm bg-indigo-500 text-white rounded hover:bg-indigo-600"
        >
          Test debugTrading
        </button>
      </div>

      <div className="mt-4 p-3 bg-gray-100 dark:bg-gray-700 rounded">
        <p className="text-xs text-gray-600 dark:text-gray-400">
          This component tests if global trading functions are available and working.
          Check the browser console for detailed output.
        </p>
      </div>
    </div>
  );
};