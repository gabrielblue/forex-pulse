/**
 * Time-Based Exit Rules and Weekend Protection Module
 * Handles session-based exits, Friday close protection, and weekend trading restrictions
 */

import { exnessAPI } from './exnessApi';
import { orderManager } from './orderManager';
import { capitalPreservationManager, PositionData } from './capitalPreservationManager';

export interface SessionConfig {
  name: string;
  startHour: number; // UTC
  endHour: number;   // UTC
  enabled: boolean;
  maxPositions: number;
}

export interface TimeExitRule {
  ruleId: string;
  name: string;
  type: 'SESSION_END' | 'FRIDAY_CLOSE' | 'WEEKEND_PROTECTION' | 'CUSTOM_TIME';
  targetTime: string; // HH:MM UTC
  daysOfWeek: number[]; // 0=Sunday, 1=Monday, ..., 6=Saturday
  action: 'CLOSE_ALL' | 'CLOSE_HALF' | 'TRAIL_TO_BREAKEVEN' | 'NOTIFY_ONLY';
  enabled: boolean;
}

export interface WeekendProtectionConfig {
  enabled: boolean;
  closeTime: string; // HH:MM UTC before weekend
  closeDays: number[]; // Days to trigger weekend close (typically [5] for Friday)
  notificationHours: number; // Hours before weekend to notify
  retainHedges: boolean; // Keep hedged positions over weekend
}

class TimeBasedExitManager {
  private sessionConfigs: SessionConfig[] = [
    {
      name: 'Asian Session',
      startHour: 0,
      endHour: 9,
      enabled: true,
      maxPositions: 3
    },
    {
      name: 'London Session',
      startHour: 8,
      endHour: 17,
      enabled: true,
      maxPositions: 5
    },
    {
      name: 'New York Session',
      startHour: 13,
      endHour: 22,
      enabled: true,
      maxPositions: 5
    },
    {
      name: 'Overlap Session',
      startHour: 13,
      endHour: 17,
      enabled: true,
      maxPositions: 4
    }
  ];

  private timeExitRules: TimeExitRule[] = [
    {
      ruleId: 'friday-close',
      name: 'Friday Close Protection',
      type: 'FRIDAY_CLOSE',
      targetTime: '21:00',
      daysOfWeek: [5], // Friday
      action: 'CLOSE_ALL',
      enabled: true
    },
    {
      ruleId: 'session-end-asian',
      name: 'Asian Session End',
      type: 'SESSION_END',
      targetTime: '08:30',
      daysOfWeek: [1, 2, 3, 4, 5], // Mon-Fri
      action: 'TRAIL_TO_BREAKEVEN',
      enabled: true
    },
    {
      ruleId: 'session-end-london',
      name: 'London Session End',
      type: 'SESSION_END',
      targetTime: '16:30',
      daysOfWeek: [1, 2, 3, 4, 5], // Mon-Fri
      action: 'TRAIL_TO_BREAKEVEN',
      enabled: true
    },
    {
      ruleId: 'session-end-ny',
      name: 'New York Session End',
      type: 'SESSION_END',
      targetTime: '21:30',
      daysOfWeek: [1, 2, 3, 4, 5], // Mon-Fri
      action: 'CLOSE_ALL',
      enabled: true
    }
  ];

  private weekendProtection: WeekendProtectionConfig = {
    enabled: true,
    closeTime: '21:00',
    closeDays: [5],
    notificationHours: 2,
    retainHedges: false
  };

  private checkInterval: NodeJS.Timeout | null = null;

  async initialize(): Promise<void> {
    console.log('⏰ TimeBasedExitManager: Initializing...');
    this.startMonitoring();
    console.log('✅ TimeBasedExitManager: Initialized successfully');
  }

  private startMonitoring(): void {
    // Check every minute for time-based rules
    this.checkInterval = setInterval(async () => {
      await this.checkTimeBasedRules();
      await this.checkWeekendProtection();
    }, 60000);
  }

  stopMonitoring(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  /**
   * Get current UTC time components
   */
  private getCurrentUTCTime(): { hour: number; minute: number; dayOfWeek: number; dayName: string } {
    const now = new Date();
    return {
      hour: now.getUTCHours(),
      minute: now.getUTCMinutes(),
      dayOfWeek: now.getUTCDay(),
      dayName: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][now.getUTCDay()]
    };
  }

