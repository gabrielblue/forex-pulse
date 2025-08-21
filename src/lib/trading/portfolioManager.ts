import { exnessAPI } from './exnessApi';

export interface PortfolioLimits {
  maxPortfolioRiskPct: number; // total required margin vs equity
  perSymbolMaxPositions: Record<string, number>;
}

class PortfolioManager {
  private limits: PortfolioLimits = {
    maxPortfolioRiskPct: 30,
    perSymbolMaxPositions: {},
  };

  setLimits(l: Partial<PortfolioLimits>) { this.limits = { ...this.limits, ...l }; }
  getLimits() { return { ...this.limits }; }

  async canAddPosition(symbol: string, requiredMargin: number): Promise<{ ok: boolean; reason?: string }> {
    const info = await exnessAPI.getAccountInfo();
    if (!info) return { ok: false, reason: 'No account info' };
    // Portfolio risk as used margin + required / equity
    const projected = ((info.margin + requiredMargin) / Math.max(info.equity, 1)) * 100;
    if (projected > this.limits.maxPortfolioRiskPct) {
      return { ok: false, reason: `Portfolio risk too high: ${projected.toFixed(1)}%` };
    }
    // Per-symbol cap check left to orderManager
    return { ok: true };
  }
}

export const portfolioManager = new PortfolioManager();

