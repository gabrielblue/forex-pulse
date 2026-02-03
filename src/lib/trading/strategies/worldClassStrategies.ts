import { TradingSignal } from '../signalProcessor';

export interface MarketCondition {
  volatility: number;
  trend: "BULLISH" | "BEARISH" | "SIDEWAYS";
  momentum: number;
  volume: number;
  sessionOverlap: boolean;
  newsImpact: "HIGH" | "MEDIUM" | "LOW";
}

export interface InstitutionalFlow {
  direction: "ACCUMULATION" | "DISTRIBUTION" | "NEUTRAL";
  strength: number;
  timeframe: string;
  confidence: number;
}

export interface AdvancedSignal extends TradingSignal {
  strategyName: string;
  marketCondition: MarketCondition;
  institutionalFlow?: InstitutionalFlow;
  chartPatterns: string[];
  confluenceFactors: string[];
  riskRewardRatio: number;
  probabilityOfSuccess: number;
  positionSize?: number;
}

export class WorldClassTradingStrategies {
  
  // 1. Renaissance Technologies Style - Statistical Arbitrage
  async renaissanceStatArb(marketData: any, indicators: any): Promise<AdvancedSignal | null> {
    const { prices, volumes } = marketData;
    const currentPrice = prices[prices.length - 1];
    
    // Calculate statistical measures
    const returns = this.calculateReturns(prices);
    const meanReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
    const stdDev = this.calculateStandardDeviation(returns, meanReturn);
    const zScore = (returns[returns.length - 1] - meanReturn) / stdDev;
    
    // Mean reversion signal when price deviates significantly
    if (Math.abs(zScore) > 2.5) {
      const direction = zScore > 0 ? "SELL" : "BUY";
      const confidence = Math.min(95, 70 + Math.abs(zScore) * 10);
      
      return {
        id: this.generateSignalId(),
        symbol: marketData.symbol,
        type: direction,
        confidence,
        entryPrice: currentPrice,
        stopLoss: direction === "BUY" ? currentPrice * 0.995 : currentPrice * 1.005,
        takeProfit: direction === "BUY" ? currentPrice * 1.01 : currentPrice * 0.99,
        timeframe: "15M",
        reasoning: `Statistical arbitrage: ${Math.abs(zScore).toFixed(2)} standard deviations from mean`,
        source: "Renaissance Statistical Model",
        strategyName: "Renaissance Statistical Arbitrage",
        marketCondition: this.assessMarketCondition(marketData, indicators),
        chartPatterns: ["Statistical Deviation"],
        confluenceFactors: [`Z-Score: ${zScore.toFixed(2)}`, "Mean Reversion Setup"],
        riskRewardRatio: 2.0,
        probabilityOfSuccess: confidence
      };
    }
    
    return null;
  }

  // 2. Citadel Style - Market Making with Momentum
  async citadelMarketMaking(marketData: any, indicators: any): Promise<AdvancedSignal | null> {
    const { prices, volumes } = marketData;
    const currentPrice = prices[prices.length - 1];
    const { rsi, macd, bollinger } = indicators;
    
    // Look for tight spreads and momentum confirmation
    const priceRange = Math.max(...prices.slice(-20)) - Math.min(...prices.slice(-20));
    const avgRange = priceRange / currentPrice;
    
    // Market making opportunity in low volatility with momentum
    if (avgRange < 0.005 && Math.abs(macd.value - macd.signal) > 0.0001) {
      const direction = macd.value > macd.signal ? "BUY" : "SELL";
      const volumeConfirmation = volumes[volumes.length - 1] > volumes.slice(-10).reduce((a, b) => a + b, 0) / 10;
      
      if (volumeConfirmation) {
        return {
          id: this.generateSignalId(),
          symbol: marketData.symbol,
          type: direction,
          confidence: 88,
          entryPrice: currentPrice,
          stopLoss: direction === "BUY" ? bollinger.lower : bollinger.upper,
          takeProfit: direction === "BUY" ? bollinger.upper : bollinger.lower,
          timeframe: "5M",
          reasoning: "Citadel market making: Low volatility with momentum and volume confirmation",
          source: "Citadel Market Making Model",
          strategyName: "Citadel Market Making",
          marketCondition: this.assessMarketCondition(marketData, indicators),
          chartPatterns: ["Range Compression", "Volume Spike"],
          confluenceFactors: ["MACD Momentum", "Volume Confirmation", "Bollinger Range"],
          riskRewardRatio: 1.5,
          probabilityOfSuccess: 88
        };
      }
    }
    
    return null;
  }

  // 3. Bridgewater Style - Macro Trend Following
  async bridgewaterMacroTrend(marketData: any, indicators: any): Promise<AdvancedSignal | null> {
    const { prices } = marketData;
    const currentPrice = prices[prices.length - 1];
    const { ema20, ema50, ema200, atr } = indicators;
    
    // Multi-timeframe trend alignment
    const shortTrend = ema20 > ema50;
    const mediumTrend = ema50 > ema200;
    const longTrend = currentPrice > ema200;
    
    // All trends aligned = strong signal
    if (shortTrend && mediumTrend && longTrend) {
      const trendStrength = ((ema20 - ema200) / ema200) * 100;
      
      if (Math.abs(trendStrength) > 1.0) { // 1% trend strength minimum
        return {
          id: this.generateSignalId(),
          symbol: marketData.symbol,
          type: "BUY",
          confidence: 92,
          entryPrice: currentPrice,
          stopLoss: ema50,
          takeProfit: currentPrice + (atr * 3),
          timeframe: "4H",
          reasoning: `Bridgewater macro trend: All timeframes aligned bullish, trend strength ${trendStrength.toFixed(1)}%`,
          source: "Bridgewater Macro Model",
          strategyName: "Bridgewater Macro Trend",
          marketCondition: this.assessMarketCondition(marketData, indicators),
          chartPatterns: ["Multi-Timeframe Alignment"],
          confluenceFactors: ["EMA Alignment", "Trend Strength", "Macro Direction"],
          riskRewardRatio: 3.0,
          probabilityOfSuccess: 92
        };
      }
    } else if (!shortTrend && !mediumTrend && !longTrend) {
      const trendStrength = ((ema200 - ema20) / ema200) * 100;
      
      if (Math.abs(trendStrength) > 1.0) {
        return {
          id: this.generateSignalId(),
          symbol: marketData.symbol,
          type: "SELL",
          confidence: 92,
          entryPrice: currentPrice,
          stopLoss: ema50,
          takeProfit: currentPrice - (atr * 3),
          timeframe: "4H",
          reasoning: `Bridgewater macro trend: All timeframes aligned bearish, trend strength ${trendStrength.toFixed(1)}%`,
          source: "Bridgewater Macro Model",
          strategyName: "Bridgewater Macro Trend",
          marketCondition: this.assessMarketCondition(marketData, indicators),
          chartPatterns: ["Multi-Timeframe Alignment"],
          confluenceFactors: ["EMA Alignment", "Trend Strength", "Macro Direction"],
          riskRewardRatio: 3.0,
          probabilityOfSuccess: 92
        };
      }
    }
    
    return null;
  }

