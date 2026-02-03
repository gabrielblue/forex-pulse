/**
 * Micro Account Configuration for $8 to $100 Growth Strategy
 * Configuration for major currency pairs optimized for small accounts
 */

export interface MicroAccountConfig {
  symbol: string;
  timeframe: string;
  higherTimeframe: string;
  stopLossPips: number;
  takeProfitPips: number;
  riskRewardRatio: number;
  accountRiskPercentage: number;
  minProfitTarget: number;
  tradingSessions: string[];
  pipValue: number;
  spreadTolerance: number;
  volatilityThreshold: number;
  trendStrengthThreshold: number;
}

// Configuration for major currency pairs
// Optimized for $8 accounts with 1-3 dollar profit targets

export const MICRO_ACCOUNT_CONFIGS: Record<string, MicroAccountConfig> = {
  'EURUSD': {
    symbol: 'EURUSD',
    timeframe: 'M15',
    higherTimeframe: 'H1',
    stopLossPips: 12,
    takeProfitPips: 22, // 1.8:1 RR
    riskRewardRatio: 1.8,
    accountRiskPercentage: 1.0,
    minProfitTarget: 1.5,
    tradingSessions: ['London', 'NewYork', 'Overlap'],
    pipValue: 0.0001,
    spreadTolerance: 0.0002,
    volatilityThreshold: 0.0005,
    trendStrengthThreshold: 0.4
  },
  'GBPUSD': {
    symbol: 'GBPUSD',
    timeframe: 'M15',
    higherTimeframe: 'H1',
    stopLossPips: 12,
    takeProfitPips: 22,
    riskRewardRatio: 1.8,
    accountRiskPercentage: 1.0,
    minProfitTarget: 1.5,
    tradingSessions: ['London', 'NewYork', 'Overlap'],
    pipValue: 0.0001,
    spreadTolerance: 0.00025,
    volatilityThreshold: 0.0006,
    trendStrengthThreshold: 0.4
  },
  'USDJPY': {
    symbol: 'USDJPY',
    timeframe: 'M15',
    higherTimeframe: 'H1',
    stopLossPips: 10, // JPY pairs have different pip values
    takeProfitPips: 18,
    riskRewardRatio: 1.8,
    accountRiskPercentage: 1.0,
    minProfitTarget: 1.5,
    tradingSessions: ['London', 'NewYork', 'Overlap'],
    pipValue: 0.01,
    spreadTolerance: 0.02,
    volatilityThreshold: 0.15,
    trendStrengthThreshold: 0.4
  },
  'AUDUSD': {
    symbol: 'AUDUSD',
    timeframe: 'M15',
    higherTimeframe: 'H1',
    stopLossPips: 12,
    takeProfitPips: 22,
    riskRewardRatio: 1.8,
    accountRiskPercentage: 1.0,
    minProfitTarget: 1.5,
    tradingSessions: ['London', 'NewYork', 'Overlap'],
    pipValue: 0.0001,
    spreadTolerance: 0.0002,
    volatilityThreshold: 0.0005,
    trendStrengthThreshold: 0.4
  },
  'USDCAD': {
    symbol: 'USDCAD',
    timeframe: 'M15',
    higherTimeframe: 'H1',
    stopLossPips: 12,
    takeProfitPips: 22,
    riskRewardRatio: 1.8,
    accountRiskPercentage: 1.0,
    minProfitTarget: 1.5,
    tradingSessions: ['London', 'NewYork', 'Overlap'],
    pipValue: 0.0001,
    spreadTolerance: 0.0002,
    volatilityThreshold: 0.0005,
    trendStrengthThreshold: 0.4
  },
  'EURJPY': {
    symbol: 'EURJPY',
    timeframe: 'M15',
    higherTimeframe: 'H1',
    stopLossPips: 10,
    takeProfitPips: 18,
    riskRewardRatio: 1.8,
    accountRiskPercentage: 1.0,
    minProfitTarget: 1.5,
    tradingSessions: ['London', 'NewYork', 'Overlap'],
    pipValue: 0.01,
    spreadTolerance: 0.02,
    volatilityThreshold: 0.15,
    trendStrengthThreshold: 0.4
  },
  'GBPJPY': {
    symbol: 'GBPJPY',
    timeframe: 'M15',
    higherTimeframe: 'H1',
    stopLossPips: 10,
    takeProfitPips: 18,
    riskRewardRatio: 1.8,
    accountRiskPercentage: 1.0,
    minProfitTarget: 1.5,
    tradingSessions: ['London', 'NewYork', 'Overlap'],
    pipValue: 0.01,
    spreadTolerance: 0.02,
    volatilityThreshold: 0.15,
    trendStrengthThreshold: 0.4
  }
};

// Default configuration for any pair not explicitly listed
export const DEFAULT_MICRO_CONFIG: MicroAccountConfig = {
  symbol: 'DEFAULT',
  timeframe: 'M15',
  higherTimeframe: 'H1',
  stopLossPips: 12,
  takeProfitPips: 22,
  riskRewardRatio: 1.8,
  accountRiskPercentage: 1.0,
  minProfitTarget: 1.5,
  tradingSessions: ['London', 'NewYork', 'Overlap'],
  pipValue: 0.0001,
  spreadTolerance: 0.0002,
  volatilityThreshold: 0.0005,
  trendStrengthThreshold: 0.4
};

// Get configuration for a specific symbol
export function getMicroAccountConfig(symbol: string): MicroAccountConfig {
  return MICRO_ACCOUNT_CONFIGS[symbol] || DEFAULT_MICRO_CONFIG;
}

// Get all configured symbols
export function getConfiguredSymbols(): string[] {
  return Object.keys(MICRO_ACCOUNT_CONFIGS);
}

// Trading session definitions
export const TRADING_SESSIONS = {
  London: {
    start: 7 * 60, // 07:00 UTC
    end: 16 * 60,   // 16:00 UTC
    description: 'London Session'
  },
  NewYork: {
    start: 12 * 60, // 12:00 UTC
    end: 21 * 60,   // 21:00 UTC
    description: 'New York Session'
  },
  Overlap: {
    start: 12 * 60, // 12:00 UTC
    end: 16 * 60,   // 16:00 UTC
    description: 'London-New York Overlap (Best Trading Time)'
  }
};

// Check if current time is in a specific session
export function isInTradingSession(sessionName: string): boolean {
  const now = new Date();
  const totalMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
  
  const session = TRADING_SESSIONS[sessionName as keyof typeof TRADING_SESSIONS];
  if (!session) return false;
  
  return totalMinutes >= session.start && totalMinutes <= session.end;
}

// Check if current time is in any active trading session
export function isInAnyTradingSession(): boolean {
  return isInTradingSession('London') || 
         isInTradingSession('NewYork') || 
         isInTradingSession('Overlap');
}