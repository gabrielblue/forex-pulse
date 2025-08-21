import { supabase } from '@/integrations/supabase/client';
import { exnessAPI, TradeOrder } from './exnessApi';
import { portfolioManager } from './portfolioManager';

export interface OrderRequest {
	symbol: string;
	type: 'BUY' | 'SELL';
	volume: number;
	stopLoss?: number;
	takeProfit?: number;
	comment?: string;
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

	private lastOrderTime: number = 0;
	private minOrderInterval: number = 30000; // 30 seconds between orders
	private dailyTradeCount: number = 0;
	private maxDailyTrades: number = 10;
	private peakEquity: number | null = null;
	private maxEquityDrawdownPct: number = 10; // Circuit breaker at 10% equity DD
	private weeklyLossLimitPct: number = 7.0; // weekly de-risk
	private perSymbolMaxConcurrent: Record<string, number> = {};
	private trailingStopPips: number = 20;

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
			}
			
			console.log('Enhanced risk parameters loaded for real trading:', this.riskParams);
		} catch (error) {
			console.error('Failed to load risk parameters:', error);
		}
	}

	private async resetDailyCounters(): Promise<void> {
		const today = new Date().toDateString();
		const storage: any = (typeof localStorage !== 'undefined') ? localStorage : {
			getItem: (_: string) => null,
			setItem: (_k: string, _v: string) => {},
		};
		const lastReset = storage.getItem('lastDailyReset');
		
		if (lastReset !== today) {
			this.dailyTradeCount = 0;
			storage.setItem('lastDailyReset', today);
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

			// Update equity peak and apply equity drawdown circuit breaker
			await this.updateEquityPeak();
			if (await this.isEquityCircuitBreakerTripped()) {
				throw new Error(`Equity drawdown exceeded ${this.maxEquityDrawdownPct}% - trading halted`);
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
					console.warn('⚠️ Daily loss limit reached, stopping trading');
					await this.emergencyStop();
					return { allowed: false, reason: `Daily loss limit reached: ${dailyLossPercentage.toFixed(2)}% (max: ${this.riskParams.maxDailyLoss}%)` };
				}
			}

			// Equity drawdown gate
			if (await this.isEquityCircuitBreakerTripped()) {
				return { allowed: false, reason: `Equity drawdown exceeded ${this.maxEquityDrawdownPct}%` };
			}

			// Enhanced position size validation for real trading
			const requiredMargin = await this.calculateRequiredMargin(orderRequest, accountStatus.accountInfo);
			const riskPercentage = (requiredMargin / accountStatus.accountInfo.equity) * 100; // Use equity instead of balance
			
			if (riskPercentage > this.riskParams.maxRiskPerTrade) {
				return { allowed: false, reason: `Risk per trade too high: ${riskPercentage.toFixed(2)}% (max: ${this.riskParams.maxRiskPerTrade}%)` };
			}

			// Portfolio-level risk gate
			const portfolioGate = await portfolioManager.canAddPosition(orderRequest.symbol, requiredMargin);
			if (!portfolioGate.ok) {
				return { allowed: false, reason: portfolioGate.reason };
			}

			// Ensure minimum account balance for trading
			if (accountStatus.accountInfo.balance < this.riskParams.minAccountBalance) {
				return { allowed: false, reason: `Account balance too low: ${accountStatus.accountInfo.currency} ${accountStatus.accountInfo.balance} (min: $${this.riskParams.minAccountBalance})` };
			}

			// Check margin level - prevent margin calls
			if (accountStatus.accountInfo.marginLevel > 0 && accountStatus.accountInfo.marginLevel < this.riskParams.minMarginLevel) {
				return { allowed: false, reason: `Margin level too low: ${accountStatus.accountInfo.marginLevel.toFixed(1)}% (min: ${this.riskParams.minMarginLevel}%)` };
			}

			// Verify symbol is tradeable
			if (!await this.canTradeSymbol(orderRequest.symbol)) {
				return { allowed: false, reason: `Symbol ${orderRequest.symbol} not tradeable or market closed` };
			}

			// Enhanced margin check - use only 70% of free margin for safety
			if (requiredMargin > (accountStatus.accountInfo.freeMargin * 0.7)) {
				return { allowed: false, reason: `Insufficient free margin: Required ${requiredMargin.toFixed(2)}, Available ${(accountStatus.accountInfo.freeMargin * 0.7).toFixed(2)}` };
			}

			// Position limit check
			if (accountStatus.openPositions >= this.riskParams.maxConcurrentPositions) {
				return { allowed: false, reason: `Maximum concurrent positions reached: ${accountStatus.openPositions}/${this.riskParams.maxConcurrentPositions}` };
			}

			// Per-symbol cap
			const symbolPositions = (await this.getOpenPositions()).filter(p => p.symbol === orderRequest.symbol).length;
			const cap = this.perSymbolMaxConcurrent[orderRequest.symbol] ?? 2;
			if (symbolPositions >= cap) {
				return { allowed: false, reason: `Per-symbol position cap reached for ${orderRequest.symbol}: ${symbolPositions}/${cap}` };
			}

			// Check minimum lot size
			if (orderRequest.volume < 0.01) {
				return { allowed: false, reason: 'Order volume too small (minimum: 0.01 lots)' };
			}

			// Check maximum lot size
			if (orderRequest.volume > this.riskParams.maxPositionSize) {
				return { allowed: false, reason: `Order volume too large: ${orderRequest.volume} (max: ${this.riskParams.maxPositionSize} lots)` };
			}

			// Check trading permissions
			if (!accountStatus.accountInfo.tradeAllowed) {
				return { allowed: false, reason: 'Trading is not allowed on this account' };
			}

			// Check daily trade count
			if (this.dailyTradeCount >= this.maxDailyTrades) {
				return { allowed: false, reason: `Daily trade limit reached: ${this.dailyTradeCount}/${this.maxDailyTrades}` };
			}

			// Check order frequency
			const timeSinceLastOrder = Date.now() - this.lastOrderTime;
			if (timeSinceLastOrder < this.minOrderInterval) {
				return { allowed: false, reason: `Order frequency limit: ${Math.ceil((this.minOrderInterval - timeSinceLastOrder) / 1000)}s remaining` };
			}

			console.log('✅ All enhanced risk checks passed for real trading');
			return { allowed: true };

		} catch (error) {
			console.error('Error performing enhanced risk checks:', error);
			return { allowed: false, reason: 'Risk check failed due to system error - trading suspended for safety' };
		}
	}

	private async calculateRequiredMargin(orderRequest: OrderRequest, accountInfo: any): Promise<number> {
		try {
			// Get real-time price for accurate margin calculation
			const currentPrice = await exnessAPI.getCurrentPrice(orderRequest.symbol);
			if (!currentPrice) {
				throw new Error('Unable to get current price for margin calculation');
			}

			// Enhanced margin calculation for real trading
			const leverageString = accountInfo.leverage || '1:100';
			const leverage = parseInt(leverageString.split(':')[1] || '100');
			const contractSize = 100000; // Standard lot
			const priceToUse = orderRequest.type === 'BUY' ? currentPrice.ask : currentPrice.bid;
			
			// For JPY pairs, adjust calculation
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

	private async updateEquityPeak(): Promise<void> {
		try {
			const info = await exnessAPI.getAccountInfo();
			if (!info) return;
			if (this.peakEquity === null || info.equity > this.peakEquity) {
				this.peakEquity = info.equity;
			}
		} catch {}
	}

	private async isEquityCircuitBreakerTripped(): Promise<boolean> {
		try {
			const info = await exnessAPI.getAccountInfo();
			if (!info || this.peakEquity === null) return false;
			const ddPct = ((this.peakEquity - info.equity) / this.peakEquity) * 100;
			if (ddPct >= this.maxEquityDrawdownPct) {
				console.error(`🚨 Equity drawdown ${ddPct.toFixed(2)}% >= ${this.maxEquityDrawdownPct}%`);
				// Disable auto-trading immediately
				this.setAutoTrading(false);
				return true;
			}
			return false;
		} catch {
			return false;
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

	private async getWeeklyLoss(): Promise<number> {
		try {
			const { data: { user } } = await supabase.auth.getUser();
			if (!user) return 0;
			const weekAgo = new Date();
			weekAgo.setDate(weekAgo.getDate() - 7);
			const { data: trades } = await supabase
				.from('live_trades')
				.select('profit, opened_at')
				.eq('user_id', user.id)
				.gte('opened_at', weekAgo.toISOString());
			return trades?.reduce((s, t) => s + (parseFloat(t.profit?.toString() || '0')), 0) || 0;
		} catch {
			return 0;
		}
	}
}

export const orderManager = new OrderManager();