import { MT5_BRIDGE_URL } from "./config";

/* =========================
   Interfaces & Types
   ========================= */

export interface ExnessCredentials {
  accountNumber: string;
  password: string;
  server: string;
  isDemo: boolean;
}

export interface AccountInfo {
  accountNumber: string;
  balance: number;
  equity: number;
  margin: number;
  freeMargin: number;
  marginLevel: number;
  currency: string;
  leverage: string;
  server: string;
  isDemo: boolean;
  tradeAllowed: boolean;
  profit: number;
  credit: number;
  company: string;
  positions?: Position[];
}

export interface TradeOrder {
  symbol: string;
  type: "BUY" | "SELL";
  volume: number;
  price?: number;
  stopLoss?: number;
  takeProfit?: number;
  comment?: string;
}

export interface Position {
  ticket: number;
  ticketId: string;
  symbol: string;
  type: "BUY" | "SELL";
  volume: number;
  openPrice: number;
  currentPrice: number;
  profit: number;
  stopLoss?: number;
  takeProfit?: number;
  openTime: Date;
  commission: number;
  swap: number;
}

export interface MarketPrice {
  symbol: string;
  bid: number;
  ask: number;
  spread: number;
  timestamp: Date;
}

/* =========================
   Exness API Class
   ========================= */

class ExnessAPI {
  private sessionId: string | null = null;
  private accountInfo: AccountInfo | null = null;
  private isConnected = false;
  private connectionInfo: any = null;
  private lastUpdate: Date = new Date();

  private readonly MT5_BRIDGE_URL = MT5_BRIDGE_URL;
  private readonly REQUEST_TIMEOUT = 30000;
  private readonly MAX_RETRIES = 3;

  // MT5 timeframe mapping (string to MT5 constant)
  private readonly TIMEFRAME_MAP: { [key: string]: number } = {
    '1m': 1,     // MT5_TIMEFRAME_M1
    '5m': 5,     // MT5_TIMEFRAME_M5
    '15m': 15,   // MT5_TIMEFRAME_M15
    '30m': 30,   // MT5_TIMEFRAME_M30
    '1h': 60,    // MT5_TIMEFRAME_H1
    '4h': 240,   // MT5_TIMEFRAME_H4
    '1d': 1440,  // MT5_TIMEFRAME_D1
    '1w': 10080, // MT5_TIMEFRAME_W1
    'M1': 43200, // MT5_TIMEFRAME_MN1
  };

  /* =========================
     Helpers
     ========================= */

  private async fetchWithTimeout(
    url: string,
    options: RequestInit,
    retries: number = this.MAX_RETRIES
  ): Promise<Response> {
    for (let i = 0; i < retries; i++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(
          () => controller.abort(),
          this.REQUEST_TIMEOUT
        );

        const response = await fetch(url, {
          ...options,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);
        return response;
      } catch (error: any) {
        if (i === retries - 1) {
          throw new Error(error.message);
        }
        await new Promise((r) => setTimeout(r, 1000 * (i + 1)));
      }
    }
    throw new Error("Request failed");
  }

  /* =========================
     Connection
     ========================= */

