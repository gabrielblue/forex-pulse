import { supabase } from '@/integrations/supabase/client';
import { exnessAPI, TradeOrder } from './exnessApi';

export interface OrderRequest {
	symbol: string;
	type: 'BUY' | 'SELL';
	volume: number;
	stopLoss?: number;
	takeProfit?: number;
	comment?: string;
	// Regime/Signal metadata for dynamic sizing
	regimeExpectancy?: number; // 0-100 scale
	regime?: string;
	signalConfidence?: number; // 0-100 scale
}

export interface RiskParameters {
	maxRiskPerTrade: number;
	maxDailyLoss: number;
	maxDrawdown: number;
	maxPositionSize: number;
	maxConcurrentPositions: number;
	useStopLoss: boolean;
	useTakeProfit: boolean;
	minAccountBalance: number;
	minMarginLevel: number;
	maxLeverage: number;
	emergencyStopEnabled: boolean;
}

// Regime-based boost configuration persisted in Supabase bot_settings
interface RegimeBoostConfig {
	enabled: boolean;
	threshold: number; // expectancy threshold (0-100)
	minBoostPct: number; // e.g., 0.10 for +10%
	maxBoostPct: number; // e.g., 0.20 for +20%
}

class OrderManager {
	private isAutoTradingEnabled = false;
	private riskParams: RiskParameters = {
		maxRiskPerTrade: 1.0, // 1% for real trading
		maxDailyLoss: 3.0, // 3% for real trading
		maxDrawdown: 10.0,
		maxPositionSize: 2.0, // Max 2 lots for safety
		maxConcurrentPositions: 3, // Max 3 positions
		useStopLoss: true,
		useTakeProfit: true,
		minAccountBalance: 100, // $100 minimum
		minMarginLevel: 200, // 200% minimum margin level
		maxLeverage: 500, // Max 1:500 leverage
		emergencyStopEnabled: true
	};

	private regimeBoostConfig: RegimeBoostConfig = {
		enabled: false,
		threshold: 85,
		minBoostPct: 0.10,
		maxBoostPct: 0.20
	};

	private lastOrderTime: number = 0;
	private minOrderInterval: number = 30000; // 30 seconds between orders
	private dailyTradeCount: number = 0;
	private maxDailyTrades: number = 10;

	async initialize(): Promise<void> {
		await this.loadRiskParameters();
		await this.resetDailyCounters();
		console.log('OrderManager initialized with enhanced risk parameters for real trading');
	}

	private async loadRiskParameters(): Promise<void> {
		try {
			const { data: { user } } = await supabase.auth.getUser();
			if (!user) return;

			const { data: botSettings } = await supabase
				.from('bot_settings')
				.select('*')
				.eq('user_id', user.id)
				.single();

			if (botSettings) {
				// Override with user settings but keep conservative limits for real trading
				this.riskParams = {
					maxRiskPerTrade: Math.min(parseFloat(botSettings.max_risk_per_trade?.toString() || '1'), 2.0), // Max 2%
					maxDailyLoss: Math.min(parseFloat(botSettings.max_daily_loss?.toString() || '3'), 5.0), // Max 5%
					maxDrawdown: 15.0,
					maxPositionSize: Math.min(parseFloat(botSettings.max_risk_per_trade?.toString() || '1') * 2, 2.0), // Max 2 lots
					maxConcurrentPositions: Math.min(parseInt(botSettings.max_daily_trades?.toString() || '3'), 5), // Max 5 positions
					useStopLoss: true, // Always required for real trading
					useTakeProfit: true,
					minAccountBalance: 100,
					minMarginLevel: 200,
					maxLeverage: 500,
					emergencyStopEnabled: true
				};
				
				this.maxDailyTrades = Math.min(parseInt(botSettings.max_daily_trades?.toString() || '10'), 20);

				// Load regime-based boost config if present; keep safe defaults
				this.regimeBoostConfig = {
					enabled: Boolean(botSettings.enable_regime_boost ?? false),
					threshold: Math.max(0, Math.min(100, parseFloat(botSettings.regime_expectancy_threshold?.toString() || '85'))),
					minBoostPct: Math.max(0, Math.min(0.5, parseFloat(botSettings.volume_boost_min?.toString() || '0.10'))),
					maxBoostPct: Math.max(0, Math.min(0.5, parseFloat(botSettings.volume_boost_max?.toString() || '0.20')))
				};
			}
			
			console.log('Enhanced risk parameters loaded for real trading:', this.riskParams);
			console.log('Regime boost configuration:', this.regimeBoostConfig);
		} catch (error) {
			console.error('Failed to load risk parameters:', error);
		}
	}

