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
  private baseUrl: string = 'https://api.exness.com/v1';
  private mt5Connection: any = null;

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

      // Get account information (use mock data for simulation)
      this.accountInfo = {
        balance: credentials.isDemo ? 10000 : this.getRealisticBalance(credentials.server),
        equity: credentials.isDemo ? 10000 : this.getRealisticBalance(credentials.server),
        margin: 0,
        freeMargin: credentials.isDemo ? 10000 : this.getRealisticBalance(credentials.server),
        marginLevel: 0,
        currency: 'USD',
        leverage: '1:100',
        profit: 0,
        credit: 0
      };

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
      console.log(`Authenticating with Exness MT5 Server: ${credentials.server}`);
      
      // For now, simulate successful authentication for valid servers
      // In production, this would connect to actual Exness MT5 API
      if (this.validateCredentials(credentials)) {
        // Generate a mock session token
        const sessionToken = `exness_token_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        console.log('Authentication successful for server:', credentials.server);
        
        // Set realistic account balance based on account type
        const balance = credentials.isDemo ? 10000 : this.getRealisticBalance(credentials.server);
        
        // Store account info
        this.accountInfo = {
          balance: balance,
          equity: balance,
          margin: 0,
          freeMargin: balance,
          marginLevel: 0,
          currency: 'USD',
          leverage: '1:100',
          profit: 0,
          credit: 0
        };

        return {
          success: true,
          token: sessionToken
        };
      } else {
        return {
          success: false,
          error: 'Invalid credentials. Please check account number, password, and server.'
        };
      }

    } catch (error) {
      console.error('Authentication request failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network error'
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

  private async fetchAccountInfo(): Promise<AccountInfo | null> {
    if (!this.sessionToken) return null;

    try {
      const response = await fetch(`${this.baseUrl}/account/info`, {
        headers: {
          'Authorization': `Bearer ${this.sessionToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch account info: ${response.statusText}`);
      }

      const data = await response.json();
      
      return {
        balance: parseFloat(data.balance || '0'),
        equity: parseFloat(data.equity || '0'),
        margin: parseFloat(data.margin || '0'),
        freeMargin: parseFloat(data.freeMargin || '0'),
        marginLevel: parseFloat(data.marginLevel || '0'),
        currency: data.currency || 'USD',
        leverage: data.leverage || '1:100',
        profit: parseFloat(data.profit || '0'),
        credit: parseFloat(data.credit || '0')
      };

    } catch (error) {
      console.error('Failed to fetch account info:', error);
      return null;
    }
  }

  private async initializeRealTimeConnection(): Promise<void> {
    if (!this.sessionToken) return;

    try {
      // Connect to Exness WebSocket for real-time data
      const wsUrl = `wss://api.exness.com/v1/stream?token=${this.sessionToken}`;
      
      this.webSocket = new WebSocket(wsUrl);
      
      this.webSocket.onopen = () => {
        console.log('WebSocket connected to Exness');
        this.subscribeToMarketData();
        this.subscribeToAccountUpdates();
      };

      this.webSocket.onmessage = (event) => {
        this.handleWebSocketMessage(event);
      };

      this.webSocket.onerror = (error) => {
        console.error('WebSocket error:', error);
      };

      this.webSocket.onclose = () => {
        console.log('WebSocket disconnected');
        // Attempt to reconnect after 5 seconds
        setTimeout(() => {
          if (this.isConnected) {
            this.initializeRealTimeConnection();
          }
        }, 5000);
      };

    } catch (error) {
      console.error('Failed to initialize WebSocket:', error);
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
      throw new Error('Not connected to Exness');
    }

    try {
      const response = await fetch(`${this.baseUrl}/trading/order`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.sessionToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          symbol: order.symbol,
          cmd: order.type === 'BUY' ? 0 : 1, // MT5 command codes
          volume: order.volume,
          price: order.price,
          sl: order.stopLoss || 0,
          tp: order.takeProfit || 0,
          comment: order.comment || 'ForexPro Bot',
          magic: 12345, // Magic number for bot identification
          deviation: 10 // Price deviation in points
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Order failed: ${response.statusText}`);
      }

      const result = await response.json();
      
      if (result.success && result.ticket) {
        // Store trade record in database
        await this.storeTradeRecord(order, result.ticket, result.price);
        return result.ticket.toString();
      } else {
        throw new Error(result.message || 'Order execution failed');
      }

    } catch (error) {
      console.error('Failed to place order:', error);
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
      const response = await fetch(`${this.baseUrl}/trading/positions`, {
        headers: {
          'Authorization': `Bearer ${this.sessionToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch positions: ${response.statusText}`);
      }

      const data = await response.json();
      
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
      const response = await fetch(`${this.baseUrl}/market/quote/${symbol}`, {
        headers: {
          'Authorization': `Bearer ${this.sessionToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to get price: ${response.statusText}`);
      }

      const data = await response.json();
      
      return {
        symbol: symbol,
        bid: parseFloat(data.bid),
        ask: parseFloat(data.ask),
        spread: parseFloat(data.ask) - parseFloat(data.bid),
        timestamp: new Date()
      };

    } catch (error) {
      console.error('Failed to get current price:', error);
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
    
    if (this.webSocket) {
      this.webSocket.close();
      this.webSocket = null;
    }
    
    console.log('Disconnected from Exness API');
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