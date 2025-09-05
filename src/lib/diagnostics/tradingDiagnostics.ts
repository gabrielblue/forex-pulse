/**
 * Trading Bot Diagnostics
 * Comprehensive diagnostic tools to check why trades aren't happening
 */

import { exnessAPI } from '../trading/exnessApi';

export interface DiagnosticResult {
  timestamp: string;
  botStatus: any;
  marketConditions: any;
  sessionInfo: any;
  riskChecks: any;
  recommendations: string[];
}

export class TradingDiagnostics {
  
  /**
   * Run comprehensive diagnostics
   */
  static async runFullDiagnostics(): Promise<DiagnosticResult> {
    const result: DiagnosticResult = {
      timestamp: new Date().toISOString(),
      botStatus: {},
      marketConditions: {},
      sessionInfo: {},
      riskChecks: {},
      recommendations: []
    };

    try {
      // 1. Check bot status
      result.botStatus = await this.checkBotStatus();
      
      // 2. Check market conditions
      result.marketConditions = await this.checkMarketConditions();
      
      // 3. Check session timing
      result.sessionInfo = this.checkSessionTiming();
      
      // 4. Check risk management
      result.riskChecks = await this.checkRiskManagement();
      
      // 5. Generate recommendations
      result.recommendations = this.generateRecommendations(result);
      
    } catch (error) {
      console.error('Diagnostic error:', error);
      result.recommendations.push('Error running diagnostics: ' + error.message);
    }

    return result;
  }

  /**
   * Check bot connection and status
   */
  private static async checkBotStatus() {
    const status = {
      isConnected: false,
      canTrade: false,
      issues: [] as string[]
    };

    try {
      // Check MT5 bridge connection
      const bridgeResponse = await fetch('http://localhost:8001/');
      if (bridgeResponse.ok) {
        status.isConnected = true;
      } else {
        status.issues.push('MT5 Bridge not responding');
      }
    } catch (error) {
      status.issues.push('MT5 Bridge connection failed: ' + error.message);
    }

    try {
      // Check if we can get account info
      const accountInfo = await exnessAPI.getAccountInfo();
      if (accountInfo) {
        status.canTrade = true;
      } else {
        status.issues.push('Cannot get account information');
      }
    } catch (error) {
      status.issues.push('Account info check failed: ' + error.message);
    }

    return status;
  }

  /**
   * Check current market conditions
   */
  private static async checkMarketConditions() {
    const conditions = {
      pairs: {} as any,
      overall: {
        suitableForTrading: false,
        reasons: [] as string[]
      }
    };

    const pairs = ['EURUSD', 'GBPUSD', 'USDJPY', 'XAUUSD'];

    for (const symbol of pairs) {
      try {
        const currentPrice = await exnessAPI.getCurrentPrice(symbol);
        const ticks = await exnessAPI.getTicks(symbol, 100);

        if (currentPrice && ticks.length > 0) {
          const spread = currentPrice.ask - currentPrice.bid;
          const spreadPips = spread * 10000;

          conditions.pairs[symbol] = {
            hasData: true,
            spread: spreadPips.toFixed(1),
            ticksAvailable: ticks.length,
            lastPrice: currentPrice.bid
          };

          // Check if spread is reasonable
          if (spreadPips > 5) {
            conditions.overall.reasons.push(`${symbol}: Spread too high (${spreadPips.toFixed(1)} pips)`);
          }
        } else {
          conditions.pairs[symbol] = {
            hasData: false,
            error: 'No price data available'
          };
          conditions.overall.reasons.push(`${symbol}: No market data`);
        }
      } catch (error) {
        conditions.pairs[symbol] = {
          hasData: false,
          error: error.message
        };
        conditions.overall.reasons.push(`${symbol}: ${error.message}`);
      }
    }

    // Determine if conditions are suitable
    const pairsWithData = Object.values(conditions.pairs).filter((p: any) => p.hasData).length;
    if (pairsWithData >= 2 && conditions.overall.reasons.length === 0) {
      conditions.overall.suitableForTrading = true;
    }

    return conditions;
  }

