import { supabase } from '@/integrations/supabase/client';

// Interface definitions
export interface ExnessCredentials {
  accountNumber: string;
  password: string;
  server: string;
  isDemo: boolean;
}

export interface TradeOrder {
  symbol: string;
  type: 'BUY' | 'SELL';
  volume: number;
  price: number;
  stopLoss?: number;
  takeProfit?: number;
  comment?: string;
}

export interface AccountInfo {
  balance: number;
  equity: number;
  margin: number;
  freeMargin: number;
  marginLevel: number;
  currency: string;
  leverage: string;
  profit: number;
  credit: number;
}

export interface Position {
  ticket: number;
  symbol: string;
  type: string;
  volume: number;
  openPrice: number;
  currentPrice: number;
  profit: number;
  swap: number;
  commission: number;
  openTime: Date;
  stopLoss?: number;
  takeProfit?: number;
  comment: string;
  ticketId: string;
}

export interface MarketPrice {
  symbol: string;
  bid: number;
  ask: number;
  spread: number;
  timestamp: Date;
}

class ExnessAPI {
  private isConnected: boolean = false;
  private credentials: ExnessCredentials | null = null;
  private webSocket: WebSocket | null = null;
  private accountInfo: AccountInfo | null = null;
  private sessionToken: string | null = null;
  private baseUrl: string = 'https://mt5-api.exness.com/v1';
  private webApiUrl: string = 'https://my.exness.com/api/v1';
  private mt5Connection: any = null;
  private heartbeatInterval: NodeJS.Timeout | null = null;

  async connect(credentials: ExnessCredentials): Promise<boolean> {
    try {
      console.log('Connecting to Exness API with credentials:', {
        accountNumber: credentials.accountNumber,
        server: credentials.server,
        isDemo: credentials.isDemo
      });

      // First validate credentials with test connection
      const testResult = await this.testConnection(credentials);
      if (!testResult.success) {
        console.error('Connection failed validation:', testResult.message);
        return false;
      }

      // Validate credentials format
      if (!this.validateCredentials(credentials)) {
        throw new Error('Invalid credentials format');
      }

      // Attempt to authenticate with Exness API
      const authResult = await this.authenticateWithExness(credentials);
      
      if (!authResult.success) {
        throw new Error(authResult.error || 'Authentication failed');
      }

      this.credentials = credentials;
      this.sessionToken = authResult.token;
      this.isConnected = true;

      // Get real account information from Exness API
      const accountInfo = await this.fetchRealAccountInfo();
      if (!accountInfo) {
        throw new Error('Failed to fetch real account information from Exness');
      }
      
      this.accountInfo = accountInfo;
      console.log('Loaded real Exness account info:', this.accountInfo);

      // Initialize real-time data feed
      await this.initializeRealTimeConnection();
      
      // Store encrypted credentials in database
      await this.storeCredentials(credentials);
      
      // Update account info in database
      await this.updateAccountInfo();

      console.log('Successfully connected to Exness API');
      return true;

    } catch (error) {
      console.error('Failed to connect to Exness:', error);
      this.isConnected = false;
      this.sessionToken = null;
      throw error;
    }
  }

  private validateCredentials(credentials: ExnessCredentials): boolean {
    // Validate for specific Exness MT5 servers
    const validServers = [
      'ExnessKE-MT5Trial10',
      'ExnessKE-MT5Trial01',
      'ExnessKE-MT5Trial02',
      'ExnessKE-MT5Trial03',
      'ExnessKE-MT5Trial04',
      'ExnessKE-MT5Trial05',
      'ExnessKE-MT5Real01',
      'ExnessKE-MT5Real02',
      'ExnessKE-MT5Real03',
      'ExnessKE-MT5Real04',
      'ExnessKE-MT5Real05',
      'ExnessServer-MT5',
      'ExnessServer-Real',
      'ExnessServer-Demo'
    ];

    const isServerValid = validServers.includes(credentials.server);
    const isAccountValid = /^\d{8,12}$/.test(credentials.accountNumber); // 8-12 digits
    const isPasswordValid = credentials.password.length >= 6;

    console.log('Validation details:', {
      server: credentials.server,
      isServerValid,
      isAccountValid,
      isPasswordValid
    });

    return isServerValid && isAccountValid && isPasswordValid;
  }

