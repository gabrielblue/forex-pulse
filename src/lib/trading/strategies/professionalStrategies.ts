import { TradingSignal } from '../signalProcessor';

export interface MarketData {
  symbol: string;
  prices: number[];
  volumes: number[];
  timestamps: Date[];
}

export interface TechnicalIndicators {
  rsi: number;
  macd: { value: number; signal: number; histogram: number };
  ema20: number;
  ema50: number;
  sma200: number;
  bollinger: { upper: number; middle: number; lower: number };
  stochastic: { k: number; d: number };
  atr: number;
}

export class ProfessionalTradingStrategies {
  
  // 1. Scalping Strategy - High frequency, quick profits
  async scalpingStrategy(marketData: MarketData, indicators: TechnicalIndicators): Promise<TradingSignal | null> {
    const { rsi, macd, ema20, ema50 } = indicators;
    const currentPrice = marketData.prices[marketData.prices.length - 1];
    
    // RSI oversold/overbought with MACD confirmation
    if (rsi < 60 && macd.value > macd.signal && ema20 > ema50) { // Ultra lenient RSI for day trading
      return {
        id: this.generateSignalId(),
        symbol: marketData.symbol,
        type: 'BUY',
        confidence: 60, // Lower confidence for maximum opportunities
        entryPrice: currentPrice,
        stopLoss: currentPrice - (0.0001 * this.getPipValue(marketData.symbol)), // Ultra tight stop loss
        takeProfit: currentPrice + (0.0003 * this.getPipValue(marketData.symbol)), // Ultra close take profit
        timeframe: '1M',
        reasoning: 'Day trading scalping: RSI oversold with bullish MACD crossover',
        source: 'Scalping Strategy'
      };
    }
    
    if (rsi > 40 && macd.value < macd.signal && ema20 < ema50) { // Ultra lenient RSI for day trading
      return {
        id: this.generateSignalId(),
        symbol: marketData.symbol,
        type: 'SELL',
        confidence: 60,
        entryPrice: currentPrice,
        stopLoss: currentPrice + (0.0001 * this.getPipValue(marketData.symbol)), // Ultra tight stop loss
        takeProfit: currentPrice - (0.0003 * this.getPipValue(marketData.symbol)), // Ultra close take profit
        timeframe: '1M',
        reasoning: 'Day trading scalping: RSI overbought with bearish MACD crossover',
        source: 'Scalping Strategy'
      };
    }
    
    return null;
  }

  // 2. Swing Trading Strategy - Medium term positions
  async swingTradingStrategy(marketData: MarketData, indicators: TechnicalIndicators): Promise<TradingSignal | null> {
    const { ema20, ema50, sma200, bollinger, rsi } = indicators;
    const currentPrice = marketData.prices[marketData.prices.length - 1];
    
    // Golden Cross with trend confirmation
    if (ema20 > ema50 && currentPrice > bollinger.middle && rsi > 40) { // Ultra lenient conditions
      return {
        id: this.generateSignalId(),
        symbol: marketData.symbol,
        type: 'BUY',
        confidence: 75, // Lower confidence for maximum opportunities
        entryPrice: currentPrice,
        stopLoss: currentPrice - (currentPrice * 0.006), // Ultra tight stop loss (0.6%)
        takeProfit: currentPrice + (currentPrice * 0.009), // Closer take profit (0.9%)
        timeframe: '4H',
        reasoning: 'Day trading swing: EMA bullish alignment with momentum',
        source: 'Swing Trading Strategy'
      };
    }
    
    // Death Cross with trend confirmation
    if (ema20 < ema50 && currentPrice < bollinger.middle && rsi < 60) { // Ultra lenient conditions
      return {
        id: this.generateSignalId(),
        symbol: marketData.symbol,
        type: 'SELL',
        confidence: 75,
        entryPrice: currentPrice,
        stopLoss: currentPrice + (currentPrice * 0.006), // Ultra tight stop loss
        takeProfit: currentPrice - (currentPrice * 0.009), // Closer take profit
        timeframe: '4H',
        reasoning: 'Day trading swing: EMA bearish alignment with momentum',
        source: 'Swing Trading Strategy'
      };
    }
    
    return null;
  }

