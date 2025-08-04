import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
  RefreshCw,
  BarChart3,
  Zap,
  Shield
 } from "lucide-react";
import { useTradingBot } from "@/hooks/useTradingBot";
import { supabase } from "@/integrations/supabase/client";
import { exnessAPI } from "@/lib/trading/exnessApi";
import { orderManager } from "@/lib/trading/orderManager";
import { toast } from "sonner";

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
  ticket: number;
  commission: number;
  swap: number;
}

interface MarketPrice {
  symbol: string;
  bid: number;
  ask: number;
  spread: number;
  timestamp: Date;
}

interface TradingStatistics {
  totalTrades: number;
  winRate: number;
  totalProfit: number;
  averageProfit: number;
  grossProfit: number;
  grossLoss: number;
  profitFactor: number;
  winningTrades: number;
  losingTrades: number;
  dailyTradeCount: number;
  maxDailyTrades: number;
}

export const LiveTradingDashboard = () => {
  const { status, isLoading } = useTradingBot();
  const [positions, setPositions] = useState<LivePosition[]>([]);
  const [marketPrices, setMarketPrices] = useState<MarketPrice[]>([]);
  const [realAccountInfo, setRealAccountInfo] = useState<any>(null);
  const [tradingStats, setTradingStats] = useState<TradingStatistics | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  useEffect(() => {
    if (status.isConnected) {
      loadLiveData();
      
      // Update every 10 seconds when connected
      const interval = setInterval(loadLiveData, 10000);
      return () => clearInterval(interval);
    }
  }, [status.isConnected]);

  const loadLiveData = async () => {
    if (!status.isConnected) return;
    
    try {
      await Promise.all([
        loadPositions(),
        loadMarketPrices(),
        loadAccountInfo(),
        loadTradingStatistics()
      ]);
      setLastUpdate(new Date());
    } catch (error) {
      console.error('Failed to load live data:', error);
    }
  };

  const loadPositions = async () => {
    try {
      if (!exnessAPI.isConnectedToExness()) return;
      
      const exnessPositions = await exnessAPI.getPositions();
      
      const formattedPositions: LivePosition[] = exnessPositions.map(pos => ({
        id: pos.ticketId,
        symbol: pos.symbol,
        type: pos.type as 'BUY' | 'SELL',
        lotSize: pos.volume,
        entryPrice: pos.openPrice,
        currentPrice: pos.currentPrice,
        profit: pos.profit,
        profitPips: calculatePips(pos.openPrice, pos.currentPrice, pos.symbol, pos.type),
        stopLoss: pos.stopLoss,
        takeProfit: pos.takeProfit,
        openTime: pos.openTime,
        status: 'OPEN',
        ticket: pos.ticket,
        commission: pos.commission,
        swap: pos.swap
      }));
      
      setPositions(formattedPositions);
      console.log(`📊 Loaded ${formattedPositions.length} live positions from Exness`);
    } catch (error) {
      console.error('Failed to load positions:', error);
    }
  };

  const loadMarketPrices = async () => {
    try {
      if (!exnessAPI.isConnectedToExness()) return;
      
      const symbols = ['EURUSD', 'GBPUSD', 'USDJPY', 'AUDUSD', 'USDCHF', 'NZDUSD'];
      const pricePromises = symbols.map(symbol => exnessAPI.getCurrentPrice(symbol));
      const prices = await Promise.all(pricePromises);
      
      const validPrices = prices.filter(price => price !== null) as MarketPrice[];
      setMarketPrices(validPrices);
      
      console.log(`📈 Loaded ${validPrices.length} market prices from Exness`);
    } catch (error) {
      console.error('Failed to load market prices:', error);
    }
  };

  const loadAccountInfo = async () => {
    try {
      const accountInfo = await exnessAPI.getAccountInfo();
      if (accountInfo) {
        setRealAccountInfo(accountInfo);
      }
    } catch (error) {
      console.error('Failed to load account info:', error);
    }
  };

  const loadTradingStatistics = async () => {
    try {
      const stats = await orderManager.getTradingStatistics();
      if (stats) {
        setTradingStats(stats);
        console.log('📊 Trading statistics loaded:', stats);
      }
    } catch (error) {
      console.error('Failed to load trading statistics:', error);
    }
  };

  const calculatePips = (openPrice: number, currentPrice: number, symbol: string, type: string): number => {
    const pipValue = symbol.includes('JPY') ? 0.01 : 0.0001;
    const priceDiff = type === 'BUY' ? currentPrice - openPrice : openPrice - currentPrice;
    return priceDiff / pipValue;
  };

  const closePosition = async (ticket: number) => {
    try {
      setIsRefreshing(true);
      const success = await orderManager.closePosition(ticket);
      
      if (success) {
        toast.success(`Position ${ticket} closed successfully`);
        await loadLiveData(); // Refresh data
      } else {
        toast.error(`Failed to close position ${ticket}`);
      }
    } catch (error) {
      console.error('Failed to close position:', error);
      toast.error('Failed to close position: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setIsRefreshing(false);
    }
  };

  const refreshData = async () => {
    setIsRefreshing(true);
    try {
      await loadLiveData();
      toast.success('Data refreshed successfully');
    } catch (error) {
      toast.error('Failed to refresh data');
    } finally {
      setIsRefreshing(false);
    }
  };

  const formatCurrency = (amount: number, currency: string = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2
    }).format(amount);
  };

  const formatPrice = (price: number, symbol: string) => {
    const decimals = symbol.includes('JPY') ? 2 : 4;
    return price.toFixed(decimals);
  };

  const totalUnrealizedPnL = positions.reduce((sum, pos) => sum + pos.profit, 0);
  const gridProfit = realAccountInfo ? realAccountInfo.profit : 0;
  const investmentAmount = realAccountInfo ? realAccountInfo.balance : 0;
  const accountEquity = realAccountInfo ? realAccountInfo.equity : 0;

  if (!status.isConnected) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <AlertTriangle className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-semibold mb-2">Not Connected to Exness</h3>
          <p className="text-muted-foreground mb-4">
            Please connect your Exness MT5 account to view live trading data.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Connection Status Alert */}
      <Alert>
        <CheckCircle className="h-4 w-4" />
        <AlertDescription>
          <strong>Connected to Exness {realAccountInfo?.isDemo ? 'DEMO' : 'LIVE'} Account</strong>
          <div className="mt-1 text-sm">
            Server: {realAccountInfo?.server} | Last Update: {lastUpdate.toLocaleTimeString()}
            {realAccountInfo && !realAccountInfo.tradeAllowed && (
              <div className="text-red-600 font-semibold mt-1">⚠️ Trading is restricted on this account</div>
            )}
          </div>
        </AlertDescription>
      </Alert>

      {/* Account Overview - Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-muted-foreground">Account Balance</div>
                <div className="text-2xl font-bold text-foreground">
                  {realAccountInfo ? formatCurrency(investmentAmount, realAccountInfo.currency) : '$0.00'}
                </div>
              </div>
              <DollarSign className="w-8 h-8 text-green-500" />
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {realAccountInfo?.isDemo ? 'Demo Account' : 'Live Account'}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-muted-foreground">Realized P&L</div>
                <div className={`text-2xl font-bold ${gridProfit >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {realAccountInfo ? formatCurrency(gridProfit, realAccountInfo.currency) : '$0.00'}
                </div>
              </div>
              <BarChart3 className="w-8 h-8 text-blue-500" />
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              Total realized profit/loss
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-muted-foreground">Unrealized P&L</div>
                <div className={`text-2xl font-bold ${totalUnrealizedPnL >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {realAccountInfo ? formatCurrency(totalUnrealizedPnL, realAccountInfo.currency) : '$0.00'}
                </div>
              </div>
              <TrendingUp className="w-8 h-8 text-blue-500" />
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              Open positions P&L
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-muted-foreground">Win Rate</div>
                <div className="text-2xl font-bold text-blue-500">
                  {tradingStats ? tradingStats.winRate.toFixed(1) : '0.0'}%
                </div>
              </div>
              <Target className="w-8 h-8 text-blue-500" />
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              From {tradingStats?.totalTrades || 0} trades
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-muted-foreground">Account Equity</div>
                <div className="text-2xl font-bold text-foreground">
                  {realAccountInfo ? formatCurrency(accountEquity, realAccountInfo.currency) : '$0.00'}
                </div>
              </div>
              <Shield className="w-8 h-8 text-green-500" />
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              Balance + Unrealized P&L
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Trading Statistics */}
      {tradingStats && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5" />
              Trading Performance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              <div className="text-center p-3 rounded-lg bg-muted/30">
                <div className="text-lg font-bold text-foreground">{tradingStats.totalTrades}</div>
                <div className="text-xs text-muted-foreground">Total Trades</div>
              </div>
              <div className="text-center p-3 rounded-lg bg-green-50 dark:bg-green-950">
                <div className="text-lg font-bold text-green-600">{tradingStats.winningTrades}</div>
                <div className="text-xs text-muted-foreground">Winning</div>
              </div>
              <div className="text-center p-3 rounded-lg bg-red-50 dark:bg-red-950">
                <div className="text-lg font-bold text-red-600">{tradingStats.losingTrades}</div>
                <div className="text-xs text-muted-foreground">Losing</div>
              </div>
              <div className="text-center p-3 rounded-lg bg-blue-50 dark:bg-blue-950">
                <div className="text-lg font-bold text-blue-600">{tradingStats.profitFactor.toFixed(2)}</div>
                <div className="text-xs text-muted-foreground">Profit Factor</div>
              </div>
              <div className="text-center p-3 rounded-lg bg-purple-50 dark:bg-purple-950">
                <div className="text-lg font-bold text-purple-600">{tradingStats.dailyTradeCount}</div>
                <div className="text-xs text-muted-foreground">Today's Trades</div>
              </div>
              <div className="text-center p-3 rounded-lg bg-yellow-50 dark:bg-yellow-950">
                <div className="text-lg font-bold text-yellow-600">
                  {realAccountInfo ? formatCurrency(tradingStats.averageProfit, realAccountInfo.currency) : '$0.00'}
                </div>
                <div className="text-xs text-muted-foreground">Avg Profit</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="positions" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="positions">Open Positions ({positions.length})</TabsTrigger>
          <TabsTrigger value="prices">Market Prices</TabsTrigger>
          <TabsTrigger value="account">Account Details</TabsTrigger>
        </TabsList>
        
        <TabsContent value="positions" className="space-y-4">
          {positions.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Activity className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-semibold mb-2">No Open Positions</h3>
                <p className="text-muted-foreground">
                  Your trading bot will open positions automatically when signals are generated, 
                  or you can place manual trades.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {positions.map((position) => (
                <Card key={position.id} className="border border-border/50 hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <Badge 
                          variant={position.type === 'BUY' ? 'default' : 'secondary'}
                          className={position.type === 'BUY' ? 'bg-green-500' : 'bg-red-500'}
                        >
                          {position.type}
                        </Badge>
                        <div>
                          <div className="font-semibold text-lg">{position.symbol}</div>
                          <div className="text-sm text-muted-foreground">
                            {position.lotSize} lots • Ticket: {position.ticket}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Opened: {position.openTime.toLocaleString()}
                          </div>
                        </div>
                      </div>
                      
                      <div className="text-right">
                        <div className="grid grid-cols-3 gap-4 text-sm mb-2">
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
                            <div className={`font-bold ${position.profit >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                              {realAccountInfo ? formatCurrency(position.profit, realAccountInfo.currency) : '$0.00'}
                            </div>
                            <div className={`text-xs ${position.profitPips >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                              {position.profitPips >= 0 ? '+' : ''}{position.profitPips.toFixed(1)} pips
                            </div>
                          </div>
                        </div>
                        
                        {(position.stopLoss || position.takeProfit) && (
                          <div className="grid grid-cols-2 gap-4 text-xs mb-2">
                            {position.stopLoss && (
                              <div>
                                <span className="text-muted-foreground">SL: </span>
                                <span className="text-red-500">{formatPrice(position.stopLoss, position.symbol)}</span>
                              </div>
                            )}
                            {position.takeProfit && (
                              <div>
                                <span className="text-muted-foreground">TP: </span>
                                <span className="text-green-500">{formatPrice(position.takeProfit, position.symbol)}</span>
                              </div>
                            )}
                          </div>
                        )}

                        {(position.commission !== 0 || position.swap !== 0) && (
                          <div className="grid grid-cols-2 gap-4 text-xs mb-2">
                            <div>
                              <span className="text-muted-foreground">Commission: </span>
                              <span className="font-medium">{realAccountInfo ? formatCurrency(position.commission, realAccountInfo.currency) : '$0.00'}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Swap: </span>
                              <span className="font-medium">{realAccountInfo ? formatCurrency(position.swap, realAccountInfo.currency) : '$0.00'}</span>
                            </div>
                          </div>
                        )}
                        
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => closePosition(position.ticket)}
                          disabled={isRefreshing}
                          className="mt-2"
                        >
                          <X className="w-4 h-4 mr-1" />
                          Close Position
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
                  
                  <div className="grid grid-cols-2 gap-4 mb-3">
                    <div>
                      <div className="text-sm text-muted-foreground">Bid</div>
                      <div className="font-medium text-red-500">
                        {formatPrice(price.bid, price.symbol)}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">Ask</div>
                      <div className="font-medium text-green-500">
                        {formatPrice(price.ask, price.symbol)}
                      </div>
                    </div>
                  </div>
                  
                  <div className="text-center">
                    <div className="text-xs text-muted-foreground">Spread</div>
                    <div className="font-medium">
                      {price.symbol.includes('JPY') 
                        ? (price.spread * 100).toFixed(1) 
                        : (price.spread * 10000).toFixed(1)
                      } pips
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
        
        <TabsContent value="account" className="space-y-4">
          {realAccountInfo ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Account Information</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Account Number:</span>
                      <span className="font-medium">{realAccountInfo.accountNumber}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Server:</span>
                      <span className="font-medium">{realAccountInfo.server}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Currency:</span>
                      <span className="font-medium">{realAccountInfo.currency}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Leverage:</span>
                      <span className="font-medium">{realAccountInfo.leverage}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Account Type:</span>
                      <Badge variant={realAccountInfo.isDemo ? 'secondary' : 'destructive'}>
                        {realAccountInfo.isDemo ? 'DEMO' : 'LIVE'}
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Trading Allowed:</span>
                      <Badge variant={realAccountInfo.tradeAllowed ? 'default' : 'destructive'}>
                        {realAccountInfo.tradeAllowed ? 'Yes' : 'No'}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Financial Details</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Balance:</span>
                      <span className="font-medium">{formatCurrency(realAccountInfo.balance, realAccountInfo.currency)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Equity:</span>
                      <span className="font-medium">{formatCurrency(realAccountInfo.equity, realAccountInfo.currency)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Used Margin:</span>
                      <span className="font-medium">{formatCurrency(realAccountInfo.margin, realAccountInfo.currency)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Free Margin:</span>
                      <span className="font-medium text-green-500">{formatCurrency(realAccountInfo.freeMargin, realAccountInfo.currency)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Margin Level:</span>
                      <span className={`font-medium ${realAccountInfo.marginLevel > 200 ? 'text-green-500' : realAccountInfo.marginLevel > 100 ? 'text-yellow-500' : 'text-red-500'}`}>
                        {realAccountInfo.marginLevel.toFixed(1)}%
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Credit:</span>
                      <span className="font-medium">{formatCurrency(realAccountInfo.credit, realAccountInfo.currency)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            <Card>
              <CardContent className="p-8 text-center">
                <AlertTriangle className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-semibold mb-2">Account Information Unavailable</h3>
                <p className="text-muted-foreground">
                  Unable to load account details from Exness.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="w-5 h-5" />
            Quick Actions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <Button onClick={refreshData} variant="outline" disabled={isRefreshing}>
              <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
              {isRefreshing ? 'Refreshing...' : 'Refresh Data'}
            </Button>
            
            <Button 
              variant="outline" 
              onClick={async () => {
                try {
                  await orderManager.closeAllPositions();
                  toast.success('All positions closed');
                  await loadLiveData();
                } catch (error) {
                  toast.error('Failed to close all positions');
                }
              }}
              disabled={positions.length === 0 || isRefreshing}
            >
              Close All Positions
            </Button>
            
            <Button 
              variant="outline" 
              onClick={() => {
                const csvData = positions.map(pos => ({
                  Symbol: pos.symbol,
                  Type: pos.type,
                  'Lot Size': pos.lotSize,
                  'Entry Price': pos.entryPrice,
                  'Current Price': pos.currentPrice,
                  'P&L': pos.profit,
                  'Pips': pos.profitPips.toFixed(1),
                  'Open Time': pos.openTime.toISOString()
                }));
                
                const csv = [
                  Object.keys(csvData[0] || {}).join(','),
                  ...csvData.map(row => Object.values(row).join(','))
                ].join('\n');
                
                const blob = new Blob([csv], { type: 'text/csv' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `trading-positions-${new Date().toISOString().split('T')[0]}.csv`;
                a.click();
                URL.revokeObjectURL(url);
                
                toast.success('Trading data exported successfully');
              }}
            >
              Export Data
            </Button>

            <Button 
              variant="outline"
              onClick={async () => {
                try {
                  const serverTime = await exnessAPI.getServerTime();
                  toast.success(`Server time: ${serverTime?.toLocaleString() || 'Unknown'}`);
                } catch (error) {
                  toast.error('Failed to get server time');
                }
              }}
            >
              Check Server Time
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Risk Warning for Live Accounts */}
      {realAccountInfo && !realAccountInfo.isDemo && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>⚠️ LIVE TRADING ACCOUNT</strong>
            <div className="mt-1">
              You are connected to a live Exness account with real money. All trades will use actual funds. 
              Please monitor your positions carefully and ensure you understand the risks involved.
            </div>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
};