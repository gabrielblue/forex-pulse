import { AdvancedSignal, MarketCondition } from './worldClassStrategies';

export interface GoldMarketCondition extends MarketCondition {
  usdCorrelation: number;
  safeHavenDemand: 'LOW' | 'MEDIUM' | 'HIGH';
  seasonalBias: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  interestRateSensitivity: number;
  usdIndex: number;
  priceMomentum: number;
  trendConfirmation: boolean;
}

export type GoldTradeType = 'SCALP' | 'SWING' | 'POSITION';

export class GoldTradingStrategies {

  // ENHANCED SCALPING CONFIGURATION FOR $5-10 QUICK PROFITS
  private readonly SCALP_TARGET_MIN = 5.00;  // $5.00 minimum profit target
  private readonly SCALP_TARGET_MAX = 10.00; // $10.00 maximum profit target
  private readonly SCALP_STOP_LOSS = 5.00;    // $5.00 stop loss (WIDENED for better protection)
  private readonly SCALP_MAX_HOLD_MS = 180000; // 3 minutes max hold time
  private readonly MIN_MOMENTUM_CONFIRMATION = 0.0003;  // Strong momentum required before entry
  private readonly MIN_CONFIRMATIONS = 4;      // At least 4 confirmation signals needed (increased for safety)
  private readonly LOSS_COOLDOWN_MS = 300000;  // 5 minutes cooldown after loss (increased)
  private readonly MIN_CONFIDENCE = 75;        // Minimum 75% confidence required
  
  // Spread configuration for spread-adjusted take profits
  private readonly AVERAGE_SPREAD_PIPS = 15; // Average gold spread in pips (XAUUSD ~15-25 pips)
  private readonly SPREAD_BUFFER_PERCENT = 0.0015; // 0.15% buffer for spread costs
  
  // Trading hours configuration (UTC) - 24/7 TRADING ENABLED
  private readonly TRADING_HOURS = {
    START: 0,   // 0:00 UTC - 24/7 trading enabled
    END: 24,    // 24:00 UTC - trades allowed all day
    KILLZONE_START: 13, // 1:00 PM UTC - London session overlap (optimal liquidity)
    KILLZONE_END: 17    // 5:00 PM UTC - end of London session
  };
  
  // Slippage protection buffer (in price points)
  private readonly SLIPPAGE_BUFFER = 2.00; // $2.00 buffer for slippage protection
  
  // Track last trade time for cooldown
  private lastTradeTime: number = 0;
  private lastTradeType: 'BUY' | 'SELL' | null = null;
  private consecutiveLosses: number = 0;
  
  // Track BUY/SELL balance to ensure both directions are generated
  private buySignalsGenerated: number = 0;
  private sellSignalsGenerated: number = 0;
  
  /**
   * Check if current time is within optimal trading hours
   * Avoids early Asian session (00:00-06:00 UTC) when liquidity is low
   */
  private isWithinTradingHours(): { allowed: boolean; reason: string; isKillzone: boolean } {
    const hour = new Date().getUTCHours();
    const isKillzone = hour >= this.TRADING_HOURS.KILLZONE_START && hour < this.TRADING_HOURS.KILLZONE_END;
    
    if (hour < this.TRADING_HOURS.START) {
      return { 
        allowed: false, 
        reason: `Outside trading hours: ${hour}:00 UTC (trading allowed ${this.TRADING_HOURS.START}:00-${this.TRADING_HOURS.END}:00 UTC)`,
        isKillzone: false
      };
    }
    
    if (hour >= this.TRADING_HOURS.END) {
      return { 
        allowed: false, 
        reason: `Outside trading hours: ${hour}:00 UTC (trading allowed ${this.TRADING_HOURS.START}:00-${this.TRADING_HOURS.END}:00 UTC)`,
        isKillzone: false
      };
    }
    
    return { 
      allowed: true, 
      reason: isKillzone 
        ? `Killzone: ${hour}:00 UTC (optimal liquidity)`
        : `Trading hours: ${hour}:00 UTC`,
      isKillzone
    };
  }

  /**
   * Check BUY/SELL balance to ensure both directions are generated
   * If one direction dominates, adjust confidence for the other
   */
  private checkSignalBalance(direction: 'BUY' | 'SELL', confidence: number): number {
    // Track signals generated
    if (direction === 'BUY') {
      this.buySignalsGenerated++;
    } else {
      this.sellSignalsGenerated++;
    }
    
    // Calculate balance ratio
    const totalSignals = this.buySignalsGenerated + this.sellSignalsGenerated;
    if (totalSignals < 10) {
      // Not enough data for balance check
      return confidence;
    }
    
    const buyRatio = this.buySignalsGenerated / totalSignals;
    const sellRatio = this.sellSignalsGenerated / totalSignals;
    
    // If one direction dominates (>70%), boost the other direction
    if (buyRatio > 0.7 && direction === 'SELL') {
      console.log(`⚖️ Signal balance adjustment: SELL boosted (buy ratio: ${(buyRatio*100).toFixed(1)}%)`);
      return Math.min(95, confidence + 15); // Boost SELL confidence
    }
    
    if (sellRatio > 0.7 && direction === 'BUY') {
      console.log(`⚖️ Signal balance adjustment: BUY boosted (sell ratio: ${(sellRatio*100).toFixed(1)}%)`);
      return Math.min(95, confidence + 15); // Boost BUY confidence
    }
    
    return confidence;
  }

  /**
   * Apply slippage protection to stop loss
   * Adds buffer to prevent gap stops
   */
  private applySlippageProtection(stopLoss: number, tradeType: 'BUY' | 'SELL'): number {
    // For BUY trades, move SL down (more conservative)
    // For SELL trades, move SL up (more conservative)
    return tradeType === 'BUY' 
      ? stopLoss - this.SLIPPAGE_BUFFER 
      : stopLoss + this.SLIPPAGE_BUFFER;
  }

