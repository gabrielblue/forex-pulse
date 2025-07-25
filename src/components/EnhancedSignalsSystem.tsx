import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  TrendingUp, 
  TrendingDown, 
  Clock,
  Target,
  AlertTriangle,
  CheckCircle,
  XCircle,
  BarChart3,
  Bell,
  Star,
  Filter,
  Download,
  RefreshCw
} from "lucide-react";

interface Signal {
  id: string;
  timestamp: Date;
  pair: string;
  type: "BUY" | "SELL";
  strength: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  entryPrice: number;
  currentPrice: number;
  targetPrice: number;
  stopLoss: number;
  confidence: number;
  source: string;
  reasoning: string;
  status: "ACTIVE" | "TRIGGERED" | "STOPPED" | "EXPIRED";
  pnlPips?: number;
  outcome?: "WIN" | "LOSS" | "PENDING";
}

interface SignalFilter {
  pair: string;
  strength: string;
  status: string;
  timeframe: string;
}

export const EnhancedSignalsSystem = () => {
  const [signals, setSignals] = useState<Signal[]>([]);
  const [filteredSignals, setFilteredSignals] = useState<Signal[]>([]);
  const [filter, setFilter] = useState<SignalFilter>({
    pair: "ALL",
    strength: "ALL",
    status: "ALL",
    timeframe: "24H"
  });
  const [selectedTab, setSelectedTab] = useState("live");
  
  // Mock signal generation
  useEffect(() => {
    const generateMockSignals = () => {
      const pairs = ["EUR/USD", "GBP/USD", "USD/JPY", "AUD/USD", "USD/CHF", "NZD/USD"];
      const strengths: Signal["strength"][] = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];
      const statuses: Signal["status"][] = ["ACTIVE", "TRIGGERED", "STOPPED", "EXPIRED"];
      const sources = ["Technical Analysis", "News Sentiment", "Economic Data", "Pattern Recognition"];
      
      const mockSignals: Signal[] = [];
      
      // Generate signals for the last 7 days
      for (let i = 0; i < 50; i++) {
        const timestamp = new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000);
        const pair = pairs[Math.floor(Math.random() * pairs.length)];
        const type = Math.random() > 0.5 ? "BUY" : "SELL";
        const strength = strengths[Math.floor(Math.random() * strengths.length)];
        const entryPrice = 1.0000 + Math.random() * 0.5;
        const currentPrice = entryPrice + (Math.random() - 0.5) * 0.02;
        const targetPrice = type === "BUY" ? entryPrice + 0.01 : entryPrice - 0.01;
        const stopLoss = type === "BUY" ? entryPrice - 0.005 : entryPrice + 0.005;
        
        let status = statuses[Math.floor(Math.random() * statuses.length)];
        let outcome: Signal["outcome"] = "PENDING";
        let pnlPips: number | undefined;
        
        if (status === "TRIGGERED") {
          outcome = "WIN";
          pnlPips = Math.random() * 50 + 10;
        } else if (status === "STOPPED") {
          outcome = "LOSS";
          pnlPips = -(Math.random() * 30 + 5);
        }
        
        mockSignals.push({
          id: `signal-${i}`,
          timestamp,
          pair,
          type,
          strength,
          entryPrice,
          currentPrice,
          targetPrice,
          stopLoss,
          confidence: Math.floor(Math.random() * 30) + 70,
          source: sources[Math.floor(Math.random() * sources.length)],
          reasoning: `Strong ${type.toLowerCase()} signal detected based on multiple confluence factors including trend analysis and momentum indicators.`,
          status,
          pnlPips,
          outcome
        });
      }
      
      return mockSignals.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    };

    setSignals(generateMockSignals());
  }, []);

  // Apply filters
  useEffect(() => {
    let filtered = [...signals];
    
    // Filter by pair
    if (filter.pair !== "ALL") {
      filtered = filtered.filter(signal => signal.pair === filter.pair);
    }
    
    // Filter by strength
    if (filter.strength !== "ALL") {
      filtered = filtered.filter(signal => signal.strength === filter.strength);
    }
    
    // Filter by status
    if (filter.status !== "ALL") {
      filtered = filtered.filter(signal => signal.status === filter.status);
    }
    
    // Filter by timeframe
    const now = new Date();
    const timeframeLimits = {
      "1H": 1 * 60 * 60 * 1000,
      "4H": 4 * 60 * 60 * 1000,
      "24H": 24 * 60 * 60 * 1000,
      "7D": 7 * 24 * 60 * 60 * 1000,
      "ALL": Infinity
    };
    
    const timeLimit = timeframeLimits[filter.timeframe as keyof typeof timeframeLimits];
    if (timeLimit !== Infinity) {
      filtered = filtered.filter(signal => 
        now.getTime() - signal.timestamp.getTime() <= timeLimit
      );
    }
    
    setFilteredSignals(filtered);
  }, [signals, filter]);

  const getStrengthColor = (strength: Signal["strength"]) => {
    switch (strength) {
      case "CRITICAL": return "bg-bearish text-bearish-foreground";
      case "HIGH": return "bg-primary text-primary-foreground";
      case "MEDIUM": return "bg-accent text-accent-foreground";
      case "LOW": return "bg-muted text-muted-foreground";
      default: return "bg-muted text-muted-foreground";
    }
  };

  const getStatusColor = (status: Signal["status"]) => {
    switch (status) {
      case "ACTIVE": return "bg-bullish text-bullish-foreground";
      case "TRIGGERED": return "bg-bullish text-bullish-foreground";
      case "STOPPED": return "bg-bearish text-bearish-foreground";
      case "EXPIRED": return "bg-muted text-muted-foreground";
      default: return "bg-muted text-muted-foreground";
    }
  };

  const getStatusIcon = (status: Signal["status"]) => {
    switch (status) {
      case "ACTIVE": return <Clock className="w-3 h-3" />;
      case "TRIGGERED": return <CheckCircle className="w-3 h-3" />;
      case "STOPPED": return <XCircle className="w-3 h-3" />;
      case "EXPIRED": return <AlertTriangle className="w-3 h-3" />;
      default: return <Clock className="w-3 h-3" />;
    }
  };

  const formatTime = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  const liveSignals = filteredSignals.filter(s => s.status === "ACTIVE");
  const historicalSignals = filteredSignals.filter(s => s.status !== "ACTIVE");
  
  const stats = {
    totalSignals: filteredSignals.length,
    activeSignals: liveSignals.length,
    winRate: historicalSignals.length > 0 
      ? (historicalSignals.filter(s => s.outcome === "WIN").length / historicalSignals.filter(s => s.outcome !== "PENDING").length * 100)
      : 0,
    avgPips: historicalSignals.filter(s => s.pnlPips).reduce((sum, s) => sum + (s.pnlPips || 0), 0) / Math.max(1, historicalSignals.filter(s => s.pnlPips).length)
  };

  return (
    <Card className="p-6 bg-gradient-to-br from-card to-card/80 border-border/50">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Bell className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-foreground">Trading Signals</h2>
            <p className="text-muted-foreground text-sm">AI-powered trading signals with historical tracking</p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" size="sm">
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
          <Button variant="outline" size="sm">
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="p-3 rounded-lg bg-muted/30 border border-border/30">
          <div className="text-sm text-muted-foreground">Total Signals</div>
          <div className="text-lg font-semibold text-foreground">{stats.totalSignals}</div>
        </div>
        <div className="p-3 rounded-lg bg-muted/30 border border-border/30">
          <div className="text-sm text-muted-foreground">Active</div>
          <div className="text-lg font-semibold text-bullish">{stats.activeSignals}</div>
        </div>
        <div className="p-3 rounded-lg bg-muted/30 border border-border/30">
          <div className="text-sm text-muted-foreground">Win Rate</div>
          <div className="text-lg font-semibold text-primary">{stats.winRate.toFixed(1)}%</div>
        </div>
        <div className="p-3 rounded-lg bg-muted/30 border border-border/30">
          <div className="text-sm text-muted-foreground">Avg Pips</div>
          <div className={`text-lg font-semibold ${stats.avgPips >= 0 ? 'text-bullish' : 'text-bearish'}`}>
            {stats.avgPips >= 0 ? '+' : ''}{stats.avgPips.toFixed(1)}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6 p-4 rounded-lg bg-muted/20 border border-border/30">
        <div className="flex items-center space-x-2">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Filters:</span>
        </div>
        <Select value={filter.pair} onValueChange={(value) => setFilter({...filter, pair: value})}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Pairs</SelectItem>
            <SelectItem value="EUR/USD">EUR/USD</SelectItem>
            <SelectItem value="GBP/USD">GBP/USD</SelectItem>
            <SelectItem value="USD/JPY">USD/JPY</SelectItem>
            <SelectItem value="AUD/USD">AUD/USD</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filter.strength} onValueChange={(value) => setFilter({...filter, strength: value})}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Strength</SelectItem>
            <SelectItem value="CRITICAL">Critical</SelectItem>
            <SelectItem value="HIGH">High</SelectItem>
            <SelectItem value="MEDIUM">Medium</SelectItem>
            <SelectItem value="LOW">Low</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filter.timeframe} onValueChange={(value) => setFilter({...filter, timeframe: value})}>
          <SelectTrigger className="w-24">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1H">1H</SelectItem>
            <SelectItem value="4H">4H</SelectItem>
            <SelectItem value="24H">24H</SelectItem>
            <SelectItem value="7D">7D</SelectItem>
            <SelectItem value="ALL">All</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Tabs */}
      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="live">Live Signals ({liveSignals.length})</TabsTrigger>
          <TabsTrigger value="history">History ({historicalSignals.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="live" className="mt-6">
          {liveSignals.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No active signals matching your filters.
            </div>
          ) : (
            <div className="space-y-3">
              {liveSignals.map(signal => (
                <div key={signal.id} className="p-4 rounded-lg bg-primary/5 border border-primary/20">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center space-x-3">
                      <Badge variant={signal.type === "BUY" ? "default" : "secondary"} 
                             className={signal.type === "BUY" ? "bg-bullish" : "bg-bearish"}>
                        {signal.type === "BUY" ? <TrendingUp className="w-3 h-3 mr-1" /> : <TrendingDown className="w-3 h-3 mr-1" />}
                        {signal.type}
                      </Badge>
                      <span className="font-semibold text-foreground">{signal.pair}</span>
                      <Badge className={getStrengthColor(signal.strength)}>
                        {signal.strength}
                      </Badge>
                      <div className="flex items-center space-x-1 text-sm text-muted-foreground">
                        <Star className="w-3 h-3" />
                        <span>{signal.confidence}%</span>
                      </div>
                    </div>
                    <div className="text-right text-sm text-muted-foreground">
                      {formatTime(signal.timestamp)}
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-3">
                    <div>
                      <div className="text-xs text-muted-foreground">Entry</div>
                      <div className="font-medium">{signal.entryPrice.toFixed(4)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Current</div>
                      <div className="font-medium">{signal.currentPrice.toFixed(4)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Target</div>
                      <div className="font-medium text-bullish">{signal.targetPrice.toFixed(4)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Stop Loss</div>
                      <div className="font-medium text-bearish">{signal.stopLoss.toFixed(4)}</div>
                    </div>
                  </div>

                  <div className="text-sm text-muted-foreground mb-2">
                    <span className="font-medium">Source:</span> {signal.source}
                  </div>
                  <div className="text-sm text-foreground">
                    {signal.reasoning}
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="history" className="mt-6">
          {historicalSignals.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No historical signals matching your filters.
            </div>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {historicalSignals.map(signal => (
                <div key={signal.id} className="p-3 rounded-lg bg-muted/10 border border-border/20">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <Badge variant={signal.type === "BUY" ? "default" : "secondary"} 
                             className={signal.type === "BUY" ? "bg-bullish/20 text-bullish" : "bg-bearish/20 text-bearish"}>
                        {signal.type}
                      </Badge>
                      <span className="font-medium">{signal.pair}</span>
                      <Badge className={getStatusColor(signal.status)}>
                        {getStatusIcon(signal.status)}
                        <span className="ml-1">{signal.status}</span>
                      </Badge>
                      <Badge className={getStrengthColor(signal.strength)}>
                        {signal.strength}
                      </Badge>
                    </div>
                    <div className="flex items-center space-x-4">
                      <div className="text-right text-sm">
                        <div className="text-muted-foreground">{formatTime(signal.timestamp)}</div>
                        <div className="text-muted-foreground">{signal.confidence}% confidence</div>
                      </div>
                      {signal.pnlPips && (
                        <div className={`font-semibold ${signal.pnlPips >= 0 ? 'text-bullish' : 'text-bearish'}`}>
                          {signal.pnlPips >= 0 ? '+' : ''}{signal.pnlPips.toFixed(1)} pips
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </Card>
  );
};