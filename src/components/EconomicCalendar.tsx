import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, Flag, TrendingUp } from "lucide-react";

interface EconomicEvent {
  id: string;
  time: string;
  country: string;
  flag: string;
  event: string;
  impact: "HIGH" | "MEDIUM" | "LOW";
  forecast: string;
  previous: string;
  actual?: string;
  currency: string;
}

const todayEvents: EconomicEvent[] = [
  {
    id: "1",
    time: "08:30",
    country: "United States",
    flag: "🇺🇸",
    event: "Core CPI (MoM)",
    impact: "HIGH",
    forecast: "0.3%",
    previous: "0.3%",
    currency: "USD"
  },
  {
    id: "2",
    time: "09:15",
    country: "United States",
    flag: "🇺🇸",
    event: "Fed Chair Powell Speech",
    impact: "HIGH",
    forecast: "-",
    previous: "-",
    currency: "USD"
  },
  {
    id: "3",
    time: "10:00",
    country: "Eurozone",
    flag: "🇪🇺",
    event: "Industrial Production",
    impact: "MEDIUM",
    forecast: "0.1%",
    previous: "-0.3%",
    currency: "EUR"
  },
  {
    id: "4",
    time: "13:30",
    country: "United Kingdom",
    flag: "🇬🇧",
    event: "GDP (QoQ)",
    impact: "HIGH",
    forecast: "0.4%",
    previous: "0.2%",
    currency: "GBP"
  },
  {
    id: "5",
    time: "14:00",
    country: "Canada",
    flag: "🇨🇦",
    event: "Employment Change",
    impact: "MEDIUM",
    forecast: "25.0K",
    previous: "47.0K",
    currency: "CAD"
  },
  {
    id: "6",
    time: "15:00",
    country: "Australia",
    flag: "🇦🇺",
    event: "RBA Rate Decision",
    impact: "HIGH",
    forecast: "4.35%",
    previous: "4.35%",
    currency: "AUD"
  }
];

export const EconomicCalendar = () => {
  const [selectedEvent, setSelectedEvent] = useState<string | null>(null);

  const getImpactColor = (impact: string) => {
    switch (impact) {
      case "HIGH":
        return "bg-bearish text-bearish-foreground border-bearish/20";
      case "MEDIUM":
        return "bg-warning text-warning-foreground border-warning/20";
      default:
        return "bg-muted text-muted-foreground border-muted/20";
    }
  };

  const isEventSoon = (time: string) => {
    const now = new Date();
    const [hours, minutes] = time.split(':').map(Number);
    const eventTime = new Date();
    eventTime.setHours(hours, minutes, 0);
    
    const diffMinutes = (eventTime.getTime() - now.getTime()) / (1000 * 60);
    return diffMinutes <= 30 && diffMinutes >= 0;
  };

  const isEventPast = (time: string) => {
    const now = new Date();
    const [hours, minutes] = time.split(':').map(Number);
    const eventTime = new Date();
    eventTime.setHours(hours, minutes, 0);
    
    return eventTime.getTime() < now.getTime();
  };

  return (
    <Card className="p-6 bg-gradient-to-br from-card to-card/80 border-border/50">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-accent/10 rounded-lg">
            <Calendar className="w-5 h-5 text-accent" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-foreground">Economic Calendar</h2>
            <p className="text-muted-foreground text-sm">Today's market-moving events</p>
          </div>
        </div>
        <Badge variant="outline" className="text-xs">
          {new Date().toLocaleDateString()}
        </Badge>
      </div>

      <div className="space-y-3">
        {todayEvents.map((event) => (
          <div
            key={event.id}
            className={`p-4 rounded-lg border transition-all duration-300 cursor-pointer hover:bg-muted/30 ${
              selectedEvent === event.id ? "bg-muted/50 border-primary/30" : "bg-muted/20 border-border/30"
            } ${isEventSoon(event.time) ? "ring-2 ring-primary/30 animate-pulse-glow" : ""} ${
              isEventPast(event.time) ? "opacity-60" : ""
            }`}
            onClick={() => setSelectedEvent(selectedEvent === event.id ? null : event.id)}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="flex flex-col items-center">
                  <div className="flex items-center space-x-1">
                    <Clock className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm font-mono text-foreground">{event.time}</span>
                  </div>
                  {isEventSoon(event.time) && (
                    <Badge variant="outline" className="text-xs mt-1 bg-primary/10 text-primary border-primary/30">
                      Soon
                    </Badge>
                  )}
                </div>

                <div className="flex items-center space-x-3">
                  <span className="text-2xl">{event.flag}</span>
                  <div className="flex flex-col">
                    <span className="font-semibold text-foreground">{event.event}</span>
                    <span className="text-xs text-muted-foreground">{event.country}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-4">
                <Badge className={getImpactColor(event.impact)}>
                  {event.impact}
                </Badge>
                <Badge variant="outline" className="font-mono">
                  {event.currency}
                </Badge>
                <TrendingUp className="w-4 h-4 text-primary" />
              </div>
            </div>

            {selectedEvent === event.id && (
              <div className="mt-4 pt-4 border-t border-border/30 animate-fade-in">
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Forecast:</span>
                    <div className="font-mono text-foreground">{event.forecast}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Previous:</span>
                    <div className="font-mono text-foreground">{event.previous}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Actual:</span>
                    <div className="font-mono text-foreground">
                      {event.actual || "Pending"}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="mt-6 p-4 bg-accent/5 rounded-lg border border-accent/20">
        <div className="flex items-center space-x-2">
          <Flag className="w-4 h-4 text-accent" />
          <span className="text-sm text-accent font-medium">
            Next Major Event: Fed Chair Powell Speech in 2h 15m
          </span>
        </div>
      </div>
    </Card>
  );
};