  // 4. Two Sigma Style - Machine Learning Momentum
  async twoSigmaMomentum(marketData: any, indicators: any): Promise<AdvancedSignal | null> {
    const { prices, volumes } = marketData;
    const currentPrice = prices[prices.length - 1];
    
    // Calculate momentum factors
    const shortMomentum = this.calculateMomentum(prices, 5);
    const mediumMomentum = this.calculateMomentum(prices, 20);
    const longMomentum = this.calculateMomentum(prices, 50);
    
    // Volume-weighted momentum
    const volumeWeightedPrice = this.calculateVWAP(prices, volumes, 20);
    const vwapSignal = currentPrice > volumeWeightedPrice;
    
    // Machine learning style scoring
    let mlScore = 0;
    if (shortMomentum > 0.001) mlScore += 25;
    if (mediumMomentum > 0.0005) mlScore += 20;
    if (longMomentum > 0.0002) mlScore += 15;
    if (vwapSignal) mlScore += 20;
    if (indicators.rsi > 50 && indicators.rsi < 70) mlScore += 20;
    
    if (mlScore >= 80) {
      return {
        id: this.generateSignalId(),
        symbol: marketData.symbol,
        type: "BUY",
        confidence: mlScore,
        entryPrice: currentPrice,
        stopLoss: volumeWeightedPrice * 0.998,
        takeProfit: currentPrice * 1.008,
        timeframe: "1H",
        reasoning: `Two Sigma ML momentum: Multi-factor score ${mlScore}/100 with VWAP confirmation`,
        source: "Two Sigma ML Model",
        strategyName: "Two Sigma Machine Learning",
        marketCondition: this.assessMarketCondition(marketData, indicators),
        chartPatterns: ["Momentum Acceleration"],
        confluenceFactors: ["Multi-Timeframe Momentum", "VWAP Signal", "ML Score"],
        riskRewardRatio: 2.0,
        probabilityOfSuccess: mlScore
      };
    }
    
    return null;
  }

  // 5. DE Shaw Style - Quantitative Pairs Trading
  async deShawPairsTrading(marketData1: any, marketData2: any): Promise<AdvancedSignal | null> {
    // This would compare two correlated pairs for divergence
    const price1 = marketData1.prices[marketData1.prices.length - 1];
    const price2 = marketData2.prices[marketData2.prices.length - 1];
    
    // Calculate historical correlation and current spread
    const correlation = this.calculateCorrelation(marketData1.prices, marketData2.prices);
    const normalizedSpread = this.calculateNormalizedSpread(marketData1.prices, marketData2.prices);
    
    // Look for mean reversion opportunities
    if (Math.abs(normalizedSpread) > 2.0 && correlation > 0.7) {
      const direction = normalizedSpread > 0 ? "SELL" : "BUY";
      
      return {
        id: this.generateSignalId(),
        symbol: marketData1.symbol,
        type: direction,
        confidence: 85,
        entryPrice: price1,
        stopLoss: direction === "BUY" ? price1 * 0.997 : price1 * 1.003,
        takeProfit: direction === "BUY" ? price1 * 1.006 : price1 * 0.994,
        timeframe: "1H",
        reasoning: `DE Shaw pairs trading: Spread divergence ${normalizedSpread.toFixed(2)} std devs`,
        source: "DE Shaw Pairs Model",
        strategyName: "DE Shaw Quantitative Pairs",
        marketCondition: this.assessMarketCondition(marketData1, {}),
        chartPatterns: ["Pairs Divergence"],
        confluenceFactors: ["Correlation Breakdown", "Spread Reversion", "Statistical Edge"],
        riskRewardRatio: 2.0,
        probabilityOfSuccess: 85
      };
    }
    
    return null;
  }

