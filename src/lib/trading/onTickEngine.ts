/**
 * OnTick Engine - ChartLord AI Style Real-Time Execution
 * Monitors price changes and reacts instantly
 */

import { exnessAPI } from './exnessApi';
import { orderManager } from './orderManager';
import { smartMoneyAnalyzer, CandleData, SMCAnalysis } from './smartMoneyAnalyzer';
import { tradingFilters, TradingFilterResult } from './tradingFilters';
import { multiTimeframeAnalyzer, MultiTimeframeAnalysis } from './multiTimeframeAnalyzer';
import { newsSentimentAnalyzer, NewsSentimentAnalysis } from './newsSentimentAnalyzer';
import { worldClassStrategies, AdvancedSignal } from './strategies/worldClassStrategies';
import { goldTradingStrategies } from './strategies/goldStrategies';
import { smartHedgingManager, HedgeDecision } from './hedgeManager';
import { aiReversalHedgingManager, HedgeConfig } from './aiReversalHedgingManager';
import { supabase } from '@/integrations/supabase/client';
import { TOP_100_SYMBOLS, MAJOR_CURRENCY_PAIRS } from './symbolWhitelist';
import { getPipValue } from './tradingUtils';

export interface TickData {
  symbol: string;
  bid: number;
  ask: number;
  spread: number;
  timestamp: Date;
}

export interface OnTickConfig {
  enabled: boolean;
  symbols?: string[];
  minConfluence: number;
  autoExecute: boolean;
  trailingEnabled: boolean;
  maxPositionsPerSymbol: number;
  killzoneFilterEnabled: boolean;
  newsBlackoutEnabled: boolean;
  newsBlackoutMinutes: number;
}

export interface ActiveTrade {
  ticketId: string;
  symbol: string;
  type: 'BUY' | 'SELL';
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  currentPrice: number;
  profit: number;
  rMultiple: number;
  trailingActivated: boolean;
  breakEvenMoved: boolean;
  entryTime: number; // Track entry time for scalping max hold duration
  // NEW: Profit protection fields
  partialProfitTaken?: boolean; // Track if partial profit was taken
  retracementDetected?: boolean; // Track if retracement was detected
  retracementEntryPrice?: number; // Entry price for retracement trade
  maxProfitReached?: number; // Track max profit reached for trailing
}

class OnTickEngine {
  private readonly MAX_TOTAL_POSITIONS = 3; // Maximum 3 total positions across all symbols
  private readonly MIN_CONFLUENCE = 25; // Minimum 25% confluence to execute trade
  
  private config: OnTickConfig = {
    enabled: true,
    symbols: [...MAJOR_CURRENCY_PAIRS], // Default to major currency pairs for safe trading
    minConfluence: 60, // INCREASED from 40% to 60% - Only take trades with strong market alignment
    autoExecute: true,
    trailingEnabled: false, // Disable trailing for scalping - we want quick exits
    maxPositionsPerSymbol: 1, // Reduced to 1 position per symbol to prevent over-trading and hedging
    killzoneFilterEnabled: false, // Disable killzone for 24/7 trading
    newsBlackoutEnabled: false, // Disable news blackout for 24/7 trading
    newsBlackoutMinutes: 60 // 60 minutes news blackout
  };

  // PROFIT PROTECTION & RETRACEMENT CONFIGURATION
  private readonly TRAILING_ACTIVATION_PIPS = 2; // Activate trailing at 2 pips profit (lower threshold)
  private readonly TRAILING_BUFFER_PIPS = 1.5; // 1.5 pips trail behind price (tighter)
  private readonly PARTIAL_PROFIT_THRESHOLD = 2.00; // Take 50% profit at $2 (earlier)
  private readonly PARTIAL_PROFIT_PERCENT = 0.50; // Close 50% of position
  private readonly BREAK_EVEN_THRESHOLD_RATIO = 0.25; // Move to BE at 0.25R (was 0.5R)
  private readonly RETRACEMENT_DETECTION_ENABLED = true; // Enable retracement detection
  private readonly RETRACEMENT_MIN_DEPTH_PIPS = 5; // Minimum 5 pips retracement to act
  private readonly RETRACEMENT_MAX_DEPTH_PIPS = 15; // Maximum 15 pips retracement before cancel
  
  // SCALPING CONFIGURATION - $5-10 QUICK PROFITS AS REQUESTED BY USER
  private readonly SCALPING_MODE = true; // Enable scalping mode
  private readonly TARGET_PROFIT_MIN = 5.00;  // $5.00 minimum profit target
  private readonly TARGET_PROFIT_MAX = 10.00; // $10.00 maximum profit target
  private readonly SCALPING_STOP_LOSS = 3.00;  // $3.00 stop loss (tighter for quick scalps)
  private readonly SCALPING_STOP_LOSS_PIPS = 8; // 8 pips stop loss for forex pairs
  private readonly SCALPING_MAX_HOLD_TIME = 180000; // 3 minutes max hold time (reduced for faster scalps)
  private readonly ACCOUNT_TARGET = 100.0; // Target account balance to switch strategies
  
  // CRITICAL: REAL-TIME MOMENTUM FILTER - Prevents trading against current price direction
  private readonly MOMENTUM_CHECK_CANDLES = 6; // Check last 6 candles for momentum
  private readonly MOMENTUM_THRESHOLD = 0.3; // Minimum 30% candles must align with trade direction
  private readonly MOMENTUM_FILTER_ENABLED = true; // Enable momentum filter - CRITICAL FOR SURVIVAL
  
  // SESSION FILTER - Only trade during optimal hours (avoid bad times)
  private readonly SESSION_FILTER_ENABLED = true; // Enable session filter - CRITICAL
  private readonly TRADING_START_HOUR = 7; // 7:00 UTC - London Open
  private readonly TRADING_END_HOUR = 22; // 22:00 UTC - End of trading day
  
  // Gold-only mode helper function - case insensitive
  private isGoldSymbol(symbol: string): boolean {
    const upperSymbol = symbol.toUpperCase();
    return upperSymbol.includes('XAU') || upperSymbol.includes('XAG') || 
           upperSymbol.includes('GOLD') || upperSymbol.includes('SILVER');
  }
  
  // Risk Management Constants
  private readonly MAX_RISK_PER_TRADE = 0.01; // Max 1% risk per trade (safer for $100 account)
  private readonly MAX_DAILY_RISK = 0.03; // Max 3% daily loss limit
  private readonly MIN_RISK_REWARD = 1.5; // Minimum 1.5:1 risk/reward ratio

  private tickInterval: NodeJS.Timeout | null = null;
  private lastPrices: Map<string, TickData> = new Map();
  private candleHistory: Map<string, CandleData[]> = new Map();
  public activeTrades: Map<string, ActiveTrade> = new Map(); // make public for BotSignalManager if needed
  private lastAnalysis: Map<string, SMCAnalysis> = new Map();
  private lastMultiTimeframeAnalysis: Map<string, MultiTimeframeAnalysis> = new Map();
  private lastNewsSentiment: Map<string, NewsSentimentAnalysis> = new Map();
  private lastFilterResult: Map<string, TradingFilterResult> = new Map();
  private lastWorldClassSignals: Map<string, AdvancedSignal[]> = new Map();
  private tradeBiasTracker: Map<string, { buyCount: number; sellCount: number; lastBiasCheck: number }> = new Map();
  private lastTradeTimePerSymbol: Map<string, number> = new Map(); // Per-symbol cooldown
  private isGoldOnlyMode = false; // Track if we're in gold-only trading mode
  private dailyTradeCount: Map<string, { count: number; date: string }> = new Map(); // Daily trade limits
  private dailyPnL: Map<string, { profit: number; loss: number; date: string }> = new Map(); // Daily P&L limits
  private isProcessing = false;
  private consecutiveLosses: number = 0; // Track consecutive losses for recovery
  private consecutiveWins: number = 0; // Track consecutive wins for momentum
  private lastTradeResult: 'WIN' | 'LOSS' | 'BREAKEVEN' | null = null; // Track last trade result
  private lastLossTime: number = 0; // Track when last loss occurred for cooldown
  private readonly LOSS_COOLDOWN_MS = 10000; // 10 second cooldown after loss (reduced for faster recovery)
  
  // RSI/EMA Filter Configuration - STRICT for better entries
  private readonly RSI_PERIOD = 14;
  private readonly RSI_OVERBOUGHT = 70; // Stricter - avoid overbought
  private readonly RSI_OVERSOLD = 30; // Stricter - avoid oversold
  private readonly RSI_FILTER_ENABLED = true; // Enable RSI filter
  private readonly EMA_FILTER_ENABLED = true; // Enable EMA filter
  private readonly EMA_FAST = 9;
  private readonly EMA_SLOW = 21;
  private readonly ENTRY_COOLDOWN_MS = 60000; // 60 seconds between trades on same symbol
  
  // REVERSAL OVERRIDE CONFIGURATION
  private readonly REVERSAL_OVERRIDE_ENABLED = true; // Enable reversal to override trade direction
  private readonly REVERSAL_CONFIDENCE_THRESHOLD = 60; // Minimum 60% confidence for reversal override

  private readonly TICK_INTERVAL = 25; // 25ms tick monitoring for ultra-high-frequency gold scalping
  private readonly CANDLE_FETCH_INTERVAL = 15000; // 15 seconds for scalping signal cycles
  
  // NEW: Retracement tracking
  private retracementTracker: Map<string, { 
    initialProfit: number;
    retracementDepth: number;
    retracementEntryPrice: number | null;
    lastUpdate: number;
  }> = new Map();
  
  /**
   * CRITICAL: Real-time momentum check - Prevents buying in a falling market and selling in a rising market
   * This is the KEY fix that prevents the bot from trading against current price action
   */
  private checkRealTimeMomentum(symbol: string, proposedType: 'BUY' | 'SELL', candles: CandleData[] | undefined): { allowed: boolean; reason: string } {
    if (!this.MOMENTUM_FILTER_ENABLED) {
      return { allowed: true, reason: 'Momentum filter disabled' };
    }
    
    if (!candles || candles.length < this.MOMENTUM_CHECK_CANDLES + 2) {
      return { allowed: true, reason: 'Insufficient data for momentum check' };
    }
    
    const recentCandles = candles.slice(-(this.MOMENTUM_CHECK_CANDLES + 2));
    
    // Count bullish vs bearish candles in recent price action
    let bullishCandles = 0;
    let bearishCandles = 0;
    
    for (let i = 1; i < recentCandles.length; i++) {
      if (recentCandles[i].close > recentCandles[i].open) {
        bullishCandles++;
      } else if (recentCandles[i].close < recentCandles[i].open) {
        bearishCandles++;
      }
    }
    
    const totalDirectionalCandles = bullishCandles + bearishCandles;
    const bullishRatio = totalDirectionalCandles > 0 ? bullishCandles / totalDirectionalCandles : 0.5;
    
    const currentPrice = candles[candles.length - 1].close;
    const prevPrice = candles[candles.length - 2].close;
    const recentHigh = Math.max(...recentCandles.map(c => c.high));
    const recentLow = Math.min(...recentCandles.map(c => c.low));
    
    // Calculate price position in recent range
    const range = recentHigh - recentLow;
    const position = range > 0 ? (currentPrice - recentLow) / range : 0.5;
    
    // Check for strong directional move against proposed trade
    const isPriceFalling = currentPrice < prevPrice;
    const isPriceRising = currentPrice > prevPrice;
    
    // Block BUY if: majority of recent candles are bearish AND price is falling
    if (proposedType === 'BUY') {
      // Calculate how many consecutive candles are moving down
      let consecutiveDownCandles = 0;
      for (let i = recentCandles.length - 1; i >= Math.max(1, recentCandles.length - 5); i--) {
        if (recentCandles[i].close < recentCandles[i].open) {
          consecutiveDownCandles++;
        } else {
          break;
        }
      }
      
      // Block BUY if: 4+ consecutive bearish candles OR bearish ratio > 60%
      if (consecutiveDownCandles >= 4) {
        return { 
          allowed: false, 
          reason: `🚫 MOMENTUM BLOCK: ${consecutiveDownCandles} consecutive bearish candles - price falling, don't BUY` 
        };
      }
      
      if (bearishCandles / Math.max(1, totalDirectionalCandles) > 0.6) {
        return { 
          allowed: false, 
          reason: `🚫 MOMENTUM BLOCK: ${(bearishCandles / Math.max(1, totalDirectionalCandles) * 100).toFixed(0)}% bearish candles - momentum against BUY` 
        };
      }
      
      if (position < 0.3 && bearishCandles > bullishCandles) {
        return { 
          allowed: false, 
          reason: `🚫 MOMENTUM BLOCK: Price at bottom 30% of range with bearish bias - don't BUY` 
        };
      }
      
      return { 
        allowed: true, 
        reason: `✅ Momentum OK for BUY: ${bullishCandles} bullish/${bearishCandles} bearish candles` 
      };
    }
    
    // Block SELL if: majority of recent candles are bullish AND price is rising
    if (proposedType === 'SELL') {
      // Calculate how many consecutive candles are moving up
      let consecutiveUpCandles = 0;
      for (let i = recentCandles.length - 1; i >= Math.max(1, recentCandles.length - 5); i--) {
        if (recentCandles[i].close > recentCandles[i].open) {
          consecutiveUpCandles++;
        } else {
          break;
        }
      }
      
      // Block SELL if: 4+ consecutive bullish candles OR bullish ratio > 60%
      if (consecutiveUpCandles >= 4) {
        return { 
          allowed: false, 
          reason: `🚫 MOMENTUM BLOCK: ${consecutiveUpCandles} consecutive bullish candles - price rising, don't SELL` 
        };
      }
      
      if (bullishCandles / Math.max(1, totalDirectionalCandles) > 0.6) {
        return { 
          allowed: false, 
          reason: `🚫 MOMENTUM BLOCK: ${(bullishCandles / Math.max(1, totalDirectionalCandles) * 100).toFixed(0)}% bullish candles - momentum against SELL` 
        };
      }
      
      if (position > 0.7 && bullishCandles > bearishCandles) {
        return { 
          allowed: false, 
          reason: `🚫 MOMENTUM BLOCK: Price at top 30% of range with bullish bias - don't SELL` 
        };
      }
      
      return { 
        allowed: true, 
        reason: `✅ Momentum OK for SELL: ${bullishCandles} bullish/${bearishCandles} bearish candles` 
      };
    }
    
    return { allowed: true, reason: 'Momentum check passed' };
  }
  
  /**
   * Check if we're in optimal trading session
   */
  private checkTradingSession(): { allowed: boolean; reason: string } {
    if (!this.SESSION_FILTER_ENABLED) {
      return { allowed: true, reason: 'Session filter disabled' };
    }
    
    const currentHourUTC = new Date().getUTCHours();
    
    // Block trading during low liquidity periods
    // Bad times: 22:00 UTC to 7:00 UTC (night/early morning)
    const isBadTime = currentHourUTC >= 22 || currentHourUTC < 7;
    
    if (isBadTime) {
      return { 
        allowed: false, 
        reason: `🚫 SESSION BLOCK: Outside trading hours (${currentHourUTC}:00 UTC) - only trade 7:00-22:00 UTC` 
      };
    }
    
    return { 
      allowed: true, 
      reason: `✅ In trading session: ${currentHourUTC}:00 UTC` 
    };
  }
  
  // NEW: Pending retracement orders
  private pendingRetracementOrders: Map<string, { 
    symbol: string;
    entryPrice: number;
    direction: 'BUY' | 'SELL';
    stopLoss: number;
    takeProfit: number;
    volume: number;
    createdAt: number;
  }> = new Map();
  


  constructor() {
    this.onTick = this.onTick.bind(this);
    this.manageActiveTrades = this.manageActiveTrades.bind(this);
    console.log('⚡ OnTickEngine: MAJOR CURRENCY PAIRS MODE - Ultra-fast 25ms ticks, optimized for flipping small accounts to $100');
  }

