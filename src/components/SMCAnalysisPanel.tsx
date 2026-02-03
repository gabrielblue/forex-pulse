import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  TrendingUp, 
  TrendingDown, 
  Target, 
  Shield, 
  Zap,
  BarChart3,
  Activity,
  AlertTriangle,
  Clock,
  Newspaper,
  CheckCircle,
  XCircle
} from 'lucide-react';
import { onTickEngine } from '@/lib/trading/onTickEngine';
import { SMCAnalysis } from '@/lib/trading/smartMoneyAnalyzer';
import { TradingFilterResult, Killzone, UpcomingNews } from '@/lib/trading/tradingFilters';

interface SMCAnalysisPanelProps {
  symbol?: string;
}

interface FilterStatus {
  killzoneEnabled: boolean;
  newsBlackoutEnabled: boolean;
  inKillzone: boolean;
  activeKillzone: Killzone | null;
  upcomingHighImpactNews: UpcomingNews[];
  canTradeAny: boolean;
}

export const SMCAnalysisPanel = ({ symbol = 'EURUSD' }: SMCAnalysisPanelProps) => {
  const [analysis, setAnalysis] = useState<SMCAnalysis | null>(null);
  const [activeTrades, setActiveTrades] = useState<any[]>([]);
  const [selectedSymbol, setSelectedSymbol] = useState(symbol);
  const [filterResult, setFilterResult] = useState<TradingFilterResult | null>(null);
  const [filterStatus, setFilterStatus] = useState<FilterStatus | null>(null);
  const [killzoneEnabled, setKillzoneEnabled] = useState(false); // Default to disabled for 24/7 trading
  const [newsBlackoutEnabled, setNewsBlackoutEnabled] = useState(false); // Default to disabled for 24/7 trading

  useEffect(() => {
    const interval = setInterval(async () => {
      const smcAnalysis = onTickEngine.getLastAnalysis(selectedSymbol);
      if (smcAnalysis) {
        setAnalysis(smcAnalysis);
      }
      
      // Get filter results
      const filter = onTickEngine.getLastFilterResult(selectedSymbol);
      if (filter) {
        setFilterResult(filter);
      }
      
      // Get overall filter status
      const status = await onTickEngine.getFilterStatus();
      setFilterStatus(status);
      
      setActiveTrades(onTickEngine.getActiveTrades());
    }, 1000);

    return () => clearInterval(interval);
  }, [selectedSymbol]);

  const handleKillzoneToggle = (enabled: boolean) => {
    setKillzoneEnabled(enabled);
    onTickEngine.setKillzoneFilter(enabled);
  };

  const handleNewsBlackoutToggle = (enabled: boolean) => {
    setNewsBlackoutEnabled(enabled);
    onTickEngine.setNewsBlackout(enabled);
  };

  const getBiasColor = (bias: string) => {
    switch (bias) {
      case 'BUY': return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
      case 'SELL': return 'bg-red-500/20 text-red-400 border-red-500/30';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getConfluenceColor = (score: number) => {
    if (score >= 70) return 'text-emerald-400';
    if (score >= 50) return 'text-amber-400';
    return 'text-red-400';
  };

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Zap className="h-5 w-5 text-amber-400" />
            Smart Money Analysis
          </CardTitle>
          <Badge variant="outline" className="text-xs">
            ChartLord Style
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Trading Filters Status - NEW */}
        <div className="p-3 rounded-lg bg-muted/30 border border-border space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium flex items-center gap-2">
              <Shield className="h-4 w-4 text-primary" />
              Trading Filters
            </span>
            {filterResult?.canTrade ? (
              <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                <CheckCircle className="h-3 w-3 mr-1" />
                Can Trade
              </Badge>
            ) : (
              <Badge className="bg-red-500/20 text-red-400 border-red-500/30">
                <XCircle className="h-3 w-3 mr-1" />
                Blocked
              </Badge>
            )}
          </div>

          {/* Killzone Status */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-amber-400" />
              <Label htmlFor="killzone" className="text-xs">Session Killzone</Label>
            </div>
            <div className="flex items-center gap-2">
              {filterResult?.inKillzone ? (
                <Badge variant="outline" className="text-xs bg-emerald-500/10 text-emerald-400">
                  {filterResult.activeKillzone?.name || 'Active'}
                </Badge>
              ) : (
                <Badge variant="outline" className="text-xs text-muted-foreground">
                  Outside
                </Badge>
              )}
              <Switch 
                id="killzone"
                checked={killzoneEnabled}
                onCheckedChange={handleKillzoneToggle}
                className="scale-75"
              />
            </div>
          </div>

          {/* News Blackout Status */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Newspaper className="h-4 w-4 text-blue-400" />
              <Label htmlFor="newsblackout" className="text-xs">News Blackout</Label>
            </div>
            <div className="flex items-center gap-2">
              {filterResult?.newsBlackout ? (
                <Badge variant="outline" className="text-xs bg-red-500/10 text-red-400">
                  ⚠️ Active
                </Badge>
              ) : (
                <Badge variant="outline" className="text-xs text-emerald-400">
                  Clear
                </Badge>
              )}
              <Switch 
                id="newsblackout"
                checked={newsBlackoutEnabled}
                onCheckedChange={handleNewsBlackoutToggle}
                className="scale-75"
              />
            </div>
          </div>

          {/* Filter Reason */}
          {filterResult && !filterResult.canTrade && (
            <Alert className="bg-amber-500/10 border-amber-500/30">
              <AlertTriangle className="h-4 w-4 text-amber-400" />
              <AlertDescription className="text-xs text-amber-300">
                {filterResult.reason}
              </AlertDescription>
            </Alert>
          )}

          {/* Upcoming News */}
          {filterResult?.upcomingNews && (
            <div className="p-2 rounded bg-red-500/10 border border-red-500/20 text-xs">
              <div className="font-medium text-red-400">📰 {filterResult.upcomingNews.title}</div>
              <div className="text-muted-foreground">{filterResult.upcomingNews.currency} - {filterResult.upcomingNews.impact}</div>
            </div>
          )}

          {/* Best Pairs for Current Killzone */}
          {filterResult?.inKillzone && filterResult.bestPairsNow.length > 0 && (
            <div className="text-xs">
              <span className="text-muted-foreground">Best pairs now: </span>
              <span className="text-primary">{filterResult.bestPairsNow.slice(0, 4).join(', ')}</span>
            </div>
          )}
        </div>

        {/* Symbol Selector */}
        <div className="flex gap-2 flex-wrap">
          {['XAUUSD', 'EURUSD', 'GBPUSD', 'USDJPY', 'AUDUSD', 'USDCHF'].map(sym => (
            <Badge
              key={sym}
              variant={selectedSymbol === sym ? 'default' : 'outline'}
              className="cursor-pointer hover:bg-primary/20"
              onClick={() => setSelectedSymbol(sym)}
            >
              {sym}
            </Badge>
          ))}
        </div>

        {analysis ? (
          <Tabs defaultValue="confluence" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="confluence">Confluence</TabsTrigger>
              <TabsTrigger value="filters">Filters</TabsTrigger>
              <TabsTrigger value="structure">Structure</TabsTrigger>
              <TabsTrigger value="levels">Levels</TabsTrigger>
            </TabsList>

            <TabsContent value="confluence" className="space-y-4 mt-4">
              {/* Trade Bias */}
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <span className="text-sm font-medium">Trade Bias</span>
                <Badge className={getBiasColor(analysis.tradeBias)}>
                  {analysis.tradeBias === 'BUY' && <TrendingUp className="h-3 w-3 mr-1" />}
                  {analysis.tradeBias === 'SELL' && <TrendingDown className="h-3 w-3 mr-1" />}
                  {analysis.tradeBias}
                </Badge>
              </div>

              {/* Confluence Score */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Confluence Score</span>
                  <span className={`text-lg font-bold ${getConfluenceColor(analysis.confluenceScore)}`}>
                    {analysis.confluenceScore.toFixed(0)}%
                  </span>
                </div>
                <Progress 
                  value={analysis.confluenceScore} 
                  className="h-2"
                />
                <p className="text-xs text-muted-foreground">
                  {analysis.confluenceScore >= 50 
                    ? '✅ Sufficient confluence for trade' 
                    : '⚠️ Need 50%+ confluence (5+ factors)'}
                </p>
              </div>

              {/* Confluence Factors */}
              <div className="space-y-2">
                <span className="text-sm font-medium">Confluence Factors ({analysis.confluenceFactors.length})</span>
                <ScrollArea className="h-32 rounded-md border p-2">
                  <div className="space-y-1">
                    {analysis.confluenceFactors.map((factor, idx) => (
                      <div key={`factor-${idx}-${factor.substring(0, 10)}`} className="text-xs text-muted-foreground">
                        {factor}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>

              {/* Entry Zone */}
              {analysis.entryZone && (
                <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
                  <div className="flex items-center gap-2 mb-2">
                    <Target className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium">Entry Zone</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-muted-foreground">High: </span>
                      <span className="font-mono">{analysis.entryZone.high.toFixed(5)}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Low: </span>
                      <span className="font-mono">{analysis.entryZone.low.toFixed(5)}</span>
                    </div>
                  </div>
                </div>
              )}
            </TabsContent>

            {/* NEW: Filters Tab */}
            <TabsContent value="filters" className="space-y-4 mt-4">
              {/* Killzones Overview */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-amber-400" />
                  <span className="text-sm font-medium">Session Killzones (UTC)</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {onTickEngine.getKillzones().map((kz, idx) => (
                    <div
                      key={`killzone-${kz.name}-${idx}`}
                      className={`p-2 rounded text-xs ${
                        filterResult?.activeKillzone?.name === kz.name
                          ? 'bg-emerald-500/20 border border-emerald-500/30'
                          : 'bg-muted/30'
                      }`}
                    >
                      <div className="font-medium">{kz.name}</div>
                      <div className="text-muted-foreground">
                        {kz.startHour.toString().padStart(2, '0')}:00 - {kz.endHour.toString().padStart(2, '0')}:00
                      </div>
                      <div className="text-xs text-primary mt-1">
                        {kz.bestPairs.slice(0, 3).join(', ')}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Upcoming High-Impact News */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Newspaper className="h-4 w-4 text-red-400" />
                  <span className="text-sm font-medium">Upcoming News (±2h)</span>
                </div>
                <ScrollArea className="h-32">
                  <div className="space-y-1">
                    {filterStatus?.upcomingHighImpactNews.map((news, idx) => (
                      <div
                        key={`news-${news.id || 'unknown'}-${idx}`}
                        className="p-2 rounded text-xs bg-red-500/10 border-l-2 border-red-500"
                      >
                        <div className="flex justify-between">
                          <span className="font-medium">{news.title}</span>
                          <Badge variant="outline" className="text-xs">{news.currency}</Badge>
                        </div>
                        <div className="text-muted-foreground">
                          {news.eventTime.toLocaleTimeString()} - {news.impact}
                        </div>
                      </div>
                    ))}
                    {(!filterStatus?.upcomingHighImpactNews || filterStatus.upcomingHighImpactNews.length === 0) && (
                      <div className="text-xs text-muted-foreground p-2 text-center">
                        No high-impact news in next 2 hours
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </div>

              {/* Filter Settings */}
              <div className="space-y-3 p-3 rounded-lg bg-muted/30 border border-border">
                <div className="text-sm font-medium">Filter Settings</div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="kz-full" className="text-xs">Killzone Filter</Label>
                  <Switch 
                    id="kz-full"
                    checked={killzoneEnabled}
                    onCheckedChange={handleKillzoneToggle}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="nb-full" className="text-xs">News Blackout (30min)</Label>
                  <Switch 
                    id="nb-full"
                    checked={newsBlackoutEnabled}
                    onCheckedChange={handleNewsBlackoutToggle}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  {killzoneEnabled && newsBlackoutEnabled 
                    ? '✅ Maximum protection - only trades during optimal windows'
                    : '⚠️ Some filters disabled - increased risk'}
                </p>
              </div>
            </TabsContent>

            <TabsContent value="structure" className="space-y-4 mt-4">
              {/* Market Structure */}
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <span className="text-sm">Trend</span>
                  <Badge variant="outline">
                    {analysis.marketStructure.trend === 'BULLISH' && <TrendingUp className="h-3 w-3 mr-1 text-emerald-400" />}
                    {analysis.marketStructure.trend === 'BEARISH' && <TrendingDown className="h-3 w-3 mr-1 text-red-400" />}
                    {analysis.marketStructure.trend}
                  </Badge>
                </div>

                {analysis.marketStructure.lastBOS && (
                  <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                    <div className="flex items-center gap-2">
                      <Activity className="h-4 w-4 text-emerald-400" />
                      <span className="text-sm font-medium">Break of Structure</span>
                    </div>
                    <div className="mt-2 text-xs">
                      <span className="text-muted-foreground">
                        {analysis.marketStructure.lastBOS.type} BOS at{' '}
                        <span className="font-mono">{analysis.marketStructure.lastBOS.price.toFixed(5)}</span>
                      </span>
                    </div>
                  </div>
                )}

                {analysis.marketStructure.lastCHoCH && (
                  <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-amber-400" />
                      <span className="text-sm font-medium">Change of Character</span>
                    </div>
                    <div className="mt-2 text-xs">
                      <span className="text-muted-foreground">
                        {analysis.marketStructure.lastCHoCH.type} CHoCH at{' '}
                        <span className="font-mono">{analysis.marketStructure.lastCHoCH.price.toFixed(5)}</span>
                      </span>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2 rounded bg-muted/30 text-xs">
                    <span className="text-muted-foreground">Swing High: </span>
                    <span className="font-mono">{analysis.marketStructure.swingHigh.toFixed(5)}</span>
                  </div>
                  <div className="p-2 rounded bg-muted/30 text-xs">
                    <span className="text-muted-foreground">Swing Low: </span>
                    <span className="font-mono">{analysis.marketStructure.swingLow.toFixed(5)}</span>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="levels" className="space-y-4 mt-4">
              {/* Order Blocks */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-blue-400" />
                  <span className="text-sm font-medium">Order Blocks ({analysis.orderBlocks.length})</span>
                </div>
                <ScrollArea className="h-24">
                  <div className="space-y-1">
                    {analysis.orderBlocks.map((ob, idx) => (
                      <div
                        key={`ob-${idx}-${ob.low}-${ob.high}`}
                        className={`p-2 rounded text-xs ${
                          ob.type === 'BULLISH'
                            ? 'bg-emerald-500/10 border-l-2 border-emerald-500'
                            : 'bg-red-500/10 border-l-2 border-red-500'
                        }`}
                      >
                        <div className="flex justify-between">
                          <span>{ob.type} OB</span>
                          <span className="text-muted-foreground">{ob.strength.toFixed(0)}%</span>
                        </div>
                        <div className="font-mono text-muted-foreground">
                          {ob.low.toFixed(5)} - {ob.high.toFixed(5)}
                        </div>
                      </div>
                    ))}
                    {analysis.orderBlocks.length === 0 && (
                      <div className="text-xs text-muted-foreground p-2">No order blocks detected</div>
                    )}
                  </div>
                </ScrollArea>
              </div>

              {/* Fair Value Gaps */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-purple-400" />
                  <span className="text-sm font-medium">Fair Value Gaps ({analysis.fairValueGaps.length})</span>
                </div>
                <ScrollArea className="h-24">
                  <div className="space-y-1">
                    {analysis.fairValueGaps.map((fvg, idx) => (
                      <div
                        key={`fvg-${idx}-${fvg.low}-${fvg.high}`}
                        className={`p-2 rounded text-xs ${
                          fvg.type === 'BULLISH'
                            ? 'bg-emerald-500/10 border-l-2 border-emerald-500'
                            : 'bg-red-500/10 border-l-2 border-red-500'
                        }`}
                      >
                        <div className="flex justify-between">
                          <span>{fvg.type} FVG</span>
                          <span className="text-muted-foreground">
                            {fvg.filled ? 'Filled' : 'Open'}
                          </span>
                        </div>
                        <div className="font-mono text-muted-foreground">
                          {fvg.low.toFixed(5)} - {fvg.high.toFixed(5)}
                        </div>
                      </div>
                    ))}
                    {analysis.fairValueGaps.length === 0 && (
                      <div className="text-xs text-muted-foreground p-2">No unfilled FVGs</div>
                    )}
                  </div>
                </ScrollArea>
              </div>

              {/* Liquidity Zones */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Target className="h-4 w-4 text-amber-400" />
                  <span className="text-sm font-medium">Liquidity Zones ({analysis.liquidityZones.length})</span>
                </div>
                <ScrollArea className="h-20">
                  <div className="space-y-1">
                    {analysis.liquidityZones.map((zone, idx) => (
                      <div
                        key={`zone-${idx}-${zone.level}`}
                        className="p-2 rounded text-xs bg-muted/30"
                      >
                        <div className="flex justify-between">
                          <span>{zone.type} Liquidity</span>
                          <span className="text-muted-foreground">{zone.strength.toFixed(0)}%</span>
                        </div>
                        <div className="font-mono text-muted-foreground">
                          {zone.level.toFixed(5)}
                        </div>
                      </div>
                    ))}
                    {analysis.liquidityZones.length === 0 && (
                      <div className="text-xs text-muted-foreground p-2">No liquidity zones detected</div>
                    )}
                  </div>
                </ScrollArea>
              </div>
            </TabsContent>
          </Tabs>
        ) : (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <Activity className="h-8 w-8 mb-2 animate-pulse" />
            <p className="text-sm">Waiting for market data...</p>
            <p className="text-xs">Start the OnTick Engine to begin analysis</p>
          </div>
        )}

        {/* Active Trades with Trailing Info */}
        {activeTrades.length > 0 && (
          <div className="mt-4 space-y-2">
            <span className="text-sm font-medium">Active Trades (Dynamic Trailing)</span>
            <div className="space-y-2">
              {activeTrades.map((trade, idx) => (
                <div
                  key={`trade-${trade.ticketId}-${idx}`}
                  className={`p-3 rounded-lg ${
                    trade.profit >= 0 ? 'bg-emerald-500/10' : 'bg-red-500/10'
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <span className="font-medium">{trade.symbol}</span>
                    <Badge variant={trade.type === 'BUY' ? 'default' : 'destructive'}>
                      {trade.type}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-3 gap-2 mt-2 text-xs">
                    <div>
                      <span className="text-muted-foreground">R Multiple: </span>
                      <span className={trade.rMultiple >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                        {trade.rMultiple.toFixed(2)}R
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">BE: </span>
                      <span>{trade.breakEvenMoved ? '✅' : '❌'}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Trail: </span>
                      <span>{trade.trailingActivated ? '✅' : '❌'}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default SMCAnalysisPanel;

