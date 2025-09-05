import { Navigation } from "@/components/Navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Search, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  RefreshCw,
  Play,
  Settings
} from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";

const Diagnostics = () => {
  const [diagnosticResults, setDiagnosticResults] = useState<any>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [tradingBot, setTradingBot] = useState<any>(null);

  useEffect(() => {
    // Check if trading bot is available
    if (typeof window !== 'undefined' && (window as any).tradingBot) {
      setTradingBot((window as any).tradingBot);
    }
  }, []);

  const runDiagnostics = async () => {
    setIsRunning(true);
    try {
      const results = {
        timestamp: new Date().toISOString(),
        botAvailable: !!tradingBot,
        mt5Bridge: false,
        botStatus: null,
        recommendations: [] as string[]
      };

      // Check MT5 Bridge
      try {
        const response = await fetch('http://localhost:8001/');
        results.mt5Bridge = response.ok;
        if (!response.ok) {
          results.recommendations.push('🔌 Start MT5 Bridge: python3 mt5_bridge.py');
        }
      } catch (error) {
        results.recommendations.push('🔌 MT5 Bridge not running: python3 mt5_bridge.py');
      }

      // Check bot status
      if (tradingBot) {
        try {
          results.botStatus = tradingBot.getStatus();
          if (!results.botStatus.isConnected) {
            results.recommendations.push('🔑 Connect to MT5 account in the app');
          }
        } catch (error) {
          results.recommendations.push('❌ Error getting bot status: ' + error.message);
        }
      } else {
        results.recommendations.push('🤖 Trading bot not initialized - restart the app');
      }

      // Check current time for trading sessions
      const now = new Date();
      const utcHour = now.getUTCHours();
      const isLondonSession = utcHour >= 8 && utcHour < 16;
      const isNewYorkSession = utcHour >= 13 && utcHour < 21;
      
      if (!isLondonSession && !isNewYorkSession) {
        results.recommendations.push('⏰ Not optimal trading time - wait for London/NY sessions');
      }

      // If everything looks good
      if (results.mt5Bridge && tradingBot && results.botStatus?.isConnected) {
        results.recommendations.push('✅ All systems operational - bot is waiting for signals');
        results.recommendations.push('📈 Consider lowering confidence threshold to 60% for testing');
      }

      setDiagnosticResults(results);
      toast.success('Diagnostics completed!');
    } catch (error) {
      console.error('Diagnostic error:', error);
      toast.error('Failed to run diagnostics');
    } finally {
      setIsRunning(false);
    }
  };

  const forceTradingMode = () => {
    if (tradingBot) {
      try {
        // Update configuration for testing
        tradingBot.updateConfiguration({
          minConfidence: 60,
          maxRiskPerTrade: 1.0,
          tradingHours: {
            start: '00:00',
            end: '23:59',
            timezone: 'UTC'
          }
        });
        toast.success('Trading mode enabled for testing!');
      } catch (error) {
        toast.error('Failed to update configuration: ' + error.message);
      }
    } else {
      toast.error('Trading bot not available');
    }
  };

  const getStatusIcon = (status: boolean) => {
    return status ? <CheckCircle className="w-4 h-4 text-green-500" /> : <XCircle className="w-4 h-4 text-red-500" />;
  };

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2">Trading Bot Diagnostics</h1>
            <p className="text-muted-foreground">
              Check system status and troubleshoot trading issues
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-4 mb-6">
            <Button 
              onClick={runDiagnostics} 
              disabled={isRunning}
              className="flex items-center gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${isRunning ? 'animate-spin' : ''}`} />
              {isRunning ? 'Running...' : 'Run Diagnostics'}
            </Button>
            
            <Button 
              onClick={forceTradingMode}
              variant="outline"
              className="flex items-center gap-2"
            >
              <Play className="w-4 h-4" />
              Force Trading Mode
            </Button>
          </div>

          {/* Diagnostic Results */}
          {diagnosticResults && (
            <div className="space-y-6">
              {/* System Status */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Search className="w-5 h-5" />
                    System Status
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex items-center justify-between p-3 border rounded">
                      <span className="text-sm font-medium">Trading Bot Available</span>
                      <div className="flex items-center gap-2">
                        {getStatusIcon(diagnosticResults.botAvailable)}
                        <span className="text-sm">
                          {diagnosticResults.botAvailable ? 'Yes' : 'No'}
                        </span>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between p-3 border rounded">
                      <span className="text-sm font-medium">MT5 Bridge</span>
                      <div className="flex items-center gap-2">
                        {getStatusIcon(diagnosticResults.mt5Bridge)}
                        <span className="text-sm">
                          {diagnosticResults.mt5Bridge ? 'Running' : 'Not Running'}
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Bot Status Details */}
              {diagnosticResults.botStatus && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Settings className="w-5 h-5" />
                      Bot Status Details
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Connected:</span>
                        <Badge variant={diagnosticResults.botStatus.isConnected ? "default" : "destructive"}>
                          {diagnosticResults.botStatus.isConnected ? 'Yes' : 'No'}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Can Trade:</span>
                        <Badge variant={diagnosticResults.botStatus.canTrade ? "default" : "destructive"}>
                          {diagnosticResults.botStatus.canTrade ? 'Yes' : 'No'}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Auto Trading:</span>
                        <Badge variant={diagnosticResults.botStatus.autoTradingEnabled ? "default" : "secondary"}>
                          {diagnosticResults.botStatus.autoTradingEnabled ? 'Enabled' : 'Disabled'}
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Recommendations */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5" />
                    Recommendations
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {diagnosticResults.recommendations.length > 0 ? (
                    <div className="space-y-2">
                      {diagnosticResults.recommendations.map((rec: string, index: number) => (
                        <div key={index} className="flex items-start gap-2 p-2 bg-muted rounded">
                          <span className="text-sm">{rec}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center text-muted-foreground py-4">
                      No recommendations at this time
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Raw Data */}
              <Card>
                <CardHeader>
                  <CardTitle>Raw Diagnostic Data</CardTitle>
                </CardHeader>
                <CardContent>
                  <pre className="text-xs bg-muted p-4 rounded overflow-auto max-h-40">
                    {JSON.stringify(diagnosticResults, null, 2)}
                  </pre>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Quick Commands */}
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Quick Commands</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="text-sm">
                  <strong>Start MT5 Bridge:</strong>
                  <code className="ml-2 bg-muted px-2 py-1 rounded">python3 mt5_bridge.py</code>
                </div>
                <div className="text-sm">
                  <strong>Check MT5 Bridge:</strong>
                  <code className="ml-2 bg-muted px-2 py-1 rounded">curl http://localhost:8001/</code>
                </div>
                <div className="text-sm">
                  <strong>View Logs:</strong>
                  <code className="ml-2 bg-muted px-2 py-1 rounded">tail -f mt5_bridge.log</code>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Diagnostics;