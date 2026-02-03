/**
 * Real Market Trading Strategies - Uses actual MT5 data for signal generation
 * This replaces the mock strategy logic with real data-driven signals
 */

import { TradingSignal } from '../signalProcessor';
import { realMarketDataService, IndicatorSet, MultiTimeframeData } from '../realMarketDataService';

export interface RealSignal extends TradingSignal {
  strategyName: string;
  indicators: IndicatorSet;
  multiTimeframeBias: 'BUY' | 'SELL' | 'NEUTRAL';
  confidence: number;
  riskRewardRatio: number;
  confluenceFactors: string[];
}

export class RealMarketStrategies {
  
  /**
   * Generate a signal based on real market data analysis
   */
  async generateRealSignal(
    symbol: string
  ): Promise<RealSignal | null> {
    try {
      console.log(`🎯 Analyzing ${symbol} with real market data...`);
      
      // Get real-time analysis from MT5
      const analysis = await realMarketDataService.getRealTimeAnalysis(symbol);
      
      if (!analysis.indicators || !analysis.multiTimeframe) {
        console.warn(`⚠️ No real market data available for ${symbol}`);
        return null;
      }

      const ind = analysis.indicators;
      const tfData = analysis.multiTimeframe;
      
      // Get multi-timeframe bias
      const tfBias = realMarketDataService.getMultiTimeframeBias(tfData);
      
      console.log(`📊 ${symbol} - Trend: ${ind.trendDirection}, RSI: ${ind.rsi.toFixed(1)}, TF Bias: ${tfBias.bias}`);
      
      // Generate signal based on multiple confluence factors
      const signal = this.evaluateConfluence(symbol, ind, tfBias);
      
      if (signal) {
        console.log(`✅ Generated ${signal.type} signal for ${symbol} with ${signal.confidence}% confidence`);
      }
      
      return signal;
      
    } catch (error) {
      console.error(`❌ Error generating real signal for ${symbol}:`, error);
      return null;
    }
  }

