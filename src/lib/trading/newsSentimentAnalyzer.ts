/**
 * News Sentiment Analyzer - Advanced news sentiment analysis for market direction prediction
 * Integrates with financial news APIs and provides real-time sentiment scoring
 */

export interface NewsArticle {
  title: string;
  description: string;
  content: string;
  url: string;
  publishedAt: Date;
  source: string;
  sentiment: number; // -1 to +1 scale
  impact: 'HIGH' | 'MEDIUM' | 'LOW';
  affectedCurrencies: string[];
  volatility: number; // Expected volatility impact
}

export interface NewsSentimentAnalysis {
  overallSentiment: number; // -1 to +1
  bullishArticles: number;
  bearishArticles: number;
  neutralArticles: number;
  highImpactNews: NewsArticle[];
  upcomingNews: NewsArticle[];
  marketDirection: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  confidence: number; // 0-100
  lastUpdated: Date;
}

export interface NewsImpactPrediction {
  symbol: string;
  expectedVolatility: number;
  directionBias: 'BUY' | 'SELL' | 'NEUTRAL';
  confidence: number;
  timeToImpact: number; // minutes
  newsTitle: string;
}

export interface EconomicEvent {
  id: string;
  timestamp: Date;
  country: string;
  currency: string;
  event: string;
  impact: 'HIGH' | 'MEDIUM' | 'LOW';
  forecast: string;
  previous: string;
  actual?: string;
  volatility: number; // Expected volatility impact
  affectedCurrencies: string[];
}

export interface BlackoutWindow {
  symbol: string;
  startTime: Date;
  endTime: Date;
  reason: string;
  volatilityThreshold: number;
  isActive: boolean;
}

export interface TradingAlgorithm {
  type: 'PRE_NEWS' | 'POST_NEWS';
  symbol: string;
  action: 'BUY' | 'SELL' | 'CLOSE' | 'WAIT';
  confidence: number;
  entryPrice?: number;
  stopLoss?: number;
  takeProfit?: number;
  reasoning: string;
}

class NewsSentimentAnalyzer {
  private newsCache: Map<string, NewsArticle[]> = new Map();
  private sentimentCache: Map<string, NewsSentimentAnalysis> = new Map();
  private lastFetch: Map<string, number> = new Map();
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
  private readonly API_RATE_LIMIT = 60 * 1000; // 1 minute between API calls

  // NewsAPI configuration (would be in env)
  private readonly NEWS_API_KEY = 'demo'; // Using demo mode for browser compatibility
  private readonly NEWS_API_BASE = 'https://newsapi.org/v2';
  
  // Economic Calendar configuration
  private economicEventsCache: Map<string, EconomicEvent[]> = new Map();
  private blackoutWindows: Map<string, BlackoutWindow[]> = new Map();
  private readonly CALENDAR_API_KEY = 'demo';
  private readonly CALENDAR_API_BASE = 'https://api.example.com/economic-calendar'; // Placeholder
  private readonly BLACKOUT_DURATION = 3 * 60 * 1000; // 3 minutes
  private readonly PRE_NEWS_WINDOW = 5 * 60 * 1000; // 5 minutes before news
  private readonly POST_NEWS_WINDOW = 2 * 60 * 1000; // 2 minutes after news
  
  // Fallback news sources for demo
  private readonly FALLBACK_NEWS: NewsArticle[] = [
    {
      title: 'Fed Signals Potential Rate Cuts',
      description: 'Federal Reserve officials hint at monetary policy adjustments',
      content: 'The Federal Reserve has indicated potential interest rate cuts in the coming months...',
      url: 'https://example.com/fed-signals-rate-cuts',
      publishedAt: new Date(Date.now() - 30 * 60 * 1000), // 30 minutes ago
      source: 'Reuters',
      sentiment: 0.3,
      impact: 'HIGH' as const,
      affectedCurrencies: ['USD'],
      volatility: 0.8
    },
    {
      title: 'Eurozone GDP Growth Exceeds Expectations',
      description: 'European economic data shows stronger than anticipated growth',
      content: 'Eurozone GDP grew by 0.5% in Q4, beating analyst expectations...',
      url: 'https://example.com/eurozone-gdp-growth',
      publishedAt: new Date(Date.now() - 45 * 60 * 1000), // 45 minutes ago
      source: 'Bloomberg',
      sentiment: 0.4,
      impact: 'MEDIUM' as const,
      affectedCurrencies: ['EUR'],
      volatility: 0.6
    },
    {
      title: 'Bank of Japan Maintains Ultra-Low Rates',
      description: 'BOJ keeps monetary policy unchanged amid inflation concerns',
      content: 'The Bank of Japan has decided to maintain its ultra-loose monetary policy...',
      url: 'https://example.com/boj-maintains-rates',
      publishedAt: new Date(Date.now() - 60 * 60 * 1000), // 1 hour ago
      source: 'Financial Times',
      sentiment: -0.2,
      impact: 'MEDIUM' as const,
      affectedCurrencies: ['JPY'],
      volatility: 0.5
    }
  ];
  
