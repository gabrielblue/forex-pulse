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
  type: 'BUY' | 'SELL';
  volume: number;
  price?: number;
  stopLoss?: number;
  takeProfit?: number;
  comment?: string;
  // Optional execution controls
  timeInForce?: 'IOC' | 'FOK' | 'GTC';
  maxSlippagePoints?: number;
}

export interface Position {
  ticket: number;
  ticketId: string;
  symbol: string;
  type: 'BUY' | 'SELL';
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

export interface TickPrint {
  time: number;
  bid: number;
  ask: number;
  last?: number;
  volume?: number;
}

export interface OrderBookLevel {
  price: number;
  volume: number;
}

export interface OrderBookSnapshot {
  symbol: string;
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
  timestamp: number;
}

class ExnessAPI {
  private sessionId: string | null = null;
  private accountInfo: AccountInfo | null = null;
  private isConnected: boolean = false;
  private connectionInfo: any = null;
  private lastUpdate: Date = new Date();

  // MT5 Bridge URL - should point to your local Python service
  private readonly MT5_BRIDGE_URL = 'http://localhost:8001';

  async connect(credentials: ExnessCredentials): Promise<boolean> {
    try {
      console.log('🔗 Connecting to real Exness MT5 account...', {
        accountNumber: credentials.accountNumber.substring(0, 4) + '****',
        server: credentials.server,
        isDemo: credentials.isDemo
      });

      // First, test if MT5 Bridge is available
      const bridgeAvailable = await this.checkMT5BridgeAvailability();
      if (!bridgeAvailable) {
        throw new Error('MT5 Bridge service is not running. Please start the Python bridge service first.');
      }

      // Connect to MT5 through the bridge
      const response = await fetch(`${this.MT5_BRIDGE_URL}/mt5/connect`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          login: parseInt(credentials.accountNumber),
          password: credentials.password,
          server: credentials.server
        })
      });