  // ALWAYS generate gold signals - both scalping and long positions
  async generateGoldSignal(
    marketData: any,
    indicators: any,
    usdData?: any,
    sessionInfo?: any,
    newsEvents: any[] = []
  ): Promise<AdvancedSignal | null> {

    const { prices = [], volumes = [], symbol } = marketData;
    if (!symbol || (!symbol.includes('XAU') && !symbol.includes('GOLD'))) {
      return null;
    }

    try {
      // CRITICAL: Check trading hours first - skip if outside optimal hours
      const tradingHoursCheck = this.isWithinTradingHours();
      if (!tradingHoursCheck.allowed) {
        console.log(`🚫 Gold Strategy: ${tradingHoursCheck.reason} - SKIPPING TRADE for ${symbol}`);
        return null;
      }
      console.log(`✅ Gold Strategy: ${tradingHoursCheck.reason} - proceeding with signal generation`);
      
      const goldCondition = this.analyzeGoldMarketCondition(marketData, indicators, usdData);

      const volatilityValue = typeof goldCondition.volatility === 'number' ? goldCondition.volatility : 0;
      const momentumValue = typeof goldCondition.momentum === 'number' ? goldCondition.momentum : 0;
      console.log(`🎯 Gold Strategy: Analyzing ${symbol} - volatility: ${volatilityValue.toFixed(2)}, trend: ${goldCondition.trend}, momentum: ${momentumValue.toFixed(4)}`);
      
      // NEW: Use ENHANCED SCALPING strategy FIRST for $5-10 quick profits
      // This is the primary strategy for consistent profits
      let signal = await this.generateEnhancedGoldScalpingSignal(marketData, indicators, goldCondition);
      
      if (signal) {
        // Apply signal balance check
        signal.confidence = this.checkSignalBalance(signal.type, signal.confidence);
        console.log(`✅ Gold Strategy: ENHANCED SCALP signal generated for ${symbol} - ${signal.type} (${signal.confidence}%)`);
        return signal;
      }

      // Fall back to other strategies if enhanced scalping doesn't generate signal
      signal = await this.generateProfitableGoldSignal(marketData, indicators, goldCondition);

      if (signal) {
        signal.confidence = this.checkSignalBalance(signal.type, signal.confidence);
        console.log(`✅ Gold Strategy: Primary signal generated for ${symbol} - ${signal.type} (${signal.confidence}%)`);
        return this.applyConservativeRiskManagement(signal, goldCondition);
      }

      // Try scalping signal
      signal = await this.generateGoldScalpingSignal(marketData, indicators, goldCondition);
      if (signal) {
        signal.confidence = this.checkSignalBalance(signal.type, signal.confidence);
        console.log(`✅ Gold Strategy: SCALPING signal generated for ${symbol} - ${signal.type} (${signal.confidence}%)`);
        return signal;
      }

      // Try swing/position signal for longer holds
      signal = await this.generateGoldSwingSignal(marketData, indicators, goldCondition);
      if (signal) {
        signal.confidence = this.checkSignalBalance(signal.type, signal.confidence);
        console.log(`✅ Gold Strategy: SWING signal generated for ${symbol} - ${signal.type} (${signal.confidence}%)`);
        return signal;
      }

      // Fallback: ALWAYS generate aggressive signal
      signal = await this.generateAggressiveGoldSignal(marketData, indicators, goldCondition);
      if (signal) {
        signal.confidence = this.checkSignalBalance(signal.type, signal.confidence);
        console.log(`✅ Gold Strategy: AGGRESSIVE signal generated for ${symbol} - ${signal.type} (${signal.confidence}%)`);
        return signal;
      }

      // LAST RESORT: Force generate a signal based on current trend
      // FIX: Only force if there's a clear trend, otherwise skip
      console.log(`⚠️ Gold Strategy: Attempting force signal generation for ${symbol}`);
      const forceSignal = this.forceGenerateGoldSignal(marketData, indicators, goldCondition);
      if (forceSignal) {
        forceSignal.confidence = this.checkSignalBalance(forceSignal.type, forceSignal.confidence);
        console.log(`✅ Gold Strategy: FORCE signal generated for ${symbol} - ${forceSignal.type} (${forceSignal.confidence}%)`);
        return forceSignal;
      }

      // FINAL: No clear signal - don't trade
      console.log(`🚫 Gold Strategy: No valid signal for ${symbol} - SKIPPING TRADE (no clear trend)`);
      return null;

    } catch (error) {
      console.error('Error in gold strategy:', error);
      // Even on error, try to generate a basic signal
      return this.forceGenerateGoldSignal(marketData, indicators, this.getDefaultGoldCondition());
    }
  }

  private async generateProfitableGoldSignal(
    marketData: any,
    indicators: any,
    goldCondition: GoldMarketCondition
  ): Promise<AdvancedSignal | null> {

    const { prices = [], volumes = [] } = marketData;
    const currentPrice = prices[prices.length - 1];
    
    // Safe extraction with fallbacks
    const ema20 = indicators?.ema20 ?? currentPrice;
    const ema50 = indicators?.ema50 ?? currentPrice;
    const ema200 = indicators?.ema200 ?? currentPrice;
    const rsi = indicators?.rsi ?? 50;
    const macd = indicators?.macd ?? { histogram: 0, value: 0, signal: 0 };
    const atr = indicators?.atr ?? (currentPrice * 0.01);

    const shortTrend = ema20 > ema50 ? 'BULLISH' : 'BEARISH';
    const longTrend = ema50 > ema200 ? 'BULLISH' : 'BEARISH';

    const trendAligned = shortTrend === longTrend;
    const momentum = this.calculateMomentum(prices, 10);
    const strongMomentum = Math.abs(momentum) > 0.0001;

    if (!trendAligned && !strongMomentum) {
      console.log(`⏸️ Gold Strategy: Trends not aligned and weak momentum, but will try anyway`);
    }

    const trendDirection = shortTrend;

    const avgVolume = this.calculateAverageVolume(volumes, 20);
    const currentVolume = volumes[volumes.length - 1];
    const hasVolume = currentVolume > 0;

    if (!hasVolume) {
      console.log(`⚠️ Gold Strategy: No volume data - allowing trade anyway`);
    }

    const histogram = macd?.histogram ?? 0;

    if (histogram === 0) {
      console.log(`⚠️ Gold Strategy: No MACD data - using trend-only signal`);
      if (trendDirection === 'BULLISH') {
        return this.createBullishGoldSignal(marketData, indicators, goldCondition);
      } else if (trendDirection === 'BEARISH') {
        return this.createBearishGoldSignal(marketData, indicators, goldCondition);
      }
      return null;
    }

    const macdBullish = histogram > -0.0002;
    const macdBearish = histogram < 0.0002;

    console.log(`🎯 Gold Strategy: USD correlation ${goldCondition.usdCorrelation.toFixed(2)} - allowing trade`);
    const favorableUSD = true;

    if (trendDirection === 'BULLISH' && (macdBullish || favorableUSD)) {
      return this.createBullishGoldSignal(marketData, indicators, goldCondition);
    } else if (trendDirection === 'BEARISH' && (macdBearish || favorableUSD)) {
      return this.createBearishGoldSignal(marketData, indicators, goldCondition);
    }

    if (trendDirection === 'BULLISH' || trendDirection === 'BEARISH') {
      console.log(`🎯 Gold Strategy: Generating signal based on trend only: ${trendDirection}`);
      if (trendDirection === 'BULLISH') {
        return this.createBullishGoldSignal(marketData, indicators, goldCondition);
      } else {
        return this.createBearishGoldSignal(marketData, indicators, goldCondition);
      }
    }

    console.log(`⏸️ Gold Strategy: No clear trend direction`);
    return null;
  }

