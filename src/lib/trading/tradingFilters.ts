/**
 * Trading Filters - ChartLord AI Style
 * Session Killzones + News Blackout Filter
 * Only trade during optimal conditions
 */

import { supabase } from '@/integrations/supabase/client';
import { newsSentimentAnalyzer } from './newsSentimentAnalyzer';

// ============= SESSION KILLZONES =============
// These are the optimal trading windows with highest liquidity and best SMC setups

export interface Killzone {
  name: string;
  startHour: number; // UTC hour
  startMinute: number;
  endHour: number;
  endMinute: number;
  description: string;
  bestPairs: string[];
  volatility: 'HIGH' | 'MEDIUM' | 'LOW';
}

// ChartLord-style killzones - specific time windows for optimal trading
const KILLZONES: Killzone[] = [
  {
    name: 'London Open',
    startHour: 7,  // 7:00 UTC = 2:00 AM EST
    startMinute: 0,
    endHour: 10,   // 10:00 UTC = 5:00 AM EST
    endMinute: 0,
    description: 'London session open - High liquidity, institutions active',
    bestPairs: ['EURUSD', 'GBPUSD', 'EURGBP', 'USDCHF'],
    volatility: 'HIGH'
  },
  {
    name: 'New York Open',
    startHour: 12, // 12:00 UTC = 7:00 AM EST
    startMinute: 0,
    endHour: 15,   // 15:00 UTC = 10:00 AM EST
    endMinute: 0,
    description: 'New York session open - Major news releases, high volume',
    bestPairs: ['EURUSD', 'GBPUSD', 'USDJPY', 'USDCAD', 'XAUUSD'],
    volatility: 'HIGH'
  },
  {
    name: 'London/NY Overlap',
    startHour: 12, // 12:00 UTC = 7:00 AM EST
    startMinute: 0,
    endHour: 16,   // 16:00 UTC = 11:00 AM EST (London closes at 16:00)
    endMinute: 0,
    description: 'Highest volatility period - Best SMC setups form here',
    bestPairs: ['EURUSD', 'GBPUSD', 'USDJPY', 'XAUUSD'],
    volatility: 'HIGH'
  },
  {
    name: 'Tokyo Open',
    startHour: 0,  // 00:00 UTC = 9:00 AM JST
    startMinute: 0,
    endHour: 3,    // 03:00 UTC = 12:00 PM JST
    endMinute: 0,
    description: 'Asian session - Good for JPY pairs',
    bestPairs: ['USDJPY', 'EURJPY', 'GBPJPY', 'AUDJPY'],
    volatility: 'MEDIUM'
  }
];

// ============= NEWS BLACKOUT =============

export interface UpcomingNews {
  id: string;
  title: string;
  currency: string;
  impact: 'HIGH' | 'MEDIUM' | 'LOW';
  eventTime: Date;
  affectedPairs: string[];
}

export interface TradingFilterResult {
  canTrade: boolean;
  inKillzone: boolean;
  activeKillzone: Killzone | null;
  newsBlackout: boolean;
  upcomingNews: UpcomingNews | null;
  newsSentimentFilter: boolean;
  sentimentScore: number;
  reason: string;
  bestPairsNow: string[];
}

class TradingFilters {
  private newsBlackoutMinutes = 15; // 15-minute blackout before/after high-impact news
  private lowImpactBlackoutMinutes = 5; // 5-minute blackout for low impact news
  private cachedNews: UpcomingNews[] = [];
  private lastNewsFetch = 0;
  private newsFetchInterval = 60000; // 1-minute news refresh interval

  // 24/7 TRADING ENABLED - All filters disabled for continuous trading
  private killzoneEnabled = false; // Disable session killzones for 24/7 trading
  private newsBlackoutEnabled = false; // Disable news blackout for 24/7 trading