  // 6. Goldman Sachs Style - Flow-Based Trading
  async goldmanSachsFlow(marketData: any, indicators: any, orderFlow: any): Promise<AdvancedSignal | null> {
    const { prices, volumes } = marketData;
    const currentPrice = prices[prices.length - 1];
    
    // Analyze order flow and institutional activity
    const buyVolume = orderFlow?.buyVolume || volumes[volumes.length - 1] * 0.6;
    const sellVolume = orderFlow?.sellVolume || volumes[volumes.length - 1] * 0.4;
    const flowImbalance = (buyVolume - sellVolume) / (buyVolume + sellVolume);
    
    // Large institutional flow detection
    const avgVolume = volumes.slice(-20).reduce((a, b) => a + b, 0) / 20;
    const volumeSpike = volumes[volumes.length - 1] > avgVolume * 2;
    
    if (Math.abs(flowImbalance) > 0.3 && volumeSpike) {
      const direction = flowImbalance > 0 ? "BUY" : "SELL";
      
      return {
        id: this.generateSignalId(),
        symbol: marketData.symbol,
        type: direction,
        confidence: 89,
        entryPrice: currentPrice,
        stopLoss: direction === "BUY" ? currentPrice * 0.996 : currentPrice * 1.004,
        takeProfit: direction === "BUY" ? currentPrice * 1.012 : currentPrice * 0.988,
        timeframe: "30M",
        reasoning: `Goldman flow analysis: ${Math.abs(flowImbalance * 100).toFixed(1)}% flow imbalance with volume spike`,
        source: "Goldman Sachs Flow Model",
        strategyName: "Goldman Sachs Institutional Flow",
        marketCondition: this.assessMarketCondition(marketData, indicators),
        institutionalFlow: {
          direction: flowImbalance > 0 ? "ACCUMULATION" : "DISTRIBUTION",
          strength: Math.abs(flowImbalance) * 100,
          timeframe: "30M",
          confidence: 89
        },
        chartPatterns: ["Institutional Flow"],
        confluenceFactors: ["Order Flow Imbalance", "Volume Spike", "Smart Money"],
        riskRewardRatio: 3.0,
        probabilityOfSuccess: 89
      };
    }
    
    return null;
  }

  // 7. Millennium Style - High-Frequency Mean Reversion
  async millenniumHFMeanReversion(marketData: any, indicators: any): Promise<AdvancedSignal | null> {
    const { prices } = marketData;
    const currentPrice = prices[prices.length - 1];
    
    // Ensure all indicators exist with fallback values
    const rsi = indicators.rsi || 50;
    const bollinger = indicators.bollinger || {
      upper: currentPrice * 1.01,
      middle: currentPrice,
      lower: currentPrice * 0.99
    };
    const stochastic = indicators.stochastic || { k: 50, d: 50 };
    
    // Multiple oversold/overbought confirmations
    const oversoldSignals = [
      rsi < 25,
      stochastic.k < 20,
      currentPrice < bollinger.lower,
      this.calculateWilliamsR(prices, 14) < -80
    ].filter(Boolean).length;
    
    const overboughtSignals = [
      rsi > 75,
      stochastic.k > 80,
      currentPrice > bollinger.upper,
      this.calculateWilliamsR(prices, 14) > -20
    ].filter(Boolean).length;
    
    if (oversoldSignals >= 3) {
      return {
        id: this.generateSignalId(),
        symbol: marketData.symbol,
        type: "BUY",
        confidence: 87,
        entryPrice: currentPrice,
        stopLoss: currentPrice * 0.9985,
        takeProfit: bollinger.middle,
        timeframe: "1M",
        reasoning: `Millennium HF mean reversion: ${oversoldSignals}/4 oversold indicators confirmed`,
        source: "Millennium HF Model",
        strategyName: "Millennium High-Frequency Mean Reversion",
        marketCondition: this.assessMarketCondition(marketData, indicators),
        chartPatterns: ["Multi-Indicator Oversold"],
        confluenceFactors: ["RSI Oversold", "Stochastic Oversold", "Bollinger Lower"],
        riskRewardRatio: 4.0,
        probabilityOfSuccess: 87
      };
    }
    
    if (overboughtSignals >= 3) {
      return {
        id: this.generateSignalId(),
        symbol: marketData.symbol,
        type: "SELL",
        confidence: 87,
        entryPrice: currentPrice,
        stopLoss: currentPrice * 1.0015,
        takeProfit: bollinger.middle,
        timeframe: "1M",
        reasoning: `Millennium HF mean reversion: ${overboughtSignals}/4 overbought indicators confirmed`,
        source: "Millennium HF Model",
        strategyName: "Millennium High-Frequency Mean Reversion",
        marketCondition: this.assessMarketCondition(marketData, indicators),
        chartPatterns: ["Multi-Indicator Overbought"],
        confluenceFactors: ["RSI Overbought", "Stochastic Overbought", "Bollinger Upper"],
        riskRewardRatio: 4.0,
        probabilityOfSuccess: 87
      };
    }
    
    return null;
  }

  // Add missing stochastic calculation method
  private calculateStochastic(prices: number[], period: number): { k: number; d: number } {
    if (prices.length < period) return { k: 50, d: 50 };
    
    const recentPrices = prices.slice(-period);
    const highest = Math.max(...recentPrices);
    const lowest = Math.min(...recentPrices);
    const current = prices[prices.length - 1];
    
    const k = ((current - lowest) / (highest - lowest)) * 100;
    const d = k * 0.9; // Simplified D% calculation
    
    return { k, d };
  }

  // 8. Jane Street Style - Volatility Trading
  async janeStreetVolatility(marketData: any, indicators: any): Promise<AdvancedSignal | null> {
    const { prices, volumes } = marketData;
    const currentPrice = prices[prices.length - 1];
    
    // Calculate realized vs implied volatility
    const realizedVol = this.calculateRealizedVolatility(prices, 20);
    const impliedVol = this.estimateImpliedVolatility(prices, volumes);
    const volSpread = impliedVol - realizedVol;
    
    // Volatility expansion/contraction signals
    if (Math.abs(volSpread) > 0.02) {
      const direction = volSpread > 0 ? "SELL" : "BUY"; // Sell high vol, buy low vol
      
      return {
        id: this.generateSignalId(),
        symbol: marketData.symbol,
        type: direction,
        confidence: 84,
        entryPrice: currentPrice,
        stopLoss: direction === "BUY" ? currentPrice * 0.994 : currentPrice * 1.006,
        takeProfit: direction === "BUY" ? currentPrice * 1.012 : currentPrice * 0.988,
        timeframe: "1H",
        reasoning: `Jane Street volatility: ${volSpread > 0 ? 'High' : 'Low'} vol environment, spread ${(volSpread * 100).toFixed(1)}%`,
        source: "Jane Street Volatility Model",
        strategyName: "Jane Street Volatility Trading",
        marketCondition: this.assessMarketCondition(marketData, indicators),
        chartPatterns: ["Volatility Divergence"],
        confluenceFactors: ["Vol Spread", "Realized vs Implied", "Market Regime"],
        riskRewardRatio: 2.0,
        probabilityOfSuccess: 84
      };
    }
    
    return null;
  }