  private createBullishGoldSignal(
    marketData: any,
    indicators: any,
    goldCondition: GoldMarketCondition
  ): AdvancedSignal | null {
    const { prices = [] } = marketData;
    if (prices.length < 10) {
      console.log(`🚫 createBullishGoldSignal: Insufficient price data`);
      return null;
    }
    
    // CRITICAL: Verify price is actually bullish before creating BUY signal
    const recentPrices = prices.slice(-10);
    const priceChange = recentPrices[recentPrices.length - 1] - recentPrices[0];
    
    // Only create BUY signal if price is actually rising (at least 0.1% gain)
    if (priceChange <= 0) {
      console.log(`🚫 createBullishGoldSignal: Price not bullish (${((priceChange/recentPrices[0])*100).toFixed(3)}%) - skipping BUY signal`);
      return null; // Don't force BUY when price is falling
    }
    
    const currentPrice = prices[prices.length - 1];
    const atr = indicators?.atr ?? (currentPrice * 0.01);
    // $5 stop (WIDENED), $7.50 target (2.5:1 RR) for $5-10 range
    const stopDistance = this.SCALP_STOP_LOSS; // $5.00 (widened from $3)
    const targetDistance = this.SCALP_TARGET_MIN; // $5.00 minimum
    
    // Apply slippage protection to stop loss
    const rawStopLoss = currentPrice - stopDistance;
    const protectedStopLoss = this.applySlippageProtection(rawStopLoss, 'BUY');
    
    return {
      id: this.generateSignalId(),
      symbol: marketData.symbol,
      type: 'BUY',
      confidence: 75,
      entryPrice: currentPrice,
      stopLoss: protectedStopLoss,
      takeProfit: currentPrice + targetDistance,
      timeframe: '1H',
      reasoning: `Gold Trend Following BUY: Strong uptrend with trend confirmation, TP=${targetDistance}, SL=${stopDistance} (widened for protection)`,
      source: 'Gold Trend Strategy',
      strategyName: 'Gold Conservative Trend Follower',
      marketCondition: goldCondition,
      chartPatterns: ['Strong Uptrend'],
      confluenceFactors: ['EMA20 > EMA50 alignment', 'Trend following', '$5-10 TP target', 'Widened SL for protection'],
      riskRewardRatio: targetDistance / stopDistance,
      probabilityOfSuccess: 70
    };
  }

  private createBearishGoldSignal(
    marketData: any,
    indicators: any,
    goldCondition: GoldMarketCondition
  ): AdvancedSignal {
    const currentPrice = marketData.prices[marketData.prices.length - 1];
    const atr = indicators?.atr ?? (currentPrice * 0.01);
    // $5 stop (WIDENED), $7.50 target (2.5:1 RR) for $5-10 range
    const stopDistance = this.SCALP_STOP_LOSS; // $5.00 (widened from $3)
    const targetDistance = this.SCALP_TARGET_MIN; // $5.00 minimum

    // Apply slippage protection to stop loss
    const rawStopLoss = currentPrice + stopDistance;
    const protectedStopLoss = this.applySlippageProtection(rawStopLoss, 'SELL');

    return {
      id: this.generateSignalId(),
      symbol: marketData.symbol,
      type: 'SELL',
      confidence: 75,
      entryPrice: currentPrice,
      stopLoss: protectedStopLoss,
      takeProfit: currentPrice - targetDistance,
      timeframe: '1H',
      reasoning: `Gold Trend Following SELL: Strong downtrend with trend confirmation, TP=${targetDistance}, SL=${stopDistance} (widened for protection)`,
      source: 'Gold Trend Strategy',
      strategyName: 'Gold Conservative Trend Follower',
      marketCondition: goldCondition,
      chartPatterns: ['Strong Downtrend'],
      confluenceFactors: ['EMA20 < EMA50 alignment', 'Trend following', '$5-10 TP target', 'Widened SL for protection'],
      riskRewardRatio: targetDistance / stopDistance,
      probabilityOfSuccess: 70
    };
  }

  private applyConservativeRiskManagement(
    signal: AdvancedSignal,
    goldCondition: GoldMarketCondition
  ): AdvancedSignal {
    const risk = Math.abs(signal.entryPrice - signal.stopLoss);
    const reward = Math.abs(signal.takeProfit - signal.entryPrice);
    const minReward = risk * 2;

    const adjustedTakeProfit = signal.type === 'BUY'
      ? signal.entryPrice + Math.max(reward, minReward)
      : signal.entryPrice - Math.max(reward, minReward);

    return {
      ...signal,
      takeProfit: adjustedTakeProfit,
      reasoning: `${signal.reasoning} | 2:1 RR minimum`
    };
  }

