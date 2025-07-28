import { supabase } from '@/integrations/supabase/client';

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
  price?: number;
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
}

export interface Position {
  ticket: number;
  symbol: string;
  type: 'BUY' | 'SELL';
  volume: number;
  openPrice: number;
  currentPrice: number;
  stopLoss: number;
  takeProfit: number;
  profit: number;
  swap: number;
  commission: number;
  openTime: Date;
}

class ExnessAPI {
  private credentials: ExnessCredentials | null = null;
  private isConnected = false;
  private websocket: WebSocket | null = null;
  private accountInfo: AccountInfo | null = null;

  async connect(credentials: ExnessCredentials): Promise<boolean> {
    try {
      // Store encrypted credentials in Supabase
      await this.storeCredentials(credentials);
      
      // Simulate MT5 connection (in real implementation, this would connect to MT5 WebAPI)
      this.credentials = credentials;
      this.isConnected = true;
      
      // Initialize WebSocket for real-time data
      await this.initializeWebSocket();
      
      // Get initial account info
      await this.updateAccountInfo();
      
      return true;
    } catch (error) {
      console.error('Failed to connect to Exness:', error);
      return false;
    }
  }

  private async storeCredentials(credentials: ExnessCredentials): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    // In a real implementation, encrypt these before storing
    const { error } = await supabase
      .from('api_keys')
      .upsert({
        user_id: user.id,
        broker_name: 'Exness',
        api_key_encrypted: btoa(credentials.accountNumber), // Simple encoding - use proper encryption in production
        api_secret_encrypted: btoa(credentials.password),
        account_number: credentials.accountNumber,
        server_name: credentials.server,
        is_demo: credentials.isDemo,
        is_active: true
      });

