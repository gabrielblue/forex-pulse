import { MT5_BRIDGE_URL } from "./config";
import { exnessAPI } from './exnessApi';

export interface SystemHealthCheck {
  isHealthy: boolean;
  issues: HealthIssue[];
  warnings: HealthWarning[];
  lastCheck: Date;
}

export interface HealthIssue {
  severity: 'critical' | 'error' | 'warning';
  component: 'MT5_BRIDGE' | 'EXNESS_CONNECTION' | 'HISTORICAL_DATA' | 'AI_SERVICE' | 'TRADING_CAPABILITIES';
  message: string;
  resolution: string;
}

export interface HealthWarning {
  component: string;
  message: string;
}

class SystemHealthMonitor {
  private lastHealthCheck: SystemHealthCheck | null = null;

  async performHealthCheck(): Promise<SystemHealthCheck> {
    const issues: HealthIssue[] = [];
    const warnings: HealthWarning[] = [];

    // 1. Check Exness connection
    const isConnected = exnessAPI.isConnectedToExness();
    if (!isConnected) {
      issues.push({
        severity: 'critical',
        component: 'EXNESS_CONNECTION',
        message: 'Not connected to Exness MT5 account',
        resolution: 'Click "Connect to Exness" button and enter your MT5 credentials'
      });
    }

    // 2. Check MT5 Bridge availability (only if connected)
    if (isConnected) {
      const mt5BridgeAvailable = await this.checkMT5Bridge();
      if (!mt5BridgeAvailable) {
        issues.push({
          severity: 'critical',
          component: 'MT5_BRIDGE',
          message: 'MT5 Bridge service is not running',
          resolution: 'Start the Python MT5 Bridge service (python mt5_bridge.py) - see MT5_SETUP_INSTRUCTIONS.md'
        });
      }
    }

    // 3. Check historical data availability (only if connected and bridge is up)
    if (isConnected) {
      const historicalDataWorks = await this.checkHistoricalData();
      if (!historicalDataWorks) {
        issues.push({
          severity: 'error',
          component: 'HISTORICAL_DATA',
          message: 'Cannot fetch historical price data from MT5',
          resolution: 'Ensure MT5 terminal is running and logged in, and MT5 Bridge service is started'
        });
      }
    }

    // 4. Check trading capabilities
    if (isConnected) {
      const { canTrade, issues: tradingIssues } = await exnessAPI.verifyTradingCapabilities();
      if (!canTrade) {
        issues.push({
          severity: 'error',
          component: 'TRADING_CAPABILITIES',
          message: `Trading not allowed: ${tradingIssues.join(', ')}`,
          resolution: 'Check account balance, margin level, and trading permissions'
        });
      }
    }

    const healthCheck: SystemHealthCheck = {
      isHealthy: issues.filter(i => i.severity === 'critical' || i.severity === 'error').length === 0,
      issues,
      warnings,
      lastCheck: new Date()
    };

    this.lastHealthCheck = healthCheck;
    return healthCheck;
  }

  private async checkMT5Bridge(): Promise<boolean> {
    try {
      const response = await fetch(`${MT5_BRIDGE_URL}/`, {
        method: 'GET',
        signal: AbortSignal.timeout(3000)
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  private async checkHistoricalData(): Promise<boolean> {
    try {
      // Try to fetch historical data for EURUSD as a test
      const historicalData = await exnessAPI.getHistoricalData('EURUSD', 15, 10);
      return historicalData !== null && historicalData.length > 0;
    } catch (error) {
      return false;
    }
  }

  getLastHealthCheck(): SystemHealthCheck | null {
    return this.lastHealthCheck;
  }

  // Format issues for display
  formatIssuesForDisplay(): string[] {
    if (!this.lastHealthCheck) return [];
    
    return this.lastHealthCheck.issues.map(issue => {
      const icon = issue.severity === 'critical' ? '🚨' : issue.severity === 'error' ? '❌' : '⚠️';
      return `${icon} ${issue.component}: ${issue.message}\n   → ${issue.resolution}`;
    });
  }
}

export const systemHealthMonitor = new SystemHealthMonitor();
