import { Navigation } from "@/components/Navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ExitAndNewsSettings } from "@/components/ExitAndNewsSettings";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
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
  CheckCircle
} from "lucide-react";

const Admin = () => {
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
                            <TableCell className="font-medium">{user.balance}</TableCell>
                            <TableCell>{user.trades}</TableCell>
                            <TableCell>{user.winRate}</TableCell>
                            <TableCell className="text-sm">{user.lastLogin}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Button variant="ghost" size="sm">
                                  <Eye className="w-4 h-4" />
                                </Button>
                                <Button variant="ghost" size="sm">
                                  <Edit className="w-4 h-4" />
                                </Button>
                                <Button variant="ghost" size="sm">
                                  <Ban className="w-4 h-4" />
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
              
              <TabsContent value="trading">
                <Card>
                  <CardHeader>
                    <CardTitle>Trading Management</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-4">
                        <h4 className="font-semibold">Market Controls</h4>
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-sm">Trading Enabled</span>
                            <Switch defaultChecked />
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-sm">Paper Trading Only</span>
                            <Switch />
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-sm">Stop Loss Required</span>
                            <Switch defaultChecked />
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-sm">News Trading Pause</span>
                            <Switch defaultChecked />
                          </div>
                        </div>
                      </div>
                      
                      <div className="space-y-4">
                        <h4 className="font-semibold">Risk Limits</h4>
                        <div className="space-y-3">
                          <div>
                            <label className="text-sm text-muted-foreground">Max Position Size</label>
                            <Input placeholder="10000" />
                          </div>
                          <div>
                            <label className="text-sm text-muted-foreground">Max Daily Loss (%)</label>
                            <Input placeholder="5" />
                          </div>
                          <div>
                            <label className="text-sm text-muted-foreground">Max Leverage</label>
                            <Input placeholder="100" />
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
              
              <TabsContent value="system">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Settings className="w-5 h-5" />
                      System Monitoring
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="space-y-4">
                        <h4 className="font-semibold">Service Status</h4>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-sm">Trading Engine</span>
                            <CheckCircle className="w-5 h-5 text-green-500" />
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-sm">Data Feed</span>
                            <CheckCircle className="w-5 h-5 text-green-500" />
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-sm">AI Prediction</span>
                            <AlertTriangle className="w-5 h-5 text-yellow-500" />
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-sm">Notifications</span>
                            <CheckCircle className="w-5 h-5 text-green-500" />
                          </div>
                        </div>
                      </div>
                      
                      <div className="space-y-4">
                        <h4 className="font-semibold">Performance</h4>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span>CPU Usage</span>
                            <span>24%</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Memory Usage</span>
                            <span>56%</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Database Load</span>
                            <span>18%</span>
                          </div>
                          <div className="flex justify-between">
                            <span>API Response Time</span>
                            <span>145ms</span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="space-y-4">
                        <h4 className="font-semibold">Quick Actions</h4>
                        <div className="space-y-2">
                          <Button variant="outline" className="w-full justify-start">
                            Restart Services
                          </Button>
                          <Button variant="outline" className="w-full justify-start">
                            Clear Cache
                          </Button>
                          <Button variant="outline" className="w-full justify-start">
                            Export Logs
                          </Button>
                          <Button variant="outline" className="w-full justify-start">
                            Backup Database
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
              
              <TabsContent value="settings">
                <Card>
                  <CardHeader>
                    <CardTitle>System Settings</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-6">
                      <ExitAndNewsSettings />
                      
                      <div>
                        <h4 className="font-semibold mb-4">Platform Configuration</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="text-sm text-muted-foreground">Platform Name</label>
                            <Input placeholder="ForexPro Analytics" />
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
          </div>
        </div>
      </div>
    </div>
  );
};

export default Admin;