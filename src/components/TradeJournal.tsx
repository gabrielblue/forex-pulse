import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { 
  BookOpen, 
  TrendingUp, 
  TrendingDown, 
  Clock, 
  Target, 
  BarChart3, 
  Plus,
  Filter,
  Search,
  Calendar,
  DollarSign,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Eye,
  Edit,
  Trash2,
  Download,
  RefreshCw,
  Zap,
  Brain,
  Lightbulb
} from "lucide-react";
import { toast } from "sonner";

interface Trade {
  id: string;
  pair: string;
  action: "BUY" | "SELL";
  entryPrice: number;
  exitPrice?: number;
  quantity: number;
  entryTime: Date;
  exitTime?: Date;
  stopLoss?: number;
  takeProfit?: number;
  pnl?: number;
  pnlPercent?: number;
  status: "OPEN" | "CLOSED" | "CANCELLED";
  result?: "WIN" | "LOSS" | "BREAKEVEN";
  confidence: number;
  strategy: string;
  notes?: string;
  tags: string[];
  riskAmount: number;
  marketCondition: "TRENDING" | "RANGING" | "VOLATILE";
  newsImpact?: "HIGH" | "MEDIUM" | "LOW";
}

interface TradeAnalysis {
  totalTrades: number;
  winRate: number;
  avgWin: number;
  avgLoss: number;
  profitFactor: number;
  maxDrawdown: number;
  sharpeRatio: number;
  bestPair: string;
  worstPair: string;
  bestStrategy: string;
  worstStrategy: string;
  avgHoldingTime: number;
  riskRewardRatio: number;
}