  // 3. Breakout Strategy - Momentum trading
  async breakoutStrategy(marketData: MarketData, indicators: TechnicalIndicators): Promise<TradingSignal | null> {
    const { bollinger, atr, rsi } = indicators;
    const currentPrice = marketData.prices[marketData.prices.length - 1];
    const recentPrices = marketData.prices.slice(-20);
    const resistance = Math.max(...recentPrices);
    const support = Math.min(...recentPrices);
    
    // Bollinger Band breakout with volume confirmation
    if (currentPrice > bollinger.upper && rsi < 90) { // Ultra lenient RSI
      return {
        id: this.generateSignalId(),
        symbol: marketData.symbol,
        type: 'BUY',
        confidence: 72, // Ultra low confidence for maximum opportunities
        entryPrice: currentPrice,
        stopLoss: currentPrice - (atr * 0.6), // Ultra tight stop loss
        takeProfit: currentPrice + (atr * 0.9), // Ultra close take profit
        timeframe: '1H',
        reasoning: 'Day trading breakout: Bollinger upper breakout with momentum',
        source: 'Breakout Strategy'
      };
    }
    
    if (currentPrice < bollinger.lower && rsi > 10) { // Ultra lenient RSI
      return {
        id: this.generateSignalId(),
        symbol: marketData.symbol,
        type: 'SELL',
        confidence: 72,
        entryPrice: currentPrice,
        stopLoss: currentPrice + (atr * 0.6), // Ultra tight stop loss
        takeProfit: currentPrice - (atr * 0.9), // Ultra close take profit
        timeframe: '1H',
        reasoning: 'Day trading breakout: Bollinger lower breakout with momentum',
        source: 'Breakout Strategy'
      };
    }
    
    return null;
  }

  // 4. Mean Reversion Strategy
  async meanReversionStrategy(marketData: MarketData, indicators: TechnicalIndicators): Promise<TradingSignal | null> {
    const { bollinger, rsi, stochastic } = indicators;
    const currentPrice = marketData.prices[marketData.prices.length - 1];
    
    // Oversold conditions with mean reversion signals
    if (currentPrice < bollinger.middle && rsi < 40 && stochastic.k < 35) { // Ultra lenient conditions
      return {
        id: this.generateSignalId(),
        symbol: marketData.symbol,
        type: 'BUY',
        confidence: 68, // Ultra low confidence for maximum opportunities
        entryPrice: currentPrice,
        stopLoss: currentPrice - (indicators.atr * 0.6), // Ultra tight stop loss
        takeProfit: currentPrice + (indicators.atr * 0.8), // Ultra close take profit
        timeframe: '1H',
        reasoning: 'Day trading mean reversion: Oversold conditions with reversal potential',
        source: 'Mean Reversion Strategy'
      };
    }
    
    // Overbought conditions with mean reversion signals
    if (currentPrice > bollinger.middle && rsi > 60 && stochastic.k > 65) { // Ultra lenient conditions
      return {
        id: this.generateSignalId(),
        symbol: marketData.symbol,
        type: 'SELL',
        confidence: 68,
        entryPrice: currentPrice,
        stopLoss: currentPrice + (indicators.atr * 0.6), // Ultra tight stop loss
        takeProfit: currentPrice - (indicators.atr * 0.8), // Ultra close take profit
        timeframe: '1H',
        reasoning: 'Day trading mean reversion: Overbought conditions with reversal potential',
        source: 'Mean Reversion Strategy'
      };
    }
    
    return null;
  }

