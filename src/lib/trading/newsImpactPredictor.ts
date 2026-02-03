/**
 * News Impact Predictor - Models news impact on market volatility and direction
 * Uses historical patterns to predict how news events affect price movements
 */

import { CandleData } from './smartMoneyAnalyzer';
import { NewsArticle, newsSentimentAnalyzer } from './newsSentimentAnalyzer';

export interface HistoricalNewsEvent {
  timestamp: Date;
  title: string;
  impact: 'HIGH' | 'MEDIUM' | 'LOW';
  currency: string;
  preNewsVolatility: number;
  postNewsVolatility: number;
  priceChange: number; // Percentage change in first 15 minutes
  direction: 'UP' | 'DOWN' | 'SIDEWAYS';
  recoveryTime: number; // Minutes to return to pre-news levels
}

export interface NewsImpactModel {
  currency: string;
  averageVolatilityIncrease: number;
  averagePriceMove: number;
  averageRecoveryTime: number;
  directionalAccuracy: number; // How often sentiment predicts direction
  confidence: number;
  lastUpdated: Date;
}

export interface ImpactPrediction {
  symbol: string;
  expectedVolatility: number;
  expectedMove: number; // Expected price move in pips
  directionProbability: {
    up: number;
    down: number;
    sideways: number;
  };
  recoveryTime: number;
  riskMultiplier: number; // Multiplier for position sizing
  confidence: number;
}

class NewsImpactPredictor {
  private historicalData: Map<string, HistoricalNewsEvent[]> = new Map();
  private impactModels: Map<string, NewsImpactModel> = new Map();
  private volatilityHistory: Map<string, number[]> = new Map();

  // Historical data would be loaded from database in production
  private readonly SAMPLE_HISTORICAL_DATA: HistoricalNewsEvent[] = [
    {
      timestamp: new Date('2024-01-15T14:30:00Z'),
      title: 'Fed Interest Rate Decision',
      impact: 'HIGH',
      currency: 'USD',
      preNewsVolatility: 0.08,
      postNewsVolatility: 0.25,
      priceChange: 0.15,
      direction: 'DOWN',
      recoveryTime: 45
    },
    {
      timestamp: new Date('2024-01-10T10:00:00Z'),
      title: 'ECB Press Conference',
      impact: 'HIGH',
      currency: 'EUR',
      preNewsVolatility: 0.06,
      postNewsVolatility: 0.18,
      priceChange: 0.08,
      direction: 'UP',
      recoveryTime: 30
    },
    {
      timestamp: new Date('2024-01-05T08:30:00Z'),
      title: 'NFP Employment Data',
      impact: 'HIGH',
      currency: 'USD',
      preNewsVolatility: 0.05,
      postNewsVolatility: 0.22,
      priceChange: -0.12,
      direction: 'DOWN',
      recoveryTime: 60
    },
    {
      timestamp: new Date('2024-01-20T02:00:00Z'),
      title: 'BOJ Monetary Policy',
      impact: 'MEDIUM',
      currency: 'JPY',
      preNewsVolatility: 0.04,
      postNewsVolatility: 0.12,
      priceChange: 0.06,
      direction: 'UP',
      recoveryTime: 25
    }
  ];

  constructor() {
    this.initializeHistoricalData();
    this.buildImpactModels();
  }

  /**
   * Initialize historical news impact data
   */
  private initializeHistoricalData(): void {
    // Group by currency
    const currencies = ['USD', 'EUR', 'GBP', 'JPY', 'CHF', 'CAD', 'AUD', 'NZD'];

    currencies.forEach(currency => {
      const currencyEvents = this.SAMPLE_HISTORICAL_DATA.filter(
        event => event.currency === currency
      );
      this.historicalData.set(currency, currencyEvents);
    });
  }

