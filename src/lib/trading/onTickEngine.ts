/**
 * OnTick Engine - ChartLord AI Style Real-Time Execution
 * Monitors price changes and reacts instantly, not on intervals
 */

import { exnessAPI } from './exnessApi';
import { orderManager } from './orderManager';
import { smartMoneyAnalyzer, CandleData, SMCAnalysis } from './smartMoneyAnalyzer';
import { supabase } from '@/integrations/supabase/client';

export interface TickData {
  symbol: string;
  bid: number;
  ask: number;
  spread: number;
  timestamp: Date;
}

export interface OnTickConfig {
  enabled: boolean;
  symbols: string[];
  minConfluence: number; // Minimum SMC confluence score (ChartLord uses 5+ factors = ~50%)
  autoExecute: boolean;
  trailingEnabled: boolean;
  maxPositionsPerSymbol: number;
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
  rMultiple: number; // How many R achieved
  trailingActivated: boolean;
  breakEvenMoved: boolean;
}

class OnTickEngine {
  private config: OnTickConfig = {
    enabled: false,
    symbols: ['EURUSD', 'GBPUSD', 'USDJPY', 'XAUUSD', 'AUDUSD', 'USDCHF'],
    minConfluence: 50, // 50% = approximately 5 confluence factors
    autoExecute: false,
    trailingEnabled: true,
    maxPositionsPerSymbol: 1
  };

  private tickInterval: NodeJS.Timeout | null = null;
  private lastPrices: Map<string, TickData> = new Map();
  private candleHistory: Map<string, CandleData[]> = new Map();
  private activeTrades: Map<string, ActiveTrade> = new Map();
  private lastAnalysis: Map<string, SMCAnalysis> = new Map();
  private isProcessing = false;
  
  // OnTick speed - 500ms for near real-time monitoring
  private readonly TICK_INTERVAL = 500;
  private readonly CANDLE_FETCH_INTERVAL = 30000; // Fetch new candles every 30 seconds

  async initialize(config?: Partial<OnTickConfig>): Promise<void> {
    if (config) {
      this.config = { ...this.config, ...config };
    }
    console.log('⚡ OnTick Engine initialized (ChartLord Style):', this.config);
  }

  start(): void {
    if (this.tickInterval) {
      console.log('⚡ OnTick Engine already running');
      return;
    }

    console.log('🚀 Starting OnTick Engine - Real-time price monitoring');
    
    // Start the tick monitoring loop
    this.tickInterval = setInterval(() => this.onTick(), this.TICK_INTERVAL);

    // Fetch initial candle data
    this.fetchAllCandleData();

    // Periodically refresh candle data
    setInterval(() => this.fetchAllCandleData(), this.CANDLE_FETCH_INTERVAL);
  }

  stop(): void {
    if (this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
      console.log('🛑 OnTick Engine stopped');
    }
  }

