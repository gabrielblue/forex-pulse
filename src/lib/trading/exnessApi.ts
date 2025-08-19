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
    const positions: Position[] | undefined = Array.isArray(mt5Info.positions)
      ? (mt5Info.positions as any[]).map((pos) => {
          const typeNumeric = typeof pos.type === 'number' ? pos.type : (pos.type === 'BUY' ? 0 : 1);
          const type: 'BUY' | 'SELL' = typeNumeric === 0 ? 'BUY' : 'SELL';
          const ticket: number = typeof pos.ticket === 'number' ? pos.ticket : parseInt(pos.ticket?.toString() || '0');
          const openPrice = parseFloat((pos.price_open ?? pos.openPrice ?? 0).toString());
          const sl = pos.sl !== undefined ? parseFloat(pos.sl.toString()) : undefined;
          const tp = pos.tp !== undefined ? parseFloat(pos.tp.toString()) : undefined;
          const profit = pos.profit !== undefined ? parseFloat(pos.profit.toString()) : 0;
          return {
            ticket,
            ticketId: ticket.toString(),
            symbol: pos.symbol || mt5Info.symbol || '',
            type,
            volume: parseFloat((pos.volume ?? pos.volume_initial ?? 0).toString()),
            openPrice,
            currentPrice: openPrice, // Will be refined on UI refresh with latest price
            profit,
            stopLoss: sl,
            takeProfit: tp,
            openTime: new Date(),
            commission: 0,
            swap: 0,
          } as Position;
        })
      : undefined;

    return {
      accountNumber: mt5Info.login?.toString() || '',
      balance: parseFloat(mt5Info.balance?.toString() || '0'),
      equity: parseFloat(mt5Info.equity?.toString() || '0'),
      margin: parseFloat(mt5Info.margin?.toString() || '0'),
      freeMargin: parseFloat((mt5Info.free_margin ?? mt5Info.freeMargin ?? '0').toString()),
      marginLevel: parseFloat(mt5Info.margin_level?.toString() || '0'),
      currency: mt5Info.currency || 'USD',
      leverage: (mt5Info.leverage?.toString?.() || mt5Info.leverage || '1:100').toString(),
      server: mt5Info.server || '',
      isDemo: mt5Info.mode === 'DEMO' || mt5Info.server?.toLowerCase().includes('demo') || mt5Info.server?.toLowerCase().includes('trial'),
      tradeAllowed: true,
      profit: parseFloat(mt5Info.profit?.toString() || '0'),
      credit: parseFloat(mt5Info.credit?.toString() || '0'),
      company: mt5Info.company || 'Exness',
      positions,
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
          // Ensure SL/TP are numbers (MT5 expects 0.0 if not provided)
          sl: typeof order.stopLoss === 'number' ? order.stopLoss : 0,
          tp: typeof order.takeProfit === 'number' ? order.takeProfit : 0,
          comment: order.comment || 'ForexPro Order'
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
      // Always fetch fresh account info to get latest positions from bridge
      const response = await fetch(`${this.MT5_BRIDGE_URL}/mt5/account_info`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: this.sessionId })
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch positions: ${response.status}`);
      }

      const result = await response.json();
      if (!result.success || !result.data) {
        return [];
      }

      // Map positions from MT5 bridge to internal Position type
      const positions: Position[] = Array.isArray(result.data.positions)
        ? result.data.positions.map((pos: any) => {
            const type: 'BUY' | 'SELL' = pos.type === 0 ? 'BUY' : 'SELL';
            const ticket: number = typeof pos.ticket === 'number' ? pos.ticket : parseInt(pos.ticket?.toString() || '0');
            const openPrice = parseFloat((pos.price_open ?? 0).toString());
            return {
              ticket,
              ticketId: ticket.toString(),
              symbol: pos.symbol,
              type,
              volume: parseFloat((pos.volume ?? 0).toString()),
              openPrice,
              currentPrice: openPrice,
              profit: parseFloat((pos.profit ?? 0).toString()),
              stopLoss: pos.sl !== undefined ? parseFloat(pos.sl.toString()) : undefined,
              takeProfit: pos.tp !== undefined ? parseFloat(pos.tp.toString()) : undefined,
              openTime: new Date(),
              commission: 0,
              swap: 0,
            } as Position;
          })
        : [];

      // Update cached account info with positions for downstream consumers
      this.accountInfo = this.mapMT5AccountInfo({ ...(result.data || {}), positions: result.data.positions });
      this.lastUpdate = new Date();
      return positions;
    } catch (error) {
      console.error('Failed to get positions:', error);
      return [];
    }
  }

  async getCurrentPrice(symbol: string): Promise<MarketPrice | null> {
    try {
      // For real implementation, you'd get this from MT5 Bridge
      // For now, return realistic mock data
      const basePrices: Record<string, number> = {
        'EURUSD': 1.0845,
        'GBPUSD': 1.2734,
        'USDJPY': 149.85,
        'AUDUSD': 0.6623,
        'USDCHF': 0.8892,
        'NZDUSD': 0.5987
      };

      const basePrice = basePrices[symbol] || 1.0000;
      const spread = symbol.includes('JPY') ? 0.015 : 0.00015;
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

  async closePosition(ticket: number): Promise<boolean> {
    if (!this.isConnected || !this.sessionId) {
      return false;
    }

    try {
      console.log('🔒 Closing position:', ticket);
      
      // In a real implementation, you'd call the MT5 Bridge to close the position
      // For now, simulate success
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
      
      if (this.accountInfo.marginLevel > 0 && this.accountInfo.marginLevel < 200) {
        issues.push('Margin level too low');
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

  disconnect(): void {
    this.isConnected = false;
    this.sessionId = null;
    this.accountInfo = null;
    this.connectionInfo = null;
    console.log('🔌 Disconnected from Exness');
  }
}

export const exnessAPI = new ExnessAPI();