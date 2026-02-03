/**
 * Trading Journal Module
 * Records all trading activities, decisions, and outcomes for analysis
 * Uses local storage for fallback and Supabase when available
 */

export interface TradeJournalEntry {
  id?: string;
  ticket_id: string;
  symbol: string;
  trade_type: 'BUY' | 'SELL';
  entry_price: number;
  entry_time: Date;
  volume: number;
  lot_size: number;
  stop_loss: number | null;
  take_profit: number | null;
  exit_price?: number;
  exit_time?: Date;
  exit_reason?: 'TAKE_PROFIT' | 'STOP_LOSS' | 'MANUAL' | 'TIMEOUT' | 'WEEKEND' | 'EMERGENCY';
  pnl?: number;
  pnl_percent?: number;
  swap?: number;
  commission?: number;
  confidence_score?: number;
  confluence_factors?: string[];
  regime_at_entry?: string;
  regime_at_exit?: string;
  session?: string;
  market_regime?: string;
  volatility_at_entry?: string;
  news_impact?: 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE';
  news_event?: string;
  risk_reward_ratio?: number;
  risk_amount?: number;
  risk_percent?: number;
  max_risk_allowed?: number;
  trade_quality?: 'EXCELLENT' | 'GOOD' | 'AVERAGE' | 'POOR';
  lessons_learned?: string;
  mistakes?: string[];
  status: 'OPEN' | 'CLOSED' | 'CANCELLED';
  notes?: string;
  tags?: string[];
  created_at?: Date;
  updated_at?: Date;
}

export interface JournalStats {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  totalPnL: number;
  averageWin: number;
  averageLoss: number;
  profitFactor: number;
  longestWinStreak: number;
  longestLossStreak: number;
  averageTradeDuration: number;
  bestTrade: number;
  worstTrade: number;
  riskRewardRatio: number;
}

class TradingJournal {
  private storageKey = 'forex_pulse_trading_journal';
  private journalData: TradeJournalEntry[] = [];

  async initialize(): Promise<void> {
    console.log('📓 TradingJournal: Initializing...');
    this.loadFromLocalStorage();
    console.log('✅ TradingJournal: Initialized successfully');
  }

