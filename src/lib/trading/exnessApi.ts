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

class ExnessAPI {
  private isConnected: boolean = false;
  private credentials: ExnessCredentials | null = null;
  private webSocket: WebSocket | null = null;
  private accountInfo: AccountInfo = {
    balance: 0,
    equity: 0,
    margin: 0,
    freeMargin: 0,
    marginLevel: 0
  };

  async connect(credentials: ExnessCredentials): Promise<boolean> {
    try {
      console.log('Attempting to connect to Exness with:', {
        accountNumber: credentials.accountNumber,
        server: credentials.server,
        isDemo: credentials.isDemo
      });

      // Basic validation
      if (!credentials.accountNumber || !credentials.password) {
        throw new Error('Account number and password are required');
      }

      // Simple validation for demo purposes
      if (credentials.accountNumber.length < 5) {
        throw new Error('Invalid account number format');
      }

      if (credentials.password.length < 4) {
        throw new Error('Password too short');
      }

      // Store credentials and simulate connection
      this.credentials = credentials;
      this.isConnected = true;
      
      // Initialize with real account values for demo
      this.accountInfo = {
        balance: credentials.isDemo ? 10000 : 25000, // Realistic demo vs live amounts
        equity: credentials.isDemo ? 10245.67 : 25123.45,
        margin: credentials.isDemo ? 234.56 : 567.89,
        freeMargin: credentials.isDemo ? 10011.11 : 24555.56,
        marginLevel: credentials.isDemo ? 4273.5 : 4398.2
      };

      // Initialize WebSocket simulation
      this.initializeWebSocket();
      
      // Update account info in database
      await this.updateAccountInfo();

      console.log('Successfully connected to Exness (simulated)');
      return true;
    } catch (error) {
      console.error('Failed to connect to Exness:', error);
      this.isConnected = false;
      return false;
    }
  }

  private initializeWebSocket(): void {
    console.log('Initializing WebSocket connection (simulated)');
    this.startPriceUpdates();
  }

  private startPriceUpdates(): void {
    // Simulate real-time price updates
    const symbols = ['EURUSD', 'GBPUSD', 'USDJPY', 'AUDUSD', 'USDCHF', 'NZDUSD'];
    
    setInterval(() => {
      const symbol = symbols[Math.floor(Math.random() * symbols.length)];
      const basePrice = symbol.includes('JPY') ? 150 : 1.0;
      const variation = (Math.random() - 0.5) * 0.001;
      const bid = basePrice + variation;
      const ask = bid + 0.0002;

      console.log(`Price update: ${symbol} - Bid: ${bid}, Ask: ${ask}`);
    }, 2000);
  }

  async getAccountInfo(): Promise<AccountInfo> {
    return this.accountInfo;
  }

  async updateAccountInfo(): Promise<void> {
    if (!this.isConnected) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const accountData = {
        user_id: user.id,
        account_number: this.credentials?.accountNumber || '',
        server: this.credentials?.server || '',
        balance: this.accountInfo.balance,
        equity: this.accountInfo.equity,
        margin: this.accountInfo.margin,
        free_margin: this.accountInfo.freeMargin,
        margin_level: this.accountInfo.marginLevel,
        currency: 'USD',
        leverage: '1:500',
        is_active: true,
        is_demo: this.credentials?.isDemo || false
      };

      const { error } = await supabase
        .from('trading_accounts')
        .upsert(accountData);

      if (error) throw error;
    } catch (error) {
      console.error('Failed to update account info:', error);
    }
  }

  async placeOrder(order: TradeOrder): Promise<string | null> {
    if (!this.isConnected) {
      throw new Error('Not connected to Exness');
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Generate a mock trade ticket
      const mockTicket = Date.now().toString();

      // Store trade record in database
      const { error: insertError } = await supabase
        .from('live_trades')
        .insert({
          user_id: user.id,
          symbol: order.symbol,
          trade_type: order.type,
          lot_size: order.volume,
          entry_price: order.price,
          stop_loss: order.stopLoss,
          take_profit: order.takeProfit,
          status: 'OPEN',
          ticket_id: mockTicket,
          opened_at: new Date().toISOString()
        });

      if (insertError) {
        console.error('Failed to store trade record:', insertError);
      }

      return mockTicket;
    } catch (error) {
      console.error('Failed to place order:', error);
      throw error;
    }
  }

  async getPositions(): Promise<Position[]> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data: trades, error } = await supabase
        .from('live_trades')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'OPEN');

      if (error) throw error;

      return trades?.map(trade => ({
        ticket: parseInt(trade.ticket_id || '0'),
        symbol: trade.symbol,
        type: trade.trade_type,
        volume: parseFloat(trade.lot_size?.toString() || '0'),
        openPrice: parseFloat(trade.entry_price?.toString() || '0'),
        currentPrice: parseFloat(trade.current_price?.toString() || trade.entry_price?.toString() || '0'),
        profit: parseFloat(trade.profit?.toString() || '0'),
        swap: parseFloat(trade.swap?.toString() || '0'),
        commission: parseFloat(trade.commission?.toString() || '0'),
        openTime: new Date(trade.opened_at),
        stopLoss: trade.stop_loss ? parseFloat(trade.stop_loss.toString()) : undefined,
        takeProfit: trade.take_profit ? parseFloat(trade.take_profit.toString()) : undefined,
        comment: '',
        ticketId: trade.ticket_id || ''
      })) || [];
    } catch (error) {
      console.error('Failed to get positions:', error);
      return [];
    }
  }

  async closePosition(ticket: number): Promise<boolean> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;

      const { error } = await supabase
        .from('live_trades')
        .update({
          status: 'CLOSED',
          closed_at: new Date().toISOString()
        })
        .eq('ticket_id', ticket.toString())
        .eq('user_id', user.id);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Failed to close position:', error);
      return false;
    }
  }

  disconnect(): void {
    this.isConnected = false;
    this.credentials = null;
    if (this.webSocket) {
      this.webSocket.close();
      this.webSocket = null;
    }
    console.log('Disconnected from Exness');
  }

  isConnectedToExness(): boolean {
    return this.isConnected;
  }

  getConnectionStatus(): string {
    return this.isConnected ? 'Connected' : 'Disconnected';
  }
}

export const exnessAPI = new ExnessAPI();