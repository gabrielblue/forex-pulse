import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign,
  Target,
  Shield,
  Clock,
  BarChart3,
  Plus,
  X
} from "lucide-react";

interface Trade {
  id: string;
  pair: string;
  type: "BUY" | "SELL";
  entryPrice: number;
  currentPrice: number;
  lotSize: number;
  openTime: Date;
  pnl: number;
  status: "OPEN" | "CLOSED";
  stopLoss?: number;
  takeProfit?: number;
}

interface TradeHistory {
  id: string;
  pair: string;
  type: "BUY" | "SELL";
  entryPrice: number;
  exitPrice: number;
  lotSize: number;
  openTime: Date;
  closeTime: Date;
  pnl: number;
  duration: string;
}

export const PaperTradingSimulator = () => {
  const [balance, setBalance] = useState(10000);
  const [equity, setEquity] = useState(10000);
  const [margin, setMargin] = useState(0);
  const [freeMargin, setFreeMargin] = useState(10000);
  const [activeTrades, setActiveTrades] = useState<Trade[]>([]);
  const [tradeHistory, setTradeHistory] = useState<TradeHistory[]>([]);
  const [showNewTrade, setShowNewTrade] = useState(false);
  
  // New trade form
  const [newTrade, setNewTrade] = useState({
    pair: "EUR/USD",
    type: "BUY" as "BUY" | "SELL",
    lotSize: 0.1,
    stopLoss: "",
    takeProfit: ""
  });

  // Mock current prices
  const currentPrices: Record<string, number> = {
    "EUR/USD": 1.0845,
    "GBP/USD": 1.2734,
    "USD/JPY": 149.87,
    "AUD/USD": 0.6542,
    "USD/CHF": 0.8976,
    "NZD/USD": 0.5987
  };

  const pairs = Object.keys(currentPrices);

  // Calculate P&L for active trades
  useEffect(() => {
    if (activeTrades.length === 0) return;

    const updatedTrades = activeTrades.map(trade => {
      const currentPrice = currentPrices[trade.pair] || trade.entryPrice;
      const priceDiff = trade.type === "BUY" 
        ? currentPrice - trade.entryPrice 
        : trade.entryPrice - currentPrice;
      const pnl = priceDiff * trade.lotSize * 100000; // Standard lot size

      return { ...trade, currentPrice, pnl };
    });

    // Only update if there's actually a change to prevent infinite loops
    const hasChanges = updatedTrades.some((trade, index) => 
      trade.currentPrice !== activeTrades[index]?.currentPrice || 
      trade.pnl !== activeTrades[index]?.pnl
    );

    if (hasChanges) {
      setActiveTrades(updatedTrades);
    }
    
    // Update equity
    const totalPnL = updatedTrades.reduce((sum, trade) => sum + trade.pnl, 0);
    const newEquity = balance + totalPnL;
    if (Math.abs(newEquity - equity) > 0.01) {
      setEquity(newEquity);
    }
    
    // Update margin (simplified calculation)
    const totalMargin = updatedTrades.reduce((sum, trade) => 
      sum + (trade.lotSize * 100000 * 0.01), 0
    );
    if (Math.abs(totalMargin - margin) > 0.01) {
      setMargin(totalMargin);
      setFreeMargin(newEquity - totalMargin);
    }
  }, [balance]); // Only depend on balance, not activeTrades to prevent loops

  // Update prices periodically
  useEffect(() => {
    const interval = setInterval(() => {
      if (activeTrades.length > 0) {
        const updatedTrades = activeTrades.map(trade => {
          const currentPrice = currentPrices[trade.pair] || trade.entryPrice;
          const priceDiff = trade.type === "BUY" 
            ? currentPrice - trade.entryPrice 
            : trade.entryPrice - currentPrice;
          const pnl = priceDiff * trade.lotSize * 100000;

          return { ...trade, currentPrice, pnl };
        });

        setActiveTrades(updatedTrades);
      }
    }, 5000); // Update every 5 seconds

    return () => clearInterval(interval);
  }, [activeTrades.length]); // Only depend on length to prevent infinite loops

  const executeTrade = () => {
    if (!newTrade.pair || newTrade.lotSize <= 0) return;

    const entryPrice = currentPrices[newTrade.pair];
    const trade: Trade = {
      id: Date.now().toString(),
      pair: newTrade.pair,
      type: newTrade.type,
      entryPrice,
      currentPrice: entryPrice,
      lotSize: newTrade.lotSize,
      openTime: new Date(),
      pnl: 0,
      status: "OPEN",
      stopLoss: newTrade.stopLoss ? parseFloat(newTrade.stopLoss) : undefined,
      takeProfit: newTrade.takeProfit ? parseFloat(newTrade.takeProfit) : undefined
    };

    setActiveTrades([...activeTrades, trade]);
    setShowNewTrade(false);
    setNewTrade({
      pair: "EUR/USD",
      type: "BUY",
      lotSize: 0.1,
      stopLoss: "",
      takeProfit: ""
    });
  };

  const closeTrade = (tradeId: string) => {
    const trade = activeTrades.find(t => t.id === tradeId);
    if (!trade) return;

    const historyEntry: TradeHistory = {
      id: trade.id,
      pair: trade.pair,
      type: trade.type,
      entryPrice: trade.entryPrice,
      exitPrice: trade.currentPrice,
      lotSize: trade.lotSize,
      openTime: trade.openTime,
      closeTime: new Date(),
      pnl: trade.pnl,
      duration: formatDuration(trade.openTime, new Date())
    };

    setTradeHistory([historyEntry, ...tradeHistory]);
    setActiveTrades(activeTrades.filter(t => t.id !== tradeId));
    setBalance(balance + trade.pnl);
  };

  const formatDuration = (start: Date, end: Date) => {
    const diff = end.getTime() - start.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    return `${minutes}m`;
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(amount);
  };

  const totalPnL = tradeHistory.reduce((sum, trade) => sum + trade.pnl, 0) + 
                   activeTrades.reduce((sum, trade) => sum + trade.pnl, 0);
  const winRate = tradeHistory.length > 0 
    ? (tradeHistory.filter(trade => trade.pnl > 0).length / tradeHistory.length * 100)
    : 0;

  return (
    <Card className="p-6 bg-gradient-to-br from-card to-card/80 border-border/50">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <BarChart3 className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-foreground">Paper Trading</h2>
            <p className="text-muted-foreground text-sm">Practice trading with virtual money</p>
          </div>
        </div>
        <Button
          onClick={() => setShowNewTrade(!showNewTrade)}
          className="flex items-center space-x-2"
        >
          <Plus className="w-4 h-4" />
          <span>New Trade</span>
        </Button>
      </div>

      {/* Account Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="p-3 rounded-lg bg-muted/30 border border-border/30">
          <div className="text-sm text-muted-foreground">Balance</div>
          <div className="text-lg font-semibold text-foreground">{formatCurrency(balance)}</div>
        </div>
        <div className="p-3 rounded-lg bg-muted/30 border border-border/30">
          <div className="text-sm text-muted-foreground">Equity</div>
          <div className="text-lg font-semibold text-foreground">{formatCurrency(equity)}</div>
        </div>
        <div className="p-3 rounded-lg bg-muted/30 border border-border/30">
          <div className="text-sm text-muted-foreground">Total P&L</div>
          <div className={`text-lg font-semibold ${totalPnL >= 0 ? 'text-bullish' : 'text-bearish'}`}>
            {totalPnL >= 0 ? '+' : ''}{formatCurrency(totalPnL)}
          </div>
        </div>
        <div className="p-3 rounded-lg bg-muted/30 border border-border/30">
          <div className="text-sm text-muted-foreground">Win Rate</div>
          <div className="text-lg font-semibold text-bullish">{winRate.toFixed(1)}%</div>
        </div>
      </div>

      {/* New Trade Form */}
      {showNewTrade && (
        <div className="p-4 rounded-lg bg-primary/5 border border-primary/20 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-4">
            <div>
              <Label>Currency Pair</Label>
              <Select value={newTrade.pair} onValueChange={(value) => setNewTrade({...newTrade, pair: value})}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {pairs.map(pair => (
                    <SelectItem key={pair} value={pair}>{pair}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Order Type</Label>
              <Select value={newTrade.type} onValueChange={(value: "BUY" | "SELL") => setNewTrade({...newTrade, type: value})}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="BUY">BUY</SelectItem>
                  <SelectItem value="SELL">SELL</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Lot Size</Label>
              <Input
                type="number"
                step="0.01"
                value={newTrade.lotSize}
                onChange={(e) => setNewTrade({...newTrade, lotSize: parseFloat(e.target.value) || 0})}
              />
            </div>
            <div>
              <Label>Stop Loss</Label>
              <Input
                type="number"
                step="0.0001"
                placeholder="Optional"
                value={newTrade.stopLoss}
                onChange={(e) => setNewTrade({...newTrade, stopLoss: e.target.value})}
              />
            </div>
            <div>
              <Label>Take Profit</Label>
              <Input
                type="number"
                step="0.0001"
                placeholder="Optional"
                value={newTrade.takeProfit}
                onChange={(e) => setNewTrade({...newTrade, takeProfit: e.target.value})}
              />
            </div>
          </div>
          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={() => setShowNewTrade(false)}>Cancel</Button>
            <Button onClick={executeTrade}>Execute Trade</Button>
          </div>
        </div>
      )}

      {/* Active Trades */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-foreground mb-3">Active Trades ({activeTrades.length})</h3>
        {activeTrades.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No active trades. Click "New Trade" to start trading.
          </div>
        ) : (
          <div className="space-y-2">
            {activeTrades.map(trade => (
              <div key={trade.id} className="p-3 rounded-lg bg-muted/20 border border-border/30">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <Badge variant={trade.type === "BUY" ? "default" : "secondary"} 
                           className={trade.type === "BUY" ? "bg-bullish" : "bg-bearish"}>
                      {trade.type}
                    </Badge>
                    <span className="font-medium">{trade.pair}</span>
                    <span className="text-sm text-muted-foreground">{trade.lotSize} lots</span>
                  </div>
                  <div className="flex items-center space-x-4">
                    <div className="text-right">
                      <div className="text-sm text-muted-foreground">Entry: {trade.entryPrice.toFixed(4)}</div>
                      <div className="text-sm text-muted-foreground">Current: {trade.currentPrice.toFixed(4)}</div>
                    </div>
                    <div className={`text-right font-semibold ${trade.pnl >= 0 ? 'text-bullish' : 'text-bearish'}`}>
                      {trade.pnl >= 0 ? '+' : ''}{formatCurrency(trade.pnl)}
                    </div>
                    <Button size="sm" variant="outline" onClick={() => closeTrade(trade.id)}>
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Trade History */}
      <div>
        <h3 className="text-lg font-semibold text-foreground mb-3">Recent History</h3>
        {tradeHistory.length === 0 ? (
          <div className="text-center py-4 text-muted-foreground">
            No trade history yet.
          </div>
        ) : (
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {tradeHistory.slice(0, 10).map(trade => (
              <div key={trade.id} className="p-3 rounded-lg bg-muted/10 border border-border/20">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <Badge variant={trade.type === "BUY" ? "default" : "secondary"} 
                           className={trade.type === "BUY" ? "bg-bullish/20 text-bullish" : "bg-bearish/20 text-bearish"}>
                      {trade.type}
                    </Badge>
                    <span className="font-medium">{trade.pair}</span>
                    <span className="text-sm text-muted-foreground">{trade.lotSize} lots</span>
                  </div>
                  <div className="flex items-center space-x-4">
                    <div className="text-right text-sm">
                      <div className="text-muted-foreground">{trade.entryPrice.toFixed(4)} → {trade.exitPrice.toFixed(4)}</div>
                      <div className="text-muted-foreground">{trade.duration}</div>
                    </div>
                    <div className={`font-semibold ${trade.pnl >= 0 ? 'text-bullish' : 'text-bearish'}`}>
                      {trade.pnl >= 0 ? '+' : ''}{formatCurrency(trade.pnl)}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
};