  /**
   * Build impact models from historical data
   */
  private buildImpactModels(): void {
    this.historicalData.forEach((events, currency) => {
      if (events.length === 0) return;

      const highImpactEvents = events.filter(e => e.impact === 'HIGH');
      const allEvents = events;

      // Calculate averages
      const avgVolatilityIncrease = allEvents.reduce(
        (sum, e) => sum + (e.postNewsVolatility - e.preNewsVolatility), 0
      ) / allEvents.length;

      const avgPriceMove = Math.abs(allEvents.reduce(
        (sum, e) => sum + e.priceChange, 0
      ) / allEvents.length);

      const avgRecoveryTime = allEvents.reduce(
        (sum, e) => sum + e.recoveryTime, 0
      ) / allEvents.length;

      // Calculate directional accuracy (how often sentiment matches actual move)
      // For demo, assume 65% accuracy
      const directionalAccuracy = 0.65;

      const confidence = Math.min(100, (allEvents.length / 10) * 100); // More data = higher confidence

      const model: NewsImpactModel = {
        currency,
        averageVolatilityIncrease: Math.max(0, avgVolatilityIncrease),
        averagePriceMove: avgPriceMove,
        averageRecoveryTime: avgRecoveryTime,
        directionalAccuracy,
        confidence,
        lastUpdated: new Date()
      };

      this.impactModels.set(currency, model);
    });
  }

  /**
   * Predict impact of upcoming news on a symbol
   */
  async predictNewsImpact(symbol: string, newsArticle?: NewsArticle): Promise<ImpactPrediction> {
    const baseCurrency = symbol.substring(0, 3);
    const quoteCurrency = symbol.substring(3, 6);

    // Get news sentiment if not provided
    if (!newsArticle) {
      const sentiment = await newsSentimentAnalyzer.getNewsSentiment(symbol);
      newsArticle = sentiment.upcomingNews[0]; // Use most recent upcoming news
    }

    // Get impact model for the currencies
    const baseModel = this.impactModels.get(baseCurrency);
    const quoteModel = this.impactModels.get(quoteCurrency);

    // Use the model with higher confidence, or base if tie
    const model = (baseModel && quoteModel) ?
      (baseModel.confidence >= quoteModel.confidence ? baseModel : quoteModel) :
      (baseModel || quoteModel);

    if (!model) {
      // Fallback prediction
      return {
        symbol,
        expectedVolatility: 0.1,
        expectedMove: 10, // 10 pips
        directionProbability: { up: 0.33, down: 0.33, sideways: 0.34 },
        recoveryTime: 30,
        riskMultiplier: 1.0,
        confidence: 20
      };
    }

    // Adjust prediction based on news impact level
    let impactMultiplier = 1.0;
    if (newsArticle) {
      switch (newsArticle.impact) {
        case 'HIGH': impactMultiplier = 1.5; break;
        case 'MEDIUM': impactMultiplier = 1.2; break;
        case 'LOW': impactMultiplier = 0.8; break;
      }
    }

    const expectedVolatility = model.averageVolatilityIncrease * impactMultiplier;
    const expectedMove = model.averagePriceMove * impactMultiplier * 100; // Convert to pips

    // Calculate direction probabilities based on sentiment
    let directionProbability = { up: 0.33, down: 0.33, sideways: 0.34 };

    if (newsArticle) {
      const sentiment = newsArticle.sentiment;
      if (sentiment > 0.1) {
        directionProbability = {
          up: 0.5 + (sentiment * model.directionalAccuracy),
          down: 0.25 - (sentiment * model.directionalAccuracy * 0.5),
          sideways: 0.25
        };
      } else if (sentiment < -0.1) {
        directionProbability = {
          up: 0.25 - (Math.abs(sentiment) * model.directionalAccuracy * 0.5),
          down: 0.5 + (Math.abs(sentiment) * model.directionalAccuracy),
          sideways: 0.25
        };
      }
    }

    // Normalize probabilities
    const total = directionProbability.up + directionProbability.down + directionProbability.sideways;
    directionProbability.up /= total;
    directionProbability.down /= total;
    directionProbability.sideways /= total;

    // Calculate risk multiplier (reduce position size during high volatility)
    const riskMultiplier = Math.max(0.3, 1.0 - (expectedVolatility * 2));

    const confidence = Math.min(model.confidence, newsArticle ? 80 : 60);

    return {
      symbol,
      expectedVolatility,
      expectedMove,
      directionProbability,
      recoveryTime: model.averageRecoveryTime * impactMultiplier,
      riskMultiplier,
      confidence
    };
  }

