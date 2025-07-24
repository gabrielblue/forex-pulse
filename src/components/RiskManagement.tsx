import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { 
  Shield, 
  AlertTriangle, 
  DollarSign, 
  TrendingDown, 
  Zap,
  Lock,
  Target
} from "lucide-react";

export const RiskManagement = () => {
  const [riskSettings, setRiskSettings] = useState({
    maxRiskPerTrade: [2], // Percentage
    maxDailyLoss: [5], // Percentage
    maxDrawdown: [15], // Percentage
    maxPositionSize: [10000], // USD
    useStopLoss: true,
    useTakeProfit: true,
    useTrailingStop: false,
    emergencyStopEnabled: true,
    maxLeverage: [1], // 1:1 to 1:30
    accountBalance: 50000,
    usedMargin: 8500,
    freeMargin: 41500
  });

  const [circuitBreakers, setCircuitBreakers] = useState({
    volatilityThreshold: [5], // Percentage
    newsEventPause: true,
    marketHoursOnly: false,
    maxSlippage: [0.5] // Pips
  });

  const marginUsage = (riskSettings.usedMargin / riskSettings.accountBalance) * 100;
  const dailyRiskUsed = 2.3; // Mock current daily risk

  return (
    <div className="space-y-6">
      {/* Account Overview */}
      <Card className="p-4 border border-border/30">
        <div className="flex items-center space-x-2 mb-4">
          <DollarSign className="w-4 h-4 text-bullish" />
          <h3 className="font-semibold text-foreground">Account Overview</h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-3 rounded-lg bg-muted/30">
            <div className="text-sm text-muted-foreground">Account Balance</div>
            <div className="text-xl font-bold text-foreground">
              ${riskSettings.accountBalance.toLocaleString()}
            </div>
          </div>
          <div className="p-3 rounded-lg bg-muted/30">
            <div className="text-sm text-muted-foreground">Used Margin</div>
            <div className="text-xl font-bold text-bearish">
              ${riskSettings.usedMargin.toLocaleString()}
            </div>
            <Progress value={marginUsage} className="mt-2 h-2" />
            <div className="text-xs text-muted-foreground mt-1">
              {marginUsage.toFixed(1)}% of balance
            </div>
          </div>
          <div className="p-3 rounded-lg bg-muted/30">
            <div className="text-sm text-muted-foreground">Free Margin</div>
            <div className="text-xl font-bold text-bullish">
              ${riskSettings.freeMargin.toLocaleString()}
            </div>
          </div>
        </div>
      </Card>

      {/* Position Sizing */}
      <Card className="p-4 border border-border/30">
        <div className="flex items-center space-x-2 mb-4">
          <Target className="w-4 h-4 text-primary" />
          <h3 className="font-semibold text-foreground">Position Sizing</h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div>
              <Label>Risk Per Trade</Label>
              <div className="px-3 mt-2">
                <Slider
                  value={riskSettings.maxRiskPerTrade}
                  onValueChange={(value) => setRiskSettings(prev => ({ 
                    ...prev, 
                    maxRiskPerTrade: value 
                  }))}
                  max={10}
                  min={0.5}
                  step={0.1}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                  <span>0.5%</span>
                  <span className="font-medium">{riskSettings.maxRiskPerTrade[0]}%</span>
                  <span>10%</span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Max risk: ${(riskSettings.accountBalance * riskSettings.maxRiskPerTrade[0] / 100).toLocaleString()}
              </p>
            </div>

            <div>
              <Label>Max Position Size (USD)</Label>
              <Input
                type="number"
                value={riskSettings.maxPositionSize[0]}
                onChange={(e) => setRiskSettings(prev => ({ 
                  ...prev, 
                  maxPositionSize: [parseInt(e.target.value) || 10000] 
                }))}
                className="mt-2"
              />
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <Label>Max Leverage</Label>
              <div className="px-3 mt-2">
                <Slider
                  value={riskSettings.maxLeverage}
                  onValueChange={(value) => setRiskSettings(prev => ({ 
                    ...prev, 
                    maxLeverage: value 
                  }))}
                  max={30}
                  min={1}
                  step={1}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                  <span>1:1</span>
                  <span className="font-medium">1:{riskSettings.maxLeverage[0]}</span>
                  <span>1:30</span>
                </div>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
              <div className="flex items-center space-x-2">
                <Shield className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium text-primary">
                  Conservative leverage recommended
                </span>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Loss Limits */}
      <Card className="p-4 border border-border/30">
        <div className="flex items-center space-x-2 mb-4">
          <TrendingDown className="w-4 h-4 text-bearish" />
          <h3 className="font-semibold text-foreground">Loss Limits</h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <Label>Daily Loss Limit</Label>
            <div className="px-3 mt-2">
              <Slider
                value={riskSettings.maxDailyLoss}
                onValueChange={(value) => setRiskSettings(prev => ({ 
                  ...prev, 
                  maxDailyLoss: value 
                }))}
                max={20}
                min={1}
                step={0.5}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                <span>1%</span>
                <span className="font-medium">{riskSettings.maxDailyLoss[0]}%</span>
                <span>20%</span>
              </div>
            </div>
            <div className="mt-3 p-2 rounded bg-muted/30">
              <div className="flex justify-between text-sm">
                <span>Today's Risk Used:</span>
                <span className={dailyRiskUsed >= riskSettings.maxDailyLoss[0] ? 'text-bearish font-medium' : 'text-foreground'}>
                  {dailyRiskUsed}%
                </span>
              </div>
              <Progress 
                value={(dailyRiskUsed / riskSettings.maxDailyLoss[0]) * 100} 
                className="mt-1 h-2" 
              />
            </div>
          </div>

          <div>
            <Label>Max Drawdown</Label>
            <div className="px-3 mt-2">
              <Slider
                value={riskSettings.maxDrawdown}
                onValueChange={(value) => setRiskSettings(prev => ({ 
                  ...prev, 
                  maxDrawdown: value 
                }))}
                max={50}
                min={5}
                step={1}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                <span>5%</span>
                <span className="font-medium">{riskSettings.maxDrawdown[0]}%</span>
                <span>50%</span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Bot will stop trading if drawdown exceeds this limit
            </p>
          </div>
        </div>
      </Card>

      {/* Trade Management */}
      <Card className="p-4 border border-border/30">
        <div className="flex items-center space-x-2 mb-4">
          <Lock className="w-4 h-4 text-accent" />
          <h3 className="font-semibold text-foreground">Trade Management</h3>
        </div>
        
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>Stop Loss</Label>
              <p className="text-sm text-muted-foreground">Automatically set stop loss on every trade</p>
            </div>
            <Switch
              checked={riskSettings.useStopLoss}
              onCheckedChange={(checked) => 
                setRiskSettings(prev => ({ ...prev, useStopLoss: checked }))
              }
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div>
              <Label>Take Profit</Label>
              <p className="text-sm text-muted-foreground">Automatically set take profit targets</p>
            </div>
            <Switch
              checked={riskSettings.useTakeProfit}
              onCheckedChange={(checked) => 
                setRiskSettings(prev => ({ ...prev, useTakeProfit: checked }))
              }
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div>
              <Label>Trailing Stop</Label>
              <p className="text-sm text-muted-foreground">Move stop loss to protect profits</p>
            </div>
            <Switch
              checked={riskSettings.useTrailingStop}
              onCheckedChange={(checked) => 
                setRiskSettings(prev => ({ ...prev, useTrailingStop: checked }))
              }
            />
          </div>
        </div>
      </Card>

      {/* Circuit Breakers */}
      <Card className="p-4 border border-border/30">
        <div className="flex items-center space-x-2 mb-4">
          <Zap className="w-4 h-4 text-warning" />
          <h3 className="font-semibold text-foreground">Circuit Breakers</h3>
        </div>
        
        <div className="space-y-4">
          <div>
            <Label>Volatility Threshold</Label>
            <div className="px-3 mt-2">
              <Slider
                value={circuitBreakers.volatilityThreshold}
                onValueChange={(value) => setCircuitBreakers(prev => ({ 
                  ...prev, 
                  volatilityThreshold: value 
                }))}
                max={20}
                min={1}
                step={0.5}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                <span>1%</span>
                <span className="font-medium">{circuitBreakers.volatilityThreshold[0]}%</span>
                <span>20%</span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Pause trading when volatility exceeds threshold
            </p>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label>News Event Pause</Label>
              <p className="text-sm text-muted-foreground">Stop trading during high-impact news</p>
            </div>
            <Switch
              checked={circuitBreakers.newsEventPause}
              onCheckedChange={(checked) => 
                setCircuitBreakers(prev => ({ ...prev, newsEventPause: checked }))
              }
            />
          </div>
        </div>
      </Card>

      {/* Emergency Controls */}
      <Card className="p-4 border border-bearish/30 bg-bearish/5">
        <div className="flex items-center space-x-2 mb-4">
          <AlertTriangle className="w-4 h-4 text-bearish" />
          <h3 className="font-semibold text-foreground">Emergency Controls</h3>
          <Badge variant="destructive" className="ml-auto">
            {riskSettings.emergencyStopEnabled ? "ARMED" : "DISABLED"}
          </Badge>
        </div>
        
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>Emergency Stop</Label>
              <p className="text-sm text-muted-foreground">Enable emergency stop-all functionality</p>
            </div>
            <Switch
              checked={riskSettings.emergencyStopEnabled}
              onCheckedChange={(checked) => 
                setRiskSettings(prev => ({ ...prev, emergencyStopEnabled: checked }))
              }
            />
          </div>

          <div className="flex space-x-3">
            <Button variant="destructive" size="sm" className="flex-1">
              STOP ALL TRADES
            </Button>
            <Button variant="outline" size="sm" className="flex-1">
              Close All Positions
            </Button>
          </div>
        </div>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button className="bg-primary hover:bg-primary/90">
          Save Risk Settings
        </Button>
      </div>
    </div>
  );
};