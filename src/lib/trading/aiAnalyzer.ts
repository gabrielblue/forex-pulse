import { supabase } from '@/integrations/supabase/client';

export interface MarketAnalysisInput {
  symbol: string;
  timeframe: string;
  marketData: {
    currentPrice: number;
    bid: number;
    ask: number;
    spread: number;
    high?: number;
    low?: number;
    change?: number;
  };
  technicalIndicators: {
    rsi?: number;
    macd?: number;
    ema20?: number;
    ema50?: number;
    atr?: number;
    volume?: number;
  };
}

export interface AIAnalysisResult {
  regime: 'TRENDING_BULLISH' | 'TRENDING_BEARISH' | 'RANGING' | 'VOLATILE' | 'CONSOLIDATING';
  signal: 'BUY' | 'SELL' | 'HOLD';
  confidence: number;
  reasoning: string;
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  supportLevels?: number[];
  resistanceLevels?: number[];
  patterns?: string[];
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  positionSizeRecommendation: 'SMALL' | 'MEDIUM' | 'LARGE';
}

class AIAnalyzer {
  private analysisCache: Map<string, { result: AIAnalysisResult; timestamp: number }> = new Map();
  private cacheDuration = 60000; // 1 minute cache
  private requestQueue: Map<string, number> = new Map(); // Track last request time per symbol
  private minRequestInterval = 2000; // 2 seconds between requests per symbol
  private retryDelays = [1000, 2000, 5000, 10000]; // Exponential backoff delays

  async analyzeMarket(input: MarketAnalysisInput): Promise<AIAnalysisResult> {
    const cacheKey = `${input.symbol}_${input.timeframe}`;
    const cached = this.analysisCache.get(cacheKey);

    // Return cached result if still fresh
    if (cached && Date.now() - cached.timestamp < this.cacheDuration) {
      console.log(`📊 Using cached AI analysis for ${cacheKey}`);
      return cached.result;
    }

    // Check rate limiting per symbol
    const lastRequestTime = this.requestQueue.get(cacheKey) || 0;
    const timeSinceLastRequest = Date.now() - lastRequestTime;

    if (timeSinceLastRequest < this.minRequestInterval) {
      // Too soon, return cached or fallback
      if (cached) {
        console.log(`⏱️ Rate limited - using cached analysis for ${cacheKey}`);
        return cached.result;
      }
      console.log(`⏱️ Rate limited - using fallback for ${cacheKey}`);
      return this.getFallbackAnalysis(input);
    }

    // Try with exponential backoff
    for (let attempt = 0; attempt < this.retryDelays.length; attempt++) {
      try {
        console.log(`🤖 Requesting AI analysis for ${input.symbol} on ${input.timeframe}... (attempt ${attempt + 1})`);

        // Update request time
        this.requestQueue.set(cacheKey, Date.now());

        const { data, error } = await supabase.functions.invoke('analyze-market', {
          body: input
        });

        if (error) {
          // Check if it's a rate limit error (429)
          if (error.message?.includes('429') || error.message?.includes('Too Many Requests')) {
            console.warn(`⚠️ Rate limited (429) for ${cacheKey}, attempt ${attempt + 1}`);

            // If we have more retries, wait and try again
            if (attempt < this.retryDelays.length - 1) {
              const delay = this.retryDelays[attempt];
              console.log(`⏳ Waiting ${delay}ms before retry...`);
              await new Promise(resolve => setTimeout(resolve, delay));
              continue; // Try again
            }
          }

          console.error('AI analysis error:', error);
          throw error;
        }

        if (!data?.success || !data?.analysis) {
          throw new Error('Invalid AI response');
        }

        const analysis = data.analysis as AIAnalysisResult;

        // Validate analysis result
        if (!analysis || typeof analysis.confidence !== 'number' || !analysis.signal) {
          console.error(`Invalid analysis structure for ${cacheKey}:`, analysis);
          throw new Error('Invalid analysis structure');
        }

        // Cache the result
        this.analysisCache.set(cacheKey, {
          result: analysis,
          timestamp: Date.now()
        });

        console.log(`✅ AI Analysis complete for ${input.symbol}:`, {
          regime: analysis.regime,
          signal: analysis.signal,
          confidence: analysis.confidence,
          riskLevel: analysis.riskLevel
        });

        return analysis;
      } catch (error) {
        console.error(`Failed to get AI analysis (attempt ${attempt + 1}):`, error);

        // If we have more retries and it might be a transient error, try again
        if (attempt < this.retryDelays.length - 1) {
          const delay = this.retryDelays[attempt];
          console.log(`⏳ Waiting ${delay}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }

        // All retries exhausted, return fallback
        console.error('All retry attempts exhausted, using fallback analysis');
      }
    }

    // Return conservative fallback if all retries failed
    return this.getFallbackAnalysis(input);
  }

  private getFallbackAnalysis(input: MarketAnalysisInput): AIAnalysisResult {
    console.warn('⚠️ Using fallback analysis - AI unavailable');

    // Use technical indicators to make a basic decision
    const rsi = input.technicalIndicators.rsi || 50;
    const ema20 = input.technicalIndicators.ema20 || input.marketData.currentPrice;
    const ema50 = input.technicalIndicators.ema50 || input.marketData.currentPrice;
    const currentPrice = input.marketData.currentPrice;

    let signal: 'BUY' | 'SELL' | 'HOLD' = 'HOLD';
    let confidence = 0; // Default to HOLD with 0 confidence
    let reasoning = 'AI analysis unavailable. Using basic technical analysis fallback.';

    // Very conservative technical analysis
    // Only signal if indicators strongly agree (to avoid bad trades without AI)
    const isBullish = rsi < 40 && currentPrice > ema20 && ema20 > ema50;
    const isBearish = rsi > 60 && currentPrice < ema20 && ema20 < ema50;

    if (isBullish) {
      signal = 'BUY';
      confidence = 25; // Low confidence without AI
      reasoning = `Fallback: RSI oversold (${rsi.toFixed(1)}), price above EMA20, uptrend detected. AI unavailable - proceed with caution.`;
    } else if (isBearish) {
      signal = 'SELL';
      confidence = 25; // Low confidence without AI
      reasoning = `Fallback: RSI overbought (${rsi.toFixed(1)}), price below EMA20, downtrend detected. AI unavailable - proceed with caution.`;
    }

    const stopLossDistance = currentPrice * 0.01; // 1% stop loss
    const takeProfitDistance = currentPrice * 0.015; // 1.5% take profit (1.5:1 R/R)

    return {
      regime: 'RANGING',
      signal,
      confidence,
      reasoning,
      entryPrice: currentPrice,
      stopLoss: signal === 'BUY' ? currentPrice - stopLossDistance : currentPrice + stopLossDistance,
      takeProfit: signal === 'BUY' ? currentPrice + takeProfitDistance : currentPrice - takeProfitDistance,
      supportLevels: [input.marketData.low || currentPrice * 0.995],
      resistanceLevels: [input.marketData.high || currentPrice * 1.005],
      patterns: [],
      riskLevel: 'HIGH', // Always high risk without AI
      positionSizeRecommendation: 'SMALL' // Always small position without AI
    };
  }

  clearCache(): void {
    this.analysisCache.clear();
  }
}

export const aiAnalyzer = new AIAnalyzer();
