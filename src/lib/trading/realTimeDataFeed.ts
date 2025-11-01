import { exnessAPI } from './exnessApi';

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
  private updateInterval: NodeJS.Timeout | null = null;
  private subscribers: ((update: PriceUpdate) => void)[] = [];
  
  private config: DataFeedConfig = {
    symbols: ['EURUSD', 'GBPUSD', 'USDJPY', 'AUDUSD', 'USDCHF', 'NZDUSD', 'XAUUSD', 'EURJPY', 'GBPJPY', 'USDCAD'],
    updateInterval: 1000, // 1 second
    enableWebSocket: false // Use polling with real Exness data
  };

  async start(): Promise<void> {
    if (this.isActive) return;

    // Verify Exness connection
    if (!exnessAPI.isConnectedToExness()) {
      console.error('❌ Cannot start data feed - not connected to Exness');
      return;
    }

    this.isActive = true;
    console.log('🚀 Starting REAL-TIME data feed from Exness...');

    this.startPolling();
  }

  async stop(): Promise<void> {
    this.isActive = false;
    
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
    
    console.log('⏸️ Real-time data feed stopped');
  }

  private startPolling(): void {
    this.updateInterval = setInterval(async () => {
      if (!this.isActive) return;
      
      for (const symbol of this.config.symbols) {
        try {
          const priceUpdate = await this.fetchRealPrice(symbol);
          if (priceUpdate) {
            this.broadcastUpdate(priceUpdate);
          }
        } catch (error) {
          console.error(`Error fetching price for ${symbol}:`, error);
        }
      }
    }, this.config.updateInterval);
  }

  private async fetchRealPrice(symbol: string): Promise<PriceUpdate | null> {
    try {
      // Get REAL price from Exness API
      const marketPrice = await exnessAPI.getCurrentPrice(symbol);
      
      if (!marketPrice) {
        return null;
      }

      return {
        symbol: marketPrice.symbol,
        bid: marketPrice.bid,
        ask: marketPrice.ask,
        timestamp: marketPrice.timestamp
      };
    } catch (error) {
      console.error(`Failed to fetch REAL price for ${symbol}:`, error);
      return null;
    }
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
    
    return () => {
      const index = this.subscribers.indexOf(callback);
      if (index > -1) {
        this.subscribers.splice(index, 1);
      }
    };
  }

  async getLatestPrice(symbol: string): Promise<PriceUpdate | null> {
    // Fetch REAL latest price from Exness
    return await this.fetchRealPrice(symbol);
  }

  async getHistoricalPrices(symbol: string, hours: number = 24): Promise<PriceUpdate[]> {
    try {
      if (!exnessAPI.isConnectedToExness()) {
        console.warn('Cannot fetch historical prices - not connected to Exness');
        return [];
      }

      // Calculate number of bars needed (60 = H1 timeframe, 1 bar per hour)
      const barsNeeded = Math.ceil(hours);

      // Fetch real historical data from MT5
      const historicalData = await exnessAPI.getHistoricalData(symbol, 60, barsNeeded);

      if (!historicalData || historicalData.length === 0) {
        console.warn(`No historical data available for ${symbol}`);
        return [];
      }

      // Convert to PriceUpdate format
      const priceUpdates: PriceUpdate[] = historicalData.map((bar: any) => ({
        symbol,
        bid: bar.close,
        ask: bar.close + 0.0001, // Approximate spread
        timestamp: new Date(bar.time * 1000),
        spread: bar.spread || 0
      }));

      console.log(`✅ Fetched ${priceUpdates.length} historical prices for ${symbol}`);
      return priceUpdates;
    } catch (error) {
      console.error(`Failed to fetch historical prices for ${symbol}:`, error);
      return [];
    }
  }

  updateConfig(newConfig: Partial<DataFeedConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    if (this.isActive) {
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
    if (!exnessAPI.isConnectedToExness()) return 'Exness Disconnected';
    return 'Connected (Real-time from Exness)';
  }
}

export const realTimeDataFeed = new RealTimeDataFeed();