  /**
   * Main filter check - should we trade right now?
   */
  async canTradeNow(symbol: string): Promise<TradingFilterResult> {
    const now = new Date();

    // Check killzone
    const killzoneResult = this.checkKillzone(now, symbol);

    // Check news blackout
    const newsResult = await this.checkNewsBlackout(now, symbol);

    // Check news sentiment filter
    const sentimentResult = await this.checkNewsSentimentFilter(symbol);

    // Combine results
    const canTrade = (
      (!this.killzoneEnabled || killzoneResult.inKillzone) &&
      (!this.newsBlackoutEnabled || !newsResult.inBlackout) &&
      sentimentResult.canTrade
    );

    console.log(`🔍 Trading Filters: killzoneEnabled=${this.killzoneEnabled}, inKillzone=${killzoneResult.inKillzone}, newsBlackout=${newsResult.inBlackout}, sentimentFilter=${!sentimentResult.canTrade}, canTrade=${canTrade}`);

    let reason = '';
    if (!canTrade) {
      if (this.killzoneEnabled && !killzoneResult.inKillzone) {
        reason = `Outside killzone - next: ${killzoneResult.nextKillzone || 'Unknown'}`;
      }
      if (this.newsBlackoutEnabled && newsResult.inBlackout) {
        reason = `News blackout: ${newsResult.upcomingNews?.title} in ${this.getTimeUntil(newsResult.upcomingNews?.eventTime)}`;
      }
      if (!sentimentResult.canTrade) {
        reason = sentimentResult.reason;
      }
    } else {
      if (killzoneResult.inKillzone) {
        reason = `✅ In ${killzoneResult.activeKillzone?.name} killzone`;
      }
    }

    return {
      canTrade,
      inKillzone: killzoneResult.inKillzone,
      activeKillzone: killzoneResult.activeKillzone,
      newsBlackout: newsResult.inBlackout,
      upcomingNews: newsResult.upcomingNews,
      newsSentimentFilter: !sentimentResult.canTrade,
      sentimentScore: sentimentResult.sentimentScore,
      reason,
      bestPairsNow: killzoneResult.activeKillzone?.bestPairs || []
    };
  }

  /**
   * Check if we're in an optimal trading killzone
   */
  private checkKillzone(now: Date, symbol: string): {
    inKillzone: boolean;
    activeKillzone: Killzone | null;
    nextKillzone: string | null;
  } {
    const utcHour = now.getUTCHours();
    const utcMinute = now.getUTCMinutes();
    const currentTimeMinutes = utcHour * 60 + utcMinute;

    // Check if we're in any killzone
    for (const kz of KILLZONES) {
      const kzStart = kz.startHour * 60 + kz.startMinute;
      const kzEnd = kz.endHour * 60 + kz.endMinute;

      // Handle overnight killzones
      let inKillzone = false;
      if (kzStart <= kzEnd) {
        inKillzone = currentTimeMinutes >= kzStart && currentTimeMinutes < kzEnd;
      } else {
        inKillzone = currentTimeMinutes >= kzStart || currentTimeMinutes < kzEnd;
      }

      if (inKillzone) {
        // Check if this symbol is good for this killzone
        const isPairOptimal = kz.bestPairs.some(pair => 
          symbol.includes(pair.substring(0, 3)) || symbol.includes(pair.substring(3, 6))
        );
        
        console.log(`⏰ In ${kz.name} killzone (${kz.startHour}:00-${kz.endHour}:00 UTC)`, {
          symbol,
          isPairOptimal,
          bestPairs: kz.bestPairs
        });

        return {
          inKillzone: true,
          activeKillzone: kz,
          nextKillzone: null
        };
      }
    }

    // Find next killzone
    let nextKillzone: Killzone | null = null;
    let minTimeDiff = Infinity;

    for (const kz of KILLZONES) {
      const kzStart = kz.startHour * 60 + kz.startMinute;
      let timeDiff = kzStart - currentTimeMinutes;
      if (timeDiff < 0) timeDiff += 24 * 60; // Next day

      if (timeDiff < minTimeDiff) {
        minTimeDiff = timeDiff;
        nextKillzone = kz;
      }
    }

    return {
      inKillzone: false,
      activeKillzone: null,
      nextKillzone: nextKillzone ? `${nextKillzone.name} in ${Math.floor(minTimeDiff / 60)}h ${minTimeDiff % 60}m` : null
    };
  }