	private async resetDailyCounters(): Promise<void> {
		const today = new Date().toDateString();
		const lastReset = localStorage.getItem('lastDailyReset');
		
		if (lastReset !== today) {
			this.dailyTradeCount = 0;
			localStorage.setItem('lastDailyReset', today);
			console.log('Daily trade counters reset');
		} else {
			// Load today's trade count
			const { data: { user } } = await supabase.auth.getUser();
			if (user) {
				const { data: trades } = await supabase
					.from('live_trades')
					.select('id')
					.eq('user_id', user.id)
					.gte('opened_at', new Date().toISOString().split('T')[0]);
				
				this.dailyTradeCount = trades?.length || 0;
			}
		}
	}

	setAutoTrading(enabled: boolean): void {
		this.isAutoTradingEnabled = enabled;
		console.log(`Auto trading ${enabled ? 'enabled' : 'disabled'}`);
	}

	isAutoTradingActive(): boolean {
		return this.isAutoTradingEnabled;
	}

	async executeOrder(orderRequest: OrderRequest): Promise<string | null> {
		try {
			// Ensure we're connected to real Exness account
			if (!exnessAPI.isConnectedToExness()) {
				throw new Error('Not connected to Exness account. Please connect first.');
			}

			// Enhanced risk checks for real money trading
			const riskCheckResult = await this.performEnhancedRiskChecks(orderRequest);
			if (!riskCheckResult.allowed) {
				console.error('Enhanced risk check failed:', riskCheckResult.reason);
				throw new Error(`Risk Management: ${riskCheckResult.reason}`);
			}

			// Calculate optimal position size based on enhanced risk parameters
			const adjustedVolume = await this.calculateOptimalPositionSize(orderRequest);
			if (adjustedVolume <= 0) {
				throw new Error('Calculated position size is too small or invalid');
			}

			// Enhanced order preparation with automatic risk management
			const enhancedOrder: TradeOrder = {
				symbol: orderRequest.symbol,
				type: orderRequest.type,
				volume: adjustedVolume,
				stopLoss: orderRequest.stopLoss,
				takeProfit: orderRequest.takeProfit,
				comment: orderRequest.comment || `ForexPro-${Date.now()}`
			};

			// Execute order through real Exness API
			const ticket = await exnessAPI.placeOrder(enhancedOrder);
			
			if (ticket) {
				// Update counters
				this.lastOrderTime = Date.now();
				this.dailyTradeCount++;
				
				// Log successful execution
				await this.logOrderExecution(enhancedOrder, ticket, 'SUCCESS');
				await this.updatePerformanceMetrics();
				
				console.log(`✅ Order executed successfully: ${ticket}`);
				
				return ticket;
			} else {
				throw new Error('Order execution failed - no ticket returned from Exness');
			}

		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : 'Unknown error';
			console.error('❌ Order execution failed:', errorMessage);
			await this.logOrderExecution(orderRequest, null, 'FAILED', errorMessage);
			throw error;
		}
	}

