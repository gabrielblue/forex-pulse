/**
 * OnTick Engine - ChartLord AI Style Real-Time Execution
 * Monitors price changes and reacts instantly
 */

import { exnessAPI } from './exnessApi';
import { orderManager } from './orderManager';
import { smartMoneyAnalyzer, CandleData, SMCAnalysis } from './smartMoneyAnalyzer';
import { tradingFilters, TradingFilterResult } from './tradingFilters';
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
}

class OnTickEngine {
  private config: OnTickConfig = {
    enabled: false,
    symbols: ['EURUSD', 'GBPUSD', 'USDJPY', 'XAUUSD', 'AUDUSD', 'USDCHF'],
    minConfluence: 50,
    autoExecute: false,
    trailingEnabled: true,
    maxPositionsPerSymbol: 1,
    killzoneFilterEnabled: true,
    newsBlackoutEnabled: true,
    newsBlackoutMinutes: 30
  };

  private tickInterval: NodeJS.Timeout | null = null;
  private lastPrices: Map<string, TickData> = new Map();
  private candleHistory: Map<string, CandleData[]> = new Map();
  public activeTrades: Map<string, ActiveTrade> = new Map(); // make public for BotSignalManager if needed
  private lastAnalysis: Map<string, SMCAnalysis> = new Map();
  private lastFilterResult: Map<string, TradingFilterResult> = new Map();
  private isProcessing = false;

  private readonly TICK_INTERVAL = 500;
  private readonly CANDLE_FETCH_INTERVAL = 30000;

  constructor() {
    this.onTick = this.onTick.bind(this);
    this.manageActiveTrades = this.manageActiveTrades.bind(this);
  }

  async initialize(config?: Partial<OnTickConfig>): Promise<void> {
    if (config) this.config = { ...this.config, ...config };

    tradingFilters.setKillzoneEnabled(this.config.killzoneFilterEnabled);
    tradingFilters.setNewsBlackoutEnabled(this.config.newsBlackoutEnabled);
    tradingFilters.setNewsBlackoutMinutes(this.config.newsBlackoutMinutes);

    console.log('⚡ OnTick Engine initialized:', this.config);
  }

  start(): void {
    if (this.tickInterval) return console.log('⚡ OnTick Engine already running');

    console.log('🚀 Starting OnTick Engine...');
    this.tickInterval = setInterval(this.onTick, this.TICK_INTERVAL);

    this.fetchAllCandleData();
    setInterval(() => this.fetchAllCandleData(), this.CANDLE_FETCH_INTERVAL);
  }

  stop(): void {
    if (this.tickInterval) clearInterval(this.tickInterval);
    this.tickInterval = null;
    console.log('🛑 OnTick Engine stopped');
  }

