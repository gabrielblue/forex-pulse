import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { 
  Bot, 
  Play, 
  Pause, 
  Settings, 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle,
  DollarSign,
  Activity,
  Clock
} from "lucide-react";
import { StrategyControls } from "./StrategyControls";
import { RiskManagement } from "./RiskManagement";
import { BotStatus } from "./BotStatus";

export const TradingBotDashboard = () => {
  const [botActive, setBotActive] = useState(false);
  const [autoTrade, setAutoTrade] = useState(false);
  const [selectedTab, setSelectedTab] = useState<"status" | "strategy" | "risk">("status");

  const stats = {
    totalTrades: 47,
    winRate: 78.2,
    dailyPnL: 2.34,
    weeklyPnL: 8.91,
    activePairs: 6,
    lastSignal: "2 minutes ago"
  };

  const handleBotToggle = () => {
    setBotActive(!botActive);
    if (!botActive) {
      // Bot starting logic here
      console.log("Trading bot starting...");
    } else {
      // Bot stopping logic here
      console.log("Trading bot stopping...");
    }
  };

  return (
    <Card className="p-6 bg-gradient-to-br from-card to-card/80 border-border/50">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <div className={`p-2 rounded-lg ${botActive ? 'bg-bullish/10' : 'bg-muted'}`}>
            <Bot className={`w-5 h-5 ${botActive ? 'text-bullish animate-pulse' : 'text-muted-foreground'}`} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-foreground">Trading Bot</h2>
            <p className="text-muted-foreground text-sm">Automated forex trading system</p>
          </div>
        </div>
        <div className="flex items-center space-x-4">
          <Badge variant={botActive ? "default" : "secondary"} className={botActive ? "bg-bullish" : ""}>
            {botActive ? "ACTIVE" : "INACTIVE"}
          </Badge>
          <Button
            onClick={handleBotToggle}
            variant={botActive ? "destructive" : "default"}
            className="flex items-center space-x-2"
          >
            {botActive ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            <span>{botActive ? "Stop Bot" : "Start Bot"}</span>
          </Button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="p-3 rounded-lg bg-muted/30 border border-border/30">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-muted-foreground">Total Trades</div>
              <div className="text-lg font-semibold text-foreground">{stats.totalTrades}</div>
            </div>
            <Activity className="w-4 h-4 text-accent" />
          </div>
        </div>
        <div className="p-3 rounded-lg bg-muted/30 border border-border/30">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-muted-foreground">Win Rate</div>
              <div className="text-lg font-semibold text-bullish">{stats.winRate}%</div>
            </div>
            <TrendingUp className="w-4 h-4 text-bullish" />
          </div>
        </div>
        <div className="p-3 rounded-lg bg-muted/30 border border-border/30">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-muted-foreground">Daily P&L</div>
              <div className={`text-lg font-semibold ${stats.dailyPnL >= 0 ? 'text-bullish' : 'text-bearish'}`}>
                {stats.dailyPnL >= 0 ? '+' : ''}{stats.dailyPnL}%
              </div>
            </div>
            <DollarSign className="w-4 h-4 text-accent" />
          </div>
        </div>
        <div className="p-3 rounded-lg bg-muted/30 border border-border/30">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-muted-foreground">Active Pairs</div>
              <div className="text-lg font-semibold text-foreground">{stats.activePairs}</div>
            </div>
            <Settings className="w-4 h-4 text-primary" />
          </div>
        </div>
      </div>

      {/* Auto-Trade Toggle */}
      <div className="flex items-center justify-between p-4 rounded-lg bg-primary/5 border border-primary/20 mb-6">
        <div className="flex items-center space-x-3">
          <AlertTriangle className="w-5 h-5 text-primary" />
          <div>
            <div className="font-medium text-foreground">Auto-Trading</div>
            <div className="text-sm text-muted-foreground">Execute trades automatically based on signals</div>
          </div>
        </div>
        <Switch
          checked={autoTrade}
          onCheckedChange={setAutoTrade}
          disabled={!botActive}
        />
      </div>

      {/* Tab Navigation */}
      <div className="flex space-x-1 mb-6 p-1 bg-muted/30 rounded-lg">
        {[
          { id: "status", label: "Status", icon: Activity },
          { id: "strategy", label: "Strategy", icon: Settings },
          { id: "risk", label: "Risk", icon: AlertTriangle }
        ].map((tab) => (
          <Button
            key={tab.id}
            variant={selectedTab === tab.id ? "default" : "ghost"}
            size="sm"
            onClick={() => setSelectedTab(tab.id as any)}
            className={`flex-1 flex items-center space-x-2 ${
              selectedTab === tab.id 
                ? "bg-primary text-primary-foreground shadow-md" 
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <tab.icon className="w-4 h-4" />
            <span>{tab.label}</span>
          </Button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="animate-fade-in">
        {selectedTab === "status" && <BotStatus stats={stats} botActive={botActive} />}
        {selectedTab === "strategy" && <StrategyControls />}
        {selectedTab === "risk" && <RiskManagement />}
      </div>

      {/* Footer */}
      <Separator className="my-6" />
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <div className="flex items-center space-x-2">
          <Clock className="w-4 h-4" />
          <span>Last signal: {stats.lastSignal}</span>
        </div>
        <div>
          {botActive ? "Bot is monitoring markets..." : "Bot is offline"}
        </div>
      </div>
    </Card>
  );
};