  // 9. AQR Style - Momentum Factor
  async aqrMomentumFactor(marketData: any, indicators: any): Promise<AdvancedSignal | null> {
    const { prices } = marketData;
    const currentPrice = prices[prices.length - 1];
    
    // Multi-period momentum calculation
    const momentum1M = this.calculateMomentum(prices, 20);
    const momentum3M = this.calculateMomentum(prices, 60);
    const momentum6M = this.calculateMomentum(prices, 120);
    
    // Cross-sectional momentum ranking (simplified)
    const momentumScore = (momentum1M * 0.5) + (momentum3M * 0.3) + (momentum6M * 0.2);
    
    if (momentumScore > 0.005) { // Strong positive momentum
      return {
        id: this.generateSignalId(),
        symbol: marketData.symbol,
        type: "BUY",
        confidence: 86,
        entryPrice: currentPrice,
        stopLoss: currentPrice * 0.995,
        takeProfit: currentPrice * 1.015,
        timeframe: "1D",
        reasoning: `AQR momentum factor: Multi-period momentum score ${(momentumScore * 100).toFixed(2)}%`,
        source: "AQR Momentum Model",
        strategyName: "AQR Momentum Factor",
        marketCondition: this.assessMarketCondition(marketData, indicators),
        chartPatterns: ["Momentum Persistence"],
        confluenceFactors: ["1M Momentum", "3M Momentum", "6M Momentum"],
        riskRewardRatio: 3.0,
        probabilityOfSuccess: 86
      };
    }
    
    return null;
  }

  // 10. Man Group Style - Systematic CTA
  async manGroupCTA(marketData: any, indicators: any): Promise<AdvancedSignal | null> {
    const { prices } = marketData;
    const currentPrice = prices[prices.length - 1];
    const { ema20, ema50, atr } = indicators;

    // Systematic trend following with multiple confirmations
    const trendSignal = ema20 > ema50;
    const breakoutSignal = currentPrice > Math.max(...prices.slice(-20));
    const volatilityFilter = atr > this.calculateAverageATR(prices, 50) * 1.2;

    if (trendSignal && breakoutSignal && volatilityFilter) {
      return {
        id: this.generateSignalId(),
        symbol: marketData.symbol,
        type: "BUY",
        confidence: 83,
        entryPrice: currentPrice,
        stopLoss: ema20,
        takeProfit: currentPrice + (atr * 4),
        timeframe: "2H",
        reasoning: "Man Group CTA: Systematic trend + breakout + volatility expansion",
        source: "Man Group CTA Model",
        strategyName: "Man Group Systematic CTA",
        marketCondition: this.assessMarketCondition(marketData, indicators),
        chartPatterns: ["Trend Breakout"],
        confluenceFactors: ["EMA Trend", "Price Breakout", "Volatility Expansion"],
        riskRewardRatio: 4.0,
        probabilityOfSuccess: 83
      };
    }

    return null;
  }

  // 11. Micro-Timeframe Scalping - 1M Timeframe (3-5 pip targets)
  async microScalping1M(marketData: any, indicators: any, tickData?: any[]): Promise<AdvancedSignal | null> {
    const { prices } = marketData;
    const currentPrice = prices[prices.length - 1];

    // Millisecond-precision timing
    const currentTime = Date.now();
    const lastTickTime = tickData?.[tickData.length - 1]?.timestamp || currentTime;

    // Lightning momentum detection (sub-second analysis)
    const lightningMomentum = this.calculateLightningMomentum(tickData || [], 100); // Last 100 ticks

    // Micro-volatility calculation
    const microVol = this.calculateMicroVolatility(prices, 5);

    // Tick-level analysis
    const tickVelocity = this.calculateTickVelocity(tickData || [], 50);
    const tickAcceleration = this.calculateTickAcceleration(tickData || [], 30);

    // Scalping conditions: High momentum + low volatility + tick acceleration
    if (Math.abs(lightningMomentum) > 0.0002 && microVol < 0.0005 && Math.abs(tickAcceleration) > 0.00001) {
      const direction = lightningMomentum > 0 ? "BUY" : "SELL";
      const pipTarget = direction === "BUY" ? 0.0004 : -0.0004; // 4 pips target
      const pipStop = direction === "BUY" ? -0.0002 : 0.0002; // 2 pips stop

      return {
        id: this.generateSignalId(),
        symbol: marketData.symbol,
        type: direction,
        confidence: 82,
        entryPrice: currentPrice,
        stopLoss: currentPrice + pipStop,
        takeProfit: currentPrice + pipTarget,
        timeframe: "1M",
        reasoning: `Micro-scalping 1M: Lightning momentum ${(lightningMomentum * 10000).toFixed(1)} pips, tick accel ${(tickAcceleration * 100000).toFixed(1)}`,
        source: "Micro-Timeframe Scalping Engine",
        strategyName: "1M Lightning Scalp",
        marketCondition: this.assessMarketCondition(marketData, indicators),
        chartPatterns: ["Lightning Momentum"],
        confluenceFactors: ["Tick Acceleration", "Micro-Volatility", "Millisecond Precision"],
        riskRewardRatio: 2.0,
        probabilityOfSuccess: 82
      };
    }

    return null;
  }