  async testConnection(credentials: ExnessCredentials): Promise<any> {
    const bridgeUp = await this.checkMT5BridgeAvailability();
    if (!bridgeUp) {
      throw new Error("MT5 Bridge service is not running");
    }

    const response = await this.fetchWithTimeout(
      `${this.MT5_BRIDGE_URL}/mt5/connect`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          login: parseInt(credentials.accountNumber),
          password: credentials.password,
          server: credentials.server,
        }),
      }
    );

    const result = await response.json();

    if (!result.success || !result.account_info) {
      return {
        success: false,
        message: result.error || "Connection failed",
        accountInfo: null
      };
    }

    // Don't store session for test connection
    const accountInfo = this.mapMT5AccountInfo(result.account_info);

    return {
      success: true,
      message: "Connection successful",
      accountInfo
    };
  }

  async connect(credentials: ExnessCredentials): Promise<boolean> {
    const bridgeUp = await this.checkMT5BridgeAvailability();
    if (!bridgeUp) {
      throw new Error("MT5 Bridge service is not running");
    }

    const response = await this.fetchWithTimeout(
      `${this.MT5_BRIDGE_URL}/mt5/connect`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          login: parseInt(credentials.accountNumber),
          password: credentials.password,
          server: credentials.server,
        }),
      }
    );

    const result = await response.json();

    if (!result.success || !result.account_info) {
      throw new Error(result.error || "Connection failed");
    }

    this.sessionId = result.session_id;
    this.accountInfo = this.mapMT5AccountInfo(result.account_info);
    this.isConnected = true;
    this.lastUpdate = new Date();

    this.connectionInfo = {
      status: "Connected",
      server: this.accountInfo.server,
      login: this.accountInfo.accountNumber,
      isDemo: this.accountInfo.isDemo,
    };

    return true;
  }

  private async checkMT5BridgeAvailability(): Promise<boolean> {
    try {
      const res = await fetch(`${this.MT5_BRIDGE_URL}/status`);
      return res.ok;
    } catch {
      return false;
    }
  }

  /* =========================
     Historical Data
     ========================= */

  async getHistoricalData(symbol: string, timeframe: string, count: number): Promise<any[]> {
    if (!this.sessionId) {
      throw new Error('MT5 session not initialized. Call connect() first.');
    }

    const mt5Timeframe = this.TIMEFRAME_MAP[timeframe];
    if (!mt5Timeframe) {
      throw new Error(`Unsupported timeframe: ${timeframe}`);
    }

    try {
      const response = await fetch(`${this.MT5_BRIDGE_URL}/mt5/historical_data`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: this.sessionId,
          symbol,
          timeframe: mt5Timeframe,
          count
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('MT5 Bridge error:', errorText);
        throw new Error('Failed to fetch historical data');
      }

      const result = await response.json();
      if (!result.success || !result.data?.bars || !Array.isArray(result.data.bars)) {
        console.warn(`⚠️ Historical data invalid or empty for ${symbol}`);
        return [];
      }

      return result.data.bars;

    } catch (error) {
      console.error('Error fetching historical data:', error);
      return [];
    }
  }

  /* =========================
     Account & Market
     ========================= */

  async getAccountInfo(): Promise<AccountInfo | null> {
    return this.accountInfo;
  }

  async getCurrentPrice(symbol: string): Promise<MarketPrice | null> {
    if (!this.isConnected || !this.sessionId) return null;

    const response = await fetch(
      `${this.MT5_BRIDGE_URL}/mt5/symbol_price`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: this.sessionId, symbol }),
      }
    );

    if (!response.ok) return null;
    const result = await response.json();

    return result.success
      ? {
          symbol,
          bid: Number(result.data.bid),
          ask: Number(result.data.ask),
          spread: Number(result.data.ask) - Number(result.data.bid),
          timestamp: new Date(),
        }
      : null;
  }

  async getPositions(): Promise<Position[]> {
    return this.accountInfo?.positions || [];
  }

  async placeOrder(order: TradeOrder): Promise<any> {
    if (!this.sessionId) {
      throw new Error('MT5 session not initialized. Call connect() first.');
    }

    const response = await this.fetchWithTimeout(
      `${this.MT5_BRIDGE_URL}/mt5/place_order`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: this.sessionId,
          symbol: order.symbol,
          type: order.type === "BUY" ? 0 : 1,
          volume: order.volume,
          price: order.price,
          sl: order.stopLoss,
          tp: order.takeProfit,
          comment: order.comment || "API Order"
        }),
      }
    );

    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error || "Order placement failed");
    }

    return result.data;
  }

  async closePosition(ticket: number): Promise<any> {
    if (!this.sessionId) {
      throw new Error('MT5 session not initialized. Call connect() first.');
    }

    const response = await this.fetchWithTimeout(
      `${this.MT5_BRIDGE_URL}/mt5/close_position`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: this.sessionId,
          ticket
        }),
      }
    );

    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error || "Position close failed");
    }

    return result.data;
  }

  async refreshAccountInfo(): Promise<AccountInfo | null> {
    if (!this.sessionId) return null;

    const response = await this.fetchWithTimeout(
      `${this.MT5_BRIDGE_URL}/mt5/account_info`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: this.sessionId }),
      }
    );

    const result = await response.json();
    if (!result.success) return null;

    this.accountInfo = this.mapMT5AccountInfo(result.data);
    this.lastUpdate = new Date();
    return this.accountInfo;
  }

  /* =========================
     Trading Capability
     ========================= */

  async verifyTradingCapabilities(): Promise<{ canTrade: boolean; issues: string[] }> {
    const issues: string[] = [];
    if (!this.isConnected) issues.push("Not connected to Exness");
    if (!this.accountInfo) issues.push("Account information not available");
    if (this.accountInfo && !this.accountInfo.tradeAllowed) issues.push("Trading disabled");
    if (this.accountInfo && this.accountInfo.balance <= 0) issues.push("Insufficient balance");
    return { canTrade: issues.length === 0, issues };
  }

  getTradingIssues(): string[] {
    const issues: string[] = [];
    if (!this.isConnected) issues.push("Not connected");
    if (!this.accountInfo) issues.push("No account info");
    if (this.accountInfo && !this.accountInfo.tradeAllowed) issues.push("Trading disabled");
    return issues;
  }

  /* =========================
     State helpers
     ========================= */

  isConnectedToExness(): boolean {
    return this.isConnected && this.sessionId !== null;
  }

  getConnectionInfo(): any {
    return this.connectionInfo;
  }

  disconnect(): void {
    this.isConnected = false;
    this.sessionId = null;
    this.accountInfo = null;
    this.connectionInfo = null;
  }

  /* =========================
     Mapping
     ========================= */

  private mapMT5AccountInfo(mt5: any): AccountInfo {
    const positions: Position[] = (mt5.positions || []).map((pos: any) => ({
      ticket: pos.ticket,
      ticketId: pos.ticket.toString(),
      symbol: pos.symbol,
      type: pos.type === 0 ? "BUY" : "SELL",
      volume: Number(pos.volume),
      openPrice: Number(pos.price_open),
      currentPrice: 0, // Will be updated separately
      profit: Number(pos.profit),
      stopLoss: pos.sl ? Number(pos.sl) : undefined,
      takeProfit: pos.tp ? Number(pos.tp) : undefined,
      openTime: new Date(pos.time * 1000), // MT5 timestamp
      commission: 0,
      swap: 0
    }));

    return {
      accountNumber: mt5.login?.toString() || "",
      balance: Number(mt5.balance || 0),
      equity: Number(mt5.equity || 0),
      margin: Number(mt5.margin || 0),
      freeMargin: Number(mt5.free_margin || 0),
      marginLevel: Number(mt5.margin_level || 0),
      currency: mt5.currency || "USD",
      leverage: mt5.leverage?.toString() || "1:100",
      server: mt5.server || "",
      isDemo: mt5.mode === "DEMO",
      tradeAllowed: true,
      profit: Number(mt5.profit || 0),
      credit: Number(mt5.credit || 0),
      company: mt5.company || "Exness",
      positions
    };
  }
}

/* =========================
   Singleton Export
   ========================= */

export const exnessAPI = new ExnessAPI();
export default ExnessAPI;
