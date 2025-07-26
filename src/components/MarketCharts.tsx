import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { TrendingUp, TrendingDown, Activity, BarChart3 } from "lucide-react";

const mockChartData = [
  { time: "09:00", price: 1.0850, high: 1.0865, low: 1.0845, open: 1.0850, close: 1.0860, volume: 1250 },
  { time: "09:05", price: 1.0860, high: 1.0875, low: 1.0855, open: 1.0860, close: 1.0870, volume: 1380 },
  { time: "09:10", price: 1.0870, high: 1.0885, low: 1.0865, open: 1.0870, close: 1.0880, volume: 1420 },
  { time: "09:15", price: 1.0880, high: 1.0895, low: 1.0875, open: 1.0880, close: 1.0890, volume: 1560 },
  { time: "09:20", price: 1.0890, high: 1.0905, low: 1.0885, open: 1.0890, close: 1.0895, volume: 1340 },
  { time: "09:25", price: 1.0895, high: 1.0910, low: 1.0890, open: 1.0895, close: 1.0905, volume: 1480 },
];

const instruments = [
  { symbol: "EURUSD", name: "Euro/US Dollar", price: 1.0895, change: +0.0023, changePercent: +0.21 },
  { symbol: "GBPUSD", name: "British Pound/US Dollar", price: 1.2745, change: -0.0018, changePercent: -0.14 },
  { symbol: "USDJPY", name: "US Dollar/Japanese Yen", price: 149.82, change: +0.45, changePercent: +0.30 },
  { symbol: "AUDUSD", name: "Australian Dollar/US Dollar", price: 0.6523, change: +0.0008, changePercent: +0.12 },
];

export const MarketCharts = () => {
  const [selectedInstrument, setSelectedInstrument] = useState("EURUSD");
  const [timeframe, setTimeframe] = useState("5M");
  const [chartType, setChartType] = useState("line");

  const selectedData = instruments.find(i => i.symbol === selectedInstrument);

  return (
    <div className="space-y-6">
      {/* Market Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {instruments.map((instrument) => (
          <Card key={instrument.symbol} className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => setSelectedInstrument(instrument.symbol)}>
            <CardContent className="p-4">
              <div className="flex justify-between items-start mb-2">
                <h3 className="font-semibold text-sm">{instrument.symbol}</h3>
                <Badge variant={instrument.change > 0 ? "default" : "destructive"} className="text-xs">
                  {instrument.change > 0 ? <TrendingUp className="w-3 h-3 mr-1" /> : <TrendingDown className="w-3 h-3 mr-1" />}
                  {instrument.changePercent > 0 ? "+" : ""}{instrument.changePercent}%
                </Badge>
              </div>
              <div className="text-2xl font-bold">{instrument.price}</div>
              <div className={`text-sm ${instrument.change > 0 ? "text-bullish" : "text-bearish"}`}>
                {instrument.change > 0 ? "+" : ""}{instrument.change}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main Chart */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Activity className="w-5 h-5" />
                {selectedData?.name}
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Real-time price action • Live market data
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Select value={timeframe} onValueChange={setTimeframe}>
                <SelectTrigger className="w-20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1M">1M</SelectItem>
                  <SelectItem value="5M">5M</SelectItem>
                  <SelectItem value="15M">15M</SelectItem>
                  <SelectItem value="1H">1H</SelectItem>
                  <SelectItem value="4H">4H</SelectItem>
                  <SelectItem value="1D">1D</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" onClick={() => setChartType(chartType === "line" ? "candle" : "line")}>
                <BarChart3 className="w-4 h-4 mr-1" />
                {chartType === "line" ? "Candles" : "Line"}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={mockChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="time" stroke="hsl(var(--muted-foreground))" />
                <YAxis domain={['dataMin - 0.001', 'dataMax + 0.001']} stroke="hsl(var(--muted-foreground))" />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))', 
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px'
                  }}
                />
                <Line 
                  type="monotone" 
                  dataKey="price" 
                  stroke="hsl(var(--primary))" 
                  strokeWidth={2}
                  dot={{ fill: 'hsl(var(--primary))', strokeWidth: 2, r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Technical Indicators */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">RSI (14)</span>
              <Badge variant="secondary">Neutral</Badge>
            </div>
            <div className="text-2xl font-bold mt-2">52.3</div>
            <div className="w-full bg-secondary rounded-full h-2 mt-2">
              <div className="bg-primary h-2 rounded-full" style={{ width: '52.3%' }}></div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">MACD</span>
              <Badge variant="default">Bullish</Badge>
            </div>
            <div className="text-2xl font-bold mt-2 text-bullish">+0.0012</div>
            <div className="text-xs text-muted-foreground mt-1">Signal: 0.0008</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">BB Position</span>
              <Badge variant="outline">Upper Band</Badge>
            </div>
            <div className="text-2xl font-bold mt-2">1.0910</div>
            <div className="text-xs text-muted-foreground mt-1">Mid: 1.0875 | Lower: 1.0840</div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};