import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { 
  Link, 
  CheckCircle, 
  AlertTriangle, 
  Activity, 
  DollarSign,
  TrendingUp,
  Shield,
  Zap,
  Target,
  RefreshCw,
  Settings,
  Play,
  Pause
} from "lucide-react";
import { useTradingBot } from "@/hooks/useTradingBot";
import { exnessAPI, ExnessCredentials } from "@/lib/trading/exnessApi";
import { toast } from "sonner";

export const ExnessIntegration = () => {
  const { status, connectToExness, isLoading } = useTradingBot();
  const [credentials, setCredentials] = useState<ExnessCredentials>({
    accountNumber: "",
    password: "",
    server: "",
    isDemo: true
  });
  const [connectionStatus, setConnectionStatus] = useState<"disconnected" | "connecting" | "connected" | "error">("disconnected");
  const [accountInfo, setAccountInfo] = useState<any>(null);
  const [testResult, setTestResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [autoTradingEnabled, setAutoTradingEnabled] = useState(false);

  const serverOptions = [
    // Demo/Trial Servers (all available trial servers)
    { value: "ExnessKE-MT5Trial01", label: "ExnessKE-MT5Trial01 (Demo)", type: "demo" },
    { value: "ExnessKE-MT5Trial02", label: "ExnessKE-MT5Trial02 (Demo)", type: "demo" },
    { value: "ExnessKE-MT5Trial03", label: "ExnessKE-MT5Trial03 (Demo)", type: "demo" },
    { value: "ExnessKE-MT5Trial04", label: "ExnessKE-MT5Trial04 (Demo)", type: "demo" },
    { value: "ExnessKE-MT5Trial05", label: "ExnessKE-MT5Trial05 (Demo)", type: "demo" },
    { value: "ExnessKE-MT5Trial06", label: "ExnessKE-MT5Trial06 (Demo)", type: "demo" },
    { value: "ExnessKE-MT5Trial07", label: "ExnessKE-MT5Trial07 (Demo)", type: "demo" },
    { value: "ExnessKE-MT5Trial08", label: "ExnessKE-MT5Trial08 (Demo)", type: "demo" },
    { value: "ExnessKE-MT5Trial09", label: "ExnessKE-MT5Trial09 (Demo)", type: "demo" },
    { value: "ExnessKE-MT5Trial10", label: "ExnessKE-MT5Trial10 (Demo)", type: "demo" },
    
    // Live/Real Servers (all available real servers)
    { value: "ExnessKE-MT5Real01", label: "ExnessKE-MT5Real01 (Live)", type: "live" },
    { value: "ExnessKE-MT5Real02", label: "ExnessKE-MT5Real02 (Live)", type: "live" },
    { value: "ExnessKE-MT5Real03", label: "ExnessKE-MT5Real03 (Live)", type: "live" },
    { value: "ExnessKE-MT5Real04", label: "ExnessKE-MT5Real04 (Live)", type: "live" },
    { value: "ExnessKE-MT5Real05", label: "ExnessKE-MT5Real05 (Live)", type: "live" },
  ];

  useEffect(() => {
    // Update connection status based on bot status
    if (status.isConnected) {
      setConnectionStatus("connected");
      loadAccountInfo();
    } else {
      setConnectionStatus("disconnected");
    }
  }, [status.isConnected]);

  const loadAccountInfo = async () => {
    try {
      const info = await exnessAPI.getAccountInfo();
      if (info) {
        setAccountInfo(info);
        console.log('Account info loaded:', info);
      }
    } catch (error) {
      console.error('Failed to load account info:', error);
    }
  };

  const handleTestConnection = async () => {
    if (!credentials.accountNumber || !credentials.password || !credentials.server) {
      toast.error("Please fill in all connection details");
      return;
    }

    setIsTestingConnection(true);
    setError(null);
    setTestResult(null);

    try {
      console.log('Testing connection to Exness MT5...');
      const result = await exnessAPI.testConnection(credentials);
      
      setTestResult(result);
      
      if (result.success) {
        toast.success("Connection test successful!");
        console.log('Connection test passed:', result);
      } else {
        toast.error(`Connection test failed: ${result.message}`);
        setError(result.message);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Connection test failed';
      setError(errorMessage);
      toast.error(errorMessage);
      console.error('Connection test error:', error);
    } finally {
      setIsTestingConnection(false);
    }
  };

  const handleConnect = async () => {
    if (!credentials.accountNumber || !credentials.password || !credentials.server) {
      toast.error("Please fill in all connection details");
      return;
    }

    setConnectionStatus("connecting");
    setError(null);

    try {
      console.log('🔗 ExnessIntegration: Connecting to Exness MT5 account...');

      // Connect via useTradingBot hook which properly syncs with tradingBot
      const connected = await connectToExness(credentials);

      console.log('📊 ExnessIntegration: Connection result:', connected);

      if (connected) {
        setConnectionStatus("connected");

        // The tradingBot.connectToExness already updates the connection status
        // But let's verify it one more time
        const { tradingBot } = await import('@/lib/trading/tradingBot');
        const botStatus = tradingBot.getStatus();

        console.log('✅ ExnessIntegration: Connection successful! Bot status:', {
          isConnected: botStatus.isConnected,
          exnessAPIConnected: exnessAPI.isConnectedToExness()
        });

        toast.success(`✅ Successfully connected to Exness ${credentials.isDemo ? 'DEMO' : 'LIVE'} account!`);
        await loadAccountInfo();
      } else {
        setConnectionStatus("error");
        toast.error("Failed to connect to Exness account");
        console.error('❌ ExnessIntegration: Connection failed');
      }
    } catch (error) {
      setConnectionStatus("error");
      const errorMessage = error instanceof Error ? error.message : 'Connection failed';
      setError(errorMessage);
      toast.error(errorMessage);
      console.error('❌ ExnessIntegration: Connection error:', error);
    }
  };

  const handleDisconnect = async () => {
    exnessAPI.disconnect();
    
    // Notify the tradingBot to update its connection status
    const { tradingBot } = await import('@/lib/trading/tradingBot');
    tradingBot.updateConnectionStatus(false);
    
    setConnectionStatus("disconnected");
    setAccountInfo(null);
    setTestResult(null);
    setError(null);
    toast.success("Disconnected from Exness");
    console.log('🔌 Disconnected - tradingBot status updated');
  };

  const handleServerChange = (serverName: string) => {
    const server = serverOptions.find(s => s.value === serverName);
    setCredentials(prev => ({
      ...prev,
      server: serverName,
      isDemo: server?.type === "demo"
    }));
  };

  const handleRefreshAccount = async () => {
    if (connectionStatus === "connected") {
      await loadAccountInfo();
      toast.success("Account information refreshed");
    }
  };

  const formatCurrency = (amount: number, currency: string = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2
    }).format(amount);
  };

  const getConnectionStatusColor = () => {
    switch (connectionStatus) {
      case "connected": return "text-green-500";
      case "connecting": return "text-yellow-500";
      case "error": return "text-red-500";
      default: return "text-gray-500";
    }
  };

  const getConnectionStatusIcon = () => {
    switch (connectionStatus) {
      case "connected": return <CheckCircle className="w-5 h-5 text-green-500" />;
      case "connecting": return <Activity className="w-5 h-5 text-yellow-500 animate-spin" />;
      case "error": return <AlertTriangle className="w-5 h-5 text-red-500" />;
      default: return <Link className="w-5 h-5 text-gray-500" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Error Display */}
      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>Connection Error:</strong> {error}
            <div className="mt-2 text-sm">
              Make sure MetaTrader 5 terminal is running and the MT5 Bridge service is started.
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Connection Status Header */}
      <Card className="bg-gradient-to-r from-primary/5 to-accent/5 border-primary/20">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Link className="w-6 h-6 text-primary" />
              </div>
              <div>
                <CardTitle>Exness MT5 Integration</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Connect your real Exness MT5 account for live trading
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {getConnectionStatusIcon()}
              <Badge variant={connectionStatus === "connected" ? "default" : "secondary"}>
                {connectionStatus.toUpperCase()}
              </Badge>
            </div>
          </div>
        </CardHeader>
      </Card>

      <Tabs defaultValue="connection" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="connection">Connection</TabsTrigger>
          <TabsTrigger value="account">Account Info</TabsTrigger>
          <TabsTrigger value="settings">Trading Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="connection" className="space-y-6">
          {/* Connection Form */}
          <Card>
            <CardHeader>
              <CardTitle>MT5 Account Connection</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="accountNumber">Account Number</Label>
                  <Input
                    id="accountNumber"
                    type="text"
                    placeholder="Enter your MT5 account number"
                    value={credentials.accountNumber}
                    onChange={(e) => setCredentials(prev => ({ ...prev, accountNumber: e.target.value }))}
                    disabled={connectionStatus === "connected"}
                  />
                </div>
                <div>
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Enter your MT5 password"
                    value={credentials.password}
                    onChange={(e) => setCredentials(prev => ({ ...prev, password: e.target.value }))}
                    disabled={connectionStatus === "connected"}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="server">MT5 Server</Label>
                <div className="flex gap-2">
                  <select
                    id="server"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    value={credentials.server}
                    onChange={(e) => handleServerChange(e.target.value)}
                    disabled={connectionStatus === "connected"}
                  >
                    <option value="">Select MT5 Server</option>
                    <optgroup label="Demo/Trial Servers">
                      {serverOptions.filter(s => s.type === "demo").map(server => (
                        <option key={server.value} value={server.value}>
                          {server.label}
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label="Live/Real Servers">
                      {serverOptions.filter(s => s.type === "live").map(server => (
                        <option key={server.value} value={server.value}>
                          {server.label}
                        </option>
                      ))}
                    </optgroup>
                    <option value="custom">Custom Server...</option>
                  </select>
                </div>
                {credentials.server === "custom" && (
                  <Input
                    className="mt-2"
                    placeholder="Enter custom server name (e.g., ExnessKE-MT5Trial10)"
                    value={credentials.server === "custom" ? "" : credentials.server}
                    onChange={(e) => setCredentials(prev => ({ ...prev, server: e.target.value }))}
                    disabled={connectionStatus === "connected"}
                  />
                )}
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="isDemo"
                  checked={credentials.isDemo}
                  onCheckedChange={(checked) => setCredentials(prev => ({ ...prev, isDemo: checked }))}
                  disabled={connectionStatus === "connected"}
                />
                <Label htmlFor="isDemo">Demo Account</Label>
                <Badge variant={credentials.isDemo ? "secondary" : "destructive"}>
                  {credentials.isDemo ? "DEMO" : "LIVE"}
                </Badge>
              </div>

              <div className="flex gap-4">
                <Button
                  onClick={handleTestConnection}
                  variant="outline"
                  disabled={isTestingConnection || connectionStatus === "connected"}
                  className="flex items-center gap-2"
                >
                  {isTestingConnection ? (
                    <Activity className="w-4 h-4 animate-spin" />
                  ) : (
                    <Shield className="w-4 h-4" />
                  )}
                  Test Connection
                </Button>

                {connectionStatus === "connected" ? (
                  <Button
                    onClick={handleDisconnect}
                    variant="destructive"
                    className="flex items-center gap-2"
                  >
                    <Link className="w-4 h-4" />
                    Disconnect
                  </Button>
                ) : (
                  <Button
                    onClick={handleConnect}
                    disabled={isLoading || connectionStatus === "connecting"}
                    className="flex items-center gap-2"
                  >
                    {connectionStatus === "connecting" ? (
                      <Activity className="w-4 h-4 animate-spin" />
                    ) : (
                      <Link className="w-4 h-4" />
                    )}
                    Connect to Exness
                  </Button>
                )}
              </div>

              {/* Test Result */}
              {testResult && (
                <div className={`p-4 rounded-lg border ${
                  testResult.success 
                    ? 'bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800' 
                    : 'bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800'
                }`}>
                  <div className="flex items-center gap-2 mb-2">
                    {testResult.success ? (
                      <CheckCircle className="w-5 h-5 text-green-500" />
                    ) : (
                      <AlertTriangle className="w-5 h-5 text-red-500" />
                    )}
                    <span className={`font-medium ${
                      testResult.success ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'
                    }`}>
                      Connection Test {testResult.success ? 'Successful' : 'Failed'}
                    </span>
                  </div>
                  <p className={`text-sm ${
                    testResult.success ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                  }`}>
                    {testResult.message}
                  </p>
                  {testResult.accountInfo && (
                    <div className="mt-3 grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Account: </span>
                        <span className="font-medium">{testResult.accountInfo.accountNumber}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Balance: </span>
                        <span className="font-medium">
                          {formatCurrency(testResult.accountInfo.balance, testResult.accountInfo.currency)}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Server: </span>
                        <span className="font-medium">{testResult.accountInfo.server}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Type: </span>
                        <Badge variant={testResult.accountInfo.isDemo ? "secondary" : "destructive"}>
                          {testResult.accountInfo.isDemo ? "DEMO" : "LIVE"}
                        </Badge>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Setup Instructions */}
          <Card>
            <CardHeader>
              <CardTitle>Setup Instructions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800">
                  <h4 className="font-semibold text-blue-700 dark:text-blue-300 mb-2">
                    📋 Before You Start
                  </h4>
                  <ol className="text-sm text-blue-600 dark:text-blue-400 space-y-1 list-decimal list-inside">
                    <li>Install MetaTrader 5 terminal from Exness</li>
                    <li>Install Python dependencies: <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">pip install -r requirements.txt</code></li>
                    <li>Start MT5 Bridge: <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">python mt5_bridge.py</code></li>
                    <li>Login to your Exness account in MT5 terminal</li>
                    <li>Use the same credentials here to connect</li>
                  </ol>
                </div>

                <div className="p-4 rounded-lg bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800">
                  <h4 className="font-semibold text-yellow-700 dark:text-yellow-300 mb-2">
                    ⚠️ Important Notes
                  </h4>
                  <ul className="text-sm text-yellow-600 dark:text-yellow-400 space-y-1 list-disc list-inside">
                    <li>Always test with DEMO accounts first</li>
                    <li>Keep MT5 terminal running and logged in</li>
                    <li>Ensure MT5 Bridge service is running on port 8001</li>
                    <li>Use Trial servers for demo accounts</li>
                    <li>Use Real servers for live accounts</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="account" className="space-y-6">
          {connectionStatus === "connected" && accountInfo ? (
            <>
              {/* Account Overview */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Account Information</CardTitle>
                    <Button onClick={handleRefreshAccount} variant="outline" size="sm">
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Refresh
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="p-4 rounded-lg bg-muted/30">
                      <div className="flex items-center gap-2 mb-2">
                        <DollarSign className="w-4 h-4 text-green-500" />
                        <span className="text-sm text-muted-foreground">Balance</span>
                      </div>
                      <div className="text-2xl font-bold text-foreground">
                        {formatCurrency(accountInfo.balance, accountInfo.currency)}
                      </div>
                    </div>

                    <div className="p-4 rounded-lg bg-muted/30">
                      <div className="flex items-center gap-2 mb-2">
                        <TrendingUp className="w-4 h-4 text-blue-500" />
                        <span className="text-sm text-muted-foreground">Equity</span>
                      </div>
                      <div className="text-2xl font-bold text-foreground">
                        {formatCurrency(accountInfo.equity, accountInfo.currency)}
                      </div>
                    </div>

                    <div className="p-4 rounded-lg bg-muted/30">
                      <div className="flex items-center gap-2 mb-2">
                        <Shield className="w-4 h-4 text-purple-500" />
                        <span className="text-sm text-muted-foreground">Free Margin</span>
                      </div>
                      <div className="text-2xl font-bold text-foreground">
                        {formatCurrency(accountInfo.freeMargin, accountInfo.currency)}
                      </div>
                    </div>

                    <div className="p-4 rounded-lg bg-muted/30">
                      <div className="flex items-center gap-2 mb-2">
                        <Target className="w-4 h-4 text-orange-500" />
                        <span className="text-sm text-muted-foreground">Margin Level</span>
                      </div>
                      <div className={`text-2xl font-bold ${
                        accountInfo.marginLevel > 200 ? 'text-green-500' : 
                        accountInfo.marginLevel > 100 ? 'text-yellow-500' : 'text-red-500'
                      }`}>
                        {accountInfo.marginLevel.toFixed(1)}%
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-3">
                      <h4 className="font-semibold">Account Details</h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Account Number:</span>
                          <span className="font-medium">{accountInfo.accountNumber}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Server:</span>
                          <span className="font-medium">{accountInfo.server}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Currency:</span>
                          <span className="font-medium">{accountInfo.currency}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Leverage:</span>
                          <span className="font-medium">{accountInfo.leverage}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Company:</span>
                          <span className="font-medium">{accountInfo.company}</span>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <h4 className="font-semibold">Trading Status</h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Account Type:</span>
                          <Badge variant={accountInfo.isDemo ? "secondary" : "destructive"}>
                            {accountInfo.isDemo ? "DEMO" : "LIVE"}
                          </Badge>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Trading Allowed:</span>
                          <Badge variant={accountInfo.tradeAllowed ? "default" : "destructive"}>
                            {accountInfo.tradeAllowed ? "YES" : "NO"}
                          </Badge>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Used Margin:</span>
                          <span className="font-medium">
                            {formatCurrency(accountInfo.margin, accountInfo.currency)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Profit:</span>
                          <span className={`font-medium ${
                            accountInfo.profit >= 0 ? 'text-green-500' : 'text-red-500'
                          }`}>
                            {formatCurrency(accountInfo.profit, accountInfo.currency)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          ) : (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center py-8">
                  <Link className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-lg font-semibold mb-2">Not Connected</h3>
                  <p className="text-muted-foreground mb-4">
                    Connect your Exness MT5 account to view account information
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="settings" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Enhanced Trading Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Auto Trading Toggle */}
              <div className="flex items-center justify-between p-4 rounded-lg bg-primary/5 border border-primary/20">
                <div className="flex items-center gap-3">
                  <Zap className="w-5 h-5 text-primary" />
                  <div>
                    <div className="font-medium">Auto Trading</div>
                    <div className="text-sm text-muted-foreground">
                      Automatically execute signals when generated
                    </div>
                  </div>
                </div>
                <Switch
                  checked={autoTradingEnabled}
                  onCheckedChange={setAutoTradingEnabled}
                  disabled={connectionStatus !== "connected"}
                />
              </div>

              {/* Enhanced Risk Settings */}
              <div className="space-y-4">
                <h4 className="font-semibold">Enhanced Risk Management</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>Max Risk Per Trade (%)</Label>
                    <Input type="number" placeholder="5.0" min="0.1" max="15.0" step="0.1" />
                    <p className="text-xs text-muted-foreground mt-1">
                      Increased limit: 0.1% - 15% for aggressive day trading
                    </p>
                  </div>
                  <div>
                    <Label>Max Daily Loss (%)</Label>
                    <Input type="number" placeholder="20.0" min="1.0" max="40.0" step="0.5" />
                    <p className="text-xs text-muted-foreground mt-1">
                      Enhanced limit: 1% - 40% for day trading strategies
                    </p>
                  </div>
                  <div>
                    <Label>Max Position Size (Lots)</Label>
                    <Input type="number" placeholder="5.0" min="0.01" max="50.0" step="0.01" />
                    <p className="text-xs text-muted-foreground mt-1">
                      Increased limit: 0.01 - 50 lots for larger positions
                    </p>
                  </div>
                  <div>
                    <Label>Max Concurrent Positions</Label>
                    <Input type="number" placeholder="15" min="1" max="50" step="1" />
                    <p className="text-xs text-muted-foreground mt-1">
                      Enhanced limit: 1 - 50 positions for diversification
                    </p>
                  </div>
                </div>
              </div>

              {/* Signal Processing Settings */}
              <div className="space-y-4">
                <h4 className="font-semibold">Enhanced Signal Processing</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>Minimum Confidence (%)</Label>
                    <Input type="number" placeholder="25" min="10" max="95" step="1" />
                    <p className="text-xs text-muted-foreground mt-1">
                      Lowered threshold: 10% - 95% for maximum opportunities
                    </p>
                  </div>
                  <div>
                    <Label>Signal Check Interval (seconds)</Label>
                    <Input type="number" placeholder="3" min="1" max="60" step="1" />
                    <p className="text-xs text-muted-foreground mt-1">
                      Ultra fast: 1 - 60 seconds for rapid signal processing
                    </p>
                  </div>
                  <div>
                    <Label>Max Daily Trades</Label>
                    <Input type="number" placeholder="500" min="10" max="1000" step="10" />
                    <p className="text-xs text-muted-foreground mt-1">
                      Day trading limit: 10 - 1000 trades per day
                    </p>
                  </div>
                  <div>
                    <Label>Order Execution Delay (ms)</Label>
                    <Input type="number" placeholder="100" min="50" max="5000" step="50" />
                    <p className="text-xs text-muted-foreground mt-1">
                      Ultra fast: 50ms - 5s execution delay
                    </p>
                  </div>
                </div>
              </div>

              {/* Advanced Features */}
              <div className="space-y-4">
                <h4 className="font-semibold">Advanced Features</h4>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">Enhanced Position Sizing</div>
                      <div className="text-sm text-muted-foreground">
                        Dynamic position sizing based on volatility and confidence
                      </div>
                    </div>
                    <Switch defaultChecked />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">Aggressive Rate Limiting</div>
                      <div className="text-sm text-muted-foreground">
                        Reduced rate limits for maximum trading frequency
                      </div>
                    </div>
                    <Switch defaultChecked />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">Auto Signal Execution</div>
                      <div className="text-sm text-muted-foreground">
                        Automatically execute high-confidence signals
                      </div>
                    </div>
                    <Switch defaultChecked />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">Session-Based Trading</div>
                      <div className="text-sm text-muted-foreground">
                        Increase activity during optimal trading sessions
                      </div>
                    </div>
                    <Switch defaultChecked />
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <Button className="bg-primary hover:bg-primary/90">
                  Save Enhanced Settings
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Connection Status Footer */}
      {connectionStatus === "connected" && (
        <Alert>
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>✅ Connected to Exness {accountInfo?.isDemo ? 'DEMO' : 'LIVE'} Account</strong>
            <div className="mt-1 text-sm">
              Your trading bot can now execute real trades through your MT5 account. 
              {accountInfo && !accountInfo.isDemo && (
                <span className="text-red-600 font-semibold"> ⚠️ This is a LIVE account with real money!</span>
              )}
            </div>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
};