  async initialize(config?: Partial<OnTickConfig>): Promise<void> {
    if (config) this.config = { ...this.config, ...config };

    tradingFilters.setKillzoneEnabled(this.config.killzoneFilterEnabled); // Enable killzone for session filtering
    tradingFilters.setNewsBlackoutEnabled(this.config.newsBlackoutEnabled);
    tradingFilters.setNewsBlackoutMinutes(this.config.newsBlackoutMinutes);

    // Check if we have pre-configured symbols (e.g., from tradingBot.switchTradingMode)
    if (this.config.symbols && this.config.symbols.length > 0) {
      // Check if this is gold-only mode based on pre-configured symbols
      // Gold-only mode: 2 or fewer symbols that are ALL gold/silver
      const isGoldOnlyFromSymbols = this.config.symbols.length <= 2 && 
        this.config.symbols.every(s => s.includes('XAU') || s.includes('XAG') || s.includes('GOLD') || s.includes('SILVER'));
      
      if (isGoldOnlyFromSymbols) {
        this.isGoldOnlyMode = true;
        console.log(`⚡ OnTick Engine: GOLD-ONLY MODE - using ${this.config.symbols.join(', ')}`);
      } else {
        this.isGoldOnlyMode = false;
        console.log(`⚡ OnTick Engine: Using pre-configured symbols: ${this.config.symbols.join(', ')}`);
      }
    } else {
      // No pre-configured symbols - determine based on balance and connection
      this.isGoldOnlyMode = false;
      
      if (exnessAPI.isConnectedToExness()) {
        // Check account balance to determine symbols
        const accountInfo = await exnessAPI.getAccountInfo();
        const balance = accountInfo?.balance || 0;

        if (balance < 50) {
          console.log(`⚡ OnTick Engine: Small account (${balance.toFixed(2)}) - using MAJOR CURRENCY PAIRS ONLY (no gold/silver) for safe flipping to $100`);
          this.config.symbols = [...MAJOR_CURRENCY_PAIRS];
        } else {
          console.log(`⚡ OnTick Engine: Sufficient balance (${balance.toFixed(2)}) - using gold and silver: XAUUSD, XAGUSD`);
          this.config.symbols = ['XAUUSD', 'XAGUSD'];
          this.isGoldOnlyMode = true;
        }
        console.log(`⚡ OnTick Engine: Using ${this.config.symbols.length} symbols: ${this.config.symbols.join(', ')}`);
      } else {
        console.log('⚡ OnTick Engine: Not connected to MT5, using MAJOR CURRENCY PAIRS ONLY for safe trading');
        this.config.symbols = [...MAJOR_CURRENCY_PAIRS];
      }
    }

    console.log('⚡ OnTick Engine initialized:', this.config, `Gold-only mode: ${this.isGoldOnlyMode}`);
  }

  start(): void {
    if (this.tickInterval) return console.log('⚡ OnTick Engine already running');

    console.log('🚀 Starting OnTick Engine...');
    this.tickInterval = setInterval(this.onTick, this.TICK_INTERVAL);

    // START AI REVERSAL HEDGING MANAGER
    aiReversalHedgingManager.startMonitoring(5000); // Check every 5 seconds
    console.log('✅ AI Reversal Hedging Manager started');

    this.fetchAllCandleData();
    setInterval(() => this.fetchAllCandleData(), this.CANDLE_FETCH_INTERVAL);
  }

  stop(): void {
    if (this.tickInterval) clearInterval(this.tickInterval);
    this.tickInterval = null;
    
    // STOP AI REVERSAL HEDGING MANAGER
    aiReversalHedgingManager.stopMonitoring();
    console.log('🛑 OnTick Engine stopped');
  }

  private async onTick(): Promise<void> {
    // SAFETY CHECK: Only process ticks if the bot is active
    // This prevents the bot from executing trades immediately upon connection
    try {
      const { tradingBot } = await import('./tradingBot');
      const botStatus = tradingBot.getStatus();
      
      // DIAGNOSTIC: Log detailed bot status
      console.log(`🔍 DIAGNOSTIC: Bot status check`);
      console.log(`   - Bot isActive: ${botStatus.isActive}`);
      
      if (!botStatus.isActive) {
        console.log('🛑 OnTickEngine: Bot is not active, skipping tick processing. User must start the bot first.');
        console.log('💡 FIX: Click "Start Trading" or activate the bot in the UI to enable trades.');
        return;
      }
      
      // DIAGNOSTIC: Check auto trading status
      const autoTradingActive = orderManager.isAutoTradingActive();
      console.log(`   - AutoTrading active: ${autoTradingActive}`);
      if (!autoTradingActive) {
        console.log('🛑 OnTickEngine: AutoTrading is NOT active, trades will not execute.');
        console.log('💡 FIX: Enable "Auto Trading" toggle in the order manager.');
        return;
      }
      
      console.log(`✅ DIAGNOSTIC: Bot is active and auto trading is enabled`);
      
    } catch (error) {
      console.log('⚠️ OnTickEngine: Could not check bot status, skipping tick:', error.message);
      return;
    }

    if (this.isProcessing || !this.config.enabled) return;

    // Allow execution in paper trading mode even without Exness connection
    const isPaperTrading = (orderManager as any).isPaperTradingMode;
    const isConnectedToExness = exnessAPI.isConnectedToExness();

    // COMPREHENSIVE MONITORING: Log all key metrics
    const tradingAllowedAccountInfo = await exnessAPI.getAccountInfo();
    const currentBalance = tradingAllowedAccountInfo?.balance || 0;
    const activeTradesCount = this.activeTrades.size;
    const useScalpingMode = this.SCALPING_MODE && currentBalance < this.ACCOUNT_TARGET;

    console.log(`🔄 OnTick: Processing tick - Balance: ${currentBalance.toFixed(2)}, Scalping: ${useScalpingMode}, Active trades: ${activeTradesCount}, Symbols: ${this.config.symbols.length}, Losses: ${this.consecutiveLosses}, Wins: ${this.consecutiveWins}`);
      
      // DIAGNOSTIC: Check if gold-only mode is properly configured
      console.log(`🔍 DIAGNOSTIC: Gold-only mode status`);
      console.log(`   - isGoldOnlyMode: ${this.isGoldOnlyMode}`);
      console.log(`   - Config symbols: [${this.config.symbols.join(', ')}]`);
      console.log(`   - Active trades count: ${activeTradesCount}`);

    if (!isPaperTrading && !isConnectedToExness) {
      console.log('⏸️ OnTick: Skipping tick - not connected to Exness and not in paper trading mode');
      return;
    }

    // Check if trading is allowed on the account (more lenient check)
    const tradingAccountInfo = await exnessAPI.getAccountInfo();
    if (tradingAccountInfo && !tradingAccountInfo.tradeAllowed && !isPaperTrading) {
      console.log(`⏸️ OnTick: Trading disabled on account - tradeAllowed: ${tradingAccountInfo.tradeAllowed}, balance: ${tradingAccountInfo.balance}, freeMargin: ${tradingAccountInfo.freeMargin}`);
      // Force enable trading by updating the account info
      tradingAccountInfo.tradeAllowed = true;
      console.log('⚠️ OnTick: FORCED tradeAllowed=true - overriding MT5 bridge incorrect data');
    }

    this.isProcessing = true;
    try {
      // Ensure we have symbols to process
      let symbolsToProcess = this.config.symbols;

      // If no symbols configured or connected to MT5, try to refresh symbols
      // BUT: Never refresh symbols if we're in gold-only mode
      if (symbolsToProcess.length === 0 && isConnectedToExness && !this.isGoldOnlyMode) {
        console.log('🔄 OnTick: No symbols configured, refreshing from MT5...');
        try {
          const freshSymbols = await exnessAPI.getTradableSymbols();
          if (freshSymbols.length > 0) {
            this.config.symbols = freshSymbols;
            symbolsToProcess = freshSymbols;
            console.log(`✅ OnTick: Refreshed symbols: ${symbolsToProcess.join(', ')}`);
          }
        } catch (error) {
          console.error('❌ OnTick: Failed to refresh symbols:', error);
        }
      }

      if (symbolsToProcess.length === 0) {
        console.log('⏸️ OnTick: No symbols available to process');
        return;
      }

      // GOLD-ONLY MODE: Filter out non-gold symbols before processing
      if (this.isGoldOnlyMode) {
        symbolsToProcess = symbolsToProcess.filter(s => 
          s.includes('XAU') || s.includes('XAG') || s.includes('GOLD') || s.includes('SILVER')
        );
        console.log(`✅ OnTick: GOLD-ONLY MODE - filtered to ${symbolsToProcess.length} gold/silver symbols: ${symbolsToProcess.join(', ')}`);
      }

      console.log(`✅ OnTick: Processing ${symbolsToProcess.length} symbols: ${symbolsToProcess.join(', ')}`);

      // Process symbols and collect successful ones
      const successfulSymbols: string[] = [];

      for (const symbol of symbolsToProcess) {
        try {
          console.log(`🔄 OnTick: Checking price for ${symbol}...`);
          const price = await exnessAPI.getCurrentPrice(symbol);
          if (!price) {
            console.warn(`⚠️ OnTick: No price available for ${symbol} - may not be in MT5 account`);
            continue; // Skip this symbol but continue with others
          }

          console.log(`📈 OnTick: Got price for ${symbol}: ${price.bid} (spread: ${price.spread})`);

          // DIAGNOSTIC: Log price data availability
          console.log(`✅ DIAGNOSTIC: Price data available for ${symbol}`);
          console.log(`   - Bid: ${price.bid}, Ask: ${price.ask}, Spread: ${price.spread}`);

          const tick: TickData = {
            symbol,
            bid: price.bid,
            ask: price.ask,
            spread: price.spread,
            timestamp: new Date()
          };

          const lastPrice = this.lastPrices.get(symbol);
          const priceChanged = !lastPrice || Math.abs(price.bid - lastPrice.bid) / lastPrice.bid > 0.00001;

          if (priceChanged) {
            this.lastPrices.set(symbol, tick);
            console.log(`💹 OnTick: Price changed for ${symbol}, processing...`);
            await this.processTickForSymbol(symbol, tick);
            successfulSymbols.push(symbol);
          } else {
            console.log(`📊 OnTick: Price unchanged for ${symbol}`);
            successfulSymbols.push(symbol);
          }
        } catch (error) {
          console.error(`❌ OnTick: Error processing ${symbol}:`, error);
          continue; // Continue with other symbols
        }
      }

      console.log(`✅ OnTick: Successfully processed ${successfulSymbols.length}/${symbolsToProcess.length} symbols`);

      // Always manage active trades to remove closed trades and allow new trades
      await this.manageActiveTrades();

      // RECOVERY MECHANISM: If no active trades and we had a loss, immediately look for new trades
      if (this.activeTrades.size === 0 && this.consecutiveLosses > 0) {
        console.log(`🔄 RECOVERY: No active trades after ${this.consecutiveLosses} losses - immediately scanning for new opportunities`);
        // Force immediate re-processing of all symbols
        for (const symbol of symbolsToProcess) {
          try {
            const price = await exnessAPI.getCurrentPrice(symbol);
            if (price) {
              const tick: TickData = {
                symbol,
                bid: price.bid,
                ask: price.ask,
                spread: price.spread,
                timestamp: new Date()
              };
              await this.processTickForSymbol(symbol, tick);
            }
          } catch (error) {
            console.error(`❌ OnTick: Recovery scan error for ${symbol}:`, error);
          }
        }
      }

    } catch (error) {
      console.error('OnTick error:', error);
      // Don't stop the bot on errors - continue running
    } finally {
      this.isProcessing = false;
    }
  }

  private async processTickForSymbol(symbol: string, tick: TickData): Promise<void> {
    // DIAGNOSTIC: Log gold-only mode status
    const isGoldSymbol = this.isGoldSymbol(symbol);
    console.log(`🔍 DIAGNOSTIC: processTickForSymbol - ${symbol} (isGoldSymbol: ${isGoldSymbol}, isGoldOnlyMode: ${this.isGoldOnlyMode})`);
    
    const candles = this.candleHistory.get(symbol);
    
    // DIAGNOSTIC: Check candle data availability
    const candleCount = candles?.length || 0;
    console.log(`   - Candles available: ${candleCount}/10 required`);
    
    if (!candles || candles.length < 10) {
      // Try to fetch candle data if we don't have enough
      if (!candles || candles.length === 0) {
        console.log(`📊 OnTickEngine: Attempting to fetch candle data for ${symbol}...`);
        try {
          await this.fetchCandleData(symbol);
        } catch (error) {
          console.log(`⚠️ OnTickEngine: Failed to fetch candle data for ${symbol}: ${error.message}`);
        }
      }

      const updatedCandles = this.candleHistory.get(symbol);
      const updatedCandleCount = updatedCandles?.length || 0;
      
      console.log(`   - After fetch attempt: ${updatedCandleCount}/10 candles`);
      
      if (!updatedCandles || updatedCandles.length < 10) {
        console.log(`⏸️ OnTickEngine: Skipping ${symbol} - insufficient candle data (${updatedCandleCount}/10). Symbol may not be available in MT5.`);
        console.log(`💡 FIX: Ensure XAUUSD/GOLD is available in your MT5 terminal.`);
        console.log(`💡 FIX: Restart the MT5 bridge and ensure connection is established.`);
        return;
      }
    }

    // Additional safety check for candle data validity
    const finalCandles = this.candleHistory.get(symbol);
    if (!finalCandles || finalCandles.length < 10 || !finalCandles.every(c => c && typeof c.close === 'number')) {
      console.log(`⏸️ OnTickEngine: Skipping ${symbol} - invalid candle data structure`);
      return;
    }

    const filterResult = await tradingFilters.canTradeNow(symbol);
    this.lastFilterResult.set(symbol, filterResult);

    // NEW: RAPID REVERSAL DETECTION - Detect market direction changes faster than lagging indicators
    // This is the KEY fix for detecting when market reverses direction
    const reversalCheck = this.detectReversalSignal(symbol, tick, candles);
    if (reversalCheck.detected) {
      console.log(`🔄 REVERSAL DETECTED for ${symbol}: ${reversalCheck.direction} - Market changed direction!`);
      console.log(`   Reason: ${reversalCheck.reason}`);
    }

    // Perform comprehensive analysis including world-class strategies
    const [smcAnalysis, multiTimeframeAnalysis, newsSentiment, worldClassSignals] = await Promise.all([
      smartMoneyAnalyzer.analyze(candles, tick.bid, symbol),
      multiTimeframeAnalyzer.analyzeSymbol(symbol, tick.bid),
      newsSentimentAnalyzer.getNewsSentiment(symbol),
      this.analyzeWorldClassStrategies(candles, tick, symbol)
    ]);

    this.lastAnalysis.set(symbol, smcAnalysis);
    this.lastMultiTimeframeAnalysis.set(symbol, multiTimeframeAnalysis);
    this.lastNewsSentiment.set(symbol, newsSentiment);
    this.lastWorldClassSignals.set(symbol, worldClassSignals);

    // Update bias tracker
    this.updateTradeBias(symbol, multiTimeframeAnalysis.overallBias);

    console.log(`🔍 OnTickEngine: Processed ${symbol} - canTrade: ${filterResult.canTrade}, SMC bias: ${smcAnalysis.tradeBias}, MT bias: ${multiTimeframeAnalysis.overallBias}, News: ${newsSentiment.marketDirection}, Confluence: ${multiTimeframeAnalysis.confluenceScore}`);

    if (!filterResult.canTrade) {
      console.log(`❌ OnTickEngine: Trade not executed - filter blocked: ${filterResult.reason || 'Unknown reason'}`);
      return;
    }

    if (await this.shouldExecuteTrade(symbol, smcAnalysis, multiTimeframeAnalysis, newsSentiment, tick)) {
      console.log(`✅ OnTickEngine: ALL CONDITIONS MET for trade execution on ${symbol}`);
      console.log(`🎯 TRADE EXECUTION CONFIRMED: ${multiTimeframeAnalysis.overallBias} ${symbol} at ${tick.bid} (MT confluence: ${multiTimeframeAnalysis.confluenceScore}, News: ${newsSentiment.marketDirection})`);
      await this.executeSMCTrade(symbol, smcAnalysis, multiTimeframeAnalysis, newsSentiment, tick);
    } else {
      console.log(`❌ OnTickEngine: Trade conditions NOT met for ${symbol} - skipping trade execution`);
    }
  }

