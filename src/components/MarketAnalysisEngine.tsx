import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Brain, 
  TrendingUp, 
  TrendingDown, 
  BarChart3, 
  Activity,
  Target,
  AlertTriangle,
  CheckCircle,
  Clock,
  Zap,
  Eye,
  LineChart
} from "lucide-react";

interface MarketAnalysis {
  timestamp: Date;
  symbol: string;
  timeframe: string;
  trend: "BULLISH" | "BEARISH" | "NEUTRAL";
  strength: number;
  confidence: number;
  keyLevels: {
    support: number[];
    resistance: number[];
  };
  indicators: {
    rsi: number;
    macd: { value: number; signal: number; histogram: number };
    ema20: number;
    ema50: number;
    bollinger: { upper: number; middle: number; lower: number };
    volume: number;
    atr: number;
  };
  patterns: string[];
  sentiment: string;
  riskLevel: "LOW" | "MEDIUM" | "HIGH";
  recommendation: "STRONG_BUY" | "BUY" | "HOLD" | "SELL" | "STRONG_SELL";
  notes: string;
}

interface AnalysisNote {
  id: string;
  timestamp: Date;
  symbol: string;
  type: "OBSERVATION" | "PATTERN" | "SIGNAL" | "WARNING";
  message: string;
  importance: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
}