  /**
   * Analyze recent volatility patterns for a symbol
   */
  analyzeVolatilityPatterns(symbol: string, candles: CandleData[]): void {
    if (candles.length < 20) return;

    // Calculate recent volatility (standard deviation of returns)
    const returns: number[] = [];
    for (let i = 1; i < candles.length; i++) {
      const return_pct = (candles[i].close - candles[i-1].close) / candles[i-1].close;
      returns.push(return_pct);
    }

    const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
    const volatility = Math.sqrt(variance);

    // Store recent volatility history
    const history = this.volatilityHistory.get(symbol) || [];
    history.push(volatility);
    if (history.length > 50) history.shift(); // Keep last 50 readings
    this.volatilityHistory.set(symbol, history);
  }

  /**
   * Get current volatility baseline for a symbol
   */
  getVolatilityBaseline(symbol: string): number {
    const history = this.volatilityHistory.get(symbol);
    if (!history || history.length === 0) return 0.05; // Default 5% daily volatility

    return history.reduce((sum, v) => sum + v, 0) / history.length;
  }

  /**
   * Check if current market conditions suggest news-driven volatility
   */
  isNewsVolatilityPeriod(symbol: string): boolean {
    const baseline = this.getVolatilityBaseline(symbol);
    const history = this.volatilityHistory.get(symbol) || [];

    if (history.length < 5) return false;

    const recent = history.slice(-5);
    const recentAvg = recent.reduce((sum, v) => sum + v, 0) / recent.length;

    // If recent volatility is 50% higher than baseline, might be news-driven
    return recentAvg > baseline * 1.5;
  }

  /**
   * Get pre-news positioning recommendation
   */
  async getPreNewsPositioning(symbol: string): Promise<{
    recommendedAction: 'ENTER_LONG' | 'ENTER_SHORT' | 'CLOSE_POSITIONS' | 'WAIT';
    confidence: number;
    reasoning: string;
  }> {
    const prediction = await this.predictNewsImpact(symbol);

    if (prediction.confidence < 30) {
      return {
        recommendedAction: 'WAIT',
        confidence: prediction.confidence,
        reasoning: 'Insufficient data for reliable prediction'
      };
    }

    if (prediction.expectedVolatility > 0.15) {
      return {
        recommendedAction: 'CLOSE_POSITIONS',
        confidence: prediction.confidence,
        reasoning: `High volatility expected (${(prediction.expectedVolatility * 100).toFixed(1)}% increase)`
      };
    }

    const { up, down } = prediction.directionProbability;
    if (up > 0.6) {
      return {
        recommendedAction: 'ENTER_LONG',
        confidence: prediction.confidence * up,
        reasoning: `${(up * 100).toFixed(0)}% probability of upward move`
      };
    } else if (down > 0.6) {
      return {
        recommendedAction: 'ENTER_SHORT',
        confidence: prediction.confidence * down,
        reasoning: `${(down * 100).toFixed(0)}% probability of downward move`
      };
    }

    return {
      recommendedAction: 'WAIT',
      confidence: prediction.confidence * 0.5,
      reasoning: 'Direction probabilities too close to call'
    };
  }

  /**
   * Update model with new news event outcome
   */
  updateModelWithOutcome(symbol: string, newsEvent: NewsArticle, actualOutcome: {
    volatilityIncrease: number;
    priceMove: number;
    direction: 'UP' | 'DOWN' | 'SIDEWAYS';
    recoveryTime: number;
  }): void {
    const currency = symbol.substring(0, 3); // Use base currency
    const events = this.historicalData.get(currency) || [];

    const newEvent: HistoricalNewsEvent = {
      timestamp: new Date(),
      title: newsEvent.title,
      impact: newsEvent.impact,
      currency,
      preNewsVolatility: this.getVolatilityBaseline(symbol),
      postNewsVolatility: actualOutcome.volatilityIncrease,
      priceChange: actualOutcome.priceMove,
      direction: actualOutcome.direction,
      recoveryTime: actualOutcome.recoveryTime
    };

    events.push(newEvent);
    if (events.length > 100) events.shift(); // Keep last 100 events

    this.historicalData.set(currency, events);
    this.buildImpactModels(); // Rebuild models with new data
  }
}

export const newsImpactPredictor = new NewsImpactPredictor();