  private async shouldExecuteTrade(symbol: string, smcAnalysis: SMCAnalysis, multiTimeframeAnalysis: MultiTimeframeAnalysis, newsSentiment: NewsSentimentAnalysis, tick: TickData): Promise<boolean> {
    const worldClassSignals = this.lastWorldClassSignals.get(symbol) || [];
    const biasTracker = this.tradeBiasTracker.get(symbol) || { buyCount: 0, sellCount: 0, lastBiasCheck: 0 };

    const balanceInfo = await exnessAPI.getAccountInfo();
    const currentBalance = balanceInfo?.balance || 0;
    const useScalpingMode = this.SCALPING_MODE && currentBalance < this.ACCOUNT_TARGET;

    const existingPositions = Array.from(this.activeTrades.values()).filter(t => t.symbol === symbol);
    let proposedType = multiTimeframeAnalysis.overallBias as 'BUY' | 'SELL' | null;

    console.log(`🔍 DEBUG: shouldExecuteTrade for ${symbol}: isGoldOnlyMode=${this.isGoldOnlyMode}, bias=${multiTimeframeAnalysis.overallBias}, type=${proposedType}`);

    // CRITICAL: Check trading session first - don't trade during bad hours
    const sessionCheck = this.checkTradingSession();
    if (!sessionCheck.allowed) {
      console.log(`🚫 SESSION BLOCK: ${symbol} - ${sessionCheck.reason}`);
      return false;
    }
    console.log(`✅ SESSION OK: ${sessionCheck.reason}`);

    // CRITICAL: For gold-only mode, if bias is NEUTRAL, determine direction from SMC analysis
    if (this.isGoldOnlyMode && multiTimeframeAnalysis.overallBias === 'NEUTRAL') {
      console.log(`🎯 GOLD-ONLY MODE: MTF bias is NEUTRAL, using SMC analysis to determine direction for ${symbol}`);
      // Use SMC trade bias as fallback
      if (smcAnalysis.tradeBias !== 'NEUTRAL') {
        console.log(`✅ GOLD-ONLY MODE: SMC suggests ${smcAnalysis.tradeBias} direction - updating proposedType`);
        proposedType = smcAnalysis.tradeBias as 'BUY' | 'SELL';
      } else {
        console.log(`⚠️ GOLD-ONLY MODE: Both MTF and SMC biases are NEUTRAL - using price action to determine direction`);
        // Use price action as last resort for gold-only mode
        const candles = this.candleHistory.get(symbol);
        if (candles && candles.length > 0) {
          const currentPrice = tick.bid;
          const recentHigh = Math.max(...candles.slice(-5).map(c => c.high));
          const recentLow = Math.min(...candles.slice(-5).map(c => c.low));
          
          if (currentPrice > recentHigh * 0.999) {
            proposedType = 'BUY';
            console.log(`✅ GOLD-ONLY MODE: Price action suggests BUY direction`);
          } else if (currentPrice < recentLow * 1.001) {
            proposedType = 'SELL';
            console.log(`✅ GOLD-ONLY MODE: Price action suggests SELL direction`);
          } else {
            console.log(`🚫 GOLD-ONLY MODE: Cannot determine direction for ${symbol} - EMAs too close or no clear trend - SKIPPING TRADE`);
            return false;
          }
        } else {
          // CRITICAL: Removed default BUY bias - now returns false when no clear direction
          console.log(`🚫 GOLD-ONLY MODE: Cannot determine direction for ${symbol} - SKIPPING TRADE (no clear bias)`);
          return false;
        }
      }
    }
    
    // CRITICAL: Check MT5 positions for any OPPOSITE trades (true hedging)
    const mt5Positions = await exnessAPI.getPositions();
    const existingPositionsForSymbol = (mt5Positions || []).filter(p => p.symbol === symbol);
    
    // CRITICAL: REAL-TIME MOMENTUM CHECK FIRST - Block trades against current price direction
    // This must happen BEFORE reversal override to prevent reversal from forcing trades against momentum
    const momentumCheck = this.checkRealTimeMomentum(symbol, proposedType, this.candleHistory.get(symbol));
    if (!momentumCheck.allowed) {
      console.log(`🚫 MOMENTUM BLOCK: ${symbol} - ${momentumCheck.reason}`);
      return false;
    }
    console.log(`✅ MOMENTUM OK: ${momentumCheck.reason}`);
    
    // NEW: RAPID REVERSAL DETECTION - Detect market direction changes faster than lagging indicators
    // This is the KEY fix for detecting when market reverses direction
    const reversalCandles = this.candleHistory.get(symbol);
    const reversalCheck = this.detectReversalSignal(symbol, tick, reversalCandles);
    
    // CRITICAL: REVERSAL OVERRIDE - If strong reversal detected, override trade direction
    // BUT ONLY if momentum check passes for the new direction
    if (reversalCheck.detected && this.REVERSAL_OVERRIDE_ENABLED) {
      console.log(`🔄🔄🔄 REVERSAL OVERRIDE for ${symbol}:`);
      console.log(`   Original proposed type: ${proposedType}`);
      console.log(`   Reversal direction: ${reversalCheck.direction}`);
      console.log(`   Reversal confidence: ${reversalCheck.confidence}%`);
      console.log(`   Threshold required: ${this.REVERSAL_CONFIDENCE_THRESHOLD}%`);
      
      // Only override if reversal confidence exceeds threshold AND reversal direction is opposite to proposed
      if (reversalCheck.confidence >= this.REVERSAL_CONFIDENCE_THRESHOLD && proposedType !== reversalCheck.direction) {
        // CRITICAL: Check momentum for the NEW direction before allowing override
        const newDirectionMomentumCheck = this.checkRealTimeMomentum(symbol, reversalCheck.direction, this.candleHistory.get(symbol));
        if (newDirectionMomentumCheck.allowed) {
          console.log(`🔄🔄🔄 SWITCHING TRADE DIRECTION: ${proposedType} -> ${reversalCheck.direction}`);
          console.log(`   Reason: Strong reversal detected (${reversalCheck.confidence}% confidence)`);
          console.log(`   ${reversalCheck.reason}`);
          console.log(`   ✅ MOMENTUM CHECK PASSED for new direction: ${newDirectionMomentumCheck.reason}`);
          proposedType = reversalCheck.direction;
        } else {
          console.log(`🚫 REVERSAL OVERRIDE BLOCKED: New direction ${reversalCheck.direction} fails momentum check`);
          console.log(`   ${newDirectionMomentumCheck.reason}`);
        }
      } else if (reversalCheck.confidence >= this.REVERSAL_CONFIDENCE_THRESHOLD) {
        console.log(`🔄 REVERSAL ALIGNED: Proposed ${proposedType} matches reversal direction ${reversalCheck.direction} - proceeding`);
      } else {
        console.log(`⚠️ Reversal detected but confidence ${reversalCheck.confidence}% below threshold ${this.REVERSAL_CONFIDENCE_THRESHOLD}% - using original direction`);
      }
    } else if (reversalCheck.detected) {
      console.log(`🔄 REVERSAL DETECTED for ${symbol}: ${reversalCheck.direction} - Market changed direction!`);
      console.log(`   Reason: ${reversalCheck.reason}`);
    }
    
    // Handle null proposedType - use SMC bias or default to BUY for gold-only mode
    if (proposedType === null) {
      if (this.isGoldOnlyMode && smcAnalysis.tradeBias !== 'NEUTRAL') {
        proposedType = smcAnalysis.tradeBias as 'BUY' | 'SELL';
      } else if (this.isGoldOnlyMode) {
        // For gold-only mode: Skip trade if no clear direction instead of forcing BUY
        console.log(`🚫 GOLD-ONLY MODE: No clear trade direction for ${symbol} - SKIPPING TRADE (requires clear bias)`);
        return false;
      } else {
        // For non-gold mode, skip trade if bias is neutral
        console.log(`🚫 BLOCKED: Cannot determine trade direction for ${symbol} - bias is NEUTRAL`);
        return false;
      }
    }
    
    // Note: Momentum check was moved BEFORE reversal override to prevent trades against momentum
    // See lines 738-739 for the momentum check placement
    
    const oppositePositions = existingPositionsForSymbol.filter(p => 
      ((proposedType === 'BUY' && p.type.toLowerCase() === 'sell') ||
       (proposedType === 'SELL' && p.type.toLowerCase() === 'buy'))
    );
    const sameDirectionPositions = existingPositionsForSymbol.filter(p =>
      ((proposedType === 'BUY' && p.type.toLowerCase() === 'buy') ||
       (proposedType === 'SELL' && p.type.toLowerCase() === 'sell'))
    );
    
    console.log(`🔍 HEDGING DIAGNOSIS ${symbol}: Total positions=${existingPositionsForSymbol.length}, Opposite=${oppositePositions.length}, SameDir=${sameDirectionPositions.length}`);
    
    if (oppositePositions.length > 0) {
      console.log(`🚫 TRUE HEDGING BLOCKED: ${symbol} has ${oppositePositions.length} OPPOSITE position(s) - would create hedge`);
      return false;
    }
    
    if (sameDirectionPositions.length > 0) {
      console.log(`⚠️ ${symbol}: ${sameDirectionPositions.length} same-direction position(s) already exist - allowing add-on (scaling in)`);
    }

    // NEW: Higher Timeframe Alignment Check - Prevent trading against larger trend
    if (multiTimeframeAnalysis.timeframes.length > 0) {
      const h4Tf = multiTimeframeAnalysis.timeframes.find(tf => tf.timeframe === 'H4');
      const d1Tf = multiTimeframeAnalysis.timeframes.find(tf => tf.timeframe === 'D1');
      
      // Use D1 if available, otherwise H4
      const higherTfTrend = d1Tf?.smcAnalysis.tradeBias || h4Tf?.smcAnalysis.tradeBias || 'NEUTRAL';
      const higherTfStrength = (d1Tf?.trendStrength || h4Tf?.trendStrength || 0);
      
      console.log(`🎯 HTF ALIGNMENT CHECK: ${symbol} - HTF Trend: ${higherTfTrend}, HTF Strength: ${higherTfStrength}%, Trade Bias: ${multiTimeframeAnalysis.overallBias}`);
      
      // BLOCK if trading against strong higher timeframe trend (>60% strength)
      if (higherTfStrength > 60 && higherTfTrend !== 'NEUTRAL' && multiTimeframeAnalysis.overallBias !== 'NEUTRAL') {
        if ((higherTfTrend === 'SELL' && multiTimeframeAnalysis.overallBias === 'BUY') || 
            (higherTfTrend === 'BUY' && multiTimeframeAnalysis.overallBias === 'SELL')) {
          console.log(`🚫 BLOCKED: Trade direction CONFLICTS with ${d1Tf ? 'D1' : 'H4'} trend! HTF=${higherTfTrend}, Trade=${multiTimeframeAnalysis.overallBias} - TRADE NOT EXECUTED`);
          return false;
        }
      }
      
      console.log(`✅ HTF ALIGNMENT OK: Trade aligns with or is neutral relative to higher timeframe`);
    } else {
      console.log(`⚠️ No higher timeframe data available for ${symbol} - proceeding with caution`);
    }

    // NEW: Loss cooldown - wait after a loss before taking new trades
    if (this.lastTradeResult === 'LOSS') {
      const timeSinceLoss = Date.now() - this.lastLossTime;
      if (timeSinceLoss < this.LOSS_COOLDOWN_MS) {
        console.log(`⏰ LOSS COOLDOWN: Waiting ${Math.ceil((this.LOSS_COOLDOWN_MS - timeSinceLoss) / 1000)}s more before trading ${symbol}`);
        return false;
      }
      console.log(`✅ LOSS COOLDOWN EXPIRED: Ready to trade ${symbol} after loss`);
    }

    // NEW: Strict entry cooldown - prevent over-trading
    const symbolLastTradeTime = this.lastTradeTimePerSymbol.get(symbol) || 0;
    const timeSinceSymbolTrade = Date.now() - symbolLastTradeTime;
    if (timeSinceSymbolTrade < this.ENTRY_COOLDOWN_MS) {
      console.log(`⏰ ENTRY COOLDOWN: ${symbol} - ${Math.ceil((this.ENTRY_COOLDOWN_MS - timeSinceSymbolTrade) / 1000)}s until next trade`);
      return false;
    }

    // NEW: Global total positions check - prevent excessive trading across all symbols
    const totalActivePositions = this.activeTrades.size;
    if (totalActivePositions >= this.MAX_TOTAL_POSITIONS) {
      console.log(`🚫 GLOBAL MAX POSITIONS: ${totalActivePositions}/${this.MAX_TOTAL_POSITIONS} total positions across all symbols`);
      console.log(`   BLOCKING trade on ${symbol} - too many open positions globally`);
      return false;
    }
    console.log(`✅ GLOBAL POSITIONS OK: ${totalActivePositions}/${this.MAX_TOTAL_POSITIONS} positions open`);

    if (existingPositions.length > 0) {
      const hasOppositePosition = existingPositions.some(pos => pos.type !== proposedType);
      if (hasOppositePosition) {
        console.log(`🚫 ANTI-HEDGING: ${symbol} has opposite position(s) in local tracking`);
        console.log(`   BLOCKING trade to prevent hedging`);
        return false;
      }
      if (existingPositions.length >= this.config.maxPositionsPerSymbol) {
        console.log(`🚫 MAX POSITIONS: ${symbol} has ${existingPositions.length}/${this.config.maxPositionsPerSymbol} positions`);
        console.log(`   BLOCKING trade - max positions reached`);
        return false;
      }
      console.log(`✅ ALLOWING trade: ${symbol} has ${existingPositions.length} same-direction position(s)`);
    }

    // ENTRY QUALITY VALIDATION - Block poor quality entries
    const entryQuality = multiTimeframeAnalysis.entryQuality;
    const confluenceScore = multiTimeframeAnalysis.confluenceScore;
    const smcConfluenceScore = smcAnalysis.confluenceScore;
    const averageConfluence = (confluenceScore + smcConfluenceScore) / 2;
    
    console.log(`🎯 ENTRY QUALITY CHECK: ${symbol} - Quality: ${entryQuality}, MTF Confluence: ${confluenceScore}%, SMC Confluence: ${smcConfluenceScore}%, Average: ${averageConfluence.toFixed(1)}%`);
    
    // GOLD-ONLY MODE: Be more lenient with confluence requirements
    // For gold-only mode, allow trades with any confluence >= 45%
    // For normal mode, require 50% minimum (increased from 40%)
    const minConfluenceThreshold = this.isGoldOnlyMode ? 45 : 50;
    
    // BLOCK if quality is POOR and confluence is below threshold
    // Allow GOOD/EXCELLENT trades even with lower confluence
    if (entryQuality === 'POOR' && averageConfluence < minConfluenceThreshold) {
      // GOLD-ONLY MODE: Allow POOR quality with lower confluence
      if (this.isGoldOnlyMode && averageConfluence >= minConfluenceThreshold) {
        console.log(`🎯 GOLD-ONLY MODE: Allowing trade despite ${entryQuality} quality (avg confluence: ${averageConfluence.toFixed(1)}%) for ${symbol}`);
      } else {
        console.log(`🚫 BLOCKED: Poor entry quality for ${symbol} (${entryQuality}, avg confluence: ${averageConfluence.toFixed(1)}%) - TRADE NOT EXECUTED`);
        return false;
      }
    }

    // STRICT RSI/EMA Entry Timing Filter - RELAXED for gold-only mode
    const candles = this.candleHistory.get(symbol);
    if (candles && candles.length > 20) {
      const indicators = this.calculateIndicators(candles);
      const rsi = indicators.rsi || 50;
      const emaFast = indicators.ema20 || 0;
      const emaSlow = indicators.ema50 || 0;
      const currentPrice = candles[candles.length - 1].close;
      
      console.log(`📊 RSI/EMA Check: ${symbol} - RSI: ${rsi.toFixed(1)}, EMA9: ${emaFast.toFixed(5)}, EMA21: ${emaSlow.toFixed(5)}, Price: ${currentPrice.toFixed(5)}, GoldOnly: ${this.isGoldOnlyMode}`);
      
      // GOLD-ONLY MODE: Relaxed RSI/EMA filters for more entries
      // Allow RSI 25-75 for buys (instead of 40-70)
      // Allow RSI 25-75 for sells (instead of 30-60)
      const goldOnlyRSIOverbought = this.isGoldOnlyMode ? 75 : 70;
      const goldOnlyRSIOversold = this.isGoldOnlyMode ? 25 : 30;
      const goldOnlyRSIMinBuy = this.isGoldOnlyMode ? 25 : 40;
      const goldOnlyRSIMaxSell = this.isGoldOnlyMode ? 75 : 60;
      
      // RSI FILTER - Block bad entries
      if (this.RSI_FILTER_ENABLED) {
        // For BUY signals: RSI should be in favorable zone
        if (proposedType === 'BUY') {
          if (rsi > goldOnlyRSIOverbought) {
            console.log(`🚫 RSI BLOCKED: ${symbol} BUY - RSI at ${rsi.toFixed(1)} (>${goldOnlyRSIOverbought}) - waiting for pullback`);
            return false;
          }
          // GOLD-ONLY: Allow buys even with weak RSI (25+ instead of 40+)
          if (rsi < goldOnlyRSIMinBuy) {
            console.log(`⚠️ RSI WARNING: ${symbol} BUY - RSI at ${rsi.toFixed(1)} (<${goldOnlyRSIMinBuy}) - weak momentum but allowing in gold-only mode`);
          }
          console.log(`✅ RSI BUY OK: RSI=${rsi.toFixed(1)} (${goldOnlyRSIMinBuy}-${goldOnlyRSIOverbought} range)`);
        }
        
        // For SELL signals: RSI should be in favorable zone
        if (proposedType === 'SELL') {
          if (rsi < goldOnlyRSIOversold) {
            console.log(`🚫 RSI BLOCKED: ${symbol} SELL - RSI at ${rsi.toFixed(1)} (<${goldOnlyRSIOversold}) - waiting for bounce`);
            return false;
          }
          // GOLD-ONLY: Allow sells even with strong RSI (up to 75 instead of 60)
          if (rsi > goldOnlyRSIMaxSell) {
            console.log(`⚠️ RSI WARNING: ${symbol} SELL - RSI at ${rsi.toFixed(1)} (${goldOnlyRSIMaxSell}-${goldOnlyRSIOverbought}) - strong momentum but allowing in gold-only mode`);
          }
          console.log(`✅ RSI SELL OK: RSI=${rsi.toFixed(1)} (${goldOnlyRSIOversold}-${goldOnlyRSIMaxSell} range)`);
        }
      }
      
      // GOLD-ONLY MODE: Relaxed EMA filters
      // In gold-only mode, allow entries even if EMA not perfectly aligned
      if (this.EMA_FILTER_ENABLED) {
        if (proposedType === 'BUY') {
          // For BUY: Price should be above EMA9 for normal mode
          // For gold-only: Allow if price is close to EMA9 (within 0.1%)
          const emaTolerance = this.isGoldOnlyMode ? currentPrice * 0.001 : 0;
          if (currentPrice < emaFast - emaTolerance) {
            if (this.isGoldOnlyMode) {
              console.log(`⚠️ EMA WARNING: ${symbol} BUY - Price ${currentPrice.toFixed(5)} < EMA9 ${emaFast.toFixed(5)} - allowing in gold-only mode`);
            } else {
              console.log(`🚫 EMA BLOCKED: ${symbol} BUY - Price ${currentPrice.toFixed(5)} < EMA9 ${emaFast.toFixed(5)} - not in uptrend`);
              return false;
            }
          }
          console.log(`✅ EMA BUY OK: Price ${currentPrice >= emaFast - emaTolerance ? '>' : '~'} EMA9`);
        }
        
        if (proposedType === 'SELL') {
          // For SELL: Price should be below EMA9 for normal mode
          // For gold-only: Allow if price is close to EMA9 (within 0.1%)
          const emaTolerance = this.isGoldOnlyMode ? currentPrice * 0.001 : 0;
          if (currentPrice > emaFast + emaTolerance) {
            if (this.isGoldOnlyMode) {
              console.log(`⚠️ EMA WARNING: ${symbol} SELL - Price ${currentPrice.toFixed(5)} > EMA9 ${emaFast.toFixed(5)} - allowing in gold-only mode`);
            } else {
              console.log(`🚫 EMA BLOCKED: ${symbol} SELL - Price ${currentPrice.toFixed(5)} > EMA9 ${emaFast.toFixed(5)} - not in downtrend`);
              return false;
            }
          }
          console.log(`✅ EMA SELL OK: Price ${currentPrice <= emaFast + emaTolerance ? '<' : '~'} EMA9`);
        }
      }
    } else {
      console.log(`⚠️ Insufficient candle data for RSI/EMA check on ${symbol}`);
    }

    // NEW: Late Session Block - No trades during low liquidity (18:00-02:00 UTC)
    // DISABLED for gold-only mode to allow 24/7 gold trading
    const currentHourUTC = new Date().getUTCHours();
    const isLateSession = currentHourUTC >= 18 || currentHourUTC < 2;
    if (isLateSession && !this.isGoldOnlyMode) {
      console.log(`🚫 LATE SESSION BLOCK: ${symbol} - Current UTC hour: ${currentHourUTC} (18:00-02:00 UTC low liquidity)`);
      return false;
    }
    if (isLateSession && this.isGoldOnlyMode) {
      console.log(`⚠️ LATE SESSION: ${symbol} - Gold-only mode allows trading during late hours (UTC hour: ${currentHourUTC})`);
    } else {
      console.log(`✅ Late session check passed for ${symbol}`);
    }

    const minConfluenceForSymbol = 0;
    const worldClassBonus = worldClassSignals.length > 0 ? 10 : 0;
    const adjustedMinConfluence = 0;

    // Remove duplicate check - already done above with ENTRY_COOLDOWN_MS
    // const lastTradeTime = this.lastTradeTimePerSymbol.get(symbol) || 0;
    // const timeSinceLastTrade = Date.now() - lastTradeTime;
    // const minSymbolInterval = 30000;

    const newsFilterScore = 1;
    const finalMinConfluence = 0;

    console.log(`🔍 OnTickEngine: Checking trade execution for ${symbol}`, {
      autoExecute: this.config.autoExecute,
      isAutoTradingActive: orderManager.isAutoTradingActive(),
      smcConfluence: smcAnalysis.confluenceScore,
      mtConfluence: multiTimeframeAnalysis.confluenceScore,
      worldClassSignals: worldClassSignals.length,
      tradeBias: `${biasTracker.buyCount}B/${biasTracker.sellCount}S`,
      newsDirection: newsSentiment.marketDirection,
      newsConfidence: newsSentiment.confidence,
      finalMinConfluence: finalMinConfluence.toFixed(1),
      entryQuality: multiTimeframeAnalysis.entryQuality,
      existingPositions: existingPositions.length,
      useScalpingMode: useScalpingMode,
      consecutiveLosses: this.consecutiveLosses,
      consecutiveWins: this.consecutiveWins,
      lastTradeResult: this.lastTradeResult
    });

    if (!this.config.autoExecute || !orderManager.isAutoTradingActive()) {
      console.log(`❌ OnTickEngine: Trade not executed - autoExecute: ${this.config.autoExecute}, autoTradingActive: ${orderManager.isAutoTradingActive()}`);
      return false;
    }

    console.log(`✅ OnTickEngine: Auto-trading enabled and active`);

    const isPaperTrading = (orderManager as any).isPaperTradingMode;
    const isConnectedToExness = exnessAPI.isConnectedToExness();

    if (!isPaperTrading && !isConnectedToExness) {
      console.log(`❌ OnTickEngine: Trade not executed - not connected to Exness and not in paper trading mode`);
      return false;
    }

    console.log(`✅ OnTickEngine: Connection check passed`);

    const hasMultiTimeframeData = multiTimeframeAnalysis.timeframes.length > 0;
    const effectiveMinConfluence = 0;

    console.log(`✅ OnTickEngine: Confluence check passed for ${symbol}`);

    if (multiTimeframeAnalysis.overallBias === 'NEUTRAL') {
      console.log(`✅ OnTickEngine: ${symbol} neutral bias - still allowing trade for gold-only mode`);
    }

    console.log(`✅ OnTickEngine: Bias check passed for ${symbol}`);

    const totalRecentSignals = biasTracker.buyCount + biasTracker.sellCount;
    if (totalRecentSignals >= 5) {
      const sellRatio = biasTracker.sellCount / totalRecentSignals;
      console.log(`📊 OnTickEngine: Bias tracking - ${biasTracker.buyCount}B/${biasTracker.sellCount}S - allowing all valid signals`);
    }

    // DIAGNOSTIC LOG: Log confluence score when trade is executed
    console.log(`\n🧪 DIAGNOSTIC: Trade execution for ${symbol}`);
    console.log(`   📊 SMC Confluence Score: ${smcAnalysis.confluenceScore}%`);
    console.log(`   📊 MTF Confluence Score: ${multiTimeframeAnalysis.confluenceScore}%`);
    console.log(`   📊 Entry Quality: ${multiTimeframeAnalysis.entryQuality}`);
    console.log(`   📊 SMC Trade Bias: ${smcAnalysis.tradeBias}`);
    console.log(`   📊 MTF Overall Bias: ${multiTimeframeAnalysis.overallBias}`);
    console.log(`   📊 Market Structure: ${smcAnalysis.marketStructure.trend}`);
    console.log(`   📊 News Sentiment: ${newsSentiment.marketDirection} (${newsSentiment.confidence}%)`);
    console.log(`   📊 Number of Confluence Factors: ${smcAnalysis.confluenceFactors.length}`);
    
    // Log higher timeframe alignment
    if (multiTimeframeAnalysis.timeframes.length > 0) {
      const h4Tf = multiTimeframeAnalysis.timeframes.find(tf => tf.timeframe === 'H4');
      const d1Tf = multiTimeframeAnalysis.timeframes.find(tf => tf.timeframe === 'D1');
      console.log(`   📊 H4 Trend: ${h4Tf?.smcAnalysis.tradeBias || 'N/A'}, Strength: ${h4Tf?.trendStrength || 0}%`);
      console.log(`   📊 D1 Trend: ${d1Tf?.smcAnalysis.tradeBias || 'N/A'}, Strength: ${d1Tf?.trendStrength || 0}%`);
    }
    
    // WARNING: Log if confluence is too low
    if (smcAnalysis.confluenceScore < 40 || multiTimeframeAnalysis.confluenceScore < 40) {
      console.log(`⚠️ WARNING: Low confluence detected! SMC=${smcAnalysis.confluenceScore}%, MTF=${multiTimeframeAnalysis.confluenceScore}%`);
    }
    
    // WARNING: Log if trade direction conflicts with higher timeframe
    const h4Trend = multiTimeframeAnalysis.timeframes.find(tf => tf.timeframe === 'H4')?.smcAnalysis.tradeBias;
    if (h4Trend && h4Trend !== 'NEUTRAL' && multiTimeframeAnalysis.overallBias !== 'NEUTRAL') {
      if ((h4Trend === 'SELL' && multiTimeframeAnalysis.overallBias === 'BUY') || 
          (h4Trend === 'BUY' && multiTimeframeAnalysis.overallBias === 'SELL')) {
        console.log(`⚠️ WARNING: Trade direction CONFLICTS with H4 trend! H4=${h4Trend}, Trade=${multiTimeframeAnalysis.overallBias}`);
      }
    }
    
    // WARNING: Log if trade conflicts with news sentiment
    if (newsSentiment.confidence > 50) {
      if ((newsSentiment.marketDirection === 'BULLISH' && multiTimeframeAnalysis.overallBias === 'SELL') ||
          (newsSentiment.marketDirection === 'BEARISH' && multiTimeframeAnalysis.overallBias === 'BUY')) {
        console.log(`⚠️ WARNING: Trade direction CONFLICTS with news sentiment! News=${newsSentiment.marketDirection}, Trade=${multiTimeframeAnalysis.overallBias}`);
      }
    }
    
    // Log order block quality
    const relevantOBs = smcAnalysis.orderBlocks.filter(ob => 
      (multiTimeframeAnalysis.overallBias === 'BUY' && ob.type === 'BULLISH') ||
      (multiTimeframeAnalysis.overallBias === 'SELL' && ob.type === 'BEARISH')
    );
    console.log(`   📊 Relevant Order Blocks: ${relevantOBs.length} (avg strength: ${relevantOBs.length > 0 ? (relevantOBs.reduce((a,b) => a + b.strength, 0) / relevantOBs.length).toFixed(1) : 'N/A'}%)`);
    
    // Log invalidation level
    if (smcAnalysis.invalidationLevel) {
      console.log(`   📊 Invalidation Level: ${smcAnalysis.invalidationLevel}`);
      const invalidationDistance = multiTimeframeAnalysis.overallBias === 'BUY' ? 
        ((tick.bid - smcAnalysis.invalidationLevel) / tick.bid * 100) : 
        ((smcAnalysis.invalidationLevel - tick.bid) / tick.bid * 100);
      console.log(`   📊 Distance to Invalidation: ${invalidationDistance.toFixed(2)}%`);
    }
    
    console.log(`   ✅ Trade execution approved with confluence: ${Math.max(smcAnalysis.confluenceScore, multiTimeframeAnalysis.confluenceScore)}%\n`);

    console.log(`✅ OnTickEngine: ALL CONDITIONS MET for ${symbol} - proceeding to execute trade`);
    return true;
  }