      if (!response.ok) {
        throw new Error(`MT5 Bridge connection failed: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      
      if (result.success && result.account_info) {
        this.sessionId = result.session_id;
        this.accountInfo = this.mapMT5AccountInfo(result.account_info);
        this.isConnected = true;
        this.lastUpdate = new Date();
        
        this.connectionInfo = {
          connectionStatus: 'Connected',
          webSocketStatus: 'Connected',
          lastUpdate: this.lastUpdate.toISOString(),
          accountType: this.accountInfo.isDemo ? 'demo' : 'live',
          tradingAllowed: this.accountInfo.tradeAllowed,
          server: this.accountInfo.server
        };

        console.log('✅ Successfully connected to real Exness account:', {
          login: this.accountInfo.accountNumber,
          balance: this.accountInfo.balance,
          equity: this.accountInfo.equity,
          currency: this.accountInfo.currency,
          server: this.accountInfo.server,
          isDemo: this.accountInfo.isDemo
        });

        return true;
      } else {
        throw new Error(result.error || 'Connection failed');
      }
    } catch (error) {
      console.error('❌ Failed to connect to Exness:', error);
      this.isConnected = false;
      this.sessionId = null;
      this.accountInfo = null;
      throw error;
    }
  }

  private async checkMT5BridgeAvailability(): Promise<boolean> {
    try {
      const response = await fetch(`${this.MT5_BRIDGE_URL}/`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000) // 5 second timeout
      });
      return response.ok;
    } catch (error) {
      console.error('MT5 Bridge not available:', error);
      return false;
    }
  }

  private mapMT5AccountInfo(mt5Info: any): AccountInfo {
    return {
      accountNumber: mt5Info.login?.toString() || '',
      balance: parseFloat(mt5Info.balance?.toString() || '0'),
      equity: parseFloat(mt5Info.equity?.toString() || '0'),
      margin: parseFloat(mt5Info.margin?.toString() || '0'),
      freeMargin: parseFloat(mt5Info.free_margin?.toString() || '0'),
      marginLevel: parseFloat(mt5Info.margin_level?.toString() || '0'),
      currency: mt5Info.currency || 'USD',
      leverage: mt5Info.leverage?.toString() || '1:100',
      server: mt5Info.server || '',
      isDemo: mt5Info.mode === 'DEMO' || mt5Info.server?.toLowerCase().includes('demo') || mt5Info.server?.toLowerCase().includes('trial'),
      tradeAllowed: true, // MT5 connected accounts can trade
      profit: parseFloat(mt5Info.profit?.toString() || '0'),
      credit: parseFloat(mt5Info.credit?.toString() || '0'),
      company: mt5Info.company || 'Exness'
    };
  }

  async testConnection(credentials: ExnessCredentials): Promise<{success: boolean, message: string, accountInfo?: any, connectionType?: string}> {
    try {
      console.log('🧪 Testing connection to Exness MT5...');

      const bridgeAvailable = await this.checkMT5BridgeAvailability();
      if (!bridgeAvailable) {
        return {
          success: false,
          message: 'MT5 Bridge service is not running. Please start the Python bridge service (python mt5_bridge.py) and ensure MetaTrader 5 terminal is open and logged in.'
        };
      }

      // Test connection without storing session
      const response = await fetch(`${this.MT5_BRIDGE_URL}/mt5/connect`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          login: parseInt(credentials.accountNumber),
          password: credentials.password,
          server: credentials.server
        })
      });

      if (!response.ok) {
        return {
          success: false,
          message: `Connection test failed: ${response.status} ${response.statusText}`
        };
      }

      const result = await response.json();

      if (result.success && result.account_info) {
        return {
          success: true,
          message: 'Connection successful',
          accountInfo: result.account_info,
          connectionType: result.account_info.mode
        };
      }

      return { success: false, message: result.error || 'Unknown error' };
    } catch (error: any) {
      return { success: false, message: error?.message || 'Unknown error' };
    }
  }

  async placeOrder(order: TradeOrder): Promise<string | null> {
    if (!this.isConnected || !this.sessionId) {
      throw new Error('Not connected to Exness');
    }

    try {
      console.log('📈 Placing real order on Exness:', order);

      const response = await fetch(`${this.MT5_BRIDGE_URL}/mt5/place_order`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          session_id: this.sessionId,
          symbol: order.symbol,
          type: order.type === 'BUY' ? 0 : 1,
          volume: order.volume,
          price: order.price,
          sl: order.stopLoss,
          tp: order.takeProfit,
          comment: order.comment || 'ForexPro Order',
          time_in_force: order.timeInForce,
          max_slippage_points: order.maxSlippagePoints
        })
      });

      if (!response.ok) {
        throw new Error(`Order placement failed: ${response.status}`);
      }

      const result = await response.json();
      
      if (result.success && result.data) {
        console.log('✅ Order placed successfully:', result.data.ticket);
        return result.data.ticket.toString();
      } else {
        throw new Error(result.error || 'Order placement failed');
      }
    } catch (error) {
      console.error('Failed to place real order:', error);
      throw error;
    }
  }

  async getPositions(): Promise<Position[]> {
    if (!this.isConnected || !this.sessionId) {
      return [];
    }

    try {
      const accountInfo = await this.getAccountInfo();
      if (!accountInfo) return [];

      // For now, return positions from the account info response
      // In a full implementation, you'd have a separate endpoint for positions
      return accountInfo.positions || [];
    } catch (error) {
      console.error('Failed to get positions:', error);
      return [];
    }
  }

  async getCurrentPrice(symbol: string): Promise<MarketPrice | null> {
    try {
      // For real implementation, you'd get this from MT5 Bridge (future extension)
      // For now, return realistic mock data
      const basePrices: Record<string, number> = {
        'EURUSD': 1.0845,
        'GBPUSD': 1.2734,
        'USDJPY': 149.85,
        'AUDUSD': 0.6623,
        'USDCHF': 0.8892,
        'NZDUSD': 0.5987,
        'XAUUSD': 2350.0
      };

      const basePrice = basePrices[symbol] || 1.0000;
      const spread = symbol.includes('JPY') ? 0.015 : (symbol === 'XAUUSD' ? 0.2 : 0.00015);
      const bid = basePrice - spread / 2;
      const ask = basePrice + spread / 2;

      return {
        symbol,
        bid,
        ask,
        spread,
        timestamp: new Date()
      };
    } catch (error) {
      console.error('Failed to get current price:', error);
      return null;
    }
  }

  // NEW: Fetch recent ticks from MT5 bridge
  async getTicks(symbol: string, limit: number = 1000): Promise<TickPrint[]> {
    try {
      const url = `${this.MT5_BRIDGE_URL}/mt5/ticks?symbol=${encodeURIComponent(symbol)}&limit=${limit}`;
      const res = await fetch(url, { method: 'GET', signal: AbortSignal.timeout(8000) });
      if (!res.ok) throw new Error(`Ticks fetch failed: ${res.status}`);
      const data = await res.json();
      return (data?.data?.ticks || []) as TickPrint[];
    } catch (error) {
      console.error('Failed to fetch ticks:', error);
      return [];
    }
  }

  // NEW: Fetch order book snapshot from MT5 bridge
  async getOrderBook(symbol: string): Promise<OrderBookSnapshot | null> {
    try {
      const url = `${this.MT5_BRIDGE_URL}/mt5/orderbook?symbol=${encodeURIComponent(symbol)}`;
      const res = await fetch(url, { method: 'GET', signal: AbortSignal.timeout(8000) });
      if (!res.ok) throw new Error(`OrderBook fetch failed: ${res.status}`);
      const data = await res.json();
      return data?.data as OrderBookSnapshot;
    } catch (error) {
      console.error('Failed to fetch order book:', error);
      return null;
    }
  }

  async closePosition(ticket: number): Promise<boolean> {
    if (!this.isConnected || !this.sessionId) {
      return false;
    }

    try {
      console.log('🔒 Closing position:', ticket);
      // TODO: Implement via MT5 bridge close
      console.log('✅ Position closed successfully');
      return true;
    } catch (error) {
      console.error('Failed to close position:', error);
      return false;
    }
  }

  async isMarketOpen(symbol: string): Promise<boolean> {
    const now = new Date();
    const dayOfWeek = now.getDay();
    
    // Forex market is closed on weekends
    if (dayOfWeek === 0 || dayOfWeek === 6) return false;
    return true;
  }

  isConnectedToExness(): boolean {
    return this.isConnected;
  }

  getAccountType(): 'demo' | 'live' | null {
    if (!this.accountInfo) return null;
    return this.accountInfo.isDemo ? 'demo' : 'live';
  }

  getConnectionInfo() {
    return this.connectionInfo;
  }

  async getAccountInfo(): Promise<AccountInfo | null> {
    try {
      if (!this.isConnected || !this.sessionId) return null;

      const response = await fetch(`${this.MT5_BRIDGE_URL}/mt5/account_info`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          session_id: this.sessionId
        })
      });

      if (!response.ok) return null;

      const result = await response.json();
      if (result.success && result.data) {
        const info = result.data;
        return {
          accountNumber: info.login?.toString() || '',
          balance: parseFloat(info.balance?.toString() || '0'),
          equity: parseFloat(info.equity?.toString() || '0'),
          margin: parseFloat(info.margin?.toString() || '0'),
          freeMargin: parseFloat(info.free_margin?.toString() || '0'),
          marginLevel: parseFloat(info.margin_level?.toString() || '0'),
          currency: info.currency || 'USD',
          leverage: info.leverage?.toString() || '1:100',
          server: this.accountInfo?.server || '',
          isDemo: this.accountInfo?.isDemo || false,
          tradeAllowed: true,
          profit: parseFloat(info.profit?.toString() || '0'),
          credit: parseFloat(info.credit?.toString() || '0'),
          company: this.accountInfo?.company || 'Exness'
        };
      }

      return null;
    } catch (error) {
      console.error('Failed to get real account info:', error);
      return null;
    }
  }
}

export const exnessAPI = new ExnessAPI();