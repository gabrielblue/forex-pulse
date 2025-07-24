import { Navigation } from "@/components/Navigation";
import { CurrencyPairsTable } from "@/components/CurrencyPairsTable";
import { NewsAlertsCard } from "@/components/NewsAlertsCard";
import { EconomicCalendar } from "@/components/EconomicCalendar";
import { PredictionsCard } from "@/components/PredictionsCard";
import { TradingBotDashboard } from "@/components/TradingBotDashboard";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <Navigation />
      
      {/* Main Dashboard */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Hero Section */}
        <div className="mb-8">
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/10 via-accent/5 to-primary/5 p-8 border border-border/50">
            <div className="relative z-10">
              <h1 className="text-4xl lg:text-5xl font-bold text-foreground mb-4">
                Professional Forex Analytics
              </h1>
              <p className="text-xl text-muted-foreground mb-6 max-w-2xl">
                AI-powered currency predictions, real-time market data, and comprehensive economic insights 
                for professional traders and analysts.
              </p>
              <div className="flex flex-wrap gap-4">
                <div className="flex items-center space-x-2 px-4 py-2 bg-bullish/10 rounded-lg border border-bullish/20">
                  <div className="w-2 h-2 bg-bullish rounded-full animate-pulse"></div>
                  <span className="text-sm text-bullish font-medium">Live Market Data</span>
                </div>
                <div className="flex items-center space-x-2 px-4 py-2 bg-primary/10 rounded-lg border border-primary/20">
                  <div className="w-2 h-2 bg-primary rounded-full animate-pulse"></div>
                  <span className="text-sm text-primary font-medium">AI Predictions Active</span>
                </div>
                <div className="flex items-center space-x-2 px-4 py-2 bg-accent/10 rounded-lg border border-accent/20">
                  <div className="w-2 h-2 bg-accent rounded-full animate-pulse"></div>
                  <span className="text-sm text-accent font-medium">Economic Calendar</span>
                </div>
              </div>
            </div>
            {/* Background Decoration */}
            <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-bl from-primary/20 to-transparent rounded-full blur-3xl"></div>
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-gradient-to-tr from-accent/20 to-transparent rounded-full blur-2xl"></div>
          </div>
        </div>

        {/* Trading Bot Dashboard */}
        <div className="mb-8">
          <TradingBotDashboard />
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Currency Pairs */}
          <div className="lg:col-span-2 space-y-8">
            <CurrencyPairsTable />
            <PredictionsCard />
          </div>

          {/* Right Column - News & Calendar */}
          <div className="space-y-8">
            <NewsAlertsCard />
            <EconomicCalendar />
          </div>
        </div>

        {/* Footer Stats */}
        <div className="mt-12 grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="p-6 rounded-lg bg-gradient-to-br from-card to-card/80 border border-border/50">
            <div className="text-2xl font-bold text-bullish">94.7%</div>
            <div className="text-sm text-muted-foreground">AI Accuracy (30d)</div>
          </div>
          <div className="p-6 rounded-lg bg-gradient-to-br from-card to-card/80 border border-border/50">
            <div className="text-2xl font-bold text-foreground">28</div>
            <div className="text-sm text-muted-foreground">Currency Pairs</div>
          </div>
          <div className="p-6 rounded-lg bg-gradient-to-br from-card to-card/80 border border-border/50">
            <div className="text-2xl font-bold text-accent">24/7</div>
            <div className="text-sm text-muted-foreground">Market Monitoring</div>
          </div>
          <div className="p-6 rounded-lg bg-gradient-to-br from-card to-card/80 border border-border/50">
            <div className="text-2xl font-bold text-primary">15</div>
            <div className="text-sm text-muted-foreground">Data Sources</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
