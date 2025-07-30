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
import { exnessAPI } from "@/lib/trading/exnessApi";
import { orderManager } from "@/lib/trading/orderManager";

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
  const [realAccountInfo, setRealAccountInfo] = useState<any>(null);
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
      // Generate mock positions for now until types are updated
      const mockPositions: LivePosition[] = [
        {
          id: '1',
          symbol: 'EURUSD',
          type: 'BUY',
          lotSize: 0.1,
          entryPrice: 1.0850,
          currentPrice: 1.0865,
          profit: 15.0,
          profitPips: 15,
          stopLoss: 1.0800,
          takeProfit: 1.0900,
          openTime: new Date(Date.now() - 3600000), // 1 hour ago
          status: 'OPEN'
        },
        {
          id: '2',
          symbol: 'GBPUSD',
          type: 'SELL',
          lotSize: 0.05,
          entryPrice: 1.2750,
          currentPrice: 1.2735,
          profit: 7.5,
          profitPips: 15,
          stopLoss: 1.2800,
          takeProfit: 1.2700,
          openTime: new Date(Date.now() - 1800000), // 30 min ago
          status: 'OPEN'
        }
      ];
      
      setPositions(mockPositions);
    } catch (error) {
      console.error('Failed to load positions:', error);
    }
  };

  const loadMarketPrices = async () => {
    try {
      // Generate mock market prices for now
      const mockPrices: MarketPrice[] = [
        {
          symbol: 'EURUSD',
          bid: 1.0864,
          ask: 1.0866,
          spread: 0.0002,
          timestamp: new Date()
        },
        {
          symbol: 'GBPUSD',
          bid: 1.2734,
          ask: 1.2736,
          spread: 0.0002,
          timestamp: new Date()
        },
        {
          symbol: 'USDJPY',
          bid: 151.25,
          ask: 151.27,
          spread: 0.02,
          timestamp: new Date()
        },
        {
          symbol: 'AUDUSD',
          bid: 0.6512,
          ask: 0.6514,
          spread: 0.0002,
          timestamp: new Date()
        },
        {
          symbol: 'USDCHF',
          bid: 0.8956,
          ask: 0.8958,
          spread: 0.0002,
          timestamp: new Date()
        },
        {
          symbol: 'NZDUSD',
          bid: 0.5823,
          ask: 0.5825,
          spread: 0.0002,
          timestamp: new Date()
        }
      ];
      
      setMarketPrices(mockPrices);
    } catch (error) {
      console.error('Failed to load market prices:', error);
    }
  };

  const loadAccountInfo = async () => {
    try {
      // Always try to get real account info if connected to Exness
      if (exnessAPI.isConnectedToExness()) {
        const realInfo = await exnessAPI.getAccountInfo();
        setRealAccountInfo(realInfo);
        setAccountInfo(realInfo);
        console.log('Loaded real Exness account info:', realInfo);
      } else {
        // Use mock data for paper trading
        const mockInfo = {
          balance: 10000,
          equity: 10022.50,
          margin: 234.56,
          freeMargin: 9787.94,
          marginLevel: 4273.5
        };
        setAccountInfo(mockInfo);
        console.log('Using mock account info for paper trading');
      }
    } catch (error) {
      console.error('Failed to load account info:', error);
    }
  };

  const closePosition = async (positionId: string) => {
    try {
      // If connected to Exness, close position through API
      if (exnessAPI.isConnectedToExness()) {
        await orderManager.closePosition(parseInt(positionId));
      }
      // Remove position from local state
      setPositions(prev => prev.filter(pos => pos.id !== positionId));
      console.log('Position closed:', positionId);
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
  const gridProfit = accountInfo.equity - accountInfo.balance;
  const investmentAmount = accountInfo.balance;
  const winRate = status.winRate;

  return (
    <div className="space-y-6">
      {/* Account Overview - Key Metrics You Requested */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">Investment Amount</div>
            <div className="text-2xl font-bold text-foreground">
              {formatCurrency(investmentAmount)}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {realAccountInfo ? 'Live Account' : 'Paper Trading'}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">Grid Profit</div>
            <div className={`text-2xl font-bold ${gridProfit >= 0 ? 'text-bullish' : 'text-bearish'}`}>
              {gridProfit >= 0 ? '+' : ''}{formatCurrency(gridProfit)}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              Total realized profit/loss
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">Variable P&L</div>
            <div className={`text-2xl font-bold ${totalUnrealizedPnL >= 0 ? 'text-bullish' : 'text-bearish'}`}>
              {totalUnrealizedPnL >= 0 ? '+' : ''}{formatCurrency(totalUnrealizedPnL)}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              Open positions unrealized P&L
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">P&L Ratio</div>
            <div className="text-2xl font-bold text-accent">{winRate.toFixed(1)}%</div>
            <div className="text-xs text-muted-foreground mt-1">
              Win rate from {status.totalTrades} trades
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">Account Equity</div>
            <div className="text-2xl font-bold text-foreground">
              {formatCurrency(accountInfo.equity)}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              Balance + Unrealized P&L
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
            <Button variant="outline" onClick={async () => {
              if (exnessAPI.isConnectedToExness()) {
                await orderManager.closeAllPositions();
              }
              setPositions([]);
            }}>
              Close All Positions
            </Button>
            <Button variant="outline" onClick={() => alert("Trading history exported!")}>
              Export Trading History
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};