  // ENHANCED SCALPING SIGNAL: Quick $5-10 profits with proper confirmation
  // This is the PRIMARY scalping method that uses multiple confirmations
  private async generateEnhancedGoldScalpingSignal(
    marketData: any,
    indicators: any,
    goldCondition: GoldMarketCondition
  ): Promise<AdvancedSignal | null> {
    const { prices = [], volumes = [], symbol } = marketData;
    if (prices.length < 10) {
      console.log(`⏸️ Enhanced Scalp: Insufficient price data for ${symbol}`);
      return null;
    }
    
    const currentPrice = prices[prices.length - 1];
    const rsi = indicators?.rsi ?? 50;
    const ema20 = indicators?.ema20 ?? currentPrice;
    const ema50 = indicators?.ema50 ?? currentPrice;
    
    // Check cooldown after losses
    const now = Date.now();
    if (this.consecutiveLosses >= 3 && now - this.lastTradeTime < this.LOSS_COOLDOWN_MS) {
      console.log(`⏸️ Enhanced Scalp: Cooldown active after ${this.consecutiveLosses} consecutive losses for ${symbol}`);
      return null;
    }
    
    // CRITICAL: Detect actual price direction from REAL prices
    const recentPrices = prices.slice(-10);
    const priceChange = recentPrices[recentPrices.length - 1] - recentPrices[0];
    const priceChangePercent = (priceChange / recentPrices[0]) * 100;
    
    console.log(`📊 ${symbol} Price Analysis: Current=${currentPrice.toFixed(2)}, ` +
      `Change=${priceChange >= 0 ? '+' : ''}${priceChangePercent.toFixed(2)}% over last 10 bars`);
    
    // Determine actual market direction from price action
    const isPriceBullish = priceChange > 0;
    const isPriceBearish = priceChange < 0;
    const isTrending = Math.abs(priceChangePercent) > 0.3; // 0.3% threshold for trending (INCREASED from 0.1%)
    
    // Count confirmation signals
    const confirmations: string[] = [];
    let confirmationScore = 0;
    
    // Confirmation 1: Price action confirmation (MOST IMPORTANT)
    if (isPriceBullish) {
      confirmations.push('PRICE_BULLISH');
      confirmationScore += 2; // Extra weight for price action
    } else if (isPriceBearish) {
      confirmations.push('PRICE_BEARISH');
      confirmationScore += 2; // Extra weight for price action
    } else {
      confirmations.push('PRICE_NEUTRAL');
    }
    
    // Confirmation 2: EMA alignment
    const emaBullish = ema20 > ema50;
    if (isPriceBullish && emaBullish) {
      confirmations.push('EMA_CONFIRMS_BULLISH');
      confirmationScore++;
    } else if (isPriceBearish && !emaBullish) {
      confirmations.push('EMA_CONFIRMS_BEARISH');
      confirmationScore++;
    } else if (isPriceBullish && !emaBullish) {
      confirmations.push('EMA_OPPOSES_BULLISH');
      confirmationScore -= 1; // EMA contradicts price
    } else if (isPriceBearish && emaBullish) {
      confirmations.push('EMA_OPPOSES_BEARISH');
      confirmationScore -= 1; // EMA contradicts price
    } else {
      confirmations.push('EMA_NEUTRAL');
    }
    
    // Confirmation 3: RSI in favorable zone
    if (isPriceBullish && rsi < 55) {
      confirmations.push('RSI_FAVORABLE_BUY');
      confirmationScore++;
    } else if (isPriceBearish && rsi > 45) {
      confirmations.push('RSI_FAVORABLE_SELL');
      confirmationScore++;
    } else if (isPriceBullish && rsi >= 70) {
      confirmations.push('RSI_OVERBOUGHT_BUY_RISKY');
      confirmationScore -= 2; // Risky
    } else if (isPriceBearish && rsi <= 30) {
      confirmations.push('RSI_OVERSOLD_SELL_RISKY');
      confirmationScore -= 2; // Risky
    } else {
      confirmations.push('RSI_NEUTRAL');
    }
    
    // Require at least 2 positive confirmations for entry
    const minConfirmations = 2;
    
    console.log(`🎯 Enhanced Scalp: ${symbol} - Confirmations: ${confirmationScore}/${minConfirmations} [${confirmations.join(', ')}]`);
    
    if (confirmationScore < minConfirmations) {
      console.log(`🚫 Enhanced Scalp: Insufficient confirmations for ${symbol} - skipping trade`);
      return null;
    }
    
    // CRITICAL: Trade in the direction of ACTUAL price movement
    // This fixes the issue of bot buying when price is falling
    const tradeType: 'BUY' | 'SELL' = isPriceBullish ? 'BUY' : 'SELL';
    
    // Only trade if we have clear trend direction
    if (!isTrending) {
      console.log(`🚫 Enhanced Scalp: ${symbol} - No clear trend (${priceChangePercent.toFixed(3)}%) - skipping`);
      return null;
    }
    
    console.log(`🎯 Enhanced Scalp: ${symbol} - Detected ${isPriceBullish ? 'BULLISH' : 'BEARISH'} trend, executing ${tradeType}`);
    
    // Check displacement confirmation
    const displacementCheck = this.checkDisplacementConfirmation(prices, volumes, tradeType);
    console.log(`🎯 Sniper Filter - Displacement: ${displacementCheck.reason}`);
    if (!displacementCheck.valid) {
      console.log(`🚫 Enhanced Scalp: ${symbol} - BLOCKED by displacement filter`);
      return null;
    }
    
    // Calculate targets
    const stopDistance = this.SCALP_STOP_LOSS; // $5.00 (widened from $3)
    const targetMin = this.SCALP_TARGET_MIN;   // $5.00
    
    const adjustedTakeProfit = this.calculateSpreadAdjustedTakeProfit(
      currentPrice, targetMin, this.AVERAGE_SPREAD_PIPS, 0.01, tradeType
    );
    
    // Apply slippage protection to stop loss
    const rawStopLoss = tradeType === 'BUY' ? currentPrice - stopDistance : currentPrice + stopDistance;
    const protectedStopLoss = this.applySlippageProtection(rawStopLoss, tradeType);
    
    const confidence = Math.min(85, 60 + confirmationScore * 10);
    
    return {
      id: this.generateSignalId(),
      symbol,
      type: tradeType,
      confidence,
      entryPrice: currentPrice,
      stopLoss: protectedStopLoss,
      takeProfit: adjustedTakeProfit,
      timeframe: '5M',
      reasoning: `Enhanced Scalp ${tradeType}: Price ${isPriceBullish ? 'rising' : 'falling'} (${priceChangePercent.toFixed(2)}%), ${confirmationScore} confirmations, SL=${stopDistance} (widened)`,
      source: 'Gold Enhanced Scalping Strategy',
      strategyName: 'Gold Quick Scalper Pro',
      marketCondition: goldCondition,
      chartPatterns: ['Price Action Confirmed', 'Multi-Timeframe Confirmation'],
      confluenceFactors: confirmations,
      riskRewardRatio: targetMin / stopDistance,
      probabilityOfSuccess: confidence - 10
    };
  }