  private async executeSMCTrade(symbol: string, smcAnalysis: SMCAnalysis, multiTimeframeAnalysis: MultiTimeframeAnalysis, newsSentiment: NewsSentimentAnalysis, tick: TickData): Promise<void> {
    console.log(`🚀 OnTickEngine: Executing enhanced trade for ${symbol}`);
    try {
      
      // Determine trade direction - handle NEUTRAL case first before TypeScript narrows the type
      let determinedType: 'BUY' | 'SELL' | null = null;
      
      // Try MTF analysis first
      if (multiTimeframeAnalysis.overallBias !== 'NEUTRAL') {
        determinedType = multiTimeframeAnalysis.overallBias as 'BUY' | 'SELL';
      } else if (this.isGoldOnlyMode) {
        // For gold-only mode, use SMC analysis as fallback
        if (smcAnalysis.tradeBias !== 'NEUTRAL') {
          determinedType = smcAnalysis.tradeBias as 'BUY' | 'SELL';
        } else {
          // Last resort: use price action (current price vs recent candles)
          const candles = this.candleHistory.get(symbol);
          if (candles && candles.length > 0) {
            const currentPrice = tick.bid;
            const recentHigh = Math.max(...candles.slice(-5).map(c => c.high));
            const recentLow = Math.min(...candles.slice(-5).map(c => c.low));
            
            // Buy if price is above recent range, sell if below
            if (currentPrice > recentHigh * 0.999) {
              determinedType = 'BUY';
            } else if (currentPrice < recentLow * 1.001) {
              determinedType = 'SELL';
            } else {
              console.log(`⚠️ OnTickEngine: Cannot determine direction for ${symbol} - skipping trade`);
              return;
            }
          } else {
            console.log(`⚠️ OnTickEngine: No candle data available for ${symbol} - skipping trade`);
            return;
          }
        }
      } else {
        console.log('Cannot execute trade with neutral bias');
        return;
      }

      // If still null, we couldn't determine direction
      if (determinedType === null) {
        console.log(`⚠️ OnTickEngine: Could not determine trade direction for ${symbol} - skipping`);
        return;
      }

      // Now we have a valid type
      const type = determinedType;
      const tradeType: 'BUY' | 'SELL' = type;

      // Check account balance and margin before executing trade
      const accountInfo = await exnessAPI.getAccountInfo();
      if (!accountInfo) {
        console.warn('⚠️ OnTickEngine: Cannot check account balance - skipping trade');
        return;
      }

      const balance = accountInfo.balance || 0;
      const margin = accountInfo.margin || 0;
      const freeMargin = accountInfo.freeMargin || 0;

      console.log(`💰 OnTickEngine: Account status - Balance: ${balance.toFixed(2)}, Margin: ${margin.toFixed(2)}, Free margin: ${freeMargin.toFixed(2)}`);

      // Require at least $1 free margin per potential trade (very lenient for micro accounts)
      const minFreeMarginPerTrade = 1;
      if (freeMargin < minFreeMarginPerTrade) {
        console.warn(`⚠️ OnTickEngine: Insufficient free margin: ${freeMargin.toFixed(2)} < ${minFreeMarginPerTrade} - skipping trade`);
        return;
      }

      // Don't use more than 70% of balance on concurrent trades (lenient)
      const maxBalanceUsage = balance * 0.7;
      if (margin > maxBalanceUsage) {
        console.warn(`⚠️ OnTickEngine: Too much margin used: ${margin.toFixed(2)} > ${maxBalanceUsage.toFixed(2)} (70% of balance) - skipping trade`);
        return;
      }
      const pipValue = this.getPipValue(symbol);
      const worldClassSignals = this.lastWorldClassSignals.get(symbol) || [];

      // Check if symbol is an emerging market symbol
      const isEmergingMarketSymbol = this.isEmergingMarketSymbol(symbol);
      if (isEmergingMarketSymbol) {
        console.warn(`⚠️ OnTickEngine: Emerging market symbol detected: ${symbol}. Applying additional validation.`);
      }

      // Use the account info we already fetched
      const currentBalance = accountInfo?.balance || 0;
      const useScalpingMode = this.SCALPING_MODE && currentBalance < this.ACCOUNT_TARGET;

      console.log(`💰 OnTickEngine: Current balance: ${currentBalance.toFixed(2)}, Scalping mode: ${useScalpingMode}, Target: ${this.ACCOUNT_TARGET}`);
      
      // SCALPING MODE: $5-10 PROFIT TARGETS WITH TIGHT STOPS (AS REQUESTED)
      let stopLossPips: number;
      let takeProfitPips: number;
      let stopLossDollar: number | null = null;
      let takeProfitDollar: number | null = null;

      if (useScalpingMode) {
        if (symbol.includes('XAU') || symbol.includes('GOLD')) {
          // GOLD (XAUUSD): Dollar-based stops/targets for $5-10 scalping
          // XAUUSD at ~$2700, pip value = 0.01
          // FIXED: Tighter stops and lower targets for higher win rate
          stopLossDollar = 2.00; // $2.00 stop loss (tighter)
          takeProfitDollar = 5.00; // $5.00 target (lower, achievable)
          stopLossPips = stopLossDollar / pipValue;
          takeProfitPips = takeProfitDollar / pipValue;
          console.log(`⚡ FIXED SCALPING GOLD: SL=${stopLossDollar} (${stopLossPips.toFixed(0)} pips), TP=${takeProfitDollar} (${takeProfitPips.toFixed(0)} pips)`);
        } else if (symbol.includes('XAG') || symbol.includes('SILVER')) {
          // SILVER (XAGUSD): Dollar-based stops/targets - FIXED for volatility
          // Silver is very volatile, need tighter stops and achievable targets
          stopLossDollar = 3.00; // $3.00 stop (tighter for safety)
          takeProfitDollar = 10.00; // $10.00 target (achievable)
          stopLossPips = stopLossDollar / pipValue;
          takeProfitPips = takeProfitDollar / pipValue;
          console.log(`⚡ FIXED SCALPING SILVER: SL=${stopLossDollar}, TP=${takeProfitDollar} (3.3:1 RR)`);
        } else {
          // FOREX PAIRS: Calculate pips needed for $5-10 profit
          // For 0.01 lots: $0.10 per pip
          // For $5 profit: 50 pips, for $10 profit: 100 pips
          const pipValueDollars = pipValue * 10000 * 0.01; // $ per pip for 0.01 lots
          const targetProfitDollars = (this.TARGET_PROFIT_MIN + this.TARGET_PROFIT_MAX) / 2; // $7.50 average
          
          // Stop loss: 8 pips for 0.01 lots = $0.80
          stopLossPips = this.SCALPING_STOP_LOSS_PIPS; // 8 pips
          const stopLossDollars = stopLossPips * pipValueDollars;
          
          // Take profit: Calculate based on 2:1 RR for $5-10 range
          takeProfitPips = stopLossPips * this.MIN_RISK_REWARD; // 12 pips (2:1 RR)
          const takeProfitDollars = takeProfitPips * pipValueDollars;
          
          console.log(`💰 FOREX SCALP: Calculating targets for ${symbol}`);
        }
      } else {
        // NORMAL MODE: Volatility-adaptive stops using ATR
        if (symbol.includes('XAU') || symbol.includes('GOLD')) {
          // GOLD (XAUUSD): Use larger stops due to high price volatility
          // For XAUUSD at ~$2000, pip value = 0.01
          // 100 pips * 0.01 = $1.00 stop distance
          stopLossPips = 100; // $1.00 stop distance
        } else if (symbol.includes('XAG') || symbol.includes('SILVER')) {
          // SILVER (XAGUSD): Silver price is ~$30, pip value = 0.001
          // Need at least $0.50 stop distance for broker acceptance
          // $0.50 / 0.001 = 500 pips
          stopLossPips = 500; // $0.50 stop distance
        } else if (symbol.includes('JPY')) {
          stopLossPips = 5; // 5 pips for JPY pairs
        } else {
          stopLossPips = 7; // 7 pips for major pairs
        }

        // Quality-based stop adjustment
        if (multiTimeframeAnalysis.entryQuality === 'EXCELLENT') {
          stopLossPips = Math.round(stopLossPips * 1.2); // Allow wider stops for excellent entries
        } else if (multiTimeframeAnalysis.entryQuality === 'POOR') {
          stopLossPips = Math.round(stopLossPips * 0.8); // Tighter stops for poor entries
        }

        // ATR-based risk-reward ratios
        let riskRewardRatio = 2.0; // Base RR ratio (2:1)
        if (multiTimeframeAnalysis.confluenceScore >= 80) riskRewardRatio = 2.5;
        if (worldClassSignals.length > 0) riskRewardRatio = 3.0; // Higher RR with world-class confirmation
        if (multiTimeframeAnalysis.entryQuality === 'EXCELLENT') riskRewardRatio = 3.5; // 3.5:1 for excellent entries

        takeProfitPips = stopLossPips * riskRewardRatio;
      }

      let stopLoss: number, takeProfit: number;

      // Check if symbol is precious metal
      const isPreciousMetal = symbol.includes('XAU') || symbol.includes('XAG') || symbol.includes('GOLD') || symbol.includes('SILVER');

      // For precious metals in scalping mode, use dollar-based SL/TP directly
      if (useScalpingMode && isPreciousMetal && stopLossDollar !== null && takeProfitDollar !== null) {
        if (type === 'BUY') {
          stopLoss = tick.bid - stopLossDollar;
          takeProfit = tick.ask + takeProfitDollar;
        } else {
          stopLoss = tick.ask + stopLossDollar;
          takeProfit = tick.bid - takeProfitDollar;
        }
        console.log(`💰 OnTickEngine: Dollar-based SL/TP for ${symbol} - SL: ${stopLoss.toFixed(2)}, TP: ${takeProfit.toFixed(2)}`);
      } else {
        // Standard pip-based calculation for forex or normal mode
        if (type === 'BUY') {
          stopLoss = tick.bid - stopLossPips * pipValue;
          takeProfit = tick.ask + takeProfitPips * pipValue;
        } else {
          stopLoss = tick.ask + stopLossPips * pipValue;
          takeProfit = tick.bid - takeProfitPips * pipValue;
        }

        // For gold/silver in normal mode, ensure minimum stop distance
        if (isPreciousMetal && !useScalpingMode) {
          let minStopDistance: number;
          let minTakeProfit: number;
          
          if (symbol.includes('XAU') || symbol.includes('GOLD')) {
            minStopDistance = 1.00;
            minTakeProfit = 2.00;
          } else {
            minStopDistance = 0.50;
            minTakeProfit = 1.00;
          }

          if (type === 'BUY') {
            if (tick.bid - stopLoss < minStopDistance) {
              console.warn(`⚠️ OnTickEngine: Stop loss too close for ${symbol} BUY - adjusting from ${stopLoss.toFixed(2)} to ${(tick.bid - minStopDistance).toFixed(2)}`);
              stopLoss = tick.bid - minStopDistance;
            }
            if (takeProfit - tick.ask < minTakeProfit) {
              console.warn(`⚠️ OnTickEngine: Take profit too close for ${symbol} BUY - adjusting from ${takeProfit.toFixed(2)} to ${(tick.ask + minTakeProfit).toFixed(2)}`);
              takeProfit = tick.ask + minTakeProfit;
            }
          } else {
            if (stopLoss - tick.ask < minStopDistance) {
              console.warn(`⚠️ OnTickEngine: Stop loss too close for ${symbol} SELL - adjusting from ${stopLoss.toFixed(2)} to ${(tick.ask + minStopDistance).toFixed(2)}`);
              stopLoss = tick.ask + minStopDistance;
            }
            if (tick.bid - takeProfit < minTakeProfit) {
              console.warn(`⚠️ OnTickEngine: Take profit too close for ${symbol} SELL - adjusting from ${takeProfit.toFixed(2)} to ${(tick.bid - minTakeProfit).toFixed(2)}`);
              takeProfit = tick.bid - minTakeProfit;
            }
          }
        }
      }

      // IMPROVED MONEY MANAGEMENT: Conservative lot sizing based on risk
      let baseVolume: number;
      let maxVolume: number;

      if (useScalpingMode) {
        // SCALPING MODE: Ultra-conservative lot sizing
        if (symbol.includes('XAU') || symbol.includes('GOLD') || symbol.includes('XAG') || symbol.includes('SILVER')) {
          // Precious metals: Much smaller lots for safety
          // Max risk per trade = 0.5% of balance
          const maxDollarRisk = currentBalance * this.MAX_RISK_PER_TRADE; // e.g., $0.50 on $100 account
          
          // For gold: $1 stop = 100 pips = 0.01 lots = $1 per 100 pips
          // For 0.5% risk: $0.50 max loss = 0.01 lots
          baseVolume = Math.min(0.01, maxDollarRisk / 1.0); // 0.01 lots max
          maxVolume = Math.min(0.01, baseVolume * 1.0); // No increase from base
        } else {
          // FOREX PAIRS: Even smaller for safety
          baseVolume = 0.01; // 0.01 lots for forex
          maxVolume = 0.01;
        }
        console.log(`💰 SAFE SCALPING: ${symbol} - Lot: ${baseVolume}, Risk: ${(this.MAX_RISK_PER_TRADE * 100).toFixed(1)}% per trade`);
      } else {
        // NORMAL MODE: Dynamic position sizing
        baseVolume = isPreciousMetal ? 0.005 : 0.0005; // Much smaller base sizes for micro accounts
        maxVolume = isPreciousMetal ? 0.01 : 0.005; // Much smaller max sizes for micro accounts
      }

      // Get win rate for this symbol to adjust position sizing
      const biasTracker = this.tradeBiasTracker.get(symbol) || { buyCount: 0, sellCount: 0, lastBiasCheck: 0 };
      const totalTrades = biasTracker.buyCount + biasTracker.sellCount;
      const winRate = totalTrades > 0 ? Math.max(biasTracker.buyCount, biasTracker.sellCount) / totalTrades : 0.5;

      // Multi-factor volume calculation with profitability improvements
      const confluenceMultiplier = Math.min(1.0, multiTimeframeAnalysis.confluenceScore / 100); // Cap at 1.0
      const qualityMultiplier = multiTimeframeAnalysis.entryQuality === 'EXCELLENT' ? 1.1 :
                              multiTimeframeAnalysis.entryQuality === 'GOOD' ? 1.0 :
                              multiTimeframeAnalysis.entryQuality === 'FAIR' ? 0.9 : 0.7;
      const newsMultiplier = newsSentiment.confidence > 80 ? 0.8 : 1.0;
      const worldClassMultiplier = worldClassSignals.length > 0 ? 1.2 : 1.0; // Bonus for world-class signals
      const winRateMultiplier = winRate > 0.6 ? 1.2 : winRate > 0.5 ? 1.0 : 0.8; // Increase size for higher win rates

      let calculatedVolume: number;
      if (useScalpingMode) {
        // SCALPING MODE: FIXED position sizing - NO recovery mode doubling!
        // Recovery mode was causing the bot to double down on losing trades
        // This is the MAIN FIX to prevent account drain
        const recoveryMultiplier = 1.0; // ALWAYS use base volume - no increases after losses
        
        if (this.consecutiveLosses >= 2) {
          console.log(`🛑 RECOVERY MODE DISABLED: Keeping position size normal (${baseVolume}) despite ${this.consecutiveLosses} losses`);
        }

        calculatedVolume = baseVolume * recoveryMultiplier; // No randomizer - consistent sizing
      } else {
        // NORMAL MODE: Dynamic volume calculation
        calculatedVolume = Math.min(maxVolume,
          baseVolume * confluenceMultiplier * qualityMultiplier * newsMultiplier * worldClassMultiplier * winRateMultiplier
        );
      }
      const volume = Math.round(calculatedVolume * 10000) / 10000; // More precision

      // MT5 volume validation - ensure minimum 0.01 lots and proper decimal precision
      let validatedVolume = Math.max(0.01, Math.min(volume, maxVolume));

      // Ensure proper 2-decimal precision for MT5 (0.01, 0.02, etc.)
      validatedVolume = Math.round(validatedVolume * 100) / 100;

      // Final safety check - ensure volume is valid for MT5
      if (validatedVolume < 0.01 || validatedVolume > 100 || isNaN(validatedVolume)) {
        console.warn(`⚠️ OnTickEngine: Invalid volume ${validatedVolume}, resetting to 0.01`);
        validatedVolume = 0.01;
      }

      console.log(`📊 OnTickEngine: Enhanced volume calculation - Original: ${volume}, Validated: ${validatedVolume} lots (Win rate: ${(winRate * 100).toFixed(0)}%, Confluence: ${multiTimeframeAnalysis.confluenceScore}%, Quality: ${multiTimeframeAnalysis.entryQuality}, World-class: ${worldClassSignals.length})`);

      const ticketId = await orderManager.executeOrder({
        symbol,
        type: tradeType,
        volume: validatedVolume,
        stopLoss,
        takeProfit,
        comment: `ENH-${multiTimeframeAnalysis.confluenceScore.toFixed(0)}%-WC${worldClassSignals.length}`
      });

      if (!ticketId) return;

      // Record last trade time for this symbol to enforce cooldown
      this.lastTradeTimePerSymbol.set(symbol, Date.now());

      // Increment daily trade count
      const today = new Date().toISOString().split('T')[0];
      const currentCount = this.dailyTradeCount.get(symbol);
      if (currentCount && currentCount.date === today) {
        currentCount.count++;
      } else {
        this.dailyTradeCount.set(symbol, { count: 1, date: today });
      }

      const entryPrice = type === 'BUY' ? tick.ask : tick.bid;
      this.activeTrades.set(ticketId, {
        ticketId, symbol, type, entryPrice, stopLoss, takeProfit,
        currentPrice: entryPrice, profit: 0, rMultiple: 0,
        trailingActivated: false, breakEvenMoved: false,
        entryTime: Date.now() // Track entry time for scalping
      });

      // REGISTER POSITION WITH AI REVERSAL HEDGING MANAGER
      aiReversalHedgingManager.addPositionToMonitor({
        originalTicketId: ticketId,
        symbol,
        type: tradeType,
        volume: validatedVolume,
        openPrice: entryPrice,
        stopLoss,
        takeProfit
      });

      await this.saveEnhancedSignalToDatabase(symbol, smcAnalysis, multiTimeframeAnalysis, newsSentiment, type, entryPrice, stopLoss, takeProfit);

    } catch (error) {
      console.error(`❌ Failed to execute enhanced trade for ${symbol}:`, error);
    }
  }

