// Security validators for input validation and sanitization

export class SecurityValidator {
  // Validate trading parameters
  static validateTradeVolume(volume: number): { valid: boolean; error?: string } {
    if (isNaN(volume) || volume <= 0) {
      return { valid: false, error: 'Invalid trade volume' };
    }
    if (volume > 100) {
      return { valid: false, error: 'Trade volume exceeds maximum limit (100 lots)' };
    }
    if (volume < 0.01) {
      return { valid: false, error: 'Trade volume below minimum (0.01 lots)' };
    }
    return { valid: true };
  }

  // Validate price levels
  static validatePriceLevel(price: number, type: 'stop_loss' | 'take_profit'): { valid: boolean; error?: string } {
    if (isNaN(price) || price < 0) {
      return { valid: false, error: `Invalid ${type.replace('_', ' ')} price` };
    }
    return { valid: true };
  }

  // Validate currency pair symbol
  static validateSymbol(symbol: string): { valid: boolean; error?: string } {
    const validSymbolPattern = /^[A-Z]{6}$/;
    if (!validSymbolPattern.test(symbol)) {
      return { valid: false, error: 'Invalid currency pair symbol format' };
    }
    
    const validPairs = [
      'EURUSD', 'GBPUSD', 'USDJPY', 'USDCHF', 'AUDUSD', 'NZDUSD',
      'USDCAD', 'EURJPY', 'GBPJPY', 'EURGBP', 'XAUUSD', 'XAGUSD'
    ];
    
    if (!validPairs.includes(symbol)) {
      return { valid: false, error: 'Unsupported currency pair' };
    }
    
    return { valid: true };
  }

  // Validate account credentials (basic validation)
  static validateAccountNumber(accountNumber: string): { valid: boolean; error?: string } {
    if (!accountNumber || accountNumber.length < 5) {
      return { valid: false, error: 'Invalid account number' };
    }
    if (!/^\d+$/.test(accountNumber)) {
      return { valid: false, error: 'Account number must contain only digits' };
    }
    return { valid: true };
  }

  // Validate server name
  static validateServerName(server: string): { valid: boolean; error?: string } {
    if (!server || server.length < 3) {
      return { valid: false, error: 'Invalid server name' };
    }
    // Basic validation - should contain alphanumeric and dots/dashes
    if (!/^[a-zA-Z0-9.-]+$/.test(server)) {
      return { valid: false, error: 'Invalid server name format' };
    }
    return { valid: true };
  }

  // Sanitize input strings to prevent XSS
  static sanitizeString(input: string): string {
    return input
      .replace(/[<>]/g, '') // Remove HTML tags
      .replace(/javascript:/gi, '') // Remove javascript: protocol
      .replace(/on\w+\s*=/gi, '') // Remove event handlers
      .trim();
  }

  // Validate risk percentage
  static validateRiskPercentage(risk: number): { valid: boolean; error?: string } {
    if (isNaN(risk) || risk <= 0) {
      return { valid: false, error: 'Invalid risk percentage' };
    }
    if (risk > 10) {
      return { valid: false, error: 'Risk percentage too high (max 10%)' };
    }
    return { valid: true };
  }

  // Validate confidence score
  static validateConfidenceScore(score: number): { valid: boolean; error?: string } {
    if (isNaN(score) || score < 0 || score > 100) {
      return { valid: false, error: 'Confidence score must be between 0 and 100' };
    }
    return { valid: true };
  }

  // Rate limiting check (client-side)
  private static requestCounts: Map<string, { count: number; resetTime: number }> = new Map();
  
  static checkRateLimit(action: string, limit: number = 50, windowMs: number = 30000): boolean {
    const now = Date.now();
    const record = this.requestCounts.get(action);
    
    if (!record || now > record.resetTime) {
      this.requestCounts.set(action, {
        count: 1,
        resetTime: now + windowMs
      });
      return true;
    }
    
    if (record.count >= limit) {
      return false;
    }
    
    record.count++;
    return true;
  }

  // Validate trading session times
  static isValidTradingTime(): { valid: boolean; reason?: string } {
    const now = new Date();
    const day = now.getDay();
    const hour = now.getHours();
    
    // Market closed on weekends
    if (day === 0 || day === 6) {
      return { valid: false, reason: 'Market closed on weekends' };
    }
    
    // Friday early close (simplified)
    if (day === 5 && hour >= 22) {
      return { valid: false, reason: 'Market closing for weekend' };
    }
    
    // Sunday late open (simplified)
    if (day === 0 && hour < 22) {
      return { valid: false, reason: 'Market not yet open' };
    }
    
    return { valid: true };
  }
}

// Password strength validator
export class PasswordValidator {
  static validate(password: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (password.length < 12) {
      errors.push('Password must be at least 12 characters long');
    }
    
    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }
    
    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }
    
    if (!/[0-9]/.test(password)) {
      errors.push('Password must contain at least one number');
    }
    
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      errors.push('Password must contain at least one special character');
    }
    
    // Check for common patterns
    const commonPatterns = ['123456', 'password', 'qwerty', 'abc123', '111111'];
    if (commonPatterns.some(pattern => password.toLowerCase().includes(pattern))) {
      errors.push('Password contains common patterns');
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }
  
  static getStrength(password: string): 'weak' | 'medium' | 'strong' | 'very-strong' {
    let strength = 0;
    
    if (password.length >= 12) strength++;
    if (password.length >= 16) strength++;
    if (/[A-Z]/.test(password) && /[a-z]/.test(password)) strength++;
    if (/[0-9]/.test(password)) strength++;
    if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) strength++;
    if (!/(.)\1{2,}/.test(password)) strength++; // No repeated characters
    
    if (strength <= 2) return 'weak';
    if (strength <= 4) return 'medium';
    if (strength <= 5) return 'strong';
    return 'very-strong';
  }
}