  /**
   * Check and execute time-based exit rules
   */
  async checkTimeBasedRules(): Promise<void> {
    const currentTime = this.getCurrentUTCTime();
    const currentTimeStr = `${currentTime.hour.toString().padStart(2, '0')}:${currentTime.minute.toString().padStart(2, '0')}`;

    for (const rule of this.timeExitRules) {
      if (!rule.enabled) continue;
      if (!rule.daysOfWeek.includes(currentTime.dayOfWeek)) continue;

      // Check if current time matches target time (within 1 minute window)
      if (currentTimeStr === rule.targetTime) {
        console.log(`⏰ Time-based rule triggered: ${rule.name} (${currentTime.dayName} ${currentTimeStr} UTC)`);
        await this.executeTimeExitRule(rule);
      }
    }
  }

  /**
   * Execute a time-based exit rule
   */
  private async executeTimeExitRule(rule: TimeExitRule): Promise<void> {
    const positions = capitalPreservationManager.getManagedPositions();
    if (positions.length === 0) return;

    console.log(`📤 Executing ${rule.name} - Action: ${rule.action} on ${positions.length} positions`);

    switch (rule.action) {
      case 'CLOSE_ALL':
        for (const position of positions) {
          await capitalPreservationManager.fullClose(position.ticket, rule.name);
        }
        break;

      case 'CLOSE_HALF':
        for (const position of positions) {
          await capitalPreservationManager.partialClose(position.ticket, 0.5);
        }
        break;

      case 'TRAIL_TO_BREAKEVEN':
        for (const position of positions) {
          // Only trail to breakeven if in profit
          if (position.profit > 0) {
            await capitalPreservationManager.moveToBreakEven(position.ticket);
          }
        }
        break;

      case 'NOTIFY_ONLY':
        console.log(`📢 Notification: ${rule.name} triggered but no action taken`);
        break;
    }
  }

  /**
   * Check weekend protection rules
   */
  async checkWeekendProtection(): Promise<void> {
    if (!this.weekendProtection.enabled) return;

    const currentTime = this.getCurrentUTCTime();
    const currentTimeStr = `${currentTime.hour.toString().padStart(2, '0')}:${currentTime.minute.toString().padStart(2, '0')}`;

    // Check if today is a close day
    if (!this.weekendProtection.closeDays.includes(currentTime.dayOfWeek)) return;

    // Check if current time is within notification window
    const notificationTime = this.weekendProtection.closeTime;
    const [notifHour] = notificationTime.split(':').map(Number);
    const currentHour = currentTime.hour;

    // Notify X hours before close
    if (currentHour === notifHour - this.weekendProtection.notificationHours) {
      console.log(`🔔 Weekend Protection Notification: Weekend approaching in ${this.weekendProtection.notificationHours} hours`);
      await this.notifyWeekendApproaching();
    }

    // Check if it's time to close for weekend
    if (currentTimeStr === this.weekendProtection.closeTime) {
      console.log('🛡️ Weekend Protection: Closing all positions for weekend');
      await this.closeForWeekend();
    }
  }

  /**
   * Close all positions for weekend
   */
  private async closeForWeekend(): Promise<void> {
    const positions = capitalPreservationManager.getManagedPositions();
    
    if (positions.length === 0) {
      console.log('ℹ️ No positions to close for weekend');
      return;
    }

    // Filter out hedged positions if retainHedges is true
    const positionsToClose = this.weekendProtection.retainHedges
      ? positions.filter(p => {
          // Check if position has an opposite hedge (simplified check)
          const hedgeExists = positions.some(other => 
            other.symbol === p.symbol && 
            other.type !== p.type && 
            other.ticket !== p.ticket
          );
          return !hedgeExists;
        })
      : positions;

    console.log(`📤 Closing ${positionsToClose.length} positions for weekend (${this.weekendProtection.retainHedges ? 'hedges retained' : 'all positions'})`);

    for (const position of positionsToClose) {
      await capitalPreservationManager.fullClose(position.ticket, 'Weekend Protection');
    }

    console.log('✅ All positions closed for weekend');
  }

  /**
   * Send weekend approaching notification
   */
  private async notifyWeekendApproaching(): Promise<void> {
    const positions = capitalPreservationManager.getManagedPositions();
    const positionSummary = positions.map(p => 
      `${p.symbol} ${p.type} @ ${p.openPrice} (P/L: ${p.profit.toFixed(2)})`
    ).join(', ');

    console.log(`🔔 WEEKEND APPROACHING NOTIFICATION:
    - Positions at risk: ${positions.length}
    - Position details: ${positionSummary || 'None'}
    - Weekend close time: ${this.weekendProtection.closeTime} UTC
    `);

    // Log to trading journal if available
    this.logWeekendNotification(positions);
  }

  /**
   * Get current trading session
   */
  getCurrentSession(): SessionConfig | null {
    const currentTime = this.getCurrentUTCTime();

    for (const session of this.sessionConfigs) {
      if (!session.enabled) continue;
      
      // Handle sessions that span midnight
      if (session.startHour > session.endHour) {
        if (currentTime.hour >= session.startHour || currentTime.hour < session.endHour) {
          return session;
        }
      } else {
        if (currentTime.hour >= session.startHour && currentTime.hour < session.endHour) {
          return session;
        }
      }
    }

    return null;
  }