  // 12. Micro-Timeframe Scalping - 5M Timeframe (5-8 pip targets)
  async microScalping5M(marketData: any, indicators: any, tickData?: any[]): Promise<AdvancedSignal | null> {
    const { prices } = marketData;
    const currentPrice = prices[prices.length - 1];

    // Extended momentum analysis for 5M
    const momentum5M = this.calculateMomentum(prices, 5);
    const lightningMomentum = this.calculateLightningMomentum(tickData || [], 500); // Last 500 ticks

    // Micro-volatility with longer lookback
    const microVol = this.calculateMicroVolatility(prices, 10);

    // Volume analysis for scalping
    const tickVolume = this.calculateTickVolume(tickData || [], 100);
    const volumeSpike = tickVolume > this.calculateAverageTickVolume(tickData || [], 500) * 1.5;

    // Scalping conditions: Momentum + volume confirmation + volatility filter
    if (Math.abs(momentum5M) > 0.0003 && volumeSpike && microVol < 0.0008) {
      const direction = momentum5M > 0 ? "BUY" : "SELL";
      const pipTarget = direction === "BUY" ? 0.0007 : -0.0007; // 7 pips target
      const pipStop = direction === "BUY" ? -0.0003 : 0.0003; // 3 pips stop

      return {
        id: this.generateSignalId(),
        symbol: marketData.symbol,
        type: direction,
        confidence: 85,
        entryPrice: currentPrice,
        stopLoss: currentPrice + pipStop,
        takeProfit: currentPrice + pipTarget,
        timeframe: "5M",
        reasoning: `Micro-scalping 5M: Momentum ${(momentum5M * 10000).toFixed(1)} pips, volume spike ${volumeSpike}, micro-vol ${(microVol * 10000).toFixed(1)}`,
        source: "Micro-Timeframe Scalping Engine",
        strategyName: "5M Momentum Scalp",
        marketCondition: this.assessMarketCondition(marketData, indicators),
        chartPatterns: ["Momentum Spike"],
        confluenceFactors: ["Volume Confirmation", "Micro-Volatility", "5M Momentum"],
        riskRewardRatio: 2.3,
        probabilityOfSuccess: 85
      };
    }

    return null;
  }

  // 13. Tick-Level Analysis Engine
  async tickLevelAnalysis(marketData: any, tickData: any[]): Promise<AdvancedSignal | null> {
    if (!tickData || tickData.length < 100) return null;

    const currentPrice = marketData.prices[marketData.prices.length - 1];

    // Millisecond-precision analysis
    const tickVelocity = this.calculateTickVelocity(tickData, 20);
    const tickAcceleration = this.calculateTickAcceleration(tickData, 10);
    const tickVolatility = this.calculateTickVolatility(tickData, 50);

    // Lightning momentum detection
    const lightningMomentum = this.calculateLightningMomentum(tickData, 50);

    // Micro-trend detection
    const microTrend = this.detectMicroTrend(tickData, 30);

    // Scalping signal generation
    if (Math.abs(tickAcceleration) > 0.00002 && Math.abs(lightningMomentum) > 0.0003 && tickVolatility < 0.001) {
      const direction = lightningMomentum > 0 ? "BUY" : "SELL";
      const pipTarget = direction === "BUY" ? 0.0005 : -0.0005; // 5 pips
      const pipStop = direction === "BUY" ? -0.0002 : 0.0002; // 2 pips

      return {
        id: this.generateSignalId(),
        symbol: marketData.symbol,
        type: direction,
        confidence: 80,
        entryPrice: currentPrice,
        stopLoss: currentPrice + pipStop,
        takeProfit: currentPrice + pipTarget,
        timeframe: "30s",
        reasoning: `Tick-level analysis: Acceleration ${(tickAcceleration * 100000).toFixed(1)}, momentum ${(lightningMomentum * 10000).toFixed(1)} pips`,
        source: "Tick-Level Analysis Engine",
        strategyName: "Tick-Level Scalp",
        marketCondition: this.assessMarketCondition(marketData, {}),
        chartPatterns: ["Tick Acceleration"],
        confluenceFactors: ["Lightning Momentum", "Micro-Trend", "Tick Volatility"],
        riskRewardRatio: 2.5,
        probabilityOfSuccess: 80
      };
    }

    return null;
  }

  // 14. Lightning Momentum Detection
  async lightningMomentumScalp(marketData: any, tickData: any[]): Promise<AdvancedSignal | null> {
    if (!tickData || tickData.length < 50) return null;

    const currentPrice = marketData.prices[marketData.prices.length - 1];

    // Calculate lightning momentum (rapid price changes in milliseconds)
    const lightningMomentum = this.calculateLightningMomentum(tickData, 25);
    const momentumSustain = this.calculateMomentumSustain(tickData, 10);

    // Detect explosive moves
    const explosiveMove = Math.abs(lightningMomentum) > 0.0005 && momentumSustain > 0.8;

    if (explosiveMove) {
      const direction = lightningMomentum > 0 ? "BUY" : "SELL";
      const pipTarget = direction === "BUY" ? 0.0006 : -0.0006; // 6 pips
      const pipStop = direction === "BUY" ? -0.00025 : 0.00025; // 2.5 pips

      return {
        id: this.generateSignalId(),
        symbol: marketData.symbol,
        type: direction,
        confidence: 88,
        entryPrice: currentPrice,
        stopLoss: currentPrice + pipStop,
        takeProfit: currentPrice + pipTarget,
        timeframe: "1M",
        reasoning: `Lightning momentum: Explosive move ${(lightningMomentum * 10000).toFixed(1)} pips, sustain ${(momentumSustain * 100).toFixed(1)}%`,
        source: "Lightning Momentum Engine",
        strategyName: "Lightning Momentum Scalp",
        marketCondition: this.assessMarketCondition(marketData, {}),
        chartPatterns: ["Explosive Momentum"],
        confluenceFactors: ["Lightning Speed", "Momentum Sustain", "Micro-Explosion"],
        riskRewardRatio: 2.4,
        probabilityOfSuccess: 88
      };
    }

    return null;
  }