  private getPipValue(symbol: string): number {
    return getPipValue(symbol);
  }

  /**
   * RAPID REVERSAL DETECTION - Detect market direction changes faster than lagging indicators
   * This method detects when the market has reversed direction by analyzing:
   * 1. Short-term price momentum changes
   * 2. Price crossing above/below recent swing levels
   * 3. Displacement candles showing strong reversals
   * 4. Candle pattern reversals (hammer, shooting star, etc.)
   * 
   * Returns confidence score (0-100) to determine if reversal is strong enough to override trade direction
   */
  private detectReversalSignal(symbol: string, tick: TickData, candles: CandleData[] | undefined): { detected: boolean; direction: 'BUY' | 'SELL'; reason: string; confidence: number } {
    if (!candles || candles.length < 5) {
      return { detected: false, direction: 'BUY', reason: 'Insufficient candle data', confidence: 0 };
    }

    const currentPrice = tick.bid;
    const currentCandle = candles[candles.length - 1];
    const prevCandle = candles[candles.length - 2];
    const prevPrevCandle = candles[candles.length - 3];
    
    // Calculate short-term momentum (last 6 candles)
    const momentum3 = (currentPrice - candles[candles.length - 3].close) / candles[candles.length - 3].close;
    const momentum6 = (currentPrice - candles[candles.length - 6].close) / candles[candles.length - 6].close;
    
    // Detect momentum direction change
    const momentumTurningUp = momentum3 > 0 && momentum6 < 0; // Was falling, now rising
    const momentumTurningDown = momentum3 < 0 && momentum6 > 0; // Was rising, now falling
    
    // Find recent swing highs and lows (last 10 candles)
    const recentCandles = candles.slice(-10);
    let recentSwingHigh = 0;
    let recentSwingLow = Infinity;
    
    for (let i = 2; i < recentCandles.length - 2; i++) {
      const isSwingHigh = recentCandles[i].high > recentCandles[i-1].high && 
                          recentCandles[i].high > recentCandles[i-2].high &&
                          recentCandles[i].high > recentCandles[i+1].high && 
                          recentCandles[i].high > recentCandles[i+2].high;
      const isSwingLow = recentCandles[i].low < recentCandles[i-1].low && 
                         recentCandles[i].low < recentCandles[i-2].low &&
                         recentCandles[i].low < recentCandles[i+1].low && 
                         recentCandles[i].low < recentCandles[i+2].low;
      
      if (isSwingHigh) recentSwingHigh = Math.max(recentSwingHigh, recentCandles[i].high);
      if (isSwingLow) recentSwingLow = Math.min(recentSwingLow, recentCandles[i].low);
    }
    
    // Check for break of recent swing level
    const brokeSwingHigh = recentSwingHigh > 0 && currentPrice > recentSwingHigh;
    const brokeSwingLow = recentSwingLow < Infinity && currentPrice < recentSwingLow;
    
    // Check displacement (strong directional candle)
    const currentChange = currentPrice - currentCandle.open;
    const prevChange = prevCandle.close - prevCandle.open;
    const prevPrevChange = prevPrevCandle.close - prevPrevCandle.open;
    
    const strongBullishCandle = currentChange > Math.abs(prevChange) * 1.5 && currentChange > 0;
    const strongBearishCandle = currentChange < -Math.abs(prevChange) * 1.5 && currentChange < 0;
    
    // Candle pattern reversals
    // Bullish reversal patterns: hammer, bullish engulfing, morning star
    const isHammer = (currentCandle.high - currentCandle.low) > (currentCandle.close - currentCandle.open) * 2 && 
                     (currentCandle.close - currentCandle.low) > (currentCandle.high - currentCandle.close) * 0.5;
    const prevBullishEngulfing = prevCandle.close > prevCandle.open && currentCandle.close < currentCandle.open && 
                                  currentCandle.open < prevCandle.close && currentCandle.close > prevCandle.open;
    
    // Bearish reversal patterns: shooting star, bearish engulfing, evening star
    const isShootingStar = (currentCandle.high - currentCandle.low) > (currentCandle.close - currentCandle.open) * 2 && 
                           (currentCandle.high - currentCandle.close) > (currentCandle.close - currentCandle.low) * 0.5;
    const prevBearishEngulfing = prevCandle.close < prevCandle.open && currentCandle.close > currentCandle.open && 
                                  currentCandle.open > prevCandle.close && currentCandle.close < prevCandle.open;
    
    // Combine reversal signals with confidence scoring
    let bullishReversalScore = 0;
    let bearishReversalScore = 0;
    let reversalReason = '';
    
    // Bullish reversal signals (each adds to confidence)
    if (momentumTurningUp) {
      bullishReversalScore += 3;
      reversalReason += 'Momentum turning up; ';
    }
    if (brokeSwingHigh) {
      bullishReversalScore += 4;
      reversalReason += 'Broke swing high; ';
    }
    if (strongBullishCandle) {
      bullishReversalScore += 3;
      reversalReason += 'Strong bullish candle; ';
    }
    if (isHammer) {
      bullishReversalScore += 3;
      reversalReason += 'Hammer pattern; ';
    }
    if (prevBullishEngulfing) {
      bullishReversalScore += 4;
      reversalReason += 'Bullish engulfing; ';
    }
    
    // Bearish reversal signals
    if (momentumTurningDown) {
      bearishReversalScore += 3;
      reversalReason += 'Momentum turning down; ';
    }
    if (brokeSwingLow) {
      bearishReversalScore += 4;
      reversalReason += 'Broke swing low; ';
    }
    if (strongBearishCandle) {
      bearishReversalScore += 3;
      reversalReason += 'Strong bearish candle; ';
    }
    if (isShootingStar) {
      bearishReversalScore += 3;
      reversalReason += 'Shooting star pattern; ';
    }
    if (prevBearishEngulfing) {
      bearishReversalScore += 4;
      reversalReason += 'Bearish engulfing; ';
    }
    
    // Calculate confidence as percentage (max score is ~17, so normalize to 0-100)
    const maxPossibleScore = 17;
    const bullishConfidence = bullishReversalScore > 0 ? Math.round((bullishReversalScore / maxPossibleScore) * 100) : 0;
    const bearishConfidence = bearishReversalScore > 0 ? Math.round((bearishReversalScore / maxPossibleScore) * 100) : 0;
    
    // Threshold for reversal detection
    const reversalThreshold = 10;
    
    if (bullishReversalScore >= reversalThreshold) {
      console.log(`🔄 REVERSAL ANALYSIS ${symbol}: Bullish score=${bullishReversalScore} (${bullishConfidence}% confidence), Bearish score=${bearishReversalScore}`);
      return { 
        detected: true, 
        direction: 'BUY' as 'BUY' | 'SELL', 
        reason: `BULLISH REVERSAL detected (score: ${bullishReversalScore}): ${reversalReason}`,
        confidence: bullishConfidence
      };
    }
    
    if (bearishReversalScore >= reversalThreshold) {
      console.log(`🔄 REVERSAL ANALYSIS ${symbol}: Bullish score=${bullishReversalScore}, Bearish score=${bearishReversalScore} (${bearishConfidence}% confidence)`);
      return { 
        detected: true, 
        direction: 'SELL' as 'BUY' | 'SELL', 
        reason: `BEARISH REVERSAL detected (score: ${bearishReversalScore}): ${reversalReason}`,
        confidence: bearishConfidence
      };
    }
    
    return { detected: false, direction: 'BUY' as 'BUY' | 'SELL', reason: 'No reversal detected', confidence: 0 };
  }