  /**
   * Evaluate multiple confluence factors to generate high-probability signals
   */
  private evaluateConfluence(
    symbol: string,
    ind: IndicatorSet,
    tfBias: { bias: 'BUY' | 'SELL' | 'NEUTRAL'; confidence: number; reason: string }
  ): RealSignal | null {
    const confluenceFactors: string[] = [];
    let buyScore = 0;
    let sellScore = 0;

    // 1. Multi-timeframe bias (weighted heavily - 40%)
    if (tfBias.bias === 'BUY') {
      buyScore += 40;
      confluenceFactors.push('✅ Multi-timeframe BUY bias');
    } else if (tfBias.bias === 'SELL') {
      sellScore += 40;
      confluenceFactors.push('✅ Multi-timeframe SELL bias');
    }

    // 2. Trend direction from EMAs (25%)
    if (ind.trendDirection === 'BULLISH') {
      buyScore += 25;
      confluenceFactors.push('✅ EMA alignment bullish');
    } else if (ind.trendDirection === 'BEARISH') {
      sellScore += 25;
      confluenceFactors.push('✅ EMA alignment bearish');
    }

    // 3. RSI conditions (20%)
    if (ind.rsi < 30) {
      buyScore += 20;
      confluenceFactors.push('✅ RSI oversold (< 30)');
    } else if (ind.rsi > 70) {
      sellScore += 20;
      confluenceFactors.push('✅ RSI overbought (> 70)');
    } else if (ind.rsi < 45 && ind.trendDirection === 'BULLISH') {
      buyScore += 10;
      confluenceFactors.push('⚠️ RSI bearish but trend bullish');
    } else if (ind.rsi > 55 && ind.trendDirection === 'BEARISH') {
      sellScore += 10;
      confluenceFactors.push('⚠️ RSI bullish but trend bearish');
    }

    // 4. MACD confirmation (10%)
    if (ind.macd.histogram > 0) {
      buyScore += 10;
      confluenceFactors.push('✅ MACD histogram positive');
    } else if (ind.macd.histogram < 0) {
      sellScore += 10;
      confluenceFactors.push('✅ MACD histogram negative');
    }

    // 5. Price relative to Bollinger Bands (5%)
    if (ind.currentPrice < ind.bollinger.lower * 1.001) {
      buyScore += 5;
      confluenceFactors.push('✅ Price at lower Bollinger Band');
    } else if (ind.currentPrice > ind.bollinger.upper * 0.999) {
      sellScore += 5;
      confluenceFactors.push('✅ Price at upper Bollinger Band');
    }

    console.log(`📊 ${symbol} - Buy Score: ${buyScore}, Sell Score: ${sellScore}`);

    // Determine signal direction
    let signalType: 'BUY' | 'SELL' | null = null;
    let confidence = 0;
    const entryPrice = ind.currentPrice;
    let stopLoss = 0;
    let takeProfit = 0;

    // Minimum threshold for signal generation
    const MIN_CONFLUENCE = 55;
    const MIN_SCORE_DIFFERENCE = 10;

    if (buyScore >= MIN_CONFLUENCE && buyScore >= sellScore + MIN_SCORE_DIFFERENCE) {
      signalType = 'BUY';
      confidence = Math.min(buyScore, 95);
      
      // Calculate SL/TP based on ATR
      const atr = ind.atr;
      stopLoss = entryPrice - (atr * 1.5); // 1.5 ATR stop loss
      takeProfit = entryPrice + (atr * 3); // 3 ATR take profit (2:1 RR)
      
      // Ensure minimum pips for forex
      const pipSize = symbol.includes('JPY') ? 0.01 : 0.0001;
      if (takeProfit - entryPrice < pipSize * 20) {
        takeProfit = entryPrice + pipSize * 20; // Minimum 20 pips
        stopLoss = entryPrice - pipSize * 10; // 2:1 RR
      }
      
    } else if (sellScore >= MIN_CONFLUENCE && sellScore >= buyScore + MIN_SCORE_DIFFERENCE) {
      signalType = 'SELL';
      confidence = Math.min(sellScore, 95);
      
      const atr = ind.atr;
      stopLoss = entryPrice + (atr * 1.5);
      takeProfit = entryPrice - (atr * 3);
      
      const pipSize = symbol.includes('JPY') ? 0.01 : 0.0001;
      if (entryPrice - takeProfit < pipSize * 20) {
        takeProfit = entryPrice - pipSize * 20;
        stopLoss = entryPrice + pipSize * 10;
      }
    }

    if (!signalType) {
      console.log(`📊 ${symbol} - No clear signal (Buy: ${buyScore}, Sell: ${sellScore})`);
      return null;
    }

    const riskRewardRatio = Math.abs(takeProfit - entryPrice) / Math.abs(entryPrice - stopLoss);

    return {
      id: `real_${symbol}_${Date.now()}`,
      symbol,
      type: signalType,
      confidence,
      entryPrice,
      stopLoss,
      takeProfit,
      timeframe: '15M',
      reasoning: this.generateReasoning(symbol, buyScore, sellScore, confluenceFactors),
      source: 'Real Market Analysis',
      strategyName: 'Multi-Timeframe Confluence Strategy',
      indicators: ind,
      multiTimeframeBias: tfBias.bias,
      riskRewardRatio,
      confluenceFactors
    };
  }

  /**
   * Generate human-readable reasoning for the signal
   */
  private generateReasoning(
    symbol: string,
    buyScore: number,
    sellScore: number,
    factors: string[]
  ): string {
    const direction = buyScore > sellScore ? 'BUY' : 'SELL';
    const score = Math.max(buyScore, sellScore);
    const topFactors = factors.slice(0, 3).map(f => f.replace('✅ ', '').replace('⚠️ ', '')).join(', ');
    
    return `${direction} signal for ${symbol} with ${score}% confluence. Key factors: ${topFactors}`;
  }

  /**
   * Quick market check - returns current bias without full signal generation
   */
  async getMarketBias(symbol: string): Promise<{
    trend: string;
    rsi: number;
    bias: string;
    confidence: number;
  } | null> {
    const analysis = await realMarketDataService.getRealTimeAnalysis(symbol);
    
    if (!analysis.indicators) {
      return null;
    }

    const ind = analysis.indicators;
    const tfData = analysis.multiTimeframe;
    
    if (!tfData) {
      return null;
    }

    const tfBias = realMarketDataService.getMultiTimeframeBias(tfData);
    
    // Determine overall trend
    let trend = 'SIDEWAYS';
    if (ind.trendStrength > 60) {
      trend = ind.trendDirection;
    }

    return {
      trend,
      rsi: ind.rsi,
      bias: tfBias.bias,
      confidence: tfBias.confidence
    };
  }
}

export const realMarketStrategies = new RealMarketStrategies();