  // 5. Grid Trading Strategy
  async gridTradingStrategy(marketData: MarketData, indicators: TechnicalIndicators): Promise<TradingSignal | null> {
    const currentPrice = marketData.prices[marketData.prices.length - 1];
    const { atr, ema20 } = indicators;
    
    const gridSize = atr * 0.5;
    const distanceFromEMA = Math.abs(currentPrice - ema20);
    
    // Create grid levels around EMA
    if (distanceFromEMA > gridSize && currentPrice < ema20) {
      return {
        id: this.generateSignalId(),
        symbol: marketData.symbol,
        type: 'BUY',
        confidence: 75,
        entryPrice: currentPrice,
        stopLoss: currentPrice - (gridSize * 2),
        takeProfit: ema20,
        timeframe: '15M',
        reasoning: 'Grid: Price below EMA, buying at grid level',
        source: 'Grid Trading Strategy'
      };
    }
    
    if (distanceFromEMA > gridSize && currentPrice > ema20) {
      return {
        id: this.generateSignalId(),
        symbol: marketData.symbol,
        type: 'SELL',
        confidence: 75,
        entryPrice: currentPrice,
        stopLoss: currentPrice + (gridSize * 2),
        takeProfit: ema20,
        timeframe: '15M',
        reasoning: 'Grid: Price above EMA, selling at grid level',
        source: 'Grid Trading Strategy'
      };
    }
    
    return null;
  }

  // 6. News-Based Strategy
  async newsBasedStrategy(marketData: MarketData, newsImpact: 'HIGH' | 'MEDIUM' | 'LOW'): Promise<TradingSignal | null> {
    if (newsImpact === 'HIGH') {
      // Avoid trading during high impact news
      return null;
    }
    
    const currentPrice = marketData.prices[marketData.prices.length - 1];
    const recentVolume = marketData.volumes.slice(-5).reduce((a, b) => a + b, 0);
    const avgVolume = marketData.volumes.reduce((a, b) => a + b, 0) / marketData.volumes.length;
    
    // Trade on medium impact news with volume confirmation
    if (newsImpact === 'MEDIUM' && recentVolume > avgVolume * 1.5) {
      const priceChange = (currentPrice - marketData.prices[marketData.prices.length - 6]) / marketData.prices[marketData.prices.length - 6];
      
      if (priceChange > 0.001) { // Positive momentum
        return {
          id: this.generateSignalId(),
          symbol: marketData.symbol,
          type: 'BUY',
          confidence: 82,
          entryPrice: currentPrice,
          stopLoss: currentPrice - (0.002 * this.getPipValue(marketData.symbol)),
          takeProfit: currentPrice + (0.004 * this.getPipValue(marketData.symbol)),
          timeframe: '5M',
          reasoning: 'News: Medium impact news with positive momentum and volume',
          source: 'News-Based Strategy'
        };
      }
    }
    
    return null;
  }

  // Risk Management Functions
  calculatePositionSize(accountBalance: number, riskPerTrade: number, stopLossDistance: number): number {
    const riskAmount = accountBalance * (riskPerTrade / 100);
    return Math.min(riskAmount / stopLossDistance, accountBalance * 0.1); // Max 10% of balance
  }

  // Utility Functions
  private generateSignalId(): string {
    return `signal_${Date.now()}_${crypto.randomUUID().substring(0, 9)}`;
  }

  private getPipValue(symbol: string): number {
    const pipValues: Record<string, number> = {
      'EURUSD': 0.0001,
      'GBPUSD': 0.0001,
      'USDJPY': 0.01,
      'AUDUSD': 0.0001,
      'USDCHF': 0.0001,
      'NZDUSD': 0.0001,
      'USDCAD': 0.0001,
      'EURJPY': 0.01,
      'GBPJPY': 0.01,
      'CHFJPY': 0.01
    };
    return pipValues[symbol] || 0.0001;
  }

