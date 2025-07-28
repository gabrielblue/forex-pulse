import { Navigation } from "@/components/Navigation";
import { EconomicCalendar } from "@/components/EconomicCalendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar as CalendarIcon, Clock, Flag, Filter, TrendingUp } from "lucide-react";

const Calendar = () => {
  const upcomingEvents = [
    {
      time: "08:30",
      currency: "USD",
      country: "United States",
      event: "Non-Farm Payrolls",
      impact: "HIGH",
      forecast: "185K",
      previous: "178K",
      description: "Monthly change in the number of employed people during the previous month"
    },
    {
      time: "10:00",
      currency: "EUR",
      country: "Eurozone", 
      event: "Consumer Price Index",
      impact: "HIGH",
      forecast: "2.4%",
      previous: "2.6%",
      description: "Measures the change in the price of goods and services purchased by consumers"
    },
    {
      time: "14:00",
      currency: "GBP",
      country: "United Kingdom",
      event: "Bank of England Interest Rate Decision",
      impact: "HIGH",
      forecast: "5.25%",
      previous: "5.25%",
      description: "Interest rate set by the Bank of England's Monetary Policy Committee"
    },
    {
      time: "15:30",
      currency: "CAD",
      country: "Canada",
      event: "GDP Growth Rate",
      impact: "MEDIUM",
      forecast: "0.3%",
      previous: "0.2%",
      description: "Quarterly change in the inflation-adjusted value of all goods and services"
    }
  ];

  const weeklyEvents = [
    { day: "Monday", events: 8, highImpact: 2 },
    { day: "Tuesday", events: 12, highImpact: 4 },
    { day: "Wednesday", events: 15, highImpact: 6 },
    { day: "Thursday", events: 10, highImpact: 3 },
    { day: "Friday", events: 14, highImpact: 5 },
  ];

  const getImpactColor = (impact: string) => {
    switch (impact) {
      case "HIGH": return "bg-red-500 text-white";
      case "MEDIUM": return "bg-yellow-500 text-black";
      case "LOW": return "bg-green-500 text-white";
      default: return "bg-gray-500 text-white";
    }
  };

  const getCurrencyFlag = (currency: string) => {
    const flags = {
      USD: "🇺🇸",
      EUR: "🇪🇺", 
      GBP: "🇬🇧",
      JPY: "🇯🇵",
      CAD: "🇨🇦",
      AUD: "🇦🇺",
      CHF: "🇨🇭"
    };
    return flags[currency as keyof typeof flags] || "🏳️";
  };

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Economic Calendar</h1>
          <p className="text-muted-foreground">Track important economic events that move the forex markets</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Calendar Content */}
          <div className="lg:col-span-2">
            {/* Filter Controls */}
            <Card className="mb-6">
              <CardContent className="pt-6">
                <div className="flex flex-wrap gap-4">
                  <Button variant="outline" className="flex items-center gap-2">
                    <Filter className="w-4 h-4" />
                    All Currencies
                  </Button>
                  <Button variant="outline" className="flex items-center gap-2">
                    <Flag className="w-4 h-4" />
                    High Impact Only
                  </Button>
                  <Button variant="outline" className="flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    Today
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Today's Events */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CalendarIcon className="w-5 h-5" />
                  Today's Events
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {upcomingEvents.map((event, index) => (
                    <div 
                      key={index}
                      className="border border-border rounded-lg p-4 hover:bg-accent/50 transition-colors"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-2">
                            <span className="text-2xl">{getCurrencyFlag(event.currency)}</span>
                            <div>
                              <div className="font-medium text-foreground">{event.currency}</div>
                              <div className="text-sm text-muted-foreground">{event.time}</div>
                            </div>
                          </div>
                        </div>
                        <Badge className={getImpactColor(event.impact)}>
                          {event.impact}
                        </Badge>
                      </div>
                      
                      <h4 className="font-semibold text-foreground mb-2">{event.event}</h4>
                      <p className="text-sm text-muted-foreground mb-3">{event.description}</p>
                      
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">Forecast: </span>
                          <span className="font-medium">{event.forecast}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Previous: </span>
                          <span className="font-medium">{event.previous}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Weekly Overview */}
            <Card className="mt-6">
              <CardHeader>
                <CardTitle>This Week's Overview</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {weeklyEvents.map((day, index) => (
                    <div key={index} className="flex items-center justify-between p-3 rounded-lg border border-border">
                      <div className="font-medium">{day.day}</div>
                      <div className="flex items-center gap-4">
                        <div className="text-sm text-muted-foreground">
                          {day.events} events
                        </div>
                        <Badge variant="secondary">
                          {day.highImpact} high impact
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1">
            <EconomicCalendar />
            
            <Card className="mt-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5" />
                  Market Impact Analysis
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                      <span className="font-medium text-red-700 dark:text-red-300">High Volatility Expected</span>
                    </div>
                    <p className="text-sm text-red-600 dark:text-red-400">
                      Non-Farm Payrolls and BoE decision may cause significant price movements
                    </p>
                  </div>
                  
                  <div className="p-3 rounded-lg bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                      <span className="font-medium text-yellow-700 dark:text-yellow-300">USD Pairs Watch</span>
                    </div>
                    <p className="text-sm text-yellow-600 dark:text-yellow-400">
                      Multiple USD events scheduled - monitor EUR/USD, GBP/USD closely
                    </p>
                  </div>
                  
                  <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                      <span className="font-medium text-blue-700 dark:text-blue-300">Trading Tip</span>
                    </div>
                    <p className="text-sm text-blue-600 dark:text-blue-400">
                      Consider reducing position sizes 30 minutes before high-impact events
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="mt-6">
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button className="w-full" variant="outline">
                  Set Event Alerts
                </Button>
                <Button className="w-full" variant="outline">
                  Export Calendar
                </Button>
                <Button className="w-full" variant="outline">
                  Subscribe to Updates
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Calendar;