    if (error) throw error;
  }

  private async initializeWebSocket(): Promise<void> {
    // Simulate WebSocket connection for real-time data
    // In real implementation, connect to Exness WebSocket API
    return new Promise((resolve) => {
      setTimeout(() => {
        console.log('WebSocket connected for real-time data');
        this.startPriceUpdates();
        resolve();
      }, 1000);
    });
  }

  private startPriceUpdates(): void {
    // Simulate real-time price updates
    const symbols = ['EURUSD', 'GBPUSD', 'USDJPY', 'AUDUSD', 'USDCHF', 'NZDUSD'];
    
    setInterval(() => {
      symbols.forEach(symbol => {
        const basePrice = this.getBasePrice(symbol);
        const bid = basePrice + (Math.random() - 0.5) * 0.001;
        const ask = bid + 0.00015; // Typical spread
        
        this.updateMarketData(symbol, bid, ask);
      });
    }, 1000);
  }

  private getBasePrice(symbol: string): number {
    const basePrices: Record<string, number> = {
      'EURUSD': 1.0845,
      'GBPUSD': 1.2734,
      'USDJPY': 149.85,
      'AUDUSD': 0.6623,
      'USDCHF': 0.8892,
      'NZDUSD': 0.5987
    };
    return basePrices[symbol] || 1.0000;
  }

  private async updateMarketData(symbol: string, bid: number, ask: number): Promise<void> {
    try {
      const { error } = await supabase.rpc('update_market_data', {
        p_symbol: symbol,
        p_bid: bid,
        p_ask: ask,
        p_volume: Math.floor(Math.random() * 1000000)
      });

      if (error) console.error('Failed to update market data:', error);
    } catch (error) {
      console.error('Market data update error:', error);
    }
  }

  async getAccountInfo(): Promise<AccountInfo | null> {
    if (!this.isConnected) return null;

    // Simulate getting account info from MT5
    this.accountInfo = {
      balance: 10000 + Math.random() * 5000,
      equity: 10245.67 + Math.random() * 1000,
      margin: 234.56 + Math.random() * 100,
      freeMargin: 10011.11 + Math.random() * 1000,
      marginLevel: 450.5 + Math.random() * 50,
      currency: 'USD',
      leverage: '1:500',
      profit: 245.67 + (Math.random() - 0.5) * 500
    };

    return this.accountInfo;
  }

  private async updateAccountInfo(): Promise<void> {
    const accountInfo = await this.getAccountInfo();
    if (!accountInfo) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Update trading account in database
    const { error } = await supabase
      .from('trading_accounts')
      .upsert({
        user_id: user.id,
        account_number: this.credentials?.accountNumber,
        broker_name: 'Exness',
        account_type: this.credentials?.isDemo ? 'demo' : 'live',
        balance: accountInfo.balance,
        equity: accountInfo.equity,
        margin: accountInfo.margin,
        free_margin: accountInfo.freeMargin,
        margin_level: accountInfo.marginLevel,
        currency: accountInfo.currency,
        leverage: accountInfo.leverage,
        last_sync: new Date().toISOString(),
        is_active: true
      });

    if (error) console.error('Failed to update account info:', error);
  }

  async placeOrder(order: TradeOrder): Promise<string | null> {
    if (!this.isConnected) {
      throw new Error('Not connected to Exness');
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Get currency pair ID
      const { data: pair } = await supabase
        .from('currency_pairs')
        .select('id')
        .eq('symbol', order.symbol)
        .single();

      if (!pair) throw new Error('Currency pair not found');

      // Get account ID
      const { data: account } = await supabase
        .from('trading_accounts')
        .select('id')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .single();

      if (!account) throw new Error('No active trading account found');

      // Execute trade order using RPC function
      const { data: orderId, error } = await supabase.rpc('execute_trade_order', {
        p_user_id: user.id,
        p_account_id: account.id,
        p_pair_id: pair.id,
        p_order_type: 'MARKET',
        p_trade_type: order.type,
        p_lot_size: order.volume,
        p_price: order.price,
        p_stop_loss: order.stopLoss,
        p_take_profit: order.takeProfit
      });

      if (error) throw error;

      // Simulate order execution
      const executionPrice = order.price || this.getBasePrice(order.symbol);
      
      // Create live trade record
      const { error: tradeError } = await supabase
        .from('live_trades')
        .insert({
          user_id: user.id,
          account_id: account.id,
          pair_id: pair.id,
          trade_type: order.type,
          lot_size: order.volume,
          entry_price: executionPrice,
          current_price: executionPrice,
          stop_loss: order.stopLoss,
          take_profit: order.takeProfit,
          status: 'OPEN',
          broker_trade_id: `EX${Date.now()}`
        });

      if (tradeError) throw tradeError;

      return orderId;
    } catch (error) {
      console.error('Failed to place order:', error);
      throw error;
    }
  }

  async getPositions(): Promise<Position[]> {
    if (!this.isConnected) return [];

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data: trades, error } = await supabase
        .from('live_trades')
        .select(`
          *,
          currency_pairs(symbol)
        `)
        .eq('user_id', user.id)
        .eq('status', 'OPEN');

      if (error) throw error;

      return trades.map(trade => ({
        ticket: parseInt(trade.broker_trade_id?.replace('EX', '') || '0'),
        symbol: trade.currency_pairs?.symbol || '',
        type: trade.trade_type as 'BUY' | 'SELL',
        volume: parseFloat(trade.lot_size.toString()),
        openPrice: parseFloat(trade.entry_price.toString()),
        currentPrice: parseFloat(trade.current_price?.toString() || trade.entry_price.toString()),
        stopLoss: parseFloat(trade.stop_loss?.toString() || '0'),
        takeProfit: parseFloat(trade.take_profit?.toString() || '0'),
        profit: parseFloat(trade.profit?.toString() || '0'),
        swap: parseFloat(trade.swap?.toString() || '0'),
        commission: parseFloat(trade.commission?.toString() || '0'),
        openTime: new Date(trade.opened_at || trade.created_at)
      }));
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
        .eq('user_id', user.id)
        .eq('broker_trade_id', `EX${ticket}`);

      return !error;
    } catch (error) {
      console.error('Failed to close position:', error);
      return false;
    }
  }

  async disconnect(): Promise<void> {
    this.isConnected = false;
    this.credentials = null;
    this.accountInfo = null;
    
    if (this.websocket) {
      this.websocket.close();
      this.websocket = null;
    }
  }

  isConnectedToExness(): boolean {
    return this.isConnected;
  }

  getConnectionStatus(): string {
    return this.isConnected ? 'Connected' : 'Disconnected';
  }
}

export const exnessAPI = new ExnessAPI();