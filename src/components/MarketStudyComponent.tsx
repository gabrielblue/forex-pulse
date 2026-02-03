/**
 * Market Study Component - Real-time market analysis display
 * Shows live indicators and multi-timeframe analysis from MT5
 */

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Activity, 
  TrendingUp, 
  TrendingDown, 
  Minus,
  RefreshCw,
  BarChart3,
  Clock,
  Target,
  AlertTriangle,
  CheckCircle
} from "lucide-react";
import { realMarketDataService, IndicatorSet, MultiTimeframeData } from '@/lib/trading/realMarketDataService';

interface MarketStudyProps {
  symbols: string[];
  refreshInterval?: number; // milliseconds
}

export const MarketStudyComponent = ({ 
  symbols = ['EURUSD', 'GBPUSD', 'USDJPY', 'AUDUSD', 'NZDUSD'],
  refreshInterval = 30000 
}: MarketStudyProps) => {
  const [marketData, setMarketData] = useState<Map<string, {
    indicators: IndicatorSet | null;
    tfData: MultiTimeframeData | null;
    bias: { bias: string; confidence: number; reason: string };
    analysis: string;
    timestamp: Date;
  }>>(new Map());
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [selectedSymbol, setSelectedSymbol] = useState(symbols[0]);

  const fetchMarketData = useCallback(async () => {
    setIsLoading(true);
    console.log('📊 Fetching market data for all symbols...');
    
    const newData = new Map();
    
    for (const symbol of symbols) {
      try {
        const analysis = await realMarketDataService.getRealTimeAnalysis(symbol);
        const tfData = analysis.multiTimeframe;
        
        let bias = { bias: 'NEUTRAL', confidence: 0, reason: 'No data' };
        if (tfData) {
          bias = realMarketDataService.getMultiTimeframeBias(tfData);
        }
        
        newData.set(symbol, {
          indicators: analysis.indicators,
          tfData,
          bias,
          analysis: analysis.analysis,
          timestamp: new Date()
        });
      } catch (error) {
        console.error(`❌ Failed to fetch data for ${symbol}:`, error);
        newData.set(symbol, {
          indicators: null,
          tfData: null,
          bias: { bias: 'ERROR', confidence: 0, reason: 'Connection failed' },
          analysis: `Failed to fetch data: ${error instanceof Error ? error.message : 'Unknown error'}`,
          timestamp: new Date()
        });
      }
    }
    
    setMarketData(newData);
    setLastUpdate(new Date());
    setIsLoading(false);
  }, [symbols]);

  useEffect(() => {
    fetchMarketData();
    const interval = setInterval(fetchMarketData, refreshInterval);
    return () => clearInterval(interval);
  }, [fetchMarketData, refreshInterval]);

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'BULLISH': return <TrendingUp className="w-4 h-4 text-green-500" />;
      case 'BEARISH': return <TrendingDown className="w-4 h-4 text-red-500" />;
      default: return <Minus className="w-4 h-4 text-gray-500" />;
    }
  };

  const getBiasBadge = (bias: string, confidence: number) => {
    if (bias === 'BUY') {
      return <Badge className="bg-green-500">BUY ({confidence.toFixed(0)}%)</Badge>;
    } else if (bias === 'SELL') {
      return <Badge className="bg-red-500">SELL ({confidence.toFixed(0)}%)</Badge>;
    }
    return <Badge variant="secondary">NEUTRAL</Badge>;
  };

  const selectedData = marketData.get(selectedSymbol);
  const ind = selectedData?.indicators;

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 border-blue-500/20">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="w-6 h-6 text-blue-500" />
              Real-Time Market Study
            </CardTitle>
            <div className="flex items-center gap-4">
              <span className="text-sm text-muted-foreground">
                Last update: {lastUpdate.toLocaleTimeString()}
              </span>
              <button
                onClick={fetchMarketData}
                disabled={isLoading}
                className="p-2 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 transition-colors"
              >
                <RefreshCw className={`w-4 h-4 text-blue-500 ${isLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Symbol Selection */}
      <div className="flex gap-2 flex-wrap">
        {symbols.map(symbol => (
          <button
            key={symbol}
            onClick={() => setSelectedSymbol(symbol)}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              selectedSymbol === symbol
                ? 'bg-blue-500 text-white'
                : 'bg-muted hover:bg-muted/80'
            }`}
          >
            {symbol}
          </button>
        ))}
      </div>

      {/* Main Analysis Display */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Indicator Panel */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="w-5 h-5" />
              Technical Indicators - {selectedSymbol}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {ind ? (
              <div className="space-y-4">
                {/* Current Price */}
                <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                  <span className="text-sm text-muted-foreground">Current Price</span>
                  <span className="text-2xl font-bold">{ind.currentPrice.toFixed(5)}</span>
                </div>

                {/* Trend */}
                <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                  <span className="text-sm text-muted-foreground">Trend Direction</span>
                  <div className="flex items-center gap-2">
                    {getTrendIcon(ind.trendDirection)}
                    <span className="font-medium">{ind.trendDirection}</span>
                    <span className="text-sm text-muted-foreground">({ind.trendStrength.toFixed(0)}%)</span>
                  </div>
                </div>

                {/* RSI */}
                <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                  <span className="text-sm text-muted-foreground">RSI (14)</span>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{ind.rsi.toFixed(1)}</span>
                    {ind.rsi < 30 && <Badge className="bg-green-500">Oversold</Badge>}
                    {ind.rsi > 70 && <Badge className="bg-red-500">Overbought</Badge>}
                    {ind.rsi >= 30 && ind.rsi <= 70 && <Badge variant="secondary">Neutral</Badge>}
                  </div>
                </div>

                {/* MACD */}
                <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                  <span className="text-sm text-muted-foreground">MACD Histogram</span>
                  <span className={`font-medium ${ind.macd.histogram >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {ind.macd.histogram >= 0 ? '+' : ''}{ind.macd.histogram.toFixed(5)}
                  </span>
                </div>

                {/* EMAs */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 rounded-lg bg-muted/50">
                    <div className="text-xs text-muted-foreground">EMA 9</div>
                    <div className="font-medium">{ind.ema9.toFixed(5)}</div>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50">
                    <div className="text-xs text-muted-foreground">EMA 21</div>
                    <div className="font-medium">{ind.ema21.toFixed(5)}</div>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50">
                    <div className="text-xs text-muted-foreground">EMA 50</div>
                    <div className="font-medium">{ind.ema50.toFixed(5)}</div>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50">
                    <div className="text-xs text-muted-foreground">EMA 200</div>
                    <div className="font-medium">{ind.ema200.toFixed(5)}</div>
                  </div>
                </div>

                {/* Bollinger Bands */}
                <div className="p-4 rounded-lg bg-muted/50">
                  <div className="text-sm text-muted-foreground mb-2">Bollinger Bands</div>
                  <div className="flex justify-between text-sm">
                    <span className="text-red-400">Upper: {ind.bollinger.upper.toFixed(5)}</span>
                    <span className="text-gray-400">Middle: {ind.bollinger.middle.toFixed(5)}</span>
                    <span className="text-green-400">Lower: {ind.bollinger.lower.toFixed(5)}</span>
                  </div>
                </div>

                {/* ATR */}
                <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                  <span className="text-sm text-muted-foreground">ATR (14)</span>
                  <span className="font-medium">{ind.atr.toFixed(5)} ({ind.atrPercent.toFixed(2)}%)</span>
                </div>
              </div>
            ) : (
              <div className="p-8 text-center text-muted-foreground">
                {isLoading ? 'Loading indicators...' : 'No indicator data available'}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Multi-Timeframe Bias Panel */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5" />
              Multi-Timeframe Bias
            </CardTitle>
          </CardHeader>
          <CardContent>
            {selectedData && selectedData.bias ? (
              <div className="space-y-4">
                {/* Overall Bias */}
                <div className="flex items-center justify-between p-4 rounded-lg bg-gradient-to-r from-primary/10 to-accent/10">
                  <span className="text-sm font-medium">Overall Market Bias</span>
                  {getBiasBadge(selectedData.bias.bias, selectedData.bias.confidence)}
                </div>

                {/* Reason */}
                <div className="p-4 rounded-lg bg-muted/50">
                  <div className="text-sm text-muted-foreground mb-1">Analysis Reason</div>
                  <div className="text-sm">{selectedData.bias.reason}</div>
                </div>

                {/* Timeframe Breakdown */}
                {selectedData.tfData && (
                  <div className="space-y-2">
                    <div className="text-sm font-medium">Timeframe Breakdown</div>
                    {Object.entries(selectedData.tfData).map(([tf, candles]) => {
                      if (!candles || candles.length < 20) return null;
                      const bias = realMarketDataService.getMultiTimeframeBias({ [tf]: candles });
                      return (
                        <div key={tf} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                          <span className="text-sm font-medium">{tf}</span>
                          <div className="flex items-center gap-2">
                            {getTrendIcon(bias.bias === 'BUY' ? 'BULLISH' : bias.bias === 'SELL' ? 'BEARISH' : 'SIDEWAYS')}
                            <span className="text-sm">{bias.bias}</span>
                            <span className="text-xs text-muted-foreground">({bias.confidence.toFixed(0)}%)</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Entry Signal */}
                {ind && selectedData.bias && (
                  <div className="p-4 rounded-lg border border-primary/20">
                    <div className="flex items-center gap-2 mb-2">
                      <Target className="w-4 h-4 text-primary" />
                      <span className="font-medium">Entry Recommendation</span>
                    </div>
                    {getEntryRecommendation(ind, selectedData.bias)}
                  </div>
                )}
              </div>
            ) : (
              <div className="p-8 text-center text-muted-foreground">
                Loading market bias...
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* All Symbols Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            All Symbols Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-64">
            <div className="space-y-2">
              {symbols.map(symbol => {
                const data = marketData.get(symbol);
                if (!data) return null;
                
                return (
                  <div key={symbol} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                    <div className="flex items-center gap-4">
                      <span className="font-medium">{symbol}</span>
                      {data.indicators && (
                        <span className="text-sm text-muted-foreground">
                          {data.indicators.currentPrice.toFixed(5)}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-4">
                      {data.indicators && (
                        <span className="text-sm">
                          RSI: {data.indicators.rsi.toFixed(1)} | Trend: {data.indicators.trendDirection}
                        </span>
                      )}
                      {getBiasBadge(data.bias.bias, data.bias.confidence)}
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Analysis Log */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="w-5 h-5" />
            Live Analysis Log
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-48">
            <div className="space-y-2">
              {symbols.map(symbol => {
                const data = marketData.get(symbol);
                if (!data) return null;
                
                return (
                  <div key={symbol} className="p-2 rounded text-sm font-mono bg-muted/30">
                    <span className="text-muted-foreground">[{data.timestamp.toLocaleTimeString()}]</span>{' '}
                    <span className="font-medium">{symbol}:</span>{' '}
                    {data.analysis.split('\n').map((line, i) => (
                      <div key={i}>{line}</div>
                    ))}
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
};

// Helper method for entry recommendation
function getEntryRecommendation(ind: IndicatorSet, bias: { bias: string; confidence: number }) {
  // Calculate entry score
  let score = 0;
  const signals: string[] = [];

  // Check RSI conditions
  if (ind.rsi < 30 && bias.bias === 'BUY') {
    score += 40;
    signals.push('✅ RSI oversold + bullish bias');
  } else if (ind.rsi > 70 && bias.bias === 'SELL') {
    score += 40;
    signals.push('✅ RSI overbought + bearish bias');
  }

  // Check trend alignment
  if (ind.trendDirection === 'BULLISH' && bias.bias === 'BUY') {
    score += 30;
    signals.push('✅ Trend aligns with bias');
  } else if (ind.trendDirection === 'BEARISH' && bias.bias === 'SELL') {
    score += 30;
    signals.push('✅ Trend aligns with bias');
  }

  // Check MACD
  if (ind.macd.histogram > 0 && bias.bias === 'BUY') {
    score += 20;
    signals.push('✅ MACD confirming');
  } else if (ind.macd.histogram < 0 && bias.bias === 'SELL') {
    score += 20;
    signals.push('✅ MACD confirming');
  }

  // Generate recommendation
  if (score >= 70) {
    return (
      <div className="space-y-2">
        <Badge className="bg-green-500 text-lg px-4 py-1">STRONG BUY SIGNAL</Badge>
        <div className="text-sm text-muted-foreground">
          {signals.map((s, i) => (
            <div key={i}>{s}</div>
          ))}
        </div>
        <div className="text-xs">Confidence: {score}%</div>
      </div>
    );
  } else if (score >= 50) {
    return (
      <div className="space-y-2">
        <Badge className="bg-yellow-500 text-lg px-4 py-1">WEAK BUY SIGNAL</Badge>
        <div className="text-sm text-muted-foreground">
          {signals.map((s, i) => (
            <div key={i}>{s}</div>
          ))}
        </div>
        <div className="text-xs">Confidence: {score}%</div>
      </div>
    );
  } else if (score >= 30 && bias.bias === 'NEUTRAL') {
    return (
      <div className="space-y-2">
        <Badge variant="secondary" className="text-lg px-4 py-1">WAIT FOR CLARITY</Badge>
        <div className="text-sm text-muted-foreground">
          Market is choppy. Wait for clearer direction.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Badge variant="secondary" className="text-lg px-4 py-1">NO CLEAR SIGNAL</Badge>
      <div className="text-sm text-muted-foreground">
        Not enough confluence factors aligned.
      </div>
    </div>
  );
}

export default MarketStudyComponent;
