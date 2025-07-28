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
  Clock,
  Zap
} from "lucide-react";
import { StrategyControls } from "./StrategyControls";
import { RiskManagement } from "./RiskManagement";
import { BotStatus } from "./BotStatus";
import { useTradingBot } from "@/hooks/useTradingBot";
import { toast } from "sonner";

export const TradingBotDashboard = () => {
  const { 
    status, 
    configuration, 
    isLoading, 
    error, 
    startBot, 
    stopBot, 
    enableAutoTrading,
    generateTestSignal,
    clearError 
  } = useTradingBot();
  
  const [selectedTab, setSelectedTab] = useState<"status" | "strategy" | "risk">("status");

  const stats = {
    totalTrades: status.totalTrades,
    winRate: status.winRate,
    dailyPnL: status.dailyPnL,
    weeklyPnL: status.weeklyPnL,
    activePairs: configuration.enabledPairs.length,
    lastSignal: "2 minutes ago"
  };

  const handleBotToggle = () => {
    if (status.isActive) {
      stopBot().then(() => {
        toast.success("Trading bot stopped");
      }).catch((err) => {
        toast.error("Failed to stop bot: " + err.message);
      });
    } else {
      startBot().then(() => {
        toast.success("Trading bot started");
      }).catch((err) => {
        toast.error("Failed to start bot: " + err.message);
      });
    }
  };

  const handleAutoTradeToggle = (enabled: boolean) => {
    enableAutoTrading(enabled).then(() => {
      toast.success(`Auto trading ${enabled ? 'enabled' : 'disabled'}`);
    }).catch((err) => {
      toast.error("Failed to toggle auto trading: " + err.message);
    });
  };

  const handleGenerateTestSignal = () => {
    generateTestSignal().then(() => {
      toast.success("Test signal generated");
    }).catch((err) => {
      toast.error("Failed to generate test signal: " + err.message);
    });
  };

  return (
    <Card className="p-6 bg-gradient-to-br from-card to-card/80 border-border/50">
      {/* Error Display */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-500" />
            <span className="text-sm text-red-700 dark:text-red-300">{error}</span>
            <Button size="sm" variant="ghost" onClick={clearError}>×</Button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <div className={`p-2 rounded-lg ${status.isActive ? 'bg-bullish/10' : 'bg-muted'}`}>
            <Bot className={`w-5 h-5 ${status.isActive ? 'text-bullish animate-pulse' : 'text-muted-foreground'}`} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-foreground">Trading Bot</h2>
            <p className="text-muted-foreground text-sm">Automated forex trading system</p>
          </div>
        </div>
        <div className="flex items-center space-x-4">
          <Badge variant={status.isActive ? "default" : "secondary"} className={status.isActive ? "bg-bullish" : ""}>
            {status.isActive ? "ACTIVE" : "INACTIVE"}
          </Badge>
          <Button
            onClick={handleBotToggle}
            variant={status.isActive ? "destructive" : "default"}
            className="flex items-center space-x-2"
            disabled={isLoading}
          >
            {status.isActive ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            <span>{status.isActive ? "Stop Bot" : "Start Bot"}</span>
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
          checked={status.autoTradingEnabled}
          onCheckedChange={handleAutoTradeToggle}
          disabled={!status.isActive || isLoading}
        />
      </div>

      {/* Quick Actions */}
      <div className="flex gap-4 mb-6">
        <Button 
          onClick={handleGenerateTestSignal}
          variant="outline"
          disabled={isLoading}
          className="flex items-center gap-2"
        >
          <Zap className="w-4 h-4" />
          Generate Test Signal
        </Button>
        <Button variant="outline" disabled={isLoading}>
          View Live Trades
        </Button>
        <Button variant="outline" disabled={isLoading}>
          Performance Report
        </Button>
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
        {selectedTab === "status" && <BotStatus stats={stats} botActive={status.isActive} />}
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
          {status.isActive ? "Bot is monitoring markets..." : "Bot is offline"}
        </div>
      </div>
    </Card>
  );
};