  /**
   * Check if current time is within optimal trading hours (killzone)
   */
  isInOptimalKillzone(): boolean {
    const session = this.getCurrentSession();
    return session !== null;
  }

  /**
   * Get session killzone with optimal trading hours
   */
  getOptimalKillzones(): SessionConfig[] {
    return this.sessionConfigs.filter(s => s.enabled);
  }

  /**
   * Get time until next session end
   */
  getTimeUntilNextSessionEnd(): { hours: number; minutes: number; session: string } | null {
    const currentTime = this.getCurrentUTCTime();
    const currentMinutes = currentTime.hour * 60 + currentTime.minute;

    let closestEndTime = Infinity;
    let closestSession = '';

    for (const session of this.sessionConfigs) {
      if (!session.enabled) continue;
      
      const endMinutes = session.endHour * 60;
      let timeUntilEnd = endMinutes - currentMinutes;

      // Handle sessions that span midnight
      if (session.startHour > session.endHour) {
        timeUntilEnd = (24 * 60 - currentMinutes) + endMinutes;
      }

      // Only consider future session ends
      if (timeUntilEnd > 0 && timeUntilEnd < closestEndTime) {
        closestEndTime = timeUntilEnd;
        closestSession = session.name;
      }
    }

    if (closestEndTime === Infinity) return null;

    return {
      hours: Math.floor(closestEndTime / 60),
      minutes: closestEndTime % 60,
      session: closestSession
    };
  }

  /**
   * Add custom time exit rule
   */
  addTimeExitRule(rule: Omit<TimeExitRule, 'ruleId'>): void {
    const newRule: TimeExitRule = {
      ...rule,
      ruleId: `custom-${Date.now()}`
    };
    this.timeExitRules.push(newRule);
    console.log(`✅ Added custom time exit rule: ${newRule.name}`);
  }

  /**
   * Remove time exit rule
   */
  removeTimeExitRule(ruleId: string): boolean {
    const index = this.timeExitRules.findIndex(r => r.ruleId === ruleId);
    if (index !== -1) {
      this.timeExitRules.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * Update weekend protection config
   */
  updateWeekendProtection(config: Partial<WeekendProtectionConfig>): void {
    this.weekendProtection = { ...this.weekendProtection, ...config };
    console.log('✅ Weekend protection config updated');
  }

  /**
   * Log weekend notification to journal
   */
  private logWeekendNotification(positions: PositionData[]): void {
    // This would integrate with trading journal
    console.log('📝 Weekend notification logged to journal');
  }

  /**
   * Get all active time exit rules
   */
  getTimeExitRules(): TimeExitRule[] {
    return [...this.timeExitRules];
  }

  /**
   * Get all session configs
   */
  getSessionConfigs(): SessionConfig[] {
    return [...this.sessionConfigs];
  }

  /**
   * Update session config
   */
  updateSessionConfig(sessionName: string, updates: Partial<SessionConfig>): boolean {
    const session = this.sessionConfigs.find(s => s.name === sessionName);
    if (session) {
      Object.assign(session, updates);
      return true;
    }
    return false;
  }

  /**
   * Check if trading is allowed at current time
   */
  isTradingAllowed(): boolean {
    // Check if we're in a valid trading session
    const session = this.getCurrentSession();
    if (!session) return false;

    // Check if it's not weekend (except for special weekend sessions)
    const currentTime = this.getCurrentUTCTime();
    if (currentTime.dayOfWeek === 0 || currentTime.dayOfWeek === 6) {
      return false;
    }

    return true;
  }

  /**
   * Get time-based exit status for dashboard
   */
  getStatus(): any {
    const currentSession = this.getCurrentSession();
    const nextSessionEnd = this.getTimeUntilNextSessionEnd();
    const currentTime = this.getCurrentUTCTime();
    const currentTimeStr = `${currentTime.hour.toString().padStart(2, '0')}:${currentTime.minute.toString().padStart(2, '0')}`;

    return {
      currentSession: currentSession?.name || 'None',
      isInOptimalKillzone: this.isInOptimalKillzone(),
      tradingAllowed: this.isTradingAllowed(),
      nextSessionEnd,
      currentTime: currentTimeStr,
      currentDay: currentTime.dayName,
      weekendProtectionEnabled: this.weekendProtection.enabled,
      activeRulesCount: this.timeExitRules.filter(r => r.enabled).length
    };
  }
}

export const timeBasedExitManager = new TimeBasedExitManager();
