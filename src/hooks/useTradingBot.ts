import { useState, useEffect } from 'react';
import { tradingBot, BotStatus, BotConfiguration } from '@/lib/trading/tradingBot';
import { ExnessCredentials } from '@/lib/trading/exnessApi';

export const useTradingBot = () => {
  const [status, setStatus] = useState<BotStatus>({
    isActive: false,
    isConnected: false,
    autoTradingEnabled: false,
    lastUpdate: new Date(),
    totalTrades: 0,
    winRate: 0,
    dailyPnL: 0,
    weeklyPnL: 0
  });

  const [configuration, setConfiguration] = useState<BotConfiguration>({
    minConfidence: 80,
    maxRiskPerTrade: 2,
    maxDailyLoss: 5,
    enabledPairs: ['EURUSD', 'GBPUSD', 'USDJPY'],
    tradingHours: {
      start: '00:00',
      end: '23:59',
      timezone: 'UTC'
    },
    useStopLoss: true,
    useTakeProfit: true,
    emergencyStopEnabled: true
  });

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    initializeBot();
    
    // Update status every 30 seconds - keep running even when component unmounts
    const interval = setInterval(updateStatus, 30000);
    
    // Don't clear interval on unmount to keep bot persistent
    return () => {
      // Only clear if explicitly stopping the bot
      if (!status.isActive) {
        clearInterval(interval);
      }
    };
  }, []);

  const initializeBot = async () => {
    try {
      setIsLoading(true);
      await tradingBot.initialize();
      updateStatus();
      updateConfiguration();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to initialize bot');
    } finally {
      setIsLoading(false);
    }
  };

  const updateStatus = () => {
    const currentStatus = tradingBot.getStatus();
    setStatus(currentStatus);
  };

  const updateConfiguration = () => {
    const currentConfig = tradingBot.getConfiguration();
    setConfiguration(currentConfig);
  };

  const connectToExness = async (credentials: ExnessCredentials): Promise<boolean> => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Connect directly through exnessAPI
      const connected = await exnessAPI.connect(credentials);
      updateStatus();
      
      if (!connected) {
        setError('Failed to connect to Exness. Please check your credentials.');
      }
      
      return connected;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Connection failed';
      setError(errorMessage);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const startBot = async (): Promise<void> => {
    try {
      setIsLoading(true);
      setError(null);
      
      await tradingBot.startBot();
      updateStatus();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to start bot';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const stopBot = async (): Promise<void> => {
    try {
      setIsLoading(true);
      setError(null);
      
      await tradingBot.stopBot();
      updateStatus();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to stop bot';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const enableAutoTrading = async (enabled: boolean): Promise<void> => {
    try {
      setError(null);
      
      await tradingBot.enableAutoTrading(enabled);
      updateStatus();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to toggle auto trading';
      setError(errorMessage);
      throw err;
    }
  };

  const updateBotConfiguration = async (config: Partial<BotConfiguration>): Promise<void> => {
    try {
      setError(null);
      
      await tradingBot.updateConfiguration(config);
      updateConfiguration();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update configuration';
      setError(errorMessage);
      throw err;
    }
  };

  const emergencyStop = async (): Promise<void> => {
    try {
      setError(null);
      
      await tradingBot.emergencyStop('Manual emergency stop');
      updateStatus();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Emergency stop failed';
      setError(errorMessage);
      throw err;
    }
  };

  const generateTestSignal = async (): Promise<void> => {
    try {
      setError(null);
      
      await tradingBot.generateTestSignal();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to generate test signal';
      setError(errorMessage);
      throw err;
    }
  };

  const closeAllPositions = async (): Promise<void> => {
    try {
      setError(null);
      
      await tradingBot.closeAllPositions();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to close positions';
      setError(errorMessage);
      throw err;
    }
  };

  return {
    status,
    configuration,
    isLoading,
    error,
    connectToExness,
    startBot,
    stopBot,
    enableAutoTrading,
    updateConfiguration: updateBotConfiguration,
    emergencyStop,
    generateTestSignal,
    closeAllPositions,
    clearError: () => setError(null)
  };
};