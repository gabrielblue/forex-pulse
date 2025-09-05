import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  BarChart3, 
  TrendingUp, 
  TrendingDown, 
  Activity, 
  DollarSign, 
  Eye,
  RefreshCw,
  Zap,
  Target
} from "lucide-react";
import { exnessAPI, TickPrint, OrderBookSnapshot } from "@/lib/trading/exnessApi";

interface VolumeAggregate {
  timeframe: string;
  totalVolume: number;
  buyVolume: number;
  sellVolume: number;
  volumeRatio: number;
  averageVolume: number;
}

interface MarketAnalysis {
  symbol: string;
  timestamp: Date;
  spread: number;
  orderBook: OrderBookSnapshot | null;
  ticks: TickPrint[];
  cvd: number; // cumulative volume delta
  imbalance: number; // bid/ask volume imbalance
  aggregates: VolumeAggregate[];
  recommendation: {
    action: string;
    confidence: number;
    reasoning: string[];
    riskLevel: string;
  };
}

export const MarketDataAnalysis = () => {
  const [analysis, setAnalysis] = useState<MarketAnalysis | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedSymbol, setSelectedSymbol] = useState('EURUSD');

  const symbols = ['EURUSD', 'GBPUSD', 'USDJPY', 'XAUUSD'];
  const timeframes = [
    { key: '1M', ms: 60_000 },
    { key: '5M', ms: 5 * 60_000 },
    { key: '15M', ms: 15 * 60_000 },
    { key: '1H', ms: 60 * 60_000 },
  ];

  useEffect(() => {
    performAnalysis();
    // Auto-refresh every 10s
    const id = setInterval(performAnalysis, 10_000);
    return () => clearInterval(id);
  }, [selectedSymbol]);

  const computeCVD = (ticks: TickPrint[]): number => {
    if (!ticks || ticks.length === 0) return 0;
    let cvd = 0;
    let prevMid = (ticks[0].bid + ticks[0].ask) / 2;
    for (const t of ticks) {
      const mid = (t.bid + t.ask) / 2;
      const v = t.volume || 1;
      if (mid > prevMid) cvd += v; else if (mid < prevMid) cvd -= v;
      prevMid = mid;
    }
    return cvd;
  };

  const computeImbalance = (ob: OrderBookSnapshot | null): number => {
    if (!ob) return 1.0;
    const bidVol = ob.bids.reduce((s, l) => s + l.volume, 0);
    const askVol = ob.asks.reduce((s, l) => s + l.volume, 0);
    if (askVol === 0) return 1.0;
    return bidVol / askVol;
  };

  const computeAggregates = (ticks: TickPrint[]): VolumeAggregate[] => {
    const now = Date.now();
    const res: VolumeAggregate[] = [];
    for (const tf of timeframes) {
      const windowTicks = ticks.filter(t => now - t.time <= tf.ms);
      const totalVolume = windowTicks.reduce((s, t) => s + (t.volume || 1), 0);
      let buyVolume = 0, sellVolume = 0;
      let prevMid = windowTicks.length ? (windowTicks[0].bid + windowTicks[0].ask) / 2 : 0;
      for (const t of windowTicks) {
        const mid = (t.bid + t.ask) / 2;
        if (mid > prevMid) buyVolume += (t.volume || 1); else if (mid < prevMid) sellVolume += (t.volume || 1);
        prevMid = mid;
      }
      const volumeRatio = totalVolume > 0 ? totalVolume / (windowTicks.length || 1) : 0;
      res.push({ timeframe: tf.key, totalVolume, buyVolume, sellVolume, volumeRatio, averageVolume: volumeRatio });
    }
    return res;
  };

  const performAnalysis = async () => {
    setIsLoading(true);
    try {
      const [ob, ticks] = await Promise.all([
        exnessAPI.getOrderBook(selectedSymbol),
        exnessAPI.getTicks(selectedSymbol, 5000)
      ]);

      const spread = ticks && ticks.length ? (ticks[ticks.length - 1].ask - ticks[ticks.length - 1].bid) : 0;
      const cvd = computeCVD(ticks || []);
      const imbalance = computeImbalance(ob);
      const aggregates = computeAggregates(ticks || []);

      const reasoning: string[] = [];
      let action = 'HOLD';
      let confidence = 55;

      if (imbalance > 1.2) { action = 'BUY'; confidence += 10; reasoning.push('Order book bid>ask imbalance'); }
      if (imbalance < 0.8) { action = 'SELL'; confidence += 10; reasoning.push('Order book ask>bid imbalance'); }
      if (cvd > 0) { if (action === 'BUY') confidence += 5; reasoning.push('Positive CVD'); }
      if (cvd < 0) { if (action === 'SELL') confidence += 5; reasoning.push('Negative CVD'); }

      setAnalysis({
        symbol: selectedSymbol,
        timestamp: new Date(),
        spread,
        orderBook: ob || null,
        ticks: ticks || [],
        cvd,
        imbalance,
        aggregates,
        recommendation: {
          action,
          confidence,
          reasoning,
          riskLevel: confidence >= 80 ? 'LOW' : confidence >= 65 ? 'MEDIUM' : 'HIGH'
        }
      });
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  if (!analysis) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            Market Data Analysis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <RefreshCw className="w-8 h-8 mx-auto mb-4 text-muted-foreground animate-spin" />
            <p className="text-muted-foreground">Loading market analysis...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="w-5 h-5" />
          Market Data Analysis - {analysis.symbol}
        </CardTitle>
        <div className="flex items-center gap-4">
          <select
            value={analysis.symbol}
            onChange={(e) => setSelectedSymbol(e.target.value)}
            className="px-3 py-1 border rounded-md text-sm"
          >
            {symbols.map(symbol => (
              <option key={symbol} value={symbol}>{symbol}</option>
            ))}
          </select>
          <Button onClick={performAnalysis} disabled={isLoading} size="sm">
            <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="orderbook">Order Book</TabsTrigger>
            <TabsTrigger value="volume">Volume</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardContent className="p-4 text-center">
                  <p className="text-sm text-muted-foreground">Spread</p>
                  <p className="text-2xl font-bold text-orange-600">{analysis.spread.toFixed(5)}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <p className="text-sm text-muted-foreground">CVD</p>
                  <p className="text-2xl font-bold {analysis.cvd>=0? 'text-green-600':'text-red-600'}">{analysis.cvd.toFixed(0)}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <p className="text-sm text-muted-foreground">OB Imbalance</p>
                  <p className="text-2xl font-bold">{analysis.imbalance.toFixed(2)}</p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="w-5 h-5" />
                  Recommendation
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium">Action</span>
                  <Badge>{analysis.recommendation.action}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-medium">Confidence</span>
                  <span className="font-bold text-lg">{analysis.recommendation.confidence}%</span>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="orderbook" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-green-600">
                    <TrendingUp className="w-5 h-5" />
                    Buyers (Bids)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {(analysis.orderBook?.bids || []).map((l, i) => (
                      <div key={i} className="flex justify-between p-2 bg-green-50 rounded">
                        <span className="text-green-800 font-medium">{l.price.toFixed(5)}</span>
                        <span className="text-green-600 text-sm">{l.volume.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-red-600">
                    <TrendingDown className="w-5 h-5" />
                    Sellers (Asks)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {(analysis.orderBook?.asks || []).map((l, i) => (
                      <div key={i} className="flex justify-between p-2 bg-red-50 rounded">
                        <span className="text-red-800 font-medium">{l.price.toFixed(5)}</span>
                        <span className="text-red-600 text-sm">{l.volume.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="volume" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {analysis.aggregates.map(a => (
                <Card key={a.timeframe}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Activity className="w-5 h-5" />
                      {a.timeframe} Aggregates
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex justify-between text-sm"><span>Total Volume</span><span className="font-medium">{a.totalVolume.toFixed(0)}</span></div>
                    <div className="flex justify-between text-sm"><span>Buy Volume</span><span className="font-medium text-green-600">{a.buyVolume.toFixed(0)}</span></div>
                    <div className="flex justify-between text-sm"><span>Sell Volume</span><span className="font-medium text-red-600">{a.sellVolume.toFixed(0)}</span></div>
                    <div className="flex justify-between text-sm"><span>Volume/Trade</span><span className="font-medium">{a.volumeRatio.toFixed(2)}</span></div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};