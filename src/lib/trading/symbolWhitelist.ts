// EXACT MT5 SYMBOL NAMES (case-sensitive) - AVAILABLE SYMBOLS IN EXNESS MT5 DEMO
// REMOVED UNAVAILABLE SYMBOLS: CADSGD, CADNOK, EURDKK, EURHUF

// MAJOR CURRENCY PAIRS ONLY - NO GOLD/SILVER - For accounts below $50
// FILTERED: Only symbols with confirmed historical data availability
export const MAJOR_CURRENCY_PAIRS = [
  // MAJORS (7 pairs) - Most liquid, always available
  "EURUSD", "GBPUSD", "USDJPY", "USDCHF", "AUDUSD", "NZDUSD", "USDCAD",

  // MAJOR CROSSES (6 pairs) - Most liquid crosses with confirmed data
  "EURJPY", "GBPCHF", "AUDJPY", "NZDJPY", "CADJPY", "CHFJPY",

  // VOLATILE CROSSES (4 pairs) - Good for quick profits
  "EURAUD", "GBPAUD", "AUDNZD", "NZDCHF",

  // COMMODITY CURRENCIES (3 pairs) - Good for trending markets
  "AUDCAD", "AUDCHF", "CADCHF"
] as const;

export const TOP_100_SYMBOLS = [
  // MAJORS
  "EURUSD", "GBPUSD", "USDJPY", "USDCHF", "AUDUSD", "NZDUSD", "USDCAD",

  // MAJOR CROSSES
  "EURJPY", "GBPJPY", "EURGBP", "EURAUD", "EURNZD", "EURCAD", "EURCHF",
  "GBPAUD", "GBPNZD", "GBPCAD", "GBPCHF", "AUDJPY", "NZDJPY",

  // VOLATILE
  "GBPNZD", "GBPAUD", "GBPJPY", "EURAUD", "EURNZD", "AUDNZD",
  "CADJPY", "CHFJPY",

  // USD CROSSES
  "USDMXN", "USDZAR", "USDTRY", "USDNOK", "USDSEK", "USDSGD", "USDHKD",
  "USDCNH", "USDPLN", "USDCZK",

  // COMMODITY CURRENCIES
  "AUDCAD", "AUDCHF", "AUDNZD", "AUDSGD",
  "NZDCAD", "NZDCHF", "NZDSGD",
  "CADCHF",

  // CHF / EUR SECONDARY
  "CHFSGD", "CHFNOK", "CHFSEK",
  "EURNOK", "EURSEK", "EURPLN",

  // EMERGING MARKETS
  "EURZAR", "GBPZAR", "USDILS", "USDKRW", "USDTHB", "USDPHP",

  // JPY BASKET
  "SGDJPY", "NOKJPY", "SEKJPY", "HKDJPY",

  // COMMODITIES (Available in Exness MT5)
  "XAUUSD", "XAGUSD",

  // HIGH RISK / OPTIONAL
  "USDBRL", "USDARS", "USDEGP"
] as const;

export type Top100Symbol = typeof TOP_100_SYMBOLS[number];
export type MajorCurrencyPair = typeof MAJOR_CURRENCY_PAIRS[number];