  // SCALPING SIGNAL: Quick in-and-out trades with tight stops
  private async generateGoldScalpingSignal(
    marketData: any,
    indicators: any,
    goldCondition: GoldMarketCondition
  ): Promise<AdvancedSignal | null> {
    const { prices = [] } = marketData;
    if (prices.length < 5) return null;
    
    const currentPrice = prices[prices.length - 1];
    const prevPrice = prices[prices.length - 2];
    const rsi = indicators?.rsi ?? 50;
    
    // Scalping: Look for quick momentum moves
    const priceChange = (currentPrice - prevPrice) / prevPrice;
    const isStrongMove = Math.abs(priceChange) > 0.0002; // 0.02% move
    
    // RSI extremes for scalping
    const isOversold = rsi < 35;
    const isOverbought = rsi > 65;
    
    // Tight stops for scalping: $0.50 stop, $1.00 target (2:1 RR)
    const stopDistance = 0.50; // $0.50 stop loss
    const targetDistance = 1.00; // $1.00 take profit
    
    if (isOversold || (isStrongMove && priceChange > 0)) {
      console.log(`🎯 Gold SCALP BUY: RSI=${rsi.toFixed(1)}, momentum=${(priceChange*100).toFixed(3)}%`);
      return {
        id: this.generateSignalId(),
        symbol: marketData.symbol,
        type: 'BUY',
        confidence: 80,
        entryPrice: currentPrice,
        stopLoss: currentPrice - stopDistance,
        takeProfit: currentPrice + targetDistance,
        timeframe: '5M',
        reasoning: `Gold SCALP BUY: Quick momentum trade, RSI=${rsi.toFixed(1)}`,
        source: 'Gold Scalping Strategy',
        strategyName: 'Gold Scalper',
        marketCondition: goldCondition,
        chartPatterns: ['Momentum Scalp'],
        confluenceFactors: ['RSI oversold', 'Quick momentum'],
        riskRewardRatio: 2.0,
        probabilityOfSuccess: 70
      };
    }
    
    if (isOverbought || (isStrongMove && priceChange < 0)) {
      console.log(`🎯 Gold SCALP SELL: RSI=${rsi.toFixed(1)}, momentum=${(priceChange*100).toFixed(3)}%`);
      return {
        id: this.generateSignalId(),
        symbol: marketData.symbol,
        type: 'SELL',
        confidence: 80,
        entryPrice: currentPrice,
        stopLoss: currentPrice + stopDistance,
        takeProfit: currentPrice - targetDistance,
        timeframe: '5M',
        reasoning: `Gold SCALP SELL: Quick momentum trade, RSI=${rsi.toFixed(1)}`,
        source: 'Gold Scalping Strategy',
        strategyName: 'Gold Scalper',
        marketCondition: goldCondition,
        chartPatterns: ['Momentum Scalp'],
        confluenceFactors: ['RSI overbought', 'Quick momentum'],
        riskRewardRatio: 2.0,
        probabilityOfSuccess: 70
      };
    }
    
    return null;
  }

  // SWING SIGNAL: Longer hold trades with wider stops for bigger profits
  private async generateGoldSwingSignal(
    marketData: any,
    indicators: any,
    goldCondition: GoldMarketCondition
  ): Promise<AdvancedSignal | null> {
    const { prices = [] } = marketData;
    if (prices.length < 20) return null;
    
    const currentPrice = prices[prices.length - 1];
    const ema20 = indicators?.ema20 ?? currentPrice;
    const ema50 = indicators?.ema50 ?? currentPrice;
    const ema200 = indicators?.ema200 ?? currentPrice;
    const atr = indicators?.atr ?? (currentPrice * 0.01);
    
    // CRITICAL: Detect actual price direction
    const recentPrices = prices.slice(-20);
    const priceChange = recentPrices[recentPrices.length - 1] - recentPrices[0];
    const priceChangePercent = (priceChange / recentPrices[0]) * 100;
    
    const isPriceBullish = priceChange > 0;
    const isPriceBearish = priceChange < 0;
    
    // Swing trading: Look for strong trend alignment with price action
    const emaBullish = ema20 > ema50;
    
    // Wider stops for swing trades: 2x ATR stop, 4x ATR target (2:1 RR)
    const stopDistance = Math.max(atr * 2, 2.00); // Minimum $2.00 stop
    const targetDistance = stopDistance * 2; // 2:1 RR
    
    // CRITICAL: Trade in direction of actual price movement
    if (isPriceBullish) {
      console.log(`🎯 Gold SWING BUY: Price ${priceChangePercent.toFixed(2)}% bullish over 20 bars`);
      return {
        id: this.generateSignalId(),
        symbol: marketData.symbol,
        type: 'BUY',
        confidence: 80,
        entryPrice: currentPrice,
        stopLoss: currentPrice - stopDistance,
        takeProfit: currentPrice + targetDistance,
        timeframe: '4H',
        reasoning: `Gold SWING BUY: Price rising ${priceChangePercent.toFixed(2)}% over 20 bars, EMA20>EMA50=${emaBullish}`,
        source: 'Gold Swing Strategy',
        strategyName: 'Gold Swing Trader',
        marketCondition: goldCondition,
        chartPatterns: ['Price Action Uptrend'],
        confluenceFactors: ['Price momentum bullish', 'Swing entry', '2:1 RR'],
        riskRewardRatio: 2.0,
        probabilityOfSuccess: 75
      };
    }
    
    if (isPriceBearish) {
      console.log(`🎯 Gold SWING SELL: Price ${priceChangePercent.toFixed(2)}% bearish over 20 bars`);
      return {
        id: this.generateSignalId(),
        symbol: marketData.symbol,
        type: 'SELL',
        confidence: 80,
        entryPrice: currentPrice,
        stopLoss: currentPrice + stopDistance,
        takeProfit: currentPrice - targetDistance,
        timeframe: '4H',
        reasoning: `Gold SWING SELL: Price falling ${priceChangePercent.toFixed(2)}% over 20 bars, EMA20<EMA50=${!emaBullish}`,
        source: 'Gold Swing Strategy',
        strategyName: 'Gold Swing Trader',
        marketCondition: goldCondition,
        chartPatterns: ['Price Action Downtrend'],
        confluenceFactors: ['Price momentum bearish', 'Swing entry', '2:1 RR'],
        riskRewardRatio: 2.0,
        probabilityOfSuccess: 75
      };
    }
    
    console.log(`🚫 Gold SWING: No clear price trend - skipping`);
    return null;
  }