  private async authenticateWithExness(credentials: ExnessCredentials): Promise<{success: boolean, token?: string, error?: string}> {
    try {
      console.log(`Authenticating with real Exness MT5 Server: ${credentials.server}`);
      
      if (!this.validateCredentials(credentials)) {
        return {
          success: false,
          error: 'Invalid credentials format. Please check account number, password, and server.'
        };
      }

      // Real Exness API authentication
      const authPayload = {
        login: credentials.accountNumber,
        password: credentials.password,
        server: credentials.server,
        demo: credentials.isDemo
      };

      const response = await fetch(`${this.baseUrl}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'ForexPro-Bot/1.0'
        },
        body: JSON.stringify(authPayload)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Authentication failed:', response.status, errorText);
        return {
          success: false,
          error: `Authentication failed: ${response.status} - ${errorText}`
        };
      }

      const authResult = await response.json();
      
      if (authResult.success && authResult.token) {
        console.log('Real Exness authentication successful');
        return {
          success: true,
          token: authResult.token
        };
      } else {
        return {
          success: false,
          error: authResult.error || 'Authentication failed - invalid response from server'
        };
      }

    } catch (error) {
      console.error('Authentication request failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network connection error'
      };
    }
  }

  private getRealisticBalance(server: string): number {
    // Return different balances based on server type
    if (server.includes('Trial')) {
      return 10000; // Demo accounts typically start with $10,000
    } else if (server.includes('Real')) {
      // Real accounts vary, but we'll simulate different amounts
      const amounts = [500, 1000, 2500, 5000, 10000];
      return amounts[Math.floor(Math.random() * amounts.length)];
    }
    return 1000; // Default amount
  }

  private async fetchRealAccountInfo(): Promise<AccountInfo | null> {
    if (!this.sessionToken) return null;

    try {
      // Use real Exness API endpoint for account information
      const response = await fetch(`${this.baseUrl}/trading/account`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.sessionToken}`,
          'Content-Type': 'application/json',
          'User-Agent': 'ForexPro-Bot/1.0'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch real account info: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to get account information');
      }

      const account = data.account;
      
      return {
        balance: parseFloat(account.balance || '0'),
        equity: parseFloat(account.equity || '0'),
        margin: parseFloat(account.margin || '0'),
        freeMargin: parseFloat(account.free_margin || account.freeMargin || '0'),
        marginLevel: parseFloat(account.margin_level || account.marginLevel || '0'),
        currency: account.currency || 'USD',
        leverage: account.leverage || '1:100',
        profit: parseFloat(account.profit || '0'),
        credit: parseFloat(account.credit || '0')
      };

    } catch (error) {
      console.error('Failed to fetch real account info:', error);
      return null;
    }
  }

  private async fetchAccountInfo(): Promise<AccountInfo | null> {
    return this.fetchRealAccountInfo();
  }

