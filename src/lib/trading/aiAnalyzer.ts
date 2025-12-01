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
  
  constructor() {
    // Clear any stale cache on initialization
    this.initializeCache();
  }

  async analyzeMarket(input: MarketAnalysisInput): Promise<AIAnalysisResult> {
    const cacheKey = `${input.symbol}_${input.timeframe}`;
    const cached = this.analysisCache.get(cacheKey);
    
    // Return cached result if still fresh
    if (cached && Date.now() - cached.timestamp < this.cacheDuration) {
      console.log(`📊 Using cached AI analysis for ${cacheKey}`);
      return cached.result;
    }

    try {
      console.log(`🤖 Requesting AI analysis for ${input.symbol} on ${input.timeframe}...`);
      
      const { data, error } = await supabase.functions.invoke('analyze-market', {
        body: input
      });

      if (error) {
        console.error('AI analysis error:', error);
        throw error;
      }

      if (!data?.success || !data?.analysis) {
        console.error('❌ Invalid AI response:', data);
        throw new Error(`Invalid AI response: ${JSON.stringify(data)}`);
      }

      const analysis = data.analysis as AIAnalysisResult;
      
      // Validate analysis has required fields
      if (!analysis.signal || typeof analysis.confidence !== 'number') {
        console.error('❌ AI analysis missing required fields:', analysis);
        throw new Error('AI analysis incomplete');
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
      console.error('Failed to get AI analysis:', error);
      
      // Return conservative fallback
      return this.getFallbackAnalysis(input);
    }
  }

  private getFallbackAnalysis(input: MarketAnalysisInput): AIAnalysisResult {
    console.warn('⚠️ Using fallback analysis - AI unavailable');
    
    return {
      regime: 'RANGING',
      signal: 'HOLD',
      confidence: 0,
      reasoning: 'AI analysis unavailable. Conservative HOLD recommended until AI service is restored.',
      entryPrice: input.marketData.currentPrice,
      stopLoss: input.marketData.currentPrice * 0.99,
      takeProfit: input.marketData.currentPrice * 1.01,
      supportLevels: [input.marketData.low || input.marketData.currentPrice * 0.995],
      resistanceLevels: [input.marketData.high || input.marketData.currentPrice * 1.005],
      patterns: [],
      riskLevel: 'HIGH',
      positionSizeRecommendation: 'SMALL'
    };
  }

  clearCache(): void {
    this.analysisCache.clear();
    console.log('🧹 AI analysis cache cleared');
  }
  
  // Clear cache on module load to ensure fresh analysis after deployment
  private initializeCache(): void {
    this.analysisCache.clear();
  }
}

export const aiAnalyzer = new AIAnalyzer();
