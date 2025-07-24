import { useState, useEffect } from "react";
import { TrendingUp, TrendingDown, ArrowUp, ArrowDown } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface CurrencyPair {
  pair: string;
  price: number;
  change: number;
  changePercent: number;
  signal: "BUY" | "SELL" | "HOLD";
  confidence: number;
  volume: string;
  high24h: number;
  low24h: number;
}

// Mock data that simulates real-time updates
const generateMockData = (): CurrencyPair[] => [
  {
    pair: "EUR/USD",
    price: 1.0945 + (Math.random() - 0.5) * 0.001,
    change: -0.0023 + (Math.random() - 0.5) * 0.001,
    changePercent: -0.21 + (Math.random() - 0.5) * 0.1,
    signal: Math.random() > 0.5 ? "BUY" : "SELL",
    confidence: 75 + Math.random() * 20,
    volume: "2.4B",
    high24h: 1.0978,
    low24h: 1.0923
  },
  {
    pair: "GBP/USD",
    price: 1.2734 + (Math.random() - 0.5) * 0.001,
    change: 0.0045 + (Math.random() - 0.5) * 0.001,
    changePercent: 0.35 + (Math.random() - 0.5) * 0.1,
    signal: Math.random() > 0.5 ? "BUY" : "SELL",
    confidence: 82 + Math.random() * 15,
    volume: "1.8B",
    high24h: 1.2756,
    low24h: 1.2689
  },
  {
    pair: "USD/JPY",
    price: 149.85 + (Math.random() - 0.5) * 0.1,
    change: -0.67 + (Math.random() - 0.5) * 0.1,
    changePercent: -0.45 + (Math.random() - 0.5) * 0.1,
    signal: Math.random() > 0.5 ? "BUY" : "SELL",
    confidence: 68 + Math.random() * 25,
    volume: "3.1B",
    high24h: 150.52,
    low24h: 149.18
  },
  {
    pair: "AUD/USD",
    price: 0.6623 + (Math.random() - 0.5) * 0.001,
    change: 0.0032 + (Math.random() - 0.5) * 0.001,
    changePercent: 0.48 + (Math.random() - 0.5) * 0.1,
    signal: Math.random() > 0.5 ? "BUY" : "SELL",
    confidence: 71 + Math.random() * 20,
    volume: "987M",
    high24h: 0.6645,
    low24h: 0.6591
  },
  {
    pair: "USD/CHF",
    price: 0.8892 + (Math.random() - 0.5) * 0.001,
    change: -0.0018 + (Math.random() - 0.5) * 0.001,
    changePercent: -0.20 + (Math.random() - 0.5) * 0.1,
    signal: Math.random() > 0.5 ? "BUY" : "SELL",
    confidence: 77 + Math.random() * 18,
    volume: "1.2B",
    high24h: 0.8915,
    low24h: 0.8874
  },
  {
    pair: "USD/CAD",
    price: 1.3598 + (Math.random() - 0.5) * 0.001,
    change: 0.0025 + (Math.random() - 0.5) * 0.001,
    changePercent: 0.18 + (Math.random() - 0.5) * 0.1,
    signal: Math.random() > 0.5 ? "BUY" : "SELL",
    confidence: 73 + Math.random() * 22,
    volume: "845M",
    high24h: 1.3621,
    low24h: 1.3573
  }
];

export const CurrencyPairsTable = () => {
  const [pairs, setPairs] = useState<CurrencyPair[]>(generateMockData());
  const [lastUpdate, setLastUpdate] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => {
      setPairs(generateMockData());
      setLastUpdate(new Date());
    }, 3000); // Update every 3 seconds

    return () => clearInterval(interval);
  }, []);

  const formatPrice = (price: number, pair: string) => {
    if (pair.includes("JPY")) {
      return price.toFixed(2);
    }
    return price.toFixed(4);
  };

  const getSignalColor = (signal: string) => {
    switch (signal) {
      case "BUY":
        return "bg-bullish text-bullish-foreground";
      case "SELL":
        return "bg-bearish text-bearish-foreground";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  return (
    <Card className="p-6 bg-gradient-to-br from-card to-card/80 border-border/50">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Major Currency Pairs</h2>
          <p className="text-muted-foreground text-sm">
            Live rates • Last updated: {lastUpdate.toLocaleTimeString()}
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-2 h-2 bg-bullish rounded-full animate-pulse"></div>
          <span className="text-sm text-muted-foreground">Live</span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border/50">
              <th className="text-left py-3 px-2 text-muted-foreground font-medium">Pair</th>
              <th className="text-right py-3 px-2 text-muted-foreground font-medium">Price</th>
              <th className="text-right py-3 px-2 text-muted-foreground font-medium">Change</th>
              <th className="text-right py-3 px-2 text-muted-foreground font-medium">%</th>
              <th className="text-center py-3 px-2 text-muted-foreground font-medium">Signal</th>
              <th className="text-right py-3 px-2 text-muted-foreground font-medium">Confidence</th>
              <th className="text-right py-3 px-2 text-muted-foreground font-medium">Volume</th>
            </tr>
          </thead>
          <tbody>
            {pairs.map((pair) => (
              <tr
                key={pair.pair}
                className="border-b border-border/30 hover:bg-muted/20 transition-colors animate-fade-in"
              >
                <td className="py-4 px-2">
                  <div className="flex items-center space-x-2">
                    <span className="font-semibold text-foreground">{pair.pair}</span>
                  </div>
                </td>
                <td className="text-right py-4 px-2">
                  <span className="font-mono text-lg font-semibold text-foreground">
                    {formatPrice(pair.price, pair.pair)}
                  </span>
                </td>
                <td className="text-right py-4 px-2">
                  <div className="flex items-center justify-end space-x-1">
                    {pair.change > 0 ? (
                      <ArrowUp className="w-4 h-4 text-bullish" />
                    ) : (
                      <ArrowDown className="w-4 h-4 text-bearish" />
                    )}
                    <span className={`font-mono ${pair.change > 0 ? "text-bullish" : "text-bearish"}`}>
                      {pair.change > 0 ? "+" : ""}{formatPrice(pair.change, pair.pair)}
                    </span>
                  </div>
                </td>
                <td className="text-right py-4 px-2">
                  <span className={`font-mono ${pair.changePercent > 0 ? "text-bullish" : "text-bearish"}`}>
                    {pair.changePercent > 0 ? "+" : ""}{pair.changePercent.toFixed(2)}%
                  </span>
                </td>
                <td className="text-center py-4 px-2">
                  <Badge className={`${getSignalColor(pair.signal)} font-semibold animate-pulse-glow`}>
                    {pair.signal}
                  </Badge>
                </td>
                <td className="text-right py-4 px-2">
                  <div className="flex items-center justify-end space-x-2">
                    <div className="w-12 bg-muted rounded-full h-2">
                      <div
                        className="bg-primary h-2 rounded-full transition-all duration-300"
                        style={{ width: `${pair.confidence}%` }}
                      ></div>
                    </div>
                    <span className="text-sm text-muted-foreground w-8">
                      {Math.round(pair.confidence)}%
                    </span>
                  </div>
                </td>
                <td className="text-right py-4 px-2">
                  <span className="text-muted-foreground font-mono">{pair.volume}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
};