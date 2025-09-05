import React from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import Charts from "./pages/Charts";
import News from "./pages/News";
import Calendar from "./pages/Calendar";
import Learn from "./pages/Learn";
import Admin from "./pages/Admin";
import Diagnostics from "./pages/Diagnostics";
import SimpleDiagnostics from "./pages/SimpleDiagnostics";
import NotFound from "./pages/NotFound";
import "@/lib/globalFunctions"; // Import global functions module
import GlobalFunctionsProvider from "./components/GlobalFunctionsProvider";
import { GlobalFunctionsSetup } from "./components/GlobalFunctionsSetup";

const queryClient = new QueryClient();

const App = () => {
  // Set up global trading functions immediately when App loads
  React.useEffect(() => {
    console.log('🔧 App component loaded, setting up global trading functions...');
    
    // Set up global functions
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
    
    // Also set up the functions with the names you need
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
    
    console.log('✅ Global trading functions set up from App component');
    console.log('Available: checkTradingBot, debugTrading, forceTrading, checkInitStatus');
    console.log('Also available: checkTradingSystem, quickStatus, forceTradingMode');
    
    // Also set up a timer to check periodically for the trading bot
    const interval = setInterval(() => {
      if ((window as any).tradingBot) {
        console.log('🌐 Trading bot detected in App component!');
        clearInterval(interval);
      }
    }, 1000);
    
    return () => clearInterval(interval);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <GlobalFunctionsProvider>
          <GlobalFunctionsSetup />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/charts" element={<Charts />} />
              <Route path="/news" element={<News />} />
              <Route path="/calendar" element={<Calendar />} />
              <Route path="/learn" element={<Learn />} />
              <Route path="/admin" element={<Admin />} />
              <Route path="/diagnostics" element={<Diagnostics />} />
              <Route path="/simple-diagnostics" element={<SimpleDiagnostics />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
          <Toaster />
          <Sonner />
        </GlobalFunctionsProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