  // Fallback economic events for demo
  private readonly FALLBACK_ECONOMIC_EVENTS: EconomicEvent[] = [
    {
      id: "1",
      timestamp: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2 hours from now
      country: "United States",
      currency: "USD",
      event: "Core CPI (MoM)",
      impact: "HIGH",
      forecast: "0.3%",
      previous: "0.3%",
      volatility: 0.8,
      affectedCurrencies: ["USD"]
    },
    {
      id: "2",
      timestamp: new Date(Date.now() + 2.25 * 60 * 60 * 1000), // 2h 15m from now
      country: "United States",
      currency: "USD",
      event: "Fed Chair Powell Speech",
      impact: "HIGH",
      forecast: "-",
      previous: "-",
      volatility: 0.9,
      affectedCurrencies: ["USD"]
    },
    {
      id: "3",
      timestamp: new Date(Date.now() + 3 * 60 * 60 * 1000), // 3 hours from now
      country: "Eurozone",
      currency: "EUR",
      event: "Industrial Production",
      impact: "MEDIUM",
      forecast: "0.1%",
      previous: "-0.3%",
      volatility: 0.6,
      affectedCurrencies: ["EUR"]
    },
    {
      id: "4",
      timestamp: new Date(Date.now() + 5 * 60 * 60 * 1000), // 5 hours from now
      country: "United Kingdom",
      currency: "GBP",
      event: "GDP (QoQ)",
      impact: "HIGH",
      forecast: "0.4%",
      previous: "0.2%",
      volatility: 0.7,
      affectedCurrencies: ["GBP"]
    },
    {
      id: "5",
      timestamp: new Date(Date.now() + 6 * 60 * 60 * 1000), // 6 hours from now
      country: "Canada",
      currency: "CAD",
      event: "Employment Change",
      impact: "MEDIUM",
      forecast: "25.0K",
      previous: "47.0K",
      volatility: 0.5,
      affectedCurrencies: ["CAD"]
    },
    {
      id: "6",
      timestamp: new Date(Date.now() + 7 * 60 * 60 * 1000), // 7 hours from now
      country: "Australia",
      currency: "AUD",
      event: "RBA Rate Decision",
      impact: "HIGH",
      forecast: "4.35%",
      previous: "4.35%",
      volatility: 0.8,
      affectedCurrencies: ["AUD"]
    }
  ];

  /**
   * Get comprehensive news sentiment analysis for a symbol
   */
  async getNewsSentiment(symbol: string): Promise<NewsSentimentAnalysis> {
    const cacheKey = symbol;
    const cached = this.sentimentCache.get(cacheKey);
    const lastFetch = this.lastFetch.get(cacheKey) || 0;

    // Return cached data if still fresh
    if (cached && (Date.now() - lastFetch) < this.CACHE_DURATION) {
      return cached;
    }

    try {
      // Fetch latest news
      const news = await this.fetchNewsForSymbol(symbol);
      this.newsCache.set(cacheKey, news);
      this.lastFetch.set(cacheKey, Date.now());

      // Analyze sentiment
      const analysis = this.analyzeSentiment(news, symbol);
      this.sentimentCache.set(cacheKey, analysis);

      return analysis;
    } catch (error) {
      console.error(`Failed to get news sentiment for ${symbol}:`, error);
      // Return fallback analysis
      return this.getFallbackAnalysis(symbol);
    }
  }

