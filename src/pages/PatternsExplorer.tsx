import { useEffect, useState } from 'react';
import { Navigation } from '@/components/Navigation';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';

export default function PatternsExplorer() {
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('patterns')
        .select('id, symbol, timeframe, pattern_key, pattern_stats(expectancy, win_rate, sample_size)')
        .limit(100);
      setRows(data || []);
    })();
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Card>
          <CardHeader>
            <CardTitle>Patterns Explorer</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Symbol</TableHead>
                  <TableHead>Timeframe</TableHead>
                  <TableHead>Pattern</TableHead>
                  <TableHead>Expectancy</TableHead>
                  <TableHead>Win Rate</TableHead>
                  <TableHead>Samples</TableHead>
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

