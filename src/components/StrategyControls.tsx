import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Target, Clock, TrendingUp, Brain, Filter } from "lucide-react";

export const StrategyControls = () => {
  const [strategy, setStrategy] = useState({
    signalConfidence: [80],
    timeframes: ["4H", "1D"],
    maxConcurrentTrades: 5,
    tradingHours: "24/7",
    pairs: ["EUR/USD", "GBP/USD", "USD/JPY"],
    useAiPredictions: true,
    useTechnicalAnalysis: true,
    useNewsFilter: true,
    takeProfitRatio: 2.0,
    stopLossRatio: 1.0
  });

  const timeframeOptions = ["1H", "4H", "1D", "1W"];
  const tradingHoursOptions = ["24/7", "London Session", "NY Session", "Tokyo Session", "Custom"];
  const currencyPairs = [
    "EUR/USD", "GBP/USD", "USD/JPY", "AUD/USD", "USD/CAD", 
    "USD/CHF", "NZD/USD", "EUR/GBP", "EUR/JPY", "GBP/JPY"
  ];

  const handleTimeframeToggle = (timeframe: string) => {
    setStrategy(prev => ({
      ...prev,
      timeframes: prev.timeframes.includes(timeframe)
        ? prev.timeframes.filter(tf => tf !== timeframe)
        : [...prev.timeframes, timeframe]
    }));
  };

  const handlePairToggle = (pair: string) => {
    setStrategy(prev => ({
      ...prev,
      pairs: prev.pairs.includes(pair)
        ? prev.pairs.filter(p => p !== pair)
        : [...prev.pairs, pair]
    }));
  };

  return (
    <div className="space-y-6">
      {/* Signal Configuration */}
      <Card className="p-4 border border-border/30">
        <div className="flex items-center space-x-2 mb-4">
          <Brain className="w-4 h-4 text-primary" />
          <h3 className="font-semibold text-foreground">Signal Configuration</h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="confidence">Minimum Signal Confidence</Label>
            <div className="px-3">
              <Slider
                id="confidence"
                aria-labelledby="confidence"
                value={strategy.signalConfidence}
                onValueChange={(value) => setStrategy(prev => ({ ...prev, signalConfidence: value }))}
                max={100}
                min={50}
                step={5}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                <span>50%</span>
                <span className="font-medium">{strategy.signalConfidence[0]}%</span>
                <span>100%</span>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Max Concurrent Trades</Label>
            <Input
              type="number"
              value={strategy.maxConcurrentTrades}
              onChange={(e) => setStrategy(prev => ({ 
                ...prev, 
                maxConcurrentTrades: parseInt(e.target.value) || 1 
              }))}
              min="1"
              max="20"
            />
          </div>
        </div>
      </Card>

      {/* Timeframes */}
      <Card className="p-4 border border-border/30">
        <div className="flex items-center space-x-2 mb-4">
          <Clock className="w-4 h-4 text-accent" />
          <h3 className="font-semibold text-foreground">Active Timeframes</h3>
        </div>
        
        <div className="flex flex-wrap gap-2">
          {timeframeOptions.map((timeframe) => (
            <Button
              key={timeframe}
              variant={strategy.timeframes.includes(timeframe) ? "default" : "outline"}
              size="sm"
              onClick={() => handleTimeframeToggle(timeframe)}
              className={strategy.timeframes.includes(timeframe) ? "bg-primary" : ""}
            >
              {timeframe}
            </Button>
          ))}
        </div>
      </Card>

      {/* Currency Pairs */}
      <Card className="p-4 border border-border/30">
        <div className="flex items-center space-x-2 mb-4">
          <TrendingUp className="w-4 h-4 text-bullish" />
          <h3 className="font-semibold text-foreground">Currency Pairs</h3>
          <Badge variant="outline" className="ml-auto">
            {strategy.pairs.length} selected
          </Badge>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {currencyPairs.map((pair) => (
            <Button
              key={pair}
              variant={strategy.pairs.includes(pair) ? "default" : "outline"}
              size="sm"
              onClick={() => handlePairToggle(pair)}
              className={`${strategy.pairs.includes(pair) ? "bg-primary" : ""} justify-start`}
            >
              {pair}
            </Button>
          ))}
        </div>
      </Card>

      {/* Trading Hours */}
      <Card className="p-4 border border-border/30">
        <div className="flex items-center space-x-2 mb-4">
          <Clock className="w-4 h-4 text-primary" />
          <h3 className="font-semibold text-foreground">Trading Hours</h3>
        </div>
        
        <Select value={strategy.tradingHours} onValueChange={(value) => 
          setStrategy(prev => ({ ...prev, tradingHours: value }))
        }>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {tradingHoursOptions.map((hours) => (
              <SelectItem key={hours} value={hours}>
                {hours}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Card>

      {/* Analysis Methods */}
      <Card className="p-4 border border-border/30">
        <div className="flex items-center space-x-2 mb-4">
          <Filter className="w-4 h-4 text-accent" />
          <h3 className="font-semibold text-foreground">Analysis Methods</h3>
        </div>
        
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="ai-predictions">AI Predictions</Label>
              <p className="text-sm text-muted-foreground">Use machine learning forecasts</p>
            </div>
            <Switch
              id="ai-predictions"
              checked={strategy.useAiPredictions}
              onCheckedChange={(checked) => 
                setStrategy(prev => ({ ...prev, useAiPredictions: checked }))
              }
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="technical-analysis">Technical Analysis</Label>
              <p className="text-sm text-muted-foreground">RSI, MACD, Moving averages</p>
            </div>
            <Switch
              id="technical-analysis"
              checked={strategy.useTechnicalAnalysis}
              onCheckedChange={(checked) => 
                setStrategy(prev => ({ ...prev, useTechnicalAnalysis: checked }))
              }
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="news-filter">News Filter</Label>
              <p className="text-sm text-muted-foreground">Avoid trading during high-impact news</p>
            </div>
            <Switch
              id="news-filter"
              checked={strategy.useNewsFilter}
              onCheckedChange={(checked) => 
                setStrategy(prev => ({ ...prev, useNewsFilter: checked }))
              }
            />
          </div>
        </div>
      </Card>

      {/* Risk-Reward Ratios */}
      <Card className="p-4 border border-border/30">
        <div className="flex items-center space-x-2 mb-4">
          <Target className="w-4 h-4 text-bullish" />
          <h3 className="font-semibold text-foreground">Risk-Reward Ratios</h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="take-profit">Take Profit Ratio</Label>
            <Input
              id="take-profit"
              type="number"
              step="0.1"
              value={strategy.takeProfitRatio}
              onChange={(e) => setStrategy(prev => ({ 
                ...prev, 
                takeProfitRatio: parseFloat(e.target.value) || 1.0 
              }))}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="stop-loss">Stop Loss Ratio</Label>
            <Input
              id="stop-loss"
              type="number"
              step="0.1"
              value={strategy.stopLossRatio}
              onChange={(e) => setStrategy(prev => ({ 
                ...prev, 
                stopLossRatio: parseFloat(e.target.value) || 1.0 
              }))}
            />
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Risk-Reward Ratio: 1:{(strategy.takeProfitRatio / strategy.stopLossRatio).toFixed(1)}
        </p>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button className="bg-primary hover:bg-primary/90">
          Save Strategy
        </Button>
      </div>
    </div>
  );
};