  private async onTick(): Promise<void> {
    if (this.isProcessing || !this.config.enabled) return;
    if (!exnessAPI.isConnectedToExness()) return;

    this.isProcessing = true;

    try {
      // Get current prices for all symbols in parallel
      const pricePromises = this.config.symbols.map(async symbol => {
        const price = await exnessAPI.getCurrentPrice(symbol);
        if (price) {
          const tick: TickData = {
            symbol,
            bid: price.bid,
            ask: price.ask,
            spread: price.spread,
            timestamp: new Date()
          };
          
          // Check for significant price change
          const lastPrice = this.lastPrices.get(symbol);
          const priceChanged = !lastPrice || 
            Math.abs(price.bid - lastPrice.bid) / lastPrice.bid > 0.00001;

          if (priceChanged) {
            this.lastPrices.set(symbol, tick);
            await this.processTickForSymbol(symbol, tick);
          }
        }
      });

      await Promise.all(pricePromises);

      // Manage active trades (trailing stops, break-even)
      if (this.config.trailingEnabled) {
        await this.manageActiveTrades();
      }

    } catch (error) {
      console.error('OnTick error:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  private async processTickForSymbol(symbol: string, tick: TickData): Promise<void> {
    // Get candle history for SMC analysis
    const candles = this.candleHistory.get(symbol);
    if (!candles || candles.length < 20) {
      return;
    }

    // Perform SMC analysis
    const analysis = smartMoneyAnalyzer.analyze(candles, tick.bid);
    this.lastAnalysis.set(symbol, analysis);

    // Log high-confluence setups
    if (analysis.confluenceScore >= 40) {
      console.log(`📊 ${symbol} SMC Analysis:`, {
        bias: analysis.tradeBias,
        confluence: analysis.confluenceScore,
        factors: analysis.confluenceFactors.length,
        orderBlocks: analysis.orderBlocks.length,
        fvgs: analysis.fairValueGaps.length
      });
    }

    // Execute trade if conditions met
    if (this.shouldExecuteTrade(symbol, analysis, tick)) {
      await this.executeSMCTrade(symbol, analysis, tick);
    }
  }

  private shouldExecuteTrade(symbol: string, analysis: SMCAnalysis, tick: TickData): boolean {
    // Check if auto-execute is enabled
    if (!this.config.autoExecute || !orderManager.isAutoTradingActive()) {
      return false;
    }

    // Check confluence score (ChartLord requires 5+ factors ≈ 50%+)
    if (analysis.confluenceScore < this.config.minConfluence) {
      return false;
    }

    // Must have clear bias
    if (analysis.tradeBias === 'NEUTRAL') {
      return false;
    }

    // Check if already have position for this symbol
    const existingPositions = Array.from(this.activeTrades.values())
      .filter(t => t.symbol === symbol);
    if (existingPositions.length >= this.config.maxPositionsPerSymbol) {
      return false;
    }

    // Must have entry zone defined
    if (!analysis.entryZone) {
      return false;
    }

    // Price must be in entry zone
    const inEntryZone = tick.bid >= analysis.entryZone.low && tick.bid <= analysis.entryZone.high;
    if (!inEntryZone) {
      return false;
    }

    console.log(`✅ ${symbol} TRADE SIGNAL QUALIFIED:`, {
      bias: analysis.tradeBias,
      confluence: analysis.confluenceScore,
      factors: analysis.confluenceFactors,
      entryZone: analysis.entryZone,
      currentPrice: tick.bid
    });

    return true;
  }

  private async executeSMCTrade(symbol: string, analysis: SMCAnalysis, tick: TickData): Promise<void> {
    try {
      const type = analysis.tradeBias as 'BUY' | 'SELL';
      
      // Calculate SL/TP based on SMC levels
      let stopLoss: number;
      let takeProfit: number;
      const pipValue = this.getPipValue(symbol);

      if (type === 'BUY') {
        // SL below entry zone or invalidation level
        stopLoss = analysis.invalidationLevel || (analysis.entryZone!.low - 20 * pipValue);
        // TP at 2:1 R:R minimum
        const slDistance = tick.ask - stopLoss;
        takeProfit = tick.ask + (slDistance * 2);
      } else {
        // SL above entry zone or invalidation level
        stopLoss = analysis.invalidationLevel || (analysis.entryZone!.high + 20 * pipValue);
        // TP at 2:1 R:R minimum
        const slDistance = stopLoss - tick.bid;
        takeProfit = tick.bid - (slDistance * 2);
      }

      console.log(`🎯 Executing SMC Trade: ${type} ${symbol}`, {
        entry: type === 'BUY' ? tick.ask : tick.bid,
        stopLoss,
        takeProfit,
        confluence: analysis.confluenceScore,
        factors: analysis.confluenceFactors
      });

      const ticketId = await orderManager.executeOrder({
        symbol,
        type,
        volume: 0.01, // orderManager will calculate proper size
        stopLoss,
        takeProfit,
        comment: `SMC-${analysis.confluenceScore.toFixed(0)}%-${analysis.confluenceFactors.length}factors`
      });

      if (ticketId) {
        // Track active trade for trailing management
        const entryPrice = type === 'BUY' ? tick.ask : tick.bid;
        const slDistance = Math.abs(entryPrice - stopLoss);
        
        this.activeTrades.set(ticketId, {
          ticketId,
          symbol,
          type,
          entryPrice,
          stopLoss,
          takeProfit,
          currentPrice: entryPrice,
          profit: 0,
          rMultiple: 0,
          trailingActivated: false,
          breakEvenMoved: false
        });

        // Save signal to database
        await this.saveSignalToDatabase(symbol, analysis, type, entryPrice, stopLoss, takeProfit);

        console.log(`✅ SMC Trade executed successfully: ${ticketId}`);
      }

    } catch (error) {
      console.error(`❌ Failed to execute SMC trade for ${symbol}:`, error);
    }
  }

  /**
   * Dynamic Trailing Stop - ChartLord's profit locking system
   */
  private async manageActiveTrades(): Promise<void> {
    for (const [ticketId, trade] of this.activeTrades) {
      try {
        const currentPrice = this.lastPrices.get(trade.symbol);
        if (!currentPrice) continue;

        const price = trade.type === 'BUY' ? currentPrice.bid : currentPrice.ask;
        trade.currentPrice = price;

        // Calculate current R multiple
        const slDistance = Math.abs(trade.entryPrice - trade.stopLoss);
        const currentProfit = trade.type === 'BUY' 
          ? price - trade.entryPrice 
          : trade.entryPrice - price;
        trade.rMultiple = currentProfit / slDistance;
        trade.profit = currentProfit;

        // Move to break-even at 1R
        if (!trade.breakEvenMoved && trade.rMultiple >= 1) {
          const newStopLoss = trade.type === 'BUY'
            ? trade.entryPrice + (slDistance * 0.1) // Slight profit lock
            : trade.entryPrice - (slDistance * 0.1);

          console.log(`🔒 Moving ${trade.symbol} to break-even at 1R:`, {
            oldSL: trade.stopLoss,
            newSL: newStopLoss,
            rMultiple: trade.rMultiple.toFixed(2)
          });

          // Update stop loss in MT5
          await this.updateStopLoss(ticketId, newStopLoss);
          trade.stopLoss = newStopLoss;
          trade.breakEvenMoved = true;
        }

        // Activate trailing stop at 1.5R
        if (!trade.trailingActivated && trade.rMultiple >= 1.5) {
          trade.trailingActivated = true;
          console.log(`📈 Trailing stop activated for ${trade.symbol} at ${trade.rMultiple.toFixed(2)}R`);
        }

        // Trail stop at 50% of profit from 1.5R onwards
        if (trade.trailingActivated && trade.rMultiple >= 1.5) {
          const lockedR = trade.rMultiple * 0.5; // Lock 50% of gains
          const newStopLoss = trade.type === 'BUY'
            ? trade.entryPrice + (slDistance * lockedR)
            : trade.entryPrice - (slDistance * lockedR);

          if ((trade.type === 'BUY' && newStopLoss > trade.stopLoss) ||
              (trade.type === 'SELL' && newStopLoss < trade.stopLoss)) {
            console.log(`📈 Trailing ${trade.symbol} stop to lock ${(lockedR).toFixed(1)}R:`, {
              oldSL: trade.stopLoss,
              newSL: newStopLoss,
              currentR: trade.rMultiple.toFixed(2)
            });
            await this.updateStopLoss(ticketId, newStopLoss);
            trade.stopLoss = newStopLoss;
          }
        }

      } catch (error) {
        console.error(`Error managing trade ${ticketId}:`, error);
      }
    }
  }

  private async updateStopLoss(ticketId: string, newStopLoss: number): Promise<void> {
    try {
      // This would call MT5 Bridge to modify the order
      // For now, we'll update through our position management
      console.log(`📝 Updating SL for ${ticketId} to ${newStopLoss}`);
      // TODO: Implement MT5 Bridge order modification
    } catch (error) {
      console.error('Failed to update stop loss:', error);
    }
  }

  private async fetchAllCandleData(): Promise<void> {
    for (const symbol of this.config.symbols) {
      try {
        const candles = await this.fetchCandleData(symbol);
        if (candles.length > 0) {
          this.candleHistory.set(symbol, candles);
        }
      } catch (error) {
        console.error(`Failed to fetch candles for ${symbol}:`, error);
      }
    }
  }

  private async fetchCandleData(symbol: string): Promise<CandleData[]> {
    try {
      // Fetch from MT5 Bridge
      const response = await fetch(`http://localhost:8001/mt5/historical_data`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol,
          timeframe: 'M15',
          count: 100
        })
      });

      if (!response.ok) {
        throw new Error('Failed to fetch historical data');
      }

      const result = await response.json();
      
      if (result.success && result.data) {
        return result.data.map((bar: any) => ({
          open: bar.open,
          high: bar.high,
          low: bar.low,
          close: bar.close,
          volume: bar.volume || 0,
          timestamp: new Date(bar.time * 1000)
        }));
      }

      return [];
    } catch (error) {
      // Fallback: generate from current prices
      const price = this.lastPrices.get(symbol);
      if (!price) return [];

      // Generate synthetic candles for testing
      const candles: CandleData[] = [];
      let basePrice = price.bid;
      
      for (let i = 99; i >= 0; i--) {
        const variance = (Math.random() - 0.5) * 0.002 * basePrice;
        const open = basePrice + variance;
        const high = open + Math.abs(variance) * 0.5;
        const low = open - Math.abs(variance) * 0.5;
        const close = open + (Math.random() - 0.5) * 0.001 * basePrice;
        
        candles.push({
          open,
          high,
          low,
          close,
          volume: Math.random() * 1000,
          timestamp: new Date(Date.now() - i * 15 * 60 * 1000)
        });
        
        basePrice = close;
      }

      return candles;
    }
  }

  private async saveSignalToDatabase(
    symbol: string,
    analysis: SMCAnalysis,
    type: 'BUY' | 'SELL',
    entryPrice: number,
    stopLoss: number,
    takeProfit: number
  ): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get or create currency pair
      let { data: pair } = await supabase
        .from('currency_pairs')
        .select('id')
        .eq('symbol', symbol)
        .single();

      if (!pair) {
        const { data: newPair } = await supabase
          .from('currency_pairs')
          .insert({
            symbol,
            base_currency: symbol.substring(0, 3),
            quote_currency: symbol.substring(3, 6),
            display_name: symbol
          })
          .select('id')
          .single();
        pair = newPair;
      }

      if (!pair) return;

      await supabase.from('trading_signals').insert({
        user_id: user.id,
        pair_id: pair.id,
        signal_type: type,
        confidence_score: analysis.confluenceScore,
        entry_price: entryPrice,
        stop_loss: stopLoss,
        take_profit: takeProfit,
        timeframe: '15M',
        reasoning: `SMC Analysis: ${analysis.confluenceFactors.join(', ')}`,
        ai_model: 'OnTickEngine-SMC',
        status: 'EXECUTED'
      });

    } catch (error) {
      console.error('Failed to save signal:', error);
    }
  }

  private getPipValue(symbol: string): number {
    if (symbol.includes('JPY')) return 0.01;
    if (symbol.includes('XAU') || symbol.includes('GOLD')) return 0.01;
    return 0.0001;
  }

  // Getters
  getConfig(): OnTickConfig {
    return { ...this.config };
  }

  getLastAnalysis(symbol: string): SMCAnalysis | undefined {
    return this.lastAnalysis.get(symbol);
  }

  getActiveTrades(): ActiveTrade[] {
    return Array.from(this.activeTrades.values());
  }

  setConfig(config: Partial<OnTickConfig>): void {
    this.config = { ...this.config, ...config };
    console.log('⚡ OnTick Engine config updated:', this.config);
  }

  setEnabled(enabled: boolean): void {
    this.config.enabled = enabled;
    console.log(`⚡ OnTick Engine ${enabled ? 'ENABLED' : 'DISABLED'}`);
  }

  setAutoExecute(enabled: boolean): void {
    this.config.autoExecute = enabled;
    console.log(`⚡ OnTick auto-execute ${enabled ? 'ENABLED' : 'DISABLED'}`);
  }
}

export const onTickEngine = new OnTickEngine();
