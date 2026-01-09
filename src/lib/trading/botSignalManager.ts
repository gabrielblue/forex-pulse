import { supabase } from '@/integrations/supabase/client';
import { orderManager } from './orderManager';
import { exnessAPI } from './exnessApi';
import { aiAnalyzer } from './aiAnalyzer';

export interface SignalGenerationConfig {
  enabled: boolean;
  interval: number;
  symbols: string[];
  minConfidence: number;
  autoExecute: boolean;
  maxDailySignals: number;
  aggressiveMode: boolean;
}

class BotSignalManager {
  private config: SignalGenerationConfig = {
    enabled: false,
    interval: 180000, // 3 minutes
    symbols: ['XAUUSD', 'EURUSD', 'GBPUSD', 'USDJPY'],
    minConfidence: 65,
    autoExecute: false,
    maxDailySignals: 100,
    aggressiveMode: false,
  };

  private generationInterval: NodeJS.Timeout | null = null;
  private isGenerating = false;
  private lastGenerationTime = 0;
  private dailySignalCount = 0;
  private lastResetDate = new Date().toDateString();
  private analysisLocks: Set<string> = new Set();
  private lastAICallTime: Map<string, number> = new Map();
  private readonly AI_CALL_COOLDOWN = 120000; // 2 minutes
  private currentSymbolIndex = 0;
  private historicalDataCache: Map<string, { data: any[]; timestamp: number }> = new Map();
  private readonly CACHE_TTL = 60000; // 1 minute

  async initialize(config?: Partial<SignalGenerationConfig>): Promise<void> {
    if (config) this.config = { ...this.config, ...config };
    this.resetDailyCountersIfNeeded();
    console.log('📡 Signal Manager initialized with config:', this.config);
  }

  private resetDailyCountersIfNeeded(): void {
    const today = new Date().toDateString();
    if (this.lastResetDate !== today) {
      this.dailySignalCount = 0;
      this.lastResetDate = today;
      console.log('🔄 Daily signal counters reset for new trading day');
    }
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

  async generateAndProcessSignals(): Promise<void> {
    if (this.isGenerating) return;
    const timeSinceLast = Date.now() - this.lastGenerationTime;
    if (timeSinceLast < 30000 || !this.canGenerateMoreSignals()) return;

    this.isGenerating = true;
    this.lastGenerationTime = Date.now();
    this.dailySignalCount++;

    try {
      if (!exnessAPI.isConnectedToExness()) return console.warn('⚠️ Not connected to Exness');

      const { canTrade, issues } = await exnessAPI.verifyTradingCapabilities();
      if (!canTrade) return console.warn('⚠️ Trading not allowed:', issues.join(', '));

      const symbol = this.rotateSymbol();
      await this.analyzeAndGenerateSignal(symbol);

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
      const marketPrice = await exnessAPI.getCurrentPrice(symbol);
      if (!marketPrice?.bid || !marketPrice?.ask) return console.warn(`⚠️ Invalid price for ${symbol}`);

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

  private async performTechnicalAnalysis(symbol: string, price: any): Promise<any> {
    try {
      const prices = await this.generateRecentPrices(price.bid, 100, symbol);
      const volumes = await this.generateRecentVolumes(100, symbol);
      if (prices.length < 20 || volumes.length < 20) return null;

      const indicators = this.calculateTechnicalIndicators(prices);
      const aiAnalysis = await aiAnalyzer.analyzeMarket({
        symbol,
        timeframe: '15m',
        marketData: { currentPrice: price.bid, bid: price.bid, ask: price.ask, spread: price.spread, high: Math.max(...prices), low: Math.min(...prices) },
        technicalIndicators: { ...indicators, volume: volumes[volumes.length - 1] }
      });

      if (aiAnalysis.signal === 'HOLD' || aiAnalysis.confidence < 65) return null;

      return {
        direction: aiAnalysis.signal,
        confidence: aiAnalysis.confidence,
        stopLoss: aiAnalysis.stopLoss,
        takeProfit: aiAnalysis.takeProfit,
        reasoning: `AI Analysis (${aiAnalysis.confidence}% confidence): ${aiAnalysis.reasoning}. Market Regime: ${aiAnalysis.regime}. Risk: ${aiAnalysis.riskLevel}.`,
        volume: this.calculatePositionSizeFromAI(aiAnalysis.confidence, aiAnalysis.positionSizeRecommendation, symbol),
        expectedValue: this.calculateExpectedValue(aiAnalysis.entryPrice || price.bid, aiAnalysis.takeProfit, aiAnalysis.stopLoss, aiAnalysis.confidence)
      };
    } catch (error) {
      console.error('AI analysis failed:', error);
      return null;
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
    } catch (err) {
      console.error(`❌ Auto-execution failed for ${signalPayload.symbol}:`, err);
    }
  }

  private calculatePositionSizeFromAI(confidence: number, recommendation: 'SMALL' | 'MEDIUM' | 'LARGE', symbol: string): number {
    let baseVolume = recommendation === 'LARGE' ? 0.1 : recommendation === 'MEDIUM' ? 0.05 : 0.01;
    if (confidence >= 90) baseVolume *= 1.5;
    else if (confidence >= 85) baseVolume *= 1.2;
    return Math.min(baseVolume, 0.2);
  }

  private calculateExpectedValue(entry: number, tp: number, sl: number, confidence: number): number {
    const potentialProfit = Math.abs(tp - entry);
    const potentialLoss = Math.abs(entry - sl);
    const winProbability = confidence / 100;
    return (potentialProfit * winProbability) - (potentialLoss * (1 - winProbability));
  }

  async saveSignal(signal: any): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      let { data: pair } = await supabase.from('currency_pairs').select('id').eq('symbol', signal.symbol).single();
      if (!pair?.id) {
        const baseCurrency = signal.symbol.substring(0, 3);
        const quoteCurrency = signal.symbol.substring(3, 6);
        const { data: newPair } = await supabase.from('currency_pairs').insert({
          symbol: signal.symbol,
          base_currency: baseCurrency,
          quote_currency: quoteCurrency,
          display_name: signal.symbol
        }).select('id').single();
        pair = newPair;
      }

      await supabase.from('trading_signals').insert({
        user_id: user.id,
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
    } catch (error) {
      console.error('Failed to save signal:', error);
    }
  }

  async executePendingSignals(): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: signals } = await supabase.from('trading_signals')
        .select('*, currency_pairs(symbol)')
        .eq('user_id', user.id)
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
    } catch (error) {
      console.error('Failed to execute pending signals:', error);
    }
  }

