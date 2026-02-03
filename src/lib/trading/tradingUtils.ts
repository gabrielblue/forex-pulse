/**
 * Shared trading utilities
 */

/**
 * Get pip value for a symbol
 */
export function getPipValue(symbol: string): number {
  // Enhanced pip value calculation for all major pairs including gold
  const pipValues: Record<string, number> = {
    'EURUSD': 0.0001,
    'GBPUSD': 0.0001,
    'AUDUSD': 0.0001,
    'NZDUSD': 0.0001,
    'USDCHF': 0.0001,
    'USDCAD': 0.0001,
    'USDJPY': 0.01,
    'EURJPY': 0.01,
    'GBPJPY': 0.01,
    'CHFJPY': 0.01,
    'AUDJPY': 0.01,
    'NZDJPY': 0.01,
    'CADJPY': 0.01,
    'XAUUSD': 0.01, // Gold pip value - 0.01 for proper stop loss calculation (1 cent per pip)
    'XAGUSD': 0.001, // Silver pip value - 0.001 for proper stop loss calculation (0.1 cent per pip)
    'EURCAD': 0.0001,
    'EURCHF': 0.0001,
    'EURGBP': 0.0001,
    'AUDCAD': 0.0001,
    'AUDCHF': 0.0001,
    'AUDNZD': 0.0001,
    'CADCHF': 0.0001,
    'GBPAUD': 0.0001,
    'GBPCAD': 0.0001,
    'GBPCHF': 0.0001,
    'GBPNZD': 0.0001,
    'NZDCAD': 0.0001,
    'NZDCHF': 0.0001
  };

  return pipValues[symbol] || (symbol.includes('JPY') ? 0.01 : symbol.includes('XAU') ? 0.1 : 0.0001);
}