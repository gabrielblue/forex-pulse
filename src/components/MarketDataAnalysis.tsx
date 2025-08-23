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
  Clock,
  Eye,
  RefreshCw,
  Zap,
  Target,
  AlertTriangle
} from "lucide-react";
import { tradingBot } from "@/lib/trading/tradingBot";

interface MarketAnalysis {
  symbol: string;
  timestamp: Date;
  currentPrice: {
    bid: number;
    ask: number;
    spread: number;
  };
  orderBook: {
    bids: Array<{ price: number; volume: number }>;
    asks: Array<{ price: number; volume: number }>;
    totalBidVolume: number;
    totalAskVolume: number;
    bidAskRatio: number;
  };
  volumeProfile: Record<string, {
    totalVolume: number;
    buyVolume: number;
    sellVolume: number;
    volumeRatio: number;
    averageVolume: number;
  }>;
  sentiment: {
    overall: string;
    strength: number;
    sources: {
      technical: number;
      fundamental: number;
      sentiment: number;
    };
    confidence: number;
  };
  volatility: {
    current: number;
    average: number;
    trend: string;
    timeframes: Record<string, number>;
  };
  session: string;
  sessionMultiplier: number;
  recommendation: {
    action: string;
    confidence: number;
    reasoning: string[];
    riskLevel: string;
    volumeImbalance: number;
    volumeRatio: number;
  };
}

