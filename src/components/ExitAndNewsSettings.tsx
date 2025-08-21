import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from './ui/card';
import { Label } from './ui/label';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Switch } from './ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { orderManager } from '@/lib/trading/orderManager';

export const ExitAndNewsSettings = () => {
  const [trailing, setTrailing] = useState(20);
  const [symbolCapSymbol, setSymbolCapSymbol] = useState('EURUSD');
  const [symbolCap, setSymbolCap] = useState(2);
  const [newsBlackout, setNewsBlackout] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from('bot_settings')
        .select('news_blackout_enabled')
        .eq('user_id', user.id)
        .single();
      if (data && typeof data.news_blackout_enabled === 'boolean') {
        setNewsBlackout(Boolean(data.news_blackout_enabled));
      }
    })();
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      // Update exit parameters in order manager (runtime only)
      orderManager.updateExitParameters({
        trailingStopPips: trailing,
        perSymbolMaxConcurrent: { [symbolCapSymbol.toUpperCase()]: symbolCap }
      });
      // Persist news blackout toggle
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from('bot_settings').upsert({
          user_id: user.id,
          news_blackout_enabled: newsBlackout,
          updated_at: new Date().toISOString()
        });
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Exits & News Settings</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <div>
            <Label>Trailing stop (pips)</Label>
            <Input type="number" value={trailing} onChange={(e) => setTrailing(parseInt(e.target.value || '0'))} />
          </div>
          <div>
            <Label>Per-symbol cap (symbol)</Label>
            <Input value={symbolCapSymbol} onChange={(e) => setSymbolCapSymbol(e.target.value)} />
          </div>
          <div>
            <Label>Per-symbol cap (positions)</Label>
            <Input type="number" value={symbolCap} onChange={(e) => setSymbolCap(parseInt(e.target.value || '0'))} />
          </div>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <Label>News blackout window enabled</Label>
          </div>
          <Switch checked={newsBlackout} onCheckedChange={(v) => setNewsBlackout(Boolean(v))} />
        </div>
        <Button onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save Settings'}</Button>
      </CardContent>
    </Card>
  );
};