  // 15. Micro-Volatility Scalping
  async microVolatilityScalp(marketData: any, indicators: any, tickData?: any[]): Promise<AdvancedSignal | null> {
    const { prices } = marketData;
    const currentPrice = prices[prices.length - 1];

    // Calculate micro-volatility
    const microVol = this.calculateMicroVolatility(prices, 3);
    const volExpansion = this.calculateVolatilityExpansion(tickData || [], 20);

    // Look for volatility contraction followed by expansion
    const volContraction = microVol < 0.0003;
    const tickVolSpike = volExpansion > 1.8;

    // RSI for timing
    const rsi = indicators.rsi || 50;

    if (volContraction && tickVolSpike && (rsi < 35 || rsi > 65)) {
      const direction = rsi < 35 ? "BUY" : "SELL";
      const pipTarget = direction === "BUY" ? 0.00045 : -0.00045; // 4.5 pips
      const pipStop = direction === "BUY" ? -0.0002 : 0.0002; // 2 pips

      return {
        id: this.generateSignalId(),
        symbol: marketData.symbol,
        type: direction,
        confidence: 81,
        entryPrice: currentPrice,
        stopLoss: currentPrice + pipStop,
        takeProfit: currentPrice + pipTarget,
        timeframe: "30s",
        reasoning: `Micro-volatility scalp: Contraction ${(microVol * 10000).toFixed(1)} pips, expansion ${(volExpansion).toFixed(1)}x, RSI ${rsi.toFixed(1)}`,
        source: "Micro-Volatility Engine",
        strategyName: "Micro-Volatility Scalp",
        marketCondition: this.assessMarketCondition(marketData, indicators),
        chartPatterns: ["Volatility Spike"],
        confluenceFactors: ["Vol Contraction", "Expansion Signal", "RSI Timing"],
        riskRewardRatio: 2.25,
        probabilityOfSuccess: 81
      };
    }

    return null;
  }

  // 16. 30s Timeframe Analysis
  async thirtySecondAnalysis(marketData: any, indicators: any, tickData?: any[]): Promise<AdvancedSignal | null> {
    const { prices } = marketData;
    const currentPrice = prices[prices.length - 1];

    // 30-second momentum
    const thirtySecMomentum = this.calculateMomentum(prices, 1); // Assuming 30s candles

    // Tick-level confirmation
    const tickMomentum = this.calculateLightningMomentum(tickData || [], 30);
    const tickVolume = this.calculateTickVolume(tickData || [], 30);

    // Micro-trend alignment
    const microTrend = this.detectMicroTrend(tickData || [], 15);
    const volumeThreshold = tickVolume > this.calculateAverageTickVolume(tickData || [], 100);

    if (Math.abs(thirtySecMomentum) > 0.0002 && Math.abs(tickMomentum) > 0.0001 && volumeThreshold) {
      const direction = thirtySecMomentum > 0 ? "BUY" : "SELL";
      const pipTarget = direction === "BUY" ? 0.00035 : -0.00035; // 3.5 pips
      const pipStop = direction === "BUY" ? -0.00015 : 0.00015; // 1.5 pips

      return {
        id: this.generateSignalId(),
        symbol: marketData.symbol,
        type: direction,
        confidence: 79,
        entryPrice: currentPrice,
        stopLoss: currentPrice + pipStop,
        takeProfit: currentPrice + pipTarget,
        timeframe: "30s",
        reasoning: `30s analysis: Momentum ${(thirtySecMomentum * 10000).toFixed(1)} pips, tick confirm ${(tickMomentum * 10000).toFixed(1)} pips`,
        source: "30-Second Analysis Engine",
        strategyName: "30s Micro-Analysis",
        marketCondition: this.assessMarketCondition(marketData, indicators),
        chartPatterns: ["30s Momentum"],
        confluenceFactors: ["Tick Confirmation", "Volume Threshold", "Micro-Trend"],
        riskRewardRatio: 2.3,
        probabilityOfSuccess: 79
      };
    }

    return null;
  }

  // Utility Functions
  private calculateReturns(prices: number[]): number[] {
    const returns = [];
    for (let i = 1; i < prices.length; i++) {
      returns.push((prices[i] - prices[i-1]) / prices[i-1]);
    }
    return returns;
  }

  private calculateStandardDeviation(values: number[], mean: number): number {
    const squaredDiffs = values.map(value => Math.pow(value - mean, 2));
    const avgSquaredDiff = squaredDiffs.reduce((a, b) => a + b, 0) / squaredDiffs.length;
    return Math.sqrt(avgSquaredDiff);
  }

  private calculateMomentum(prices: number[], period: number): number {
    if (prices.length < period + 1) return 0;
    const current = prices[prices.length - 1];
    const past = prices[prices.length - 1 - period];
    return (current - past) / past;
  }

  private calculateVWAP(prices: number[], volumes: number[], period: number): number {
    if (prices.length < period) return prices[prices.length - 1];
    
    let totalVolume = 0;
    let totalVolumePrice = 0;
    
    for (let i = prices.length - period; i < prices.length; i++) {
      totalVolume += volumes[i];
      totalVolumePrice += prices[i] * volumes[i];
    }
    
    return totalVolumePrice / totalVolume;
  }

  private calculateCorrelation(prices1: number[], prices2: number[]): number {
    const returns1 = this.calculateReturns(prices1);
    const returns2 = this.calculateReturns(prices2);
    
    if (returns1.length !== returns2.length) return 0;
    
    const mean1 = returns1.reduce((a, b) => a + b, 0) / returns1.length;
    const mean2 = returns2.reduce((a, b) => a + b, 0) / returns2.length;
    
    let numerator = 0;
    let sum1Sq = 0;
    let sum2Sq = 0;
    
    for (let i = 0; i < returns1.length; i++) {
      const diff1 = returns1[i] - mean1;
      const diff2 = returns2[i] - mean2;
      numerator += diff1 * diff2;
      sum1Sq += diff1 * diff1;
      sum2Sq += diff2 * diff2;
    }

    // Prevent division by zero
    const denominator = Math.sqrt(sum1Sq * sum2Sq);
    if (denominator === 0) return 0;

    return numerator / denominator;
  }