export const MarketDataAnalysis = () => {
  const [analysis, setAnalysis] = useState<MarketAnalysis | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedSymbol, setSelectedSymbol] = useState('EURUSD');
  const [selectedTimeframe, setSelectedTimeframe] = useState('1H');

  const symbols = ['EURUSD', 'GBPUSD', 'USDJPY', 'XAUUSD'];
  const timeframes = ['1M', '5M', '15M', '1H', '4H', '1D'];

  useEffect(() => {
    performAnalysis();
  }, [selectedSymbol]);

  const performAnalysis = async () => {
    setIsLoading(true);
    try {
      const result = await tradingBot.performComprehensiveMarketAnalysis(selectedSymbol);
      setAnalysis(result);
    } catch (error) {
      console.error('Failed to perform market analysis:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case 'BUY': return 'text-green-600 bg-green-100 border-green-200';
      case 'SELL': return 'text-red-600 bg-red-100 border-red-200';
      default: return 'text-yellow-600 bg-yellow-100 border-yellow-200';
    }
  };

  const getRiskLevelColor = (riskLevel: string) => {
    switch (riskLevel) {
      case 'LOW': return 'text-green-600 bg-green-100 border-green-200';
      case 'MEDIUM': return 'text-yellow-600 bg-yellow-100 border-yellow-200';
      case 'HIGH': return 'text-red-600 bg-red-100 border-red-200';
      default: return 'text-gray-600 bg-gray-100 border-gray-200';
    }
  };

  const getSessionColor = (session: string) => {
    switch (session) {
      case 'london':
      case 'newyork':
        return 'text-green-600 bg-green-100 border-green-200';
      case 'asian':
        return 'text-blue-600 bg-blue-100 border-blue-200';
      default:
        return 'text-gray-600 bg-gray-100 border-gray-200';
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
          Market Data Analysis - {selectedSymbol}
        </CardTitle>
        <div className="flex items-center gap-4">
          <select
            value={selectedSymbol}
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
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="orderbook">Order Book</TabsTrigger>
            <TabsTrigger value="volume">Volume Profile</TabsTrigger>
            <TabsTrigger value="sentiment">Sentiment</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            {/* Trading Recommendation */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Target className="w-5 h-5" />
                    Trading Recommendation
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">Action:</span>
                    <Badge className={getActionColor(analysis.recommendation.action)}>
                      {analysis.recommendation.action}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-medium">Confidence:</span>
                    <span className="font-bold text-lg">{analysis.recommendation.confidence}%</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-medium">Risk Level:</span>
                    <Badge className={getRiskLevelColor(analysis.recommendation.riskLevel)}>
                      {analysis.recommendation.riskLevel}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-medium">Session:</span>
                    <Badge className={getSessionColor(analysis.recommendation.session)}>
                      {analysis.recommendation.session.toUpperCase()}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-medium">Session Multiplier:</span>
                    <span className="font-bold text-green-600">{analysis.sessionMultiplier}x</span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <DollarSign className="w-5 h-5" />
                    Current Price
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center">
                      <p className="text-sm text-muted-foreground">Bid</p>
                      <p className="text-2xl font-bold text-green-600">
                        {analysis.currentPrice.bid.toFixed(5)}
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-sm text-muted-foreground">Ask</p>
                      <p className="text-2xl font-bold text-red-600">
                        {analysis.currentPrice.ask.toFixed(5)}
                      </p>
                    </div>
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground">Spread</p>
                    <p className="text-lg font-bold text-orange-600">
                      {analysis.currentPrice.spread.toFixed(5)}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Reasoning */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Eye className="w-5 h-5" />
                  Analysis Reasoning
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {analysis.recommendation.reasoning.map((reason, index) => (
                    <div key={index} className="flex items-center gap-2 p-2 bg-muted rounded-lg">
                      <div className="w-2 h-2 bg-primary rounded-full"></div>
                      <span className="text-sm">{reason}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Market Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardContent className="p-4 text-center">
                  <p className="text-sm text-muted-foreground">Volume Imbalance</p>
                  <p className="text-2xl font-bold">
                    {analysis.recommendation.volumeImbalance.toFixed(2)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {analysis.recommendation.volumeImbalance > 1.2 ? 'Strong Buy' : 
                     analysis.recommendation.volumeImbalance < 0.8 ? 'Strong Sell' : 'Balanced'}
                  </p>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-4 text-center">
                  <p className="text-sm text-muted-foreground">Volume Ratio</p>
                  <p className="text-2xl font-bold">
                    {analysis.recommendation.volumeRatio.toFixed(2)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {analysis.recommendation.volumeRatio > 1.1 ? 'Above Average' : 
                     analysis.recommendation.volumeRatio < 0.9 ? 'Below Average' : 'Normal'}
                  </p>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-4 text-center">
                  <p className="text-sm text-muted-foreground">Volatility</p>
                  <p className="text-2xl font-bold">
                    {analysis.volatility.current.toFixed(1)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {analysis.volatility.trend.toLowerCase()}
                  </p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Order Book Tab */}
          <TabsContent value="orderbook" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Bids (Buyers) */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-green-600">
                    <TrendingUp className="w-5 h-5" />
                    Buyers (Bids)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {analysis.orderBook.bids.map((bid, index) => (
                      <div key={index} className="flex justify-between items-center p-2 bg-green-50 rounded-lg">
                        <span className="font-medium text-green-800">
                          {bid.price.toFixed(5)}
                        </span>
                        <span className="text-sm text-green-600">
                          {bid.volume.toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 p-3 bg-green-100 rounded-lg">
                    <p className="text-sm font-medium text-green-800">
                      Total Bid Volume: {analysis.orderBook.totalBidVolume.toFixed(2)}
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Asks (Sellers) */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-red-600">
                    <TrendingDown className="w-5 h-5" />
                    Sellers (Asks)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {analysis.orderBook.asks.map((ask, index) => (
                      <div key={index} className="flex justify-between items-center p-2 bg-red-50 rounded-lg">
                        <span className="font-medium text-red-800">
                          {ask.price.toFixed(5)}
                        </span>
                        <span className="text-sm text-red-600">
                          {ask.volume.toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 p-3 bg-red-100 rounded-lg">
                    <p className="text-sm font-medium text-red-800">
                      Total Ask Volume: {analysis.orderBook.totalAskVolume.toFixed(2)}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Order Book Summary */}
            <Card>
              <CardHeader>
                <CardTitle>Order Book Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="text-center p-4 bg-blue-50 rounded-lg">
                    <p className="text-sm text-muted-foreground">Bid/Ask Ratio</p>
                    <p className="text-2xl font-bold text-blue-600">
                      {analysis.orderBook.bidAskRatio.toFixed(2)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {analysis.orderBook.bidAskRatio > 1.2 ? 'Strong Buy Pressure' : 
                       analysis.orderBook.bidAskRatio < 0.8 ? 'Strong Sell Pressure' : 'Balanced'}
                    </p>
                  </div>
                  
                  <div className="text-center p-4 bg-green-50 rounded-lg">
                    <p className="text-sm text-muted-foreground">Total Bid Volume</p>
                    <p className="text-2xl font-bold text-green-600">
                      {analysis.orderBook.totalBidVolume.toFixed(2)}
                    </p>
                  </div>
                  
                  <div className="text-center p-4 bg-red-50 rounded-lg">
                    <p className="text-sm text-muted-foreground">Total Ask Volume</p>
                    <p className="text-2xl font-bold text-red-600">
                      {analysis.orderBook.totalAskVolume.toFixed(2)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Volume Profile Tab */}
          <TabsContent value="volume" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {timeframes.map(timeframe => {
                const volumeData = analysis.volumeProfile[timeframe];
                if (!volumeData) return null;
                
                return (
                  <Card key={timeframe}>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Activity className="w-5 h-5" />
                        {timeframe} Timeframe
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="text-center">
                          <p className="text-sm text-muted-foreground">Buy Volume</p>
                          <p className="text-lg font-bold text-green-600">
                            {volumeData.buyVolume.toFixed(0)}
                          </p>
                        </div>
                        <div className="text-center">
                          <p className="text-sm text-muted-foreground">Sell Volume</p>
                          <p className="text-lg font-bold text-red-600">
                            {volumeData.sellVolume.toFixed(0)}
                          </p>
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span>Total Volume:</span>
                          <span className="font-medium">{volumeData.totalVolume.toFixed(0)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span>Volume Ratio:</span>
                          <span className="font-medium">{volumeData.volumeRatio.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span>Average Volume:</span>
                          <span className="font-medium">{volumeData.averageVolume.toFixed(0)}</span>
                        </div>
                      </div>
                      
                      <div className="p-2 bg-muted rounded-lg">
                        <div className="flex justify-between text-xs text-muted-foreground mb-1">
                          <span>Buy</span>
                          <span>Sell</span>
                        </div>
                        <div className="flex h-2 bg-background rounded-full overflow-hidden">
                          <div 
                            className="bg-green-500 h-full" 
                            style={{ width: `${(volumeData.buyVolume / volumeData.totalVolume) * 100}%` }}
                          ></div>
                          <div 
                            className="bg-red-500 h-full" 
                            style={{ width: `${(volumeData.sellVolume / volumeData.totalVolume) * 100}%` }}
                          ></div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          {/* Sentiment Tab */}
          <TabsContent value="sentiment" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Overall Sentiment */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Zap className="w-5 h-5" />
                    Overall Sentiment
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="text-center">
                    <Badge className={`text-lg px-4 py-2 ${
                      analysis.sentiment.overall === 'BULLISH' ? 'bg-green-100 text-green-800 border-green-200' :
                      analysis.sentiment.overall === 'BEARISH' ? 'bg-red-100 text-red-800 border-red-200' :
                      'bg-yellow-100 text-yellow-800 border-yellow-200'
                    }`}>
                      {analysis.sentiment.overall}
                    </Badge>
                  </div>
                  
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span>Strength:</span>
                      <span className="font-medium">{analysis.sentiment.strength}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Confidence:</span>
                      <span className="font-medium">{analysis.sentiment.confidence}%</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Sentiment Sources */}
              <Card>
                <CardHeader>
                  <CardTitle>Sentiment Sources</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>Technical</span>
                        <span>{analysis.sentiment.sources.technical}%</span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-2">
                        <div 
                          className="bg-blue-500 h-2 rounded-full" 
                          style={{ width: `${analysis.sentiment.sources.technical}%` }}
                        ></div>
                      </div>
                    </div>
                    
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>Fundamental</span>
                        <span>{analysis.sentiment.sources.fundamental}%</span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-2">
                        <div 
                          className="bg-green-500 h-2 rounded-full" 
                          style={{ width: `${analysis.sentiment.sources.fundamental}%` }}
                        ></div>
                      </div>
                    </div>
                    
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>Sentiment</span>
                        <span>{analysis.sentiment.sources.sentiment}%</span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-2">
                        <div 
                          className="bg-purple-500 h-2 rounded-full" 
                          style={{ width: `${analysis.sentiment.sources.sentiment}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Volatility Analysis */}
            <Card>
              <CardHeader>
                <CardTitle>Volatility Analysis</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="text-center p-4 bg-blue-50 rounded-lg">
                    <p className="text-sm text-muted-foreground">Current Volatility</p>
                    <p className="text-2xl font-bold text-blue-600">
                      {analysis.volatility.current.toFixed(1)}
                    </p>
                  </div>
                  
                  <div className="text-center p-4 bg-green-50 rounded-lg">
                    <p className="text-sm text-muted-foreground">Average Volatility</p>
                    <p className="text-2xl font-bold text-green-600">
                      {analysis.volatility.average.toFixed(1)}
                    </p>
                  </div>
                  
                  <div className="text-center p-4 bg-orange-50 rounded-lg">
                    <p className="text-sm text-muted-foreground">Trend</p>
                    <Badge className={
                      analysis.volatility.trend === 'INCREASING' ? 'bg-green-100 text-green-800 border-green-200' :
                      'bg-red-100 text-red-800 border-red-200'
                    }>
                      {analysis.volatility.trend}
                    </Badge>
                  </div>
                </div>
                
                <div className="mt-6">
                  <h4 className="font-medium mb-3">Volatility by Timeframe</h4>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {Object.entries(analysis.volatility.timeframes).map(([tf, value]) => (
                      <div key={tf} className="p-3 border rounded-lg text-center">
                        <p className="text-sm text-muted-foreground">{tf}</p>
                        <p className="font-bold">{value.toFixed(1)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};