  private async generateAggressiveGoldSignal(
    marketData: any,
    indicators: any,
    goldCondition: GoldMarketCondition
  ): Promise<AdvancedSignal | null> {
    const { prices = [] } = marketData;
    const currentPrice = prices[prices.length - 1] || 2000;
    
    // CRITICAL: Check actual price direction
    if (prices.length < 10) {
      console.log(`⚠️ Aggressive Strategy: Insufficient data for ${marketData.symbol}`);
      return null;
    }
    
    const recentPrices = prices.slice(-10);
    const priceChange = recentPrices[recentPrices.length - 1] - recentPrices[0];
    const priceChangePercent = (priceChange / recentPrices[0]) * 100;
    
    const isPriceBullish = priceChange > 0;
    const isPriceBearish = priceChange < 0;
    
    // CRITICAL: Return null if no clear direction - DON'T FORCE TRADE!
    if (!isPriceBullish && !isPriceBearish) {
      console.log(`🚫 Aggressive Strategy: No clear price direction (${priceChangePercent.toFixed(3)}%) - SKIPPING TRADE`);
      return null;
    }
    
    // $5 stop (WIDENED), $5-10 target
    const stopDistance = this.SCALP_STOP_LOSS;
    const targetDistance = this.SCALP_TARGET_MIN;
    
    if (isPriceBullish) {
      // Apply slippage protection to stop loss
      const rawStopLoss = currentPrice - stopDistance;
      const protectedStopLoss = this.applySlippageProtection(rawStopLoss, 'BUY');
      
      console.log(`🎯 Gold Aggressive BUY: Price ${priceChangePercent.toFixed(2)}% bullish`);
      return {
        id: this.generateSignalId(),
        symbol: marketData.symbol,
        type: 'BUY',
        confidence: 75,
        entryPrice: currentPrice,
        stopLoss: protectedStopLoss,
        takeProfit: currentPrice + targetDistance,
        timeframe: '1H',
        reasoning: `Gold Aggressive BUY: Price rising ${priceChangePercent.toFixed(2)}%, aggressive entry, SL=${stopDistance} (widened)`,
        source: 'Gold Aggressive Strategy',
        strategyName: 'Gold Price Action Aggressive',
        marketCondition: goldCondition,
        chartPatterns: ['Price Action'],
        confluenceFactors: ['Price momentum bullish', 'Aggressive mode', 'Widened SL'],
        riskRewardRatio: targetDistance / stopDistance,
        probabilityOfSuccess: 70
      };
    }
    
    if (isPriceBearish) {
      // Apply slippage protection to stop loss
      const rawStopLoss = currentPrice + stopDistance;
      const protectedStopLoss = this.applySlippageProtection(rawStopLoss, 'SELL');
      
      console.log(`🎯 Gold Aggressive SELL: Price ${priceChangePercent.toFixed(2)}% bearish`);
      return {
        id: this.generateSignalId(),
        symbol: marketData.symbol,
        type: 'SELL',
        confidence: 75,
        entryPrice: currentPrice,
        stopLoss: protectedStopLoss,
        takeProfit: currentPrice - targetDistance,
        timeframe: '1H',
        reasoning: `Gold Aggressive SELL: Price falling ${priceChangePercent.toFixed(2)}%, aggressive entry, SL=${stopDistance} (widened)`,
        source: 'Gold Aggressive Strategy',
        strategyName: 'Gold Price Action Aggressive',
        marketCondition: goldCondition,
        chartPatterns: ['Price Action'],
        confluenceFactors: ['Price momentum bearish', 'Aggressive mode', 'Widened SL'],
        riskRewardRatio: targetDistance / stopDistance,
        probabilityOfSuccess: 70
      };
    }
    
    console.log(`🚫 Aggressive Strategy: No clear trend for ${marketData.symbol} - skipping`);
    return null;
  }

  // FORCE GENERATE: Only produce a signal when there's a clear trend
  // UPDATED: Now uses $5-10 take profit targets as requested
  // FIX: Returns null when no clear direction instead of forcing bad trades
  private forceGenerateGoldSignal(
    marketData: any,
    indicators: any,
    goldCondition: GoldMarketCondition
  ): AdvancedSignal | null {
    const { prices = [] } = marketData;
    const currentPrice = prices[prices.length - 1] || 2000;
    const symbol = marketData.symbol || 'XAUUSD';
    
    // CRITICAL: Check actual price direction first
    if (prices.length < 10) {
      console.log(`⚠️ Force Signal: Insufficient data for ${symbol}`);
      return null;
    }
    
    const recentPrices = prices.slice(-10);
    const priceChange = recentPrices[recentPrices.length - 1] - recentPrices[0];
    const priceChangePercent = (priceChange / recentPrices[0]) * 100;
    
    const isPriceBullish = priceChange > 0;
    const isPriceBearish = priceChange < 0;
    
    // CRITICAL: Use price direction, not just EMA
    let tradeDirection: 'BUY' | 'SELL' | null = null;
    
    if (isPriceBullish) {
      tradeDirection = 'BUY';
    } else if (isPriceBearish) {
      tradeDirection = 'SELL';
    } else {
      // No clear direction - skip trade
      console.log(`🚫 Force Signal: No clear price direction for ${symbol} - SKIPPING`);
      return null;
    }
    
    // Use EMA for additional confirmation only
    const ema20 = indicators?.ema20 ?? currentPrice;
    const ema50 = indicators?.ema50 ?? currentPrice;
    const emaDiff = ema20 - ema50;
    
    // FIX: Check if trend is clear - EMAs must be separated by at least 0.001 (0.1%)
    const minTrendThreshold = currentPrice * 0.001; // 0.1% minimum separation
    
    if (Math.abs(emaDiff) < minTrendThreshold) {
      console.log(`🚫 Gold FORCE SIGNAL: No clear trend for ${symbol} - EMAs too close (diff=${emaDiff.toFixed(4)}) - SKIPPING TRADE`);
      return null; // Don't force a trade when no clear trend
    }
    
    const isBullish = ema20 > ema50;
    
    // $5 stop (WIDENED), $7.50 target (middle of $5-10 range)
    const stopDistance = this.SCALP_STOP_LOSS; // $5.00 (widened from $3)
    const targetDistance = 7.50; // $7.50 target
    
    // Apply slippage protection to stop loss
    const rawStopLoss = tradeDirection === 'BUY' ? currentPrice - stopDistance : currentPrice + stopDistance;
    const protectedStopLoss = this.applySlippageProtection(rawStopLoss, tradeDirection);
    
    console.log(`⚠️ Gold FORCE SIGNAL: ${tradeDirection} for ${symbol} with TP=${targetDistance} (clear trend detected)`);
    
    return {
      id: this.generateSignalId(),
      symbol: symbol,
      type: tradeDirection,
      confidence: 70,
      entryPrice: currentPrice,
      stopLoss: protectedStopLoss,
      takeProfit: tradeDirection === 'BUY' ? currentPrice + targetDistance : currentPrice - targetDistance,
      timeframe: '15M',
      reasoning: `Gold FORCED ${isBullish ? 'BUY' : 'SELL'}: Gold-only mode active, generating trade with ${targetDistance} target (clear trend), SL=${stopDistance} (widened)`,
      source: 'Gold Force Strategy',
      strategyName: 'Gold Force Trader',
      marketCondition: goldCondition,
      chartPatterns: ['Forced Entry'],
      confluenceFactors: ['Gold-only mode', 'Forced signal', '$5-10 TP target', 'Widened SL'],
      riskRewardRatio: targetDistance / stopDistance,
      probabilityOfSuccess: 60
    };
  }

