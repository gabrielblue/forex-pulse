// Trading system exports
export { exnessAPI } from './exnessApi';
export { orderManager } from './orderManager';

// Types
export type { ExnessCredentials, TradeOrder, AccountInfo, Position } from './exnessApi';
export type { OrderRequest, RiskParameters } from './orderManager';

// Real exports
export { tradingBot } from './tradingBot';
export { signalProcessor } from './signalProcessor';
export { tradeExecutor } from './tradeExecutor';

// Initialize trading system
export const initializeTradingSystem = async () => {
	try {
		const { orderManager } = await import('./orderManager');
		await orderManager.initialize();
		console.log('Trading system initialized');
		return true;
	} catch (error) {
		console.error('Failed to initialize trading system:', error);
		return false;
	}
};

// Cleanup trading system
export const cleanupTradingSystem = async () => {
	try {
		console.log('Cleaning up trading system...');
		const { tradingBot } = await import('./tradingBot');
		await tradingBot.stopBot();
		console.log('Trading system cleaned up');
	} catch (error) {
		console.error('Error during cleanup:', error);
	}
};