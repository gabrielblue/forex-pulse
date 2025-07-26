import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ExternalLink, Key, Server, AlertTriangle, CheckCircle, Settings } from "lucide-react";

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
  const [account, setAccount] = useState<ExnessAccount>(mockAccount);
  const [isConnecting, setIsConnecting] = useState(false);
  const [autoTradingEnabled, setAutoTradingEnabled] = useState(false);
  const [credentials, setCredentials] = useState({
    accountNumber: "",
    password: "",
    server: "ExnessServer-MT5"
  });

  const handleConnect = async () => {
    setIsConnecting(true);
    // Simulate connection process
    setTimeout(() => {
      setAccount(prev => ({ ...prev, connected: true }));
      setIsConnecting(false);
    }, 2000);
  };

  const handleDisconnect = () => {
    setAccount(prev => ({ ...prev, connected: false }));
    setAutoTradingEnabled(false);
  };

  return (
    <div className="space-y-6">
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
              {account.connected ? (
                <><CheckCircle className="w-3 h-3 mr-1" />Connected</>
              ) : (
                <><AlertTriangle className="w-3 h-3 mr-1" />Disconnected</>
              )}
            </Badge>
          </div>
        </CardHeader>
      </Card>

      {!account.connected ? (
        /* Connection Form */
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Key className="w-5 h-5" />
              Account Credentials
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <strong>Important:</strong> For real Exness integration, you'll need Supabase backend to securely store credentials and handle API calls. 
                This demo shows the UI only.
              </AlertDescription>
            </Alert>
            
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
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter your MT5 password"
                  value={credentials.password}
                  onChange={(e) => setCredentials(prev => ({ ...prev, password: e.target.value }))}
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="server">Server</Label>
              <Select value={credentials.server} onValueChange={(value) => setCredentials(prev => ({ ...prev, server: value }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ExnessServer-MT5">ExnessServer-MT5</SelectItem>
                  <SelectItem value="ExnessServer-Real">ExnessServer-Real</SelectItem>
                  <SelectItem value="ExnessServer-Demo">ExnessServer-Demo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <Button 
              onClick={handleConnect} 
              disabled={isConnecting || !credentials.accountNumber || !credentials.password}
              className="w-full"
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
          </CardContent>
        </Card>
      ) : (
        /* Connected Account Info */
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="text-sm font-medium text-muted-foreground">Balance</div>
                <div className="text-2xl font-bold">${account.balance.toLocaleString()}</div>
                <div className="text-xs text-muted-foreground mt-1">{account.currency}</div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4">
                <div className="text-sm font-medium text-muted-foreground">Equity</div>
                <div className="text-2xl font-bold text-bullish">${account.equity.toLocaleString()}</div>
                <div className="text-xs text-bullish mt-1">+{((account.equity - account.balance) / account.balance * 100).toFixed(2)}%</div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4">
                <div className="text-sm font-medium text-muted-foreground">Free Margin</div>
                <div className="text-2xl font-bold">${account.freeMargin.toLocaleString()}</div>
                <div className="text-xs text-muted-foreground mt-1">Available for trading</div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4">
                <div className="text-sm font-medium text-muted-foreground">Leverage</div>
                <div className="text-2xl font-bold text-accent">{account.leverage}</div>
                <div className="text-xs text-muted-foreground mt-1">{account.accountType.toUpperCase()} Account</div>
              </CardContent>
            </Card>
          </div>

          {/* Trading Controls */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="w-5 h-5" />
                Live Trading Controls
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between p-4 rounded-lg border border-border/50">
                <div>
                  <div className="font-medium">Auto-Trading</div>
                  <div className="text-sm text-muted-foreground">
                    Allow AI to execute trades automatically on your Exness account
                  </div>
                </div>
                <Switch 
                  checked={autoTradingEnabled}
                  onCheckedChange={setAutoTradingEnabled}
                />
              </div>
              
              {autoTradingEnabled && (
                <Alert>
                  <CheckCircle className="h-4 w-4" />
                  <AlertDescription>
                    Auto-trading is <strong>ENABLED</strong>. The AI will execute trades based on your strategy settings and risk management rules.
                  </AlertDescription>
                </Alert>
              )}
              
              <div className="flex gap-4">
                <Button variant="outline" onClick={handleDisconnect}>
                  Disconnect Account
                </Button>
                <Button variant="outline">
                  View Trading History
                </Button>
                <Button>
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
          <strong>Development Note:</strong> Real Exness integration requires:
          <ul className="list-disc list-inside mt-2 space-y-1">
            <li>Supabase backend for secure API key storage</li>
            <li>Exness MT5 API or WebAPI implementation</li>
            <li>Real-time data feed integration</li>
            <li>Order management system</li>
          </ul>
        </AlertDescription>
      </Alert>
    </div>
  );
};