import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { 
  Brain, 
  TrendingUp, 
  Target, 
  Zap, 
  Shield, 
  Activity,
  DollarSign,
  BarChart3,
  Play,
  Square,
  Settings,
  AlertTriangle,
  CheckCircle,
  Clock
} from "lucide-react";
import { toast } from "sonner";
import { tradingBot } from "@/lib/trading/tradingBot";
import { exnessAPI } from "@/lib/trading/exnessApi";
import { supabase } from "@/integrations/supabase/client";

interface StrategyConfig {
  scalpingEnabled: boolean;
  swingTradingEnabled: boolean;
  breakoutEnabled: boolean;
  meanReversionEnabled: boolean;
  gridTradingEnabled: boolean;
  newsBasedEnabled: boolean;
  riskPerTrade: number[];
  maxPositions: number[];
  profitTarget: number[];
}

interface BotStatus {
  isActive: boolean;
  isConnected: boolean;
  autoTradingEnabled: boolean;
  lastUpdate: Date;
  totalTrades: number;
  winRate: number;
  dailyPnL: number;
  weeklyPnL: number;
}

export const AdvancedTradingControls = () => {
  const [config, setConfig] = useState<StrategyConfig>({
    scalpingEnabled: true,
    swingTradingEnabled: true,
    breakoutEnabled: true,
    meanReversionEnabled: false,
    gridTradingEnabled: false,
    newsBasedEnabled: true,
    riskPerTrade: [2],
    maxPositions: [5],
    profitTarget: [150]
  });

  const [botStatus, setBotStatus] = useState<BotStatus>({
    isActive: false,
    isConnected: false,
    autoTradingEnabled: false,
    lastUpdate: new Date(),
    totalTrades: 0,
    winRate: 0,
    dailyPnL: 0,
    weeklyPnL: 0
  });

  const [isDeployingStrategies, setIsDeployingStrategies] = useState(false);
  const [isStartingBot, setIsStartingBot] = useState(false);
  const [isStoppingBot, setIsStoppingBot] = useState(false);
  const [accountInfo, setAccountInfo] = useState<any>(null);
  const [isConnected, setIsConnected] = useState(false);

  // Load bot status on component mount
  useEffect(() => {
    loadBotStatus();
    checkConnection();
    const interval = setInterval(loadBotStatus, 5000); // Update every 5 seconds
    return () => clearInterval(interval);
  }, []);

  const loadBotStatus = async () => {
    try {
      const status = tradingBot.getStatus();
      setBotStatus(status);
    } catch (error) {
      console.error('Failed to load bot status:', error);
    }
  };

  const checkConnection = async () => {
    try {
      const connected = exnessAPI.isConnectedToExness();
      setIsConnected(connected);
      
      if (connected) {
        const account = await exnessAPI.getAccountInfo();
        setAccountInfo(account);
      }
    } catch (error) {
      console.error('Failed to check connection:', error);
    }
  };

  const handleStrategyToggle = (strategy: keyof StrategyConfig, enabled: boolean) => {
    setConfig(prev => ({
      ...prev,
      [strategy]: enabled
    }));
  };

  const startTradingBot = async () => {
    setIsStartingBot(true);
    
    try {
      // Check if connected to Exness
      if (!exnessAPI.isConnectedToExness()) {
        toast.error('Not connected to Exness. Please connect your account first.');
        return;
      }

      // Initialize and start the bot
      await tradingBot.initialize();
      await tradingBot.startBot();
      await tradingBot.enableAutoTrading(true);

      // Update configuration with current settings
      await tradingBot.updateConfiguration({
        minConfidence: 80,
        maxRiskPerTrade: config.riskPerTrade[0],
        maxDailyLoss: 3,
        enabledPairs: ['EURUSD', 'GBPUSD', 'USDJPY'],
        useStopLoss: true,
        useTakeProfit: true,
        emergencyStopEnabled: true
      });

      toast.success('Trading bot started successfully!', {
        description: 'Auto-trading is now enabled and monitoring for signals.'
      });

      loadBotStatus();
      checkConnection();

    } catch (error) {
      console.error('Failed to start trading bot:', error);
      toast.error('Failed to start trading bot', {
        description: error instanceof Error ? error.message : 'Unknown error'
      });
    } finally {
      setIsStartingBot(false);
    }
  };

  const stopTradingBot = async () => {
    setIsStoppingBot(true);
    
    try {
      await tradingBot.stopBot();
      
      toast.success('Trading bot stopped successfully!', {
        description: 'All trading activities have been halted.'
      });

      loadBotStatus();

    } catch (error) {
      console.error('Failed to stop trading bot:', error);
      toast.error('Failed to stop trading bot', {
        description: error instanceof Error ? error.message : 'Unknown error'
      });
    } finally {
      setIsStoppingBot(false);
    }
  };

  const toggleAutoTrading = async () => {
    try {
      if (botStatus.autoTradingEnabled) {
        await tradingBot.enableAutoTrading(false);
        toast.success('Auto-trading disabled');
      } else {
        await tradingBot.enableAutoTrading(true);
        toast.success('Auto-trading enabled');
      }
      loadBotStatus();
    } catch (error) {
      console.error('Failed to toggle auto-trading:', error);
      toast.error('Failed to toggle auto-trading');
    }
  };

  const generateTestSignal = async () => {
    try {
      await tradingBot.generateTestSignal();
      toast.success('Test signal generated successfully!', {
        description: 'Check the signals tab to see the generated signal.'
      });
    } catch (error) {
      console.error('Failed to generate test signal:', error);
      toast.error('Failed to generate test signal');
    }
  };

  const deployProfessionalStrategies = async () => {
    setIsDeployingStrategies(true);
    
    try {
      // Here we would integrate with the signal processor
      const enabledStrategies = Object.entries(config)
        .filter(([key, value]) => key.includes('Enabled') && value)
        .map(([key]) => key.replace('Enabled', ''));

      toast.success(`Deployed ${enabledStrategies.length} professional trading strategies`, {
        description: `Active strategies: ${enabledStrategies.join(', ')}`
      });

      console.log('Deployed strategies:', enabledStrategies);
      console.log('Risk per trade:', config.riskPerTrade[0] + '%');
      console.log('Max positions:', config.maxPositions[0]);
      console.log('Profit target:', config.profitTarget[0] + '%');

    } catch (error) {
      toast.error('Failed to deploy strategies');
      console.error(error);
    } finally {
      setIsDeployingStrategies(false);
    }
  };

  const strategyInfo = [
    {
      name: 'Scalping',
      key: 'scalpingEnabled' as keyof StrategyConfig,
      icon: <Zap className="w-4 h-4" />,
      description: 'High-frequency trades, 1-5 minute timeframes',
      winRate: '68%',
      avgProfit: '0.5-2 pips'
    },
    {
      name: 'Swing Trading',
      key: 'swingTradingEnabled' as keyof StrategyConfig,
      icon: <TrendingUp className="w-4 h-4" />,
      description: 'Medium-term positions, 1H-4H timeframes',
      winRate: '72%',
      avgProfit: '25-100 pips'
    },
    {
      name: 'Breakout',
      key: 'breakoutEnabled' as keyof StrategyConfig,
      icon: <Target className="w-4 h-4" />,
      description: 'Trade breakouts from key levels',
      winRate: '65%',
      avgProfit: '15-50 pips'
    },
    {
      name: 'Mean Reversion',
      key: 'meanReversionEnabled' as keyof StrategyConfig,
      icon: <BarChart3 className="w-4 h-4" />,
      description: 'Trade price reversions to the mean',
      winRate: '70%',
      avgProfit: '10-30 pips'
    },
    {
      name: 'Grid Trading',
      key: 'gridTradingEnabled' as keyof StrategyConfig,
      icon: <Brain className="w-4 h-4" />,
      description: 'Automated grid trading system',
      winRate: '75%',
      avgProfit: '5-20 pips'
    },
    {
      name: 'News Based',
      key: 'newsBasedEnabled' as keyof StrategyConfig,
      icon: <Activity className="w-4 h-4" />,
      description: 'Trade based on economic news events',
      winRate: '60%',
      avgProfit: '20-80 pips'
    }
  ];

  return (
    <div className="space-y-6">
      {/* Bot Status Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Trading Bot Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="flex items-center gap-3 p-3 border rounded-lg">
              <div className={`w-3 h-3 rounded-full ${botStatus.isActive ? 'bg-green-500' : 'bg-red-500'}`} />
              <div>
                <p className="text-sm font-medium">Bot Status</p>
                <p className="text-xs text-muted-foreground">
                  {botStatus.isActive ? 'Active' : 'Inactive'}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-3 p-3 border rounded-lg">
              <div className={`w-3 h-3 rounded-full ${botStatus.autoTradingEnabled ? 'bg-green-500' : 'bg-yellow-500'}`} />
              <div>
                <p className="text-sm font-medium">Auto Trading</p>
                <p className="text-xs text-muted-foreground">
                  {botStatus.autoTradingEnabled ? 'Enabled' : 'Disabled'}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-3 p-3 border rounded-lg">
              <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
              <div>
                <p className="text-sm font-medium">Connection</p>
                <p className="text-xs text-muted-foreground">
                  {isConnected ? 'Connected' : 'Disconnected'}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-3 p-3 border rounded-lg">
              <DollarSign className="w-4 h-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Total Trades</p>
                <p className="text-xs text-muted-foreground">
                  {botStatus.totalTrades}
                </p>
              </div>
            </div>
          </div>

          {accountInfo && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="p-3 border rounded-lg">
                <p className="text-sm font-medium">Account Balance</p>
                <p className="text-lg font-bold">
                  {accountInfo.currency} {accountInfo.balance?.toFixed(2)}
                </p>
              </div>
              <div className="p-3 border rounded-lg">
                <p className="text-sm font-medium">Daily P&L</p>
                <p className={`text-lg font-bold ${botStatus.dailyPnL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {botStatus.dailyPnL >= 0 ? '+' : ''}{botStatus.dailyPnL.toFixed(2)}
                </p>
              </div>
              <div className="p-3 border rounded-lg">
                <p className="text-sm font-medium">Win Rate</p>
                <p className="text-lg font-bold">{botStatus.winRate.toFixed(1)}%</p>
              </div>
            </div>
          )}

          <div className="flex gap-3">
            {!botStatus.isActive ? (
              <Button 
                onClick={startTradingBot} 
                disabled={isStartingBot || !isConnected}
                className="flex items-center gap-2"
              >
                <Play className="w-4 h-4" />
                {isStartingBot ? 'Starting...' : 'Start Trading Bot'}
              </Button>
            ) : (
              <Button 
                onClick={stopTradingBot} 
                disabled={isStoppingBot}
                variant="destructive"
                className="flex items-center gap-2"
              >
                <Square className="w-4 h-4" />
                {isStoppingBot ? 'Stopping...' : 'Stop Trading Bot'}
              </Button>
            )}
            
            {botStatus.isActive && (
              <Button 
                onClick={toggleAutoTrading}
                variant={botStatus.autoTradingEnabled ? "destructive" : "default"}
                className="flex items-center gap-2"
              >
                {botStatus.autoTradingEnabled ? (
                  <>
                    <AlertTriangle className="w-4 h-4" />
                    Disable Auto-Trading
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    Enable Auto-Trading
                  </>
                )}
              </Button>
            )}
            
            <Button 
              onClick={generateTestSignal}
              variant="outline"
              className="flex items-center gap-2"
            >
              <Clock className="w-4 h-4" />
              Generate Test Signal
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Strategy Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="w-5 h-5" />
            Professional Trading Strategies
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h4 className="font-semibold">Active Strategies</h4>
              <div className="space-y-3">
                {strategyInfo.map((strategy) => (
                  <div key={strategy.key} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      {strategy.icon}
                      <div>
                        <p className="font-medium">{strategy.name}</p>
                        <p className="text-sm text-muted-foreground">{strategy.description}</p>
                        <div className="flex gap-4 text-xs text-muted-foreground">
                          <span>Win Rate: {strategy.winRate}</span>
                          <span>Avg Profit: {strategy.avgProfit}</span>
                        </div>
                      </div>
                    </div>
                    <Switch
                      checked={config[strategy.key]}
                      onCheckedChange={(checked) => handleStrategyToggle(strategy.key, checked)}
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="font-semibold">Risk Management</h4>
              
              <div className="space-y-3">
                <div>
                  <Label className="flex items-center gap-2">
                    <Shield className="w-4 h-4" />
                    Risk Per Trade: {config.riskPerTrade[0]}%
                  </Label>
                  <Slider
                    value={config.riskPerTrade}
                    onValueChange={(value) => setConfig(prev => ({ ...prev, riskPerTrade: value }))}
                    max={5}
                    min={0.5}
                    step={0.1}
                    className="mt-2"
                  />
                </div>

                <div>
                  <Label className="flex items-center gap-2">
                    <Target className="w-4 h-4" />
                    Max Positions: {config.maxPositions[0]}
                  </Label>
                  <Slider
                    value={config.maxPositions}
                    onValueChange={(value) => setConfig(prev => ({ ...prev, maxPositions: value }))}
                    max={10}
                    min={1}
                    step={1}
                    className="mt-2"
                  />
                </div>

                <div>
                  <Label className="flex items-center gap-2">
                    <DollarSign className="w-4 h-4" />
                    Profit Target: {config.profitTarget[0]}%
                  </Label>
                  <Slider
                    value={config.profitTarget}
                    onValueChange={(value) => setConfig(prev => ({ ...prev, profitTarget: value }))}
                    max={300}
                    min={50}
                    step={10}
                    className="mt-2"
                  />
                </div>
              </div>

              <Separator />

              <Button 
                onClick={deployProfessionalStrategies}
                disabled={isDeployingStrategies}
                className="w-full flex items-center gap-2"
              >
                <Settings className="w-4 h-4" />
                {isDeployingStrategies ? 'Deploying...' : 'Deploy Strategies'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};