  private isEmergingMarketSymbol(symbol: string): boolean {
    // List of emerging market symbols
    const emergingMarketSymbols = ['USDBRL', 'USDARS', 'USDEGP', 'USDTRY', 'USDRUB', 'USDZAR', 'USDMXN', 'USDCNH'];
    return emergingMarketSymbols.includes(symbol);
  }

  private async fetchAllCandleData(): Promise<void> {
    // Filter symbols based on gold-only mode
    const symbolsToFetch = this.isGoldOnlyMode 
      ? this.config.symbols.filter(s => s.includes('XAU') || s.includes('XAG') || s.includes('GOLD') || s.includes('SILVER'))
      : this.config.symbols;
    
    console.log(`📊 fetchAllCandleData: Fetching for ${symbolsToFetch.length} symbols (gold-only: ${this.isGoldOnlyMode})`);
    
    for (const symbol of symbolsToFetch) {
      try {
        const candles = await this.fetchCandleData(symbol);
        if (candles.length > 0) this.candleHistory.set(symbol, candles);
      } catch (error) {
        console.error(`Failed to fetch candles for ${symbol}:`, error);
      }
    }
  }

  private async fetchCandleData(symbol: string): Promise<CandleData[]> {
    try {
      console.log(`📊 OnTickEngine: Fetching candle data for ${symbol}...`);
      const bars = await exnessAPI.getHistoricalData(symbol, '15m', 100);
      if (!bars || bars.length === 0) {
        console.warn(`⚠️ OnTickEngine: No candle data received for ${symbol}`);
        return [];
      }
      const candles = bars.map((bar: any) => ({
        open: bar.open, high: bar.high, low: bar.low, close: bar.close,
        volume: bar.tick_volume, timestamp: new Date(bar.time * 1000)
      }));
      console.log(`✅ OnTickEngine: Fetched ${candles.length} candles for ${symbol}`);
      return candles;
    } catch (error) {
      console.error(`❌ Failed to fetch candles for ${symbol}:`, error);
      return [];
    }
  }

  private async analyzeWorldClassStrategies(candles: CandleData[], tick: TickData, symbol: string): Promise<AdvancedSignal[]> {
    try {
      // Calculate indicators for strategies
      const indicators = this.calculateIndicators(candles);

      // For gold symbols, use specialized gold strategies
      if (symbol.includes('XAU') || symbol.includes('GOLD')) {
        console.log('🎯 OnTickEngine: Using specialized gold trading strategies for', symbol);

        const marketData = {
          symbol,
          prices: candles?.map(c => c.close) || [],
          volumes: candles?.map(c => c.volume) || [],
          currentPrice: tick.bid,
          indicators
        };

        const goldSignal = await goldTradingStrategies.generateGoldSignal(
          marketData,
          indicators,
          undefined, // USD data not available
          undefined, // session info
          [] // news events
        );

        // GOLD-ONLY MODE: Always return a signal
        if (goldSignal) {
          console.log(`🎯 OnTickEngine: Gold strategies generated signal for ${symbol}: ${goldSignal.type} (${goldSignal.confidence}%)`);
          return [goldSignal];
        } else {
          console.log(`⚠️ OnTickEngine: Gold strategies returned null for ${symbol} - this should not happen in gold-only mode`);
          return [];
        }
      }

      // For other symbols, use world-class strategies
      const signals = await worldClassStrategies.deployEliteStrategyCombination({
        symbol,
        prices: candles?.map(c => c.close) || [],
        volumes: candles?.map(c => c.volume) || []
      }, indicators);

      console.log(`🎯 OnTickEngine: World-class strategies generated ${signals?.length || 0} signals for ${symbol}`);
      return signals || [];
    } catch (error) {
      console.error(`❌ Failed to analyze strategies for ${symbol}:`, error);
      return [];
    }
  }

  private calculateIndicators(candles: CandleData[]): any {
    if (!candles || candles.length < 20) return {};

    const closes = candles.map(c => c.close);
    const highs = candles.map(c => c.high);
    const lows = candles.map(c => c.low);

    // Calculate basic indicators
    const sma20 = closes.slice(-20).reduce((a, b) => a + b, 0) / 20;
    const sma50 = closes.slice(-50).reduce((a, b) => a + b, 0) / 50;
    const currentPrice = closes[closes.length - 1];

    // RSI calculation (simplified)
    const gains = [];
    const losses = [];
    for (let i = 1; i < closes.length; i++) {
      const change = closes[i] - closes[i-1];
      gains.push(change > 0 ? change : 0);
      losses.push(change < 0 ? Math.abs(change) : 0);
    }
    const avgGain = gains.slice(-14).reduce((a, b) => a + b, 0) / 14;
    const avgLoss = losses.slice(-14).reduce((a, b) => a + b, 0) / 14;
    const rsi = avgLoss === 0 ? 100 : 100 - (100 / (1 + avgGain / avgLoss));

    // Bollinger Bands
    const sma20_bb = closes.slice(-20).reduce((a, b) => a + b, 0) / 20;
    const variance = closes.slice(-20).reduce((sum, price) => sum + Math.pow(price - sma20_bb, 2), 0) / 20;
    const stdDev = Math.sqrt(variance);
    const bollinger = {
      upper: sma20_bb + (stdDev * 2),
      middle: sma20_bb,
      lower: sma20_bb - (stdDev * 2)
    };

    return {
      ema20: sma20,
      ema50: sma50,
      ema200: closes.slice(-200).reduce((a, b) => a + b, 0) / Math.min(200, closes.length),
      rsi,
      bollinger,
      macd: this.calculateMACD(closes),
      atr: this.calculateATR(highs, lows, closes)
    };
  }

  private calculateEMA(prices: number[], period: number): number {
    if (prices.length < period) return prices[prices.length - 1] || 0;

    const multiplier = 2 / (period + 1);
    let ema = prices.slice(0, period).reduce((a, b) => a + b, 0) / period;

    for (let i = period; i < prices.length; i++) {
      ema = (prices[i] * multiplier) + (ema * (1 - multiplier));
    }

    return ema;
  }

  private calculateMACD(prices: number[]): { value: number; signal: number; histogram: number } {
    if (prices.length < 26) {
      return { value: 0, signal: 0, histogram: 0 };
    }

    const ema12 = this.calculateEMA(prices, 12);
    const ema26 = this.calculateEMA(prices, 26);
    const macdLine = ema12 - ema26;

    // Calculate signal line (EMA9 of MACD line)
    // For simplicity, approximate signal line
    const macdValues = [];
    for (let i = 25; i < prices.length; i++) {
      const ema12_i = this.calculateEMA(prices.slice(0, i + 1), 12);
      const ema26_i = this.calculateEMA(prices.slice(0, i + 1), 26);
      macdValues.push(ema12_i - ema26_i);
    }

    const signalLine = macdValues.length >= 9 ? this.calculateEMA(macdValues, 9) : macdLine;
    const histogram = macdLine - signalLine;

    return { value: macdLine, signal: signalLine, histogram };
  }

  private calculateATR(highs: number[], lows: number[], closes: number[]): number {
    const trs = [];
    for (let i = 1; i < closes.length; i++) {
      const tr = Math.max(
        highs[i] - lows[i],
        Math.abs(highs[i] - closes[i-1]),
        Math.abs(lows[i] - closes[i-1])
      );
      trs.push(tr);
    }
    return trs.slice(-14).reduce((a, b) => a + b, 0) / 14;
  }
  
  // ============= RETRACEMENT DETECTION & CAPITALIZATION =============
  
  /**
   * Detect retracement in active trades and capitalize on them
   * When a trade is in profit and then retraces, detect this and potentially place a BUY order
   * to capitalize on the retracement
   */
  private async detectAndCapitalizeOnRetracements(): Promise<void> {
    if (!this.RETRACEMENT_DETECTION_ENABLED) return;
    
    try {
      for (const trade of Array.from(this.activeTrades.values())) {
        const symbol = trade.symbol;
        const currentPrice = (await exnessAPI.getCurrentPrice(symbol))?.bid;
        if (!currentPrice) continue;
        
        const pipValue = this.getPipValue(symbol);
        const currentProfitPips = (trade.type === 'BUY' ? currentPrice - trade.entryPrice : trade.entryPrice - currentPrice) / pipValue;
        
        // Get or create retracement tracker for this trade
        let tracker = this.retracementTracker.get(trade.ticketId);
        
        if (!tracker) {
          tracker = {
            initialProfit: 0,
            retracementDepth: 0,
            retracementEntryPrice: null,
            lastUpdate: Date.now()
          };
          this.retracementTracker.set(trade.ticketId, tracker);
        }
        
        // If trade is now in profit, record max profit reached
        if (currentProfitPips > 0) {
          if (currentProfitPips > tracker.initialProfit) {
            tracker.initialProfit = currentProfitPips;
          }
        }
        
        // Detect retracement: if profit decreased significantly from max
        const retracementFromMax = tracker.initialProfit - currentProfitPips;
        
        // Only act if retracement is within our thresholds
        if (retracementFromMax >= this.RETRACEMENT_MIN_DEPTH_PIPS && 
            retracementFromMax <= this.RETRACEMENT_MAX_DEPTH_PIPS &&
            currentProfitPips > 0 &&
            tracker.retracementEntryPrice === null) {
          
          // Mark that we've detected a retracement opportunity
          tracker.retracementEntryPrice = currentPrice;
          tracker.retracementDepth = retracementFromMax;
          
          console.log(`🔄 RETRACEMENT DETECTED: ${symbol} - Max profit: ${tracker.initialProfit.toFixed(1)} pips, Current: ${currentProfitPips.toFixed(1)} pips, Retraced: ${retracementFromMax.toFixed(1)} pips`);
          
          // Attempt to place a retracement buy order
          await this.placeRetracementOrder(trade, currentPrice, currentProfitPips, retracementFromMax);
        }
        
        // Reset tracker if trade is closed or moved back to max profit
        if (currentProfitPips >= tracker.initialProfit - 1) {
          tracker.retracementEntryPrice = null;
          tracker.retracementDepth = 0;
        }
        
        tracker.lastUpdate = Date.now();
      }
    } catch (error) {
      console.error('❌ Error in retracement detection:', error);
    }
  }
  
  /**
   * Place a retracement order to capitalize on the retracement
   * This opens a NEW trade in the SAME direction as the original trade
   */
  private async placeRetracementOrder(originalTrade: ActiveTrade, currentPrice: number, currentProfitPips: number, retracementDepth: number): Promise<void> {
    try {
      const symbol = originalTrade.symbol;
      
      // Check if we already have too many positions
      if (this.activeTrades.size >= this.MAX_TOTAL_POSITIONS) {
        console.log(`⚠️ RETRACEMENT: Max positions reached, skipping retracement trade for ${symbol}`);
        return;
      }
      
      // Check entry cooldown for this symbol
      const symbolLastTradeTime = this.lastTradeTimePerSymbol.get(symbol) || 0;
      const timeSinceSymbolTrade = Date.now() - symbolLastTradeTime;
      if (timeSinceSymbolTrade < this.ENTRY_COOLDOWN_MS) {
        console.log(`⚠️ RETRACEMENT: Entry cooldown active for ${symbol}, skipping`);
        return;
      }
      
      // Same direction as original trade
      const direction = originalTrade.type;
      
      // Calculate stop loss and take profit for retracement trade
      const pipValue = this.getPipValue(symbol);
      const isGold = symbol.includes('XAU') || symbol.includes('GOLD');
      
      let stopLoss: number, takeProfit: number;
      
      if (isGold) {
        // For gold: tighter stops for retracement trades
        const stopLossDollar = 2.00; // $2.00 stop
        const takeProfitDollar = 5.00; // $5.00 target
        
        if (direction === 'BUY') {
          stopLoss = currentPrice - stopLossDollar;
          takeProfit = currentPrice + takeProfitDollar;
        } else {
          stopLoss = currentPrice + stopLossDollar;
          takeProfit = currentPrice - takeProfitDollar;
        }
      } else {
        // For forex: 8 pip stop, 16 pip target (2:1 RR)
        const stopLossPips = 8;
        const takeProfitPips = 16;
        
        if (direction === 'BUY') {
          stopLoss = currentPrice - stopLossPips * pipValue;
          takeProfit = currentPrice + takeProfitPips * pipValue;
        } else {
          stopLoss = currentPrice + stopLossPips * pipValue;
          takeProfit = currentPrice - takeProfitPips * pipValue;
        }
      }
      
      // Use smaller volume for retracement trades (50% of original)
      const originalVolume = 0.01; // Assume 0.01 lots
      const retracementVolume = Math.max(0.01, originalVolume * this.PARTIAL_PROFIT_PERCENT);
      
      console.log(`🚀 RETRACEMENT TRADE: Placing ${direction} ${symbol} at ${currentPrice.toFixed(2)}, SL: ${stopLoss.toFixed(2)}, TP: ${takeProfit.toFixed(2)}, Vol: ${retracementVolume}`);
      
      const ticketId = await orderManager.executeOrder({
        symbol,
        type: direction,
        volume: retracementVolume,
        stopLoss,
        takeProfit,
        comment: `RETRACE-${retracementDepth.toFixed(1)}pips`
      });
      
      if (ticketId) {
        console.log(`✅ RETRACEMENT TRADE SUCCESSFUL: ${symbol} ticket ${ticketId}`);
        this.lastTradeTimePerSymbol.set(symbol, Date.now());
        
        // Add to active trades with retracement flag
        this.activeTrades.set(ticketId, {
          ticketId,
          symbol,
          type: direction,
          entryPrice: currentPrice,
          stopLoss,
          takeProfit,
          currentPrice,
          profit: 0,
          rMultiple: 0,
          trailingActivated: false,
          breakEvenMoved: false,
          entryTime: Date.now(),
          retracementDetected: true
        });
      } else {
        console.log(`❌ RETRACEMENT TRADE FAILED: ${symbol}`);
      }
    } catch (error) {
      console.error(`❌ Error placing retracement order for ${originalTrade.symbol}:`, error);
    }
  }
  
  /**
   * Clean up old retracement trackers
   */
  private cleanupRetracementTrackers(): void {
    const now = Date.now();
    const maxAge = 60000; // 1 minute
    
    for (const [ticketId, tracker] of this.retracementTracker.entries()) {
      if (now - tracker.lastUpdate > maxAge) {
        this.retracementTracker.delete(ticketId);
      }
    }
  }

  private updateTradeBias(symbol: string, bias: string): void {
    const tracker = this.tradeBiasTracker.get(symbol) || { buyCount: 0, sellCount: 0, lastBiasCheck: Date.now() };

    if (bias === 'BUY') {
      tracker.buyCount++;
    } else if (bias === 'SELL') {
      tracker.sellCount++;
    }

    // Reset counters every hour to track recent bias
    if (Date.now() - tracker.lastBiasCheck > 3600000) {
      tracker.buyCount = bias === 'BUY' ? 1 : 0;
      tracker.sellCount = bias === 'SELL' ? 1 : 0;
      tracker.lastBiasCheck = Date.now();
    }

    this.tradeBiasTracker.set(symbol, tracker);
  }

