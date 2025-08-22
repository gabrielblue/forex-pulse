import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  ExternalLink, 
  Key, 
  Server, 
  AlertTriangle, 
  CheckCircle, 
  Settings, 
  Zap, 
  Activity, 
  Eye, 
  EyeOff, 
  TestTube, 
  Wifi, 
  WifiOff,
  DollarSign,
  TrendingUp,
  Shield,
  Clock,
  Target,
  BarChart3
} from "lucide-react";
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
  tradingAllowed?: boolean;
  name?: string;
}

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
    accountId: "",
    accountType: "demo",
    balance: 0,
    equity: 0,
    margin: 0,
    freeMargin: 0,
    currency: "USD",
    leverage: "1:100",
    server: "",
    connected: false
  });
  
  const [realAccountInfo, setRealAccountInfo] = useState<any>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [credentials, setCredentials] = useState({
    accountNumber: "",
    password: "",
    server: "ExnessKE-MT5Trial01"
  });
  const [showPassword, setShowPassword] = useState(false);
  const [connectionInfo, setConnectionInfo] = useState<any>(null);
  const [testResults, setTestResults] = useState<any>(null);
  const [connectionProgress, setConnectionProgress] = useState(0);

  // Demo servers for testing
  const demoServers = [
    "ExnessKE-MT5Trial01",
    "ExnessKE-MT5Trial02", 
    "ExnessKE-MT5Trial03",
    "ExnessKE-MT5Trial04",
    "ExnessKE-MT5Trial05",
    "ExnessKE-MT5Trial10",
    "ExnessKE-MT5Trial11",
    "ExnessKE-MT5Trial12"
  ];

  // Live servers for real trading
  const liveServers = [
    "ExnessKE-MT5Real01",
    "ExnessKE-MT5Real02",
    "ExnessKE-MT5Real03", 
    "ExnessKE-MT5Real04",
    "ExnessKE-MT5Real05",
    "ExnessKE-MT5Real06",
    "ExnessKE-MT5Real07",
    "ExnessKE-MT5Real08"
  ];

  const isDemoServer = demoServers.includes(credentials.server);

  useEffect(() => {
    // Update account info when status changes
    if (status.isConnected && realAccountInfo) {
      setAccount(prev => ({
        ...prev,
        connected: true,
        balance: realAccountInfo.balance,
        equity: realAccountInfo.equity,
        margin: realAccountInfo.margin,
        freeMargin: realAccountInfo.freeMargin,
        currency: realAccountInfo.currency,
        leverage: realAccountInfo.leverage,
        accountType: realAccountInfo.isDemo ? "demo" : "live",
        tradingAllowed: realAccountInfo.tradeAllowed,
        name: realAccountInfo.name
      }));
    }
  }, [status.isConnected, realAccountInfo]);

  const handleTestConnection = async () => {
    if (!credentials.accountNumber || !credentials.password) {
      toast.error("Please enter account number and password");
      return;
    }

    setIsTesting(true);
    setTestResults(null);
    setConnectionProgress(0);
    
    try {
      // Progress simulation
      const progressInterval = setInterval(() => {
        setConnectionProgress(prev => Math.min(prev + 10, 90));
      }, 200);

      const testResult = await exnessAPI.testConnection({
        accountNumber: credentials.accountNumber,
        password: credentials.password,
        server: credentials.server,
        isDemo: isDemoServer
      });

      clearInterval(progressInterval);
      setConnectionProgress(100);
      setTestResults(testResult);
      
      if (testResult.success) {
        toast.success("🎉 " + testResult.message, {
          description: testResult.accountInfo ? 
            `Balance: ${testResult.accountInfo.currency} ${testResult.accountInfo.balance?.toFixed(2)} | Server: ${credentials.server}` : 
            `Server: ${credentials.server} | Type: ${testResult.connectionType?.toUpperCase()}`
        });
      } else {
        toast.error("❌ " + testResult.message);
      }
    } catch (error) {
      setConnectionProgress(0);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast.error("Connection test failed: " + errorMessage);
      setTestResults({ success: false, message: errorMessage });
    } finally {
      setIsTesting(false);
      setTimeout(() => setConnectionProgress(0), 2000);
    }
  };

  const handleConnect = async () => {
    if (!credentials.accountNumber || !credentials.password) {
      toast.error("Please enter account number and password");
      return;
    }
    
    setIsConnecting(true);
    setConnectionProgress(0);
    clearError();
    
    try {
      // Progress simulation
      const progressInterval = setInterval(() => {
        setConnectionProgress(prev => Math.min(prev + 5, 90));
      }, 300);

      // Connect directly through exnessAPI instead of hook
      const connected = await exnessAPI.connect({
        accountNumber: credentials.accountNumber,
        password: credentials.password,
        server: credentials.server,
        isDemo: isDemoServer
      });
      
      clearInterval(progressInterval);
      setConnectionProgress(100);
      
      if (connected) {
        // Get real account information
        await loadAccountInfo();
        
        toast.success(`🎉 Connected to Exness ${realAccountInfo?.isDemo ? 'DEMO' : 'LIVE'} Account!`);
      } else {
        toast.error("❌ Failed to connect to Exness. Please check your credentials.");
      }
    } catch (err) {
      setConnectionProgress(0);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      toast.error("❌ Connection failed: " + errorMessage);
      console.error('Connection error:', err);
    } finally {
      setIsConnecting(false);
      setTimeout(() => setConnectionProgress(0), 2000);
    }
  };

  const loadAccountInfo = async () => {
    try {
      const accountInfo = await exnessAPI.getAccountInfo();
      if (accountInfo) {
        setRealAccountInfo(accountInfo);
        
        const connInfo = exnessAPI.getConnectionInfo();
        setConnectionInfo(connInfo);
        
        // Verify trading capabilities
        const tradingCheck = await exnessAPI.verifyTradingCapabilities();
        if (!tradingCheck.canTrade) {
          toast.warning("⚠️ Trading capabilities limited", {
            description: tradingCheck.issues.join(', ')
          });
        }
      }
    } catch (error) {
      console.error('Failed to load account info:', error);
    }
  };

  const handleDisconnect = () => {
    exnessAPI.disconnect();
    setAccount(prev => ({ ...prev, connected: false }));
    setRealAccountInfo(null);
    setConnectionInfo(null);
    setTestResults(null);
    toast.success("🔌 Disconnected from Exness");
  };

  const handleBotToggle = async () => {
    try {
      if (status.isActive) {
        await stopBot();
        toast.success("🛑 Trading bot stopped");
      } else {
        await startBot();
        toast.success("🚀 Trading bot started");
      }
    } catch (err) {
      toast.error("Failed to toggle bot: " + (err instanceof Error ? err.message : 'Unknown error'));
    }
  };

  const handleAutoTradingToggle = async (enabled: boolean) => {
    try {
      await enableAutoTrading(enabled);
      toast.success(`${enabled ? '🤖 Auto trading enabled' : '✋ Auto trading disabled'}`);
    } catch (err) {
      toast.error("Failed to toggle auto trading: " + (err instanceof Error ? err.message : 'Unknown error'));
    }
  };

  const handleEmergencyStop = async () => {
    try {
      await emergencyStop();
      toast.success("🚨 Emergency stop executed - all trading halted");
    } catch (err) {
      toast.error("Emergency stop failed: " + (err instanceof Error ? err.message : 'Unknown error'));
    }
  };

  const handleGenerateTestSignal = async () => {
    try {
      await generateTestSignal();
      toast.success("🧪 Test signal generated successfully");
    } catch (err) {
      toast.error("Failed to generate test signal: " + (err instanceof Error ? err.message : 'Unknown error'));
    }
  };

  const formatCurrency = (amount: number, currency: string = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2
    }).format(amount);
  };

  return (
    <div className="space-y-6">
      {/* Error Display */}
      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>Error:</strong> {error}
            <Button size="sm" variant="ghost" onClick={clearError} className="ml-2">
              Dismiss
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Connection Progress */}
      {(isConnecting || isTesting || connectionProgress > 0) && (
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>{isTesting ? 'Testing connection...' : 'Connecting to Exness...'}</span>
                <span>{connectionProgress}%</span>
              </div>
              <Progress value={connectionProgress} className="h-2" />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Connection Status Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${status.isConnected ? 'bg-green-100 dark:bg-green-900' : 'bg-gray-100 dark:bg-gray-800'}`}>
                <ExternalLink className={`w-6 h-6 ${status.isConnected ? 'text-green-600 dark:text-green-400' : 'text-gray-600 dark:text-gray-400'}`} />
              </div>
              <div>
                <CardTitle>Exness MT5 Integration</CardTitle>
                <p className="text-sm text-muted-foreground">
                  {status.isConnected 
                    ? `Connected to ${realAccountInfo?.isDemo ? 'DEMO' : 'LIVE'} account on ${realAccountInfo?.server}`
                    : 'Connect your Exness MT5 account for live trading'
                  }
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={status.isConnected ? "default" : "secondary"}>
                {status.isConnected ? (
                  <><Wifi className="w-3 h-3 mr-1" />Connected</>
                ) : (
                  <><WifiOff className="w-3 h-3 mr-1" />Disconnected</>
                )}
              </Badge>
              {realAccountInfo && (
                <Badge variant={realAccountInfo.isDemo ? "secondary" : "destructive"}>
                  {realAccountInfo.isDemo ? "DEMO" : "LIVE"}
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>

      <Tabs defaultValue={status.isConnected ? "account" : "connect"} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="connect">Connection</TabsTrigger>
          <TabsTrigger value="account" disabled={!status.isConnected}>Account Info</TabsTrigger>
          <TabsTrigger value="trading" disabled={!status.isConnected}>Trading Controls</TabsTrigger>
        </TabsList>

        <TabsContent value="connect" className="space-y-6">
          {/* Connection Form */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Key className="w-5 h-5" />
                MT5 Account Credentials
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
                    disabled={isConnecting || isTesting}
                  />
                  <p className="text-xs text-muted-foreground">8-12 digit MT5 account number</p>
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
                      disabled={isConnecting || isTesting}
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
                  <p className="text-xs text-muted-foreground">Your MT5 trading password</p>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="server">MT5 Server</Label>
                <Select 
                  value={credentials.server} 
                  onValueChange={(value) => setCredentials(prev => ({ ...prev, server: value }))}
                  disabled={isConnecting || isTesting}
                >
                  <SelectTrigger id="server">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <div className="px-2 py-1 text-xs font-semibold text-muted-foreground">DEMO SERVERS (For Testing)</div>
                    {demoServers.map(server => (
                      <SelectItem key={server} value={server}>
                        <div className="flex items-center gap-2">
                          <TestTube className="w-3 h-3" />
                          {server}
                        </div>
                      </SelectItem>
                    ))}
                    <div className="px-2 py-1 text-xs font-semibold text-muted-foreground border-t mt-2 pt-2">LIVE SERVERS (Real Money)</div>
                    {liveServers.map(server => (
                      <SelectItem key={server} value={server}>
                        <div className="flex items-center gap-2">
                          <DollarSign className="w-3 h-3" />
                          {server}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {isDemoServer ? (
                    <span className="text-blue-600">🧪 Demo server selected - safe for testing</span>
                  ) : (
                    <span className="text-red-600">⚠️ Live server selected - real money trading</span>
                  )}
                </p>
              </div>
              
              {/* Test Results */}
              {testResults && (
                <Alert variant={testResults.success ? "default" : "destructive"}>
                  {testResults.success ? <CheckCircle className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                  <AlertDescription>
                    <strong>Test Result:</strong> {testResults.message}
                    {testResults.accountInfo && (
                      <div className="mt-2 text-sm space-y-1">
                        <div>💰 Balance: {testResults.accountInfo.currency} {testResults.accountInfo.balance?.toFixed(2)}</div>
                        <div>📊 Equity: {testResults.accountInfo.currency} {testResults.accountInfo.equity?.toFixed(2)}</div>
                        <div>⚖️ Leverage: {testResults.accountInfo.leverage}</div>
                        <div>🏷️ Type: {testResults.connectionType?.toUpperCase()}</div>
                        <div>🏢 Company: {testResults.accountInfo.company}</div>
                        {testResults.accountInfo.marginLevel && (
                          <div>📈 Margin Level: {testResults.accountInfo.marginLevel.toFixed(1)}%</div>
                        )}
                        {testResults.accountInfo.freeMargin && (
                          <div>💵 Free Margin: {testResults.accountInfo.currency} {testResults.accountInfo.freeMargin.toFixed(2)}</div>
                        )}
                        {testResults.tradingAllowed !== undefined && (
                          <div>📈 Trading: {testResults.tradingAllowed ? '✅ Allowed' : '❌ Restricted'}</div>
                        )}
                        {testResults.serverInfo && (
                          <div>🌐 Server Status: {testResults.serverInfo.status} (Ping: {testResults.serverInfo.ping})</div>
                        )}
                      </div>
                    )}
                  </AlertDescription>
                </Alert>
              )}
              
              <div className="flex gap-3">
                <Button 
                  onClick={handleTestConnection} 
                  disabled={isConnecting || isTesting || !credentials.accountNumber || !credentials.password}
                  variant="outline"
                  className="flex-1"
                >
                  {isTesting ? (
                    <>
                      <TestTube className="w-4 h-4 mr-2 animate-pulse" />
                      Testing Connection...
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
                  disabled={isConnecting || isTesting || !credentials.accountNumber || !credentials.password}
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
        </TabsContent>

        <TabsContent value="account" className="space-y-6">
          {/* Account Information */}
          {realAccountInfo && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-medium text-muted-foreground">Balance</div>
                        <div className="text-2xl font-bold text-foreground">
                          {formatCurrency(realAccountInfo.balance, realAccountInfo.currency)}
                        </div>
                      </div>
                      <DollarSign className="w-8 h-8 text-green-500" />
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {realAccountInfo.isDemo ? 'Demo Account' : 'Live Account'}
                    </div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-medium text-muted-foreground">Equity</div>
                        <div className="text-2xl font-bold text-foreground">
                          {formatCurrency(realAccountInfo.equity, realAccountInfo.currency)}
                        </div>
                      </div>
                      <TrendingUp className="w-8 h-8 text-blue-500" />
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Current equity value
                    </div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-medium text-muted-foreground">Free Margin</div>
                        <div className="text-2xl font-bold text-green-500">
                          {formatCurrency(realAccountInfo.freeMargin, realAccountInfo.currency)}
                        </div>
                      </div>
                      <Shield className="w-8 h-8 text-green-500" />
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Available for trading
                    </div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-medium text-muted-foreground">Margin Level</div>
                        <div className={`text-2xl font-bold ${realAccountInfo.marginLevel > 200 ? 'text-green-500' : realAccountInfo.marginLevel > 100 ? 'text-yellow-500' : 'text-red-500'}`}>
                          {realAccountInfo.marginLevel.toFixed(1)}%
                        </div>
                      </div>
                      <BarChart3 className="w-8 h-8 text-blue-500" />
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Margin health indicator
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Detailed Account Info */}
              <Card>
                <CardHeader>
                  <CardTitle>Account Details</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Account Number:</span>
                        <span className="font-medium">{realAccountInfo.accountNumber}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Server:</span>
                        <span className="font-medium">{realAccountInfo.server}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Currency:</span>
                        <span className="font-medium">{realAccountInfo.currency}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Leverage:</span>
                        <span className="font-medium">{realAccountInfo.leverage}</span>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Profit:</span>
                        <span className={`font-medium ${realAccountInfo.profit >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                          {formatCurrency(realAccountInfo.profit, realAccountInfo.currency)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Used Margin:</span>
                        <span className="font-medium">{formatCurrency(realAccountInfo.margin, realAccountInfo.currency)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Trading Allowed:</span>
                        <Badge variant={realAccountInfo.tradeAllowed ? "default" : "destructive"}>
                          {realAccountInfo.tradeAllowed ? "Yes" : "No"}
                        </Badge>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Company:</span>
                        <span className="font-medium">{realAccountInfo.company || 'Exness'}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        <TabsContent value="trading" className="space-y-6">
          {/* Bot Controls */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="w-5 h-5" />
                Trading Bot Controls
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="p-4">
                  <div className="text-center">
                    <div className="text-sm text-muted-foreground">Bot Status</div>
                    <div className={`text-lg font-bold ${status.isActive ? 'text-green-500' : 'text-gray-500'}`}>
                      {status.isActive ? 'ACTIVE' : 'INACTIVE'}
                    </div>
                    <Button 
                      onClick={handleBotToggle}
                      disabled={isLoading}
                      variant={status.isActive ? "destructive" : "default"}
                      size="sm"
                      className="mt-2 w-full"
                    >
                      {status.isActive ? 'Stop Bot' : 'Start Bot'}
                    </Button>
                  </div>
                </Card>

                <Card className="p-4">
                  <div className="text-center">
                    <div className="text-sm text-muted-foreground">Auto Trading</div>
                    <div className={`text-lg font-bold ${status.autoTradingEnabled ? 'text-green-500' : 'text-gray-500'}`}>
                      {status.autoTradingEnabled ? 'ENABLED' : 'DISABLED'}
                    </div>
                    <Switch 
                      checked={status.autoTradingEnabled}
                      onCheckedChange={handleAutoTradingToggle}
                      disabled={!status.isActive || isLoading}
                      className="mt-2"
                    />
                  </div>
                </Card>

                <Card className="p-4">
                  <div className="text-center">
                    <div className="text-sm text-muted-foreground">Total Trades</div>
                    <div className="text-lg font-bold text-foreground">{status.totalTrades}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Win Rate: {status.winRate.toFixed(1)}%
                    </div>
                  </div>
                </Card>
              </div>

              <div className="flex gap-4">
                <Button onClick={handleGenerateTestSignal} variant="outline" disabled={isLoading}>
                  <Zap className="w-4 h-4 mr-2" />
                  Generate Test Signal
                </Button>
                <Button onClick={handleEmergencyStop} variant="destructive" disabled={isLoading}>
                  <AlertTriangle className="w-4 h-4 mr-2" />
                  Emergency Stop
                </Button>
                <Button variant="outline" onClick={handleDisconnect}>
                  <WifiOff className="w-4 h-4 mr-2" />
                  Disconnect
                </Button>
              </div>

              {/* Auto Trading Warning */}
              {status.autoTradingEnabled && (
                <Alert variant={realAccountInfo?.isDemo ? "default" : "destructive"}>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Auto-trading is ACTIVE</strong> on your {realAccountInfo?.isDemo ? 'DEMO' : 'LIVE'} account. 
                    The AI will execute trades automatically based on your strategy settings and risk management rules.
                    {!realAccountInfo?.isDemo && (
                      <div className="mt-2 font-semibold text-red-600">
                        ⚠️ WARNING: This is a LIVE account with real money. Monitor your trades carefully!
                      </div>
                    )}
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>

          {/* Connection Info */}
          {connectionInfo && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="w-5 h-5" />
                  Connection Details
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Connection Status:</span>
                      <Badge variant="default">{connectionInfo.connectionStatus}</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">WebSocket:</span>
                      <Badge variant={connectionInfo.webSocketStatus === 'Connected' ? 'default' : 'secondary'}>
                        {connectionInfo.webSocketStatus}
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Last Update:</span>
                      <span className="font-medium">{new Date(connectionInfo.lastUpdate).toLocaleTimeString()}</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Account Type:</span>
                      <Badge variant={connectionInfo.accountType === 'demo' ? 'secondary' : 'destructive'}>
                        {connectionInfo.accountType?.toUpperCase()}
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Trading Allowed:</span>
                      <Badge variant={connectionInfo.tradingAllowed ? 'default' : 'destructive'}>
                        {connectionInfo.tradingAllowed ? 'Yes' : 'No'}
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Server:</span>
                      <span className="font-medium">{connectionInfo.server}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
      
      {/* Integration Guide */}
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          <strong>🚀 Enhanced Exness Integration - Ready for Real Trading:</strong>
          <div className="mt-2 space-y-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <strong>✅ Production Features:</strong>
                <ul className="list-disc list-inside mt-1 space-y-1 text-sm">
                  <li>🔐 Real MT5 API authentication</li>
                  <li>💰 Live account data synchronization</li>
                  <li>📊 Real-time price feeds via WebSocket</li>
                  <li>⚡ Actual trade execution on Exness</li>
                  <li>🛡️ Advanced risk management</li>
                  <li>🔄 Automatic reconnection handling</li>
                </ul>
              </div>
              <div>
                <strong>🧪 Testing Workflow:</strong>
                <ol className="list-decimal list-inside mt-1 space-y-1 text-sm">
                  <li>Start with a demo account for testing</li>
                  <li>Test connection and verify account info</li>
                  <li>Generate test signals and monitor execution</li>
                  <li>Verify profitable trades in demo environment</li>
                  <li>Once satisfied, connect live account</li>
                  <li>Start with small position sizes</li>
                </ol>
              </div>
            </div>
          </div>
          <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-950 rounded border border-blue-200 dark:border-blue-800">
            <strong>💡 Getting Started:</strong>
            <ol className="list-decimal list-inside mt-2 space-y-1 text-sm">
              <li>Create an Exness account at <a href="https://exness.com" target="_blank" className="text-blue-600 underline">exness.com</a></li>
              <li>Download MT5 platform and get your login credentials</li>
              <li>Start with demo servers (Trial01-Trial12) for safe testing</li>
              <li>Verify connection works with test button before connecting</li>
              <li>Only use live servers (Real01-Real08) after successful demo testing</li>
              <li>Always start with small position sizes on live accounts</li>
            </ol>
          </div>
          <div className="mt-3 p-3 bg-yellow-50 dark:bg-yellow-950 rounded border border-yellow-200 dark:border-yellow-800">
            <strong>⚠️ Connection Troubleshooting:</strong>
            <ul className="list-disc list-inside mt-2 space-y-1 text-sm">
              <li>Ensure your MT5 account number is 8-12 digits</li>
              <li>Verify your password is correct (case-sensitive)</li>
              <li>Check that the server name matches your account type</li>
              <li>Demo accounts must use Trial servers, Live accounts use Real servers</li>
              <li>If connection fails, try a different server from the same type</li>
              <li>Contact Exness support if credentials are definitely correct but connection fails</li>
            </ul>
          </div>
          <div className="mt-3 p-3 bg-red-50 dark:bg-red-950 rounded border border-red-200 dark:border-red-800">
            <strong>⚠️ Risk Warning:</strong> Live trading involves real money and significant risk. 
            Always test thoroughly with demo accounts first. Never risk more than you can afford to lose. 
            The system includes multiple safety mechanisms, but trading forex carries inherent risks.
          </div>
        </AlertDescription>
      </Alert>
    </div>
  );
};