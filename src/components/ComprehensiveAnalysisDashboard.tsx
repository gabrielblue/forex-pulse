import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { 
  Brain, 
  TrendingUp, 
  TrendingDown, 
  BarChart3, 
  Volume2, 
  Globe, 
  Target,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Activity,
  Zap,
  Clock,
  Shield
} from "lucide-react";
import { advancedAnalyzer, ComprehensiveAnalysis } from "@/lib/trading/advancedAnalyzer";

export const ComprehensiveAnalysisDashboard = () => {
  const [analysis, setAnalysis] = useState<ComprehensiveAnalysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [selectedSymbol, setSelectedSymbol] = useState('EURUSD');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const symbols = ['EURUSD', 'GBPUSD', 'USDJPY', 'AUDUSD', 'USDCHF', 'NZDUSD'];

  useEffect(() => {
    performAnalysis();
    
    // Auto-refresh every 5 minutes
    const interval = setInterval(() => {
      performAnalysis();
    }, 5 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, [selectedSymbol]);

  const performAnalysis = async () => {
    setIsAnalyzing(true);
    try {
      const result = await advancedAnalyzer.performComprehensiveAnalysis(selectedSymbol);
      setAnalysis(result);
      setLastUpdated(new Date());
    } catch (error) {
      console.error('Analysis failed:', error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const getRecommendationColor = (recommendation: string) => {
    switch (recommendation) {
      case 'STRONG_BUY': return 'text-green-600 bg-green-50 border-green-200';
      case 'BUY': return 'text-green-500 bg-green-50 border-green-200';
      case 'HOLD': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'SELL': return 'text-red-500 bg-red-50 border-red-200';
      case 'STRONG_SELL': return 'text-red-600 bg-red-50 border-red-200';
      default: return 'text-muted-foreground bg-muted/50';
    }
  };

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'LOW': return 'text-green-600';
      case 'MEDIUM': return 'text-yellow-600';
      case 'HIGH': return 'text-red-600';
      default: return 'text-muted-foreground';
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'BULLISH': return <TrendingUp className="w-4 h-4 text-green-600" />;
      case 'BEARISH': return <TrendingDown className="w-4 h-4 text-red-600" />;
      default: return <Activity className="w-4 h-4 text-yellow-600" />;
    }
  };

  if (!analysis) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Brain className="w-5 h-5" />
              Comprehensive Market Analysis
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="text-center space-y-4">
              <div className="flex items-center gap-2">
                <Zap className="w-5 h-5 animate-pulse text-primary" />
                <span className="text-lg">Performing Deep Market Analysis...</span>
              </div>
              <p className="text-muted-foreground">
                Analyzing multiple timeframes, market structure, volume, and sentiment
              </p>
              <Progress value={isAnalyzing ? 65 : 0} className="w-64" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Symbol Selection */}
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Brain className="w-6 h-6 text-primary" />
              </div>
              <div>
                <CardTitle>Advanced Trading Analysis</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Multi-timeframe • Market Structure • Volume • Sentiment
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <select 
                value={selectedSymbol} 
                onChange={(e) => setSelectedSymbol(e.target.value)}
                className="px-3 py-2 border rounded-md bg-background"
              >
                {symbols.map(symbol => (
                  <option key={symbol} value={symbol}>{symbol}</option>
                ))}
              </select>
              
              <Button 
                variant="outline" 
                onClick={performAnalysis}
                disabled={isAnalyzing}
                size="sm"
              >
                {isAnalyzing ? (
                  <>
                    <Zap className="w-4 h-4 mr-2 animate-pulse" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Brain className="w-4 h-4 mr-2" />
                    Refresh
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Overall Assessment */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Recommendation</span>
              <Target className="w-4 h-4 text-muted-foreground" />
            </div>
            <Badge className={`${getRecommendationColor(analysis.recommendation)} px-3 py-1`}>
              {analysis.recommendation.replace('_', ' ')}
            </Badge>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Confidence</span>
              <CheckCircle className="w-4 h-4 text-muted-foreground" />
            </div>
            <div className="text-2xl font-bold text-primary">{analysis.confidence}%</div>
            <Progress value={analysis.confidence} className="mt-2" />
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Risk Level</span>
              <Shield className="w-4 h-4 text-muted-foreground" />
            </div>
            <div className={`text-2xl font-bold ${getRiskColor(analysis.riskLevel)}`}>
              {analysis.riskLevel}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Score</span>
              <BarChart3 className="w-4 h-4 text-muted-foreground" />
            </div>
            <div className="text-2xl font-bold text-accent">{analysis.overallScore}/100</div>
            <Progress value={analysis.overallScore} className="mt-2" />
          </CardContent>
        </Card>
      </div>

      {/* Detailed Analysis Tabs */}
      <Tabs defaultValue="timeframes" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="timeframes" className="flex items-center gap-2">
            <Clock className="w-4 h-4" />
            Timeframes
          </TabsTrigger>
          <TabsTrigger value="structure" className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4" />
            Structure
          </TabsTrigger>
          <TabsTrigger value="volume" className="flex items-center gap-2">
            <Volume2 className="w-4 h-4" />
            Volume
          </TabsTrigger>
          <TabsTrigger value="sentiment" className="flex items-center gap-2">
            <Globe className="w-4 h-4" />
            Sentiment
          </TabsTrigger>
        </TabsList>

        <TabsContent value="timeframes">
          <Card>
            <CardHeader>
              <CardTitle>Multi-Timeframe Analysis</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {analysis.multiTimeframe.map((tf, index) => (
                  <div key={index} className="p-4 border rounded-lg bg-card/50">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{tf.timeframe}</Badge>
                        {getTrendIcon(tf.trend)}
                        <span className="font-medium">{tf.trend}</span>
                      </div>
                      <div className="text-right">
                        <div className="text-sm text-muted-foreground">Strength</div>
                        <div className="font-bold">{tf.strength.toFixed(1)}/100</div>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">RSI:</span>
                        <span className="ml-1 font-medium">{tf.indicators.rsi.toFixed(1)}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">EMA20:</span>
                        <span className="ml-1 font-medium">{tf.indicators.ema20.toFixed(4)}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Support:</span>
                        <span className="ml-1 font-medium">{tf.support?.toFixed(4) || 'N/A'}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Resistance:</span>
                        <span className="ml-1 font-medium">{tf.resistance?.toFixed(4) || 'N/A'}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="structure">
          <Card>
            <CardHeader>
              <CardTitle>Market Structure Analysis</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center">
                    <div className="flex items-center justify-center mb-2">
                      {analysis.marketStructure.higherHighs ? 
                        <CheckCircle className="w-5 h-5 text-green-600" /> : 
                        <XCircle className="w-5 h-5 text-red-600" />
                      }
                    </div>
                    <div className="text-sm">Higher Highs</div>
                  </div>
                  
                  <div className="text-center">
                    <div className="flex items-center justify-center mb-2">
                      {analysis.marketStructure.higherLows ? 
                        <CheckCircle className="w-5 h-5 text-green-600" /> : 
                        <XCircle className="w-5 h-5 text-red-600" />
                      }
                    </div>
                    <div className="text-sm">Higher Lows</div>
                  </div>
                  
                  <div className="text-center">
                    <div className="flex items-center justify-center mb-2">
                      {analysis.marketStructure.lowerHighs ? 
                        <CheckCircle className="w-5 h-5 text-green-600" /> : 
                        <XCircle className="w-5 h-5 text-red-600" />
                      }
                    </div>
                    <div className="text-sm">Lower Highs</div>
                  </div>
                  
                  <div className="text-center">
                    <div className="flex items-center justify-center mb-2">
                      {analysis.marketStructure.lowerLows ? 
                        <CheckCircle className="w-5 h-5 text-green-600" /> : 
                        <XCircle className="w-5 h-5 text-red-600" />
                      }
                    </div>
                    <div className="text-sm">Lower Lows</div>
                  </div>
                </div>
                
                <Separator />
                
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Badge variant="outline" className="px-3 py-1">
                      {analysis.marketStructure.trendStructure}
                    </Badge>
                    {getTrendIcon(analysis.marketStructure.trendStructure === 'UPTREND' ? 'BULLISH' : 
                                   analysis.marketStructure.trendStructure === 'DOWNTREND' ? 'BEARISH' : 'NEUTRAL')}
                  </div>
                  
                  <div className="space-y-2">
                    <h4 className="font-medium">Key Levels:</h4>
                    {analysis.marketStructure.keyLevels.map((level, index) => (
                      <div key={index} className="flex items-center justify-between p-2 bg-muted/50 rounded">
                        <div className="flex items-center gap-2">
                          <Badge variant={level.type === 'SUPPORT' ? 'default' : 'secondary'}>
                            {level.type}
                          </Badge>
                          <span className="font-mono">{level.level.toFixed(4)}</span>
                        </div>
                        <div className="text-sm">
                          Strength: {level.strength}/100
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="volume">
          <Card>
            <CardHeader>
              <CardTitle>Volume Analysis</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="text-center p-4 border rounded-lg">
                    <div className="text-lg font-bold mb-1">{analysis.volumeAnalysis.volumeTrend}</div>
                    <div className="text-sm text-muted-foreground">Volume Trend</div>
                  </div>
                  
                  <div className="text-center p-4 border rounded-lg">
                    <div className="flex items-center justify-center mb-2">
                      {analysis.volumeAnalysis.volumeConfirmation ? 
                        <CheckCircle className="w-6 h-6 text-green-600" /> : 
                        <XCircle className="w-6 h-6 text-red-600" />
                      }
                    </div>
                    <div className="text-sm text-muted-foreground">Price Confirmation</div>
                  </div>
                  
                  <div className="text-center p-4 border rounded-lg">
                    <div className="flex items-center justify-center mb-2">
                      {analysis.volumeAnalysis.abnormalVolume ? 
                        <AlertTriangle className="w-6 h-6 text-yellow-600" /> : 
                        <CheckCircle className="w-6 h-6 text-green-600" />
                      }
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {analysis.volumeAnalysis.abnormalVolume ? 'Abnormal Volume' : 'Normal Volume'}
                    </div>
                  </div>
                </div>
                
                <div>
                  <h4 className="font-medium mb-3">Volume Analysis Summary:</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <Volume2 className="w-4 h-4" />
                      <span>
                        Volume trend is <strong>{analysis.volumeAnalysis.volumeTrend.toLowerCase()}</strong>
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {analysis.volumeAnalysis.volumeConfirmation ? 
                        <CheckCircle className="w-4 h-4 text-green-600" /> : 
                        <XCircle className="w-4 h-4 text-red-600" />
                      }
                      <span>
                        Volume {analysis.volumeAnalysis.volumeConfirmation ? 'confirms' : 'diverges from'} price movement
                      </span>
                    </div>
                    {analysis.volumeAnalysis.abnormalVolume && (
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-yellow-600" />
                        <span>Abnormal volume detected - potential significant move ahead</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sentiment">
          <Card>
            <CardHeader>
              <CardTitle>Market Sentiment Analysis</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="text-center p-4 border rounded-lg">
                    <div className="text-lg font-bold mb-1">{analysis.sentimentAnalysis.overall}</div>
                    <div className="text-sm text-muted-foreground">Overall Sentiment</div>
                  </div>
                  
                  <div className="text-center p-4 border rounded-lg">
                    <div className="text-lg font-bold mb-1">{analysis.sentimentAnalysis.newsImpact}</div>
                    <div className="text-sm text-muted-foreground">News Impact</div>
                  </div>
                  
                  <div className="text-center p-4 border rounded-lg">
                    <div className="text-lg font-bold mb-1">{analysis.sentimentAnalysis.riskOffOn}</div>
                    <div className="text-sm text-muted-foreground">Risk Appetite</div>
                  </div>
                </div>
                
                <div>
                  <h4 className="font-medium mb-3">Economic Events:</h4>
                  <div className="space-y-2">
                    {analysis.sentimentAnalysis.economicEvents.map((event, index) => (
                      <Badge key={index} variant="outline" className="mr-2 mb-2">
                        {event}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Entry and Exit Conditions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="w-5 h-5 text-green-600" />
              Entry Conditions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {analysis.entryConditions.map((condition, index) => (
                <div key={index} className="flex items-start gap-2 text-sm">
                  <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                  <span>{condition}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-red-600" />
              Exit Conditions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {analysis.exitConditions.map((condition, index) => (
                <div key={index} className="flex items-start gap-2 text-sm">
                  <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                  <span>{condition}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Last Updated */}
      {lastUpdated && (
        <div className="text-center text-sm text-muted-foreground">
          Last updated: {lastUpdated.toLocaleTimeString()}
        </div>
      )}
    </div>
  );
};