	private async performEnhancedRiskChecks(orderRequest: OrderRequest): Promise<{allowed: boolean, reason?: string}> {
		try {
			// Check if Exness is connected for real trading
			if (!exnessAPI.isConnectedToExness()) {
				return { allowed: false, reason: 'Not connected to Exness account' };
			}

			// Get real account status from Exness
			const accountStatus = await this.getAccountStatus();
			if (!accountStatus.accountInfo) {
				return { allowed: false, reason: 'Unable to get account information from Exness' };
			}

			const accountType = exnessAPI.getAccountType();
			console.log(`🔍 Performing enhanced risk checks for ${accountType?.toUpperCase()} account...`);

			// Enhanced daily loss protection for real money
			if (this.riskParams.maxDailyLoss > 0) {
				const dailyLoss = await this.getDailyLoss();
				const dailyLossPercentage = (Math.abs(dailyLoss) / accountStatus.accountInfo.balance) * 100;
				
				if (dailyLossPercentage >= this.riskParams.maxDailyLoss) {
					return { allowed: false, reason: `Daily loss limit reached (${dailyLossPercentage.toFixed(2)}%)` };
				}
			}

			// Check minimum account balance
			if (accountStatus.accountInfo.balance < this.riskParams.minAccountBalance) {
				return { allowed: false, reason: `Account balance below minimum: $${this.riskParams.minAccountBalance}` };
			}

			// Check margin level
			if (accountStatus.accountInfo.marginLevel < this.riskParams.minMarginLevel) {
				return { allowed: false, reason: `Margin level too low: ${accountStatus.accountInfo.marginLevel}%` };
			}

			// Cooldown between orders
			if (Date.now() - this.lastOrderTime < this.minOrderInterval) {
				return { allowed: false, reason: 'Too many orders in short time - cooldown active' };
			}

			// Daily trade count limit
			if (this.dailyTradeCount >= this.maxDailyTrades) {
				return { allowed: false, reason: `Max daily trades reached (${this.maxDailyTrades})` };
			}

			// Enhanced position size validation for real trading
			const requiredMargin = await this.calculateRequiredMargin(orderRequest, accountStatus.accountInfo);
			const riskPercentage = (requiredMargin / accountStatus.accountInfo.equity) * 100; // Use equity instead of balance
			
			if (riskPercentage > this.riskParams.maxRiskPerTrade * 2) { // Absolute cap regardless of sizing logic
				return { allowed: false, reason: `Required margin exceeds risk cap (${riskPercentage.toFixed(2)}%)` };
			}

			// Check minimum lot size
			if (orderRequest.volume < 0.01) {
				return { allowed: false, reason: 'Order volume too small (minimum: 0.01 lots)' };
			}

			// Check maximum lot size
			if (orderRequest.volume > this.riskParams.maxPositionSize) {
				return { allowed: false, reason: `Order volume too large: ${orderRequest.volume} (max: ${this.riskParams.maxPositionSize} lots)` };
			}

			return { allowed: true };
		} catch (error) {
			console.error('Error performing enhanced risk checks:', error);
			return { allowed: false, reason: 'Unexpected error in risk checks' };
		}
	}

	private async calculateRequiredMargin(orderRequest: OrderRequest, accountInfo: any): Promise<number> {
		try {
			const symbolInfo = await exnessAPI.getSymbolInfo(orderRequest.symbol);
			const currentPrice = await exnessAPI.getCurrentPrice(orderRequest.symbol);
			if (!symbolInfo || !currentPrice) {
				throw new Error('Unable to get symbol or price info for margin calc');
			}

			const contractSize = symbolInfo.contractSize || 100000;
			const leverage = Math.min(accountInfo.leverage || 500, this.riskParams.maxLeverage);
			const priceToUse = orderRequest.type === 'BUY' ? currentPrice.ask : currentPrice.bid;
			const isJPYPair = orderRequest.symbol.includes('JPY');
			const adjustedPrice = isJPYPair ? priceToUse / 100 : priceToUse;
			
			const positionValue = orderRequest.volume * contractSize * adjustedPrice;
			const requiredMargin = positionValue / leverage;
			
			console.log('Enhanced margin calculation:', {
				symbol: orderRequest.symbol,
				volume: orderRequest.volume,
				price: priceToUse,
				leverage,
				positionValue,
				requiredMargin,
				isJPYPair
			});
			
			return requiredMargin;
		} catch (error) {
			console.error('Error calculating required margin:', error);
			// Return conservative estimate
			return orderRequest.volume * 1000; // $1000 per lot conservative estimate
		}
	}

