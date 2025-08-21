import { supabase } from '@/integrations/supabase/client';
import { exnessAPI } from './exnessApi';

class MonitoringService {
  async recordAnomaly(event: string, details: any) {
    // Replace with real table insert when available
    console.warn('ANOMALY:', event, details);
  }

  async attributePnL() {
    // Placeholder for PnL attribution per rule/strategy
    const info = await exnessAPI.getAccountInfo();
    if (!info) return;
    console.log('PnL Attribution snapshot:', { balance: info.balance, equity: info.equity });
  }

  async autoDeriskOnDrawdown(thresholdPct: number = 10) {
    const info = await exnessAPI.getAccountInfo();
    if (!info) return false;
    // This will be coordinated by orderManager's equity breaker; here we report only
    if (info.marginLevel > 0 && info.marginLevel < 100) {
      await this.recordAnomaly('CRITICAL_MARGIN', { marginLevel: info.marginLevel });
      return true;
    }
    return false;
  }

  async sendWebhookAlert(url: string | undefined, payload: any) {
    if (!url) return;
    try {
      await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    } catch (e) {
      console.error('Failed to send webhook alert', e);
    }
  }
}

export const monitoring = new MonitoringService();

