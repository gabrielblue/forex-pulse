export interface PriceUpdate {
  symbol: string;
  bid: number;
  ask: number;
  timestamp: Date;
}

export interface DataFeedConfig {
  symbols: string[];
  updateInterval: number;
  enableWebSocket: boolean;
}

class RealTimeDataFeed {
  private isActive = false;
  private websocket: WebSocket | null = null;
  private updateInterval: NodeJS.Timeout | null = null;
  private subscribers: ((update: PriceUpdate) => void)[] = [];
  
  private config: DataFeedConfig = {
    symbols: ['EURUSD', 'GBPUSD', 'USDJPY', 'AUDUSD', 'USDCHF', 'NZDUSD'],
    updateInterval: 1000, // 1 second
    enableWebSocket: true
  };

  private basePrices: Record<string, number> = {
    'EURUSD': 1.0845,
    'GBPUSD': 1.2734,
    'USDJPY': 149.85,
    'AUDUSD': 0.6623,
    'USDCHF': 0.8892,
    'NZDUSD': 0.5987
  };

  async start(): Promise<void> {
    if (this.isActive) return;

    this.isActive = true;
    console.log('Starting real-time data feed...');

    if (this.config.enableWebSocket) {
      await this.initializeWebSocket();
    } else {
      this.startPolling();
    }
  }

  async stop(): Promise<void> {
    this.isActive = false;
    
    if (this.websocket) {
      this.websocket.close();
      this.websocket = null;
    }
    
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
    
    console.log('Real-time data feed stopped');
  }

  private async initializeWebSocket(): Promise<void> {
    // In a real implementation, this would connect to Exness WebSocket API
    // For now, we'll simulate WebSocket behavior with intervals
    console.log('Initializing WebSocket connection...');
    
    this.startPolling();
  }

  private startPolling(): void {
    this.updateInterval = setInterval(() => {
      if (!this.isActive) return;
      
      this.config.symbols.forEach(symbol => {
        const priceUpdate = this.generatePriceUpdate(symbol);
        this.broadcastUpdate(priceUpdate);
      });
    }, this.config.updateInterval);
  }

  private generatePriceUpdate(symbol: string): PriceUpdate {
    const basePrice = this.basePrices[symbol] || 1.0000;
    
    // Generate realistic price movement
    const volatility = 0.0005; // 0.05% volatility
    const change = (Math.random() - 0.5) * volatility;
    const newPrice = basePrice + change;
    
    // Update base price for next iteration
    this.basePrices[symbol] = newPrice;
    
    // Calculate bid/ask with typical spread
    const spread = this.getTypicalSpread(symbol);
    const mid = newPrice;
    const bid = mid - spread / 2;
    const ask = mid + spread / 2;

    return {
      symbol,
      bid,
      ask,
      timestamp: new Date()
    };
  }

  private getTypicalSpread(symbol: string): number {
    const spreads: Record<string, number> = {
      'EURUSD': 0.00015,
      'GBPUSD': 0.00020,
      'USDJPY': 0.015,
      'AUDUSD': 0.00018,
      'USDCHF': 0.00017,
      'NZDUSD': 0.00025
    };
    return spreads[symbol] || 0.0002;
  }

  private broadcastUpdate(update: PriceUpdate): void {
    this.subscribers.forEach(callback => {
      try {
        callback(update);
      } catch (error) {
        console.error('Error in price update callback:', error);
      }
    });
  }

  subscribe(callback: (update: PriceUpdate) => void): () => void {
    this.subscribers.push(callback);
    
    // Return unsubscribe function
    return () => {
      const index = this.subscribers.indexOf(callback);
      if (index > -1) {
        this.subscribers.splice(index, 1);
      }
    };
  }

  async getLatestPrice(symbol: string): Promise<PriceUpdate | null> {
    // Return mock data since we don't have real market data storage
    return this.generatePriceUpdate(symbol);
  }

  async getHistoricalPrices(symbol: string, hours: number = 24): Promise<PriceUpdate[]> {
    // Return mock historical data
    const prices: PriceUpdate[] = [];
    const now = Date.now();
    
    for (let i = 0; i < hours; i++) {
      const timestamp = new Date(now - (i * 60 * 60 * 1000));
      prices.push(this.generatePriceUpdate(symbol));
    }
    
    return prices.reverse();
  }

  updateConfig(newConfig: Partial<DataFeedConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    if (this.isActive) {
      // Restart with new config
      this.stop().then(() => this.start());
    }
  }

  getConfig(): DataFeedConfig {
    return { ...this.config };
  }

  isRunning(): boolean {
    return this.isActive;
  }

  getConnectionStatus(): string {
    if (!this.isActive) return 'Disconnected';
    if (this.websocket) return 'Connected (WebSocket)';
    return 'Connected (Polling)';
  }
}

export const realTimeDataFeed = new RealTimeDataFeed();