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
  private cacheDuration = 120000; // 2 minutes cache to reduce API calls
  private rateLimitBackoff = 0; // Global backoff time when rate limited
  private lastRateLimitTime = 0;
  
  constructor() {
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

    // Check if we're in rate limit backoff period
    if (this.rateLimitBackoff > 0) {
      const timeSinceRateLimit = Date.now() - this.lastRateLimitTime;
      if (timeSinceRateLimit < this.rateLimitBackoff) {
        const waitTime = Math.ceil((this.rateLimitBackoff - timeSinceRateLimit) / 1000);
        console.log(`⏳ Rate limit backoff active, waiting ${waitTime}s before next AI call`);
        return this.getFallbackAnalysis(input);
      } else {
        // Backoff period ended, reduce backoff for next time
        this.rateLimitBackoff = Math.max(0, this.rateLimitBackoff / 2);
      }
    }

    // Check if user is authenticated before calling the function
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.warn('⚠️ User not authenticated, using fallback analysis');
      return this.getFallbackAnalysis(input);
    }

    try {
      console.log(`🤖 Requesting AI analysis for ${input.symbol} on ${input.timeframe}...`);

      const { data, error } = await supabase.functions.invoke('analyze-market', {
        body: input
      });

      if (error) {
        // Check if it's a rate limit error
        if (error.message?.includes('429') || error.message?.includes('Too Many Requests')) {
          this.handleRateLimit();
          return this.getFallbackAnalysis(input);
        }
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
      
      // Success - reset backoff
      this.rateLimitBackoff = 0;
      
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
    } catch (error: any) {
      // Check for rate limit in catch block too
      if (error?.message?.includes('429') || error?.message?.includes('Too Many Requests') || 
          error?.message?.includes('non-2xx')) {
        this.handleRateLimit();
      }
      console.error('Failed to get AI analysis:', error);
      return this.getFallbackAnalysis(input);
    }
  }

  private handleRateLimit(): void {
    // Exponential backoff: start at 60s, double each time, max 5 minutes
    this.rateLimitBackoff = Math.min(300000, Math.max(60000, this.rateLimitBackoff * 2 || 60000));
    this.lastRateLimitTime = Date.now();
    console.warn(`⚠️ Rate limited! Backing off for ${this.rateLimitBackoff / 1000}s`);
  }

  private getFallbackAnalysis(input: MarketAnalysisInput): AIAnalysisResult {
    console.warn('⚠️ Using fallback analysis - AI unavailable or rate limited');
    
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
    this.rateLimitBackoff = 0;
    console.log('🧹 AI analysis cache cleared');
  }
  
  private initializeCache(): void {
    this.analysisCache.clear();
  }

  // Check if currently rate limited
  isRateLimited(): boolean {
    if (this.rateLimitBackoff === 0) return false;
    return Date.now() - this.lastRateLimitTime < this.rateLimitBackoff;
  }

  getRemainingBackoff(): number {
    if (!this.isRateLimited()) return 0;
    return Math.max(0, this.rateLimitBackoff - (Date.now() - this.lastRateLimitTime));
  }
}

export const aiAnalyzer = new AIAnalyzer();
