import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { 
  CheckCircle, 
  XCircle, 
  Clock,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Filter
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface ExecutionLog {
  id: string;
  symbol: string;
  order_type: 'BUY' | 'SELL';
  volume: number;
  entry_price: number | null;
  stop_loss: number | null;
  take_profit: number | null;
  order_id: string | null;
  ticket_id: string | null;
  status: 'SUCCESS' | 'FAILED';
  error_message: string | null;
  account_type: string | null;
  daily_trade_count: number | null;
  execution_timestamp: string;
}

export const TradeExecutionLog = () => {
  const [logs, setLogs] = useState<ExecutionLog[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [filter, setFilter] = useState<'ALL' | 'SUCCESS' | 'FAILED'>('ALL');

  useEffect(() => {
    loadExecutionLogs();
    
    // Subscribe to real-time updates
    const channel = supabase
      .channel('trade-execution-log-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'trade_execution_log'
        },
        (payload) => {
          console.log('📨 New execution log:', payload.new);
          setLogs(prevLogs => [payload.new as ExecutionLog, ...prevLogs]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const loadExecutionLogs = async () => {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('trade_execution_log')
        .select('*')
        .eq('user_id', user.id)
        .order('execution_timestamp', { ascending: false })
        .limit(100);

      if (error) throw error;
      
      // Cast to proper types
      const typedLogs: ExecutionLog[] = (data || []).map(log => ({
        ...log,
        order_type: log.order_type as 'BUY' | 'SELL',
        status: log.status as 'SUCCESS' | 'FAILED'
      }));
      
      setLogs(typedLogs);
      console.log(`📋 Loaded ${typedLogs.length} execution logs`);
    } catch (error) {
      console.error('Failed to load execution logs:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredLogs = filter === 'ALL' 
    ? logs 
    : logs.filter(log => log.status === filter);

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const formatPrice = (price: number | null, symbol: string) => {
    if (price === null) return 'N/A';
    const decimals = symbol.includes('JPY') ? 2 : 4;
    return price.toFixed(decimals);
  };

  const successCount = logs.filter(log => log.status === 'SUCCESS').length;
  const failedCount = logs.filter(log => log.status === 'FAILED').length;
  const successRate = logs.length > 0 ? (successCount / logs.length * 100).toFixed(1) : '0.0';

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Trade Execution Log
          </CardTitle>
          <div className="flex items-center gap-2">
            <div className="flex gap-1 border rounded-md p-1">
              <Button
                variant={filter === 'ALL' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setFilter('ALL')}
                className="h-7 px-2"
              >
                All ({logs.length})
              </Button>
              <Button
                variant={filter === 'SUCCESS' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setFilter('SUCCESS')}
                className="h-7 px-2"
              >
                Success ({successCount})
              </Button>
              <Button
                variant={filter === 'FAILED' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setFilter('FAILED')}
                className="h-7 px-2"
              >
                Failed ({failedCount})
              </Button>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={loadExecutionLogs}
              disabled={isLoading}
              className="h-7 px-2"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
        <div className="flex gap-4 text-sm text-muted-foreground">
          <div>Success Rate: <span className="font-semibold text-green-600">{successRate}%</span></div>
          <div>Total Executions: <span className="font-semibold">{logs.length}</span></div>
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[600px] pr-4">
          {filteredLogs.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Clock className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No execution logs yet</p>
              <p className="text-sm mt-1">Logs will appear here when trades are executed</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredLogs.map((log) => (
                <div
                  key={log.id}
                  className={`border rounded-lg p-4 ${
                    log.status === 'SUCCESS' 
                      ? 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800' 
                      : 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800'
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-3">
                      {log.status === 'SUCCESS' ? (
                        <CheckCircle className="w-5 h-5 text-green-600" />
                      ) : (
                        <XCircle className="w-5 h-5 text-red-600" />
                      )}
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-lg">{log.symbol}</span>
                          <Badge 
                            variant={log.order_type === 'BUY' ? 'default' : 'secondary'}
                            className={log.order_type === 'BUY' ? 'bg-green-500' : 'bg-red-500'}
                          >
                            {log.order_type}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {log.volume} lots
                          </Badge>
                          {log.account_type && (
                            <Badge variant="outline" className="text-xs">
                              {log.account_type}
                            </Badge>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {formatTimestamp(log.execution_timestamp)}
                          {log.ticket_id && ` • Ticket: ${log.ticket_id}`}
                          {log.daily_trade_count && ` • Trade #${log.daily_trade_count} today`}
                        </div>
                      </div>
                    </div>
                    <Badge variant={log.status === 'SUCCESS' ? 'default' : 'destructive'}>
                      {log.status}
                    </Badge>
                  </div>

                  {log.status === 'SUCCESS' && (
                    <div className="grid grid-cols-3 gap-4 mt-3 pt-3 border-t border-border/30">
                      <div>
                        <div className="text-xs text-muted-foreground">Entry Price</div>
                        <div className="font-medium">{formatPrice(log.entry_price, log.symbol)}</div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">Stop Loss</div>
                        <div className="font-medium text-red-500">
                          {formatPrice(log.stop_loss, log.symbol)}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">Take Profit</div>
                        <div className="font-medium text-green-500">
                          {formatPrice(log.take_profit, log.symbol)}
                        </div>
                      </div>
                    </div>
                  )}

                  {log.status === 'FAILED' && log.error_message && (
                    <div className="mt-3 pt-3 border-t border-border/30">
                      <div className="text-xs text-muted-foreground mb-1">Error:</div>
                      <div className="text-sm text-red-600 dark:text-red-400 font-mono">
                        {log.error_message}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
};
