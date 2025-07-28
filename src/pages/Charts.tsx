import { Navigation } from "@/components/Navigation";
import { MarketCharts } from "@/components/MarketCharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Activity, BarChart3 } from "lucide-react";

const Charts = () => {
  const watchlist = [
    { pair: "EUR/USD", price: "1.0845", change: "+0.12%", status: "bullish" },
    { pair: "GBP/USD", price: "1.2734", change: "-0.08%", status: "bearish" },
    { pair: "USD/JPY", price: "149.45", change: "+0.34%", status: "bullish" },
    { pair: "AUD/USD", price: "0.6789", change: "+0.21%", status: "bullish" },
  ];

  const timeframes = ["1M", "5M", "15M", "1H", "4H", "1D", "1W"];

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Trading Charts</h1>
          <p className="text-muted-foreground">Advanced charting with technical analysis tools</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Main Chart Area */}
          <div className="lg:col-span-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="w-5 h-5" />
                  EUR/USD Chart
                </CardTitle>
                <div className="flex gap-2">
                  {timeframes.map((tf) => (
                    <Button
                      key={tf}
                      variant={tf === "1H" ? "default" : "outline"}
                      size="sm"
                    >
                      {tf}
                    </Button>
                  ))}
                </div>
              </CardHeader>
              <CardContent>
                <MarketCharts />
              </CardContent>
            </Card>

            <div className="mt-6">
              <Tabs defaultValue="indicators" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="indicators">Technical Indicators</TabsTrigger>
                  <TabsTrigger value="patterns">Patterns</TabsTrigger>
                  <TabsTrigger value="signals">Trading Signals</TabsTrigger>
                </TabsList>
                
                <TabsContent value="indicators" className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm">RSI (14)</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold text-foreground">67.3</div>
                        <Badge variant="secondary">Neutral</Badge>
                      </CardContent>
                    </Card>
                    
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm">MACD</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold text-foreground">0.0012</div>
                        <Badge className="bg-green-500">Bullish</Badge>
                      </CardContent>
                    </Card>
                    
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm">Bollinger Bands</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold text-foreground">Mid</div>
                        <Badge variant="outline">Range</Badge>
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>
                
                <TabsContent value="patterns">
                  <Card>
                    <CardContent className="pt-6">
                      <div className="text-center text-muted-foreground">
                        <Activity className="w-12 h-12 mx-auto mb-4 opacity-50" />
                        <p>Pattern recognition analysis will appear here</p>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
                
                <TabsContent value="signals">
                  <Card>
                    <CardContent className="pt-6">
                      <div className="text-center text-muted-foreground">
                        <TrendingUp className="w-12 h-12 mx-auto mb-4 opacity-50" />
                        <p>AI-generated trading signals will appear here</p>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </div>
          </div>

          {/* Watchlist Sidebar */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle>Market Watchlist</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {watchlist.map((item) => (
                  <div 
                    key={item.pair}
                    className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-accent/50 transition-colors cursor-pointer"
                  >
                    <div>
                      <div className="font-medium">{item.pair}</div>
                      <div className="text-sm text-muted-foreground">{item.price}</div>
                    </div>
                    <div className="text-right">
                      <div className={`text-sm font-medium ${
                        item.status === 'bullish' ? 'text-green-500' : 'text-red-500'
                      }`}>
                        {item.change}
                      </div>
                      {item.status === 'bullish' ? (
                        <TrendingUp className="w-4 h-4 text-green-500 ml-auto" />
                      ) : (
                        <TrendingDown className="w-4 h-4 text-red-500 ml-auto" />
                      )}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="mt-6">
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button className="w-full" variant="outline">
                  Add to Watchlist
                </Button>
                <Button className="w-full" variant="outline">
                  Set Price Alert
                </Button>
                <Button className="w-full" variant="outline">
                  Save Chart Layout
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Charts;