  // --- Helper Methods: Historical Data, Prices, Volumes ---
  private async fetchHistoricalDataWithCache(symbol: string, count: number): Promise<any[] | null> {
    const cacheKey = `${symbol}_${count}`;
    const cached = this.historicalDataCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) return cached.data;

    const data = await exnessAPI.getHistoricalData(symbol, '15m', count);
    if (data?.length) this.historicalDataCache.set(cacheKey, { data, timestamp: Date.now() });
    return data;
  }

  private async generateRecentPrices(currentPrice: number, count: number, symbol: string): Promise<number[]> {
    try {
      const historicalData = await this.fetchHistoricalDataWithCache(symbol, count);
      return historicalData?.map((bar: any) => bar.close) || [];
    } catch (error) {
      console.error(`Failed to fetch prices for ${symbol}:`, error);
      return [];
    }
  }

  private async generateRecentVolumes(count: number, symbol: string): Promise<number[]> {
    try {
      const historicalData = await this.fetchHistoricalDataWithCache(symbol, count);
      return historicalData?.map((bar: any) => bar.tick_volume || bar.volume || 0) || [];
    } catch (error) {
      console.error(`Failed to fetch volumes for ${symbol}:`, error);
      return [];
    }
  }

  // --- Technical Indicators ---
  private calculateTechnicalIndicators(prices: number[]): any {
    if (prices.length < 20) return {};

    const sma20 = this.average(prices.slice(-20));
    const sma50 = prices.length >= 50 ? this.average(prices.slice(-50)) : sma20;
    const sma200 = prices.length >= 200 ? this.average(prices.slice(-200)) : sma20;
    return {
      sma20,
      sma50,
      sma200,
      ema20: sma20,
      ema50: sma50,
      ema200: sma200,
      rsi: this.calculateRSI(prices, 14),
      bollinger: this.calculateBollinger(prices.slice(-20), sma20),
      atr: this.calculateATR(prices, 14),
      adx: this.calculateADX(prices, 14)
    };
  }

  private calculateADX(prices: number[], period: number): number {
    if (prices.length < period + 1) return 25; // Neutral value

    // Calculate +DI and -DI
    const plusDM: number[] = [];
    const minusDM: number[] = [];
    const tr: number[] = [];

    for (let i = 1; i < prices.length; i++) {
      const highDiff = prices[i] - prices[i - 1];
      const lowDiff = prices[i - 1] - prices[i];

      plusDM.push(highDiff > lowDiff && highDiff > 0 ? highDiff : 0);
      minusDM.push(lowDiff > highDiff && lowDiff > 0 ? lowDiff : 0);
      tr.push(Math.abs(prices[i] - prices[i - 1]));
    }

    // Smooth the values
    const smoothPlusDM = this.average(plusDM.slice(-period));
    const smoothMinusDM = this.average(minusDM.slice(-period));
    const smoothTR = this.average(tr.slice(-period));

    if (smoothTR === 0) return 25;

    const plusDI = (smoothPlusDM / smoothTR) * 100;
    const minusDI = (smoothMinusDM / smoothTR) * 100;

    // Calculate DX and ADX
    const dx = Math.abs(plusDI - minusDI) / (plusDI + minusDI || 1) * 100;
    return Math.min(100, Math.max(0, dx));
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
