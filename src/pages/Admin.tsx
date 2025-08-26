import { Navigation } from "@/components/Navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { 
  Users, 
  Settings, 
  Activity, 
  Shield, 
  Search, 
  MoreHorizontal,
  UserPlus,
  Ban,
  Edit,
  Trash2,
  Eye,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Save,
  Zap,
  Bell,
  Target,
  DollarSign,
  Clock
} from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Slider } from "@/components/ui/slider";

interface BotSettings {
  enable_regime_boost: boolean;
  regime_expectancy_threshold: number;
  volume_boost_min: number;
  volume_boost_max: number;
  news_blackout_enabled: boolean;
  enable_trailing_stop: boolean;
  trailing_stop_distance: number;
  enable_partial_profits: boolean;
  partial_profit_levels: Array<{
    percentage: number;
    distance: number;
  }>;
}

const Admin = () => {
  const [botSettings, setBotSettings] = useState<BotSettings>({
    enable_regime_boost: false,
    regime_expectancy_threshold: 85,
    volume_boost_min: 0.10,
    volume_boost_max: 0.20,
    news_blackout_enabled: false,
    enable_trailing_stop: false,
    trailing_stop_distance: 20,
    enable_partial_profits: false,
    partial_profit_levels: []
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [diagnosticData, setDiagnosticData] = useState<any>(null);

  const users = [
    {
      id: 1,
      username: "john_trader",
      email: "john@example.com",
      role: "trader",
      status: "active",
      lastLogin: "2024-01-15 14:30",
      balance: "$10,450.00",
      trades: 145,
      winRate: "68%"
    },
    {
      id: 2,
      username: "sarah_analyst",
      email: "sarah@example.com", 
      role: "viewer",
      status: "active",
      lastLogin: "2024-01-15 16:45",
      balance: "$0.00",
      trades: 0,
      winRate: "N/A"
    },
    {
      id: 3,
      username: "mike_pro",
      email: "mike@example.com",
      role: "trader",
      status: "suspended",
      lastLogin: "2024-01-12 09:15",
      balance: "$2,890.00",
      trades: 89,
      winRate: "45%"
    },
    {
      id: 4,
      username: "admin_user",
      email: "admin@example.com",
      role: "admin",
      status: "active",
      lastLogin: "2024-01-15 18:00",
      balance: "N/A",
      trades: 0,
      winRate: "N/A"
    }
  ];

  const systemStats = [
    { label: "Total Users", value: "1,247", change: "+12%", trend: "up" },
    { label: "Active Traders", value: "456", change: "+8%", trend: "up" },
    { label: "Total Trades", value: "15,892", change: "+24%", trend: "up" },
    { label: "System Uptime", value: "99.8%", change: "+0.1%", trend: "up" }
  ];

  const recentActivity = [
    { action: "User Registration", user: "new_trader_123", time: "5 min ago" },
    { action: "Failed Login Attempt", user: "suspicious_user", time: "12 min ago" },
    { action: "Large Trade Executed", user: "whale_trader", time: "23 min ago" },
    { action: "Password Reset", user: "forgot_user", time: "1 hour ago" },
    { action: "API Key Generated", user: "api_user", time: "2 hours ago" }
  ];

  // Load bot settings from Supabase
  useEffect(() => {
    loadBotSettings();
  }, []);

  const loadBotSettings = async () => {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: settings } = await supabase
        .from('bot_settings')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (settings) {
        setBotSettings({
          enable_regime_boost: settings.enable_regime_boost ?? false,
          regime_expectancy_threshold: settings.regime_expectancy_threshold ?? 85,
          volume_boost_min: settings.volume_boost_min ?? 0.10,
          volume_boost_max: settings.volume_boost_max ?? 0.20,
          news_blackout_enabled: settings.news_blackout_enabled ?? false,
          enable_trailing_stop: settings.enable_trailing_stop ?? false,
          trailing_stop_distance: settings.trailing_stop_distance ?? 20,
          enable_partial_profits: settings.enable_partial_profits ?? false,
          partial_profit_levels: settings.partial_profit_levels ?? []
        });
      }
    } catch (error) {
      console.error('Failed to load bot settings:', error);
      toast.error('Failed to load settings');
    } finally {
      setIsLoading(false);
    }
  };

  const saveBotSettings = async () => {
    setIsSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('bot_settings')
        .upsert({
          user_id: user.id,
          enable_regime_boost: botSettings.enable_regime_boost,
          regime_expectancy_threshold: botSettings.regime_expectancy_threshold,
          volume_boost_min: botSettings.volume_boost_min,
          volume_boost_max: botSettings.volume_boost_max,
          news_blackout_enabled: botSettings.news_blackout_enabled,
          enable_trailing_stop: botSettings.enable_trailing_stop,
          trailing_stop_distance: botSettings.trailing_stop_distance,
          enable_partial_profits: botSettings.enable_partial_profits,
          partial_profit_levels: botSettings.partial_profit_levels,
          updated_at: new Date().toISOString()
        });

      if (error) throw error;
      toast.success('Settings saved successfully');
    } catch (error) {
      console.error('Failed to save bot settings:', error);
      toast.error('Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  const runDiagnostics = async () => {
    try {
      // Check if tradingBot is available
      if (typeof window !== 'undefined' && (window as any).tradingBot) {
        const bot = (window as any).tradingBot;
        
        const diagnosticData = {
          botStatus: bot.getStatus(),
          meanReversionStatus: bot.getMeanReversionStatus(),
          backtestStatus: bot.getBacktestStatus(),
          allocationStatus: bot.getAllocationStatus(),
          timestamp: new Date().toISOString()
        };
        
        setDiagnosticData(diagnosticData);
        toast.success('Diagnostics completed!');
      } else {
        toast.error('Trading bot not found. Make sure the app is running.');
      }
    } catch (error) {
      console.error('Diagnostic error:', error);
      toast.error('Failed to run diagnostics');
    }
  };

  const addPartialProfitLevel = () => {
    setBotSettings(prev => ({
      ...prev,
      partial_profit_levels: [
        ...prev.partial_profit_levels,
        { percentage: 50, distance: 30 }
      ]
    }));
  };

  const removePartialProfitLevel = (index: number) => {
    setBotSettings(prev => ({
      ...prev,
      partial_profit_levels: prev.partial_profit_levels.filter((_, i) => i !== index)
    }));
  };

  const updatePartialProfitLevel = (index: number, field: 'percentage' | 'distance', value: number) => {
    setBotSettings(prev => ({
      ...prev,
      partial_profit_levels: prev.partial_profit_levels.map((level, i) => 
        i === index ? { ...level, [field]: value } : level
      )
    }));
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active": return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300";
      case "suspended": return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300";
      case "pending": return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300";
      default: return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300";
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case "admin": return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300";
      case "trader": return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300";
      case "viewer": return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300";
      default: return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300";
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Admin Dashboard</h1>
          <p className="text-muted-foreground">Manage users, monitor system performance, and configure settings</p>
        </div>

        {/* System Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {systemStats.map((stat, index) => (
            <Card key={index}>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">{stat.label}</p>
                    <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                  </div>
                  <div className={`flex items-center gap-1 text-sm ${
                    stat.trend === 'up' ? 'text-green-600' : 'text-red-600'
                  }`}>
                    <TrendingUp className="w-4 h-4" />
                    <span>{stat.change}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-3">
            <Tabs defaultValue="users" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="users">Users</TabsTrigger>
                <TabsTrigger value="trading">Trading</TabsTrigger>
                <TabsTrigger value="system">System</TabsTrigger>
                <TabsTrigger value="settings">Settings</TabsTrigger>
              </TabsList>
              
              <TabsContent value="users" className="space-y-6">
                {/* User Management Header */}
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2">
                        <Users className="w-5 h-5" />
                        User Management
                      </CardTitle>
                      <Button className="flex items-center gap-2">
                        <UserPlus className="w-4 h-4" />
                        Add User
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex gap-4 mb-6">
                      <div className="flex-1 relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                        <Input placeholder="Search users..." className="pl-10" />
                      </div>
                      <Select>
                        <SelectTrigger className="w-[180px]">
                          <SelectValue placeholder="Role" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Roles</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                          <SelectItem value="trader">Trader</SelectItem>
                          <SelectItem value="viewer">Viewer</SelectItem>
                        </SelectContent>
                      </Select>
                      <Select>
                        <SelectTrigger className="w-[180px]">
                          <SelectValue placeholder="Status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Status</SelectItem>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="suspended">Suspended</SelectItem>
                          <SelectItem value="pending">Pending</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Users Table */}
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>User</TableHead>
                          <TableHead>Role</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Balance</TableHead>
                          <TableHead>Trades</TableHead>
                          <TableHead>Win Rate</TableHead>
                          <TableHead>Last Login</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {users.map((user) => (
                          <TableRow key={user.id}>
                            <TableCell>
                              <div>
                                <div className="font-medium">{user.username}</div>
                                <div className="text-sm text-muted-foreground">{user.email}</div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge className={getRoleColor(user.role)}>
                                {user.role}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge className={getStatusColor(user.status)}>
                                {user.status}
                              </Badge>
                            </TableCell>
                            <TableCell>{user.balance}</TableCell>
                            <TableCell>{user.trades}</TableCell>
                            <TableCell>{user.winRate}</TableCell>
                            <TableCell>{user.lastLogin}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Button variant="ghost" size="sm">
                                  <Eye className="w-4 h-4" />
                                </Button>
                                <Button variant="ghost" size="sm">
                                  <Edit className="w-4 h-4" />
                                </Button>
                                <Button variant="ghost" size="sm">
                                  <MoreHorizontal className="w-4 h-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Trading Tab */}
              <TabsContent value="trading" className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Regime-Based Volume Boost */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <TrendingUp className="w-5 h-5" />
                        Regime-Based Volume Boost (AGGRESSIVE)
                      </CardTitle>
                      <CardDescription>
                        Increase position size when market regime expectancy exceeds threshold for maximum profit
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="enable-regime-boost">Enable Regime Boost</Label>
                        <Switch
                          id="enable-regime-boost"
                          checked={botSettings.enable_regime_boost ?? true}
                          onCheckedChange={(checked) => setBotSettings(prev => ({ ...prev, enable_regime_boost: checked }))}
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="regime-threshold">
                          Expectancy Threshold: {botSettings.regime_expectancy_threshold ?? 80}%
                        </Label>
                        <Slider
                          id="regime-threshold"
                          value={[botSettings.regime_expectancy_threshold ?? 80]}
                          onValueChange={(value) => setBotSettings(prev => ({ ...prev, regime_expectancy_threshold: value[0] }))}
                          max={100}
                          min={60}
                          step={5}
                          className="w-full"
                        />
                        <p className="text-xs text-muted-foreground">
                          Aggressive: Lower threshold (80%) = More signals, higher profit potential
                        </p>
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="volume-boost-min">
                          Min Boost: {((botSettings.volume_boost_min ?? 0.15) * 100).toFixed(0)}%
                        </Label>
                        <Slider
                          id="volume-boost-min"
                          value={[(botSettings.volume_boost_min ?? 0.15) * 100]}
                          onValueChange={(value) => setBotSettings(prev => ({ ...prev, volume_boost_min: value[0] / 100 }))}
                          max={50}
                          min={10}
                          step={5}
                          className="w-full"
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="volume-boost-max">
                          Max Boost: {((botSettings.volume_boost_max ?? 0.25) * 100).toFixed(0)}%
                        </Label>
                        <Slider
                          id="volume-boost-max"
                          value={[(botSettings.volume_boost_max ?? 0.25) * 100]}
                          onValueChange={(value) => setBotSettings(prev => ({ ...prev, volume_boost_max: value[0] / 100 }))}
                          max={50}
                          min={15}
                          step={5}
                          className="w-full"
                        />
                        <p className="text-xs text-muted-foreground">
                          Aggressive: 15-25% boost for maximum profit during high-probability setups
                        </p>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Session-Based Trading */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Clock className="w-5 h-5" />
                        Session-Based Trading (London/NY)
                      </CardTitle>
                      <CardDescription>
                        Optimize trading during high-volatility London and New York sessions
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between p-3 border rounded-lg">
                          <div>
                            <p className="font-medium">London Session</p>
                            <p className="text-sm text-muted-foreground">08:00-16:00 UTC (High Volatility)</p>
                          </div>
                          <Badge variant="default" className="bg-green-100 text-green-800">
                            Active
                          </Badge>
                        </div>
                        
                        <div className="flex items-center justify-between p-3 border rounded-lg">
                          <div>
                            <p className="font-medium">New York Session</p>
                            <p className="text-sm text-muted-foreground">13:00-21:00 UTC (High Volatility)</p>
                          </div>
                          <Badge variant="default" className="bg-green-100 text-green-800">
                            Active
                          </Badge>
                        </div>
                        
                        <div className="flex items-center justify-between p-3 border rounded-lg">
                          <div>
                            <p className="font-medium">Asian Session</p>
                            <p className="text-sm text-muted-foreground">00:00-08:00 UTC (Lower Volatility)</p>
                          </div>
                          <Badge variant="outline" className="text-muted-foreground">
                            Limited
                          </Badge>
                        </div>
                      </div>
                      
                      <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                        <p className="text-sm text-blue-800">
                          <strong>Session Multiplier:</strong> Position size increases by 1.5x during London/NY sessions for maximum profit
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Trading Pairs & Gold */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <DollarSign className="w-5 h-5" />
                        Trading Pairs & Gold
                      </CardTitle>
                      <CardDescription>
                        Major currency pairs and gold for maximum profit opportunities
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="p-3 border rounded-lg bg-green-50 border-green-200">
                          <p className="font-medium text-green-800">EUR/USD</p>
                          <p className="text-xs text-green-600">Most liquid, tight spreads</p>
                        </div>
                        <div className="p-3 border rounded-lg bg-green-50 border-green-200">
                          <p className="font-medium text-green-800">GBP/USD</p>
                          <p className="text-xs text-green-600">Good volatility, clear trends</p>
                        </div>
                        <div className="p-3 border rounded-lg bg-green-50 border-green-200">
                          <p className="font-medium text-green-800">USD/JPY</p>
                          <p className="text-xs text-green-600">Trend-following, predictable</p>
                        </div>
                        <div className="p-3 border rounded-lg bg-yellow-50 border-yellow-200">
                          <p className="font-medium text-yellow-800">XAU/USD</p>
                          <p className="text-xs text-yellow-600">Gold - Safe haven, high volatility</p>
                        </div>
                      </div>
                      
                      <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                        <p className="text-sm text-amber-800">
                          <strong>Gold Trading:</strong> XAU/USD offers high volatility and safe-haven appeal during market uncertainty
                        </p>
                      </div>
                    </CardContent>
                  </Card>

                  {/* News Blackout */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5" />
                        News Blackout
                      </CardTitle>
                      <CardDescription>
                        Prevent trading during high-impact economic news events
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-between">
                        <Label htmlFor="news-blackout">Enable News Blackout</Label>
                        <Switch
                          id="news-blackout"
                          checked={botSettings.news_blackout_enabled ?? true}
                          onCheckedChange={(checked) => setBotSettings(prev => ({ ...prev, news_blackout_enabled: checked }))}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">
                        Automatically pauses trading 30 minutes before and after high-impact news events
                      </p>
                    </CardContent>
                  </Card>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Trailing Stop Loss */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Target className="w-5 h-5" />
                        Trailing Stop Loss
                      </CardTitle>
                      <CardDescription>
                        Automatically adjust stop loss as trade moves into profit
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="enable-trailing-stop">Enable Trailing Stop</Label>
                        <Switch
                          id="enable-trailing-stop"
                          checked={botSettings.enable_trailing_stop ?? true}
                          onCheckedChange={(checked) => setBotSettings(prev => ({ ...prev, enable_trailing_stop: checked }))}
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="trailing-distance">
                          Trailing Distance: {botSettings.trailing_stop_distance ?? 20} pips
                        </Label>
                        <Slider
                          id="trailing-distance"
                          value={[botSettings.trailing_stop_distance ?? 20]}
                          onValueChange={(value) => setBotSettings(prev => ({ ...prev, trailing_stop_distance: value[0] }))}
                          max={50}
                          min={10}
                          step={5}
                          className="w-full"
                        />
                        <p className="text-xs text-muted-foreground">
                          Distance in pips to trail behind current price
                        </p>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Partial Profit Taking */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <DollarSign className="w-5 h-5" />
                        Partial Profit Taking
                      </CardTitle>
                      <CardDescription>
                        Take partial profits at predefined levels
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="enable-partial-profits">Enable Partial Profits</Label>
                        <Switch
                          id="enable-partial-profits"
                          checked={botSettings.enable_partial_profits ?? true}
                          onCheckedChange={(checked) => setBotSettings(prev => ({ ...prev, enable_partial_profits: checked }))}
                        />
                      </div>
                      
                      <div className="space-y-3">
                        <Label>Profit Levels</Label>
                        {botSettings.partial_profit_levels.map((level, index) => (
                          <div key={index} className="flex gap-2 items-center">
                            <Input
                              type="number"
                              placeholder="% to close"
                              value={level.percentage}
                              onChange={(e) => updatePartialProfitLevel(index, 'percentage', parseFloat(e.target.value))}
                              className="w-20"
                            />
                            <Input
                              type="number"
                              placeholder="Distance (pips)"
                              value={level.distance}
                              onChange={(e) => updatePartialProfitLevel(index, 'distance', parseFloat(e.target.value))}
                              className="w-24"
                            />
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => removePartialProfitLevel(index)}
                            >
                              Remove
                            </Button>
                          </div>
                        ))}
                        
                        <Button
                          variant="outline"
                          onClick={addPartialProfitLevel}
                          className="w-full"
                        >
                          Add Profit Level
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Save Button */}
                <div className="flex justify-center">
                  <Button onClick={saveBotSettings} disabled={isSaving} size="lg" className="px-8">
                    {isSaving ? 'Saving...' : 'Save Trading Settings'}
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="system" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Settings className="w-5 h-5" />
                      System Configuration
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <h4 className="font-semibold mb-4">General Settings</h4>
                        <div className="space-y-4">
                          <div>
                            <label className="text-sm text-muted-foreground">System Name</label>
                            <Input placeholder="ForexPro Trading System" />
                          </div>
                          <div>
                            <label className="text-sm text-muted-foreground">Support Email</label>
                            <Input placeholder="support@forexpro.com" />
                          </div>
                          <div>
                            <label className="text-sm text-muted-foreground">Default Currency</label>
                            <Select>
                              <SelectTrigger>
                                <SelectValue placeholder="USD" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="usd">USD</SelectItem>
                                <SelectItem value="eur">EUR</SelectItem>
                                <SelectItem value="gbp">GBP</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <label className="text-sm text-muted-foreground">Timezone</label>
                            <Select>
                              <SelectTrigger>
                                <SelectValue placeholder="UTC" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="utc">UTC</SelectItem>
                                <SelectItem value="est">EST</SelectItem>
                                <SelectItem value="pst">PST</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </div>
                      
                      <div>
                        <h4 className="font-semibold mb-4">Security Settings</h4>
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <div>
                              <span className="text-sm font-medium">Two-Factor Authentication</span>
                              <p className="text-xs text-muted-foreground">Require 2FA for all admin accounts</p>
                            </div>
                            <Switch defaultChecked />
                          </div>
                          <div className="flex items-center justify-between">
                            <div>
                              <span className="text-sm font-medium">Session Timeout</span>
                              <p className="text-xs text-muted-foreground">Auto logout after inactivity</p>
                            </div>
                            <Switch defaultChecked />
                          </div>
                          <div className="flex items-center justify-between">
                            <div>
                              <span className="text-sm font-medium">Login Monitoring</span>
                              <p className="text-xs text-muted-foreground">Monitor suspicious login attempts</p>
                            </div>
                            <Switch defaultChecked />
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="settings" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Settings className="w-5 h-5" />
                      Application Settings
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-6">
                      <div>
                        <h4 className="font-semibold mb-4">Display Settings</h4>
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <div>
                              <span className="text-sm font-medium">Dark Mode</span>
                              <p className="text-xs text-muted-foreground">Use dark theme</p>
                            </div>
                            <Switch />
                          </div>
                          <div className="flex items-center justify-between">
                            <div>
                              <span className="text-sm font-medium">Real-time Updates</span>
                              <p className="text-xs text-muted-foreground">Auto-refresh data every 30 seconds</p>
                            </div>
                            <Switch defaultChecked />
                          </div>
                          <div className="flex items-center justify-between">
                            <div>
                              <span className="text-sm font-medium">Notifications</span>
                              <p className="text-xs text-muted-foreground">Show browser notifications</p>
                            </div>
                            <Switch defaultChecked />
                          </div>
                        </div>
                      </div>

                      <div>
                        <h4 className="font-semibold mb-4">Data Management</h4>
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <div>
                              <span className="text-sm font-medium">Auto Backup</span>
                              <p className="text-xs text-muted-foreground">Daily backup of trading data</p>
                            </div>
                            <Switch defaultChecked />
                          </div>
                          <div className="flex items-center justify-between">
                            <div>
                              <span className="text-sm font-medium">Data Retention</span>
                              <p className="text-xs text-muted-foreground">Keep data for 90 days</p>
                            </div>
                            <Switch defaultChecked />
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1">
            {/* Recent Activity */}
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="w-5 h-5" />
                  Recent Activity
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {recentActivity.map((activity, index) => (
                    <div key={index} className="flex flex-col gap-1 p-3 rounded-lg border border-border">
                      <div className="text-sm font-medium">{activity.action}</div>
                      <div className="text-xs text-muted-foreground">{activity.user}</div>
                      <div className="text-xs text-muted-foreground">{activity.time}</div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Quick Stats */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="w-5 h-5" />
                  Security Overview
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between">
                    <span className="text-sm">Failed Logins (24h)</span>
                    <span className="text-sm font-medium">12</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">Blocked IPs</span>
                    <span className="text-sm font-medium">3</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">Active Sessions</span>
                    <span className="text-sm font-medium">127</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">API Calls (1h)</span>
                    <span className="text-sm font-medium">2,847</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Trading Bot Diagnostics */}
            <Card className="mt-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Search className="w-5 h-5" />
                  Trading Bot Diagnostics
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <Button 
                    onClick={runDiagnostics} 
                    className="w-full"
                    disabled={isLoading}
                  >
                    {isLoading ? 'Running...' : 'Run Diagnostics'}
                  </Button>
                  
                  {diagnosticData && (
                    <div className="space-y-3">
                      <div className="text-sm font-medium">Last Run: {new Date(diagnosticData.timestamp).toLocaleString()}</div>
                      
                      <div className="space-y-2">
                        <div className="text-xs font-medium text-muted-foreground">Bot Status:</div>
                        <pre className="text-xs bg-muted p-2 rounded overflow-auto max-h-20">
                          {JSON.stringify(diagnosticData.botStatus, null, 2)}
                        </pre>
                      </div>
                      
                      <div className="space-y-2">
                        <div className="text-xs font-medium text-muted-foreground">Mean Reversion:</div>
                        <pre className="text-xs bg-muted p-2 rounded overflow-auto max-h-20">
                          {JSON.stringify(diagnosticData.meanReversionStatus, null, 2)}
                        </pre>
                      </div>
                      
                      <div className="space-y-2">
                        <div className="text-xs font-medium text-muted-foreground">Paper Backtest:</div>
                        <pre className="text-xs bg-muted p-2 rounded overflow-auto max-h-20">
                          {JSON.stringify(diagnosticData.backtestStatus, null, 2)}
                        </pre>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Admin;