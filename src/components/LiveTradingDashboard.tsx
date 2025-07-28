import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Activity, 
  TrendingUp, 
  TrendingDown, 
  DollarSign,
  Clock,
  Target,
  AlertTriangle,
  CheckCircle,
  X,
  RefreshCw
} from "lucide-react";
import { useTradingBot } from "@/hooks/useTradingBot";
import { supabase } from "@/integrations/supabase/client";

interface LivePosition {
  id: string;
  symbol: string;
  type: 'BUY' | 'SELL';
  lotSize: number;
  entryPrice: number;
  currentPrice: number;
  profit: number;
  profitPips: number;
  stopLoss?: number;
  takeProfit?: number;
  openTime: Date;
  status: string;
}

interface MarketPrice {
  symbol: string;
  bid: number;
  ask: number;
  spread: number;
  timestamp: Date;
}

export const LiveTradingDashboard = () => {
  const { status, isLoading } = useTradingBot();
  const [positions, setPositions] = useState<LivePosition[]>([]);
  const [marketPrices, setMarketPrices] = useState<MarketPrice[]>([]);
  const [accountInfo, setAccountInfo] = useState({
    balance: 0,
    equity: 0,
    margin: 0,
    freeMargin: 0,
    marginLevel: 0
  });

  useEffect(() => {
    loadLiveData();
    
    // Update every 5 seconds
    const interval = setInterval(loadLiveData, 5000);
    return () => clearInterval(interval);
  }, []);

  const loadLiveData = async () => {
    await Promise.all([
      loadPositions(),
      loadMarketPrices(),
      loadAccountInfo()
    ]);
  };

  const loadPositions = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: trades } = await supabase
        .from('live_trades')
        .select(`
          *,
          currency_pairs(symbol)
        `)
        .eq('user_id', user.id)
        .eq('status', 'OPEN')
        .order('opened_at', { ascending: false });

      if (trades) {
        const livePositions: LivePosition[] = trades.map(trade => ({
          id: trade.id,
          symbol: trade.currency_pairs?.symbol || '',
          type: trade.trade_type as 'BUY' | 'SELL',
          lotSize: parseFloat(trade.lot_size.toString()),
          entryPrice: parseFloat(trade.entry_price.toString()),
          currentPrice: parseFloat(trade.current_price?.toString() || trade.entry_price.toString()),
          profit: parseFloat(trade.profit?.toString() || '0'),
          profitPips: parseFloat(trade.profit_pips?.toString() || '0'),
          stopLoss: trade.stop_loss ? parseFloat(trade.stop_loss.toString()) : undefined,
          takeProfit: trade.take_profit ? parseFloat(trade.take_profit.toString()) : undefined,
          openTime: new Date(trade.opened_at || trade.created_at),
          status: trade.status
        }));
        
        setPositions(livePositions);
      }
    } catch (error) {
      console.error('Failed to load positions:', error);
    }
  };

  const loadMarketPrices = async () => {
    try {
      const { data: prices } = await supabase
        .from('market_data')
        .select('*')
        .in('symbol', ['EURUSD', 'GBPUSD', 'USDJPY', 'AUDUSD', 'USDCHF', 'NZDUSD'])
        .order('timestamp', { ascending: false })
        .limit(6);

      if (prices) {
        const marketData: MarketPrice[] = prices.map(price => ({
          symbol: price.symbol,
          bid: parseFloat(price.bid.toString()),
          ask: parseFloat(price.ask.toString()),
          spread: parseFloat(price.spread?.toString() || '0'),
          timestamp: new Date(price.timestamp)
        }));
        
        setMarketPrices(marketData);
      }
    } catch (error) {
      console.error('Failed to load market prices:', error);
    }
  };

  const loadAccountInfo = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: account } = await supabase
        .from('trading_accounts')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .single();

      if (account) {
        setAccountInfo({
          balance: parseFloat(account.balance?.toString() || '0'),
          equity: parseFloat(account.equity?.toString() || '0'),
          margin: parseFloat(account.margin?.toString() || '0'),
          freeMargin: parseFloat(account.free_margin?.toString() || '0'),
          marginLevel: parseFloat(account.margin_level?.toString() || '0')
        });
      }
    } catch (error) {
      console.error('Failed to load account info:', error);
    }
  };

  const closePosition = async (positionId: string) => {
    try {
      const { error } = await supabase
        .from('live_trades')
        .update({
          status: 'CLOSED',
          closed_at: new Date().toISOString()
        })
        .eq('id', positionId);

      if (!error) {
        await loadPositions();
      }
    } catch (error) {
      console.error('Failed to close position:', error);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(amount);
  };

  const formatPrice = (price: number, symbol: string) => {
    const decimals = symbol.includes('JPY') ? 2 : 4;
    return price.toFixed(decimals);
  };

  const totalUnrealizedPnL = positions.reduce((sum, pos) => sum + pos.profit, 0);

  return (
    <div className="space-y-6">
      {/* Account Overview */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">Balance</div>
            <div className="text-2xl font-bold text-foreground">
              {formatCurrency(accountInfo.balance)}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">Equity</div>
            <div className="text-2xl font-bold text-bullish">
              {formatCurrency(accountInfo.equity)}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">Unrealized P&L</div>
            <div className={`text-2xl font-bold ${totalUnrealizedPnL >= 0 ? 'text-bullish' : 'text-bearish'}`}>
              {totalUnrealizedPnL >= 0 ? '+' : ''}{formatCurrency(totalUnrealizedPnL)}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">Free Margin</div>
            <div className="text-2xl font-bold text-foreground">
              {formatCurrency(accountInfo.freeMargin)}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">Margin Level</div>
            <div className="text-2xl font-bold text-accent">
              {accountInfo.marginLevel.toFixed(1)}%
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="positions" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="positions">Open Positions ({positions.length})</TabsTrigger>
          <TabsTrigger value="prices">Market Prices</TabsTrigger>
          <TabsTrigger value="orders">Pending Orders</TabsTrigger>
        </TabsList>
        
        <TabsContent value="positions" className="space-y-4">
          {positions.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Activity className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-semibold mb-2">No Open Positions</h3>
                <p className="text-muted-foreground">
                  Your trading bot will open positions automatically when signals are generated.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {positions.map((position) => (
                <Card key={position.id} className="border border-border/50">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <Badge 
                          variant={position.type === 'BUY' ? 'default' : 'secondary'}
                          className={position.type === 'BUY' ? 'bg-bullish' : 'bg-bearish'}
                        >
                          {position.type}
                        </Badge>
                        <div>
                          <div className="font-semibold text-lg">{position.symbol}</div>
                          <div className="text-sm text-muted-foreground">
                            {position.lotSize} lots • Opened {position.openTime.toLocaleTimeString()}
                          </div>
                        </div>
                      </div>
                      
                      <div className="text-right">
                        <div className="grid grid-cols-3 gap-4 text-sm">
                          <div>
                            <div className="text-muted-foreground">Entry</div>
                            <div className="font-medium">{formatPrice(position.entryPrice, position.symbol)}</div>
                          </div>
                          <div>
                            <div className="text-muted-foreground">Current</div>
                            <div className="font-medium">{formatPrice(position.currentPrice, position.symbol)}</div>
                          </div>
                          <div>
                            <div className="text-muted-foreground">P&L</div>
                            <div className={`font-bold ${position.profit >= 0 ? 'text-bullish' : 'text-bearish'}`}>
                              {position.profit >= 0 ? '+' : ''}{formatCurrency(position.profit)}
                            </div>
                            <div className={`text-xs ${position.profitPips >= 0 ? 'text-bullish' : 'text-bearish'}`}>
                              {position.profitPips >= 0 ? '+' : ''}{position.profitPips.toFixed(1)} pips
                            </div>
                          </div>
                        </div>
                        
                        {(position.stopLoss || position.takeProfit) && (
                          <div className="grid grid-cols-2 gap-4 text-xs mt-2">
                            {position.stopLoss && (
                              <div>
                                <span className="text-muted-foreground">SL: </span>
                                <span className="text-bearish">{formatPrice(position.stopLoss, position.symbol)}</span>
                              </div>
                            )}
                            {position.takeProfit && (
                              <div>
                                <span className="text-muted-foreground">TP: </span>
                                <span className="text-bullish">{formatPrice(position.takeProfit, position.symbol)}</span>
                              </div>
                            )}
                          </div>
                        )}
                        
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => closePosition(position.id)}
                          className="mt-2"
                        >
                          <X className="w-4 h-4 mr-1" />
                          Close
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
        
        <TabsContent value="prices" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {marketPrices.map((price) => (
              <Card key={price.symbol} className="border border-border/50">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="font-semibold text-lg">{price.symbol}</div>
                    <div className="text-xs text-muted-foreground">
                      {price.timestamp.toLocaleTimeString()}
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-sm text-muted-foreground">Bid</div>
                      <div className="font-medium text-bearish">
                        {formatPrice(price.bid, price.symbol)}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">Ask</div>
                      <div className="font-medium text-bullish">
                        {formatPrice(price.ask, price.symbol)}
                      </div>
                    </div>
                  </div>
                  
                  <div className="mt-3 text-center">
                    <div className="text-xs text-muted-foreground">Spread</div>
                    <div className="font-medium">{(price.spread * 10000).toFixed(1)} pips</div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
        
        <TabsContent value="orders">
          <Card>
            <CardContent className="p-8 text-center">
              <Clock className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">No Pending Orders</h3>
              <p className="text-muted-foreground">
                Pending orders will appear here when created by your trading bot.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="w-5 h-5" />
            Quick Actions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <Button onClick={loadLiveData} variant="outline" disabled={isLoading}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh Data
            </Button>
            <Button variant="outline">
              Close All Positions
            </Button>
            <Button variant="outline">
              Export Trading History
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};