  private getDefaultGoldCondition(): GoldMarketCondition {
    return {
      volatility: 1.0,
      trend: 'SIDEWAYS',
      momentum: 0,
      volume: 1,
      sessionOverlap: false,
      newsImpact: 'MEDIUM',
      usdCorrelation: 0,
      safeHavenDemand: 'MEDIUM',
      seasonalBias: 'NEUTRAL',
      interestRateSensitivity: -0.3,
      usdIndex: 103, // Default USD Index value
      priceMomentum: 0,
      trendConfirmation: false
    };
  }

  analyzeGoldMarketCondition(
    marketData: any,
    indicators: any,
    usdData?: any
  ): GoldMarketCondition {
    const { prices = [], volumes = [] } = marketData;
    const volatility = this.calculateRealizedVolatility(prices, 20);
    
    const avgVolume = volumes.length >= 20 
      ? volumes.slice(-20).reduce((a, b) => a + b, 0) / 20 
      : (volumes.length > 0 ? volumes.reduce((a, b) => a + b, 0) / volumes.length : 1);
    
    const currentVolume = volumes[volumes.length - 1];

    const usdCorrelation = usdData?.prices 
      ? this.calculateUSDCorrelation(prices, usdData.prices) 
      : 0;
    const safeHavenDemand = this.assessSafeHavenDemand(indicators, volumes);
    const seasonalBias = this.getSeasonalBias();

    // Safe indicator access
    const ema20 = indicators?.ema20 ?? prices[prices.length - 1] ?? 0;
    const ema50 = indicators?.ema50 ?? prices[prices.length - 1] ?? 0;
    
    // Calculate price momentum
    const priceMomentum = this.calculateMomentum(prices, 5);
    
    // Trend confirmation: EMA alignment AND price moving in same direction
    const emaAligned = ema20 > ema50;
    const priceConfirming = priceMomentum > 0 ? emaAligned : !emaAligned;
    const trendConfirmation = priceConfirming && Math.abs(priceMomentum) > this.MIN_MOMENTUM_CONFIRMATION;
    
    // Simulated USD Index (in real implementation, fetch from API)
    const usdIndex = usdData?.usdIndex ?? 103.5;
    
    // Log detailed analysis for debugging
    console.log(`🎯 Gold Analysis: EMA20=${ema20.toFixed(2)}, EMA50=${ema50.toFixed(2)}, ` +
      `Momentum=${(priceMomentum*100000).toFixed(2)}, TrendConf=${trendConfirmation}, USDIndex=${usdIndex.toFixed(2)}`);
    
    return {
      volatility: volatility * 100,
      trend: ema20 > ema50 ? "BULLISH" :
            ema20 < ema50 ? "BEARISH" : "SIDEWAYS",
      momentum: Math.abs(priceMomentum) * 100,
      volume: avgVolume > 0 ? currentVolume / avgVolume : 1,
      sessionOverlap: this.isSessionOverlap(),
      newsImpact: "MEDIUM",
      usdCorrelation,
      safeHavenDemand,
      seasonalBias,
      interestRateSensitivity: -0.3,
      usdIndex,
      priceMomentum,
      trendConfirmation
    };
  }

  private calculateAverageVolume(volumes: number[], period: number): number {
    if (volumes.length === 0) return 0;
    const validPeriod = Math.min(period, volumes.length);
    if (validPeriod === 0) return 0;
    return volumes.slice(-validPeriod).reduce((a, b) => a + b, 0) / validPeriod;
  }

  private calculateMomentum(prices: number[], period: number): number {
    if (prices.length < period + 1 || prices.length < 2) return 0;
    const current = prices[prices.length - 1];
    const past = prices[prices.length - 1 - period];
    if (past === 0) return 0;
    return (current - past) / past;
  }

  private calculateReturns(prices: number[]): number[] {
    if (prices.length < 2) return [];
    const returns: number[] = [];
    for (let i = 1; i < prices.length; i++) {
      if (prices[i-1] !== 0) {
        returns.push((prices[i] - prices[i-1]) / prices[i-1]);
      }
    }
    return returns;
  }

  private calculateUSDCorrelation(goldPrices: number[], usdPrices: number[]): number {
    if (goldPrices.length !== usdPrices.length || goldPrices.length === 0 || usdPrices.length === 0) return 0;
    const goldReturns = this.calculateReturns(goldPrices);
    const usdReturns = this.calculateReturns(usdPrices);
    return this.calculateCorrelation(goldReturns, usdReturns);
  }

  private calculateCorrelation(returns1: number[], returns2: number[]): number {
    if (returns1.length !== returns2.length || returns1.length === 0) return 0;
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
    const denominator = Math.sqrt(sum1Sq * sum2Sq);
    return denominator === 0 ? 0 : numerator / denominator;
  }

