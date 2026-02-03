import { supabase } from '@/integrations/supabase/client';
import { orderManager } from './orderManager';
import { exnessAPI } from './exnessApi';
import { aiAnalyzer } from './aiAnalyzer';
import { enhancedTradingSystem } from './strategies/enhancedStrategies';
import { simpleProfitableStrategies } from './strategies/simpleProfitableStrategies';
import { goldTradingStrategies } from './strategies/goldStrategies';
import { TOP_100_SYMBOLS, MAJOR_CURRENCY_PAIRS } from './symbolWhitelist';
import { correlationManager } from './correlationManager';
import { tradingBot } from './tradingBot';

export interface SignalGenerationConfig {
  enabled: boolean;
  interval: number;
  symbols: string[];
  minConfidence: number;
  autoExecute: boolean;
  maxDailySignals: number;
  aggressiveMode: boolean;
  maxConcurrentTrades: number; // Maximum number of concurrent trades
  minSignalQuality: number; // Minimum quality score for signals
}

class BotSignalManager {
  private config: SignalGenerationConfig = {
    enabled: true,
    interval: 15000, // 15 seconds for faster signals
    symbols: [...TOP_100_SYMBOLS] as string[], // Use top 100 forex pairs only
    minConfidence: 75, // Increased threshold for quality trades only
    autoExecute: true,
    maxDailySignals: 50, // Reduced for more selective trading
    aggressiveMode: false, // Conservative mode for consistent profits
    maxConcurrentTrades: 3, // Reduced to 3 concurrent trades
    minSignalQuality: 0.7 // Higher quality score (0-1)
  };

  // Loss tracking for cooldown
  private consecutiveLosses: number = 0;
  private lastLossTime: number = 0;
  private readonly LOSS_COOLDOWN_MS = 120000; // 2 minutes cooldown after loss

  private generationInterval: NodeJS.Timeout | null = null;
  private isGenerating = false;
  private lastGenerationTime = 0;
  private dailySignalCount = 0;
  private lastResetDate = new Date().toDateString();
  private analysisLocks: Set<string> = new Set();
  private lastAICallTime: Map<string, number> = new Map();
  private readonly AI_CALL_COOLDOWN = 30000; // 30 seconds for high-frequency AI analysis
  private currentSymbolIndex = 0;
  private historicalDataCache: Map<string, { data: any[]; timestamp: number }> = new Map();
  private readonly CACHE_TTL = 300000; // 5 minutes
  
