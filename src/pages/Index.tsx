import { Navigation } from "@/components/Navigation";
import { CurrencyPairsTable } from "@/components/CurrencyPairsTable";
import { NewsAlertsCard } from "@/components/NewsAlertsCard";
import { EconomicCalendar } from "@/components/EconomicCalendar";
import { PredictionsCard } from "@/components/PredictionsCard";
import { TradingBotDashboard } from "@/components/TradingBotDashboard";
import { PaperTradingSimulator } from "@/components/PaperTradingSimulator";
import { EnhancedSignalsSystem } from "@/components/EnhancedSignalsSystem";
import { MarketCharts } from "@/components/MarketCharts";
import { AIPredictionSystem } from "@/components/AIPredictionSystem";
import { ExnessIntegration } from "@/components/ExnessIntegration";
import { LiveTradingDashboard } from "@/components/LiveTradingDashboard";
import { EnhancedTradingBot } from "@/components/EnhancedTradingBot";
import { AdvancedTradingControls } from "@/components/AdvancedTradingControls";
import { MarketDataAnalysis } from "@/components/MarketDataAnalysis";
import { initializeTradingSystem } from "@/lib/trading";
import { useEffect } from "react";
import "@/lib/globalFunctions"; // Import global functions module

const Index = () => {
  useEffect(() => {
    // Initialize trading system when app loads
    initializeTradingSystem();
    
    // Also set up global functions immediately for debugging
    const setupGlobalFunctions = () => {
      console.log('🔧 Setting up global functions from Index component...');
      
      // Check if trading bot is available
      const checkTradingBot = () => {
        const bot = (window as any).tradingBot;
        if (bot) {
          console.log('✅ Trading bot found:', bot);
          return true;
        } else {
          console.log('❌ Trading bot not found');
          return false;
        }
      };
      
      // Set up global functions
      (window as any).checkTradingBot = checkTradingBot;
      (window as any).debugTrading = () => {
        console.log('🔍 Debug Trading System:');
        console.log('Trading Bot:', (window as any).tradingBot);
        console.log('Order Manager:', (window as any).orderManager);
        console.log('Signal Processor:', (window as any).signalProcessor);
        console.log('Initialized:', (window as any).tradingSystemInitialized);
        console.log('Initializing:', (window as any).tradingSystemInitializing);
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
      
      console.log('✅ Global functions set up from Index component');
      console.log('Available: checkTradingBot, debugTrading, forceTrading');
      console.log('Also available: checkTradingSystem, quickStatus, forceTradingMode, checkInitStatus');
    };
    
    // Set up global functions immediately
    setupGlobalFunctions();
    
    // Also set up a timer to check periodically
    const interval = setInterval(() => {
      if ((window as any).tradingBot) {
        console.log('🌐 Trading bot detected, setting up additional functions...');
        setupGlobalFunctions();
        clearInterval(interval);
      }
    }, 1000);
    
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <Navigation />
      
      {/* Main Dashboard */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Hero Section */}
        <div className="mb-8">
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/10 via-accent/5 to-primary/5 p-8 border border-border/50">
            <div className="relative z-10">
              <h1 className="text-4xl lg:text-5xl font-bold text-foreground mb-4">
                Professional Forex Analytics
              </h1>
              <p className="text-xl text-muted-foreground mb-6 max-w-2xl">
                AI-powered currency predictions, real-time market data, and comprehensive economic insights 
                for professional traders and analysts.
              </p>
              <div className="flex flex-wrap gap-4">
                <div className="flex items-center space-x-2 px-4 py-2 bg-bullish/10 rounded-lg border border-bullish/20">
                  <div className="w-2 h-2 bg-bullish rounded-full animate-pulse"></div>
                  <span className="text-sm text-bullish font-medium">Live Market Data</span>
                </div>
                <div className="flex items-center space-x-2 px-4 py-2 bg-primary/10 rounded-lg border border-primary/20">
                  <div className="w-2 h-2 bg-primary rounded-full animate-pulse"></div>
                  <span className="text-sm text-primary font-medium">AI Predictions Active</span>
                </div>
                <div className="flex items-center space-x-2 px-4 py-2 bg-accent/10 rounded-lg border border-accent/20">
                  <div className="w-2 h-2 bg-accent rounded-full animate-pulse"></div>
                  <span className="text-sm text-accent font-medium">Economic Calendar</span>
                </div>
              </div>
            </div>
            {/* Background Decoration */}
            <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-bl from-primary/20 to-transparent rounded-full blur-3xl"></div>
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-gradient-to-tr from-accent/20 to-transparent rounded-full blur-2xl"></div>
          </div>
        </div>

        {/* Advanced Trading Controls - Main Trading Interface */}
        <div className="mb-8">
          <AdvancedTradingControls />
        </div>

        {/* Market Data Analysis - Buyer/Seller Data */}
        <div className="mb-8">
          <MarketDataAnalysis />
        </div>



        {/* Market Charts */}
        <div className="mb-8">
          <MarketCharts />
        </div>

        {/* AI Prediction System */}
        <div className="mb-8">
          <AIPredictionSystem />
        </div>

        {/* Enhanced Trading Bot Dashboard */}
        <div className="mb-8">
          <EnhancedTradingBot />
        </div>

        {/* Exness Integration */}
        <div className="mb-8">
          <ExnessIntegration />
        </div>

        {/* Live Trading Dashboard */}
        <div className="mb-8">
          <LiveTradingDashboard />
        </div>

        {/* Paper Trading & Signals */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          <PaperTradingSimulator />
          <EnhancedSignalsSystem />
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Currency Pairs */}
          <div className="lg:col-span-2 space-y-8">
            <CurrencyPairsTable />
            <PredictionsCard />
          </div>

          {/* Right Column - Sidebar */}
          <div className="space-y-8">
            <NewsAlertsCard />
            <EconomicCalendar />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