	private async calculateOptimalPositionSize(orderRequest: OrderRequest): Promise<number> {
		try {
			const accountInfo = await exnessAPI.getAccountInfo();
			if (!accountInfo) {
				throw new Error('Unable to get real account information');
			}

			// Enhanced position sizing for real money trading
			// Use equity instead of balance for more conservative approach
			const availableCapital = accountInfo.equity;
			const riskAmount = (availableCapital * this.riskParams.maxRiskPerTrade) / 100;
			
			console.log('Optimal position sizing - Available capital:', availableCapital, 'Risk amount:', riskAmount);

			// Get real-time price for accurate calculations
			const currentPrice = await exnessAPI.getCurrentPrice(orderRequest.symbol);
			if (!currentPrice) {
				throw new Error('Unable to get current market price for position sizing');
			}

			// Calculate stop loss distance in pips
			let stopLossDistance = 30; // Default 30 pips
			if (orderRequest.stopLoss) {
				const pipValue = this.getPipValue(orderRequest.symbol);
				const priceToUse = orderRequest.type === 'BUY' ? currentPrice.ask : currentPrice.bid;
				stopLossDistance = Math.abs(priceToUse - orderRequest.stopLoss) / pipValue;
			}

			// Ensure minimum stop loss distance for safety
			stopLossDistance = Math.max(stopLossDistance, 20); // Minimum 20 pips
			stopLossDistance = Math.min(stopLossDistance, 100); // Maximum 100 pips

			// Calculate position size based on risk management
			const pipValue = this.getPipValue(orderRequest.symbol);
			const dollarPerPip = pipValue * 100000; // Standard lot pip value
			
			// Position size = Risk Amount / (Stop Loss Distance * Dollar Per Pip)
			let positionSize = riskAmount / (stopLossDistance * dollarPerPip);

			// Apply conservative multiplier for real trading
			const conservativeMultiplier = accountInfo.isDemo ? 1.0 : 0.5; // Use only 50% of calculated size for live accounts
			positionSize *= conservativeMultiplier;

			// Apply regime-based boost (bounded by clamps below)
			const expectancy = (orderRequest.regimeExpectancy ?? orderRequest.signalConfidence ?? 0);
			if (this.regimeBoostConfig.enabled && expectancy >= this.regimeBoostConfig.threshold) {
				const excess = Math.max(0, Math.min(100, expectancy)) - this.regimeBoostConfig.threshold;
				const range = Math.max(1, 100 - this.regimeBoostConfig.threshold);
				const t = excess / range; // 0..1 scale beyond threshold
				const boostPct = this.regimeBoostConfig.minBoostPct + t * (this.regimeBoostConfig.maxBoostPct - this.regimeBoostConfig.minBoostPct);
				const boostFactor = 1 + boostPct;
				positionSize *= boostFactor;
				console.log('Regime boost applied:', {
					regime: orderRequest.regime,
					expectancy,
					threshold: this.regimeBoostConfig.threshold,
					boostPct: parseFloat((boostPct * 100).toFixed(2))
				});
			}

			// Enhanced position size limits for real trading
			const minSize = 0.01;
			const maxSize = Math.min(
				this.riskParams.maxPositionSize, // Maximum from settings
				(accountInfo.freeMargin / 3000), // Very conservative margin usage
				(availableCapital / 20000), // Max position based on capital
				accountInfo.isDemo ? 10.0 : 1.0 // Demo: up to 10 lots, Live: up to 1 lot
			);
			
			const adjustedSize = Math.max(minSize, Math.min(maxSize, positionSize));
			
			console.log('Enhanced position size calculation:', {
				availableCapital,
				riskAmount,
				stopLossDistance,
				currentPrice: currentPrice.ask,
				pipValue,
				calculatedSize: positionSize,
				adjustedSize,
				conservativeMultiplier,
				accountType: accountInfo.isDemo ? 'DEMO' : 'LIVE'
			});

			return parseFloat(adjustedSize.toFixed(2));

		} catch (error) {
			console.error('Error calculating optimal position size for real trading:', error);
			return 0.01; // Return minimum size on error for safety
		}
	}