  private calculateNormalizedSpread(prices1: number[], prices2: number[]): number {
    const ratio = prices1[prices1.length - 1] / prices2[prices2.length - 1];
    const historicalRatios = [];
    
    for (let i = 0; i < Math.min(prices1.length, prices2.length); i++) {
      historicalRatios.push(prices1[i] / prices2[i]);
    }
    
    const meanRatio = historicalRatios.reduce((a, b) => a + b, 0) / historicalRatios.length;
    const stdDev = this.calculateStandardDeviation(historicalRatios, meanRatio);
    
    return (ratio - meanRatio) / stdDev;
  }

  private calculateRealizedVolatility(prices: number[], period: number): number {
    const returns = this.calculateReturns(prices.slice(-period));
    const meanReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((sum, ret) => sum + Math.pow(ret - meanReturn, 2), 0) / returns.length;
    return Math.sqrt(variance * 252); // Annualized
  }

  private estimateImpliedVolatility(prices: number[], volumes: number[]): number {
    // Simplified implied volatility estimation
    const priceChanges = this.calculateReturns(prices.slice(-20));
    const volumeWeightedVol = priceChanges.reduce((sum, change, i) => {
      const weight = volumes[volumes.length - 20 + i] || 1;
      return sum + Math.abs(change) * weight;
    }, 0) / volumes.slice(-20).reduce((a, b) => a + b, 0);
    
    return volumeWeightedVol * Math.sqrt(252);
  }

  private calculateWilliamsR(prices: number[], period: number): number {
    if (prices.length < period) return -50;
    
    const recentPrices = prices.slice(-period);
    const highest = Math.max(...recentPrices);
    const lowest = Math.min(...recentPrices);
    const current = prices[prices.length - 1];
    
    return ((highest - current) / (highest - lowest)) * -100;
  }

  private calculateAverageATR(prices: number[], period: number): number {
    // Simplified ATR calculation
    let atrSum = 0;
    for (let i = 1; i < Math.min(period, prices.length); i++) {
      atrSum += Math.abs(prices[prices.length - i] - prices[prices.length - i - 1]);
    }
    return atrSum / Math.min(period - 1, prices.length - 1);
  }

  // New utility functions for scalping strategies

  private calculateLightningMomentum(tickData: any[], period: number): number {
    if (!tickData || tickData.length < period) return 0;

    const recentTicks = tickData.slice(-period);
    const firstPrice = recentTicks[0].price;
    const lastPrice = recentTicks[recentTicks.length - 1].price;

    // Calculate momentum with millisecond weighting
    let weightedMomentum = 0;
    let totalWeight = 0;

    for (let i = 1; i < recentTicks.length; i++) {
      const timeDiff = recentTicks[i].timestamp - recentTicks[i-1].timestamp;
      const priceDiff = recentTicks[i].price - recentTicks[i-1].price;
      const weight = 1 / (timeDiff + 1); // Higher weight for faster changes

      weightedMomentum += priceDiff * weight;
      totalWeight += weight;
    }

    return totalWeight > 0 ? weightedMomentum / totalWeight : (lastPrice - firstPrice) / firstPrice;
  }

  private calculateMicroVolatility(prices: number[], period: number): number {
    if (prices.length < period) return 0;

    const recentPrices = prices.slice(-period);
    const returns = [];

    for (let i = 1; i < recentPrices.length; i++) {
      returns.push(Math.abs(recentPrices[i] - recentPrices[i-1]) / recentPrices[i-1]);
    }

    const meanReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((sum, ret) => sum + Math.pow(ret - meanReturn, 2), 0) / returns.length;

    return Math.sqrt(variance);
  }

  private calculateTickVelocity(tickData: any[], period: number): number {
    if (!tickData || tickData.length < period) return 0;

    const recentTicks = tickData.slice(-period);
    let totalVelocity = 0;

    for (let i = 1; i < recentTicks.length; i++) {
      const timeDiff = (recentTicks[i].timestamp - recentTicks[i-1].timestamp) / 1000; // seconds
      const priceDiff = recentTicks[i].price - recentTicks[i-1].price;
      const velocity = priceDiff / timeDiff; // price change per second

      totalVelocity += velocity;
    }

    return totalVelocity / (recentTicks.length - 1);
  }

  private calculateTickAcceleration(tickData: any[], period: number): number {
    if (!tickData || tickData.length < period + 1) return 0;

    const velocities = [];
    for (let i = 1; i <= period; i++) {
      velocities.push(this.calculateTickVelocity(tickData.slice(0, tickData.length - period + i), period));
    }

    let acceleration = 0;
    for (let i = 1; i < velocities.length; i++) {
      acceleration += velocities[i] - velocities[i-1];
    }

    return acceleration / (velocities.length - 1);
  }

  private calculateTickVolatility(tickData: any[], period: number): number {
    if (!tickData || tickData.length < period) return 0;

    const recentTicks = tickData.slice(-period);
    const priceChanges = [];

    for (let i = 1; i < recentTicks.length; i++) {
      priceChanges.push(Math.abs(recentTicks[i].price - recentTicks[i-1].price));
    }

    const meanChange = priceChanges.reduce((a, b) => a + b, 0) / priceChanges.length;
    const variance = priceChanges.reduce((sum, change) => sum + Math.pow(change - meanChange, 2), 0) / priceChanges.length;

    return Math.sqrt(variance);
  }