  private async onTick(): Promise<void> {
    if (this.isProcessing || !this.config.enabled || !exnessAPI.isConnectedToExness()) return;

    this.isProcessing = true;
    try {
      await Promise.all(this.config.symbols.map(async (symbol) => {
        const price = await exnessAPI.getCurrentPrice(symbol);
        if (!price) return;

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
          await this.processTickForSymbol(symbol, tick);
        }
      }));

      if (this.config.trailingEnabled) await this.manageActiveTrades();

    } catch (error) {
      console.error('OnTick error:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  private async processTickForSymbol(symbol: string, tick: TickData): Promise<void> {
    const candles = this.candleHistory.get(symbol);
    if (!candles || candles.length < 20) return;

    const filterResult = await tradingFilters.canTradeNow(symbol);
    this.lastFilterResult.set(symbol, filterResult);

    const analysis = smartMoneyAnalyzer.analyze(candles, tick.bid);
    this.lastAnalysis.set(symbol, analysis);

    if (filterResult.canTrade && this.shouldExecuteTrade(symbol, analysis, tick)) {
      await this.executeSMCTrade(symbol, analysis, tick);
    }
  }

  private shouldExecuteTrade(symbol: string, analysis: SMCAnalysis, tick: TickData): boolean {
    if (!this.config.autoExecute || !orderManager.isAutoTradingActive()) return false;
    if (analysis.confluenceScore < this.config.minConfluence) return false;
    if (!analysis.tradeBias || analysis.tradeBias === 'NEUTRAL') return false;

    const existingPositions = Array.from(this.activeTrades.values()).filter(t => t.symbol === symbol);
    if (existingPositions.length >= this.config.maxPositionsPerSymbol) return false;
    if (!analysis.entryZone) return false;

    const inEntryZone = tick.bid >= analysis.entryZone.low && tick.bid <= analysis.entryZone.high;
    return inEntryZone;
  }

  private async executeSMCTrade(symbol: string, analysis: SMCAnalysis, tick: TickData): Promise<void> {
    try {
      const type = analysis.tradeBias as 'BUY' | 'SELL';
      const pipValue = this.getPipValue(symbol);
      let stopLoss: number, takeProfit: number;

      if (type === 'BUY') {
        stopLoss = analysis.invalidationLevel || (analysis.entryZone!.low - 20 * pipValue);
        takeProfit = tick.ask + ((tick.ask - stopLoss) * 2);
      } else {
        stopLoss = analysis.invalidationLevel || (analysis.entryZone!.high + 20 * pipValue);
        takeProfit = tick.bid - ((stopLoss - tick.bid) * 2);
      }

      const ticketId = await orderManager.executeOrder({
        symbol,
        type,
        volume: 0.01,
        stopLoss,
        takeProfit,
        comment: `SMC-${analysis.confluenceScore.toFixed(0)}%-${analysis.confluenceFactors.length}factors`
      });

      if (!ticketId) return;

      const entryPrice = type === 'BUY' ? tick.ask : tick.bid;
      this.activeTrades.set(ticketId, {
        ticketId, symbol, type, entryPrice, stopLoss, takeProfit,
        currentPrice: entryPrice, profit: 0, rMultiple: 0,
        trailingActivated: false, breakEvenMoved: false
      });

      await this.saveSignalToDatabase(symbol, analysis, type, entryPrice, stopLoss, takeProfit);

    } catch (error) {
      console.error(`❌ Failed to execute SMC trade for ${symbol}:`, error);
    }
  }

  private getPipValue(symbol: string): number {
    if (symbol.includes('JPY')) return 0.01;
    if (symbol.includes('XAU') || symbol.includes('GOLD')) return 0.01;
    return 0.0001;
  }

  private async fetchAllCandleData(): Promise<void> {
    for (const symbol of this.config.symbols) {
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
      const bars = await exnessAPI.getHistoricalData(symbol, '15m', 100);
      return bars.map((bar: any) => ({
        open: bar.open, high: bar.high, low: bar.low, close: bar.close,
        volume: bar.tick_volume, timestamp: new Date(bar.time * 1000)
      }));
    } catch (error) {
      console.error(`❌ Failed to fetch candles for ${symbol}:`, error);
      return [];
    }
  }

  private async saveSignalToDatabase(
    symbol: string, analysis: SMCAnalysis, type: 'BUY' | 'SELL',
    entryPrice: number, stopLoss: number, takeProfit: number
  ): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      let { data: pair } = await supabase.from('currency_pairs').select('id').eq('symbol', symbol).single();
      if (!pair) {
        const { data: newPair } = await supabase.from('currency_pairs').insert({
          symbol, base_currency: symbol.slice(0, 3), quote_currency: symbol.slice(3, 6), display_name: symbol
        }).select('id').single();
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

  /** NEW: Manage active trades with trailing logic */
  public async manageActiveTrades(): Promise<void> {
    try {
      for (const trade of Array.from(this.activeTrades.values())) {
        const currentPrice = (await exnessAPI.getCurrentPrice(trade.symbol))?.bid;
        if (!currentPrice) continue;

        trade.currentPrice = currentPrice;
        trade.profit = (trade.type === 'BUY' ? currentPrice - trade.entryPrice : trade.entryPrice - currentPrice);
        trade.rMultiple = trade.profit / Math.abs(trade.entryPrice - trade.stopLoss);

        // Example: break-even and trailing logic (simplified)
        if (!trade.breakEvenMoved && trade.profit >= (trade.stopLoss * 2)) {
          trade.stopLoss = trade.entryPrice; // move SL to break-even
          trade.breakEvenMoved = true;
        }

        if (!trade.trailingActivated && trade.profit > 0.5) {
          trade.trailingActivated = true;
          trade.stopLoss = currentPrice - 0.5; // example trailing
        }
      }
    } catch (error) {
      console.error('Failed to manage active trades:', error);
    }
  }
}

export const onTickEngine = new OnTickEngine();
