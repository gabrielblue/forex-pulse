import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ExternalLink, Key, Server, AlertTriangle, CheckCircle, Settings, Zap, Activity, Eye, EyeOff, TestTube, Wifi, WifiOff } from "lucide-react";
import { useTradingBot } from "@/hooks/useTradingBot";
import { toast } from "sonner";
import { exnessAPI } from "@/lib/trading/exnessApi";

interface ExnessAccount {
  accountId: string;
  accountType: "demo" | "live";
  balance: number;
  equity: number;
  margin: number;
  freeMargin: number;
  currency: string;
  leverage: string;
  server: string;
  connected: boolean;
}

const mockAccount: ExnessAccount = {
  accountId: "123456789",
  accountType: "demo",
  balance: 10000,
  equity: 10245.67,
  margin: 234.56,
  freeMargin: 10011.11,
  currency: "USD",
  leverage: "1:500",
  server: "ExnessServer-MT5",
  connected: false
};

export const ExnessIntegration = () => {
  const { 
    status, 
    configuration, 
    isLoading, 
    error, 
    connectToExness, 
    startBot, 
    stopBot, 
    enableAutoTrading,
    emergencyStop,
    generateTestSignal,
    clearError 
  } = useTradingBot();
  
  const [account, setAccount] = useState<ExnessAccount>({
    ...mockAccount,
    connected: status.isConnected
  });
  const [realAccountInfo, setRealAccountInfo] = useState<any>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [credentials, setCredentials] = useState({
    accountNumber: "",
    password: "",
    server: "ExnessKE-MT5Trial01"
  });
  const [showPassword, setShowPassword] = useState(false);
  const [connectionInfo, setConnectionInfo] = useState<any>(null);
  const [testResults, setTestResults] = useState<any>(null);

  const handleTestConnection = async () => {
    if (!credentials.accountNumber || !credentials.password) {
      toast.error("Please enter account number and password");
      return;
    }

    setIsConnecting(true);
    setTestResults(null);
    
    try {
      const testResult = await exnessAPI.testConnection({
        accountNumber: credentials.accountNumber,
        password: credentials.password,
        server: credentials.server,
        isDemo: credentials.server.includes('Demo')
      });

      setTestResults(testResult);
      
      if (testResult.success) {
        toast.success(testResult.message, {
          description: testResult.accountInfo ? 
            `Balance: ${testResult.accountInfo.currency} ${testResult.accountInfo.balance?.toFixed(2)}` : 
            undefined
        });
      } else {
        toast.error(testResult.message);
      }
    } catch (error) {
      toast.error("Connection test failed: " + (error instanceof Error ? error.message : 'Unknown error'));
      setTestResults({ success: false, message: error instanceof Error ? error.message : 'Unknown error' });
    } finally {
      setIsConnecting(false);
    }
  };

  const handleConnect = async () => {
    if (!credentials.accountNumber || !credentials.password) {
      toast.error("Please enter account number and password");
      return;
    }
    
    setIsConnecting(true);
    clearError();
    
    try {
      const connected = await connectToExness({
        accountNumber: credentials.accountNumber,
        password: credentials.password,
        server: credentials.server,
        isDemo: credentials.server.includes('Trial') || credentials.server.includes('Demo')
      });
      
      if (connected) {
        setAccount(prev => ({ ...prev, connected: true }));
        
        // Get real account information from Exness
        const accountInfo = await exnessAPI.getAccountInfo();
        if (accountInfo) {
          setRealAccountInfo(accountInfo);
          setAccount(prev => ({
            ...prev,
            balance: accountInfo.balance,
            equity: accountInfo.equity,
            margin: accountInfo.margin,
            freeMargin: accountInfo.freeMargin,
            connected: true,
            accountType: accountInfo.isDemo ? "demo" : "live"
          }));
          
          // Get connection info
          const connInfo = exnessAPI.getConnectionInfo();
          setConnectionInfo(connInfo);
          
          toast.success(`🎉 Connected to Exness ${accountInfo.isDemo ? 'DEMO' : 'LIVE'} Account!`, {
            description: `Balance: ${accountInfo.currency} ${accountInfo.balance.toFixed(2)} | Server: ${accountInfo.server}`
          });
        } else {
          throw new Error("Failed to get account information after connection");
        }
      } else {
        toast.error("Failed to connect to Exness. Please check your credentials.");
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      toast.error("❌ Connection failed: " + errorMessage);
      console.error('Connection error:', err);
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = () => {
    exnessAPI.disconnect();
    setAccount(prev => ({ ...prev, connected: false }));
    setRealAccountInfo(null);
    setConnectionInfo(null);
    setTestResults(null);
    stopBot();
    toast.success("Disconnected from Exness");
  };

  const handleBotToggle = async () => {
    try {
      if (status.isActive) {
        await stopBot();
        toast.success("Trading bot stopped");
      } else {
        await startBot();
        toast.success("Trading bot started");
      }
    } catch (err) {
      toast.error("Failed to toggle bot: " + (err instanceof Error ? err.message : 'Unknown error'));
    }
  };

  const handleAutoTradingToggle = async (enabled: boolean) => {
    try {
      await enableAutoTrading(enabled);
      toast.success(`Auto trading ${enabled ? 'enabled' : 'disabled'}`);
    } catch (err) {
      toast.error("Failed to toggle auto trading: " + (err instanceof Error ? err.message : 'Unknown error'));
    }
  };

  const handleEmergencyStop = async () => {
    try {
      await emergencyStop();
      toast.success("Emergency stop executed");
    } catch (err) {
      toast.error("Emergency stop failed: " + (err instanceof Error ? err.message : 'Unknown error'));
    }
  };

  const handleGenerateTestSignal = async () => {
    try {
      await generateTestSignal();
      toast.success("Test signal generated");
    } catch (err) {
      toast.error("Failed to generate test signal: " + (err instanceof Error ? err.message : 'Unknown error'));
    }
  };

  return (
    <div className="space-y-6">
      {/* Error Display */}
      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Connection Status */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <ExternalLink className="w-6 h-6 text-primary" />
              </div>
              <div>
                <CardTitle>Exness Account Connection</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Connect your Exness MT5 account for live trading
                </p>
              </div>
            </div>
            <Badge variant={account.connected ? "default" : "secondary"}>
              {status.isConnected ? (
                <><CheckCircle className="w-3 h-3 mr-1" />Connected</>
              ) : (
                <><AlertTriangle className="w-3 h-3 mr-1" />Disconnected</>
              )}
            </Badge>
          </div>
        </CardHeader>
      </Card>

      {!status.isConnected ? (
        /* Connection Form */
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Key className="w-5 h-5" />
              Account Credentials
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="accountNumber">Account Number</Label>
                <Input
                  id="accountNumber"
                  type="text"
                  placeholder="Enter your MT5 account number"
                  value={credentials.accountNumber}
                  onChange={(e) => setCredentials(prev => ({ ...prev, accountNumber: e.target.value }))}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your MT5 password"
                    value={credentials.password}
                    onChange={(e) => setCredentials(prev => ({ ...prev, password: e.target.value }))}
                    className="pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Eye className="h-4 w-4 text-muted-foreground" />
                    )}
                  </Button>
                </div>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="server">Server</Label>
              <Select value={credentials.server} onValueChange={(value) => setCredentials(prev => ({ ...prev, server: value }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ExnessKE-MT5Trial01">ExnessKE-MT5Trial01 (Demo)</SelectItem>
                  <SelectItem value="ExnessKE-MT5Trial02">ExnessKE-MT5Trial02 (Demo)</SelectItem>
                  <SelectItem value="ExnessKE-MT5Trial03">ExnessKE-MT5Trial03 (Demo)</SelectItem>
                  <SelectItem value="ExnessKE-MT5Trial04">ExnessKE-MT5Trial04 (Demo)</SelectItem>
                  <SelectItem value="ExnessKE-MT5Trial05">ExnessKE-MT5Trial05 (Demo)</SelectItem>
                  <SelectItem value="ExnessKE-MT5Real01">ExnessKE-MT5Real01 (Live)</SelectItem>
                  <SelectItem value="ExnessKE-MT5Real02">ExnessKE-MT5Real02 (Live)</SelectItem>
                  <SelectItem value="ExnessKE-MT5Real03">ExnessKE-MT5Real03 (Live)</SelectItem>
                  <SelectItem value="ExnessKE-MT5Real04">ExnessKE-MT5Real04 (Live)</SelectItem>
                  <SelectItem value="ExnessKE-MT5Real05">ExnessKE-MT5Real05 (Live)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {/* Test Results */}
            {testResults && (
              <Alert variant={testResults.success ? "default" : "destructive"}>
                <CheckCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Test Result:</strong> {testResults.message}
                  {testResults.accountInfo && (
                    <div className="mt-2 text-sm">
                      <div>💰 Balance: {testResults.accountInfo.currency} {testResults.accountInfo.balance?.toFixed(2)}</div>
                      <div>⚖️ Leverage: {testResults.accountInfo.leverage}</div>
                      <div>🏷️ Type: {testResults.connectionType?.toUpperCase()}</div>
                    </div>
                  )}
                </AlertDescription>
              </Alert>
            )}
            
            <div className="flex gap-3">
              <Button 
                onClick={handleTestConnection} 
                disabled={isConnecting || isLoading || !credentials.accountNumber || !credentials.password}
                variant="outline"
                className="flex-1"
              >
                {isConnecting ? (
                  <>
                    <Wifi className="w-4 h-4 mr-2 animate-pulse" />
                    Testing...
                  </>
                ) : (
                  <>
                    <TestTube className="w-4 h-4 mr-2" />
                    Test Connection
                  </>
                )}
              </Button>
              
              <Button 
                onClick={handleConnect} 
                disabled={isConnecting || isLoading || !credentials.accountNumber || !credentials.password}
                className="flex-1"
              >
                {isConnecting ? (
                  <>
                    <Server className="w-4 h-4 mr-2 animate-pulse" />
                    Connecting...
                  </>
                ) : (
                  <>
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Connect to Exness
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        /* Connected Account Info */
        <>
          {/* Connection Status */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wifi className="w-5 h-5 text-green-500" />
                Connection Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              {connectionInfo && (
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Account Type:</span>
                    <Badge variant={connectionInfo.accountType === 'demo' ? 'secondary' : 'default'}>
                      {connectionInfo.accountType?.toUpperCase()}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Server:</span>
                    <span className="font-medium">{connectionInfo.server}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Account:</span>
                    <span className="font-medium">{connectionInfo.accountNumber}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Status:</span>
                    <span className="font-medium text-green-500">{connectionInfo.connectionStatus}</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="text-sm font-medium text-muted-foreground">Account Balance</div>
                <div className="text-2xl font-bold text-foreground">
                  {realAccountInfo ? `${realAccountInfo.currency} ${realAccountInfo.balance.toFixed(2)}` : `$${account.balance.toLocaleString()}`}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {realAccountInfo?.isDemo ? 'Demo Account' : 'Live Account'}
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4">
                <div className="text-sm font-medium text-muted-foreground">Account Equity</div>
                <div className="text-2xl font-bold text-foreground">
                  {realAccountInfo ? `${realAccountInfo.currency} ${realAccountInfo.equity.toFixed(2)}` : `$${account.equity.toLocaleString()}`}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  Current equity value
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4">
                <div className="text-sm font-medium text-muted-foreground">Free Margin</div>
                <div className="text-2xl font-bold text-green-500">
                  {realAccountInfo ? `${realAccountInfo.currency} ${realAccountInfo.freeMargin.toFixed(2)}` : `$${account.freeMargin.toLocaleString()}`}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  Available for trading
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4">
                <div className="text-sm font-medium text-muted-foreground">Bot Status</div>
                <div className={`text-2xl font-bold ${status.isActive ? 'text-green-500' : 'text-gray-500'}`}>
                  {status.isActive ? 'ACTIVE' : 'INACTIVE'}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {status.autoTradingEnabled ? 'Auto-trading ON' : 'Manual mode'}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Bot Controls */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="w-5 h-5" />
                Trading Bot Controls
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-4">
                <Button 
                  onClick={handleBotToggle}
                  disabled={isLoading}
                  variant={status.isActive ? "destructive" : "default"}
                >
                  {status.isActive ? 'Stop Bot' : 'Start Bot'}
                </Button>
                <Button onClick={handleGenerateTestSignal} variant="outline" disabled={isLoading}>
                  <Zap className="w-4 h-4 mr-2" />
                  Generate Test Signal
                </Button>
                <Button onClick={handleEmergencyStop} variant="destructive" disabled={isLoading}>
                  Emergency Stop
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Trading Controls */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="w-5 h-5" />
                Trading Controls
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between p-4 rounded-lg border border-border/50">
                <div>
                  <div className="font-medium">Auto-Trading</div>
                  <div className="text-sm text-muted-foreground">
                    Allow AI to execute trades automatically on your {realAccountInfo?.isDemo ? 'demo' : 'live'} account
                  </div>
                </div>
                <Switch 
                  checked={status.autoTradingEnabled}
                  onCheckedChange={handleAutoTradingToggle}
                  disabled={!status.isActive || isLoading}
                />
              </div>
              
              {status.autoTradingEnabled && (
                <Alert>
                  <CheckCircle className="h-4 w-4" />
                  <AlertDescription>
                    Auto-trading is <strong>ENABLED</strong> on your {realAccountInfo?.isDemo ? 'DEMO' : 'LIVE'} account. 
                    The AI will execute trades based on your strategy settings and risk management rules.
                  </AlertDescription>
                </Alert>
              )}
              
              <div className="flex gap-4">
                <Button variant="outline" onClick={handleDisconnect}>
                  <WifiOff className="w-4 h-4 mr-2" />
                  Disconnect Account
                </Button>
                <Button onClick={async () => {
                  try {
                    await generateTestSignal();
                    toast.success("Test signal generated successfully!");
                  } catch (error) {
                    toast.error("Failed to generate test signal");
                  }
                }}>
                  <Zap className="w-4 h-4 mr-2" />
                  Generate Test Signal
                </Button>
                <Button variant="outline" onClick={() => toast.success("Manual trade feature coming soon!")}>
                  Manual Trade
                </Button>
              </div>
            </CardContent>
          </Card>
        </>
      )}
      
      {/* Integration Requirements */}
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          <strong>Enhanced Exness Integration:</strong> This system connects to real Exness MT5 accounts:
          <ul className="list-disc list-inside mt-2 space-y-1">
            <li>🔐 <strong>Real Authentication:</strong> Direct connection to Exness MT5 servers</li>
            <li>💰 <strong>Live Account Data:</strong> Real-time balance, equity, and margin information</li>
            <li>📊 <strong>Market Data:</strong> Live price feeds via WebSocket connection</li>
            <li>⚡ <strong>Trade Execution:</strong> Actual order placement and management</li>
            <li>🛡️ <strong>Risk Management:</strong> Advanced position monitoring and limits</li>
            <li>🎯 <strong>Demo & Live Support:</strong> Test with demo accounts before going live</li>
          </ul>
          <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-950 rounded border border-blue-200 dark:border-blue-800">
            <strong>💡 Getting Started:</strong>
            <ol className="list-decimal list-inside mt-2 space-y-1 text-sm">
              <li>Create an Exness account at <a href="https://exness.com" target="_blank" className="text-blue-600 underline">exness.com</a></li>
              <li>Download MT5 and get your login credentials</li>
              <li>Start with a demo account to test the system</li>
              <li>Once comfortable, connect your live account for real trading</li>
            </ol>
          </div>
          <div className="mt-3 p-3 bg-yellow-50 dark:bg-yellow-950 rounded border border-yellow-200 dark:border-yellow-800">
            <strong>⚠️ Risk Warning:</strong> Live trading involves real money. Always test thoroughly with demo accounts first. 
            Never risk more than you can afford to lose.
          </div>
        </AlertDescription>
      </Alert>
    </div>
  );
};