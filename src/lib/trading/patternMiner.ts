import { supabase } from '@/integrations/supabase/client';
import { exnessAPI } from './exnessApi';
import { calculateEMA, calculateRSI, calculateMACD, calculateATR, Candle } from './indicators';

type Timeframe = 'M15'|'H1'|'H4';

function zscore(arr: number[]) {
  const mean = arr.reduce((a,b)=>a+b,0) / Math.max(arr.length,1);
  const sd = Math.sqrt(arr.reduce((s,v)=>s + (v-mean)*(v-mean),0) / Math.max(arr.length,1));
  return arr.map(v => sd ? (v-mean)/sd : 0);
}

function hashPattern(vec: number[]): string {
  // Simple hash of quantized vector
  const q = vec.map(v => Math.round(v * 100) / 100);
  return q.join(',');
}

async function extractFeatures(symbol: string, timeframe: Timeframe, count: number = 300) {
  const candles = await exnessAPI.getHistoricalCandles(symbol, timeframe, count);
  const closes = candles.map(c => c.close);
  const emaFast = calculateEMA(closes, 12);
  const emaSlow = calculateEMA(closes, 26);
  const rsi = calculateRSI(closes, 14);
  const macd = calculateMACD(closes, 12, 26, 9);
  const atr = calculateATR(candles as Candle[], 14);
  return { candles, closes, emaFast, emaSlow, rsi, macd, atr };
}

function windowFeatures(f: { closes: number[]; emaFast: number[]; emaSlow: number[]; rsi: number[]; macd: { macd: number[]; signal: number[]; histogram: number[] }; atr: number[] }, w: number = 30) {
  const N = f.closes.length;
  const out: { key: string; idx: number; }[] = [];
  for (let i = w; i < N; i++) {
    const slice = (arr: number[]) => arr.slice(i - w, i);
    const vec = [
      ...zscore(slice(f.closes)),
      ...zscore(slice(f.emaFast).map((v,j)=> v - slice(f.emaSlow)[j])),
      ...zscore(slice(f.rsi)),
      ...zscore(slice(f.macd.macd)),
      ...zscore(slice(f.macd.histogram)),
      ...zscore(slice(f.atr)),
    ];
    const key = hashPattern(vec);
    out.push({ key, idx: i });
  }
  return out;
}

async function persistPattern(symbol: string, timeframe: Timeframe, key: string, sample: any) {
  await supabase.from('patterns').insert({
    user_id: null,
    symbol,
    timeframe,
    pattern_key: key,
    features: sample
  });
}

export async function minePatterns(symbols: string[] = ['EURUSD','GBPUSD','USDJPY'], timeframes: Timeframe[] = ['M15','H1','H4']) {
  for (const symbol of symbols) {
    for (const tf of timeframes) {
      const f = await extractFeatures(symbol, tf, 400);
      if (!f.closes.length) continue;
      const windows = windowFeatures(f, 30);
      // Frequency-based pattern mining: take top N frequent keys
      const freq: Record<string, number> = {};
      windows.forEach(w => { freq[w.key] = (freq[w.key] || 0) + 1; });
      const top = Object.entries(freq).sort((a,b)=>b[1]-a[1]).slice(0, 10);
      for (const [key] of top) {
        await persistPattern(symbol, tf, key, { length: 30 });
      }
    }
  }
}

export async function evaluatePatternStats(symbol: string, timeframe: Timeframe) {
  // Placeholder: here you would backtest occurrences and compute expectancy/win rate
  const { data: pats } = await supabase
    .from('patterns')
    .select('id, pattern_key')
    .eq('symbol', symbol)
    .eq('timeframe', timeframe)
    .limit(20);
  if (!pats) return;
  for (const p of pats) {
    await supabase.from('pattern_stats').upsert({
      pattern_id: p.id,
      expectancy: 0.1,
      win_rate: 55,
      sample_size: 100,
      last_updated: new Date().toISOString()
    });
  }
}

export async function runPatternMiner() {
  await minePatterns();
  await evaluatePatternStats('EURUSD','M15');
}