  /**
   * Fetch news articles for a specific symbol
   */
  private async fetchNewsForSymbol(symbol: string): Promise<NewsArticle[]> {
    // For demo purposes, use fallback news
    // In production, this would call NewsAPI or similar

    if (this.NEWS_API_KEY === 'demo') {
      console.log(`📊 Using fallback news data for ${symbol}`);
      return this.FALLBACK_NEWS.filter(news =>
        news.affectedCurrencies.some(curr => symbol.includes(curr))
      );
    }

    try {
      // Rate limiting
      const lastCall = this.lastFetch.get('api') || 0;
      if (Date.now() - lastCall < this.API_RATE_LIMIT) {
        throw new Error('Rate limit exceeded');
      }

      // Extract currencies from symbol
      const baseCurrency = symbol.substring(0, 3);
      const quoteCurrency = symbol.substring(3, 6);

      // Build search query
      const query = `${baseCurrency} OR ${quoteCurrency} forex currency`;
      const url = `${this.NEWS_API_BASE}/everything?q=${encodeURIComponent(query)}&apiKey=${this.NEWS_API_KEY}&sortBy=publishedAt&language=en&pageSize=20`;

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`NewsAPI error: ${response.status}`);
      }

      const data = await response.json();
      const articles = data.articles || [];

      // Process and analyze articles
      const processedNews: NewsArticle[] = articles.map((article: any) => ({
        title: article.title || '',
        description: article.description || '',
        content: article.content || article.description || '',
        url: article.url || '',
        publishedAt: new Date(article.publishedAt),
        source: article.source?.name || 'Unknown',
        sentiment: this.analyzeArticleSentiment(article.title + ' ' + (article.description || '')),
        impact: this.determineImpact(article.title, article.description),
        affectedCurrencies: this.extractCurrencies(article.title + ' ' + (article.description || ''), [baseCurrency, quoteCurrency]),
        volatility: this.estimateVolatility(article.title, article.description)
      }));