  /**
   * Check current session timing
   */
  private static checkSessionTiming() {
    const now = new Date();
    const utcHour = now.getUTCHours();
    const utcMinute = now.getUTCMinutes();
    const currentTime = `${utcHour.toString().padStart(2, '0')}:${utcMinute.toString().padStart(2, '0')}`;

    const sessions = {
      currentTime,
      london: {
        active: utcHour >= 8 && utcHour < 16,
        start: '08:00',
        end: '16:00',
        name: 'London Session'
      },
      newyork: {
        active: utcHour >= 13 && utcHour < 21,
        start: '13:00',
        end: '21:00',
        name: 'New York Session'
      },
      lateus: {
        active: utcHour >= 21 || utcHour <= 2,
        start: '21:00',
        end: '02:00',
        name: 'Late US Session'
      },
      earlyasia: {
        active: utcHour >= 0 && utcHour <= 2,
        start: '00:00',
        end: '02:00',
        name: 'Early Asia Session'
      }
    };

    const activeSessions = Object.entries(sessions)
      .filter(([key, session]) => key !== 'currentTime' && session.active)
      .map(([key, session]) => session.name);

    return {
      ...sessions,
      activeSessions,
      isOptimalTradingTime: activeSessions.length > 0
    };
  }

  /**
   * Check risk management status
   */
  private static async checkRiskManagement() {
    const risk = {
      dailyLoss: 0,
      maxDailyLoss: 5.0,
      dailyLossExceeded: false,
      concurrentPositions: 0,
      maxConcurrentPositions: 5,
      positionLimitExceeded: false,
      issues: [] as string[]
    };

    try {
      // Get account info to check current positions
      const accountInfo = await exnessAPI.getAccountInfo();
      if (accountInfo && accountInfo.positions) {
        risk.concurrentPositions = accountInfo.positions.length;
        risk.positionLimitExceeded = risk.concurrentPositions >= risk.maxConcurrentPositions;
      }
    } catch (error) {
      risk.issues.push('Cannot check positions: ' + error.message);
    }

    // Check if daily loss limit would be exceeded
    if (risk.dailyLoss >= risk.maxDailyLoss) {
      risk.dailyLossExceeded = true;
      risk.issues.push('Daily loss limit exceeded');
    }

    return risk;
  }

  /**
   * Generate recommendations based on diagnostic results
   */
  private static generateRecommendations(diagnostic: DiagnosticResult): string[] {
    const recommendations: string[] = [];

    // Bot connection issues
    if (!diagnostic.botStatus.isConnected) {
      recommendations.push('🔌 Start MT5 Bridge: python3 mt5_bridge.py');
    }

    if (!diagnostic.botStatus.canTrade) {
      recommendations.push('🔑 Connect to MT5 account in the app');
    }

    // Market condition issues
    if (!diagnostic.marketConditions.overall.suitableForTrading) {
      recommendations.push('📊 Market conditions not suitable - check spreads and data availability');
    }

    // Session timing issues
    if (!diagnostic.sessionInfo.isOptimalTradingTime) {
      recommendations.push('⏰ Not optimal trading time - wait for London/NY sessions');
    }

    // Risk management issues
    if (diagnostic.riskChecks.positionLimitExceeded) {
      recommendations.push('⚠️ Too many concurrent positions - close some trades');
    }

    if (diagnostic.riskChecks.dailyLossExceeded) {
      recommendations.push('🚫 Daily loss limit exceeded - trading paused until tomorrow');
    }

    // If everything looks good but no trades
    if (diagnostic.botStatus.isConnected && 
        diagnostic.botStatus.canTrade && 
        diagnostic.marketConditions.overall.suitableForTrading &&
        diagnostic.sessionInfo.isOptimalTradingTime &&
        !diagnostic.riskChecks.positionLimitExceeded &&
        !diagnostic.riskChecks.dailyLossExceeded) {
      
      recommendations.push('✅ All systems operational - bot is waiting for high-confidence signals');
      recommendations.push('📈 Check confidence threshold (currently 75%) - consider lowering to 60% for testing');
      recommendations.push('🔄 Paper backtester is running - real trades will start after strategy validation');
    }

    return recommendations;
  }

  /**
   * Quick diagnostic check
   */
  static async quickCheck(): Promise<string[]> {
    const diagnostic = await this.runFullDiagnostics();
    return diagnostic.recommendations;
  }

  /**
   * Check specific component
   */
  static async checkComponent(component: 'bot' | 'market' | 'session' | 'risk'): Promise<any> {
    switch (component) {
      case 'bot':
        return await this.checkBotStatus();
      case 'market':
        return await this.checkMarketConditions();
      case 'session':
        return this.checkSessionTiming();
      case 'risk':
        return await this.checkRiskManagement();
      default:
        throw new Error('Unknown component: ' + component);
    }
  }
}

// Global diagnostic function for browser console
if (typeof window !== 'undefined') {
  (window as any).runTradingDiagnostics = TradingDiagnostics.runFullDiagnostics;
  (window as any).quickTradingCheck = TradingDiagnostics.quickCheck;
}