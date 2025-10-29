import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, TrendingUp, AlertCircle, Globe } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface NewsItem {
  id: string;
  title: string;
  impact: "HIGH" | "MEDIUM" | "LOW";
  sentiment: "BULLISH" | "BEARISH" | "NEUTRAL";
  affectedPairs: string[];
  timestamp: Date;
  source: string;
  summary: string;
}

export const NewsAlertsCard = () => {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchRealNewsData();

    // Refresh news every 5 minutes
    const interval = setInterval(fetchRealNewsData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const fetchRealNewsData = async () => {
    try {
      // Fetch REAL economic events from database
      const { data: events, error } = await supabase
        .from('economic_events')
        .select('*')
        .order('event_time', { ascending: false })
        .limit(5);

      if (error) {
        console.error('Error fetching news:', error);
        return;
      }

      if (events && events.length > 0) {
        const newsItems: NewsItem[] = events.map(event => ({
          id: event.id,
          title: event.title,
          impact: event.impact as "HIGH" | "MEDIUM" | "LOW",
          sentiment: "NEUTRAL" as const, // Economic events don't have inherent sentiment
          affectedPairs: Array.isArray(event.affected_pairs) ? event.affected_pairs : [],
          timestamp: new Date(event.event_time),
          source: "Economic Calendar",
          summary: event.title
        }));
        setNews(newsItems);
        console.log(`✅ Loaded ${newsItems.length} REAL economic events`);
      } else {
        console.log('ℹ️ No economic events found in database');
      }
    } catch (error) {
      console.error('Error loading news:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getImpactColor = (impact: string) => {
    switch (impact) {
      case "HIGH":
        return "bg-bearish text-bearish-foreground";
      case "MEDIUM":
        return "bg-warning text-warning-foreground";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const getSentimentColor = (sentiment: string) => {
    switch (sentiment) {
      case "BULLISH":
        return "bg-bullish text-bullish-foreground";
      case "BEARISH":
        return "bg-bearish text-bearish-foreground";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const formatTimeAgo = (timestamp: Date) => {
    const minutes = Math.floor((Date.now() - timestamp.getTime()) / (1000 * 60));
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ago`;
  };

  return (
    <Card className="p-6 bg-gradient-to-br from-card to-card/80 border-border/50">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Globe className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-foreground">Market News & Alerts</h2>
            <p className="text-muted-foreground text-sm">Real-time market moving events</p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-2 h-2 bg-primary rounded-full animate-pulse"></div>
          <span className="text-sm text-muted-foreground">Live</span>
        </div>
      </div>

      <div className="space-y-4">
        {news.map((item, index) => (
          <div
            key={item.id}
            className="p-4 rounded-lg bg-muted/30 border border-border/30 hover:bg-muted/50 transition-all duration-300 animate-fade-in"
            style={{ animationDelay: `${index * 100}ms` }}
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center space-x-2">
                <Badge className={getImpactColor(item.impact)} variant="secondary">
                  {item.impact}
                </Badge>
                <Badge className={getSentimentColor(item.sentiment)} variant="outline">
                  {item.sentiment}
                </Badge>
                <div className="flex items-center space-x-1 text-muted-foreground">
                  <Clock className="w-3 h-3" />
                  <span className="text-xs">{formatTimeAgo(item.timestamp)}</span>
                </div>
              </div>
              <span className="text-xs text-muted-foreground">{item.source}</span>
            </div>

            <h3 className="font-semibold text-foreground mb-2 leading-tight">
              {item.title}
            </h3>

            <p className="text-sm text-muted-foreground mb-3 leading-relaxed">
              {item.summary}
            </p>

            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <span className="text-xs text-muted-foreground">Affected pairs:</span>
                <div className="flex space-x-1">
                  {item.affectedPairs.slice(0, 3).map((pair) => (
                    <Badge key={pair} variant="outline" className="text-xs">
                      {pair}
                    </Badge>
                  ))}
                  {item.affectedPairs.length > 3 && (
                    <Badge variant="outline" className="text-xs">
                      +{item.affectedPairs.length - 3}
                    </Badge>
                  )}
                </div>
              </div>
              <TrendingUp className="w-4 h-4 text-primary" />
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 p-3 bg-primary/5 rounded-lg border border-primary/20">
        <div className="flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 text-primary" />
          <span className="text-sm text-primary font-medium">
            Market Alert: High volatility expected during NY session due to Fed officials' speeches
          </span>
        </div>
      </div>
    </Card>
  );
};