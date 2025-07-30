import { supabase } from '@/integrations/supabase/client';
import { realTimeDataFeed } from './realTimeDataFeed';

export interface TradeExecution {
  id: string;
  symbol: string;
  type: 'BUY' | 'SELL';
  volume: number;
  executionPrice: number;
  stopLoss?: number;
  takeProfit?: number;
  timestamp: Date;
  status: 'PENDING' | 'EXECUTED' | 'FAILED';
  errorMessage?: string;
}

export interface ExecutionRequest {
  symbol: string;
  type: 'BUY' | 'SELL';
  volume: number;
  orderType: 'MARKET' | 'LIMIT' | 'STOP';
  price?: number;
  stopLoss?: number;
  takeProfit?: number;
  comment?: string;
}

class TradeExecutor {
  private executionQueue: ExecutionRequest[] = [];
  private isProcessing = false;
  private maxSlippage = 0.0005; // 0.5 pips max slippage
  private executionDelay = 100; // 100ms execution delay simulation

  async executeOrder(request: ExecutionRequest): Promise<TradeExecution> {
    const execution: TradeExecution = {
      id: crypto.randomUUID(),
      symbol: request.symbol,
      type: request.type,
      volume: request.volume,
      executionPrice: 0,
      stopLoss: request.stopLoss,
      takeProfit: request.takeProfit,
      timestamp: new Date(),
      status: 'PENDING'
    };

    try {
      // Pre-execution validation
      await this.validateExecution(request);
      
      // Get current market price
      const marketPrice = await this.getCurrentMarketPrice(request.symbol);
      
      // Calculate execution price with slippage
      const executionPrice = this.calculateExecutionPrice(
        marketPrice, 
        request.type, 
        request.orderType,
        request.price
      );
      
      // Simulate execution delay
      await this.simulateExecutionDelay();
      
      // Execute the trade
      await this.executeTrade(request, executionPrice);
      
      execution.executionPrice = executionPrice;
      execution.status = 'EXECUTED';
      
      console.log(`Trade executed: ${request.type} ${request.volume} ${request.symbol} @ ${executionPrice}`);
      
    } catch (error) {
      execution.status = 'FAILED';
      execution.errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Trade execution failed:', error);
    }

    return execution;
  }

  private async validateExecution(request: ExecutionRequest): Promise<void> {
    // Check if market is open (simplified)
    const now = new Date();
    const dayOfWeek = now.getDay();
    const hour = now.getUTCHours();
    
    // Forex market is closed on weekends
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      throw new Error('Market is closed on weekends');
    }
    
    // Check minimum volume
    if (request.volume < 0.01) {
      throw new Error('Minimum volume is 0.01 lots');
    }
    
    // Check maximum volume
    if (request.volume > 100) {
      throw new Error('Maximum volume is 100 lots');
    }
    