export const TradeJournal = () => {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [isAddingTrade, setIsAddingTrade] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterPair, setFilterPair] = useState<string>("all");
  const [filterStrategy, setFilterStrategy] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("entryTime");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // Sample data - replace with real data from your trading system
  useEffect(() => {
    const sampleTrades: Trade[] = [
      {
        id: "1",
        pair: "EUR/USD",
        action: "BUY",
        entryPrice: 1.0850,
        exitPrice: 1.0875,
        quantity: 10000,
        entryTime: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
        exitTime: new Date(Date.now() - 1 * 60 * 60 * 1000), // 1 hour ago
        stopLoss: 1.0830,
        takeProfit: 1.0900,
        pnl: 250,
        pnlPercent: 2.5,
        status: "CLOSED",
        result: "WIN",
        confidence: 85,
        strategy: "Trend Following",
        notes: "Strong uptrend on 4H chart, RSI divergence",
        tags: ["trend", "4H", "RSI"],
        riskAmount: 200,
        marketCondition: "TRENDING",
        newsImpact: "LOW"
      },
      {
        id: "2",
        pair: "GBP/USD",
        action: "SELL",
        entryPrice: 1.2650,
        exitPrice: 1.2620,
        quantity: 5000,
        entryTime: new Date(Date.now() - 4 * 60 * 60 * 1000),
        exitTime: new Date(Date.now() - 3 * 60 * 60 * 1000),
        stopLoss: 1.2680,
        takeProfit: 1.2600,
        pnl: 150,
        pnlPercent: 3.0,
        status: "CLOSED",
        result: "WIN",
        confidence: 78,
        strategy: "Mean Reversion",
        notes: "Overbought on daily, resistance level",
        tags: ["mean-reversion", "daily", "resistance"],
        riskAmount: 150,
        marketCondition: "RANGING",
        newsImpact: "MEDIUM"
      },
      {
        id: "3",
        pair: "USD/JPY",
        action: "BUY",
        entryPrice: 148.50,
        quantity: 8000,
        entryTime: new Date(Date.now() - 30 * 60 * 1000), // 30 min ago
        stopLoss: 148.20,
        takeProfit: 149.00,
        status: "OPEN",
        confidence: 82,
        strategy: "Breakout",
        notes: "Breaking key resistance level",
        tags: ["breakout", "resistance", "momentum"],
        riskAmount: 240,
        marketCondition: "TRENDING",
        newsImpact: "HIGH"
      }
    ];
    setTrades(sampleTrades);
  }, []);

  // Trade analysis calculations
  const analysis = useMemo((): TradeAnalysis => {
    const closedTrades = trades.filter(t => t.status === "CLOSED");
    const winningTrades = closedTrades.filter(t => t.result === "WIN");
    const losingTrades = closedTrades.filter(t => t.result === "LOSS");
    
    const totalPnL = closedTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
    const totalRisk = trades.reduce((sum, t) => sum + t.riskAmount, 0);
    
    const avgWin = winningTrades.length > 0 ? 
      winningTrades.reduce((sum, t) => sum + (t.pnl || 0), 0) / winningTrades.length : 0;
    const avgLoss = losingTrades.length > 0 ? 
      Math.abs(losingTrades.reduce((sum, t) => sum + (t.pnl || 0), 0)) / losingTrades.length : 0;
    
    const profitFactor = avgLoss > 0 ? avgWin / avgLoss : 0;
    
    // Calculate max drawdown
    let maxDrawdown = 0;
    let peak = 0;
    let runningTotal = 0;
    
    closedTrades.sort((a, b) => a.exitTime!.getTime() - b.exitTime!.getTime())
      .forEach(trade => {
        runningTotal += trade.pnl || 0;
        if (runningTotal > peak) peak = runningTotal;
        const drawdown = peak - runningTotal;
        if (drawdown > maxDrawdown) maxDrawdown = drawdown;
      });
    
    // Best/worst pairs
    const pairStats = trades.reduce((acc, t) => {
      if (!acc[t.pair]) acc[t.pair] = { wins: 0, total: 0, pnl: 0 };
      if (t.result === "WIN") acc[t.pair].wins++;
      acc[t.pair].total++;
      acc[t.pair].pnl += t.pnl || 0;
      return acc;
    }, {} as Record<string, { wins: number; total: number; pnl: number }>);
    
    const bestPair = Object.entries(pairStats)
      .sort(([,a], [,b]) => (b.wins / b.total) - (a.wins / a.total))[0]?.[0] || "N/A";
    const worstPair = Object.entries(pairStats)
      .sort(([,a], [,b]) => (a.wins / a.total) - (b.wins / b.total))[0]?.[0] || "N/A";
    
    // Best/worst strategies
    const strategyStats = trades.reduce((acc, t) => {
      if (!acc[t.strategy]) acc[t.strategy] = { wins: 0, total: 0, pnl: 0 };
      if (t.result === "WIN") acc[t.strategy].wins++;
      acc[t.strategy].total++;
      acc[t.strategy].pnl += t.pnl || 0;
      return acc;
    }, {} as Record<string, { wins: number; total: number; pnl: number }>);
    
    const bestStrategy = Object.entries(strategyStats)
      .sort(([,a], [,b]) => (b.wins / b.total) - (a.wins / a.total))[0]?.[0] || "N/A";
    const worstStrategy = Object.entries(strategyStats)
      .sort(([,a], [,b]) => (a.wins / a.total) - (b.wins / b.total))[0]?.[0] || "N/A";
    
    // Average holding time
    const avgHoldingTime = closedTrades.length > 0 ? 
      closedTrades.reduce((sum, t) => {
        const holdingTime = t.exitTime!.getTime() - t.entryTime.getTime();
        return sum + holdingTime;
      }, 0) / closedTrades.length / (1000 * 60 * 60) : 0; // in hours
    
    return {
      totalTrades: trades.length,
      winRate: closedTrades.length > 0 ? (winningTrades.length / closedTrades.length) * 100 : 0,
      avgWin,
      avgLoss,
      profitFactor,
      maxDrawdown,
      sharpeRatio: 0, // Would need more complex calculation
      bestPair,
      worstPair,
      bestStrategy,
      worstStrategy,
      avgHoldingTime,
      riskRewardRatio: totalRisk > 0 ? totalPnL / totalRisk : 0
    };
  }, [trades]);

  // Filtered and sorted trades
  const filteredTrades = useMemo(() => {
    let filtered = trades.filter(trade => {
      const matchesSearch = trade.pair.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           trade.strategy.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           trade.notes?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = filterStatus === "all" || trade.status === filterStatus;
      const matchesPair = filterPair === "all" || trade.pair === filterPair;
      const matchesStrategy = filterStrategy === "all" || trade.strategy === filterStrategy;
      
      return matchesSearch && matchesStatus && matchesPair && matchesStrategy;
    });
    
    // Sort trades
    filtered.sort((a, b) => {
      let aValue: any, bValue: any;
      
      switch (sortBy) {
        case "entryTime":
          aValue = a.entryTime.getTime();
          bValue = b.entryTime.getTime();
          break;
        case "pnl":
          aValue = a.pnl || 0;
          bValue = b.pnl || 0;
          break;
        case "confidence":
          aValue = a.confidence;
          bValue = b.confidence;
          break;
        case "pair":
          aValue = a.pair;
          bValue = b.pair;
          break;
        default:
          aValue = a.entryTime.getTime();
          bValue = b.entryTime.getTime();
      }
      
      if (sortOrder === "asc") {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });
    
    return filtered;
  }, [trades, searchTerm, filterStatus, filterPair, filterStrategy, sortBy, sortOrder]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "OPEN": return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300";
      case "CLOSED": return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300";
      case "CANCELLED": return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300";
      default: return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300";
    }
  };

  const getActionColor = (action: string) => {
    return action === "BUY" ? "bg-bullish/10 text-bullish" : "bg-bearish/10 text-bearish";
  };

  const getResultColor = (result?: string) => {
    if (!result) return "text-muted-foreground";
    return result === "WIN" ? "text-bullish" : "text-bearish";
  };

  const getMarketConditionColor = (condition: string) => {
    switch (condition) {
      case "TRENDING": return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300";
      case "RANGING": return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300";
      case "VOLATILE": return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300";
      default: return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300";
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-foreground">Trade Journal</h2>
          <p className="text-muted-foreground">Track and analyze your manual trades in real-time</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => window.location.reload()}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={() => setIsAddingTrade(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Add Trade
          </Button>
        </div>
      </div>

      {/* Performance Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-muted-foreground">Total Trades</div>
                <div className="text-2xl font-bold text-foreground">{analysis.totalTrades}</div>
              </div>
              <BookOpen className="w-8 h-8 text-primary" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-muted-foreground">Win Rate</div>
                <div className="text-2xl font-bold text-bullish">{analysis.winRate.toFixed(1)}%</div>
              </div>
              <Target className="w-8 h-8 text-bullish" />
            </div>
            <Progress value={analysis.winRate} className="mt-2 h-1" />
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-muted-foreground">Profit Factor</div>
                <div className="text-2xl font-bold text-accent">{analysis.profitFactor.toFixed(2)}</div>
              </div>
              <TrendingUp className="w-8 h-8 text-accent" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-muted-foreground">Max Drawdown</div>
                <div className="text-2xl font-bold text-bearish">${analysis.maxDrawdown.toFixed(0)}</div>
              </div>
              <TrendingDown className="w-8 h-8 text-bearish" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs defaultValue="journal" className="space-y-4">
        <TabsList>
          <TabsTrigger value="journal">Trade Journal</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="insights">AI Insights</TabsTrigger>
        </TabsList>

        <TabsContent value="journal" className="space-y-4">
          {/* Filters and Search */}
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                    <Input
                      placeholder="Search trades..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="OPEN">Open</SelectItem>
                    <SelectItem value="CLOSED">Closed</SelectItem>
                    <SelectItem value="CANCELLED">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
                
                <Select value={filterPair} onValueChange={setFilterPair}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="Pair" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Pairs</SelectItem>
                    {Array.from(new Set(trades.map(t => t.pair))).map(pair => (
                      <SelectItem key={pair} value={pair}>{pair}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="Sort by" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="entryTime">Entry Time</SelectItem>
                    <SelectItem value="pnl">P&L</SelectItem>
                    <SelectItem value="confidence">Confidence</SelectItem>
                    <SelectItem value="pair">Pair</SelectItem>
                  </SelectContent>
                </Select>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
                >
                  {sortOrder === "asc" ? "↑" : "↓"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Trades Table */}
          <Card>
            <CardHeader>
              <CardTitle>Trade History</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {filteredTrades.map((trade) => (
                  <div key={trade.id} className="border border-border/30 rounded-lg p-4 hover:bg-muted/50 transition-colors">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <Badge className={getActionColor(trade.action)} variant="outline">
                          {trade.action}
                        </Badge>
                        <span className="font-semibold text-foreground">{trade.pair}</span>
                        <Badge className={getStatusColor(trade.status)} variant="outline">
                          {trade.status}
                        </Badge>
                        {trade.result && (
                          <Badge className={getResultColor(trade.result)} variant="outline">
                            {trade.result}
                          </Badge>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Button variant="ghost" size="sm">
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm">
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <div className="text-muted-foreground">Entry Price</div>
                        <div className="font-medium">{trade.entryPrice}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Quantity</div>
                        <div className="font-medium">{trade.quantity.toLocaleString()}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Confidence</div>
                        <div className="font-medium">{trade.confidence}%</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">P&L</div>
                        <div className={`font-medium ${getResultColor(trade.result)}`}>
                          {trade.pnl ? `$${trade.pnl.toFixed(2)}` : "—"}
                        </div>
                      </div>
                    </div>
                    
                    <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {trade.entryTime.toLocaleString()}
                      </div>
                      <div className="flex items-center gap-1">
                        <Target className="w-3 h-3" />
                        {trade.strategy}
                      </div>
                      <Badge className={getMarketConditionColor(trade.marketCondition)} variant="outline">
                        {trade.marketCondition}
                      </Badge>
                      {trade.newsImpact && (
                        <Badge variant="outline">
                          News: {trade.newsImpact}
                        </Badge>
                      )}
                    </div>
                    
                    {trade.notes && (
                      <div className="mt-3 p-3 bg-muted/30 rounded-md">
                        <div className="text-sm font-medium text-muted-foreground mb-1">Notes</div>
                        <div className="text-sm">{trade.notes}</div>
                      </div>
                    )}
                  </div>
                ))}
                
                {filteredTrades.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <BookOpen className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No trades found matching your criteria</p>
                    <p className="text-sm">Try adjusting your filters or add your first trade</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          {/* Analytics content will go here */}
          <Card>
            <CardHeader>
              <CardTitle>Performance Analytics</CardTitle>
            </CardHeader>
            <CardContent>
              <p>Analytics dashboard coming soon...</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="insights" className="space-y-4">
          {/* AI Insights content will go here */}
          <Card>
            <CardHeader>
              <CardTitle>AI Trading Insights</CardTitle>
            </CardHeader>
            <CardContent>
              <p>AI insights coming soon...</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};