  private async initializeRealTimeConnection(): Promise<void> {
    if (!this.sessionToken) return;

    try {
      // Connect to real Exness MT5 WebSocket for live data
      const wsUrl = `wss://mt5-stream.exness.com/quotes?token=${this.sessionToken}`;
      
      this.webSocket = new WebSocket(wsUrl);
      
      this.webSocket.onopen = () => {
        console.log('Real-time WebSocket connected to Exness MT5');
        this.subscribeToMarketData();
        this.subscribeToAccountUpdates();
        this.startHeartbeat();
      };

      this.webSocket.onmessage = (event) => {
        this.handleWebSocketMessage(event);
      };

      this.webSocket.onerror = (error) => {
        console.error('WebSocket error:', error);
      };

      this.webSocket.onclose = (event) => {
        console.log('WebSocket disconnected, code:', event.code);
        this.stopHeartbeat();
        
        // Attempt to reconnect after 3 seconds for real trading
        setTimeout(() => {
          if (this.isConnected) {
            console.log('Attempting to reconnect to Exness...');
            this.initializeRealTimeConnection();
          }
        }, 3000);
      };

    } catch (error) {
      console.error('Failed to initialize real-time connection:', error);
    }
  }

  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      if (this.webSocket?.readyState === WebSocket.OPEN) {
        this.webSocket.send(JSON.stringify({ action: 'ping' }));
      }
    }, 30000); // Send heartbeat every 30 seconds
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  private subscribeToMarketData(): void {
    if (!this.webSocket) return;

    const symbols = ['EURUSD', 'GBPUSD', 'USDJPY', 'AUDUSD', 'USDCHF', 'NZDUSD'];
    
    const subscribeMessage = {
      action: 'subscribe',
      type: 'quotes',
      symbols: symbols
    };

    this.webSocket.send(JSON.stringify(subscribeMessage));
  }

  private subscribeToAccountUpdates(): void {
    if (!this.webSocket) return;

    const subscribeMessage = {
      action: 'subscribe',
      type: 'account',
      events: ['balance', 'equity', 'margin', 'positions']
    };

    this.webSocket.send(JSON.stringify(subscribeMessage));
  }

  private handleWebSocketMessage(event: MessageEvent): void {
    try {
      const data = JSON.parse(event.data);
      
      switch (data.type) {
        case 'quote':
          this.handlePriceUpdate(data);
          break;
        case 'account':
          this.handleAccountUpdate(data);
          break;
        case 'position':
          this.handlePositionUpdate(data);
          break;
        default:
          console.log('Unknown message type:', data.type);
      }
    } catch (error) {
      console.error('Error parsing WebSocket message:', error);
    }
  }

  private handlePriceUpdate(data: any): void {
    // Update local price cache and notify subscribers
    console.log('Price update:', data.symbol, data.bid, data.ask);
    
    // Store in database for historical tracking
    this.storePriceData(data);
  }

  private handleAccountUpdate(data: any): void {
    if (this.accountInfo) {
      this.accountInfo = {
        ...this.accountInfo,
        balance: parseFloat(data.balance || this.accountInfo.balance),
        equity: parseFloat(data.equity || this.accountInfo.equity),
        margin: parseFloat(data.margin || this.accountInfo.margin),
        freeMargin: parseFloat(data.freeMargin || this.accountInfo.freeMargin),
        marginLevel: parseFloat(data.marginLevel || this.accountInfo.marginLevel)
      };
      
      // Update database
      this.updateAccountInfo();
    }
  }

  private handlePositionUpdate(data: any): void {
    console.log('Position update:', data);
    // Update position in database
    this.updatePositionInDatabase(data);
  }

  private async storePriceData(priceData: any): Promise<void> {
    try {
      // Store in price_data table instead since market_data types aren't available yet
      await supabase
        .from('price_data')
        .insert({
          pair_id: null, // We'll need to map symbol to pair_id later
          timestamp: new Date().toISOString(),
          open_price: parseFloat(priceData.bid),
          high_price: parseFloat(priceData.ask),
          low_price: parseFloat(priceData.bid),
          close_price: parseFloat(priceData.ask),
          volume: parseInt(priceData.volume || '0'),
          timeframe: '1m'
        });
    } catch (error) {
      console.error('Failed to store price data:', error);
    }
  }

  async getAccountInfo(): Promise<AccountInfo | null> {
    if (!this.isConnected || !this.sessionToken) {
      return null;
    }

    // Fetch fresh account info from API
    const freshAccountInfo = await this.fetchAccountInfo();
    if (freshAccountInfo) {
      this.accountInfo = freshAccountInfo;
    }

    return this.accountInfo;
  }

  async placeOrder(order: TradeOrder): Promise<string | null> {
    if (!this.isConnected || !this.sessionToken) {
      throw new Error('Not connected to Exness - please connect first');
    }

    try {
      console.log('Placing real order on Exness:', order);

      // Real Exness MT5 order placement
      const orderPayload = {
        symbol: order.symbol.replace('/', ''), // Remove slash for MT5 format (EURUSD not EUR/USD)
        cmd: order.type === 'BUY' ? 0 : 1, // MT5 command: 0=BUY, 1=SELL
        volume: order.volume,
        price: order.price,
        sl: order.stopLoss || 0,
        tp: order.takeProfit || 0,
        comment: order.comment || 'ForexPro-Bot',
        magic: 987654321, // Unique magic number for our bot
        deviation: 20, // Price deviation in points
        type_filling: 1, // FOK (Fill or Kill)
        type_time: 0 // Good Till Cancelled
      };

      const response = await fetch(`${this.baseUrl}/trading/order/send`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.sessionToken}`,
          'Content-Type': 'application/json',
          'User-Agent': 'ForexPro-Bot/1.0'
        },
        body: JSON.stringify(orderPayload)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Order failed: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      
      if (result.success && result.order) {
        console.log('Order successfully placed:', result.order);
        
        // Store trade record in database
        await this.storeTradeRecord(order, result.order.ticket, result.order.price);
        
        return result.order.ticket.toString();
      } else {
        const errorMsg = result.error || result.description || 'Order execution failed';
        throw new Error(`Order rejected: ${errorMsg}`);
      }

    } catch (error) {
      console.error('Failed to place real order:', error);
      throw error;
    }
  }

  private async storeTradeRecord(order: TradeOrder, ticket: number, executionPrice: number): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await supabase
        .from('live_trades')
        .insert({
          user_id: user.id,
          symbol: order.symbol,
          trade_type: order.type,
          lot_size: order.volume,
          entry_price: executionPrice,
          current_price: executionPrice,
          stop_loss: order.stopLoss,
          take_profit: order.takeProfit,
          status: 'OPEN',
          ticket_id: ticket.toString(),
          opened_at: new Date().toISOString()
        });
    } catch (error) {
      console.error('Failed to store trade record:', error);
    }
  }

  async getPositions(): Promise<Position[]> {
    if (!this.isConnected || !this.sessionToken) {
      return [];
    }

    try {
      // Get real open positions from Exness MT5
      const response = await fetch(`${this.baseUrl}/trading/positions/open`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.sessionToken}`,
          'Content-Type': 'application/json',
          'User-Agent': 'ForexPro-Bot/1.0'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch real positions: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to get positions');
      }
      
      return data.positions?.map((pos: any) => ({
        ticket: parseInt(pos.ticket),
        symbol: pos.symbol,
        type: pos.cmd === 0 ? 'BUY' : 'SELL',
        volume: parseFloat(pos.volume),
        openPrice: parseFloat(pos.openPrice),
        currentPrice: parseFloat(pos.currentPrice),
        profit: parseFloat(pos.profit),
        swap: parseFloat(pos.swap || '0'),
        commission: parseFloat(pos.commission || '0'),
        openTime: new Date(pos.openTime),
        stopLoss: pos.sl ? parseFloat(pos.sl) : undefined,
        takeProfit: pos.tp ? parseFloat(pos.tp) : undefined,
        comment: pos.comment || '',
        ticketId: pos.ticket.toString()
      })) || [];

    } catch (error) {
      console.error('Failed to get positions:', error);
      return [];
    }
  }

  async closePosition(ticket: number): Promise<boolean> {
    if (!this.isConnected || !this.sessionToken) {
      return false;
    }

    try {
      const response = await fetch(`${this.baseUrl}/trading/close`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.sessionToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ticket: ticket
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to close position: ${response.statusText}`);
      }

      const result = await response.json();
      
      if (result.success) {
        // Update trade record in database
        await this.updateTradeStatus(ticket.toString(), 'CLOSED');
        return true;
      } else {
        throw new Error(result.message || 'Failed to close position');
      }

    } catch (error) {
      console.error('Failed to close position:', error);
      return false;
    }
  }

  private async updateTradeStatus(ticketId: string, status: string): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await supabase
        .from('live_trades')
        .update({
          status: status,
          closed_at: new Date().toISOString()
        })
        .eq('ticket_id', ticketId)
        .eq('user_id', user.id);
    } catch (error) {
      console.error('Failed to update trade status:', error);
    }
  }

  private async updatePositionInDatabase(positionData: any): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await supabase
        .from('live_trades')
        .update({
          current_price: parseFloat(positionData.currentPrice),
          profit: parseFloat(positionData.profit),
          swap: parseFloat(positionData.swap || '0'),
          updated_at: new Date().toISOString()
        })
        .eq('ticket_id', positionData.ticket.toString())
        .eq('user_id', user.id);
    } catch (error) {
      console.error('Failed to update position in database:', error);
    }
  }

  async getCurrentPrice(symbol: string): Promise<MarketPrice | null> {
    if (!this.isConnected || !this.sessionToken) {
      return null;
    }

    try {
      // Get real-time price from Exness MT5
      const cleanSymbol = symbol.replace('/', ''); // Remove slash for MT5
      const response = await fetch(`${this.baseUrl}/market/symbols/${cleanSymbol}/tick`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.sessionToken}`,
          'Content-Type': 'application/json',
          'User-Agent': 'ForexPro-Bot/1.0'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to get real price: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to get price data');
      }

      const tick = data.tick;
      
      return {
        symbol: symbol,
        bid: parseFloat(tick.bid),
        ask: parseFloat(tick.ask),
        spread: parseFloat(tick.ask) - parseFloat(tick.bid),
        timestamp: new Date(tick.time * 1000) // Convert Unix timestamp
      };

    } catch (error) {
      console.error('Failed to get real current price:', error);
      return null;
    }
  }

  private async storeCredentials(credentials: ExnessCredentials): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Check if account already exists
      const { data: existingAccount } = await supabase
        .from('trading_accounts')
        .select('id')
        .eq('user_id', user.id)
        .eq('account_number', credentials.accountNumber)
        .single();

      if (existingAccount) {
        // Update existing account
        await supabase
          .from('trading_accounts')
          .update({
            server: credentials.server,
            is_demo: credentials.isDemo,
            is_active: true,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingAccount.id);
      } else {
        // Create new account
        await supabase
          .from('trading_accounts')
          .insert({
            user_id: user.id,
            account_number: credentials.accountNumber,
            server: credentials.server,
            is_demo: credentials.isDemo,
            is_active: true
          });
      }
    } catch (error) {
      console.error('Failed to store credentials:', error);
    }
  }

  private async updateAccountInfo(): Promise<void> {
    if (!this.isConnected || !this.accountInfo) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await supabase
        .from('trading_accounts')
        .update({
          balance: this.accountInfo.balance,
          equity: this.accountInfo.equity,
          margin: this.accountInfo.margin,
          free_margin: this.accountInfo.freeMargin,
          margin_level: this.accountInfo.marginLevel,
          currency: this.accountInfo.currency,
          leverage: this.accountInfo.leverage,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', user.id)
        .eq('is_active', true);

    } catch (error) {
      console.error('Failed to update account info:', error);
    }
  }

  disconnect(): void {
    this.isConnected = false;
    this.credentials = null;
    this.sessionToken = null;
    this.accountInfo = null;
    
    this.stopHeartbeat();
    
    if (this.webSocket) {
      this.webSocket.close();
      this.webSocket = null;
    }
    
    console.log('Disconnected from real Exness API');
  }

  isConnectedToExness(): boolean {
    return this.isConnected && this.sessionToken !== null;
  }

  getConnectionStatus(): string {
    if (!this.isConnected) return 'Disconnected';
    if (this.webSocket?.readyState === WebSocket.OPEN) return 'Connected (Real-time)';
    return 'Connected (API Only)';
  }

  // Method to test connection without storing credentials
  async testConnection(credentials: ExnessCredentials): Promise<{success: boolean, message: string}> {
    try {
      if (!this.validateCredentials(credentials)) {
        return {
          success: false,
          message: 'Invalid credentials format. Please check account number, password, and server.'
        };
      }

      const authResult = await this.authenticateWithExness(credentials);
      
      if (authResult.success) {
        return {
          success: true,
          message: 'Connection successful! Credentials are valid.'
        };
      } else {
        return {
          success: false,
          message: authResult.error || 'Authentication failed. Please check your credentials.'
        };
      }

    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Connection test failed'
      };
    }
  }
}

export const exnessAPI = new ExnessAPI();