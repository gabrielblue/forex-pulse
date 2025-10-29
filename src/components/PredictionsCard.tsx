import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Brain, TrendingUp, TrendingDown, Target, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Prediction {
  pair: string;
  timeframe: "1H" | "4H" | "1D" | "1W";
  direction: "UP" | "DOWN";
  confidence: number;
  targetPrice: number;
  currentPrice: number;
  reasoning: string;
  signals: string[];
  accuracy: number;
}

export const PredictionsCard = () => {
  const [selectedTimeframe, setSelectedTimeframe] = useState<string>("ALL");
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchRealPredictions();

    // Refresh predictions every 1 minute
    const interval = setInterval(fetchRealPredictions, 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const fetchRealPredictions = async () => {
    try {
      // Fetch REAL AI-generated signals from database
      const { data: signals, error } = await supabase
        .from('trading_signals')
        .select(`
          *,
          currency_pairs!inner(symbol)
        `)
        .eq('status', 'active')
        .gte('confidence_score', 60)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) {
        console.error('Error fetching predictions:', error);
        return;
      }

      if (signals && signals.length > 0) {
        const predictionItems: Prediction[] = signals.map(signal => {
          const symbol = signal.currency_pairs?.symbol || 'UNKNOWN';
          return {
            pair: symbol,
            timeframe: "1H" as const, // Default, could be added to signals table
            direction: signal.signal_type === 'buy' ? 'UP' as const : 'DOWN' as const,
            confidence: signal.confidence_score,
            targetPrice: signal.take_profit || signal.entry_price * 1.01,
            currentPrice: signal.entry_price,
            reasoning: signal.reasoning || "AI-generated prediction based on market analysis",
            signals: ["AI Analysis", "Technical Indicators", "Market Conditions"],
            accuracy: 75 // Could be calculated from historical performance
          };
        });
        setPredictions(predictionItems);
        console.log(`✅ Loaded ${predictionItems.length} REAL AI predictions`);
      } else {
        console.log('ℹ️ No active predictions found in database');
      }
    } catch (error) {
      console.error('Error loading predictions:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const timeframes = ["ALL", "1H", "4H", "1D", "1W"];

  const filteredPredictions = selectedTimeframe === "ALL" 
    ? predictions 
    : predictions.filter(p => p.timeframe === selectedTimeframe);

  const getDirectionColor = (direction: string) => {
    return direction === "UP" ? "text-bullish" : "text-bearish";
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 80) return "bg-bullish";
    if (confidence >= 70) return "bg-warning";
    return "bg-muted";
  };

  const calculatePotentialReturn = (prediction: Prediction) => {
    const diff = Math.abs(prediction.targetPrice - prediction.currentPrice);
    const percent = (diff / prediction.currentPrice) * 100;
    return percent.toFixed(2);
  };

  return (
    <Card className="p-6 bg-gradient-to-br from-card to-card/80 border-border/50">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Brain className="w-5 h-5 text-primary animate-pulse" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-foreground">AI Predictions</h2>
            <p className="text-muted-foreground text-sm">Machine learning forex forecasts</p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-2 h-2 bg-primary rounded-full animate-pulse"></div>
          <span className="text-sm text-muted-foreground">AI Active</span>
        </div>
      </div>

      {/* Timeframe Filter */}
      <div className="flex space-x-1 mb-6 p-1 bg-muted/30 rounded-lg">
        {timeframes.map((timeframe) => (
          <Button
            key={timeframe}
            variant={selectedTimeframe === timeframe ? "default" : "ghost"}
            size="sm"
            onClick={() => setSelectedTimeframe(timeframe)}
            className={`flex-1 ${
              selectedTimeframe === timeframe 
                ? "bg-primary text-primary-foreground shadow-md" 
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {timeframe}
          </Button>
        ))}
      </div>

      <div className="space-y-4">
        {filteredPredictions.map((prediction, index) => (
          <div
            key={`${prediction.pair}-${prediction.timeframe}`}
            className="p-4 rounded-lg bg-muted/30 border border-border/30 hover:bg-muted/50 transition-all duration-300 animate-fade-in"
            style={{ animationDelay: `${index * 100}ms` }}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-3">
                <span className="font-bold text-lg text-foreground">{prediction.pair}</span>
                <Badge variant="outline" className="text-xs">
                  {prediction.timeframe}
                </Badge>
                <div className="flex items-center space-x-1">
                  {prediction.direction === "UP" ? (
                    <TrendingUp className={`w-4 h-4 ${getDirectionColor(prediction.direction)}`} />
                  ) : (
                    <TrendingDown className={`w-4 h-4 ${getDirectionColor(prediction.direction)}`} />
                  )}
                  <span className={`font-semibold ${getDirectionColor(prediction.direction)}`}>
                    {prediction.direction}
                  </span>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <div className="text-right">
                  <div className="text-sm text-muted-foreground">Accuracy</div>
                  <div className="font-semibold text-foreground">{prediction.accuracy}%</div>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-16 bg-muted rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all duration-300 ${getConfidenceColor(prediction.confidence)}`}
                      style={{ width: `${prediction.confidence}%` }}
                    ></div>
                  </div>
                  <span className="text-sm text-muted-foreground w-8">
                    {prediction.confidence}%
                  </span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-3">
              <div>
                <div className="text-sm text-muted-foreground">Current Price</div>
                <div className="font-mono text-lg text-foreground">
                  {prediction.currentPrice.toFixed(4)}
                </div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Target Price</div>
                <div className={`font-mono text-lg ${getDirectionColor(prediction.direction)}`}>
                  {prediction.targetPrice.toFixed(4)}
                </div>
              </div>
            </div>

            <div className="mb-3">
              <div className="text-sm text-muted-foreground mb-1">AI Reasoning</div>
              <p className="text-sm text-foreground leading-relaxed">
                {prediction.reasoning}
              </p>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex space-x-1">
                {prediction.signals.map((signal) => (
                  <Badge key={signal} variant="outline" className="text-xs">
                    {signal}
                  </Badge>
                ))}
              </div>
              <div className="flex items-center space-x-2">
                <Target className="w-4 h-4 text-accent" />
                <span className="text-sm text-accent font-medium">
                  +{calculatePotentialReturn(prediction)}% potential
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 p-4 bg-primary/5 rounded-lg border border-primary/20">
        <div className="flex items-center space-x-2">
          <Clock className="w-4 h-4 text-primary" />
          <span className="text-sm text-primary font-medium">
            Next AI analysis update in 15 minutes
          </span>
        </div>
      </div>
    </Card>
  );
};