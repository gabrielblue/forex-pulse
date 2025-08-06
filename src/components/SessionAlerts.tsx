import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Clock, 
  Globe, 
  Bell, 
  AlertTriangle,
  CheckCircle,
  Activity,
  TrendingUp,
  BarChart3
} from "lucide-react";
import { toast } from "sonner";

interface TradingSession {
  name: string;
  city: string;
  timezone: string;
  openTime: string;
  closeTime: string;
  flag: string;
  isActive: boolean;
  nextOpen: Date | null;
  nextClose: Date | null;
  marketCondition: "VOLATILE" | "STABLE" | "QUIET";
  volume: "HIGH" | "MEDIUM" | "LOW";
}

interface SessionAlert {
  sessionName: string;
  alertTime: number; // minutes before session
  enabled: boolean;
}

export const SessionAlerts = () => {
  const [sessions, setSessions] = useState<TradingSession[]>([]);
  const [alerts, setAlerts] = useState<SessionAlert[]>([
    { sessionName: "London", alertTime: 30, enabled: true },
    { sessionName: "New York", alertTime: 30, enabled: true },
    { sessionName: "Tokyo", alertTime: 30, enabled: true },
    { sessionName: "Sydney", alertTime: 30, enabled: true }
  ]);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [nextAlert, setNextAlert] = useState<{ session: string; time: Date } | null>(null);

  useEffect(() => {
    updateSessions();
    
    // Update every minute
    const interval = setInterval(() => {
      setCurrentTime(new Date());
      updateSessions();
      checkForAlerts();
    }, 60000);

    return () => clearInterval(interval);
  }, []);

  const updateSessions = () => {
    const now = new Date();
    
    const sessionData: TradingSession[] = [
      {
        name: "Sydney",
        city: "Sydney, Australia",
        timezone: "AEDT",
        openTime: "07:00",
        closeTime: "16:00",
        flag: "🇦🇺",
        isActive: false,
        nextOpen: null,
        nextClose: null,
        marketCondition: "STABLE",
        volume: "MEDIUM"
      },
      {
        name: "Tokyo",
        city: "Tokyo, Japan", 
        timezone: "JST",
        openTime: "09:00",
        closeTime: "18:00",
        flag: "🇯🇵",
        isActive: false,
        nextOpen: null,
        nextClose: null,
        marketCondition: "VOLATILE",
        volume: "HIGH"
      },
      {
        name: "London",
        city: "London, UK",
        timezone: "GMT",
        openTime: "08:00",
        closeTime: "17:00",
        flag: "🇬🇧",
        isActive: false,
        nextOpen: null,
        nextClose: null,
        marketCondition: "VOLATILE",
        volume: "HIGH"
      },
      {
        name: "New York",
        city: "New York, USA",
        timezone: "EST",
        openTime: "13:00",
        closeTime: "22:00",
        flag: "🇺🇸",
        isActive: false,
        nextOpen: null,
        nextClose: null,
        marketCondition: "VOLATILE",
        volume: "HIGH"
      }
    ];

    // Calculate session times and status
    sessionData.forEach(session => {
      const { isActive, nextOpen, nextClose } = calculateSessionTimes(session, now);
      session.isActive = isActive;
      session.nextOpen = nextOpen;
      session.nextClose = nextClose;
    });

    setSessions(sessionData);
    calculateNextAlert(sessionData);
  };

  const calculateSessionTimes = (session: TradingSession, now: Date) => {
    // Simplified calculation - in reality you'd need proper timezone handling
    const [openHour, openMin] = session.openTime.split(':').map(Number);
    const [closeHour, closeMin] = session.closeTime.split(':').map(Number);
    
    const todayOpen = new Date(now);
    todayOpen.setUTCHours(openHour, openMin, 0, 0);
    
    const todayClose = new Date(now);
    todayClose.setUTCHours(closeHour, closeMin, 0, 0);
    
    const tomorrowOpen = new Date(todayOpen);
    tomorrowOpen.setDate(tomorrowOpen.getDate() + 1);
    
    const isActive = now >= todayOpen && now <= todayClose;
    const nextOpen = now < todayOpen ? todayOpen : tomorrowOpen;
    const nextClose = isActive ? todayClose : null;
    
    return { isActive, nextOpen, nextClose };
  };

  const calculateNextAlert = (sessionData: TradingSession[]) => {
    const now = new Date();
    let nextAlert: { session: string; time: Date } | null = null;
    let earliestTime = Infinity;

    sessionData.forEach(session => {
      const alertConfig = alerts.find(a => a.sessionName === session.name && a.enabled);
      if (!alertConfig || !session.nextOpen) return;

      const alertTime = new Date(session.nextOpen.getTime() - (alertConfig.alertTime * 60000));
      
      if (alertTime > now && alertTime.getTime() < earliestTime) {
        earliestTime = alertTime.getTime();
        nextAlert = { session: session.name, time: alertTime };
      }
    });

    setNextAlert(nextAlert);
  };

  const checkForAlerts = () => {
    const now = new Date();
    
    sessions.forEach(session => {
      const alertConfig = alerts.find(a => a.sessionName === session.name && a.enabled);
      if (!alertConfig || !session.nextOpen) return;

      const alertTime = new Date(session.nextOpen.getTime() - (alertConfig.alertTime * 60000));
      const timeDiff = Math.abs(now.getTime() - alertTime.getTime());
      
      // Alert if within 1 minute of alert time
      if (timeDiff < 60000 && now >= alertTime) {
        showSessionAlert(session, alertConfig.alertTime);
      }
    });
  };

  const showSessionAlert = (session: TradingSession, minutesBefore: number) => {
    const message = `${session.flag} ${session.name} session opens in ${minutesBefore} minutes!`;
    
    toast.success(message, {
      description: `Get ready to start your trading bot for optimal market conditions`,
      duration: 10000,
      action: {
        label: "Start Bot",
        onClick: () => {
          // This would trigger bot start
          toast.success("Trading bot activation ready!");
        }
      }
    });

    // Browser notification if permission granted
    if (Notification.permission === "granted") {
      new Notification("Trading Session Alert", {
        body: message,
        icon: "/favicon.ico"
      });
    }
  };

  const requestNotificationPermission = async () => {
    if ("Notification" in window) {
      const permission = await Notification.requestPermission();
      if (permission === "granted") {
        toast.success("Browser notifications enabled for session alerts");
      }
    }
  };

  const updateAlert = (sessionName: string, field: keyof SessionAlert, value: any) => {
    setAlerts(prev => prev.map(alert => 
      alert.sessionName === sessionName 
        ? { ...alert, [field]: value }
        : alert
    ));
  };

  const getVolumeColor = (volume: string) => {
    switch (volume) {
      case "HIGH": return "text-red-500";
      case "MEDIUM": return "text-yellow-500";
      case "LOW": return "text-green-500";
      default: return "text-gray-500";
    }
  };

  const getConditionColor = (condition: string) => {
    switch (condition) {
      case "VOLATILE": return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300";
      case "STABLE": return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300";
      case "QUIET": return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300";
      default: return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300";
    }
  };

  const formatTimeUntil = (date: Date | null) => {
    if (!date) return "N/A";
    
    const diff = date.getTime() - currentTime.getTime();
    if (diff <= 0) return "Now";
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  return (
    <div className="space-y-6">
      {/* Session Overview */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Globe className="w-6 h-6 text-primary" />
              </div>
              <div>
                <CardTitle>Global Trading Sessions</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Monitor major forex trading sessions worldwide
                </p>
              </div>
            </div>
            <Button onClick={requestNotificationPermission} variant="outline" size="sm">
              <Bell className="w-4 h-4 mr-2" />
              Enable Notifications
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {sessions.map((session) => (
              <div
                key={session.name}
                className={`p-4 rounded-lg border transition-all ${
                  session.isActive 
                    ? 'border-green-500 bg-green-50 dark:bg-green-950' 
                    : 'border-border bg-card'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{session.flag}</span>
                    <div>
                      <div className="font-semibold text-sm">{session.name}</div>
                      <div className="text-xs text-muted-foreground">{session.timezone}</div>
                    </div>
                  </div>
                  <Badge variant={session.isActive ? "default" : "secondary"}>
                    {session.isActive ? "OPEN" : "CLOSED"}
                  </Badge>
                </div>
                
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Hours:</span>
                    <span>{session.openTime} - {session.closeTime}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Next Open:</span>
                    <span className="font-medium">{formatTimeUntil(session.nextOpen)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Volume:</span>
                    <span className={`font-medium ${getVolumeColor(session.volume)}`}>
                      {session.volume}
                    </span>
                  </div>
                </div>
                
                <div className="mt-3">
                  <Badge className={getConditionColor(session.marketCondition)} variant="outline">
                    {session.marketCondition}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Alert Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="w-5 h-5" />
            Session Alert Settings
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {alerts.map((alert) => (
              <div key={alert.sessionName} className="flex items-center justify-between p-4 rounded-lg border border-border">
                <div className="flex items-center gap-3">
                  <Switch
                    checked={alert.enabled}
                    onCheckedChange={(enabled) => updateAlert(alert.sessionName, 'enabled', enabled)}
                  />
                  <div>
                    <Label className="font-medium">{alert.sessionName} Session</Label>
                    <p className="text-sm text-muted-foreground">
                      Alert {alert.alertTime} minutes before opening
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="5"
                    max="60"
                    value={alert.alertTime}
                    onChange={(e) => updateAlert(alert.sessionName, 'alertTime', parseInt(e.target.value))}
                    className="w-16 px-2 py-1 text-sm border rounded"
                  />
                  <span className="text-sm text-muted-foreground">min</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Next Alert Info */}
      {nextAlert && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>Next Alert:</strong> {nextAlert.session} session in {formatTimeUntil(nextAlert.time)}
            <div className="mt-2 text-sm">
              Perfect time to start your trading bot for optimal market conditions!
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Session Overlap Analysis */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="w-5 h-5" />
            Session Overlap Analysis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-4 h-4 text-primary" />
                <span className="font-medium">London-New York Overlap</span>
                <Badge variant="outline">13:00-17:00 GMT</Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Highest volatility period - EUR/USD, GBP/USD most active
              </p>
            </div>
            
            <div className="p-4 rounded-lg bg-accent/5 border border-accent/20">
              <div className="flex items-center gap-2 mb-2">
                <BarChart3 className="w-4 h-4 text-accent" />
                <span className="font-medium">Tokyo-London Overlap</span>
                <Badge variant="outline">08:00-09:00 GMT</Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Good for JPY pairs - USD/JPY, EUR/JPY, GBP/JPY
              </p>
            </div>
            
            <div className="p-4 rounded-lg bg-muted/30 border border-border/30">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="w-4 h-4 text-muted-foreground" />
                <span className="font-medium">Sydney-Tokyo Overlap</span>
                <Badge variant="outline">07:00-09:00 GMT</Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Lower volatility - Good for AUD/JPY, NZD/JPY
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Trading Recommendations */}
      <Card>
        <CardHeader>
          <CardTitle>Session Trading Recommendations</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="p-3 rounded-lg bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800">
              <div className="font-medium text-green-700 dark:text-green-300 mb-1">
                🇬🇧 London Session (Most Active)
              </div>
              <p className="text-sm text-green-600 dark:text-green-400">
                Best for: EUR/USD, GBP/USD, USD/CHF. High volatility and tight spreads.
              </p>
            </div>
            
            <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800">
              <div className="font-medium text-blue-700 dark:text-blue-300 mb-1">
                🇺🇸 New York Session (High Volume)
              </div>
              <p className="text-sm text-blue-600 dark:text-blue-400">
                Best for: USD pairs, especially during London overlap. Major news releases.
              </p>
            </div>
            
            <div className="p-3 rounded-lg bg-purple-50 dark:bg-purple-950 border border-purple-200 dark:border-purple-800">
              <div className="font-medium text-purple-700 dark:text-purple-300 mb-1">
                🇯🇵 Tokyo Session (Asian Focus)
              </div>
              <p className="text-sm text-purple-600 dark:text-purple-400">
                Best for: JPY pairs, AUD/USD, NZD/USD. Lower volatility, good for range trading.
              </p>
            </div>
            
            <div className="p-3 rounded-lg bg-orange-50 dark:bg-orange-950 border border-orange-200 dark:border-orange-800">
              <div className="font-medium text-orange-700 dark:text-orange-300 mb-1">
                🇦🇺 Sydney Session (Pacific Start)
              </div>
              <p className="text-sm text-orange-600 dark:text-orange-400">
                Best for: AUD/USD, NZD/USD. Quieter session, good for position building.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};