	private calculateOptimalStopLoss(price: number, type: 'BUY' | 'SELL', symbol: string): number {
		// Enhanced stop loss calculation based on volatility and symbol characteristics
		const pipValue = this.getPipValue(symbol);
		
		// Different stop loss distances for different symbol types
		let stopLossPips: number;
		if (symbol.includes('JPY')) {
			stopLossPips = 40; // 40 pips for JPY pairs (more volatile)
		} else if (['GBPUSD', 'GBPJPY', 'EURGBP'].some(pair => symbol.includes(pair.replace('/', '')))) {
			stopLossPips = 35; // 35 pips for GBP pairs (volatile)
		} else {
			stopLossPips = 30; // 30 pips for major pairs
		}
		
		if (type === 'BUY') {
			return price - (stopLossPips * pipValue);
		} else {
			return price + (stopLossPips * pipValue);
		}
	}

	private calculateOptimalTakeProfit(price: number, type: 'BUY' | 'SELL', symbol: string): number {
		// Enhanced take profit calculation with 2:1 risk-reward ratio
		const pipValue = this.getPipValue(symbol);
		
		// Calculate take profit based on stop loss distance
		let takeProfitPips: number;
		if (symbol.includes('JPY')) {
			takeProfitPips = 80; // 2:1 ratio for JPY pairs
		} else if (['GBPUSD', 'GBPJPY', 'EURGBP'].some(pair => symbol.includes(pair.replace('/', '')))) {
			takeProfitPips = 70; // 2:1 ratio for GBP pairs
		} else {
			takeProfitPips = 60; // 2:1 ratio for major pairs
		}
		
		if (type === 'BUY') {
			return price + (takeProfitPips * pipValue);
		} else {
			return price - (takeProfitPips * pipValue);
		}
	}

	private getPipValue(symbol: string): number {
		// Enhanced pip value calculation
		const pipValues: Record<string, number> = {
			'EURUSD': 0.0001,
			'GBPUSD': 0.0001,
			'AUDUSD': 0.0001,
			'NZDUSD': 0.0001,
			'USDCHF': 0.0001,
			'USDCAD': 0.0001,
			'USDJPY': 0.01,
			'EURJPY': 0.01,
			'GBPJPY': 0.01,
			'CHFJPY': 0.01,
			'AUDJPY': 0.01,
			'NZDJPY': 0.01,
			'CADJPY': 0.01
		};
		
		return pipValues[symbol] || (symbol.includes('JPY') ? 0.01 : 0.0001);
	}

	private async getDailyLoss(): Promise<number> {
		try {
			const { data: { user } } = await supabase.auth.getUser();
			if (!user) return 0;

			const today = new Date().toISOString().split('T')[0];
			
			// Calculate daily P&L from live_trades
			const { data: trades } = await supabase
				.from('live_trades')
				.select('profit')
				.eq('user_id', user.id)
				.gte('opened_at', today);

			const dailyProfit = trades?.reduce((sum, trade) => 
				sum + (parseFloat(trade.profit?.toString() || '0')), 0) || 0;

			return dailyProfit;
		} catch (error) {
			console.error('Failed to get daily loss:', error);
			return 0;
		}
	}

	private async logOrderExecution(
		orderRequest: OrderRequest, 
		orderId: string | null, 
		status: string, 
		errorMessage?: string
	): Promise<void> {
		try {
			const { data: { user } } = await supabase.auth.getUser();
			if (!user) return;

			const accountType = exnessAPI.getAccountType();
			
			// Enhanced logging for real trading
			console.log('📝 Enhanced order execution log:', {
				user_id: user.id,
				account_type: accountType,
				order_request: orderRequest,
				order_id: orderId,
				status,
				error_message: errorMessage,
				daily_trade_count: this.dailyTradeCount,
				timestamp: new Date().toISOString()
			});

			// Store in database for audit trail
			// You might want to create a trading_logs table for this
		} catch (error) {
			console.error('Failed to log order execution:', error);
		}
	}