  async initialize(config?: Partial<SignalGenerationConfig>): Promise<void> {
    if (config) this.config = { ...this.config, ...config };
    this.resetDailyCountersIfNeeded();
    console.log('📡 Signal Manager initialized with config:', this.config);

    // Check if we're in paper trading mode - skip Supabase operations
    const { orderManager } = await import('./orderManager');
    const isPaperTrading = (orderManager as any).isPaperTradingMode;

    if (isPaperTrading) {
      console.log('📝 Paper trading mode: Skipping Supabase initialization checks');
      return;
    }

    // For real trading, check authentication and currency pairs
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      console.log('🔐 Auth status on init:', { hasSession: !!session, sessionError: sessionError?.message });

      if (sessionError || !session) {
        console.log('⚠️ No valid session found - user may need to re-authenticate through the UI');
        return;
      }

      if (await this.isSessionExpired(session)) {
        console.log('🔄 Session expired, attempting refresh...');
        const { data: { session: refreshedSession }, error: refreshError } = await supabase.auth.refreshSession();
        if (refreshError || !refreshedSession) {
          console.error('❌ Failed to refresh session:', refreshError?.message);
          console.log('⚠️ Authentication failed - please re-authenticate through the UI');
          return;
        }
        console.log('✅ Session refreshed successfully');
      }

      const { data: pairs, error: pairsError } = await supabase.from('currency_pairs').select('*');
      console.log('📊 Currency pairs in DB:', { pairs: pairs?.length, pairsError: pairsError?.message });
    } catch (error) {
      console.error('❌ Init check failed:', error);
    }
  }

  private resetDailyCountersIfNeeded(): void {
    const today = new Date().toDateString();
    if (this.lastResetDate !== today) {
      this.dailySignalCount = 0;
      this.lastResetDate = today;
      console.log('🔄 Daily signal counters reset for new trading day');
    }
  }

  private async isSessionExpired(session: any): Promise<boolean> {
    if (!session || !session.expires_at) return true;
    const expiresAt = new Date(session.expires_at * 1000); // Convert to milliseconds
    const now = new Date();
    return expiresAt <= now;
  }

  startAutomaticGeneration(): void {
    if (this.generationInterval) return console.log('🔄 Signal generation already running');
    console.log(`🚀 Starting signal generation every ${this.config.interval / 1000}s`);
    this.generationInterval = setInterval(async () => {
      if (this.config.enabled && !this.isGenerating && this.canGenerateMoreSignals()) {
        await this.generateAndProcessSignals();
      }
    }, this.config.interval);

    setTimeout(() => this.canGenerateMoreSignals() && this.generateAndProcessSignals(), 1000);
  }

  stopAutomaticGeneration(): void {
    if (!this.generationInterval) return;
    clearInterval(this.generationInterval);
    this.generationInterval = null;
    console.log('🛑 Stopped automatic signal generation');
  }

  private canGenerateMoreSignals(): boolean {
    this.resetDailyCountersIfNeeded();
    return this.dailySignalCount < this.config.maxDailySignals;
  }

  private async getCurrentOpenPositions(): Promise<number> {
    try {
      const { orderManager } = await import('./orderManager');
      // Use the private method through a workaround or add a public method
      const positions = await (orderManager as any).getOpenPositionsCount();
      console.log(`📊 Current open positions: ${positions || 0}`);
      return positions || 0;
    } catch (error) {
      console.error('Error getting open positions:', error);
      return 0;
    }
  }

  private async canExecuteMoreTrades(): Promise<boolean> {
    const openPositions = await this.getCurrentOpenPositions();
    if (openPositions >= this.config.maxConcurrentTrades) return false;

    // Check account balance and margin
    try {
      const accountInfo = await exnessAPI.getAccountInfo();
      if (!accountInfo) {
        console.warn('⚠️ Cannot check account balance - skipping trade');
        return false;
      }

      const balance = accountInfo.balance || 0;
      const margin = accountInfo.margin || 0;
      const freeMargin = accountInfo.freeMargin || 0;

      console.log(`💰 Account balance: ${balance.toFixed(2)}, Margin: ${margin.toFixed(2)}, Free margin: ${freeMargin.toFixed(2)}`);

      // Require at least $0.01 free margin per potential trade (ultra lenient for testing)
      const minFreeMarginPerTrade = 0.01;
      if (freeMargin < minFreeMarginPerTrade) {
        console.warn(`⚠️ Insufficient free margin: ${freeMargin.toFixed(2)} < ${minFreeMarginPerTrade}`);
        return false;
      }

      // Don't use more than 90% of balance on concurrent trades (more lenient)
      const maxBalanceUsage = balance * 0.9;
      if (margin > maxBalanceUsage) {
        console.warn(`⚠️ Too much margin used: ${margin.toFixed(2)} > ${maxBalanceUsage.toFixed(2)} (90% of balance)`);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error checking account balance:', error);
      return false;
    }
  }

  async generateAndProcessSignals(): Promise<void> {
    console.log('🔄 Starting signal generation cycle...');

    // SAFETY CHECK: Only process signals if the bot is active
    const botStatus = tradingBot.getStatus();
    if (!botStatus.isActive) {
      console.log('🛑 Signal generation skipped - bot is not active. User must start the bot first.');
      return;
    }

    if (this.isGenerating) {
      console.log('⚠️ Signal generation already in progress, skipping');
      return;
    }

    const timeSinceLast = Date.now() - this.lastGenerationTime;
    console.log(`⏱️ Time since last generation: ${timeSinceLast}ms`);

    if (timeSinceLast < 30000) {
      console.log('⏳ Cooldown active, waiting for next cycle');
      return;
    }

    if (!this.canGenerateMoreSignals()) {
      console.log('🚫 Daily signal limit reached, stopping generation');
      return;
    }

    this.isGenerating = true;
    this.lastGenerationTime = Date.now();

    try {
      // Check if we're in paper trading mode or connected to Exness
      const { orderManager } = await import('./orderManager');
      const isPaperTrading = (orderManager as any).isPaperTradingMode;

      console.log(`🔍 DEBUG: Paper trading status: ${isPaperTrading}, autoExecute: ${this.config.autoExecute}, isAutoTradingActive: ${orderManager.isAutoTradingActive()}`);

      // EXTRA SAFETY: Only allow real trading if user has explicitly connected MT5 account
      if (!isPaperTrading) {
        if (!exnessAPI.isConnectedToExness()) {
          console.warn('⚠️ Not connected to Exness MT5 account - staying in paper trading mode for safety');
          console.log('💡 To enable real trading: Connect your MT5 account through the Exness Integration UI tab first');
          return;
        }

        // Additional check: Verify we have account info (means user connected through UI)
        try {
          const accountInfo = await exnessAPI.getAccountInfo();
          if (!accountInfo) {
            console.warn('⚠️ No account info available - staying in paper trading mode for safety');
            console.log('💡 To enable real trading: Connect your MT5 account through the Exness Integration UI tab first');
            return;
          }
          console.log('✅ Account info verified:', { balance: accountInfo.balance, margin: accountInfo.margin });
        } catch (error) {
          console.warn('⚠️ Cannot verify account connection - staying in paper trading mode for safety');
          console.log('💡 To enable real trading: Connect your MT5 account through the Exness Integration UI tab first');
          return;
        }
      }

      if (!isPaperTrading) {
        const { canTrade, issues } = await exnessAPI.verifyTradingCapabilities();
        if (!canTrade) {
          console.warn('⚠️ Trading not allowed:', issues.join(', '));
          return;
        }
        console.log('✅ Trading capabilities verified');
      } else {
        console.log('📝 Paper trading mode - skipping connection checks, proceeding with signal generation');
      }

      // Analyze all symbols and collect potential signals
      console.log(`🔬 Analyzing ${this.config.symbols.length} symbols for signals...`);
      const potentialSignals = await this.analyzeAllSymbols();
      console.log(`📊 Analysis complete: ${potentialSignals.length} potential signals found`);

      if (potentialSignals.length > 0) {
        // Sort signals by confidence (descending) and expected value (descending)
        const rankedSignals = potentialSignals.sort((a, b) => {
          if (b.confidence !== a.confidence) {
            return b.confidence - a.confidence; // Higher confidence first
          }
          return (b.expectedValue || 0) - (a.expectedValue || 0); // Higher expected value first
        });

        console.log(`🎯 Top signals: ${rankedSignals.slice(0, 3).map(s => `${s.symbol} ${s.type} ${s.confidence.toFixed(1)}%`).join(', ')}`);

        // Execute multiple high-quality signals instead of just one
        const canExecuteMore = await this.canExecuteMoreTrades();
        const maxTrades = Math.min(rankedSignals.length, this.config.maxConcurrentTrades);

        console.log(`🎯 Found ${rankedSignals.length} potential signals, can execute ${maxTrades} trades, canExecuteMore: ${canExecuteMore}`);

        let executedCount = 0;
        for (let i = 0; i < maxTrades; i++) {
          const signal = rankedSignals[i];

          // Check if we can still execute more trades
          if (executedCount >= this.config.maxConcurrentTrades) {
            console.log(`⚠️ Maximum concurrent trades reached (${this.config.maxConcurrentTrades})`);
            break;
          }

          // Check if we can execute more trades (dynamic check)
          const canExecute = await this.canExecuteMoreTrades();
          if (!canExecute) {
            console.log(`⚠️ Cannot execute more trades - margin/position limit reached`);
            break;
          }

          console.log(`🎯 Executing signal ${i + 1}/${maxTrades}: ${signal.symbol} ${signal.type} (${signal.confidence.toFixed(1)}% confidence, EV: ${(signal.expectedValue || 0).toFixed(4)})`);
          console.log(`🔍 DEBUG: autoExecute=${this.config.autoExecute}, isAutoTradingActive=${orderManager.isAutoTradingActive()}, isPaperTrading=${isPaperTrading}`);

          if (this.config.autoExecute && orderManager.isAutoTradingActive() && !isPaperTrading) {
            console.log(`🚀 Attempting real trade execution for ${signal.symbol}`);
            await this.executeSignal(signal);
            executedCount++;
          } else if (this.config.autoExecute && orderManager.isAutoTradingActive() && isPaperTrading) {
            console.log(`📝 Paper trading mode - simulating execution for ${signal.symbol}`);
            executedCount++; // Count as executed even in paper mode
          } else {
            console.log(`⚠️ Execution conditions not met for ${signal.symbol}: autoExecute=${this.config.autoExecute}, isAutoTradingActive=${orderManager.isAutoTradingActive()}, isPaperTrading=${isPaperTrading}`);
          }
          await this.saveSignal(signal);
          this.dailySignalCount++;

          // Small delay between executions to avoid overwhelming the system
          if (i < maxTrades - 1) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }

        console.log(`📊 Executed ${executedCount} trades in this cycle`);
      } else {
        console.log('📊 No qualifying signals found in this analysis cycle');
      }

      if (this.config.autoExecute && orderManager.isAutoTradingActive()) await this.executePendingSignals();
    } catch (error) {
      console.error('Error in signal generation cycle:', error);
    } finally {
      this.isGenerating = false;
    }
  }

  private rotateSymbol(): string {
    const symbol = this.config.symbols[this.currentSymbolIndex];
    this.currentSymbolIndex = (this.currentSymbolIndex + 1) % this.config.symbols.length;
    return symbol;
  }

  private async analyzeAndGenerateSignal(symbol: string): Promise<void> {
    if (this.analysisLocks.has(symbol)) return;
    const lastCallTime = this.lastAICallTime.get(symbol) || 0;
    if (Date.now() - lastCallTime < this.AI_CALL_COOLDOWN) return;

    this.analysisLocks.add(symbol);
    this.lastAICallTime.set(symbol, Date.now());

    try {
      // Check if we're in paper trading mode
      const { orderManager } = await import('./orderManager');
      const isPaperTrading = (orderManager as any).isPaperTradingMode;

      let marketPrice: any;

      if (isPaperTrading) {
        // Use simulated price for paper trading
        const basePrice = symbol.includes('JPY') ? 150 : symbol.includes('XAU') ? 2000 : 1.0;
        marketPrice = {
          bid: basePrice,
          ask: basePrice + 0.0001,
          spread: 0.0001,
          symbol,
          timestamp: new Date()
        };
        console.log(`📝 Paper trading: Using simulated price for ${symbol}: ${marketPrice.bid}`);
      } else {
        marketPrice = await exnessAPI.getCurrentPrice(symbol);
        if (!marketPrice?.bid || !marketPrice?.ask) return console.warn(`⚠️ Invalid price for ${symbol}`);
      }

      const analysis = await this.performTechnicalAnalysis(symbol, marketPrice);
      if (!analysis || analysis.confidence < this.config.minConfidence) return;

      const signalPayload = this.createSignalPayload(symbol, marketPrice, analysis);
      if (this.config.autoExecute && orderManager.isAutoTradingActive()) {
        await this.executeSignal(signalPayload);
      }
      await this.saveSignal(signalPayload);
      console.log(`📊 Signal generated for ${symbol}: ${analysis.direction} (${analysis.confidence.toFixed(1)}%)`);
    } catch (error) {
      console.error(`Failed to analyze ${symbol}:`, error);
    } finally {
      this.analysisLocks.delete(symbol);
    }
  }

  private async analyzeAllSymbols(): Promise<any[]> {
    const potentialSignals: any[] = [];

    for (const symbol of this.config.symbols) {
      try {
        // Skip if analysis is locked or recently analyzed
        if (this.analysisLocks.has(symbol)) continue;
        const lastCallTime = this.lastAICallTime.get(symbol) || 0;
        if (Date.now() - lastCallTime < this.AI_CALL_COOLDOWN) continue;

        this.analysisLocks.add(symbol);
        this.lastAICallTime.set(symbol, Date.now());

        // Check if we're in paper trading mode
        const { orderManager } = await import('./orderManager');
        const isPaperTrading = (orderManager as any).isPaperTradingMode;

        let marketPrice: any;

        if (isPaperTrading) {
          // Use simulated price for paper trading
          const basePrice = symbol.includes('JPY') ? 150 : symbol.includes('XAU') ? 2000 : 1.0;
          marketPrice = {
            bid: basePrice,
            ask: basePrice + 0.0001,
            spread: 0.0001,
            symbol,
            timestamp: new Date()
          };
        } else {
          marketPrice = await exnessAPI.getCurrentPrice(symbol);
          if (!marketPrice?.bid || !marketPrice?.ask) {
            this.analysisLocks.delete(symbol);
            continue;
          }
        }

        const analysis = await this.performTechnicalAnalysis(symbol, marketPrice);
        if (analysis && analysis.confidence >= this.config.minConfidence) {
          const signalPayload = this.createSignalPayload(symbol, marketPrice, analysis);
          potentialSignals.push(signalPayload);
        }
      } catch (error) {
        console.error(`Failed to analyze ${symbol}:`, error);
      } finally {
        this.analysisLocks.delete(symbol);
      }
    }

    return potentialSignals;
  }

  private async performTechnicalAnalysis(symbol: string, price: any): Promise<any> {
    try {
      const prices = await this.generateRecentPrices(price.bid, 100, symbol);
      const volumes = await this.generateRecentVolumes(100, symbol);
      if (prices.length < 20 || volumes.length < 20) return null;

      const indicators = this.calculateTechnicalIndicators(prices);

      // Check if we're in paper trading mode - skip AI analysis to avoid Supabase auth issues
      const { orderManager } = await import('./orderManager');
      const isPaperTrading = (orderManager as any).isPaperTradingMode;

      // Check if this is a gold symbol
      const isGoldSymbol = symbol.includes('XAU') || symbol.includes('XAUUSD') || symbol.includes('GOLD');

      if (isGoldSymbol) {
        // GOLD-ONLY MODE: Use gold trading strategies with $5-10 TP
        console.log(`🎯 GOLD-ONLY MODE: Using gold strategies for ${symbol} with $5-10 TP targets`);
        const goldSignal = await goldTradingStrategies.generateGoldSignal(
          { prices, volumes, symbol },
          indicators,
          undefined,
          undefined,
          []
        );

        if (goldSignal) {
          // Convert gold signal format to bot signal format
          return {
            direction: goldSignal.type,
            confidence: goldSignal.confidence,
            stopLoss: goldSignal.stopLoss,
            takeProfit: goldSignal.takeProfit,
            reasoning: goldSignal.reasoning || `Gold Strategy: ${goldSignal.strategyName}`,
            volume: this.calculatePositionSizeFromAI(goldSignal.confidence, 'MEDIUM', symbol),
            expectedValue: this.calculateExpectedValue(goldSignal.entryPrice, goldSignal.takeProfit, goldSignal.stopLoss, goldSignal.confidence),
            entryPrice: goldSignal.entryPrice
          };
        }
        console.log(`⚠️ Gold strategies returned no signal for ${symbol}, falling back to profitable strategies`);
      }

      // Use profitable strategies for forex symbols
      console.log(`🎯 Using profitable strategies for ${symbol}`);
      const signal = await simpleProfitableStrategies.selectBestStrategy(symbol, prices, price.bid);

      // Check correlation confirmation - GOLD-ONLY MODE: Skip correlation check for gold symbols
      // Gold has unique market dynamics that don't always correlate with forex pairs
      if (signal && signal.confidence >= 70 && !isGoldSymbol) {
        const confirmation = await correlationManager.checkCorrelationConfirmation(
          symbol,
          signal.type as 'BUY' | 'SELL',
          signal.confidence
        );

        if (!confirmation.confirmed) {
          console.log(`⚠️ Signal for ${symbol} not confirmed by correlations: ${confirmation.confirmations}/${confirmation.totalChecked} confirmations`);
          signal.confidence *= 0.7; // Reduce confidence by 30%
          signal.reasoning += ` | Correlation check: ${confirmation.confirmations}/${confirmation.totalChecked} confirmations`;
        } else {
          console.log(`✅ Signal for ${symbol} confirmed by correlations: ${confirmation.confirmations}/${confirmation.totalChecked} confirmations`);
          signal.reasoning += ` | Correlation confirmed: ${confirmation.confirmations}/${confirmation.totalChecked}`;
        }
      } else if (isGoldSymbol) {
        console.log(`🎯 GOLD-ONLY MODE: Skipping correlation check for ${symbol} - gold has unique market dynamics`);
      }

      // Special rules for XAUUSD
      if (signal && symbol === 'XAUUSD') {
        const goldCheck = await correlationManager.checkGoldTradingRules();
        if (!goldCheck.allowed) {
          console.log(`⚠️ Gold trading not allowed: ${goldCheck.reason}`);
          signal.confidence *= 0.5; // Halve confidence for gold
          signal.reasoning += ` | Gold rules: ${goldCheck.reason}`;
        } else {
          signal.reasoning += ` | Gold rules: ${goldCheck.reason}`;
        }
      }

      if (!signal || signal.confidence < this.config.minConfidence) return null;

      return {
        direction: signal.type,
        confidence: signal.confidence,
        stopLoss: signal.stopLoss,
        takeProfit: signal.takeProfit,
        reasoning: signal.reasoning || `Enhanced Strategy (${signal.confidence}% confidence): ${signal.strategyName}`,
        volume: this.calculatePositionSizeFromAI(signal.confidence, 'MEDIUM', symbol),
        expectedValue: this.calculateExpectedValue(signal.entryPrice, signal.takeProfit, signal.stopLoss, signal.confidence),
        entryPrice: signal.entryPrice
      };
    } catch (error) {
      console.error('Enhanced trading system analysis failed:', error);
      // Fallback to algorithmic signal if enhanced system fails
      console.log('⚠️ Enhanced trading system failed, falling back to algorithmic signal');
      const indicators = this.calculateTechnicalIndicators(await this.generateRecentPrices(price.bid, 100, symbol));
      return this.generateAlgorithmicSignal(symbol, price, indicators, await this.generateRecentPrices(price.bid, 100, symbol));
    }
  }

  private createSignalPayload(symbol: string, price: any, analysis: any) {
    return {
      symbol,
      type: analysis.direction,
      confidence: analysis.confidence,
      entryPrice: price.bid,
      stopLoss: analysis.stopLoss || 0,
      takeProfit: analysis.takeProfit || 0,
      reasoning: analysis.reasoning || 'Technical analysis signal',
      volume: analysis.volume
    };
  }

  private async executeSignal(signalPayload: any) {
    try {
      await orderManager.executeOrder({
        symbol: signalPayload.symbol,
        type: signalPayload.type,
        volume: signalPayload.volume,
        stopLoss: signalPayload.stopLoss,
        takeProfit: signalPayload.takeProfit,
        comment: `AutoAI-${signalPayload.confidence.toFixed(0)}%`
      });
      console.log(`✅ Auto-executed ${signalPayload.type} on ${signalPayload.symbol} (vol ${signalPayload.volume})`);
      // Reset consecutive losses on new trade
      this.consecutiveLosses = 0;
    } catch (err) {
      console.error(`❌ Auto-execution failed for ${signalPayload.symbol}:`, err);
      this.consecutiveLosses++;
      this.lastLossTime = Date.now();
    }
  }

  // Public method to record trade outcome after trade closes
  public recordTradeOutcome(wasProfit: boolean): void {
    if (wasProfit) {
      this.consecutiveLosses = 0;
    } else {
      this.consecutiveLosses++;
      this.lastLossTime = Date.now();
    }
    console.log(`📊 BotSignalManager: Trade ${wasProfit ? 'WIN' : 'LOSS'} - Consecutive losses: ${this.consecutiveLosses}`);
  }

  private calculatePositionSizeFromAI(confidence: number, recommendation: 'SMALL' | 'MEDIUM' | 'LARGE', symbol: string): number {
    // Use micro lots for safer position sizing
    let baseVolume = recommendation === 'LARGE' ? 0.03 : recommendation === 'MEDIUM' ? 0.015 : 0.008; // Micro lots for safety
    if (confidence >= 85) baseVolume *= 2.5; // Higher multiplier for very high confidence
    else if (confidence >= 80) baseVolume *= 2.0; // Aggressive multiplier for high confidence
    else if (confidence >= 75) baseVolume *= 1.5;
    return Math.min(baseVolume, 0.05); // Cap at 0.05 lots (micro account friendly)
  }

  private calculateExpectedValue(entry: number, tp: number, sl: number, confidence: number): number {
    const potentialProfit = Math.abs(tp - entry);
    const potentialLoss = Math.abs(entry - sl);
    const winProbability = confidence / 100;
    return (potentialProfit * winProbability) - (potentialLoss * (1 - winProbability));
  }

  private generateAlgorithmicSignal(symbol: string, price: any, indicators: any, prices: number[]): any {
    // Check loss cooldown before generating signal
    const now = Date.now();
    if (this.consecutiveLosses >= 2 && now - this.lastLossTime < this.LOSS_COOLDOWN_MS) {
      console.log(`⏸️ Algorithmic: Cooldown active after ${this.consecutiveLosses} consecutive losses`);
      return null;
    }

    // Simple algorithmic signal generation for paper trading
    const currentPrice = price.bid;
    const rsi = indicators.rsi || 50;
    const sma20 = indicators.sma20 || currentPrice;
    const sma50 = indicators.sma50 || currentPrice;

    let direction: 'BUY' | 'SELL' = 'BUY';
    let confidence = 70; // Default confidence for algorithmic signals
    let reasoning = 'Algorithmic analysis: ';

    // RSI-based signals
    if (rsi > 70) {
      direction = 'SELL'; // RSI overbought = sell
      confidence = Math.min(85, 70 + (rsi - 70));
      reasoning += `RSI overbought (${rsi.toFixed(1)}), selling pressure. `;
    } else if (rsi < 30) {
      direction = 'BUY'; // RSI oversold = buy
      confidence = Math.min(85, 70 + (30 - rsi));
      reasoning += `RSI oversold (${rsi.toFixed(1)}), buying opportunity. `;
    } else {
      // Trend-based signals (FIXED - was inverted before)
      if (sma20 > sma50) {
        direction = 'BUY'; // SMA20 above SMA50 = bullish = BUY
        reasoning += 'SMA20 above SMA50, bullish trend. ';
      } else {
        direction = 'SELL'; // SMA20 below SMA50 = bearish = SELL
        reasoning += 'SMA20 below SMA50, bearish trend. ';
      }
    }

    // Calculate stops based on ATR or fixed percentage
    const atr = indicators.atr || (currentPrice * 0.005); // 0.5% default
    const stopDistance = Math.max(atr * 2, currentPrice * 0.005); // At least 0.5%

    let stopLoss: number, takeProfit: number;
    if (direction === 'BUY') {
      stopLoss = currentPrice - stopDistance;
      takeProfit = currentPrice + (stopDistance * 2); // 2:1 RR
    } else {
      stopLoss = currentPrice + stopDistance;
      takeProfit = currentPrice - (stopDistance * 2); // 2:1 RR
    }

    reasoning += `Entry: ${currentPrice}, SL: ${stopLoss.toFixed(5)}, TP: ${takeProfit.toFixed(5)}`;

    return {
      direction,
      confidence,
      stopLoss,
      takeProfit,
      reasoning,
      volume: this.calculatePositionSizeFromAI(confidence, 'MEDIUM', symbol),
      expectedValue: this.calculateExpectedValue(currentPrice, takeProfit, stopLoss, confidence)
    };
  }

  async saveSignal(signal: any): Promise<void> {
    try {
      // Check if we're in paper trading mode - skip all Supabase operations
      const { orderManager } = await import('./orderManager');
      const isPaperTrading = (orderManager as any).isPaperTradingMode;

      if (isPaperTrading) {
        console.log('📝 Paper trading mode: Skipping signal save to database');
        return;
      }

      // For real trading, try to save with proper auth handling
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError || !session) {
          console.warn('⚠️ No valid session for saveSignal - skipping database save');
          return;
        }

        if (await this.isSessionExpired(session)) {
          console.log('🔄 Session expired during saveSignal, attempting refresh...');
          const { data: { session: refreshedSession }, error: refreshError } = await supabase.auth.refreshSession();
          if (refreshError || !refreshedSession) {
            console.error('❌ Failed to refresh session for saveSignal:', refreshError?.message);
            return;
          }
          console.log('✅ Session refreshed successfully for saveSignal');
        }

        console.log('🔍 Checking currency pair for symbol:', signal.symbol);
        const result = await supabase.from('currency_pairs').select('id').eq('symbol', signal.symbol).maybeSingle();
        let pair = result.data;
        const selectError = result.error;
        console.log('📊 Currency pair query result:', { pair, selectError });

        if (selectError) {
          console.error('❌ Error selecting currency pair:', selectError);
          return;
        }

        if (!pair?.id) {
          console.log('📝 Inserting new currency pair:', signal.symbol);
          const baseCurrency = signal.symbol.substring(0, 3);
          const quoteCurrency = signal.symbol.substring(3, 6);
          const { data: newPair, error: insertError } = await supabase.from('currency_pairs').upsert({
            symbol: signal.symbol,
            base_currency: baseCurrency,
            quote_currency: quoteCurrency,
            display_name: signal.symbol
          }, { onConflict: 'symbol' }).select('id').single();
          console.log('📝 Upsert result:', { newPair, insertError });
          if (insertError || !newPair) {
            console.error('❌ Failed to upsert currency pair:', insertError);
            return;
          }
          pair = newPair;
        }

        console.log('💾 Saving trading signal:', { pair_id: pair.id, signal_type: signal.type });
        const { error: signalError } = await supabase.from('trading_signals').insert({
          user_id: session.user.id,
          pair_id: pair.id,
          signal_type: signal.type,
          confidence_score: signal.confidence,
          entry_price: signal.entryPrice,
          stop_loss: signal.stopLoss,
          take_profit: signal.takeProfit,
          timeframe: '1H',
          reasoning: signal.reasoning,
          ai_model: 'BotSignalManager',
          status: 'ACTIVE'
        });
        if (signalError) {
          console.error('❌ Failed to save trading signal:', signalError);
        } else {
          console.log('✅ Signal saved successfully');
        }
      } catch (authError) {
        console.error('❌ Authentication error saving signal:', authError);
        // Continue without saving - don't fail the trade
      }
    } catch (error) {
      console.error('Failed to save signal:', error);
    }
  }

  async executePendingSignals(): Promise<void> {
    try {
      // Check if we're in paper trading mode - skip all Supabase operations
      const { orderManager } = await import('./orderManager');
      const isPaperTrading = (orderManager as any).isPaperTradingMode;

      if (isPaperTrading) {
        console.log('📝 Paper trading mode: Skipping pending signal execution from database');
        return;
      }

      // For real trading, try to execute pending signals with proper auth
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError || !session) {
          console.warn('⚠️ No valid session for executePendingSignals - skipping');
          return;
        }

        if (await this.isSessionExpired(session)) {
          console.log('🔄 Session expired during executePendingSignals, attempting refresh...');
          const { data: { session: refreshedSession }, error: refreshError } = await supabase.auth.refreshSession();
          if (refreshError || !refreshedSession) {
            console.error('❌ Failed to refresh session for executePendingSignals:', refreshError?.message);
            return;
          }
          console.log('✅ Session refreshed successfully for executePendingSignals');
        }

        const { data: signals } = await supabase.from('trading_signals')
          .select('*, currency_pairs(symbol)')
          .eq('user_id', session.user.id)
          .eq('status', 'ACTIVE')
          .gte('confidence_score', this.config.minConfidence)
          .order('confidence_score', { ascending: false })
          .limit(10);

        if (!signals || signals.length === 0) return;

        for (const signal of signals) {
          try {
            const symbol = signal.currency_pairs?.symbol;
            if (!symbol || !this.config.symbols.includes(symbol)) continue;

            const orderRequest = {
              symbol,
              type: signal.signal_type as 'BUY' | 'SELL',
              volume: 0.01,
              stopLoss: signal.stop_loss ? parseFloat(signal.stop_loss.toString()) : undefined,
              takeProfit: signal.take_profit ? parseFloat(signal.take_profit.toString()) : undefined,
              comment: `AI-${signal.confidence_score.toFixed(0)}%-${signal.id.substring(0, 8)}`
            };

            const orderId = await orderManager.executeOrder(orderRequest);
            if (orderId) {
              await supabase.from('trading_signals').update({ status: 'EXECUTED', updated_at: new Date().toISOString() }).eq('id', signal.id);
            } else {
              await supabase.from('trading_signals').update({ status: 'CANCELLED', updated_at: new Date().toISOString() }).eq('id', signal.id);
            }
          } catch (error) {
            console.error(`Failed to execute signal ${signal.id}:`, error);
          }
        }
      } catch (authError) {
        console.error('❌ Authentication error executing pending signals:', authError);
        // Continue without executing - don't fail the bot
      }
    } catch (error) {
      console.error('Failed to execute pending signals:', error);
    }
  }

  // --- Helper Methods: Historical Data, Prices, Volumes ---
  private async fetchHistoricalDataWithCache(symbol: string, count: number): Promise<any[] | null> {
    const cacheKey = `${symbol}_${count}`;
    const cached = this.historicalDataCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) return cached.data;

    // Use 5m timeframe for better entry timing and more data points
    const data = await exnessAPI.getHistoricalData(symbol, '5m', count);
    if (data?.length) this.historicalDataCache.set(cacheKey, { data, timestamp: Date.now() });
    return data;
  }

  private async generateRecentPrices(currentPrice: number, count: number, symbol: string): Promise<number[]> {
    try {
      // PRIORITY 1: Fetch real historical data from Exness API
      // CRITICAL: Force real data fetch, skip cache if needed
      const realData = await exnessAPI.getHistoricalData(symbol, '15m', count + 20);
      
      if (realData && realData.length >= count) {
        const prices = realData.map((bar: any) => bar.close);
        console.log(`✅ [REAL DATA] ${symbol}: Using ${prices.length} REAL bars from MT5`);
        
        // Log recent price movements to detect trend direction
        const recentPrices = prices.slice(-10);
        const firstPrice = recentPrices[0];
        const lastPrice = recentPrices[recentPrices.length - 1];
        const priceChange = ((lastPrice - firstPrice) / firstPrice) * 100;
        console.log(`📊 [REAL DATA] ${symbol} trend: ${priceChange > 0 ? 'BULLISH' : priceChange < 0 ? 'BEARISH' : 'NEUTRAL'} (${priceChange.toFixed(2)}% over last 10 bars)`);
        
        return prices.slice(-count);
      }
      
      // PRIORITY 2: If partial data, use what we have
      if (realData && realData.length > 0) {
        console.log(`⚠️ [PARTIAL DATA] ${symbol}: Only ${realData.length}/${count} bars - extending with current price`);
        const prices = realData.map((bar: any) => bar.close);
        while (prices.length < count) {
          prices.push(currentPrice);
        }
        return prices;
      }

      // CRITICAL ERROR: No real data available!
      console.error(`🚨 [CRITICAL] ${symbol}: NO REAL MARKET DATA AVAILABLE!`);
      console.error(`   MT5 Bridge may be disconnected or MT5 not running`);
      console.error(`   Cannot trade with fake data - please fix connection!`);
      
      // Return empty array to PREVENT trading with fake data
      return [];
    } catch (error) {
      console.error(`❌ [ERROR] Failed to fetch prices for ${symbol}:`, error);
      console.error(`🚨 [CRITICAL] Cannot trade - no real data source available`);
      return []; // Prevent trading with fake data
    }
  }

  private async generateRecentVolumes(count: number, symbol: string): Promise<number[]> {
    try {
      // PRIORITY 1: Fetch real volume data from Exness API
      const historicalData = await this.fetchHistoricalDataWithCache(symbol, count);
      if (historicalData && historicalData.length > 0) {
        const volumes = historicalData.map((bar: any) => bar.tick_volume || bar.volume || 0);
        if (volumes.length >= count) {
          console.log(`📊 Real volume data loaded for ${symbol}: ${volumes.length} bars`);
          return volumes;
        }
      }

      // PRIORITY 2: Only use synthetic volume data as last resort fallback
      console.log(`⚠️ No real volume data available for ${symbol}, using synthetic fallback`);
      return this.generateSyntheticGoldVolumes(count, []);
    } catch (error) {
      console.error(`Failed to fetch volumes for ${symbol}:`, error);
      // Fallback to synthetic volume data only on error
      return this.generateSyntheticGoldVolumes(count, []);
    }
  }

  // --- Technical Indicators ---
  private calculateTechnicalIndicators(prices: number[]): any {
    if (prices.length < 20) return {};

    const sma20 = this.average(prices.slice(-20));
    const sma50 = prices.length >= 50 ? this.average(prices.slice(-50)) : sma20;
    const sma200 = prices.length >= 200 ? this.average(prices.slice(-200)) : sma20;
    
    // Calculate proper EMA values (exponential moving average)
    const ema20 = this.calculateEMA(prices, 20);
    const ema50 = this.calculateEMA(prices, 50);
    const ema200 = prices.length >= 200 ? this.calculateEMA(prices, 200) : ema50;
    
    return {
      sma20,
      sma50,
      sma200,
      ema20,
      ema50,
      ema200,
      rsi: this.calculateRSI(prices, 14),
      bollinger: this.calculateBollinger(prices.slice(-20), sma20),
      atr: this.calculateATR(prices, 14),
      adx: 0 // placeholder
    };
  }

  // Proper EMA calculation using exponential smoothing
  private calculateEMA(prices: number[], period: number): number {
    if (prices.length < period) return prices[prices.length - 1] || 0;
    
    const multiplier = 2 / (period + 1);
    const slice = prices.slice(-period);
    const sma = slice.reduce((a, b) => a + b, 0) / period;
    
    let ema = sma;
    for (let i = period; i < prices.length; i++) {
      ema = (prices[i] - ema) * multiplier + ema;
    }
    
    return ema;
  }

  private average(arr: number[]): number { return arr.reduce((a, b) => a + b, 0) / arr.length; }
  private calculateBollinger(prices: number[], sma: number) {
    const std = Math.sqrt(this.average(prices.map(p => Math.pow(p - sma, 2))));
    return { upper: sma + std * 2, middle: sma, lower: sma - std * 2 };
  }

  private calculateRSI(prices: number[], period: number): number {
    if (prices.length <= period) return 50;
    const gains: number[] = [], losses: number[] = [];
    for (let i = 1; i < prices.length; i++) {
      const delta = prices[i] - prices[i - 1];
      gains.push(delta > 0 ? delta : 0);
      losses.push(delta < 0 ? -delta : 0);
    }
    const avgGain = this.average(gains.slice(-period));
    const avgLoss = this.average(losses.slice(-period));
    if (avgLoss === 0) return 100;
    const rs = avgGain / avgLoss;
    return 100 - 100 / (1 + rs);
  }

  private calculateATR(prices: number[], period: number): number {
    if (prices.length < 2) return 0.0001;
    const tr: number[] = [];
    for (let i = 1; i < prices.length; i++) tr.push(Math.abs(prices[i] - prices[i - 1]));
    return this.average(tr.slice(-period));
  }

  private generateSyntheticGoldPrices(currentPrice: number, count: number, existingPrices: number[]): number[] {
    const prices = [...existingPrices];

    // Start from the most recent existing price or current price
    let lastPrice = prices.length > 0 ? prices[prices.length - 1] : currentPrice;

    // Generate synthetic price movements for gold (typically 0.1-0.5% daily volatility)
    // NOTE: This is ONLY used as fallback when real API data is unavailable
    // FIX: Use symmetric random walk to generate balanced BUY/SELL signals
    const volatility = 0.0015; // 0.15% move per period - reduced for more stability
    
    // FIX: Use alternating trends to ensure balanced signal generation
    // Generate a random initial trend direction (50% bullish, 50% bearish)
    const initialTrend = Math.random() > 0.5 ? 1 : -1;
    let trendDirection = initialTrend;
    let trendDuration = 0;
    const maxTrendDuration = 10; // Max periods to maintain a trend before switching
    
    // Calculate realistic price range based on current gold prices (~4,600+)
    const minPrice = 4500; // Minimum realistic gold price
    const maxPrice = 5000; // Maximum realistic gold price
    const centerPrice = (minPrice + maxPrice) / 2;
    
    // Use mean-reversion to keep prices in realistic range
    const meanReversionStrength = 0.02; // 2% pull toward center
    
    while (prices.length < count) {
      // Update trend direction periodically to ensure balanced signals
      trendDuration++;
      if (trendDuration >= maxTrendDuration) {
        trendDirection = -trendDirection; // Switch trend direction
        trendDuration = 0;
      }
      
      // Generate symmetric random walk (50% chance up, 50% chance down)
      const randomMove = (Math.random() - 0.5) * 2 * volatility * lastPrice;
      
      // Add alternating trend bias for balanced signal generation
      const trendMove = trendDirection * volatility * 0.2 * lastPrice;
      
      // Apply mean reversion to keep prices in realistic range
      const meanReversion = (centerPrice - lastPrice) * meanReversionStrength;
      
      const newPrice = lastPrice + randomMove + trendMove + meanReversion;

      // Ensure price stays in realistic range for current gold prices
      const clampedPrice = Math.max(minPrice, Math.min(maxPrice, newPrice));

      prices.push(clampedPrice);
      lastPrice = clampedPrice;
    }

    // Log the generated trend direction for debugging
    const firstPrice = prices[0];
    const lastGeneratedPrice = prices[prices.length - 1];
    const overallTrend = lastGeneratedPrice > firstPrice ? 'BULLISH' : lastGeneratedPrice < firstPrice ? 'BEARISH' : 'NEUTRAL';
    console.log(`📊 Synthetic prices generated for fallback: ${prices.length} bars, Overall trend: ${overallTrend}`);

    return prices;
  }

  private generateSyntheticGoldVolumes(count: number, existingVolumes: number[]): number[] {
    const volumes = [...existingVolumes];

    // Gold typically has lower volume than major forex pairs
    const baseVolume = 1000; // Base volume for gold
    const volatility = 0.3; // Volume varies by 30%

    while (volumes.length < count) {
      // Generate volume with some randomness
      const randomFactor = 1 + (Math.random() - 0.5) * volatility;
      const volume = Math.round(baseVolume * randomFactor);
      volumes.push(volume);
    }

    return volumes;
  }

  // --- Public Methods ---
  async enableAutoExecution(enabled: boolean): Promise<void> {
    this.config.autoExecute = enabled;
    console.log(`🤖 Auto-execution ${enabled ? 'ENABLED' : 'DISABLED'}`);
    if (enabled && this.config.enabled) {
      if (!this.generationInterval) this.startAutomaticGeneration();
      await this.executePendingSignals();
    }
  }

  async forceGenerateSignal(symbol: string): Promise<void> { await this.analyzeAndGenerateSignal(symbol); }

  getConfiguration(): SignalGenerationConfig { return { ...this.config }; }

  setConfiguration(config: Partial<SignalGenerationConfig>): void {
    this.config = { ...this.config, ...config };
    // Reset symbol rotation index when symbols change
    if (config.symbols) {
      this.currentSymbolIndex = 0;
    }
    if (this.generationInterval && this.config.enabled) {
      this.stopAutomaticGeneration();
      this.startAutomaticGeneration();
    }
  }

  getDailyStats(): { signalsGenerated: number; maxDaily: number; remaining: number } {
    this.resetDailyCountersIfNeeded();
    return { signalsGenerated: this.dailySignalCount, maxDaily: this.config.maxDailySignals, remaining: Math.max(0, this.config.maxDailySignals - this.dailySignalCount) };
  }
}

export const botSignalManager = new BotSignalManager();



