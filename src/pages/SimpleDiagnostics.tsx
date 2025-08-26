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
  Settings,
  Terminal
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const SimpleDiagnostics = () => {
  const [diagnosticResults, setDiagnosticResults] = useState<any>(null);
  const [isRunning, setIsRunning] = useState(false);

  const runDiagnostics = async () => {
    setIsRunning(true);
    try {
      const results = {
        timestamp: new Date().toISOString(),
        mt5Bridge: false,
        tradingBot: false,
        currentTime: new Date().toISOString(),
        utcHour: new Date().getUTCHours(),
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

      // Check if trading bot is available
      if (typeof window !== 'undefined') {
        results.tradingBot = !!(window as any).tradingBot;
        if (!results.tradingBot) {
          results.recommendations.push('🤖 Trading bot not found - check if app is properly initialized');
        }
      }

      // Check trading sessions
      const utcHour = results.utcHour;
      const isLondonSession = utcHour >= 8 && utcHour < 16;
      const isNewYorkSession = utcHour >= 13 && utcHour < 21;
      
      if (!isLondonSession && !isNewYorkSession) {
        results.recommendations.push('⏰ Not optimal trading time - wait for London/NY sessions');
      }

      // If everything looks good
      if (results.mt5Bridge && results.tradingBot) {
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

  const getStatusIcon = (status: boolean) => {
    return status ? <CheckCircle className="w-4 h-4 text-green-500" /> : <XCircle className="w-4 h-4 text-red-500" />;
  };

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2">Simple Trading Bot Diagnostics</h1>
            <p className="text-muted-foreground">
              Basic system status check - no complex dependencies
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
                        {getStatusIcon(diagnosticResults.tradingBot)}
                        <span className="text-sm">
                          {diagnosticResults.tradingBot ? 'Yes' : 'No'}
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

              {/* Time Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Terminal className="w-5 h-5" />
                    Time & Session Info
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Current Time (UTC):</span>
                      <span className="text-sm font-medium">{diagnosticResults.currentTime}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">UTC Hour:</span>
                      <span className="text-sm font-medium">{diagnosticResults.utcHour}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">London Session (8-16):</span>
                      <Badge variant={diagnosticResults.utcHour >= 8 && diagnosticResults.utcHour < 16 ? "default" : "secondary"}>
                        {diagnosticResults.utcHour >= 8 && diagnosticResults.utcHour < 16 ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">NY Session (13-21):</span>
                      <Badge variant={diagnosticResults.utcHour >= 13 && diagnosticResults.utcHour < 21 ? "default" : "secondary"}>
                        {diagnosticResults.utcHour >= 13 && diagnosticResults.utcHour < 21 ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>

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

              {/* Console Commands */}
              <Card>
                <CardHeader>
                  <CardTitle>Console Commands to Try</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="text-sm">
                      <strong>Check trading bot:</strong>
                      <code className="ml-2 bg-muted px-2 py-1 rounded">console.log(window.tradingBot)</code>
                    </div>
                    <div className="text-sm">
                      <strong>Check all objects:</strong>
                      <code className="ml-2 bg-muted px-2 py-1 rounded">console.log(Object.keys(window))</code>
                    </div>
                    <div className="text-sm">
                      <strong>Check MT5 bridge:</strong>
                      <code className="ml-2 bg-muted px-2 py-1 rounded">fetch('http://localhost:8001/').then(r => console.log(r.ok))</code>
                    </div>
                  </div>
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
                  <strong>Restart App:</strong>
                  <code className="ml-2 bg-muted px-2 py-1 rounded">npm run dev</code>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default SimpleDiagnostics;