  private detectMicroTrend(tickData: any[], period: number): number {
    if (!tickData || tickData.length < period) return 0;

    const recentTicks = tickData.slice(-period);
    let upMoves = 0;
    let downMoves = 0;

    for (let i = 1; i < recentTicks.length; i++) {
      if (recentTicks[i].price > recentTicks[i-1].price) upMoves++;
      else if (recentTicks[i].price < recentTicks[i-1].price) downMoves++;
    }

    return (upMoves - downMoves) / period; // Positive for uptrend, negative for downtrend
  }

  private calculateTickVolume(tickData: any[], period: number): number {
    if (!tickData || tickData.length < period) return 0;

    const recentTicks = tickData.slice(-period);
    return recentTicks.reduce((sum, tick) => sum + (tick.volume || 1), 0);
  }

  private calculateAverageTickVolume(tickData: any[], period: number): number {
    if (!tickData || tickData.length < period) return 1;

    const volumes = tickData.slice(-period).map(tick => tick.volume || 1);
    return volumes.reduce((a, b) => a + b, 0) / volumes.length;
  }

  private calculateMomentumSustain(tickData: any[], period: number): number {
    if (!tickData || tickData.length < period) return 0;

    const recentTicks = tickData.slice(-period);
    const initialDirection = recentTicks[1].price > recentTicks[0].price ? 1 : -1;
    let sustainedMoves = 0;

    for (let i = 2; i < recentTicks.length; i++) {
      const currentDirection = recentTicks[i].price > recentTicks[i-1].price ? 1 : -1;
      if (currentDirection === initialDirection) sustainedMoves++;
    }

    return sustainedMoves / (period - 1);
  }

  private calculateVolatilityExpansion(tickData: any[], period: number): number {
    if (!tickData || tickData.length < period * 2) return 1;

    const recentVol = this.calculateTickVolatility(tickData.slice(-period), period);
    const previousVol = this.calculateTickVolatility(tickData.slice(-period * 2, -period), period);

    return previousVol > 0 ? recentVol / previousVol : 1;
  }


  private assessMarketCondition(marketData: any, indicators: any): MarketCondition {
    const { prices = [], volumes = [] } = marketData;
    
    // Safety check: if prices/volumes are invalid, return neutral condition
    if (!prices || prices.length < 2 || !volumes || volumes.length === 0) {
      return {
        volatility: 0,
        trend: "SIDEWAYS",
        momentum: 0,
        volume: 1,
        sessionOverlap: this.isSessionOverlap(),
        newsImpact: this.assessNewsImpact()
      };
    }
    
    const volatility = this.calculateRealizedVolatility(prices, 20);
    const avgVolume = volumes.slice(-20).reduce((a, b) => a + b, 0) / 20;
    const currentVolume = volumes[volumes.length - 1];
    
    return {
      volatility: volatility * 100,
      trend: indicators?.ema20 > indicators?.ema50 ? "BULLISH" : 
             indicators?.ema20 < indicators?.ema50 ? "BEARISH" : "SIDEWAYS",
      momentum: Math.abs(this.calculateMomentum(prices, 10)) * 100,
      volume: avgVolume > 0 ? currentVolume / avgVolume : 1,
      sessionOverlap: this.isSessionOverlap(),
      newsImpact: this.assessNewsImpact()
    };
  }

  private isSessionOverlap(): boolean {
    const now = new Date();
    const hour = now.getUTCHours();
    
    // London-NY overlap (13:00-17:00 GMT) or Tokyo-London overlap (08:00-09:00 GMT)
    return (hour >= 13 && hour <= 17) || (hour >= 8 && hour <= 9);
  }

  private assessNewsImpact(): "HIGH" | "MEDIUM" | "LOW" {
    // Simplified news impact assessment
    const hour = new Date().getUTCHours();
    
    // High impact during major news times
    if ((hour >= 8 && hour <= 10) || (hour >= 13 && hour <= 15)) {
      return "HIGH";
    } else if (hour >= 12 && hour <= 16) {
      return "MEDIUM";
    }
    return "LOW";
  }

  private generateSignalId(): string {
    // Generate a unique ID using timestamp and performance metrics for uniqueness
    const timestamp = Date.now();
    const perfNow = typeof performance !== 'undefined' ? performance.now().toString(36).replace('.', '') : '';
    const counter = (++this.signalCounter).toString(36);
    const processId = typeof process !== 'undefined' ? (process.pid || 0).toString(36) : '';
    return `elite_${timestamp}_${perfNow}_${counter}_${processId}`;
  }

  private signalCounter = 0;

  // Master Strategy Combiner
  async deployEliteStrategyCombination(marketData: any, indicators: any, tickData?: any[]): Promise<AdvancedSignal[]> {
    const signals: AdvancedSignal[] = [];

    // Run all elite strategies including new scalping strategies
    const strategies = [
      () => this.renaissanceStatArb(marketData, indicators),
      () => this.citadelMarketMaking(marketData, indicators),
      () => this.bridgewaterMacroTrend(marketData, indicators),
      () => this.twoSigmaMomentum(marketData, indicators),
      () => this.millenniumHFMeanReversion(marketData, indicators),
      () => this.janeStreetVolatility(marketData, indicators),
      () => this.aqrMomentumFactor(marketData, indicators),
      () => this.goldmanSachsFlow(marketData, indicators, null),
      // New scalping strategies
      () => this.microScalping1M(marketData, indicators, tickData),
      () => this.microScalping5M(marketData, indicators, tickData),
      () => this.tickLevelAnalysis(marketData, tickData),
      () => this.lightningMomentumScalp(marketData, tickData),
      () => this.microVolatilityScalp(marketData, indicators, tickData),
      () => this.thirtySecondAnalysis(marketData, indicators, tickData)
    ];

    for (const strategy of strategies) {
      try {
        const signal = await strategy();
        if (signal && signal.confidence > 75) { // Lower threshold for scalping strategies
          signals.push(signal);
        }
      } catch (error) {
        console.error('Strategy execution error:', error);
      }
    }

    return signals;
  }
}

export const worldClassStrategies = new WorldClassTradingStrategies();
