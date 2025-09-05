import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle, RefreshCw, Play, Bug } from 'lucide-react';

const TradingDebugger = () => {
  const [debugResults, setDebugResults] = useState<any>(null);
  const [isRunning, setIsRunning] = useState(false);

  const runDebug = () => {
    setIsRunning(true);
    try {
      const results = {
        timestamp: new Date().toISOString(),
        tradingBot: !!(window as any).tradingBot,
        orderManager: !!(window as any).orderManager,
        signalProcessor: !!(window as any).signalProcessor,
        initialized: !!(window as any).tradingSystemInitialized,
        initializing: !!(window as any).tradingSystemInitializing,
        error: (window as any).tradingSystemError || null,
        availableFunctions: Object.keys(window).filter(key => 
          key.includes('trading') || key.includes('check') || key.includes('force') || key.includes('debug')
        ),
        recommendations: [] as string[]
      };

      // Generate recommendations
      if (!results.tradingBot) {
        results.recommendations.push('🤖 Trading bot not found - check if app is properly initialized');
      }
      if (!results.initialized && !results.initializing) {
        results.recommendations.push('❓ Trading system initialization not started');
      }
      if (results.error) {
        results.recommendations.push(`❌ Initialization error: ${results.error}`);
      }
      if (results.tradingBot && results.initialized) {
        results.recommendations.push('✅ All systems operational - bot is ready');
      }

      setDebugResults(results);
    } catch (error) {
      console.error('Debug error:', error);
      setDebugResults({ error: error.message });
    } finally {
      setIsRunning(false);
    }
  };

  const forceTradingMode = () => {
    if ((window as any).tradingBot) {
      try {
        console.log('🚀 Forcing trading mode...');
        if ((window as any).tradingBot.setConfiguration) {
          (window as any).tradingBot.setConfiguration({
            minConfidence: 50,
            aggressiveMode: true
          });
          console.log('✅ Trading mode activated with 50% confidence');
        } else {
          console.log('❌ setConfiguration method not available');
        }
      } catch (error) {
        console.error('Error forcing trading mode:', error);
      }
    } else {
      console.log('❌ Trading bot not available');
    }
  };

  const getStatusIcon = (status: boolean) => {
    return status ? <CheckCircle className="w-4 h-4 text-green-500" /> : <XCircle className="w-4 h-4 text-red-500" />;
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bug className="w-5 h-5" />
          Trading System Debugger
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Button 
            onClick={runDebug} 
            disabled={isRunning}
            className="flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${isRunning ? 'animate-spin' : ''}`} />
            {isRunning ? 'Running...' : 'Run Debug'}
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

        {debugResults && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center justify-between p-3 border rounded">
                <span className="text-sm font-medium">Trading Bot</span>
                <div className="flex items-center gap-2">
                  {getStatusIcon(debugResults.tradingBot)}
                  <span className="text-sm">
                    {debugResults.tradingBot ? 'Available' : 'Not Found'}
                  </span>
                </div>
              </div>
              
              <div className="flex items-center justify-between p-3 border rounded">
                <span className="text-sm font-medium">Order Manager</span>
                <div className="flex items-center gap-2">
                  {getStatusIcon(debugResults.orderManager)}
                  <span className="text-sm">
                    {debugResults.orderManager ? 'Available' : 'Not Found'}
                  </span>
                </div>
              </div>
              
              <div className="flex items-center justify-between p-3 border rounded">
                <span className="text-sm font-medium">Signal Processor</span>
                <div className="flex items-center gap-2">
                  {getStatusIcon(debugResults.signalProcessor)}
                  <span className="text-sm">
                    {debugResults.signalProcessor ? 'Available' : 'Not Found'}
                  </span>
                </div>
              </div>
              
              <div className="flex items-center justify-between p-3 border rounded">
                <span className="text-sm font-medium">Initialized</span>
                <div className="flex items-center gap-2">
                  {getStatusIcon(debugResults.initialized)}
                  <span className="text-sm">
                    {debugResults.initialized ? 'Yes' : 'No'}
                  </span>
                </div>
              </div>
            </div>

            <div className="p-3 border rounded">
              <div className="text-sm font-medium mb-2">Available Functions:</div>
              <div className="flex flex-wrap gap-2">
                {debugResults.availableFunctions.length > 0 ? (
                  debugResults.availableFunctions.map((func: string, index: number) => (
                    <Badge key={index} variant="secondary" className="text-xs">
                      {func}
                    </Badge>
                  ))
                ) : (
                  <span className="text-muted-foreground text-sm">No functions found</span>
                )}
              </div>
            </div>

            {debugResults.recommendations.length > 0 && (
              <div className="p-3 border rounded">
                <div className="text-sm font-medium mb-2">Recommendations:</div>
                <div className="space-y-1">
                  {debugResults.recommendations.map((rec: string, index: number) => (
                    <div key={index} className="text-sm text-muted-foreground">
                      {rec}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="p-3 border rounded">
              <div className="text-sm font-medium mb-2">Console Commands to Try:</div>
              <div className="space-y-1 text-xs">
                <div><code className="bg-muted px-1 py-0.5 rounded">console.log(window.tradingBot)</code></div>
                <div><code className="bg-muted px-1 py-0.5 rounded">console.log(Object.keys(window).filter(k =&gt; k.includes(&apos;trading&apos;)))</code></div>
                <div><code className="bg-muted px-1 py-0.5 rounded">console.log(&apos;Trading system status:&apos;, !!window.tradingBot)</code></div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default TradingDebugger;