  /**
   * Check news sentiment filter - avoid trading against strong sentiment
   */
  private async checkNewsSentimentFilter(symbol: string): Promise<{
    canTrade: boolean;
    sentimentScore: number;
    reason: string;
  }> {
    try {
      const sentimentScore = await newsSentimentAnalyzer.getNewsEntryFilter(symbol);

      // If sentiment score is very low (< 15), block trading (less restrictive for max performance)
      if (sentimentScore < 15) {
        return {
          canTrade: false,
          sentimentScore,
          reason: `Low news sentiment score (${sentimentScore.toFixed(0)}/100) - market conditions unfavorable`
        };
      }

      return {
        canTrade: true,
        sentimentScore,
        reason: ''
      };
    } catch (error) {
      console.warn(`⚠️ Failed to check news sentiment filter for ${symbol}:`, error);
      // Allow trading if sentiment check fails
      return {
        canTrade: true,
        sentimentScore: 50,
        reason: ''
      };
    }
  }

  /**
   * Check for upcoming high-impact news that would trigger blackout
   */
  private async checkNewsBlackout(now: Date, symbol: string): Promise<{
    inBlackout: boolean;
    upcomingNews: UpcomingNews | null;
  }> {
    // Skip news blackout for gold due to 24/7 volatility
    if (symbol.includes('XAU') || symbol.includes('GOLD')) {
      return {
        inBlackout: false,
        upcomingNews: null
      };
    }
  

    // Refresh cached news if needed
    if (Date.now() - this.lastNewsFetch > this.newsFetchInterval) {
      await this.fetchUpcomingNews();
    }

    // Extract currencies from symbol
    const baseCurrency = symbol.substring(0, 3);
    const quoteCurrency = symbol.length >= 6 ? symbol.substring(3, 6) : '';

    // Check for news affecting this symbol
    for (const news of this.cachedNews) {
      // Check if this news affects the trading pair
      const affectsSymbol = news.affectedPairs.includes(symbol) ||
        news.currency === baseCurrency ||
        news.currency === quoteCurrency;

      if (!affectsSymbol) continue;

      // Calculate time until event
      const timeDiff = news.eventTime.getTime() - now.getTime();
      const minutesUntilEvent = timeDiff / (1000 * 60);
      const minutesSinceEvent = -minutesUntilEvent;

      // Determine blackout window based on impact
      const blackoutMinutes = news.impact === 'HIGH' 
        ? this.newsBlackoutMinutes 
        : this.lowImpactBlackoutMinutes;

      // Check if in blackout window (only before upcoming events)
      const inBlackout = minutesUntilEvent >= 0 && minutesUntilEvent <= blackoutMinutes;

      if (inBlackout) {
        console.log(`📰 NEWS BLACKOUT: ${news.title} (${news.impact})`, {
          symbol,
          currency: news.currency,
          minutesUntilEvent: minutesUntilEvent.toFixed(0),
          blackoutMinutes
        });

        return {
          inBlackout: true,
          upcomingNews: news
        };
      }
    }

    return {
      inBlackout: false,
      upcomingNews: null
    };
  }