	private async updatePerformanceMetrics(): Promise<void> {
		try {
			const { data: { user } } = await supabase.auth.getUser();
			if (!user) return;

			// Update user portfolio with latest performance
			const accountInfo = await exnessAPI.getAccountInfo();
			if (accountInfo) {
				await supabase
					.from('user_portfolios')
					.upsert({
						user_id: user.id,
						account_type: accountInfo.isDemo ? 'PAPER' : 'LIVE',
						balance: accountInfo.balance,
						equity: accountInfo.equity,
						margin_used: accountInfo.margin,
						free_margin: accountInfo.freeMargin,
						margin_level: accountInfo.marginLevel,
						total_pnl: accountInfo.profit,
						daily_pnl: await this.getDailyLoss(),
						total_trades: this.dailyTradeCount,
						updated_at: new Date().toISOString()
					});
			}

			console.log('📊 Performance metrics updated');
		} catch (error) {
			console.error('Failed to update performance metrics:', error);
		}
	}

	async getOpenPositions() {
		try {
			// Get positions from Exness API
			const exnessPositions = await exnessAPI.getPositions();
			
			// Sync with local database
			await this.syncPositionsWithDatabase(exnessPositions);
			
			return exnessPositions;
		} catch (error) {
			console.error('Failed to get open positions:', error);
			return [];
		}
	}

	private async syncPositionsWithDatabase(positions: any[]): Promise<void> {
		try {
			const { data: { user } } = await supabase.auth.getUser();
			if (!user) return;

			// Update existing positions or create new ones
			for (const position of positions) {
				await supabase
					.from('live_trades')
					.upsert({
						user_id: user.id,
						ticket_id: position.ticketId,
						symbol: position.symbol,
						trade_type: position.type,
						lot_size: position.volume,
						entry_price: position.openPrice,
						current_price: position.currentPrice,
						profit: position.profit,
						profit_pips: this.calculatePips(position.openPrice, position.currentPrice, position.symbol, position.type),
						stop_loss: position.stopLoss,
						take_profit: position.takeProfit,
						status: 'OPEN',
						commission: position.commission,
						swap: position.swap,
						opened_at: position.openTime.toISOString(),
						updated_at: new Date().toISOString()
					});
			}
			
			console.log(`📊 Synced ${positions.length} positions with database`);
		} catch (error) {
			console.error('Failed to sync positions with database:', error);
		}
	}

	private calculatePips(openPrice: number, currentPrice: number, symbol: string, type: string): number {
		const pipValue = this.getPipValue(symbol);
		const priceDiff = type === 'BUY' ? currentPrice - openPrice : openPrice - currentPrice;
		return priceDiff / pipValue;
	}

	async closePosition(ticket: number): Promise<boolean> {
		try {
			console.log(`🔒 Closing position ${ticket} on Exness...`);
			
			const success = await exnessAPI.closePosition(ticket);
			
			if (success) {
				// Update local database
				const { data: { user } } = await supabase.auth.getUser();
				if (user) {
					await supabase
						.from('live_trades')
						.update({
							status: 'CLOSED',
							closed_at: new Date().toISOString(),
							updated_at: new Date().toISOString()
						})
						.eq('ticket_id', ticket.toString())
						.eq('user_id', user.id);
				}
				
				console.log(`✅ Position ${ticket} closed successfully`);
			}
			
			return success;
		} catch (error) {
			console.error('Failed to close position:', error);
			return false;
		}
	}

	async closeAllPositions(): Promise<void> {
		try {
			console.log('🔒 Closing all positions...');
			
			const positions = await this.getOpenPositions();
			
			if (positions.length === 0) {
				console.log('No positions to close');
				return;
			}
			
			const closePromises = positions.map(position => 
				this.closePosition(position.ticket)
			);
			
			const results = await Promise.allSettled(closePromises);
			
			const successCount = results.filter(result => 
				result.status === 'fulfilled' && result.value === true
			).length;
			
			console.log(`✅ Closed ${successCount} out of ${positions.length} positions`);
			
		} catch (error) {
			console.error('Failed to close all positions:', error);
		}
	}