      this.lastFetch.set('api', Date.now());
      return processedNews;

    } catch (error) {
      console.error('News API fetch failed:', error);
      return this.FALLBACK_NEWS.filter(news =>
        news.affectedCurrencies.some(curr => symbol.includes(curr))
      );
    }
  }

  /**
   * Analyze sentiment of news articles
   */
  private analyzeSentiment(news: NewsArticle[], symbol: string): NewsSentimentAnalysis {
    if (news.length === 0) {
      return {
        overallSentiment: 0,
        bullishArticles: 0,
        bearishArticles: 0,
        neutralArticles: 0,
        highImpactNews: [],
        upcomingNews: [],
        marketDirection: 'NEUTRAL',
        confidence: 0,
        lastUpdated: new Date()
      };
    }

    // Calculate sentiment metrics
    const sentiments = news.map(n => n.sentiment);
    const overallSentiment = sentiments.reduce((sum, s) => sum + s, 0) / sentiments.length;

    const bullishArticles = news.filter(n => n.sentiment > 0.1).length;
    const bearishArticles = news.filter(n => n.sentiment < -0.1).length;
    const neutralArticles = news.length - bullishArticles - bearishArticles;

    const highImpactNews = news.filter(n => n.impact === 'HIGH');
    const upcomingNews = news.filter(n => {
      const timeDiff = Date.now() - n.publishedAt.getTime();
      return timeDiff < 2 * 60 * 60 * 1000; // Within last 2 hours
    });

    // Determine market direction
    let marketDirection: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';
    if (overallSentiment > 0.15) marketDirection = 'BULLISH';
    else if (overallSentiment < -0.15) marketDirection = 'BEARISH';

    // Calculate confidence based on consensus and recency
    const recentNews = news.filter(n => {
      const hoursOld = (Date.now() - n.publishedAt.getTime()) / (1000 * 60 * 60);
      return hoursOld < 4; // Within last 4 hours
    });

    const sentimentVariance = this.calculateVariance(sentiments);
    const recencyWeight = recentNews.length / Math.max(news.length, 1);
    const consensusStrength = 1 - sentimentVariance; // Lower variance = higher consensus

    const confidence = Math.min(100, (consensusStrength * 60) + (recencyWeight * 40));

    return {
      overallSentiment,
      bullishArticles,
      bearishArticles,
      neutralArticles,
      highImpactNews,
      upcomingNews,
      marketDirection,
      confidence,
      lastUpdated: new Date()
    };
  }

  /**
   * Analyze sentiment of individual article text
   */
  private analyzeArticleSentiment(text: string): number {
    if (!text) return 0;

    const lowerText = text.toLowerCase();

    // Positive keywords
    const positiveWords = [
      'rise', 'increase', 'grow', 'boost', 'surge', 'jump', 'gain', 'strong', 'positive',
      'bullish', 'optimistic', 'recovery', 'improvement', 'beat', 'exceed', 'higher',
      'up', 'rally', 'climb', 'advance', 'growth', 'expansion', 'favorable'
    ];

    // Negative keywords
    const negativeWords = [
      'fall', 'decline', 'drop', 'decrease', 'slump', 'plunge', 'crash', 'weak', 'negative',
      'bearish', 'pessimistic', 'recession', 'contraction', 'worse', 'lower', 'down',
      'tumble', 'slide', 'retreat', 'setback', 'crisis', 'slowdown', 'miss'
    ];

    let positiveScore = 0;
    let negativeScore = 0;

    positiveWords.forEach(word => {
      const count = (lowerText.match(new RegExp(word, 'g')) || []).length;
      positiveScore += count;
    });

    negativeWords.forEach(word => {
      const count = (lowerText.match(new RegExp(word, 'g')) || []).length;
      negativeScore += count;
    });

    const totalWords = positiveScore + negativeScore;
    if (totalWords === 0) return 0;

    // Normalize to -1 to +1 scale
    const rawSentiment = (positiveScore - negativeScore) / totalWords;
    return Math.max(-1, Math.min(1, rawSentiment));
  }

  /**
   * Determine impact level of news
   */
  private determineImpact(title: string, description: string): 'HIGH' | 'MEDIUM' | 'LOW' {
    const text = (title + ' ' + description).toLowerCase();

    const highImpactKeywords = [
      'fed', 'federal reserve', 'ecb', 'european central bank', 'boj', 'bank of japan',
      'interest rate', 'monetary policy', 'gdp', 'employment', 'inflation', 'cpi', 'ppi',
      'fomc', 'press conference', 'central bank', 'rate decision', 'quantitative easing',
      'unemployment', 'jobs report', 'nfp', 'non-farm payrolls'
    ];

    const mediumImpactKeywords = [
      'economic data', 'trade', 'election', 'geopolitical', 'sanctions', 'oil',
      'commodity', 'bond', 'yield', 'currency intervention', 'trade war', 'tariff',
      'brexit', 'referendum', 'political', 'government', 'parliament', 'congress'
    ];

    // Count keyword matches for more sophisticated scoring
    const highMatches = highImpactKeywords.filter(keyword => text.includes(keyword)).length;
    const mediumMatches = mediumImpactKeywords.filter(keyword => text.includes(keyword)).length;

    // If multiple high-impact keywords or specific critical terms
    if (highMatches >= 2 || text.includes('press conference') || text.includes('rate decision')) {
      return 'HIGH';
    }

    if (highMatches >= 1 || mediumMatches >= 2) {
      return 'MEDIUM';
    }

    if (mediumMatches >= 1) {
      return 'MEDIUM';
    }

    return 'LOW';
  }

  /**
   * Extract affected currencies from text
   */
  private extractCurrencies(text: string, defaultCurrencies: string[]): string[] {
    const currencies = ['USD', 'EUR', 'GBP', 'JPY', 'CHF', 'CAD', 'AUD', 'NZD', 'XAU'];
    const foundCurrencies: string[] = [];

    currencies.forEach(currency => {
      if (text.toUpperCase().includes(currency)) {
        foundCurrencies.push(currency);
      }
    });

    return foundCurrencies.length > 0 ? foundCurrencies : defaultCurrencies;
  }

  /**
   * Estimate volatility impact
   */
  private estimateVolatility(title: string, description: string): number {
    const text = (title + ' ' + description).toLowerCase();

    let volatility = 0.2; // Base volatility

    // High impact events
    if (text.includes('fed') || text.includes('federal reserve')) volatility += 0.5;
    if (text.includes('ecb') || text.includes('european central bank')) volatility += 0.5;
    if (text.includes('boj') || text.includes('bank of japan')) volatility += 0.4;
    if (text.includes('interest rate') || text.includes('rate decision')) volatility += 0.4;
    if (text.includes('monetary policy') || text.includes('press conference')) volatility += 0.4;

    // Economic indicators
    if (text.includes('gdp') || text.includes('employment') || text.includes('nfp')) volatility += 0.3;
    if (text.includes('inflation') || text.includes('cpi') || text.includes('ppi')) volatility += 0.3;
    if (text.includes('unemployment')) volatility += 0.2;

    // Geopolitical and market events
    if (text.includes('crisis') || text.includes('shock') || text.includes('crash')) volatility += 0.4;
    if (text.includes('election') || text.includes('political')) volatility += 0.3;
    if (text.includes('geopolitical') || text.includes('sanctions') || text.includes('trade war')) volatility += 0.3;
    if (text.includes('oil') || text.includes('commodity')) volatility += 0.2;

    // Sentiment-based adjustments
    if (text.includes('surprise') || text.includes('unexpected') || text.includes('beat')) volatility += 0.1;
    if (text.includes('miss') || text.includes('disappoint')) volatility += 0.1;

    return Math.min(1.0, Math.max(0.1, volatility));
  }

  /**
   * Calculate variance of sentiment scores
   */
  private calculateVariance(values: number[]): number {
    if (values.length === 0) return 0;

    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
    return squaredDiffs.reduce((sum, sq) => sum + sq, 0) / values.length;
  }

  /**
   * Get fallback analysis when API fails
   */
  private getFallbackAnalysis(symbol: string): NewsSentimentAnalysis {
    return {
      overallSentiment: 0,
      bullishArticles: 1,
      bearishArticles: 1,
      neutralArticles: 1,
      highImpactNews: [],
      upcomingNews: [],
      marketDirection: 'NEUTRAL',
      confidence: 30,
      lastUpdated: new Date()
    };
  }

  /**
   * Predict news impact on specific symbol
   */
  async predictNewsImpact(symbol: string): Promise<NewsImpactPrediction> {
    const sentiment = await this.getNewsSentiment(symbol);
    const news = this.newsCache.get(symbol) || [];

    // Find most relevant recent news
    const relevantNews = news
      .filter(n => n.affectedCurrencies.some(curr => symbol.includes(curr)))
      .sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime())
      .slice(0, 3);

    if (relevantNews.length === 0) {
      return {
        symbol,
        expectedVolatility: 0.2,
        directionBias: 'NEUTRAL',
        confidence: 20,
        timeToImpact: 0,
        newsTitle: 'No recent news'
      };
    }

    const avgSentiment = relevantNews.reduce((sum, n) => sum + n.sentiment, 0) / relevantNews.length;
    const avgVolatility = relevantNews.reduce((sum, n) => sum + n.volatility, 0) / relevantNews.length;
    const mostRecent = relevantNews[0];

    let directionBias: 'BUY' | 'SELL' | 'NEUTRAL' = 'NEUTRAL';
    if (avgSentiment > 0.1) directionBias = 'BUY';
    else if (avgSentiment < -0.1) directionBias = 'SELL';

    const timeToImpact = Math.max(0, (Date.now() - mostRecent.publishedAt.getTime()) / (1000 * 60));

    return {
      symbol,
      expectedVolatility: avgVolatility,
      directionBias,
      confidence: sentiment.confidence,
      timeToImpact,
      newsTitle: mostRecent.title
    };
  }

  /**
   * Get news-driven entry filter score
   */
  async getNewsEntryFilter(symbol: string): Promise<number> {
    const sentiment = await this.getNewsSentiment(symbol);

    // Base score from sentiment
    let filterScore = 50; // Neutral

    if (sentiment.marketDirection === 'BULLISH') {
      filterScore += sentiment.confidence * 0.3;
    } else if (sentiment.marketDirection === 'BEARISH') {
      filterScore -= sentiment.confidence * 0.3;
    }

    // Adjust for high impact news
    if (sentiment.highImpactNews.length > 0) {
      const recentHighImpact = sentiment.highImpactNews.filter(news => {
        const hoursOld = (Date.now() - news.publishedAt.getTime()) / (1000 * 60 * 60);
        return hoursOld < 2;
      });

      if (recentHighImpact.length > 0) {
        filterScore = Math.max(10, filterScore - 20); // Reduce confidence near high impact news
      }
    }

    return Math.max(0, Math.min(100, filterScore));
  }

  /**
   * Fetch economic calendar events
   */
  private async fetchEconomicEvents(): Promise<EconomicEvent[]> {
    if (this.CALENDAR_API_KEY === 'demo') {
      console.log(`📅 Using fallback economic calendar data`);
      return this.FALLBACK_ECONOMIC_EVENTS;
    }

    try {
      // Rate limiting
      const lastCall = this.lastFetch.get('calendar') || 0;
      if (Date.now() - lastCall < this.API_RATE_LIMIT) {
        throw new Error('Rate limit exceeded');
      }

      // In production, this would call a real economic calendar API
      // For now, return fallback data
      this.lastFetch.set('calendar', Date.now());
      return this.FALLBACK_ECONOMIC_EVENTS;

    } catch (error) {
      console.error('Economic calendar fetch failed:', error);
      return this.FALLBACK_ECONOMIC_EVENTS;
    }
  }

  /**
   * Get upcoming economic events for a symbol
   */
  async getUpcomingEvents(symbol: string): Promise<EconomicEvent[]> {
    const cacheKey = 'economic_events';
    const cached = this.economicEventsCache.get(cacheKey);
    const lastFetch = this.lastFetch.get('calendar') || 0;

    // Return cached data if still fresh
    if (cached && (Date.now() - lastFetch) < this.CACHE_DURATION) {
      return cached.filter(event =>
        event.affectedCurrencies.some(curr => symbol.includes(curr))
      );
    }

    try {
      const events = await this.fetchEconomicEvents();
      this.economicEventsCache.set(cacheKey, events);
      this.lastFetch.set('calendar', Date.now());

      return events.filter(event =>
        event.affectedCurrencies.some(curr => symbol.includes(curr))
      );
    } catch (error) {
      console.error(`Failed to get economic events for ${symbol}:`, error);
      return this.FALLBACK_ECONOMIC_EVENTS.filter(event =>
        event.affectedCurrencies.some(curr => symbol.includes(curr))
      );
    }
  }

  /**
   * Check if symbol is in a blackout window
   */
  async isInBlackoutWindow(symbol: string): Promise<boolean> {
    const upcomingEvents = await this.getUpcomingEvents(symbol);
    const now = Date.now();

    // Check for events in the next 30 minutes
    const imminentEvents = upcomingEvents.filter(event => {
      const timeDiff = event.timestamp.getTime() - now;
      return timeDiff > 0 && timeDiff < 30 * 60 * 1000; // Within 30 minutes
    });

    if (imminentEvents.length > 0) {
      // Check if we're within blackout period
      for (const event of imminentEvents) {
        const eventTime = event.timestamp.getTime();
        const blackoutStart = eventTime - this.PRE_NEWS_WINDOW;
        const blackoutEnd = eventTime + this.POST_NEWS_WINDOW;

        if (now >= blackoutStart && now <= blackoutEnd) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Check if current volatility allows trading
   */
  async shouldAllowTrading(symbol: string, currentVolatility: number): Promise<boolean> {
    const upcomingEvents = await this.getUpcomingEvents(symbol);
    const now = Date.now();

    // Check for imminent high-impact events
    const imminentHighImpact = upcomingEvents.filter(event => {
      const timeDiff = event.timestamp.getTime() - now;
      return event.impact === 'HIGH' && timeDiff > 0 && timeDiff < 15 * 60 * 1000; // Within 15 minutes
    });

    if (imminentHighImpact.length > 0) {
      // Apply stricter volatility filter near news
      const volatilityThreshold = 0.02; // 2% threshold
      return currentVolatility < volatilityThreshold;
    }

    // Normal volatility filter
    const normalThreshold = 0.05; // 5% threshold
    return currentVolatility < normalThreshold;
  }

  /**
   * Get pre-news trading algorithm recommendation
   */
  async getPreNewsAlgorithm(symbol: string): Promise<TradingAlgorithm | null> {
    const upcomingEvents = await this.getUpcomingEvents(symbol);
    const now = Date.now();

    // Find the next high-impact event within 30 minutes
    const nextEvent = upcomingEvents
      .filter(event => event.impact === 'HIGH')
      .find(event => {
        const timeDiff = event.timestamp.getTime() - now;
        return timeDiff > 0 && timeDiff < 30 * 60 * 1000;
      });

    if (!nextEvent) return null;

    const timeToEvent = (nextEvent.timestamp.getTime() - now) / (1000 * 60); // minutes

    // If more than 5 minutes away, consider positioning
    if (timeToEvent > 5) {
      // Get sentiment analysis
      const sentiment = await this.getNewsSentiment(symbol);

      if (sentiment.marketDirection === 'BULLISH' && sentiment.confidence > 60) {
        return {
          type: 'PRE_NEWS',
          symbol,
          action: 'BUY',
          confidence: sentiment.confidence * 0.8,
          reasoning: `Bullish sentiment (${sentiment.confidence}%) before ${nextEvent.event}`
        };
      } else if (sentiment.marketDirection === 'BEARISH' && sentiment.confidence > 60) {
        return {
          type: 'PRE_NEWS',
          symbol,
          action: 'SELL',
          confidence: sentiment.confidence * 0.8,
          reasoning: `Bearish sentiment (${sentiment.confidence}%) before ${nextEvent.event}`
        };
      }
    }

    // If within 5 minutes, close positions
    if (timeToEvent <= 5) {
      return {
        type: 'PRE_NEWS',
        symbol,
        action: 'CLOSE',
        confidence: 90,
        reasoning: `Closing positions ${timeToEvent.toFixed(1)} minutes before ${nextEvent.event}`
      };
    }

    return {
      type: 'PRE_NEWS',
      symbol,
      action: 'WAIT',
      confidence: 50,
      reasoning: `Waiting for ${nextEvent.event} in ${timeToEvent.toFixed(1)} minutes`
    };
  }

  /**
   * Get post-news trading algorithm recommendation
   */
  async getPostNewsAlgorithm(symbol: string): Promise<TradingAlgorithm | null> {
    const upcomingEvents = await this.getUpcomingEvents(symbol);
    const now = Date.now();

    // Find recent high-impact events (within last 10 minutes)
    const recentEvents = upcomingEvents
      .filter(event => event.impact === 'HIGH')
      .filter(event => {
        const timeDiff = now - event.timestamp.getTime();
        return timeDiff > 0 && timeDiff < 10 * 60 * 1000; // Within last 10 minutes
      });

    if (recentEvents.length === 0) return null;

    const mostRecentEvent = recentEvents[0];
    const timeSinceEvent = (now - mostRecentEvent.timestamp.getTime()) / (1000 * 60); // minutes

    // If just after news (within 2 minutes), wait for volatility to settle
    if (timeSinceEvent <= 2) {
      return {
        type: 'POST_NEWS',
        symbol,
        action: 'WAIT',
        confidence: 80,
        reasoning: `Waiting for volatility to settle after ${mostRecentEvent.event}`
      };
    }

    // After 2 minutes, analyze the move and potentially enter
    if (timeSinceEvent > 2 && timeSinceEvent <= 5) {
      // Get current sentiment
      const sentiment = await this.getNewsSentiment(symbol);

      if (sentiment.marketDirection === 'BULLISH' && sentiment.confidence > 70) {
        return {
          type: 'POST_NEWS',
          symbol,
          action: 'BUY',
          confidence: sentiment.confidence * 0.9,
          reasoning: `Entering long position following ${mostRecentEvent.event} with bullish confirmation`
        };
      } else if (sentiment.marketDirection === 'BEARISH' && sentiment.confidence > 70) {
        return {
          type: 'POST_NEWS',
          symbol,
          action: 'SELL',
          confidence: sentiment.confidence * 0.9,
          reasoning: `Entering short position following ${mostRecentEvent.event} with bearish confirmation`
        };
      }
    }

    return null;
  }
}

export const newsSentimentAnalyzer = new NewsSentimentAnalyzer();