  /**
   * Fetch upcoming economic news from database
   */
  private async fetchUpcomingNews(): Promise<void> {
    try {
      // Skip Supabase operations to avoid session issues
      console.log('📝 Using fallback news data to avoid session issues');
      this.cachedNews = this.getFallbackScheduledNews();
      this.lastNewsFetch = Date.now();
      return;

      // For real trading, try to fetch from Supabase with proper auth handling
      try {
        // Ensure we have a valid session before making requests
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError || !session || await this.isSessionExpired(session)) {
          console.log('🔄 Session expired or invalid, attempting refresh...');
          const { data: { session: refreshedSession }, error: refreshError } = await supabase.auth.refreshSession();
          if (refreshError || !refreshedSession) {
            console.error('❌ Failed to refresh session:', refreshError?.message);
            // Fall back to scheduled news instead of failing completely
            this.cachedNews = this.getFallbackScheduledNews();
            this.lastNewsFetch = Date.now();
            return;
          }
          console.log('✅ Session refreshed successfully');
        }

        const now = new Date();
        const twoHoursFromNow = new Date(now.getTime() + 2 * 60 * 60 * 1000);
        const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);

        // Try to fetch from economic_events table
        const { data: events, error } = await supabase
          .from('economic_events')
          .select('*')
          .gte('event_time', twoHoursAgo.toISOString())
          .lte('event_time', twoHoursFromNow.toISOString())
          .in('impact', ['HIGH', 'high', 'MEDIUM', 'medium'])
          .order('event_time', { ascending: true });

        if (error) {
          console.error('Failed to fetch economic events:', error);
          // Use fallback scheduled events
          this.cachedNews = this.getFallbackScheduledNews();
        } else if (events && events.length > 0) {
          this.cachedNews = events.map(event => ({
            id: event.id,
            title: event.title,
            currency: event.currency,
            impact: (event.impact?.toUpperCase() || 'MEDIUM') as 'HIGH' | 'MEDIUM' | 'LOW',
            eventTime: new Date(event.event_time),
            affectedPairs: event.affected_pairs || this.getAffectedPairs(event.currency)
          }));
        } else {
          this.cachedNews = this.getFallbackScheduledNews();
        }

        this.lastNewsFetch = Date.now();
        console.log(`📰 Loaded ${this.cachedNews.length} upcoming news events`);

      } catch (authError) {
        console.error('❌ Authentication error fetching news:', authError);
        // Fall back to scheduled news on auth failure
        this.cachedNews = this.getFallbackScheduledNews();
        this.lastNewsFetch = Date.now();
      }

    } catch (error) {
      console.error('Error fetching news:', error);
      this.cachedNews = this.getFallbackScheduledNews();
    }
  }

  private async isPaperTradingMode(): Promise<boolean> {
    try {
      const { orderManager } = await import('./orderManager');
      return (orderManager as any).isPaperTradingMode;
    } catch (error) {
      console.warn('Could not check paper trading mode:', error);
      return false;
    }
  }

  private async isSessionExpired(session: any): Promise<boolean> {
    if (!session || !session.expires_at) return true;
    const expiresAt = new Date(session.expires_at * 1000); // Convert to milliseconds
    const now = new Date();
    return expiresAt <= now;
  }

  /**
   * Get known scheduled high-impact events (fallback)
   */
  private getFallbackScheduledNews(): UpcomingNews[] {
    const now = new Date();
    const todayEvents: UpcomingNews[] = [];

    // Common high-impact news times (UTC)
    const knownEvents = [
      { hour: 8, minute: 30, title: 'US CPI/Employment Data', currency: 'USD', impact: 'HIGH' as const },
      { hour: 12, minute: 30, title: 'US Economic Release', currency: 'USD', impact: 'HIGH' as const },
      { hour: 14, minute: 0, title: 'Fed Interest Rate Decision', currency: 'USD', impact: 'HIGH' as const },
      { hour: 14, minute: 30, title: 'Fed Press Conference', currency: 'USD', impact: 'HIGH' as const },
      { hour: 7, minute: 0, title: 'UK GDP/Employment', currency: 'GBP', impact: 'HIGH' as const },
      { hour: 10, minute: 0, title: 'ECB Interest Rate', currency: 'EUR', impact: 'HIGH' as const },
      { hour: 3, minute: 0, title: 'BOJ Policy Statement', currency: 'JPY', impact: 'HIGH' as const },
    ];

    for (const event of knownEvents) {
      const eventTime = new Date(now);
      eventTime.setUTCHours(event.hour, event.minute, 0, 0);
      
      // Check if this event is within 2 hours from now
      const timeDiff = Math.abs(eventTime.getTime() - now.getTime());
      if (timeDiff <= 2 * 60 * 60 * 1000) {
        todayEvents.push({
          id: `fallback-${event.hour}-${event.minute}`,
          title: event.title,
          currency: event.currency,
          impact: event.impact,
          eventTime,
          affectedPairs: this.getAffectedPairs(event.currency)
        });
      }
    }

    return todayEvents;
  }

  /**
   * Get pairs affected by a currency's news
   */
  private getAffectedPairs(currency: string): string[] {
    const pairs: Record<string, string[]> = {
      'USD': ['EURUSD', 'GBPUSD', 'USDJPY', 'USDCHF', 'USDCAD', 'AUDUSD', 'NZDUSD', 'XAUUSD'],
      'EUR': ['EURUSD', 'EURGBP', 'EURJPY', 'EURCHF', 'EURCAD', 'EURAUD'],
      'GBP': ['GBPUSD', 'EURGBP', 'GBPJPY', 'GBPCHF', 'GBPCAD', 'GBPAUD'],
      'JPY': ['USDJPY', 'EURJPY', 'GBPJPY', 'AUDJPY', 'CADJPY', 'CHFJPY'],
      'CHF': ['USDCHF', 'EURCHF', 'GBPCHF', 'CHFJPY'],
      'CAD': ['USDCAD', 'EURCAD', 'GBPCAD', 'CADJPY'],
      'AUD': ['AUDUSD', 'EURAUD', 'GBPAUD', 'AUDJPY', 'AUDCAD'],
      'NZD': ['NZDUSD', 'EURNZD', 'GBPNZD', 'NZDJPY'],
      'XAU': ['XAUUSD']
    };
    return pairs[currency] || [];
  }

  private getTimeUntil(date?: Date): string {
    if (!date) return 'Unknown';
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    const minutes = Math.round(diffMs / 60000);
    
    if (minutes < 0) return `${Math.abs(minutes)}m ago`;
    if (minutes < 60) return `${minutes}m`;
    return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
  }

  // ============= Configuration Methods =============

  setKillzoneEnabled(enabled: boolean): void {
    this.killzoneEnabled = enabled;
    console.log(`⏰ Killzone filter: ${enabled ? 'ENABLED' : 'DISABLED'}`);
  }

  setNewsBlackoutEnabled(enabled: boolean): void {
    this.newsBlackoutEnabled = enabled;
    console.log(`📰 News blackout filter: ${enabled ? 'ENABLED' : 'DISABLED'}`);
  }

  setNewsBlackoutMinutes(minutes: number): void {
    this.newsBlackoutMinutes = Math.max(5, Math.min(30, minutes));
    console.log(`📰 News blackout window: ${this.newsBlackoutMinutes} minutes`);
  }

  isKillzoneEnabled(): boolean {
    return this.killzoneEnabled;
  }

  isNewsBlackoutEnabled(): boolean {
    return this.newsBlackoutEnabled;
  }

  getKillzones(): Killzone[] {
    return [...KILLZONES];
  }

  getCachedNews(): UpcomingNews[] {
    return [...this.cachedNews];
  }

  /**
   * Get current filter status for display
   */
  async getFilterStatus(): Promise<{
    killzoneEnabled: boolean;
    newsBlackoutEnabled: boolean;
    inKillzone: boolean;
    activeKillzone: Killzone | null;
    upcomingHighImpactNews: UpcomingNews[];
    canTradeAny: boolean;
  }> {
    const now = new Date();
    const killzoneCheck = this.checkKillzone(now, 'EURUSD');
    await this.fetchUpcomingNews();
    
    const highImpactNews = this.cachedNews.filter(n => n.impact === 'HIGH');
    
    return {
      killzoneEnabled: this.killzoneEnabled,
      newsBlackoutEnabled: this.newsBlackoutEnabled,
      inKillzone: killzoneCheck.inKillzone,
      activeKillzone: killzoneCheck.activeKillzone,
      upcomingHighImpactNews: highImpactNews,
      canTradeAny: killzoneCheck.inKillzone || !this.killzoneEnabled
    };
  }
}

export const tradingFilters = new TradingFilters();