    // Validate symbol
    const validSymbols = ['EURUSD', 'GBPUSD', 'USDJPY', 'AUDUSD', 'USDCHF', 'NZDUSD'];
    if (!validSymbols.includes(request.symbol)) {
      throw new Error(`Invalid symbol: ${request.symbol}`);
    }
  }

  private async getCurrentMarketPrice(symbol: string): Promise<{ bid: number; ask: number }> {
    const priceData = await realTimeDataFeed.getLatestPrice(symbol);
    
    if (!priceData) {
      throw new Error(`No market data available for ${symbol}`);
    }
    
    return {
      bid: priceData.bid,
      ask: priceData.ask
    };
  }

  private calculateExecutionPrice(
    marketPrice: { bid: number; ask: number },
    type: 'BUY' | 'SELL',
    orderType: 'MARKET' | 'LIMIT' | 'STOP',
    limitPrice?: number
  ): number {
    let basePrice: number;
    
    if (orderType === 'MARKET') {
      // Market orders execute at current market price
      basePrice = type === 'BUY' ? marketPrice.ask : marketPrice.bid;
    } else if (orderType === 'LIMIT' && limitPrice) {
      // Limit orders execute at specified price or better
      basePrice = limitPrice;
    } else if (orderType === 'STOP' && limitPrice) {
      // Stop orders execute at market price when triggered
      basePrice = type === 'BUY' ? marketPrice.ask : marketPrice.bid;
    } else {
      throw new Error('Invalid order type or missing price');
    }
    
    // Add realistic slippage for market orders
    if (orderType === 'MARKET') {
      const slippage = (Math.random() - 0.5) * this.maxSlippage;
      basePrice += slippage;
    }
    
    return basePrice;
  }

  private async simulateExecutionDelay(): Promise<void> {
    // Simulate network latency and broker processing time
    const delay = this.executionDelay + Math.random() * 50; // 100-150ms
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  private async executeTrade(request: ExecutionRequest, executionPrice: number): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Get currency pair ID
      const { data: pair } = await supabase
        .from('currency_pairs')
        .select('id')
        .eq('symbol', request.symbol)
        .single();

      if (!pair) throw new Error('Currency pair not found');

      // Get active trading account
      const { data: account } = await supabase
        .from('trading_accounts')
        .select('id')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .single();

      if (!account) throw new Error('No active trading account found');

      // Create live trade record
      const { error } = await supabase
        .from('live_trades')
        .insert({
          user_id: user.id,
          pair_id: pair.id,
          symbol: request.symbol,
          trade_type: request.type,
          lot_size: request.volume,
          entry_price: executionPrice,
          current_price: executionPrice,
          stop_loss: request.stopLoss,
          take_profit: request.takeProfit,
          status: 'OPEN',
          ticket_id: `MT5_${Date.now()}`,
          opened_at: new Date().toISOString()
        });

      if (error) throw error;

      // Update account margin (simplified calculation)
      await this.updateAccountMargin(user.id, request.volume);
      
    } catch (error) {
      console.error('Database execution error:', error);
      throw error;
    }
  }

  private async updateAccountMargin(userId: string, volume: number): Promise<void> {
    try {
      // Simplified margin calculation: $1000 per lot
      const marginRequired = volume * 1000;
      
      // Update margin in trading_accounts table
      const { data: account } = await supabase
        .from('trading_accounts')
        .select('margin')
        .eq('user_id', userId)
        .eq('is_active', true)
        .single();

      if (account) {
        await supabase
          .from('trading_accounts')
          .update({ 
            margin: (account.margin || 0) + marginRequired,
            updated_at: new Date().toISOString()
          })
          .eq('user_id', userId)
          .eq('is_active', true);
      }
    } catch (error) {
      console.error('Margin update error:', error);
    }
  }

  async closePosition(positionId: string): Promise<boolean> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;

      // Get position details
      const { data: position } = await supabase
        .from('live_trades')
        .select(`
          *,
          currency_pairs(symbol)
        `)
        .eq('id', positionId)
        .eq('user_id', user.id)
        .single();

      if (!position) throw new Error('Position not found');

      // Get current market price
      const marketPrice = await this.getCurrentMarketPrice(position.currency_pairs.symbol);
      const closePrice = position.trade_type === 'BUY' ? marketPrice.bid : marketPrice.ask;

      // Calculate final P&L
      const pipValue = this.getPipValue(position.currency_pairs.symbol);
      const pipDifference = position.trade_type === 'BUY' 
        ? (closePrice - position.entry_price) / pipValue
        : (position.entry_price - closePrice) / pipValue;
      
      const finalProfit = pipDifference * pipValue * position.lot_size * 100000;

      // Close the position
      const { error } = await supabase
        .from('live_trades')
        .update({
          status: 'CLOSED',
          current_price: closePrice,
          profit: finalProfit,
          profit_pips: pipDifference,
          closed_at: new Date().toISOString()
        })
        .eq('id', positionId);

      if (error) throw error;

      console.log(`Position closed: ${position.currency_pairs.symbol} P&L: ${finalProfit.toFixed(2)}`);
      return true;

    } catch (error) {
      console.error('Failed to close position:', error);
      return false;
    }
  }

  private getPipValue(symbol: string): number {
    return symbol.includes('JPY') ? 0.01 : 0.0001;
  }

  async getExecutionHistory(limit: number = 50): Promise<TradeExecution[]> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data: trades } = await supabase
        .from('live_trades')
        .select(`
          *,
          currency_pairs(symbol)
        `)
        .eq('user_id', user.id)
        .order('opened_at', { ascending: false })
        .limit(limit);

      if (!trades) return [];

      return trades.map(trade => ({
        id: trade.id,
        symbol: trade.currency_pairs?.symbol || '',
        type: trade.trade_type as 'BUY' | 'SELL',
        volume: parseFloat(trade.lot_size.toString()),
        executionPrice: parseFloat(trade.entry_price.toString()),
        stopLoss: trade.stop_loss ? parseFloat(trade.stop_loss.toString()) : undefined,
        takeProfit: trade.take_profit ? parseFloat(trade.take_profit.toString()) : undefined,
        timestamp: new Date(trade.opened_at || trade.created_at),
        status: trade.status === 'OPEN' ? 'EXECUTED' : 'EXECUTED'
      }));

    } catch (error) {
      console.error('Failed to get execution history:', error);
      return [];
    }
  }

  setMaxSlippage(slippage: number): void {
    this.maxSlippage = slippage;
  }

  getMaxSlippage(): number {
    return this.maxSlippage;
  }

  setExecutionDelay(delay: number): void {
    this.executionDelay = delay;
  }

  getExecutionDelay(): number {
    return this.executionDelay;
  }
}

export const tradeExecutor = new TradeExecutor();