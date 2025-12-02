import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  CheckCircle2, 
  XCircle, 
  AlertCircle,
  Loader2
} from "lucide-react";

interface ChecklistItem {
  id: string;
  label: string;
  status: 'complete' | 'incomplete' | 'checking';
  description: string;
  action?: string;
}

interface TradeExecutionChecklistProps {
  isConnected: boolean;
  isBotActive: boolean;
  isAutoTradingEnabled: boolean;
  mt5BridgeStatus?: 'connected' | 'disconnected' | 'checking';
  hasHistoricalData?: boolean;
}

export const TradeExecutionChecklist = ({
  isConnected,
  isBotActive,
  isAutoTradingEnabled,
  mt5BridgeStatus = 'checking',
  hasHistoricalData = false
}: TradeExecutionChecklistProps) => {
  
  const checklist: ChecklistItem[] = [
    {
      id: 'exness',
      label: 'Exness Connection',
      status: isConnected ? 'complete' : 'incomplete',
      description: 'Connect to your Exness MT5 account',
      action: isConnected ? undefined : 'Click "Connect to Exness" button above'
    },
    {
      id: 'mt5bridge',
      label: 'MT5 Bridge Running',
      status: mt5BridgeStatus === 'connected' ? 'complete' : mt5BridgeStatus === 'checking' ? 'checking' : 'incomplete',
      description: 'Python bridge service for historical data',
      action: mt5BridgeStatus !== 'connected' ? 'Run: python mt5_bridge.py in terminal' : undefined
    },
    {
      id: 'data',
      label: 'Historical Data Available',
      status: hasHistoricalData ? 'complete' : 'checking',
      description: 'Minimum 20+ price points required for AI analysis',
      action: !hasHistoricalData ? 'Ensure MT5 Terminal is logged in and bridge is running' : undefined
    },
    {
      id: 'bot',
      label: 'Bot Started',
      status: isBotActive ? 'complete' : 'incomplete',
      description: 'Trading bot is active and generating signals',
      action: !isBotActive ? 'Click "Start Bot" button' : undefined
    },
    {
      id: 'auto',
      label: 'Auto-Trading Enabled',
      status: isAutoTradingEnabled ? 'complete' : 'incomplete',
      description: 'Automatic execution of high-confidence signals',
      action: !isAutoTradingEnabled ? 'Enable the "Auto-Trading" toggle' : undefined
    }
  ];

  const getStatusIcon = (status: ChecklistItem['status']) => {
    switch (status) {
      case 'complete':
        return <CheckCircle2 className="w-5 h-5 text-bullish" />;
      case 'checking':
        return <Loader2 className="w-5 h-5 text-muted-foreground animate-spin" />;
      case 'incomplete':
        return <XCircle className="w-5 h-5 text-bearish" />;
    }
  };

  const getStatusBadge = (status: ChecklistItem['status']) => {
    switch (status) {
      case 'complete':
        return <Badge className="bg-bullish">Ready</Badge>;
      case 'checking':
        return <Badge variant="outline">Checking...</Badge>;
      case 'incomplete':
        return <Badge className="bg-bearish">Required</Badge>;
    }
  };

  const allComplete = checklist.every(item => item.status === 'complete');
  const incompleteCount = checklist.filter(item => item.status === 'incomplete').length;

  return (
    <Card className="p-6 border border-border/30">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-foreground">Trade Execution Checklist</h3>
        {allComplete ? (
          <Badge className="bg-bullish text-white">
            <CheckCircle2 className="w-4 h-4 mr-1" />
            All Systems Go
          </Badge>
        ) : (
          <Badge variant="outline" className="text-warning">
            <AlertCircle className="w-4 h-4 mr-1" />
            {incompleteCount} Action{incompleteCount !== 1 ? 's' : ''} Required
          </Badge>
        )}
      </div>

      {allComplete && (
        <Alert className="mb-6 bg-bullish/10 border-bullish">
          <CheckCircle2 className="h-4 w-4 text-bullish" />
          <AlertDescription className="text-bullish">
            <strong>Ready to Trade!</strong> The bot will analyze markets every 3-5 minutes and execute trades when AI confidence ≥ 65%.
          </AlertDescription>
        </Alert>
      )}

      {!allComplete && (
        <Alert className="mb-6 bg-warning/10 border-warning">
          <AlertCircle className="h-4 w-4 text-warning" />
          <AlertDescription className="text-warning">
            Complete the following steps to enable trading
          </AlertDescription>
        </Alert>
      )}

      <div className="space-y-4">
        {checklist.map((item) => (
          <div
            key={item.id}
            className={`flex items-start space-x-4 p-4 rounded-lg border ${
              item.status === 'complete'
                ? 'bg-bullish/5 border-bullish/20'
                : 'bg-muted/30 border-border/30'
            }`}
          >
            {getStatusIcon(item.status)}
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <h4 className="font-medium text-foreground">{item.label}</h4>
                {getStatusBadge(item.status)}
              </div>
              
              <p className="text-sm text-muted-foreground mb-2">
                {item.description}
              </p>
              
              {item.action && (
                <p className="text-sm font-medium text-accent">
                  → {item.action}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
};
