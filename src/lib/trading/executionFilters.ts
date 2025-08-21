import { exnessAPI } from './exnessApi';
import { calculateATR, Candle } from './indicators';
import { marketAnalyzer } from './marketAnalyzer';
import { supabase } from '@/integrations/supabase/client';

export async function isSpreadAcceptable(symbol: string, maxPips: number): Promise<boolean> {
  const price = await exnessAPI.getCurrentPrice(symbol);
  if (!price) return false;
  const pip = symbol.includes('JPY') ? 0.01 : 0.0001;
  const spreadPips = price.spread / pip;
  return spreadPips <= maxPips;
}

export async function isVolatilityAcceptable(symbol: string, candles: Candle[], maxAtrPips: number): Promise<boolean> {
  const atr = calculateATR(candles, 14);
  if (atr.length === 0) return true;
  const latestAtr = atr[atr.length - 1];
  const pip = symbol.includes('JPY') ? 0.01 : 0.0001;
  const atrPips = latestAtr / pip;
  return atrPips <= maxAtrPips;
}

export function isWithinActiveSession(symbol: string): boolean {
  const sessions = marketAnalyzer.getCurrentSessions();
  const active = sessions.filter(s => s.isActive);
  // Simple mapping: JPY pairs prefer Tokyo, EUR/GBP prefer London, USD prefer NY
  const sym = symbol.toUpperCase();
  if (sym.includes('JPY')) return active.some(s => s.name === 'Tokyo' || s.name === 'London');
  if (sym.startsWith('EUR') || sym.startsWith('GBP')) return active.some(s => s.name === 'London');
  if (sym.startsWith('USD')) return active.some(s => s.name === 'New York' || s.name === 'London');
  return active.length > 0;
}

export async function isNewsBlackout(symbol: string): Promise<boolean> {
  try {
    const now = new Date();
    const windowStart = new Date(now.getTime() - 30 * 60 * 1000).toISOString();
    const windowEnd = new Date(now.getTime() + 30 * 60 * 1000).toISOString();

    // Derive currencies from symbol like EURUSD
    const base = symbol.slice(0, 3).toUpperCase();
    const quote = symbol.slice(3, 6).toUpperCase();

    const { data } = await supabase
      .from('economic_calendar')
      .select('*')
      .gte('event_time', windowStart)
      .lte('event_time', windowEnd)
      .in('impact', ['HIGH', 'MEDIUM'])
      .in('currency', [base, quote]);

    return Array.isArray(data) && data.length > 0;
  } catch (e) {
    // Fail-open (no blackout) if calendar not available
    return false;
  }
}

