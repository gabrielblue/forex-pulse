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

  async getHistoricalData(symbol: string, timeframe: number, count: number): Promise<any[]> {
    if (!this.sessionId) {
      throw new Error('MT5 session not initialized. Call connect() first.');
    }

    try {
      const response = await fetch(`${this.MT5_BRIDGE_URL}/mt5/historical_data`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: this.sessionId,
          symbol,
          timeframe,
          count
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('MT5 Bridge error:', errorText);
        throw new Error('Failed to fetch historical data');
      }

      const result = await response.json();
      if (!result.success || !Array.isArray(result.data) || result.data.length === 0) {
        console.warn(`⚠️ Historical data invalid or empty for ${symbol}`);
        return [];
      }

      return result.data;

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
    };
  }
}

/* =========================
   Singleton Export
   ========================= */

export const exnessAPI = new ExnessAPI();
export default ExnessAPI;
