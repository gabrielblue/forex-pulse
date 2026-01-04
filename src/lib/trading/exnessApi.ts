import { MT5_BRIDGE_URL } from "./config";

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

class ExnessAPI {
  private sessionId: string | null = null;
  private accountInfo: AccountInfo | null = null;
  private isConnected: boolean = false;
  private connectionInfo: any = null;
  private lastUpdate: Date = new Date();

  // MT5 Bridge URL (local runtime)
  private readonly MT5_BRIDGE_URL = MT5_BRIDGE_URL;
  private readonly REQUEST_TIMEOUT = 30000; // 30 seconds
  private readonly MAX_RETRIES = 3;

  /**
   * Helper method to fetch with timeout and retry logic
   */
  private async fetchWithTimeout(
    url: string,
    options: RequestInit,
    retries: number = this.MAX_RETRIES
  ): Promise<Response> {
    for (let i = 0; i < retries; i++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.REQUEST_TIMEOUT);

        const response = await fetch(url, {
          ...options,
          signal: controller.signal
        });

        clearTimeout(timeoutId);
        return response;
      } catch (error: any) {
        console.warn(`Fetch attempt ${i + 1}/${retries} failed:`, error.message);

        if (i === retries - 1) {
          throw new Error(`Request failed after ${retries} attempts: ${error.message}`);
        }

        // Wait before retry (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
      }
    }
    throw new Error('Request failed');
  }

  async connect(credentials: ExnessCredentials): Promise<boolean> {
    try {
      console.log('🔗 ExnessAPI: Connecting to real Exness MT5 account...', {
        accountNumber: credentials.accountNumber.substring(0, 4) + '****',
        server: credentials.server,
        isDemo: credentials.isDemo
      });

      // First, test if MT5 Bridge is available
      const bridgeAvailable = await this.checkMT5BridgeAvailability();
      if (!bridgeAvailable) {
        console.error('❌ ExnessAPI: MT5 Bridge not available');
        throw new Error('MT5 Bridge service is not running. Please start the Python bridge service first.');
      }

      console.log('✅ ExnessAPI: MT5 Bridge is available, attempting connection...');

      // Connect to MT5 through the bridge with timeout and retry
      const response = await this.fetchWithTimeout(`${this.MT5_BRIDGE_URL}/mt5/connect`, {
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

      console.log('📡 ExnessAPI: MT5 Bridge response status:', response.status);

      if (!response.ok) {
        throw new Error(`MT5 Bridge connection failed: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      console.log('📊 ExnessAPI: MT5 Bridge response:', { success: result.success, hasAccountInfo: !!result.account_info });

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

        console.log('✅ ExnessAPI: Successfully connected to real Exness account:', {
          login: this.accountInfo.accountNumber,
          balance: this.accountInfo.balance,
          equity: this.accountInfo.equity,
          currency: this.accountInfo.currency,
          server: this.accountInfo.server,
          isDemo: this.accountInfo.isDemo,
          sessionId: this.sessionId ? 'SET' : 'NOT SET',
          isConnected: this.isConnected
        });

        console.log('🔍 ExnessAPI: Current connection state:', {
          isConnected: this.isConnected,
          hasSessionId: !!this.sessionId,
          hasAccountInfo: !!this.accountInfo,
          isConnectedToExness: this.isConnectedToExness()
        });

        return true;
      } else {
        console.error('❌ ExnessAPI: Connection failed -', result.error || 'Unknown error');
        throw new Error(result.error || 'Connection failed');
      }
    } catch (error) {
      console.error('❌ ExnessAPI: Failed to connect to Exness:', error);
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
    const margin = parseFloat(mt5Info.margin?.toString() || '0');
    const equity = parseFloat(mt5Info.equity?.toString() || '0');
    
    // Calculate margin level safely - handle division by zero for demo accounts
    let marginLevel = parseFloat(mt5Info.margin_level?.toString() || '0');
    if (marginLevel === 0 && margin === 0 && equity > 0) {
      // Demo account with no margin used - set to a high safe value
      marginLevel = 99999; // Effectively unlimited margin for demo
    }
    
    return {
      accountNumber: mt5Info.login?.toString() || '',
      balance: parseFloat(mt5Info.balance?.toString() || '0'),
      equity,
      margin,
      freeMargin: parseFloat(mt5Info.free_margin?.toString() || '0'),
      marginLevel,
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
        const accountInfo = this.mapMT5AccountInfo(result.account_info);
        
        return {
          success: true,
          message: `Connection test successful! Connected to ${accountInfo.isDemo ? 'DEMO' : 'LIVE'} account.`,
          accountInfo,
          connectionType: accountInfo.isDemo ? 'demo' : 'live'
        };
      } else {
        return {
          success: false,
          message: result.error || 'Connection test failed'
        };
      }
    } catch (error) {
      console.error('Connection test error:', error);
      return {
        success: false,
        message: `Connection test failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  async getAccountInfo(): Promise<AccountInfo | null> {
    if (!this.isConnected || !this.sessionId) {
      console.warn('Not connected to Exness - cannot get account info');
      return null;
    }

    try {
      const response = await fetch(`${this.MT5_BRIDGE_URL}/mt5/account_info`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          session_id: this.sessionId
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to get account info: ${response.status}`);
      }

      const result = await response.json();
      
      if (result.success && result.data) {
        this.accountInfo = this.mapMT5AccountInfo(result.data);
        this.lastUpdate = new Date();
        return this.accountInfo;
      } else {
        throw new Error(result.error || 'Failed to get account info');
      }
    } catch (error) {
      console.error('Failed to get real account info:', error);
      return null;
    }
  }

  async placeOrder(order: TradeOrder): Promise<string | null> {
    if (!this.isConnected || !this.sessionId) {
      throw new Error('Not connected to Exness');
    }

    try {
      console.log('📈 Placing REAL order on Exness MT5:', {
        symbol: order.symbol,
        type: order.type,
        volume: order.volume,
        stopLoss: order.stopLoss,
        takeProfit: order.takeProfit
      });

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
          comment: order.comment || 'ForexPro Order'
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Order placement failed: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      
      if (result.success && result.data) {
        console.log('🎉 REAL order placed successfully on Exness:', {
          ticket: result.data.ticket,
          symbol: result.data.symbol,
          type: result.data.type === 0 ? 'BUY' : 'SELL',
          volume: result.data.volume,
          price: result.data.price
        });
        return result.data.ticket.toString();
      } else {
        throw new Error(result.error || 'Order placement failed');
      }
    } catch (error) {
      console.error('❌ Failed to place REAL order on Exness:', error);
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
    if (!this.isConnected || !this.sessionId) {
      return null;
    }

    try {
      // Get REAL market price from MT5 Bridge
      const response = await fetch(`${this.MT5_BRIDGE_URL}/mt5/symbol_price`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          session_id: this.sessionId,
          symbol: symbol
        })
      });

      if (!response.ok) {
        return null;
      }

      const result = await response.json();
      
      if (result.success && result.data) {
        return {
          symbol,
          bid: parseFloat(result.data.bid),
          ask: parseFloat(result.data.ask),
          spread: parseFloat(result.data.ask) - parseFloat(result.data.bid),
          timestamp: new Date()
        };
      }

      return null;
    } catch (error) {
      return null;
    }
  }

  async closePosition(ticket: number): Promise<boolean> {
    if (!this.isConnected || !this.sessionId) {
      console.error('Cannot close position - not connected to Exness');
      return false;
    }

    try {
      console.log('🔒 Closing REAL position via MT5 Bridge:', ticket);
      
      // Close position through REAL MT5 Bridge
      const response = await fetch(`${this.MT5_BRIDGE_URL}/mt5/close_position`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          session_id: this.sessionId,
          ticket: ticket
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to close position: ${response.status}`);
      }

      const result = await response.json();
      
      if (result.success) {
        console.log('✅ REAL position closed successfully:', result);
        return true;
      } else {
        console.error('❌ Failed to close position:', result.error);
        return false;
      }
    } catch (error) {
      console.error('❌ Failed to close REAL position:', error);
      return false;
    }
  }

  async isMarketOpen(symbol: string): Promise<boolean> {
    const now = new Date();
    const dayOfWeek = now.getDay();
    
    // Forex market is closed on weekends
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      return false;
    }
    
    // Simplified market hours check
    return true;
  }

  async verifyTradingCapabilities(): Promise<{canTrade: boolean, issues: string[]}> {
    const issues: string[] = [];
    
    if (!this.isConnected) {
      issues.push('Not connected to Exness');
    }
    
    if (!this.accountInfo) {
      issues.push('No account information available');
    } else {
      if (!this.accountInfo.tradeAllowed) {
        issues.push('Trading not allowed on this account');
      }
      
      if (this.accountInfo.balance < 100) {
        issues.push('Account balance too low');
      }
      
      const minMarginLevel = this.accountInfo.isDemo ? 50 : 200;
      if (this.accountInfo.marginLevel > 0 && this.accountInfo.marginLevel < minMarginLevel) {
        issues.push(`Margin level too low (${this.accountInfo.marginLevel.toFixed(1)}% < ${minMarginLevel}%)`);
      }
    }

    return {
      canTrade: issues.length === 0,
      issues
    };
  }

  async getServerTime(): Promise<Date | null> {
    try {
      // In real implementation, get from MT5 Bridge
      return new Date();
    } catch (error) {
      console.error('Failed to get server time:', error);
      return null;
    }
  }

  isConnectedToExness(): boolean {
    return this.isConnected && this.sessionId !== null;
  }

  getAccountType(): string | null {
    return this.accountInfo?.isDemo ? 'demo' : 'live';
  }

  getConnectionStatus(): string {
    if (!this.isConnected) return 'Disconnected';
    return 'Connected to MT5';
  }

  getConnectionInfo(): any {
    return this.connectionInfo;
  }

  /**
   * Get historical price data from MT5 for technical analysis
   * @param symbol Trading symbol (e.g., 'EURUSD')
   * @param timeframe MT5 timeframe (1=M1, 5=M5, 15=M15, 60=H1, 240=H4, 1440=D1)
   * @param count Number of bars to fetch
   * @returns Historical bars with OHLCV data
   */
  async getHistoricalData(symbol: string, timeframe: number = 60, count: number = 200): Promise<any[] | null> {
    if (!this.isConnected || !this.sessionId) {
      console.warn('⚠️ Not connected to MT5, cannot fetch historical data');
      return null;
    }

    try {
      const response = await this.fetchWithTimeout(
        `${this.MT5_BRIDGE_URL}/mt5/historical_data`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            session_id: this.sessionId,
            symbol: symbol,
            timeframe: timeframe,
            count: count
          })
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to get historical data: ${response.status}`);
      }

      const result = await response.json();

      if (result.success && result.data && result.data.bars) {
        console.log(`✅ Fetched ${result.data.bars.length} historical bars for ${symbol}`);
        return result.data.bars;
      } else {
        console.error('Failed to get historical data:', result.error);
        return null;
      }
    } catch (error) {
      console.error('Failed to fetch historical data:', error);
      return null;
    }
  }

  disconnect(): void {
    this.isConnected = false;
    this.sessionId = null;
    this.accountInfo = null;
    this.connectionInfo = null;
    console.log('🔌 Disconnected from Exness');
  }
}

export const exnessAPI = new ExnessAPI();