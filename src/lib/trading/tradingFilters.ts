/**
 * Trading Filters - ChartLord AI Style
 * Session Killzones + News Blackout Filter
 * Only trade during optimal conditions
 */

import { supabase } from '@/integrations/supabase/client';

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
  reason: string;
  bestPairsNow: string[];
}

class TradingFilters {
  private newsBlackoutMinutes = 30; // Stop trading X minutes before/after high-impact news
  private lowImpactBlackoutMinutes = 10; // Less time for medium-impact news
  private cachedNews: UpcomingNews[] = [];
  private lastNewsFetch = 0;
  private newsFetchInterval = 60000; // Refresh news every minute
  
  private killzoneEnabled = true;
  private newsBlackoutEnabled = true;

  /**
   * Main filter check - should we trade right now?
   */
  async canTradeNow(symbol: string): Promise<TradingFilterResult> {
    const now = new Date();
    
    // Check killzone
    const killzoneResult = this.checkKillzone(now, symbol);
    
    // Check news blackout
    const newsResult = await this.checkNewsBlackout(now, symbol);
    
    // Combine results
    const canTrade = (
      (!this.killzoneEnabled || killzoneResult.inKillzone) &&
      (!this.newsBlackoutEnabled || !newsResult.inBlackout)
    );

    let reason = '';
    if (!canTrade) {
      if (this.killzoneEnabled && !killzoneResult.inKillzone) {
        reason = `Outside killzone - next: ${killzoneResult.nextKillzone || 'Unknown'}`;
      }
      if (this.newsBlackoutEnabled && newsResult.inBlackout) {
        reason = `News blackout: ${newsResult.upcomingNews?.title} in ${this.getTimeUntil(newsResult.upcomingNews?.eventTime)}`;
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
   * Check for upcoming high-impact news that would trigger blackout
   */
  private async checkNewsBlackout(now: Date, symbol: string): Promise<{
    inBlackout: boolean;
    upcomingNews: UpcomingNews | null;
  }> {
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

      // Check if in blackout window (before or after)
      const inBlackout = minutesUntilEvent <= blackoutMinutes && minutesSinceEvent <= blackoutMinutes;

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

    } catch (error) {
      console.error('Error fetching news:', error);
      this.cachedNews = this.getFallbackScheduledNews();
    }
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
    this.newsBlackoutMinutes = Math.max(5, Math.min(60, minutes));
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