  /**
   * Load journal data from local storage
   */
  private loadFromLocalStorage(): void {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (stored) {
        this.journalData = JSON.parse(stored).map((entry: any) => ({
          ...entry,
          entry_time: new Date(entry.entry_time),
          exit_time: entry.exit_time ? new Date(entry.exit_time) : undefined,
          created_at: entry.created_at ? new Date(entry.created_at) : undefined,
          updated_at: entry.updated_at ? new Date(entry.updated_at) : undefined
        }));
        console.log(`📓 Loaded ${this.journalData.length} entries from local storage`);
      }
    } catch (error) {
      console.warn('📓 Could not load journal from local storage:', error);
      this.journalData = [];
    }
  }

  /**
   * Save journal data to local storage
   */
  private saveToLocalStorage(): void {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.journalData));
    } catch (error) {
      console.warn('📓 Could not save journal to local storage:', error);
    }
  }

  /**
   * Record a new trade entry
   */
  async recordTradeEntry(entry: Omit<TradeJournalEntry, 'id' | 'created_at' | 'updated_at'>): Promise<string> {
    const newEntry: TradeJournalEntry = {
      ...entry,
      id: crypto.randomUUID(),
      created_at: new Date(),
      updated_at: new Date()
    };

    this.journalData.push(newEntry);
    this.saveToLocalStorage();

    console.log(`📓 Trade entry recorded: ${entry.ticket_id}`);
    return newEntry.id!;
  }

  /**
   * Record trade exit and calculate final P&L
   */
  async recordTradeExit(
    ticketId: string,
    exitDetails: {
      exit_price: number;
      exit_time: Date;
      exit_reason: TradeJournalEntry['exit_reason'];
      pnl: number;
      swap?: number;
      commission?: number;
    }
  ): Promise<boolean> {
    const index = this.journalData.findIndex(t => t.ticket_id === ticketId);
    if (index === -1) {
      console.error(`📓 Trade not found: ${ticketId}`);
      return false;
    }

    const trade = this.journalData[index];
    const pnlPercent = this.calculatePnLPercent(trade, exitDetails.pnl);

    this.journalData[index] = {
      ...trade,
      ...exitDetails,
      pnl_percent: pnlPercent,
      status: 'CLOSED',
      updated_at: new Date()
    };

    this.saveToLocalStorage();
    console.log(`📓 Trade exit recorded: ${ticketId}, P&L: ${exitDetails.pnl.toFixed(2)}`);
    return true;
  }

  /**
   * Update trade with analysis and review
   */
  async updateTradeAnalysis(
    ticketId: string,
    analysis: Partial<Pick<TradeJournalEntry, 'trade_quality' | 'lessons_learned' | 'mistakes' | 'notes' | 'tags'>>
  ): Promise<boolean> {
    const index = this.journalData.findIndex(t => t.ticket_id === ticketId);
    if (index === -1) {
      console.error(`📓 Trade not found: ${ticketId}`);
      return false;
    }

    this.journalData[index] = {
      ...this.journalData[index],
      ...analysis,
      updated_at: new Date()
    };

    this.saveToLocalStorage();
    console.log(`📓 Trade analysis updated: ${ticketId}`);
    return true;
  }

  /**
   * Get all trades with optional filters
   */
  getTrades(filters?: {
    symbol?: string;
    trade_type?: 'BUY' | 'SELL';
    status?: 'OPEN' | 'CLOSED' | 'CANCELLED';
    startDate?: Date;
    endDate?: Date;
    minPnL?: number;
    maxPnL?: number;
    tags?: string[];
  }): TradeJournalEntry[] {
    let filtered = [...this.journalData];

    if (filters) {
      if (filters.symbol) {
        filtered = filtered.filter(t => t.symbol === filters.symbol);
      }
      if (filters.trade_type) {
        filtered = filtered.filter(t => t.trade_type === filters.trade_type);
      }
      if (filters.status) {
        filtered = filtered.filter(t => t.status === filters.status);
      }
      if (filters.startDate) {
        filtered = filtered.filter(t => new Date(t.entry_time) >= filters.startDate!);
      }
      if (filters.endDate) {
        filtered = filtered.filter(t => new Date(t.entry_time) <= filters.endDate!);
      }
      if (filters.minPnL !== undefined) {
        filtered = filtered.filter(t => (t.pnl || 0) >= filters.minPnL!);
      }
      if (filters.maxPnL !== undefined) {
        filtered = filtered.filter(t => (t.pnl || 0) <= filters.maxPnL!);
      }
    }

    return filtered.sort((a, b) => new Date(b.entry_time).getTime() - new Date(a.entry_time).getTime());
  }

  /**
   * Get a specific trade by ticket ID
   */
  getTradeByTicket(ticketId: string): TradeJournalEntry | undefined {
    return this.journalData.find(t => t.ticket_id === ticketId);
  }

  /**
   * Get open positions
   */
  getOpenPositions(): TradeJournalEntry[] {
    return this.getTrades({ status: 'OPEN' });
  }

  /**
   * Get closed trades within a date range
   */
  getClosedTrades(startDate?: Date, endDate?: Date): TradeJournalEntry[] {
    return this.getTrades({ status: 'CLOSED', startDate, endDate });
  }

  /**
   * Calculate P&L percentage
   */
  private calculatePnLPercent(trade: TradeJournalEntry, pnl: number): number {
    if (!trade.entry_price || !trade.volume) return 0;
    const notionalValue = trade.entry_price * trade.volume * 100000;
    return (pnl / notionalValue) * 100;
  }

  /**
   * Calculate journal statistics
   */
  calculateStats(period?: { start: Date; end: Date }): JournalStats {
    const trades = this.getClosedTrades(period?.start, period?.end);

    const winningTrades = trades.filter(t => (t.pnl || 0) > 0);
    const losingTrades = trades.filter(t => (t.pnl || 0) <= 0);
    const totalPnL = trades.reduce((sum, t) => sum + (t.pnl || 0), 0);
    const avgWin = winningTrades.length > 0
      ? winningTrades.reduce((sum, t) => sum + (t.pnl || 0), 0) / winningTrades.length
      : 0;
    const avgLoss = losingTrades.length > 0
      ? Math.abs(losingTrades.reduce((sum, t) => sum + (t.pnl || 0), 0) / losingTrades.length)
      : 0;

    // Calculate longest streaks
    let currentWinStreak = 0;
    let currentLossStreak = 0;
    let longestWinStreak = 0;
    let longestLossStreak = 0;

    for (const trade of trades) {
      if ((trade.pnl || 0) > 0) {
        currentWinStreak++;
        currentLossStreak = 0;
        longestWinStreak = Math.max(longestWinStreak, currentWinStreak);
      } else {
        currentLossStreak++;
        currentWinStreak = 0;
        longestLossStreak = Math.max(longestLossStreak, currentLossStreak);
      }
    }

    // Calculate average trade duration
    const tradesWithDuration = trades.filter(t => t.exit_time && t.entry_time);
    const avgDuration = tradesWithDuration.length > 0
      ? tradesWithDuration.reduce((sum, t) => {
          const duration = new Date(t.exit_time!).getTime() - new Date(t.entry_time).getTime();
          return sum + duration;
        }, 0) / tradesWithDuration.length / 1000 / 60 / 60
      : 0;

    const bestTrade = Math.max(...trades.map(t => t.pnl || 0), 0);
    const worstTrade = Math.min(...trades.map(t => t.pnl || 0), 0);

    // Calculate average risk-reward ratio from trades
    const tradesWithRR = trades.filter(t => t.risk_reward_ratio);
    const avgRR = tradesWithRR.length > 0
      ? tradesWithRR.reduce((sum, t) => sum + (t.risk_reward_ratio || 0), 0) / tradesWithRR.length
      : 0;

    return {
      totalTrades: trades.length,
      winningTrades: winningTrades.length,
      losingTrades: losingTrades.length,
      winRate: trades.length > 0 ? (winningTrades.length / trades.length) * 100 : 0,
      totalPnL,
      averageWin: avgWin,
      averageLoss: avgLoss,
      profitFactor: avgLoss > 0 ? avgWin / avgLoss : avgWin > 0 ? Infinity : 0,
      longestWinStreak,
      longestLossStreak,
      averageTradeDuration: avgDuration,
      bestTrade,
      worstTrade,
      riskRewardRatio: avgRR
    };
  }

  /**
   * Get performance by symbol
   */
  getPerformanceBySymbol(): Record<string, {
    trades: number;
    winRate: number;
    totalPnL: number;
    avgWin: number;
    avgLoss: number;
  }> {
    const trades = this.getClosedTrades();
    const symbolStats: Record<string, any> = {};

    for (const trade of trades) {
      const symbol = trade.symbol;
      if (!symbolStats[symbol]) {
        symbolStats[symbol] = { trades: 0, wins: 0, totalPnL: 0, winsList: [], lossesList: [] };
      }
      symbolStats[symbol].trades++;
      symbolStats[symbol].totalPnL += trade.pnl || 0;
      if ((trade.pnl || 0) > 0) {
        symbolStats[symbol].wins++;
        symbolStats[symbol].winsList.push(trade.pnl || 0);
      } else {
        symbolStats[symbol].lossesList.push(trade.pnl || 0);
      }
    }

    const result: Record<string, any> = {};
    for (const [symbol, stats] of Object.entries(symbolStats)) {
      result[symbol] = {
        trades: stats.trades,
        winRate: (stats.wins / stats.trades) * 100,
        totalPnL: stats.totalPnL,
        avgWin: stats.winsList.length > 0 ? stats.winsList.reduce((a: number, b: number) => a + b, 0) / stats.winsList.length : 0,
        avgLoss: stats.lossesList.length > 0 ? Math.abs(stats.lossesList.reduce((a: number, b: number) => a + b, 0) / stats.lossesList.length) : 0
      };
    }

    return result;
  }

  /**
   * Get performance by session
   */
  getPerformanceBySession(): Record<string, {
    trades: number;
    winRate: number;
    totalPnL: number;
  }> {
    const trades = this.getClosedTrades();
    const sessionStats: Record<string, any> = {};

    for (const trade of trades) {
      const session = trade.session || 'Unknown';
      if (!sessionStats[session]) {
        sessionStats[session] = { trades: 0, wins: 0, totalPnL: 0 };
      }
      sessionStats[session].trades++;
      sessionStats[session].totalPnL += trade.pnl || 0;
      if ((trade.pnl || 0) > 0) {
        sessionStats[session].wins++;
      }
    }

    const result: Record<string, any> = {};
    for (const [session, stats] of Object.entries(sessionStats)) {
      result[session] = {
        trades: stats.trades,
        winRate: (stats.wins / stats.trades) * 100,
        totalPnL: stats.totalPnL
      };
    }

    return result;
  }

  /**
   * Get recent trades for dashboard
   */
  getRecentTrades(limit: number = 10): TradeJournalEntry[] {
    return this.journalData
      .sort((a, b) => new Date(b.entry_time).getTime() - new Date(a.entry_time).getTime())
      .slice(0, limit);
  }

  /**
   * Export journal data to CSV
   */
  exportToCSV(): string {
    const trades = this.journalData;
    
    if (trades.length === 0) return '';

    const headers = ['ticket_id', 'symbol', 'trade_type', 'entry_price', 'entry_time', 'volume', 'exit_price', 'exit_time', 'pnl', 'status'];
    const rows = trades.map(trade => [
      trade.ticket_id,
      trade.symbol,
      trade.trade_type,
      trade.entry_price,
      new Date(trade.entry_time).toISOString(),
      trade.volume,
      trade.exit_price || '',
      trade.exit_time ? new Date(trade.exit_time).toISOString() : '',
      trade.pnl || '',
      trade.status
    ].join(','));

    return [headers.join(','), ...rows].join('\n');
  }

  /**
   * Clear all journal data
   */
  clearJournal(): void {
    this.journalData = [];
    localStorage.removeItem(this.storageKey);
    console.log('📓 Journal cleared');
  }

  /**
   * Get journal status
   */
  getStatus(): any {
    return {
      totalEntries: this.journalData.length,
      openPositions: this.getOpenPositions().length,
      lastEntry: this.journalData.length > 0 ? this.journalData[0]?.created_at : null
    };
  }
}

export const tradingJournal = new TradingJournal();
