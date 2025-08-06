import { useState } from "react";
import { Navigation } from "@/components/Navigation";
import { TradingBotDashboard } from "@/components/TradingBotDashboard";
import { LiveTradingDashboard } from "@/components/LiveTradingDashboard";
import { AIPredictionSystem } from "@/components/AIPredictionSystem";
import { AdvancedTradingControls } from "@/components/AdvancedTradingControls";
import { PredictionsCard } from "@/components/PredictionsCard";
import { EnhancedSignalsSystem } from "@/components/EnhancedSignalsSystem";
import { StrategyControls } from "@/components/StrategyControls";
import { ComprehensiveAnalysisDashboard } from "@/components/ComprehensiveAnalysisDashboard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function Index() {
  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      
      <main className="container mx-auto px-4 py-8">
        <div className="space-y-8">
          <div className="text-center space-y-4">
            <h1 className="text-4xl font-bold tracking-tight">
              World-Class Trading Bot Platform
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Professional-grade automated trading with advanced chart analysis, 
              multi-timeframe intelligence, and world's best trading strategies.
            </p>
          </div>

          <Tabs defaultValue="analysis" className="space-y-6">
            <TabsList className="grid w-full grid-cols-7">
              <TabsTrigger value="analysis">Analysis</TabsTrigger>
              <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
              <TabsTrigger value="live">Live Trading</TabsTrigger>
              <TabsTrigger value="ai">AI Predictions</TabsTrigger>
              <TabsTrigger value="signals">Signals</TabsTrigger>
              <TabsTrigger value="strategy">Strategy</TabsTrigger>
              <TabsTrigger value="controls">Controls</TabsTrigger>
            </TabsList>

            <TabsContent value="analysis" className="space-y-6">
              <ComprehensiveAnalysisDashboard />
            </TabsContent>

            <TabsContent value="dashboard" className="space-y-6">
              <TradingBotDashboard />
            </TabsContent>

            <TabsContent value="live" className="space-y-6">
              <LiveTradingDashboard />
            </TabsContent>

            <TabsContent value="ai" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <AIPredictionSystem />
                <PredictionsCard />
              </div>
            </TabsContent>

            <TabsContent value="signals" className="space-y-6">
              <EnhancedSignalsSystem />
            </TabsContent>

            <TabsContent value="strategy" className="space-y-6">
              <StrategyControls />
            </TabsContent>

            <TabsContent value="controls" className="space-y-6">
              <AdvancedTradingControls />
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
}


