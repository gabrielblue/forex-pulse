import type { Candle } from './indicators';

export interface Trade {
  time: number;
  direction: 'BUY' | 'SELL';
  entry: number;
  stop?: number;
  target?: number[]; // partial TPs
  size: number; // lots
}

export interface BacktestConfig {
  commissionPerLot: number; // e.g., $7 per lot round turn
  slippagePips: number;     // e.g., 0.5 pips
  pipValue(symbol: string): number;
  spreadFromCandle?: boolean;
}

export interface Performance {
  totalPnL: number;
  maxDD: number;
  winRate: number;
  trades: number;
  equityCurve: number[];
}

export function backtest(
  symbol: string,
  candles: Candle[],
  generateTrades: (candles: Candle[]) => Trade[],
  config: BacktestConfig
): Performance {
  const trades = generateTrades(candles);
  const equity: number[] = [];
  let balance = 0;
  let peak = 0;
  let wins = 0;
  const pip = config.pipValue(symbol);
  for (const t of trades) {
    // Simple next-candle execution model
    const idx = candles.findIndex(c => c.time >= t.time);
    if (idx < 0 || idx + 1 >= candles.length) continue;
    const c = candles[idx + 1];
    const spread = config.spreadFromCandle ? ((c as any).spread ?? 0) * pip : 0;
    const slip = config.slippagePips * pip;
    const entryPrice = t.direction === 'BUY' ? c.open + spread + slip : c.open - spread - slip;
    let exitPrice = c.close; // naive exit
    if (t.target && t.target.length > 0) {
      // partial TP at first hit
      for (const tp of t.target) {
        if (t.direction === 'BUY' && c.high >= tp) { exitPrice = tp; break; }
        if (t.direction === 'SELL' && c.low <= tp) { exitPrice = tp; break; }
      }
    } else if (t.stop) {
      if (t.direction === 'BUY' && c.low <= t.stop) exitPrice = t.stop;
      if (t.direction === 'SELL' && c.high >= t.stop) exitPrice = t.stop;
    }
    const points = (t.direction === 'BUY') ? (exitPrice - entryPrice) : (entryPrice - exitPrice);
    const pnl = points * 100000 * t.size - config.commissionPerLot * t.size;
    balance += pnl;
    if (pnl > 0) wins++;
    peak = Math.max(peak, balance);
    equity.push(balance);
  }
  const maxDD = equity.reduce((dd, v) => Math.max(dd, peak - v), 0);
  const perf: Performance = {
    totalPnL: balance,
    maxDD,
    winRate: trades.length ? (wins / trades.length) * 100 : 0,
    trades: trades.length,
    equityCurve: equity,
  };
  return perf;
}

export function walkForward(
  symbol: string,
  candles: Candle[],
  buildStrategy: (train: Candle[]) => (test: Candle[]) => Trade[],
  config: BacktestConfig,
  windows: Array<{ train: [number, number]; test: [number, number]; }>
) {
  return windows.map(w => {
    const train = candles.slice(w.train[0], w.train[1]);
    const test = candles.slice(w.test[0], w.test[1]);
    const strategy = buildStrategy(train);
    return backtest(symbol, test, strategy, config);
  });
}

export function monteCarlo(pnls: number[], trials: number = 1000) {
  const results: { mean: number; min: number; max: number }[] = [];
  for (let i = 0; i < trials; i++) {
    let sum = 0;
    for (let j = 0; j < pnls.length; j++) {
      const k = Math.floor(Math.random() * pnls.length);
      sum += pnls[k];
    }
    results.push({ mean: sum / pnls.length, min: Math.min(sum, 0), max: Math.max(sum, 0) });
  }
  return results;
}

