import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { 
  Activity, 
  TrendingUp, 
  TrendingDown, 
  Clock, 
  Target,
  AlertCircle,
  CheckCircle,
  XCircle
} from "lucide-react";

interface BotStatusProps {
  stats: {
    totalTrades: number;
    winRate: number;
    dailyPnL: number;
    weeklyPnL: number;
    activePairs: number;
    lastSignal: string;
  };
  botActive: boolean;
}

export const BotStatus = ({ stats, botActive }: BotStatusProps) => {
  const recentTrades = [
    { 
      pair: "EUR/USD", 
      action: "BUY", 
      result: "WIN", 
      pnl: "+0.8%", 
      time: "5 min ago",
      confidence: 87
    },
    { 
      pair: "GBP/USD", 
      action: "SELL", 
      result: "WIN", 
      pnl: "+1.2%", 
      time: "12 min ago",
      confidence: 92
    },
    { 
      pair: "USD/JPY", 
      action: "BUY", 
      result: "LOSS", 
      pnl: "-0.5%", 
      time: "28 min ago",
      confidence: 76
    },
    { 
      pair: "AUD/USD", 
      action: "SELL", 
      result: "WIN", 
      pnl: "+0.9%", 
      time: "1 hour ago",
      confidence: 83
    }
  ];

  const systemStatus = [
    { component: "Signal Generator", status: "online", uptime: "99.9%" },
    { component: "Risk Manager", status: "online", uptime: "100%" },
    { component: "Order Executor", status: botActive ? "online" : "offline", uptime: "98.7%" },
    { component: "News Monitor", status: "online", uptime: "99.2%" }
  ];

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "online":
        return <CheckCircle className="w-4 h-4 text-bullish" />;
      case "offline":
        return <XCircle className="w-4 h-4 text-bearish" />;
      case "warning":
        return <AlertCircle className="w-4 h-4 text-warning" />;
      default:
        return <AlertCircle className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getResultColor = (result: string) => {
    return result === "WIN" ? "text-bullish" : "text-bearish";
  };

  const getActionColor = (action: string) => {
    return action === "BUY" ? "bg-bullish/10 text-bullish" : "bg-bearish/10 text-bearish";
  };

  return (
    <div className="space-y-6">
      {/* Performance Metrics */}
      <Card className="p-4 border border-border/30">
        <div className="flex items-center space-x-2 mb-4">
          <Target className="w-4 h-4 text-bullish" />
          <h3 className="font-semibold text-foreground">Performance Overview</h3>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-foreground">{stats.totalTrades}</div>
            <div className="text-sm text-muted-foreground">Total Trades</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-bullish">{stats.winRate}%</div>
            <div className="text-sm text-muted-foreground">Win Rate</div>
            <Progress value={stats.winRate} className="mt-2 h-1" />
          </div>
          <div className="text-center">
            <div className={`text-2xl font-bold ${stats.dailyPnL >= 0 ? 'text-bullish' : 'text-bearish'}`}>
              {stats.dailyPnL >= 0 ? '+' : ''}{stats.dailyPnL}%
            </div>
            <div className="text-sm text-muted-foreground">Daily P&L</div>
          </div>
          <div className="text-center">
            <div className={`text-2xl font-bold ${stats.weeklyPnL >= 0 ? 'text-bullish' : 'text-bearish'}`}>
              {stats.weeklyPnL >= 0 ? '+' : ''}{stats.weeklyPnL}%
            </div>
            <div className="text-sm text-muted-foreground">Weekly P&L</div>
          </div>
        </div>
      </Card>

      {/* Recent Trades */}
      <Card className="p-4 border border-border/30">
        <div className="flex items-center space-x-2 mb-4">
          <Activity className="w-4 h-4 text-accent" />
          <h3 className="font-semibold text-foreground">Recent Trades</h3>
        </div>
        
        <div className="space-y-3">
          {recentTrades.map((trade, index) => (
            <div key={index} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/30">
              <div className="flex items-center space-x-3">
                <Badge className={getActionColor(trade.action)} variant="outline">
                  {trade.action}
                </Badge>
                <span className="font-medium text-foreground">{trade.pair}</span>
                <div className="flex items-center space-x-1">
                  {trade.result === "WIN" ? (
                    <TrendingUp className="w-3 h-3 text-bullish" />
                  ) : (
                    <TrendingDown className="w-3 h-3 text-bearish" />
                  )}
                  <span className={`text-sm font-medium ${getResultColor(trade.result)}`}>
                    {trade.result}
                  </span>
                </div>
              </div>
              
              <div className="flex items-center space-x-4 text-right">
                <div>
                  <div className={`font-semibold ${getResultColor(trade.result)}`}>
                    {trade.pnl}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {trade.confidence}% conf.
                  </div>
                </div>
                <div className="text-xs text-muted-foreground">
                  {trade.time}
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* System Status */}
      <Card className="p-4 border border-border/30">
        <div className="flex items-center space-x-2 mb-4">
          <Activity className="w-4 h-4 text-primary" />
          <h3 className="font-semibold text-foreground">System Status</h3>
          <Badge variant={botActive ? "default" : "secondary"} className={`ml-auto ${botActive ? "bg-bullish" : ""}`}>
            {botActive ? "ALL SYSTEMS OPERATIONAL" : "BOT OFFLINE"}
          </Badge>
        </div>
        
        <div className="space-y-3">
          {systemStatus.map((system, index) => (
            <div key={index} className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                {getStatusIcon(system.status)}
                <span className="text-foreground">{system.component}</span>
              </div>
              <div className="flex items-center space-x-4">
                <Badge variant="outline" className="text-xs">
                  {system.uptime} uptime
                </Badge>
                <Badge 
                  variant={system.status === "online" ? "default" : "destructive"}
                  className={system.status === "online" ? "bg-bullish" : ""}
                >
                  {system.status.toUpperCase()}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Current Activity */}
      <Card className="p-4 border border-border/30">
        <div className="flex items-center space-x-2 mb-4">
          <Clock className="w-4 h-4 text-accent" />
          <h3 className="font-semibold text-foreground">Current Activity</h3>
        </div>
        
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Monitoring pairs:</span>
            <span className="font-medium text-foreground">{stats.activePairs} pairs</span>
          </div>
          
          <Separator />
          
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Last signal generated:</span>
            <span className="font-medium text-foreground">{stats.lastSignal}</span>
          </div>
          
          <Separator />
          
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Next analysis cycle:</span>
            <span className="font-medium text-foreground">
              {botActive ? "In 3 minutes" : "Pending bot start"}
            </span>
          </div>
          
          <Separator />
          
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Risk exposure:</span>
            <div className="flex items-center space-x-2">
              <Progress value={34} className="w-16 h-2" />
              <span className="font-medium text-foreground">34%</span>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
};