import { supabase } from '@/integrations/supabase/client';
import { exnessAPI } from './exnessApi';
import { orderManager } from './orderManager';

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
      // Verify Exness connection
      if (!exnessAPI.isConnectedToExness()) {
        throw new Error('Not connected to Exness. Please connect first.');
      }

      // Pre-execution validation
      await this.validateExecution(request);
      
      // Execute REAL trade through Exness API via orderManager
      console.log(`🚀 Executing REAL trade: ${request.type} ${request.volume} ${request.symbol}`);
      
      const orderId = await orderManager.executeOrder({
        symbol: request.symbol,
        type: request.type,
        volume: request.volume,
        stopLoss: request.stopLoss,
        takeProfit: request.takeProfit,
        comment: request.comment
      });
      
      if (!orderId) {
        throw new Error('Failed to execute real trade - no order ID returned');
      }
      
      // Get execution price from Exness
      const marketPrice = await exnessAPI.getCurrentPrice(request.symbol);
      execution.executionPrice = request.type === 'BUY' ? marketPrice.ask : marketPrice.bid;
      execution.status = 'EXECUTED';
      execution.id = orderId;
      
      console.log(`✅ REAL trade executed: ${request.type} ${request.volume} ${request.symbol} @ ${execution.executionPrice} - Order ID: ${orderId}`);
      
    } catch (error) {
      execution.status = 'FAILED';
      execution.errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('❌ Real trade execution failed:', error);
    }

    return execution;
  }

  private async validateExecution(request: ExecutionRequest): Promise<void> {
    // Verify trading capabilities through Exness API
    const { canTrade, issues } = await exnessAPI.verifyTradingCapabilities();
    
    if (!canTrade) {
      throw new Error(`Cannot trade: ${issues.join(', ')}`);
    }
    
    // Check minimum volume
    if (request.volume < 0.01) {
      throw new Error('Minimum volume is 0.01 lots');
    }
    
    // Check maximum volume
    if (request.volume > 100) {
      throw new Error('Maximum volume is 100 lots');
    }
  }

  async closePosition(positionId: string): Promise<boolean> {
    try {
      // Use orderManager to close position through real Exness API
      console.log(`🔄 Closing REAL position via Exness: ${positionId}`);
      return await orderManager.closePosition(parseInt(positionId));
    } catch (error) {
      console.error('❌ Failed to close real position:', error);
      return false;
    }
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
}

export const tradeExecutor = new TradeExecutor();