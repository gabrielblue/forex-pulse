import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Brain, TrendingUp, TrendingDown, Target, Zap, AlertTriangle } from "lucide-react";

interface Prediction {
  id: string;
  symbol: string;
  direction: "BUY" | "SELL";
  confidence: number;
  targetPrice: number;
  currentPrice: number;
  timeframe: string;
  reasoning: string;
  stopLoss: number;
  takeProfit: number;
  riskReward: number;
  timestamp: Date;
}

// NOTE: This component shows example predictions for UI demonstration
// Real predictions use the AI analysis system integrated with the bot
const examplePredictions: Prediction[] = [
  {
    id: "1",
    symbol: "EURUSD",
    direction: "BUY",
    confidence: 87,
    targetPrice: 1.0920,
    currentPrice: 1.0895,
    timeframe: "15M",
    reasoning: "Strong bullish momentum with RSI oversold recovery and MACD crossover",
    stopLoss: 1.0875,
    takeProfit: 1.0920,
    riskReward: 1.25,
    timestamp: new Date()
  },
  {
    id: "2", 
    symbol: "GBPUSD",
    direction: "SELL",
    confidence: 73,
    targetPrice: 1.2700,
    currentPrice: 1.2745,
    timeframe: "5M",
    reasoning: "Bearish divergence detected, resistance at 1.2750 level",
    stopLoss: 1.2765,
    takeProfit: 1.2700,
    riskReward: 2.25,
    timestamp: new Date()
  },
  {
    id: "3",
    symbol: "USDJPY", 
    direction: "BUY",
    confidence: 91,
    targetPrice: 150.20,
    currentPrice: 149.82,
    timeframe: "1H",
    reasoning: "Break above key resistance, strong USD momentum confirmed",
    stopLoss: 149.50,
    takeProfit: 150.20,
    riskReward: 1.19,
    timestamp: new Date()
  }
];

export const AIPredictionSystem = () => {
  const [predictions] = useState<Prediction[]>(examplePredictions);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiStatus, setAiStatus] = useState<"active" | "analyzing" | "idle">("active");

  useEffect(() => {
    // Simulate AI analysis cycle
    const interval = setInterval(() => {
      setIsAnalyzing(true);
      setAiStatus("analyzing");
      
      setTimeout(() => {
        setIsAnalyzing(false);
        setAiStatus("active");
      }, 3000);
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  const getPredictionIcon = (direction: string) => {
    return direction === "BUY" ? (
      <TrendingUp className="w-4 h-4 text-bullish" />
    ) : (
      <TrendingDown className="w-4 h-4 text-bearish" />
    );
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 80) return "text-bullish";
    if (confidence >= 60) return "text-accent";
    return "text-bearish";
  };

  return (
    <div className="space-y-6">
      {/* AI Status Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Brain className="w-6 h-6 text-primary" />
              </div>
              <div>
                <CardTitle>AI Trading Intelligence</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Advanced ML predictions • Real-time market analysis
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={aiStatus === "active" ? "default" : "secondary"}>
                {aiStatus === "analyzing" && <Zap className="w-3 h-3 mr-1 animate-pulse" />}
                {aiStatus === "active" ? "Active" : aiStatus === "analyzing" ? "Analyzing" : "Idle"}
              </Badge>
              {isAnalyzing && (
                <div className="w-2 h-2 bg-primary rounded-full animate-pulse"></div>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* AI Performance Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Accuracy (24h)</span>
              <Target className="w-4 h-4 text-muted-foreground" />
            </div>
            <div className="text-2xl font-bold text-bullish">89.3%</div>
            <Progress value={89.3} className="mt-2" />
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Win Rate</span>
              <TrendingUp className="w-4 h-4 text-muted-foreground" />
            </div>
            <div className="text-2xl font-bold text-bullish">76.8%</div>
            <div className="text-xs text-muted-foreground mt-1">142 wins / 185 trades</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Avg Risk/Reward</span>
              <AlertTriangle className="w-4 h-4 text-muted-foreground" />
            </div>
            <div className="text-2xl font-bold text-accent">1.67</div>
            <div className="text-xs text-muted-foreground mt-1">Optimal range</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Active Signals</span>
              <Brain className="w-4 h-4 text-muted-foreground" />
            </div>
            <div className="text-2xl font-bold text-primary">{predictions.length}</div>
            <div className="text-xs text-muted-foreground mt-1">High confidence</div>
          </CardContent>
        </Card>
      </div>

      {/* Current Predictions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="w-5 h-5" />
            Live AI Predictions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {predictions.map((prediction) => (
              <div key={prediction.id} className="p-4 rounded-lg border border-border/50 bg-card/50">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div className="flex items-center gap-3">
                    {getPredictionIcon(prediction.direction)}
                    <div>
                      <div className="font-semibold">{prediction.symbol}</div>
                      <div className="text-sm text-muted-foreground">{prediction.timeframe} • {prediction.direction}</div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className="font-semibold">
                        {prediction.currentPrice} → {prediction.targetPrice}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        R/R: {prediction.riskReward}
                      </div>
                    </div>
                    
                    <div className="text-right">
                      <Badge variant={prediction.confidence >= 80 ? "default" : "secondary"}>
                        {prediction.confidence}% confidence
                      </Badge>
                    </div>
                  </div>
                </div>
                
                <div className="mt-3 text-sm text-muted-foreground">
                  <strong>Analysis:</strong> {prediction.reasoning}
                </div>
                
                <div className="mt-3 flex flex-wrap gap-4 text-xs">
                  <span><strong>Stop Loss:</strong> {prediction.stopLoss}</span>
                  <span><strong>Take Profit:</strong> {prediction.takeProfit}</span>
                  <span><strong>Generated:</strong> {prediction.timestamp.toLocaleTimeString()}</span>
                </div>
              </div>
            ))}
          </div>
          
          <div className="mt-6 flex justify-center">
            <Button 
              variant="outline" 
              onClick={() => setIsAnalyzing(true)}
              disabled={isAnalyzing}
            >
              {isAnalyzing ? (
                <>
                  <Zap className="w-4 h-4 mr-2 animate-pulse" />
                  Analyzing Markets...
                </>
              ) : (
                <>
                  <Brain className="w-4 h-4 mr-2" />
                  Generate New Analysis
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};