export const MarketAnalysisEngine = () => {
  const [analyses, setAnalyses] = useState<MarketAnalysis[]>([]);
  const [analysisNotes, setAnalysisNotes] = useState<AnalysisNote[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(true);
  const [selectedSymbol, setSelectedSymbol] = useState("EURUSD");
  const [analysisDepth, setAnalysisDepth] = useState<"BASIC" | "ADVANCED" | "PROFESSIONAL">("PROFESSIONAL");

  const symbols = ["EURUSD", "GBPUSD", "USDJPY", "AUDUSD", "USDCHF", "NZDUSD"];
  const timeframes = ["1M", "5M", "15M", "1H", "4H", "1D"];

  useEffect(() => {
    startContinuousAnalysis();
    
    return () => {
      // Cleanup if needed
    };
  }, []);

  const startContinuousAnalysis = () => {
    // Analyze markets every 30 seconds
    const analysisInterval = setInterval(() => {
      performMarketAnalysis();
    }, 30000);

    // Generate analysis notes every 2 minutes
    const notesInterval = setInterval(() => {
      generateAnalysisNotes();
    }, 120000);

    // Initial analysis
    performMarketAnalysis();
    generateAnalysisNotes();

    return () => {
      clearInterval(analysisInterval);
      clearInterval(notesInterval);
    };
  };

  const performMarketAnalysis = () => {
    symbols.forEach(symbol => {
      timeframes.forEach(timeframe => {
        const analysis = generateAdvancedAnalysis(symbol, timeframe);
        setAnalyses(prev => {
          const filtered = prev.filter(a => !(a.symbol === symbol && a.timeframe === timeframe));
          return [analysis, ...filtered].slice(0, 50); // Keep last 50 analyses
        });
      });
    });
  };

  const generateAdvancedAnalysis = (symbol: string, timeframe: string): MarketAnalysis => {
    // Simulate advanced market analysis
    const basePrice = getBasePrice(symbol);
    const volatility = Math.random() * 0.02;
    
    // Generate realistic technical indicators
    const rsi = 30 + Math.random() * 40; // 30-70 range
    const macdValue = (Math.random() - 0.5) * 0.001;
    const macdSignal = macdValue * 0.8;
    const ema20 = basePrice * (0.998 + Math.random() * 0.004);
    const ema50 = basePrice * (0.996 + Math.random() * 0.008);
    const atr = basePrice * (0.001 + Math.random() * 0.002);
    
    // Determine trend based on EMAs and MACD
    let trend: "BULLISH" | "BEARISH" | "NEUTRAL" = "NEUTRAL";
    let strength = 50;
    
    if (ema20 > ema50 && macdValue > macdSignal && rsi > 50) {
      trend = "BULLISH";
      strength = 60 + Math.random() * 30;
    } else if (ema20 < ema50 && macdValue < macdSignal && rsi < 50) {
      trend = "BEARISH";
      strength = 60 + Math.random() * 30;
    }

    // Generate support and resistance levels
    const support = [
      basePrice * 0.998,
      basePrice * 0.995,
      basePrice * 0.992
    ];
    const resistance = [
      basePrice * 1.002,
      basePrice * 1.005,
      basePrice * 1.008
    ];

    // Detect patterns
    const patterns = [];
    if (Math.random() > 0.7) patterns.push("Double Bottom");
    if (Math.random() > 0.8) patterns.push("Head and Shoulders");
    if (Math.random() > 0.6) patterns.push("Ascending Triangle");
    if (Math.random() > 0.9) patterns.push("Bullish Flag");

    // Generate recommendation
    let recommendation: MarketAnalysis["recommendation"] = "HOLD";
    if (strength > 80 && trend === "BULLISH") recommendation = "STRONG_BUY";
    else if (strength > 70 && trend === "BULLISH") recommendation = "BUY";
    else if (strength > 80 && trend === "BEARISH") recommendation = "STRONG_SELL";
    else if (strength > 70 && trend === "BEARISH") recommendation = "SELL";

    return {
      timestamp: new Date(),
      symbol,
      timeframe,
      trend,
      strength,
      confidence: 70 + Math.random() * 25,
      keyLevels: { support, resistance },
      indicators: {
        rsi,
        macd: { value: macdValue, signal: macdSignal, histogram: macdValue - macdSignal },
        ema20,
        ema50,
        bollinger: {
          upper: basePrice * 1.01,
          middle: basePrice,
          lower: basePrice * 0.99
        },
        volume: Math.floor(Math.random() * 1000000),
        atr
      },
      patterns,
      sentiment: generateMarketSentiment(),
      riskLevel: strength > 80 ? "HIGH" : strength > 60 ? "MEDIUM" : "LOW",
      recommendation,
      notes: generateAnalysisNotes(symbol, trend, strength, patterns)
    };
  };

  const generateAnalysisNotes = () => {
    const noteTypes = ["OBSERVATION", "PATTERN", "SIGNAL", "WARNING"] as const;
    const importanceLevels = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
    
    const messages = [
      "Strong bullish momentum detected on EUR/USD 4H chart",
      "RSI divergence forming on GBP/USD - potential reversal signal",
      "Double bottom pattern confirmed on USD/JPY daily chart",
      "High volatility expected during London-NY overlap",
      "Support level holding strong at 1.0850 on EUR/USD",
      "MACD crossover signal detected on AUD/USD 1H",
      "Volume spike indicates institutional interest",
      "Fibonacci retracement level acting as resistance",
      "News event approaching - reduce position sizes",
      "Trend line break confirmed with volume confirmation"
    ];

    const newNote: AnalysisNote = {
      id: crypto.randomUUID(),
      timestamp: new Date(),
      symbol: symbols[Math.floor(Math.random() * symbols.length)],
      type: noteTypes[Math.floor(Math.random() * noteTypes.length)],
      message: messages[Math.floor(Math.random() * messages.length)],
      importance: importanceLevels[Math.floor(Math.random() * importanceLevels.length)]
    };

    setAnalysisNotes(prev => [newNote, ...prev].slice(0, 100));
  };

  const generateMarketSentiment = (): string => {
    const sentiments = [
      "Risk-on sentiment driving USD weakness",
      "Safe-haven demand supporting JPY",
      "Central bank divergence creating opportunities",
      "Economic data supporting currency strength",
      "Technical levels providing clear direction",
      "Market consolidation before next move",
      "Institutional flows driving price action",
      "Seasonal patterns influencing trends"
    ];
    return sentiments[Math.floor(Math.random() * sentiments.length)];
  };

  const generateAnalysisNotes = (symbol: string, trend: string, strength: number, patterns: string[]): string => {
    const notes = [
      `${symbol} showing ${trend.toLowerCase()} bias with ${strength.toFixed(0)}% strength`,
      patterns.length > 0 ? `Key patterns: ${patterns.join(", ")}` : "No significant patterns detected",
      strength > 80 ? "High conviction setup - consider larger position" : "Moderate setup - standard position sizing",
      "Monitor for volume confirmation on breakouts",
      "Watch for news events that could impact direction"
    ];
    return notes.join(". ");
  };

  const getBasePrice = (symbol: string): number => {
    const prices: Record<string, number> = {
      'EURUSD': 1.0845,
      'GBPUSD': 1.2734,
      'USDJPY': 149.85,
      'AUDUSD': 0.6623,
      'USDCHF': 0.8892,
      'NZDUSD': 0.5987
    };
    return prices[symbol] || 1.0000;
  };

  const getTrendColor = (trend: string) => {
    switch (trend) {
      case "BULLISH": return "text-green-500";
      case "BEARISH": return "text-red-500";
      default: return "text-gray-500";
    }
  };

  const getRecommendationColor = (rec: string) => {
    switch (rec) {
      case "STRONG_BUY": return "bg-green-500 text-white";
      case "BUY": return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300";
      case "HOLD": return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300";
      case "SELL": return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300";
      case "STRONG_SELL": return "bg-red-500 text-white";
      default: return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300";
    }
  };

  const getNoteTypeIcon = (type: string) => {
    switch (type) {
      case "OBSERVATION": return <Eye className="w-4 h-4" />;
      case "PATTERN": return <BarChart3 className="w-4 h-4" />;
      case "SIGNAL": return <Zap className="w-4 h-4" />;
      case "WARNING": return <AlertTriangle className="w-4 h-4" />;
      default: return <Activity className="w-4 h-4" />;
    }
  };

  const getImportanceColor = (importance: string) => {
    switch (importance) {
      case "CRITICAL": return "text-red-500";
      case "HIGH": return "text-orange-500";
      case "MEDIUM": return "text-yellow-500";
      case "LOW": return "text-blue-500";
      default: return "text-gray-500";
    }
  };

  const currentAnalysis = analyses.find(a => a.symbol === selectedSymbol && a.timeframe === "1H");

  return (
    <div className="space-y-6">
      {/* Analysis Status */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Brain className="w-6 h-6 text-primary" />
              </div>
              <div>
                <CardTitle>Advanced Market Analysis Engine</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Continuous 24/7 market monitoring and analysis
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={isAnalyzing ? "default" : "secondary"}>
                {isAnalyzing ? (
                  <>
                    <Activity className="w-3 h-3 mr-1 animate-pulse" />
                    ANALYZING
                  </>
                ) : (
                  "IDLE"
                )}
              </Badge>
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Analysis Dashboard */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Symbol Selection */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Market Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {symbols.map(symbol => {
                const latestAnalysis = analyses.find(a => a.symbol === symbol && a.timeframe === "1H");
                return (
                  <div
                    key={symbol}
                    className={`p-3 rounded-lg border cursor-pointer transition-all ${
                      selectedSymbol === symbol 
                        ? 'border-primary bg-primary/5' 
                        : 'border-border hover:bg-muted/50'
                    }`}
                    onClick={() => setSelectedSymbol(symbol)}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium">{symbol}</div>
                        <div className="text-xs text-muted-foreground">
                          {latestAnalysis?.sentiment || "Analyzing..."}
                        </div>
                      </div>
                      <div className="text-right">
                        {latestAnalysis && (
                          <>
                            <Badge className={getRecommendationColor(latestAnalysis.recommendation)}>
                              {latestAnalysis.recommendation.replace('_', ' ')}
                            </Badge>
                            <div className={`text-sm font-medium ${getTrendColor(latestAnalysis.trend)}`}>
                              {latestAnalysis.trend}
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Detailed Analysis */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <LineChart className="w-5 h-5" />
              {selectedSymbol} Analysis
            </CardTitle>
          </CardHeader>
          <CardContent>
            {currentAnalysis ? (
              <Tabs defaultValue="overview" className="w-full">
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="technical">Technical</TabsTrigger>
                  <TabsTrigger value="patterns">Patterns</TabsTrigger>
                  <TabsTrigger value="levels">Key Levels</TabsTrigger>
                </TabsList>
                
                <TabsContent value="overview" className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 rounded-lg bg-muted/30">
                      <div className="text-sm text-muted-foreground">Trend</div>
                      <div className={`text-lg font-bold ${getTrendColor(currentAnalysis.trend)}`}>
                        {currentAnalysis.trend}
                      </div>
                      <Progress value={currentAnalysis.strength} className="mt-2 h-2" />
                      <div className="text-xs text-muted-foreground mt-1">
                        Strength: {currentAnalysis.strength.toFixed(0)}%
                      </div>
                    </div>
                    
                    <div className="p-3 rounded-lg bg-muted/30">
                      <div className="text-sm text-muted-foreground">Confidence</div>
                      <div className="text-lg font-bold text-primary">
                        {currentAnalysis.confidence.toFixed(0)}%
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        Risk: {currentAnalysis.riskLevel}
                      </div>
                    </div>
                  </div>
                  
                  <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
                    <div className="font-medium mb-2">AI Analysis Notes:</div>
                    <p className="text-sm text-muted-foreground">{currentAnalysis.notes}</p>
                  </div>
                  
                  <div className="p-4 rounded-lg bg-accent/5 border border-accent/20">
                    <div className="font-medium mb-2">Market Sentiment:</div>
                    <p className="text-sm text-muted-foreground">{currentAnalysis.sentiment}</p>
                  </div>
                </TabsContent>
                
                <TabsContent value="technical" className="space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <div className="p-3 rounded-lg bg-muted/30">
                      <div className="text-sm text-muted-foreground">RSI (14)</div>
                      <div className="text-lg font-bold">{currentAnalysis.indicators.rsi.toFixed(1)}</div>
                      <div className="text-xs text-muted-foreground">
                        {currentAnalysis.indicators.rsi > 70 ? "Overbought" : 
                         currentAnalysis.indicators.rsi < 30 ? "Oversold" : "Neutral"}
                      </div>
                    </div>
                    
                    <div className="p-3 rounded-lg bg-muted/30">
                      <div className="text-sm text-muted-foreground">MACD</div>
                      <div className={`text-lg font-bold ${
                        currentAnalysis.indicators.macd.value > currentAnalysis.indicators.macd.signal 
                          ? 'text-green-500' : 'text-red-500'
                      }`}>
                        {(currentAnalysis.indicators.macd.value * 10000).toFixed(1)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {currentAnalysis.indicators.macd.value > currentAnalysis.indicators.macd.signal 
                          ? "Bullish" : "Bearish"}
                      </div>
                    </div>
                    
                    <div className="p-3 rounded-lg bg-muted/30">
                      <div className="text-sm text-muted-foreground">ATR</div>
                      <div className="text-lg font-bold">
                        {(currentAnalysis.indicators.atr * 10000).toFixed(1)}
                      </div>
                      <div className="text-xs text-muted-foreground">pips</div>
                    </div>
                    
                    <div className="p-3 rounded-lg bg-muted/30">
                      <div className="text-sm text-muted-foreground">EMA 20</div>
                      <div className="text-lg font-bold">
                        {currentAnalysis.indicators.ema20.toFixed(4)}
                      </div>
                    </div>
                    
                    <div className="p-3 rounded-lg bg-muted/30">
                      <div className="text-sm text-muted-foreground">EMA 50</div>
                      <div className="text-lg font-bold">
                        {currentAnalysis.indicators.ema50.toFixed(4)}
                      </div>
                    </div>
                    
                    <div className="p-3 rounded-lg bg-muted/30">
                      <div className="text-sm text-muted-foreground">Volume</div>
                      <div className="text-lg font-bold">
                        {(currentAnalysis.indicators.volume / 1000000).toFixed(1)}M
                      </div>
                    </div>
                  </div>
                </TabsContent>
                
                <TabsContent value="patterns" className="space-y-4">
                  {currentAnalysis.patterns.length > 0 ? (
                    <div className="space-y-3">
                      {currentAnalysis.patterns.map((pattern, index) => (
                        <div key={index} className="p-3 rounded-lg border border-border">
                          <div className="flex items-center gap-2">
                            <BarChart3 className="w-4 h-4 text-primary" />
                            <span className="font-medium">{pattern}</span>
                            <Badge variant="outline">Confirmed</Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <BarChart3 className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>No significant patterns detected at this time</p>
                    </div>
                  )}
                </TabsContent>
                
                <TabsContent value="levels" className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <h4 className="font-medium mb-3 text-red-500">Resistance Levels</h4>
                      <div className="space-y-2">
                        {currentAnalysis.keyLevels.resistance.map((level, index) => (
                          <div key={index} className="flex justify-between p-2 rounded bg-red-50 dark:bg-red-950">
                            <span className="text-sm">R{index + 1}</span>
                            <span className="font-mono">{level.toFixed(4)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    
                    <div>
                      <h4 className="font-medium mb-3 text-green-500">Support Levels</h4>
                      <div className="space-y-2">
                        {currentAnalysis.keyLevels.support.map((level, index) => (
                          <div key={index} className="flex justify-between p-2 rounded bg-green-50 dark:bg-green-950">
                            <span className="text-sm">S{index + 1}</span>
                            <span className="font-mono">{level.toFixed(4)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Brain className="w-12 h-12 mx-auto mb-4 animate-pulse" />
                <p>Analyzing {selectedSymbol}...</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Analysis Notes Stream */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="w-5 h-5" />
            Live Analysis Notes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-64">
            <div className="space-y-2">
              {analysisNotes.map((note) => (
                <div
                  key={note.id}
                  className="p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <div className={getImportanceColor(note.importance)}>
                      {getNoteTypeIcon(note.type)}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-sm">{note.symbol}</span>
                        <Badge variant="outline" className="text-xs">
                          {note.type}
                        </Badge>
                        <Badge className={`text-xs ${
                          note.importance === "CRITICAL" ? "bg-red-500" :
                          note.importance === "HIGH" ? "bg-orange-500" :
                          note.importance === "MEDIUM" ? "bg-yellow-500" : "bg-blue-500"
                        }`}>
                          {note.importance}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{note.message}</p>
                      <div className="text-xs text-muted-foreground mt-1">
                        {note.timestamp.toLocaleTimeString()}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Analysis Controls */}
      <Card>
        <CardHeader>
          <CardTitle>Analysis Settings</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label>Analysis Depth</Label>
              <div className="flex gap-2 mt-2">
                {(["BASIC", "ADVANCED", "PROFESSIONAL"] as const).map(depth => (
                  <Button
                    key={depth}
                    variant={analysisDepth === depth ? "default" : "outline"}
                    size="sm"
                    onClick={() => setAnalysisDepth(depth)}
                  >
                    {depth}
                  </Button>
                ))}
              </div>
            </div>
            
            <div>
              <Label>Update Frequency</Label>
              <div className="flex gap-2 mt-2">
                <Button variant="outline" size="sm">30s</Button>
                <Button variant="default" size="sm">1m</Button>
                <Button variant="outline" size="sm">5m</Button>
              </div>
            </div>
            
            <div>
              <Label>Analysis Scope</Label>
              <div className="flex gap-2 mt-2">
                <Button variant="default" size="sm">All Pairs</Button>
                <Button variant="outline" size="sm">Majors Only</Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};