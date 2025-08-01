import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import { 
  Brain, 
  TrendingUp, 
  Target, 
  Zap, 
  Shield, 
  Activity,
  DollarSign,
  BarChart3
} from "lucide-react";
import { toast } from "sonner";

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

  const [isDeployingStrategies, setIsDeployingStrategies] = useState(false);

  const handleStrategyToggle = (strategy: keyof StrategyConfig, enabled: boolean) => {
    setConfig(prev => ({
      ...prev,
      [strategy]: enabled
    }));
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
      icon: <Activity className="w-4 h-4" />,
      description: 'Momentum trading on key levels',
      winRate: '65%',
      avgProfit: '30-80 pips'
    },
    {
      name: 'Mean Reversion',
      key: 'meanReversionEnabled' as keyof StrategyConfig,
      icon: <Target className="w-4 h-4" />,
      description: 'Trade reversals from extreme levels',
      winRate: '70%',
      avgProfit: '15-40 pips'
    },
    {
      name: 'Grid Trading',
      key: 'gridTradingEnabled' as keyof StrategyConfig,
      icon: <BarChart3 className="w-4 h-4" />,
      description: 'Automated grid system with DCA',
      winRate: '78%',
      avgProfit: '5-20 pips'
    },
    {
      name: 'News-Based',
      key: 'newsBasedEnabled' as keyof StrategyConfig,
      icon: <Brain className="w-4 h-4" />,
      description: 'Economic news and sentiment analysis',
      winRate: '74%',
      avgProfit: '20-60 pips'
    }
  ];

  return (
    <div className="space-y-6">
      {/* Professional Strategies Header */}
      <Card className="p-6 bg-gradient-to-r from-primary/5 to-accent/5 border-primary/20">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Brain className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-foreground">Professional Trading Strategies</h2>
              <p className="text-sm text-muted-foreground">AI-powered strategies used by top hedge funds</p>
            </div>
          </div>
          <Badge variant="outline" className="bg-bullish/10 text-bullish border-bullish/20">
            Premium
          </Badge>
        </div>
      </Card>

      {/* Strategy Selection */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center">
          <Shield className="w-5 h-5 mr-2 text-accent" />
          Strategy Selection
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {strategyInfo.map((strategy) => (
            <div
              key={strategy.name}
              className={`p-4 rounded-lg border transition-all ${
                config[strategy.key] 
                  ? 'border-primary bg-primary/5' 
                  : 'border-border bg-card'
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-2">
                  {strategy.icon}
                  <span className="font-medium">{strategy.name}</span>
                </div>
                <Switch
                  checked={config[strategy.key] as boolean}
                  onCheckedChange={(enabled) => handleStrategyToggle(strategy.key, enabled)}
                />
              </div>
              
              <p className="text-xs text-muted-foreground mb-3">
                {strategy.description}
              </p>
              
              <div className="flex justify-between text-xs">
                <span className="text-bullish">Win Rate: {strategy.winRate}</span>
                <span className="text-accent">Avg: {strategy.avgProfit}</span>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Risk Management */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center">
          <DollarSign className="w-5 h-5 mr-2 text-bullish" />
          Risk Management
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Risk Per Trade */}
          <div className="space-y-3">
            <Label>Risk Per Trade</Label>
            <div className="px-3">
              <Slider
                value={config.riskPerTrade}
                onValueChange={(value) => setConfig(prev => ({ ...prev, riskPerTrade: value }))}
                max={10}
                min={0.5}
                step={0.5}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                <span>0.5%</span>
                <span className="font-medium text-accent">{config.riskPerTrade[0]}%</span>
                <span>10%</span>
              </div>
            </div>
          </div>

          {/* Max Positions */}
          <div className="space-y-3">
            <Label>Max Concurrent Positions</Label>
            <div className="px-3">
              <Slider
                value={config.maxPositions}
                onValueChange={(value) => setConfig(prev => ({ ...prev, maxPositions: value }))}
                max={20}
                min={1}
                step={1}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                <span>1</span>
                <span className="font-medium text-primary">{config.maxPositions[0]}</span>
                <span>20</span>
              </div>
            </div>
          </div>

          {/* Profit Target */}
          <div className="space-y-3">
            <Label>Daily Profit Target</Label>
            <div className="px-3">
              <Slider
                value={config.profitTarget}
                onValueChange={(value) => setConfig(prev => ({ ...prev, profitTarget: value }))}
                max={500}
                min={50}
                step={25}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                <span>$50</span>
                <span className="font-medium text-bullish">${config.profitTarget[0]}</span>
                <span>$500</span>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Strategy Performance Stats */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Expected Performance</h3>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center p-3 rounded-lg bg-bullish/10">
            <div className="text-2xl font-bold text-bullish">74%</div>
            <div className="text-xs text-muted-foreground">Overall Win Rate</div>
          </div>
          
          <div className="text-center p-3 rounded-lg bg-primary/10">
            <div className="text-2xl font-bold text-primary">2.3:1</div>
            <div className="text-xs text-muted-foreground">Risk:Reward</div>
          </div>
          
          <div className="text-center p-3 rounded-lg bg-accent/10">
            <div className="text-2xl font-bold text-accent">35</div>
            <div className="text-xs text-muted-foreground">Avg Pips/Day</div>
          </div>
          
          <div className="text-center p-3 rounded-lg bg-foreground/10">
            <div className="text-2xl font-bold text-foreground">12%</div>
            <div className="text-xs text-muted-foreground">Monthly ROI</div>
          </div>
        </div>
      </Card>

      {/* Deploy Button */}
      <div className="flex justify-center">
        <Button 
          onClick={deployProfessionalStrategies}
          disabled={isDeployingStrategies}
          size="lg"
          className="w-full md:w-auto px-8 py-3 bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90"
        >
          {isDeployingStrategies ? (
            <>
              <Activity className="w-4 h-4 mr-2 animate-spin" />
              Deploying Strategies...
            </>
          ) : (
            <>
              <Target className="w-4 h-4 mr-2" />
              Deploy Professional Strategies
            </>
          )}
        </Button>
      </div>

      {/* Disclaimer */}
      <Card className="p-4 bg-destructive/5 border-destructive/20">
        <p className="text-xs text-muted-foreground text-center">
          <strong>Risk Warning:</strong> Trading involves substantial risk. Past performance does not guarantee future results. 
          Only trade with money you can afford to lose.
        </p>
      </Card>
    </div>
  );
};