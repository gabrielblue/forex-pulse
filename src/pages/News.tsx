import { Navigation } from "@/components/Navigation";
import { NewsAlertsCard } from "@/components/NewsAlertsCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Newspaper, Search, Filter, TrendingUp, Globe, Clock } from "lucide-react";

const News = () => {
  // NOTE: This data is for demonstration purposes only
  // In production, integrate with real news APIs like:
  // - NewsAPI.org
  // - Forex Factory API
  // - Bloomberg Terminal
  // - Reuters Market News
  // - Investing.com API

  const newsCategories = [
    { name: "All", count: 124, active: true },
    { name: "Central Banks", count: 23, active: false },
    { name: "Economic Data", count: 45, active: false },
    { name: "Market Analysis", count: 67, active: false },
    { name: "Crypto", count: 12, active: false },
  ];

  // DEMO DATA - Replace with real-time news feed in production
  const topStories = [
    {
      id: 1,
      title: "Fed Considers Rate Cut as Inflation Shows Signs of Cooling",
      source: "Reuters",
      time: "2 hours ago",
      impact: "HIGH",
      sentiment: "BULLISH",
      excerpt: "Federal Reserve officials are discussing potential rate cuts following recent inflation data...",
      affectedPairs: ["USD/EUR", "USD/GBP", "USD/JPY"],
      image: null
    },
    {
      id: 2,
      title: "ECB Maintains Hawkish Stance Despite Economic Concerns",
      source: "Bloomberg",
      time: "4 hours ago",
      impact: "MEDIUM",
      sentiment: "BEARISH",
      excerpt: "European Central Bank signals continued monetary tightening amid persistent inflation...",
      affectedPairs: ["EUR/USD", "EUR/GBP"],
      image: null
    },
    {
      id: 3,
      title: "UK GDP Growth Exceeds Expectations in Q3",
      source: "Financial Times",
      time: "6 hours ago",
      impact: "MEDIUM",
      sentiment: "BULLISH",
      excerpt: "British economy shows resilience with 0.6% quarterly growth beating forecasts...",
      affectedPairs: ["GBP/USD", "GBP/EUR"],
      image: null
    },
  ];

  const getImpactColor = (impact: string) => {
    switch (impact) {
      case "HIGH": return "bg-red-500 text-white";
      case "MEDIUM": return "bg-yellow-500 text-black";
      case "LOW": return "bg-green-500 text-white";
      default: return "bg-gray-500 text-white";
    }
  };

  const getSentimentColor = (sentiment: string) => {
    switch (sentiment) {
      case "BULLISH": return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300";
      case "BEARISH": return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300";
      case "NEUTRAL": return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300";
      default: return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300";
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Market News & Analysis</h1>
          <p className="text-muted-foreground">Stay updated with the latest forex market developments</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Main News Content */}
          <div className="lg:col-span-3">
            {/* Search and Filters */}
            <Card className="mb-6">
              <CardContent className="pt-6">
                <div className="flex flex-col md:flex-row gap-4">
                  <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                    <Input 
                      placeholder="Search news articles..."
                      className="pl-10"
                    />
                  </div>
                  <Button variant="outline" className="flex items-center gap-2">
                    <Filter className="w-4 h-4" />
                    Filters
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* News Categories */}
            <div className="flex flex-wrap gap-2 mb-6">
              {newsCategories.map((category) => (
                <Button
                  key={category.name}
                  variant={category.active ? "default" : "outline"}
                  size="sm"
                  className="flex items-center gap-2"
                >
                  {category.name}
                  <Badge variant="secondary" className="text-xs">
                    {category.count}
                  </Badge>
                </Button>
              ))}
            </div>

            {/* Top Stories */}
            <div className="space-y-6">
              {topStories.map((story) => (
                <Card key={story.id} className="hover:shadow-lg transition-shadow cursor-pointer">
                  <CardContent className="pt-6">
                    <div className="flex gap-4">
                      <div className="w-24 h-24 bg-muted rounded-lg flex-shrink-0 flex items-center justify-center">
                        <Newspaper className="w-8 h-8 text-muted-foreground" />
                      </div>
                      
                      <div className="flex-1">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Globe className="w-4 h-4" />
                            <span>{story.source}</span>
                            <Clock className="w-4 h-4" />
                            <span>{story.time}</span>
                          </div>
                          <div className="flex gap-2">
                            <Badge className={getImpactColor(story.impact)}>
                              {story.impact}
                            </Badge>
                            <Badge className={getSentimentColor(story.sentiment)}>
                              {story.sentiment}
                            </Badge>
                          </div>
                        </div>
                        
                        <h3 className="text-lg font-semibold text-foreground mb-2 hover:text-primary transition-colors">
                          {story.title}
                        </h3>
                        
                        <p className="text-muted-foreground mb-3">
                          {story.excerpt}
                        </p>
                        
                        <div className="flex flex-wrap gap-2">
                          <span className="text-sm text-muted-foreground">Affected pairs:</span>
                          {story.affectedPairs.map((pair) => (
                            <Badge key={pair} variant="outline" className="text-xs">
                              {pair}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1">
            <NewsAlertsCard />
            
            <Card className="mt-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5" />
                  Market Sentiment
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Overall Sentiment</span>
                    <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300">
                      Bullish
                    </Badge>
                  </div>
                  
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Positive</span>
                      <span className="text-sm font-medium">65%</span>
                    </div>
                    <div className="w-full bg-secondary rounded-full h-2">
                      <div className="bg-green-500 h-2 rounded-full" style={{ width: '65%' }}></div>
                    </div>
                  </div>
                  
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Negative</span>
                      <span className="text-sm font-medium">20%</span>
                    </div>
                    <div className="w-full bg-secondary rounded-full h-2">
                      <div className="bg-red-500 h-2 rounded-full" style={{ width: '20%' }}></div>
                    </div>
                  </div>
                  
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Neutral</span>
                      <span className="text-sm font-medium">15%</span>
                    </div>
                    <div className="w-full bg-secondary rounded-full h-2">
                      <div className="bg-gray-500 h-2 rounded-full" style={{ width: '15%' }}></div>
                    </div>
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

export default News;