	// Enhanced method to get real-time account status
	async getAccountStatus(): Promise<any> {
		try {
			const accountInfo = await exnessAPI.getAccountInfo();
			const positions = await this.getOpenPositions();
			
			return {
				accountInfo,
				openPositions: positions.length,
				totalUnrealizedPnL: positions.reduce((sum, pos) => sum + pos.profit, 0),
				isConnected: exnessAPI.isConnectedToExness(),
				connectionStatus: exnessAPI.getConnectionStatus(),
				dailyTradeCount: this.dailyTradeCount,
				maxDailyTrades: this.maxDailyTrades,
				riskParameters: this.riskParams
			};
		} catch (error) {
			console.error('Failed to get account status:', error);
			return null;
		}
	}

	// Method to validate if we can trade a specific symbol
	async canTradeSymbol(symbol: string): Promise<boolean> {
		try {
			const price = await exnessAPI.getCurrentPrice(symbol);
			const marketOpen = await exnessAPI.isMarketOpen(symbol);
			return price !== null && marketOpen;
		} catch (error) {
			console.error(`Cannot trade symbol ${symbol}:`, error);
			return false;
		}
	}

	async emergencyStop(): Promise<void> {
		const accountType = exnessAPI.getAccountType();
		console.log(`🚨 EMERGENCY STOP ACTIVATED for ${accountType?.toUpperCase()} account`);
		
		try {
			// Disable auto trading immediately
			this.setAutoTrading(false);
			
			// Close all positions
			await this.closeAllPositions();
			
			// Reset daily counters to prevent further trading
			this.dailyTradeCount = this.maxDailyTrades;
			
			// Log emergency stop
			const { data: { user } } = await supabase.auth.getUser();
			if (user) {
				console.log('🚨 Emergency stop executed for user:', user.id);
				
				// Update bot settings to disable
				await supabase
					.from('bot_settings')
					.update({
						is_active: false,
						updated_at: new Date().toISOString()
					})
					.eq('user_id', user.id);
			}
		} catch (error) {
			console.error('Emergency stop failed:', error);
		}
	}

	// Method to get trading statistics
	async getTradingStatistics(): Promise<any> {
		try {
			const { data: { user } } = await supabase.auth.getUser();
			if (!user) return null;

			const { data: trades } = await supabase
				.from('live_trades')
				.select('*')
				.eq('user_id', user.id)
				.order('opened_at', { ascending: false })
				.limit(100);

			if (!trades || trades.length === 0) {
				return {
					totalTrades: 0,
					winRate: 0,
					totalProfit: 0,
					averageProfit: 0,
					maxDrawdown: 0,
					profitFactor: 0
				};
			}

			const closedTrades = trades.filter(t => t.status === 'CLOSED');
			const winningTrades = closedTrades.filter(t => parseFloat(t.profit?.toString() || '0') > 0);
			const losingTrades = closedTrades.filter(t => parseFloat(t.profit?.toString() || '0') < 0);
			
			const totalProfit = closedTrades.reduce((sum, t) => sum + parseFloat(t.profit?.toString() || '0'), 0);
			const grossProfit = winningTrades.reduce((sum, t) => sum + parseFloat(t.profit?.toString() || '0'), 0);
			const grossLoss = Math.abs(losingTrades.reduce((sum, t) => sum + parseFloat(t.profit?.toString() || '0'), 0));
			
			return {
				totalTrades: closedTrades.length,
				winRate: closedTrades.length > 0 ? (winningTrades.length / closedTrades.length) * 100 : 0,
				totalProfit,
				averageProfit: closedTrades.length > 0 ? totalProfit / closedTrades.length : 0,
				grossProfit,
				grossLoss,
				profitFactor: grossLoss > 0 ? grossProfit / grossLoss : 0,
				winningTrades: winningTrades.length,
				losingTrades: losingTrades.length,
				dailyTradeCount: this.dailyTradeCount,
				maxDailyTrades: this.maxDailyTrades
			};
		} catch (error) {
			console.error('Failed to get trading statistics:', error);
			return null;
		}
	}

	// Method to update risk parameters
	updateRiskParameters(newParams: Partial<RiskParameters>): void {
		this.riskParams = { ...this.riskParams, ...newParams };
		console.log('Risk parameters updated:', this.riskParams);
	}

	getRiskParameters(): RiskParameters {
		return { ...this.riskParams };
	}
}

const orderManager = new OrderManager();
export { orderManager };
export type { TradeOrder } from './exnessApi';