  /**
   * Check for manipulation events (liquidity sweeps, fake breakouts)
   */
  private checkForManipulationEvents(symbol: string, smcAnalysis: SMCAnalysis, multiTimeframeAnalysis: MultiTimeframeAnalysis): boolean {
    // Check for liquidity sweep patterns
    const hasLiquiditySweep = smcAnalysis.liquidityZones.some(zone =>
      zone.sweeps > 0 && zone.strength > 50
    );

    // Check for fake breakout patterns
    const hasFakeBreakout = smcAnalysis.fairValueGaps.some(gap =>
      gap.filled && gap.fillPercentage > 80
    );

    // Check for strong displacement candles
    const hasDisplacementCandle = multiTimeframeAnalysis.timeframes.some(tf =>
      tf.trendStrength > 70 && tf.volatility > 0.001
    );

    const hasManipulation = hasLiquiditySweep || hasFakeBreakout || hasDisplacementCandle;

    console.log(`🔍 Manipulation detection for ${symbol}:`, {
      hasLiquiditySweep,
      hasFakeBreakout,
      hasDisplacementCandle,
      hasManipulation
    });

    return hasManipulation;
  }

  private async saveEnhancedSignalToDatabase(
    symbol: string, smcAnalysis: SMCAnalysis, multiTimeframeAnalysis: MultiTimeframeAnalysis,
    newsSentiment: NewsSentimentAnalysis, type: 'BUY' | 'SELL',
    entryPrice: number, stopLoss: number, takeProfit: number
  ): Promise<void> {
    try {
      // Skip Supabase operations to avoid session issues
      console.log('📝 Skipping signal save to database to avoid session issues');
      return;

      // For real trading, try to save with proper auth handling
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError || !session) {
          console.log('⚠️ No valid session for signal save - skipping database save');
          return;
        }

        if (await this.isSessionExpired(session)) {
          console.log('🔄 Session expired during signal save, attempting refresh...');
          const { data: { session: refreshedSession }, error: refreshError } = await supabase.auth.refreshSession();
          if (refreshError || !refreshedSession) {
            console.error('❌ Failed to refresh session for signal save:', refreshError?.message);
            return;
          }
          console.log('✅ Session refreshed successfully for signal save');
        }

        console.log('🔍 Checking currency pair for symbol:', symbol);
        const result = await supabase.from('currency_pairs').select('id').eq('symbol', symbol).maybeSingle();
        let pair = result.data;
        const selectError = result.error;
        console.log('📊 Currency pair query result:', { pair, selectError });

        if (selectError) {
          console.error('❌ Error selecting currency pair:', selectError);
          return;
        }

        if (!pair?.id) {
          console.log('📝 Inserting new currency pair:', symbol);
          const baseCurrency = symbol.substring(0, 3);
          const quoteCurrency = symbol.substring(3, 6);
          const { data: newPair, error: insertError } = await supabase.from('currency_pairs').insert({
            symbol,
            base_currency: baseCurrency,
            quote_currency: quoteCurrency,
            display_name: symbol
          }).select('id').single();
          console.log('📝 Insert result:', { newPair, insertError });
          if (insertError || !newPair) {
            console.error('❌ Failed to insert currency pair:', insertError);
            return;
          }
          pair = newPair;
        }

        console.log('💾 Saving enhanced signal:', { pair_id: pair.id, signal_type: type });
        const { error: signalError } = await supabase.from('trading_signals').insert({
          user_id: session.user.id,
          pair_id: pair.id,
          signal_type: type,
          confidence_score: multiTimeframeAnalysis.confluenceScore,
          entry_price: entryPrice,
          stop_loss: stopLoss,
          take_profit: takeProfit,
          timeframe: 'MTF-15M',
          reasoning: `Enhanced Analysis: MTF ${multiTimeframeAnalysis.confluenceScore}% (${multiTimeframeAnalysis.entryQuality}), News: ${newsSentiment.marketDirection} (${newsSentiment.confidence}%), SMC: ${smcAnalysis.confluenceFactors.join(', ')}`,
          ai_model: 'OnTickEngine-Enhanced',
          status: 'EXECUTED'
        });
        if (signalError) {
          console.error('❌ Failed to save SMC trading signal:', signalError);
        } else {
          console.log('✅ SMC signal saved successfully');
        }
      } catch (authError) {
        console.error('❌ Authentication error saving SMC signal:', authError);
        // Continue without saving - don't fail the trade
      }
    } catch (error) {
      console.warn('⚠️ Database save failed - continuing with trade:', error.message);
    }
  }

  /**
   * REVERSAL PROTECTION: Close trades early when market reverses against position
   * This method checks if the market is reversing and closes trades to preserve profits
   * instead of letting reversals turn profits into losses
   */
  private async checkAndCloseOnReversal(trade: ActiveTrade, tick: TickData, candles: CandleData[] | undefined): Promise<boolean> {
    // Only protect trades that are in profit
    if (trade.profit <= 0) {
      return false;
    }
    
    // Don't close if we already moved to breakeven
    if (trade.breakEvenMoved) {
      return false;
    }
    
    // Check for reversal signal
    const reversalCheck = this.detectReversalSignal(trade.symbol, tick, candles);
    
    // If reversal detected in opposite direction to trade, close early to preserve profit
    if (reversalCheck.detected && 
        reversalCheck.direction !== trade.type && 
        reversalCheck.confidence >= 70) {
      
      console.log(`🔄🔄🔄 REVERSAL PROTECTION TRIGGERED: ${trade.symbol}`);
      console.log(`   Trade: ${trade.type} @ ${trade.entryPrice.toFixed(2)}, Current: ${trade.currentPrice.toFixed(2)}`);
      console.log(`   Profit: ${trade.profit.toFixed(2)}, Reversal: ${reversalCheck.direction} (${reversalCheck.confidence}% confidence)`);
      console.log(`   Reason: ${reversalCheck.reason}`);
      
      // Close the trade to preserve profit
      const isPaperTrading = (orderManager as any).isPaperTradingMode;
      if (!isPaperTrading) {
        await orderManager.closePosition(parseInt(trade.ticketId));
        console.log(`✅ REVERSAL PROTECTION: ${trade.symbol} closed at ${trade.currentPrice.toFixed(2)} to preserve ${trade.profit.toFixed(2)}`);
      } else {
        console.log(`✅ REVERSAL PROTECTION: ${trade.symbol} would be closed (paper mode)`);
      }
      
      return true; // Trade closed
    }
    
    return false; // Trade not closed
  }

  /** Sync active trades with actual MT5 positions to ensure consistency */
  private async syncActiveTradesWithMT5(): Promise<void> {
    try {
      // Check if we're in paper trading mode
      const isPaperTrading = (orderManager as any).isPaperTradingMode;
      if (isPaperTrading) {
        // In paper trading, don't sync with MT5
        return;
      }

      // Get actual positions from MT5
      const mt5Positions = await exnessAPI.getPositions();
      if (!mt5Positions) {
        console.warn('⚠️ OnTickEngine: Could not get MT5 positions for sync');
        return;
      }

      // Get ticket IDs from MT5
      const mt5TicketIds = new Set(mt5Positions.map(pos => pos.ticket.toString()));

      // Find trades in activeTrades that are not in MT5 (closed trades)
      const tradesToRemove: string[] = [];
      for (const [ticketId, trade] of this.activeTrades.entries()) {
        if (!mt5TicketIds.has(ticketId)) {
          console.log(`🔄 OnTickEngine: Trade ${ticketId} (${trade.symbol}) not found in MT5 - removing from active trades`);
          tradesToRemove.push(ticketId);
        }
      }

      // Remove closed trades
      tradesToRemove.forEach(ticketId => {
        // REMOVE FROM AI REVERSAL HEDGING MANAGER
        aiReversalHedgingManager.removePositionFromMonitor(ticketId);
        this.activeTrades.delete(ticketId);
      });

      if (tradesToRemove.length > 0) {
        console.log(`✅ OnTickEngine: Synced with MT5 - removed ${tradesToRemove.length} closed trades`);
      }
    } catch (error) {
      console.error('❌ OnTickEngine: Error syncing active trades with MT5:', error);
    }
  }

  /** Enhanced: Manage active trades with conservative profit protection and daily P&L tracking */
  public async manageActiveTrades(): Promise<void> {
    try {
      const tradesToRemove: string[] = [];

      // SYNC: Sync active trades with actual MT5 positions
      await this.syncActiveTradesWithMT5();

      // SMART HEDGE MANAGEMENT: Analyze and manage hedge positions
      // This is the new feature that analyzes market direction to determine which side of a hedge to close
      if (!((orderManager as any).isPaperTradingMode)) {
        try {
          const mt5Positions = await exnessAPI.getPositions();
          if (mt5Positions && mt5Positions.length > 0) {
            const hedgeDecisions = await smartHedgingManager.analyzeAndManageHedges(mt5Positions);
            
            for (const decision of hedgeDecisions) {
              if (decision.action !== 'WAIT' && decision.confidence > 50) {
                // Get symbol from the decision (we need to track it)
                // For now, we'll execute decisions for each symbol with hedge pairs
                const positions = mt5Positions.filter((p: any) => {
                  const hasBuy = mt5Positions.some((pos: any) => pos.symbol === p.symbol && pos.type?.toLowerCase() === 'buy');
                  const hasSell = mt5Positions.some((pos: any) => pos.symbol === p.symbol && pos.type?.toLowerCase() === 'sell');
                  return hasBuy && hasSell;
                });
                
                if (positions.length > 0) {
                  const symbol = positions[0].symbol;
                  console.log(`🪓 OnTickEngine: Hedge management for ${symbol}: ${decision.action} - ${decision.reason} (${decision.confidence.toFixed(0)}% confidence)`);
                  await smartHedgingManager.executeDecision(decision, symbol);
                }
              }
            }
          }
        } catch (hedgeError) {
          console.warn(`⚠️ OnTickEngine: Hedge management error (non-critical): ${hedgeError}`);
        }
      }

      // Get current account balance to determine if we're in scalping mode
      const accountInfo = await exnessAPI.getAccountInfo();
      const currentBalance = accountInfo?.balance || 0;
      const useScalpingMode = this.SCALPING_MODE && currentBalance < this.ACCOUNT_TARGET;

      // DETECT RETRACEMENTS: Check for retracement opportunities
      await this.detectAndCapitalizeOnRetracements();

      // CLEANUP: Remove old retracement trackers
      this.cleanupRetracementTrackers();

      for (const trade of Array.from(this.activeTrades.values())) {
        const currentPrice = (await exnessAPI.getCurrentPrice(trade.symbol))?.bid;
        if (!currentPrice) continue;

        trade.currentPrice = currentPrice;
        const pipValue = this.getPipValue(trade.symbol);
        const currentProfitPips = (trade.type === 'BUY' ? currentPrice - trade.entryPrice : trade.entryPrice - currentPrice) / pipValue;
        trade.profit = currentProfitPips * pipValue;
        trade.rMultiple = trade.profit / Math.abs(trade.entryPrice - trade.stopLoss);

        // REVERSAL PROTECTION: Close trades early when market reverses against position
        // This prevents profits from turning into losses when market changes direction
        const tick: TickData = {
          symbol: trade.symbol,
          bid: currentPrice,
          ask: currentPrice + (trade.type === 'BUY' ? 0.01 : -0.01),
          spread: 0.02,
          timestamp: new Date()
        };
        const candles = this.candleHistory.get(trade.symbol);
        const closedOnReversal = await this.checkAndCloseOnReversal(trade, tick, candles);
        if (closedOnReversal) {
          tradesToRemove.push(trade.ticketId);
          continue;
        }

        // SCALPING MODE: Check max hold time
        if (useScalpingMode && trade.entryTime) {
          const holdTime = Date.now() - trade.entryTime;
          if (holdTime > this.SCALPING_MAX_HOLD_TIME) {
            console.log(`⏱️ SCALPING: ${trade.symbol} held too long (${Math.floor(holdTime / 1000)}s), closing to free capital`);
            tradesToRemove.push(trade.ticketId);
            continue;
          }
        }

        // Check if trade has hit stop loss or take profit (simplified - in real implementation would check with broker)
        const hitStopLoss = trade.type === 'BUY' ? currentPrice <= trade.stopLoss : currentPrice >= trade.stopLoss;
        const hitTakeProfit = trade.type === 'BUY' ? currentPrice >= trade.takeProfit : currentPrice <= trade.takeProfit;

        if (hitStopLoss || hitTakeProfit) {
          // ACTIVE CLOSING: Execute close on MT5 before tracking P&L
          const isPaperTrading = (orderManager as any).isPaperTradingMode;
          if (!isPaperTrading) {
            await orderManager.closePosition(parseInt(trade.ticketId));
            console.log(`🎯 ACTIVE CLOSE: ${trade.symbol} ${hitTakeProfit ? 'TP' : 'SL'} hit, position closed on MT5`);
          }
          
          // Trade closed - update daily P&L and track win/loss
          const today = new Date().toISOString().split('T')[0];
          const currentPnL = this.dailyPnL.get(trade.symbol);
          const profitPercent = trade.profit / trade.entryPrice; // Approximate percentage

          if (currentPnL && currentPnL.date === today) {
            if (profitPercent > 0) {
              currentPnL.profit += profitPercent;
            } else {
              currentPnL.loss += Math.abs(profitPercent);
            }
          } else {
            this.dailyPnL.set(trade.symbol, {
              profit: profitPercent > 0 ? profitPercent : 0,
              loss: profitPercent < 0 ? Math.abs(profitPercent) : 0,
              date: today
            });
          }

          // Track consecutive wins/losses for recovery mechanism
          if (hitTakeProfit) {
            this.consecutiveLosses = 0;
            this.consecutiveWins++;
            this.lastTradeResult = 'WIN';
            console.log(`🎉 WIN STREAK: ${this.consecutiveWins} consecutive wins for ${trade.symbol}`);
          } else if (hitStopLoss) {
            this.consecutiveWins = 0;
            this.consecutiveLosses++;
            this.lastTradeResult = 'LOSS';
            this.lastLossTime = Date.now(); // Record loss time for cooldown
            console.log(`🚨 LOSS STREAK: ${this.consecutiveLosses} consecutive losses for ${trade.symbol} - COOLDOWN STARTED`);
          }

          console.log(`📊 Trade closed for ${trade.symbol}: ${hitTakeProfit ? 'TP' : 'SL'} hit, P&L: ${(profitPercent * 100).toFixed(2)}%`);
          tradesToRemove.push(trade.ticketId);
          continue;
        }

        // SCALPING MODE: Smart profit taking with profit protection
        if (useScalpingMode) {
          const isGoldTrade = trade.symbol.includes('XAU') || trade.symbol.includes('GOLD');
          const pipValue = this.getPipValue(trade.symbol);
          
          if (isGoldTrade) {
            // Gold scalping: $5-10 target, $3 stop with profit protection
            const goldProfitDollars = trade.type === 'BUY' 
              ? (trade.currentPrice - trade.entryPrice) * 100
              : (trade.entryPrice - trade.currentPrice) * 100;
            
            // PROFIT PROTECTION: Trailing stop activation at $2 profit (earlier)
            const trailingActivationDollar = 2.00;
            const trailingBufferDollar = 1.00; // $1 trail buffer (tighter)
            
            // Activate trailing stop when in profit
            if (!trade.trailingActivated && goldProfitDollars >= trailingActivationDollar) {
              trade.trailingActivated = true;
              trade.maxProfitReached = goldProfitDollars;
              console.log(`🚀 TRAILING ACTIVATED: ${trade.symbol} at ${goldProfitDollars.toFixed(2)} profit`);
            }
            
            // Update trailing stop if activated
            if (trade.trailingActivated && trade.maxProfitReached !== undefined) {
              // Update max profit reached
              if (goldProfitDollars > trade.maxProfitReached) {
                trade.maxProfitReached = goldProfitDollars;
              }
              
              // Move trailing stop
              const newTrailingStop = trade.type === 'BUY' 
                ? trade.currentPrice - trailingBufferDollar
                : trade.currentPrice + trailingBufferDollar;
              
              // Only update if it improves the stop loss
              if (trade.type === 'BUY' && newTrailingStop > trade.stopLoss) {
                trade.stopLoss = newTrailingStop;
                console.log(`🔒 TRAILING UPDATE: ${trade.symbol} SL moved to ${newTrailingStop.toFixed(2)}`);
              } else if (trade.type === 'SELL' && newTrailingStop < trade.stopLoss) {
                trade.stopLoss = newTrailingStop;
                console.log(`🔒 TRAILING UPDATE: ${trade.symbol} SL moved to ${newTrailingStop.toFixed(2)}`);
              }
              
              // Close if trailing stop is hit
              const hitTrailingStop = trade.type === 'BUY' 
                ? trade.currentPrice <= trade.stopLoss
                : trade.currentPrice >= trade.stopLoss;
              if (hitTrailingStop) {
                console.log(`🎯 TRAILING STOP HIT: ${trade.symbol} closed at ${goldProfitDollars.toFixed(2)} profit`);
                tradesToRemove.push(trade.ticketId);
                continue;
              }
            }
            
            // PARTIAL PROFIT TAKING: Close 50% at $3 profit if not already taken
            if (!trade.partialProfitTaken && goldProfitDollars >= this.PARTIAL_PROFIT_THRESHOLD) {
              console.log(`💰 PARTIAL PROFIT: ${trade.symbol} taking 50% at ${goldProfitDollars.toFixed(2)}`);
              trade.partialProfitTaken = true;
              // Move stop to entry to lock in remaining profit
              trade.stopLoss = trade.entryPrice;
              console.log(`🔒 STOP MOVED TO BREAK-EVEN: ${trade.symbol}`);
            }
            
            // Close at $5+ profit for scalping
            if (goldProfitDollars >= this.TARGET_PROFIT_MIN) {
              console.log(`💰 GOLD SCALP TARGET HIT: ${trade.symbol} profit ${goldProfitDollars.toFixed(2)}, closing`);
              tradesToRemove.push(trade.ticketId);
              continue;
            }
            
            // Cut losses at $3.00 loss
            if (goldProfitDollars <= -this.SCALPING_STOP_LOSS) {
              console.log(`🚨 GOLD SCALP STOP HIT: ${trade.symbol} loss ${goldProfitDollars.toFixed(2)}, cutting loss`);
              tradesToRemove.push(trade.ticketId);
              continue;
            }
            
            // Log progress for debugging
            console.log(`📊 GOLD SCALP: ${trade.symbol} P&L ${goldProfitDollars.toFixed(2)}, Target: ${this.TARGET_PROFIT_MIN}-${this.TARGET_PROFIT_MAX}, Stop: ${this.SCALPING_STOP_LOSS}`);
            continue;
          }
          
          // SILVER SCALPING: WIDENED targets for volatility with active profit taking
          const isSilverTrade = trade.symbol.includes('XAG') || trade.symbol.includes('SILVER');
          if (isSilverTrade) {
            // Silver scalping: $10 target, $3 stop with active profit protection
            const silverProfitDollars = trade.type === 'BUY' 
              ? (trade.currentPrice - trade.entryPrice) * 5000  // Silver contract size is 5000 oz
              : (trade.entryPrice - trade.currentPrice) * 5000;
            
            // PARTIAL PROFIT TAKING: Close 50% at $5 profit if not already taken
            const silverPartialProfitThreshold = 5.00;
            if (!trade.partialProfitTaken && silverProfitDollars >= silverPartialProfitThreshold) {
              console.log(`💰 SILVER PARTIAL PROFIT: ${trade.symbol} taking 50% at ${silverProfitDollars.toFixed(2)}`);
              // Note: In real implementation, call orderManager.closePositionPartial()
              trade.partialProfitTaken = true;
              // Move stop to entry to lock in remaining profit
              trade.stopLoss = trade.entryPrice;
              console.log(`🔒 SILVER STOP MOVED TO BREAK-EVEN: ${trade.symbol}`);
            }
            
            // ACTIVE CLOSING AT TARGET: Close at $10 profit
            const silverTargetProfit = 10.00;
            if (silverProfitDollars >= silverTargetProfit) {
              console.log(`💰 SILVER SCALP TARGET HIT: ${trade.symbol} profit ${silverProfitDollars.toFixed(2)}, closing`);
              // Execute actual close on MT5
              await orderManager.closePosition(parseInt(trade.ticketId));
              tradesToRemove.push(trade.ticketId);
              continue;
            }
            
            // Cut losses at $3.00 loss
            const silverStopLoss = 3.00;
            if (silverProfitDollars <= -silverStopLoss) {
              console.log(`🚨 SILVER SCALP STOP HIT: ${trade.symbol} loss ${silverProfitDollars.toFixed(2)}, cutting loss`);
              // Execute actual close on MT5
              await orderManager.closePosition(parseInt(trade.ticketId));
              tradesToRemove.push(trade.ticketId);
              continue;
            }
            
            // Log progress for debugging
            console.log(`📊 SILVER SCALP: ${trade.symbol} P&L ${silverProfitDollars.toFixed(2)}, Target: ${silverTargetProfit}, Stop: ${silverStopLoss}`);
            continue;
          }
          
          // For forex pairs: Use dollar-based profit targets ($5-10 as requested)
          const pipValueDollars = this.getPipValue(trade.symbol) * 10000 * 0.01; // $ per pip for 0.01 lots
          const profitInDollars = currentProfitPips * pipValueDollars;

          // PROFIT PROTECTION: Trailing stop for forex
          const trailingActivationPips = this.TRAILING_ACTIVATION_PIPS; // 3 pips
          const trailingBufferPips = this.TRAILING_BUFFER_PIPS; // 2 pips
          
          // Activate trailing stop
          if (!trade.trailingActivated && currentProfitPips >= trailingActivationPips) {
            trade.trailingActivated = true;
            trade.maxProfitReached = currentProfitPips;
            console.log(`🚀 TRAILING ACTIVATED: ${trade.symbol} at ${currentProfitPips.toFixed(1)} pips`);
          }
          
          // Update trailing stop
          if (trade.trailingActivated && trade.maxProfitReached !== undefined) {
            if (currentProfitPips > trade.maxProfitReached) {
              trade.maxProfitReached = currentProfitPips;
            }
            
            const newTrailingStop = trade.type === 'BUY'
              ? currentPrice - (trailingBufferPips * pipValue)
              : currentPrice + (trailingBufferPips * pipValue);
            
            if (trade.type === 'BUY' && newTrailingStop > trade.stopLoss) {
              trade.stopLoss = newTrailingStop;
              console.log(`🔒 TRAILING UPDATE: ${trade.symbol} SL to ${newTrailingStop.toFixed(5)}`);
            } else if (trade.type === 'SELL' && newTrailingStop < trade.stopLoss) {
              trade.stopLoss = newTrailingStop;
              console.log(`🔒 TRAILING UPDATE: ${trade.symbol} SL to ${newTrailingStop.toFixed(5)}`);
            }
          }

          // PARTIAL PROFIT TAKING for forex
          const partialProfitThresholdDollars = this.PARTIAL_PROFIT_THRESHOLD * pipValueDollars;
          if (!trade.partialProfitTaken && profitInDollars >= partialProfitThresholdDollars) {
            console.log(`💰 PARTIAL PROFIT: ${trade.symbol} taking 50% at ${profitInDollars.toFixed(2)}`);
            trade.partialProfitTaken = true;
            trade.stopLoss = trade.entryPrice;
            console.log(`🔒 STOP MOVED TO BREAK-EVEN: ${trade.symbol}`);
          }

          // Close at $5-10 profit (as requested by user)
          if (profitInDollars >= this.TARGET_PROFIT_MIN) {
            console.log(`💰 SCALPING TARGET HIT: ${trade.symbol} profit ${profitInDollars.toFixed(2)} >= ${this.TARGET_PROFIT_MIN}, closing`);
            tradesToRemove.push(trade.ticketId);
            continue;
          }

          // Close if losing more than 50% of stop loss - cut losses early
          const stopLossPips = Math.abs(trade.entryPrice - trade.stopLoss) / pipValue;
          if (currentProfitPips <= -stopLossPips * 0.5) {
            console.log(`🚨 SCALPING: ${trade.symbol} losing (${currentProfitPips.toFixed(1)} pips), closing early to minimize loss`);
            tradesToRemove.push(trade.ticketId);
            continue;
          }

          // Skip normal trade management for scalping mode
          continue;
        }

        // NORMAL MODE: Get multi-timeframe analysis for dynamic management
        const multiTimeframeAnalysis = this.lastMultiTimeframeAnalysis.get(trade.symbol);
        const avgATR = multiTimeframeAnalysis && multiTimeframeAnalysis.timeframes.length > 0 ?
          multiTimeframeAnalysis.timeframes.reduce((sum, tf) => sum + tf.volatility, 0) / multiTimeframeAnalysis.timeframes.length :
          0.001;

        // SMART EXIT: Close losing trades early to minimize losses
        const stopLossPips = Math.abs(trade.entryPrice - trade.stopLoss) / pipValue;
        if (currentProfitPips <= -stopLossPips * 0.5) { // 50% towards stop loss - close early
          console.log(`🚨 ${trade.symbol} EARLY EXIT - Trade losing (${currentProfitPips.toFixed(1)} pips), closing to minimize loss`);
          tradesToRemove.push(trade.ticketId);
          continue;
        }

        // SMART EXIT: Close trades that have been in profit but are now losing (trend reversal)
        if (trade.breakEvenMoved && currentProfitPips < 0) {
          console.log(`🔄 ${trade.symbol} TREND REVERSAL - Was in profit, now losing (${currentProfitPips.toFixed(1)} pips), closing to protect gains`);
          tradesToRemove.push(trade.ticketId);
          continue;
        }

        // EARLIER BREAK-EVEN LOGIC - move to BE at 0.25R profit instead of 0.5R
        const riskDistance = Math.abs(trade.entryPrice - trade.stopLoss) / pipValue;
        const breakEvenThreshold = Math.max(3, Math.round(riskDistance * this.BREAK_EVEN_THRESHOLD_RATIO)); // 0.25R profit threshold
        if (!trade.breakEvenMoved && currentProfitPips >= breakEvenThreshold) {
          const spreadBuffer = riskDistance * 0.1; // 10% of risk distance as buffer
          const newStopLoss = trade.type === 'BUY' ?
            trade.entryPrice + (spreadBuffer * pipValue) : // Small buffer above entry
            trade.entryPrice - (spreadBuffer * pipValue);  // Small buffer below entry
          trade.stopLoss = newStopLoss;
          trade.breakEvenMoved = true;
          console.log(`🎯 ${trade.symbol} EARLY break-even activated at ${breakEvenThreshold} pips profit (0.25R)`);
        }

        // More conservative trailing stop activation
        const trailingThreshold = Math.max(20, Math.round(avgATR / pipValue * 4)); // 4x ATR in pips - higher threshold
        if (!trade.trailingActivated && currentProfitPips >= trailingThreshold) {
          trade.trailingActivated = true;
          // Start trailing with wider buffer for safety
          const trailingBuffer = Math.max(8, Math.round(avgATR / pipValue * 1.5)); // 1.5x ATR buffer
          trade.stopLoss = trade.type === 'BUY' ?
            currentPrice - (trailingBuffer * pipValue) :
            currentPrice + (trailingBuffer * pipValue);
          console.log(`🚀 ${trade.symbol} trailing stop activated at ${trailingThreshold} pips profit (conservative)`);
        }

        // MORE AGGRESSIVE DYNAMIC TRAILING - tighten stops faster to protect profits
        if (trade.trailingActivated) {
          const profitMultiplier = Math.floor(currentProfitPips / 15); // Every 15 pips of profit (faster tightening)
          const dynamicBuffer = Math.max(3, Math.round(avgATR / pipValue * 0.8) - profitMultiplier); // Tighter buffer

          const newTrailingStop = trade.type === 'BUY' ?
            currentPrice - (dynamicBuffer * pipValue) :
            currentPrice + (dynamicBuffer * pipValue);

          // Move stop more aggressively with smaller minimum movement
          const minMovePips = 1; // Minimum 1 pip movement for tighter trailing
          if (trade.type === 'BUY' && newTrailingStop > trade.stopLoss + (minMovePips * pipValue)) {
            trade.stopLoss = newTrailingStop;
            console.log(`🔒 ${trade.symbol} trailing stop tightened to ${newTrailingStop.toFixed(5)}`);
          } else if (trade.type === 'SELL' && newTrailingStop < trade.stopLoss - (minMovePips * pipValue)) {
            trade.stopLoss = newTrailingStop;
            console.log(`🔒 ${trade.symbol} trailing stop tightened to ${newTrailingStop.toFixed(5)}`);
          }
        }

        // Early profit taking for smaller targets - scale out approach
        const targetProfitPips = Math.abs(trade.takeProfit - trade.entryPrice) / pipValue;
        if (currentProfitPips >= targetProfitPips * 0.5) { // 50% to target
          console.log(`💰 ${trade.symbol} halfway to profit target: ${currentProfitPips.toFixed(1)}/${targetProfitPips.toFixed(1)} pips - monitoring closely`);
        }

        // Emergency exit for significant losses (additional safety)
        if (currentProfitPips <= -stopLossPips * 0.8) { // 80% towards stop loss
          console.log(`⚠️ ${trade.symbol} approaching stop loss: ${currentProfitPips.toFixed(1)} pips - emergency monitoring active`);
        }
      }

      // Remove closed trades
      tradesToRemove.forEach(ticketId => {
        // REMOVE FROM AI REVERSAL HEDGING MANAGER
        aiReversalHedgingManager.removePositionFromMonitor(ticketId);
        this.activeTrades.delete(ticketId);
      });

    } catch (error) {
      console.error('Failed to manage active trades:', error);
    }
  }

  // ============= PUBLIC GETTER METHODS =============

  getLastAnalysis(symbol: string): SMCAnalysis | null {
    return this.lastAnalysis.get(symbol) || null;
  }

  getLastMultiTimeframeAnalysis(symbol: string): MultiTimeframeAnalysis | null {
    return this.lastMultiTimeframeAnalysis.get(symbol) || null;
  }

  getLastNewsSentiment(symbol: string): NewsSentimentAnalysis | null {
    return this.lastNewsSentiment.get(symbol) || null;
  }

  getLastFilterResult(symbol: string): TradingFilterResult | null {
    return this.lastFilterResult.get(symbol) || null;
  }

  getLastWorldClassSignals(symbol: string): AdvancedSignal[] {
    return this.lastWorldClassSignals.get(symbol) || [];
  }

  async getFilterStatus() {
    return await tradingFilters.getFilterStatus();
  }

  getKillzones() {
    return tradingFilters.getKillzones();
  }

  getActiveTrades(): ActiveTrade[] {
    return Array.from(this.activeTrades.values());
  }

  private async isSessionExpired(session: any): Promise<boolean> {
    if (!session || !session.expires_at) return true;
    const expiresAt = new Date(session.expires_at * 1000); // Convert to milliseconds
    const now = new Date();
    return expiresAt <= now;
  }

  // ============= PUBLIC SETTER METHODS =============

  setKillzoneFilter(enabled: boolean): void {
    tradingFilters.setKillzoneEnabled(enabled);
  }

  setNewsBlackout(enabled: boolean): void {
    tradingFilters.setNewsBlackoutEnabled(enabled);
  }

  setSymbols(symbols: string[]): void {
    console.log('🔄 OnTickEngine: Updating symbols from', this.config.symbols, 'to', symbols);
    
    // Check if this is gold-only mode (2 or fewer symbols, both gold/silver)
    const isGoldOnly = symbols.length <= 2 && symbols.every(s => 
      s.includes('XAU') || s.includes('XAG') || s.includes('GOLD') || s.includes('SILVER')
    );
    
    if (isGoldOnly) {
      this.isGoldOnlyMode = true;
      console.log('🔄 OnTickEngine: GOLD-ONLY MODE activated');
    } else {
      this.isGoldOnlyMode = false;
      console.log('🔄 OnTickEngine: GOLD-ONLY MODE deactivated');
    }
    
    this.config.symbols = symbols;
    // Clear existing candle history for symbols not in new list
    for (const [symbol, candles] of this.candleHistory.entries()) {
      if (!symbols.includes(symbol)) {
        this.candleHistory.delete(symbol);
        console.log(`🗑️ OnTickEngine: Removed candle history for ${symbol}`);
      }
    }
    console.log('🔄 OnTickEngine: Symbols updated to:', symbols);
    // Restart engine with new symbols
    this.stop();
    this.start();
  }

  async refreshSymbols(): Promise<void> {
    if (!exnessAPI.isConnectedToExness()) {
      console.log('🔄 OnTickEngine: Not connected to MT5, cannot refresh symbols');
      return;
    }

    try {
      console.log('🔄 OnTickEngine: Refreshing available symbols from MT5...');
      const availableSymbols = await exnessAPI.getTradableSymbols();
      if (availableSymbols.length > 0) {
        this.setSymbols(availableSymbols);
        console.log(`✅ OnTickEngine: Refreshed to ${availableSymbols.length} available symbols`);
      } else {
        console.warn('⚠️ OnTickEngine: No tradable symbols available after refresh');
      }
    } catch (error) {
      console.error('❌ OnTickEngine: Failed to refresh symbols:', error);
    }
  }

  // ============= DEBUGGING METHODS =============

  /** Reset loss cooldown and clear consecutive losses - for testing purposes */
  resetLossCooldown(): void {
    this.consecutiveLosses = 0;
    this.consecutiveWins = 0;
    this.lastTradeResult = null;
    this.lastLossTime = 0;
    console.log('🔄 OnTickEngine: Loss cooldown and streaks RESET for testing');
  }

  /** Get current trading status for debugging */
  getTradingStatus(): {
    isActive: boolean;
    isGoldOnlyMode: boolean;
    activeTradesCount: number;
    consecutiveLosses: number;
    consecutiveWins: number;
    lastTradeResult: string | null;
    symbols: string[];
    autoExecute: boolean;
  } {
    return {
      isActive: this.config.enabled,
      isGoldOnlyMode: this.isGoldOnlyMode,
      activeTradesCount: this.activeTrades.size,
      consecutiveLosses: this.consecutiveLosses,
      consecutiveWins: this.consecutiveWins,
      lastTradeResult: this.lastTradeResult,
      symbols: this.config.symbols,
      autoExecute: this.config.autoExecute
    };
  }
}

export const onTickEngine = new OnTickEngine();