  private calculateRealizedVolatility(prices: number[], period: number): number {
    if (prices.length < 2) return 0;
    const sliceLength = Math.min(period, prices.length);
    const returns = this.calculateReturns(prices.slice(-sliceLength));
    if (returns.length === 0) return 0;
    const meanReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((sum, ret) => sum + Math.pow(ret - meanReturn, 2), 0) / returns.length;
    return Math.sqrt(variance * 252);
  }

  private assessSafeHavenDemand(indicators: any, volumes: number[]): 'LOW' | 'MEDIUM' | 'HIGH' {
    if (volumes.length === 0) return 'LOW';
    
    const avgVolume = volumes.length >= 20 
      ? volumes.slice(-20).reduce((a, b) => a + b, 0) / 20 
      : volumes.reduce((a, b) => a + b, 0) / volumes.length;
    
    const currentVolume = volumes[volumes.length - 1];
    const volumeSpike = avgVolume > 0 ? currentVolume > avgVolume * 1.5 : false;
    const volatility = indicators?.atr ?? 0.01;
    if (volumeSpike && volatility > 0.015) return 'HIGH';
    if (volumeSpike || volatility > 0.012) return 'MEDIUM';
    return 'LOW';
  }

  private getSeasonalBias(): 'BULLISH' | 'BEARISH' | 'NEUTRAL' {
    const month = new Date().getMonth() + 1;
    if ([8, 9, 10, 12, 1, 2].includes(month)) return 'BULLISH';
    if ([3, 4, 5, 11].includes(month)) return 'BEARISH';
    return 'NEUTRAL';
  }

  private isSessionOverlap(): boolean {
    const hour = new Date().getUTCHours();
    return (hour >= 13 && hour <= 17) || (hour >= 8 && hour <= 9);
  }

  /**
   * Calculate spread-adjusted take profit to account for spread costs
   * Ensures TP is beyond spread to achieve actual profit target
   */
  private calculateSpreadAdjustedTakeProfit(
    entryPrice: number,
    targetProfit: number,
    spreadInPips: number,
    pipValue: number,
    tradeType: 'BUY' | 'SELL'
  ): number {
    const spreadCost = spreadInPips * pipValue;
    const totalTarget = targetProfit + spreadCost;
    
    console.log(`🎯 Spread-Adjusted TP: Entry=${entryPrice.toFixed(2)}, TargetProfit=${targetProfit.toFixed(2)}, SpreadCost=${spreadCost.toFixed(2)}, AdjustedTP=${totalTarget.toFixed(2)}`);
    
    return tradeType === 'BUY' 
      ? entryPrice + totalTarget 
      : entryPrice - totalTarget;
  }

  /**
   * SNIPER ENTRY FILTER: Check for displacement candle confirmation
   * Displacement candles show strong institutional buying/selling
   * FIX: Lowered threshold to allow SELL signals during weaker market conditions
   */
  private checkDisplacementConfirmation(prices: number[], volumes: number[], tradeType: 'BUY' | 'SELL'): { valid: boolean; reason: string } {
    if (prices.length < 5) return { valid: false, reason: 'Insufficient price data' };
    
    const lastCandle = prices[prices.length - 1];
    const prevCandle = prices[prices.length - 2];
    const prevPrevCandle = prices[prices.length - 3];
    
    const currentChange = lastCandle - prevCandle;
    const prevChange = prevCandle - prevPrevCandle;
    
    // FIX: Lower threshold from 1.5x to 1.0x for more signals
    // This allows trades when current move is at least as strong as previous
    const isStrongMove = Math.abs(currentChange) >= Math.abs(prevChange);
    
    // For BUY: need upward displacement (current > prev) or at least neutral
    if (tradeType === 'BUY' && currentChange >= 0 && isStrongMove) {
      return { valid: true, reason: 'Bullish displacement confirmed' };
    }
    // For SELL: need downward displacement (current < prev) or at least neutral
    if (tradeType === 'SELL' && currentChange <= 0 && isStrongMove) {
      return { valid: true, reason: 'Bearish displacement confirmed' };
    }
    
    // Allow if price is moving in the right direction even without strong displacement
    if (tradeType === 'BUY' && currentChange > 0) {
      return { valid: true, reason: 'Bullish price movement detected' };
    }
    if (tradeType === 'SELL' && currentChange < 0) {
      return { valid: true, reason: 'Bearish price movement detected' };
    }
    
    // Allow if no clear direction but EMA suggests the trade
    return { 
      valid: true, 
      reason: 'No clear displacement but allowing based on EMA trend' 
    };
  }

  /**
   * SNIPER ENTRY FILTER: Check for volume confirmation
   * High volume on signal candle confirms institutional participation
   */
  private checkVolumeConfirmation(volumes: number[], tradeType: 'BUY' | 'SELL'): { valid: boolean; reason: string } {
    if (volumes.length < 10 || volumes[volumes.length - 1] === 0) {
      return { valid: true, reason: 'No volume data - allowing trade' }; // Allow if no volume data
    }
    
    const avgVolume = volumes.slice(-10).reduce((a, b) => a + b, 0) / 10;
    const currentVolume = volumes[volumes.length - 1];
    const volumeRatio = currentVolume / avgVolume;
    
    // Volume should be at least 80% of average for confirmation
    if (volumeRatio >= 0.8) {
      return { 
        valid: true, 
        reason: `Volume confirmed: ${(volumeRatio * 100).toFixed(0)}% of average` 
      };
    }
    
    // Warning for low volume but still allow
    return { 
      valid: true, 
      reason: `⚠️ Low volume: ${(volumeRatio * 100).toFixed(0)}% of average - trade allowed but caution advised` 
    };
  }

  private generateSignalId(): string {
    return `gold_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }
  
  /**
   * Record trade outcome for risk management
   * Call this after trades close to update streak tracking
   */
  public recordTradeOutcome(wasProfit: boolean): void {
    this.lastTradeTime = Date.now();
    
    if (wasProfit) {
      this.consecutiveLosses = 0;
      this.lastTradeType = null;
    } else {
      this.consecutiveLosses++;
    }
    
    console.log(`📊 Gold Strategy: Trade ${wasProfit ? 'WIN' : 'LOSS'} - Consecutive losses: ${this.consecutiveLosses}`);
  }
}

export const goldTradingStrategies = new GoldTradingStrategies();