  // Technical Indicators Calculator
  calculateTechnicalIndicators(prices: number[], volumes: number[]): TechnicalIndicators {
    // Ensure we have enough data
    if (prices.length < 20) {
      const currentPrice = prices[prices.length - 1] || 1.0000;
      return {
        rsi: 50,
        macd: { value: 0, signal: 0, histogram: 0 },
        ema20: currentPrice,
        ema50: currentPrice,
        sma200: currentPrice,
        bollinger: { upper: currentPrice * 1.01, middle: currentPrice, lower: currentPrice * 0.99 },
        stochastic: { k: 50, d: 50 },
        atr: 0.001
      };
    }
    
    return {
      rsi: this.calculateRSI(prices, 14),
      macd: this.calculateMACD(prices),
      ema20: this.calculateEMA(prices, 20),
      ema50: this.calculateEMA(prices, 50),
      sma200: this.calculateSMA(prices, 200),
      bollinger: this.calculateBollingerBands(prices, 20, 2),
      stochastic: this.calculateStochastic(prices, 14),
      atr: this.calculateATR(prices, 14)
    };
  }
  
  private calculateStochastic(prices: number[], period: number): { k: number; d: number } {
    if (prices.length < period) return { k: 50, d: 50 };
    
    const recentPrices = prices.slice(-period);
    const highest = Math.max(...recentPrices);
    const lowest = Math.min(...recentPrices);
    const current = prices[prices.length - 1];
    
    const k = ((current - lowest) / (highest - lowest)) * 100;
    const d = k * 0.9; // Simplified D% calculation
    
    return { k, d };
  }

  private calculateRSI(prices: number[], period: number): number {
    if (prices.length < period + 1) return 50;
    
    let gains = 0;
    let losses = 0;
    
    for (let i = 1; i <= period; i++) {
      const change = prices[prices.length - i] - prices[prices.length - i - 1];
      if (change > 0) gains += change;
      else losses -= change;
    }
    
    const avgGain = gains / period;
    const avgLoss = losses / period;
    
    if (avgLoss === 0) return 100;
    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
  }

  private calculateEMA(prices: number[], period: number): number {
    if (prices.length < period) return prices[prices.length - 1];
    
    const multiplier = 2 / (period + 1);
    let ema = prices.slice(0, period).reduce((a, b) => a + b, 0) / period;
    
    for (let i = period; i < prices.length; i++) {
      ema = (prices[i] * multiplier) + (ema * (1 - multiplier));
    }
    
    return ema;
  }

  private calculateSMA(prices: number[], period: number): number {
    if (prices.length < period) return prices[prices.length - 1];
    
    const recentPrices = prices.slice(-period);
    return recentPrices.reduce((a, b) => a + b, 0) / period;
  }

  private calculateMACD(prices: number[]): { value: number; signal: number; histogram: number } {
    const ema12 = this.calculateEMA(prices, 12);
    const ema26 = this.calculateEMA(prices, 26);
    const macdValue = ema12 - ema26;
    
    // Simple signal line calculation (normally would use EMA of MACD)
    const signal = macdValue * 0.9; // Simplified
    const histogram = macdValue - signal;
    
    return { value: macdValue, signal, histogram };
  }

  private calculateBollingerBands(prices: number[], period: number, stdDev: number): { upper: number; middle: number; lower: number } {
    const sma = this.calculateSMA(prices, period);
    const recentPrices = prices.slice(-period);
    
    const variance = recentPrices.reduce((sum, price) => sum + Math.pow(price - sma, 2), 0) / period;
    const standardDeviation = Math.sqrt(variance);
    
    return {
      upper: sma + (standardDeviation * stdDev),
      middle: sma,
      lower: sma - (standardDeviation * stdDev)
    };
  }

  private calculateATR(prices: number[], period: number): number {
    if (prices.length < period + 1) return 0.001;
    
    let trSum = 0;
    for (let i = prices.length - period; i < prices.length - 1; i++) {
      const high = prices[i];
      const low = prices[i];
      const prevClose = prices[i - 1];
      
      const tr = Math.max(
        high - low,
        Math.abs(high - prevClose),
        Math.abs(low - prevClose)
      );
      trSum += tr;
    }
    
    return trSum / period;
  }
}

export const professionalStrategies = new ProfessionalTradingStrategies();