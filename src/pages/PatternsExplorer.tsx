import { useEffect, useState } from 'react';
import { Navigation } from '@/components/Navigation';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function PatternsExplorer() {
  const [rows, setRows] = useState<any[]>([]);
  const [symbol, setSymbol] = useState<string>('ALL');
  const [timeframe, setTimeframe] = useState<string>('ALL');
  const [minSamples, setMinSamples] = useState<number>(20);
  const [minWin, setMinWin] = useState<number>(50);

  async function load() {
    let q = supabase
      .from('patterns')
      .select('id, symbol, timeframe, pattern_key, pattern_stats(expectancy, win_rate, sample_size)')
      .limit(200);
    if (symbol !== 'ALL') q = q.eq('symbol', symbol);
    if (timeframe !== 'ALL') q = q.eq('timeframe', timeframe);
    const { data } = await q;
    const filtered = (data || []).filter(r => (r.pattern_stats?.sample_size ?? 0) >= minSamples && (r.pattern_stats?.win_rate ?? 0) >= minWin);
    setRows(filtered);
  }

  useEffect(() => { load(); }, [symbol, timeframe, minSamples, minWin]);

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Card>
          <CardHeader>
            <CardTitle>Patterns Explorer</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
              <div>
                <label className="text-sm text-muted-foreground">Symbol</label>
                <Input placeholder="ALL or e.g. EURUSD" value={symbol} onChange={(e)=>setSymbol(e.target.value.toUpperCase())} />
              </div>
              <div>
                <label className="text-sm text-muted-foreground">Timeframe</label>
                <Select value={timeframe} onValueChange={setTimeframe}>
                  <SelectTrigger><SelectValue placeholder="ALL" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">ALL</SelectItem>
                    <SelectItem value="M15">M15</SelectItem>
                    <SelectItem value="H1">H1</SelectItem>
                    <SelectItem value="H4">H4</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm text-muted-foreground">Min Samples</label>
                <Input type="number" value={minSamples} onChange={(e)=>setMinSamples(parseInt(e.target.value||'0'))} />
              </div>
              <div>
                <label className="text-sm text-muted-foreground">Min Win %</label>
                <Input type="number" value={minWin} onChange={(e)=>setMinWin(parseInt(e.target.value||'0'))} />
              </div>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Symbol</TableHead>
                  <TableHead>Timeframe</TableHead>
                  <TableHead>Pattern</TableHead>
                  <TableHead>Expectancy</TableHead>
                  <TableHead>Win Rate</TableHead>
                  <TableHead>Samples</TableHead>
                  <TableHead>Top Regime</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>{r.symbol}</TableCell>
                    <TableCell>{r.timeframe}</TableCell>
                    <TableCell className="truncate max-w-[300px]">{r.pattern_key}</TableCell>
                    <TableCell>{r.pattern_stats?.expectancy ?? '-'}</TableCell>
                    <TableCell>{r.pattern_stats?.win_rate ?? '-'}</TableCell>
                    <TableCell>{r.pattern_stats?.sample_size ?? '-'}</TableCell>
                    <TableCell>{(() => {
                      const br = r.pattern_stats?.by_regime || {};
                      const entries = Object.entries(br) as any[];
                      if (!entries.length) return '-';
                      entries.sort((a,b)=> (b[1]?.expectancy||0)-(a[1]?.expectancy||0));
                      const [name, val] = entries[0];
                      return `${name} (${val.expectancy?.toFixed?.(2) ?? 0})`;
                    })()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

