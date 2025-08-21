"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.orderManager = void 0;
const client_1 = require("@/integrations/supabase/client");
const exnessApi_1 = require("./exnessApi");
class OrderManager {
    constructor() {
        this.isAutoTradingEnabled = false;
        this.riskParams = {
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
        this.lastOrderTime = 0;
        this.minOrderInterval = 30000; // 30 seconds between orders
        this.dailyTradeCount = 0;
        this.maxDailyTrades = 10;
        this.peakEquity = null;
        this.maxEquityDrawdownPct = 10; // Circuit breaker at 10% equity DD
    }
    async initialize() {
        await this.loadRiskParameters();
        await this.resetDailyCounters();
        console.log('OrderManager initialized with enhanced risk parameters for real trading');
    }
    async loadRiskParameters() {
        try {
            const { data: { user } } = await client_1.supabase.auth.getUser();
            if (!user)
                return;
            const { data: botSettings } = await client_1.supabase
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
        }
        catch (error) {
            console.error('Failed to load risk parameters:', error);
        }
    }
    async resetDailyCounters() {
        const today = new Date().toDateString();
        const lastReset = localStorage.getItem('lastDailyReset');
        if (lastReset !== today) {
            this.dailyTradeCount = 0;
            localStorage.setItem('lastDailyReset', today);
            console.log('Daily trade counters reset');
        }
        else {
            // Load today's trade count
            const { data: { user } } = await client_1.supabase.auth.getUser();
            if (user) {
                const { data: trades } = await client_1.supabase
                    .from('live_trades')
                    .select('id')
                    .eq('user_id', user.id)
                    .gte('opened_at', new Date().toISOString().split('T')[0]);
                this.dailyTradeCount = trades?.length || 0;
            }
        }
    }
    setAutoTrading(enabled) {
        this.isAutoTradingEnabled = enabled;
        console.log(`Auto trading ${enabled ? 'enabled' : 'disabled'}`);
    }
    isAutoTradingActive() {
        return this.isAutoTradingEnabled;
    }
    async executeOrder(orderRequest) {
        try {
            // Ensure we're connected to real Exness account
            if (!exnessApi_1.exnessAPI.isConnectedToExness()) {
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
            const enhancedOrder = {
                symbol: orderRequest.symbol,
                type: orderRequest.type,
                volume: adjustedVolume,
                stopLoss: orderRequest.stopLoss,
                takeProfit: orderRequest.takeProfit,
                comment: orderRequest.comment || `ForexPro-${Date.now()}`
            };
            // Execute order through real Exness API
            const ticket = await exnessApi_1.exnessAPI.placeOrder(enhancedOrder);
            if (ticket) {
                // Update counters
                this.lastOrderTime = Date.now();
                this.dailyTradeCount++;
                // Log successful execution
                await this.logOrderExecution(enhancedOrder, ticket, 'SUCCESS');
                await this.updatePerformanceMetrics();
                console.log(`✅ Order executed successfully: ${ticket}`);
                return ticket;
            }
            else {
                throw new Error('Order execution failed - no ticket returned from Exness');
            }
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.error('❌ Order execution failed:', errorMessage);
            await this.logOrderExecution(orderRequest, null, 'FAILED', errorMessage);
            throw error;
        }
    }
    async performEnhancedRiskChecks(orderRequest) {
        try {
            // Check if Exness is connected for real trading
            if (!exnessApi_1.exnessAPI.isConnectedToExness()) {
                return { allowed: false, reason: 'Not connected to Exness account' };
            }
            // Get real account status from Exness
            const accountStatus = await this.getAccountStatus();
            if (!accountStatus.accountInfo) {
                return { allowed: false, reason: 'Unable to get account information from Exness' };
            }
            const accountType = exnessApi_1.exnessAPI.getAccountType();
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
        }
        catch (error) {
            console.error('Error performing enhanced risk checks:', error);
            return { allowed: false, reason: 'Risk check failed due to system error - trading suspended for safety' };
        }
    }
    async calculateRequiredMargin(orderRequest, accountInfo) {
        try {
            // Get real-time price for accurate margin calculation
            const currentPrice = await exnessApi_1.exnessAPI.getCurrentPrice(orderRequest.symbol);
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
        }
        catch (error) {
            console.error('Error calculating required margin:', error);
            // Return conservative estimate
            return orderRequest.volume * 1000; // $1000 per lot conservative estimate
        }
    }
    async calculateOptimalPositionSize(orderRequest) {
        try {
            const accountInfo = await exnessApi_1.exnessAPI.getAccountInfo();
            if (!accountInfo) {
                throw new Error('Unable to get real account information');
            }
            // Enhanced position sizing for real money trading
            // Use equity instead of balance for more conservative approach
            const availableCapital = accountInfo.equity;
            const riskAmount = (availableCapital * this.riskParams.maxRiskPerTrade) / 100;
            console.log('Optimal position sizing - Available capital:', availableCapital, 'Risk amount:', riskAmount);
            // Get real-time price for accurate calculations
            const currentPrice = await exnessApi_1.exnessAPI.getCurrentPrice(orderRequest.symbol);
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
            const maxSize = Math.min(this.riskParams.maxPositionSize, // Maximum from settings
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
        }
        catch (error) {
            console.error('Error calculating optimal position size for real trading:', error);
            return 0.01; // Return minimum size on error for safety
        }
    }
    async updateEquityPeak() {
        try {
            const info = await exnessApi_1.exnessAPI.getAccountInfo();
            if (!info)
                return;
            if (this.peakEquity === null || info.equity > this.peakEquity) {
                this.peakEquity = info.equity;
            }
        }
        catch { }
    }
    async isEquityCircuitBreakerTripped() {
        try {
            const info = await exnessApi_1.exnessAPI.getAccountInfo();
            if (!info || this.peakEquity === null)
                return false;
            const ddPct = ((this.peakEquity - info.equity) / this.peakEquity) * 100;
            if (ddPct >= this.maxEquityDrawdownPct) {
                console.error(`🚨 Equity drawdown ${ddPct.toFixed(2)}% >= ${this.maxEquityDrawdownPct}%`);
                // Disable auto-trading immediately
                this.setAutoTrading(false);
                return true;
            }
            return false;
        }
        catch {
            return false;
        }
    }
    calculateOptimalStopLoss(price, type, symbol) {
        // Enhanced stop loss calculation based on volatility and symbol characteristics
        const pipValue = this.getPipValue(symbol);
        // Different stop loss distances for different symbol types
        let stopLossPips;
        if (symbol.includes('JPY')) {
            stopLossPips = 40; // 40 pips for JPY pairs (more volatile)
        }
        else if (['GBPUSD', 'GBPJPY', 'EURGBP'].some(pair => symbol.includes(pair.replace('/', '')))) {
            stopLossPips = 35; // 35 pips for GBP pairs (volatile)
        }
        else {
            stopLossPips = 30; // 30 pips for major pairs
        }
        if (type === 'BUY') {
            return price - (stopLossPips * pipValue);
        }
        else {
            return price + (stopLossPips * pipValue);
        }
    }
    calculateOptimalTakeProfit(price, type, symbol) {
        // Enhanced take profit calculation with 2:1 risk-reward ratio
        const pipValue = this.getPipValue(symbol);
        // Calculate take profit based on stop loss distance
        let takeProfitPips;
        if (symbol.includes('JPY')) {
            takeProfitPips = 80; // 2:1 ratio for JPY pairs
        }
        else if (['GBPUSD', 'GBPJPY', 'EURGBP'].some(pair => symbol.includes(pair.replace('/', '')))) {
            takeProfitPips = 70; // 2:1 ratio for GBP pairs
        }
        else {
            takeProfitPips = 60; // 2:1 ratio for major pairs
        }
        if (type === 'BUY') {
            return price + (takeProfitPips * pipValue);
        }
        else {
            return price - (takeProfitPips * pipValue);
        }
    }
    getPipValue(symbol) {
        // Enhanced pip value calculation
        const pipValues = {
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
    async getDailyLoss() {
        try {
            const { data: { user } } = await client_1.supabase.auth.getUser();
            if (!user)
                return 0;
            const today = new Date().toISOString().split('T')[0];
            // Calculate daily P&L from live_trades
            const { data: trades } = await client_1.supabase
                .from('live_trades')
                .select('profit')
                .eq('user_id', user.id)
                .gte('opened_at', today);
            const dailyProfit = trades?.reduce((sum, trade) => sum + (parseFloat(trade.profit?.toString() || '0')), 0) || 0;
            return dailyProfit;
        }
        catch (error) {
            console.error('Failed to get daily loss:', error);
            return 0;
        }
    }
    async logOrderExecution(orderRequest, orderId, status, errorMessage) {
        try {
            const { data: { user } } = await client_1.supabase.auth.getUser();
            if (!user)
                return;
            const accountType = exnessApi_1.exnessAPI.getAccountType();
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
        }
        catch (error) {
            console.error('Failed to log order execution:', error);
        }
    }
    async updatePerformanceMetrics() {
        try {
            const { data: { user } } = await client_1.supabase.auth.getUser();
            if (!user)
                return;
            // Update user portfolio with latest performance
            const accountInfo = await exnessApi_1.exnessAPI.getAccountInfo();
            if (accountInfo) {
                await client_1.supabase
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
        }
        catch (error) {
            console.error('Failed to update performance metrics:', error);
        }
    }
    async getOpenPositions() {
        try {
            // Get positions from Exness API
            const exnessPositions = await exnessApi_1.exnessAPI.getPositions();
            // Sync with local database
            await this.syncPositionsWithDatabase(exnessPositions);
            return exnessPositions;
        }
        catch (error) {
            console.error('Failed to get open positions:', error);
            return [];
        }
    }
    async syncPositionsWithDatabase(positions) {
        try {
            const { data: { user } } = await client_1.supabase.auth.getUser();
            if (!user)
                return;
            // Update existing positions or create new ones
            for (const position of positions) {
                await client_1.supabase
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
        }
        catch (error) {
            console.error('Failed to sync positions with database:', error);
        }
    }
    calculatePips(openPrice, currentPrice, symbol, type) {
        const pipValue = this.getPipValue(symbol);
        const priceDiff = type === 'BUY' ? currentPrice - openPrice : openPrice - currentPrice;
        return priceDiff / pipValue;
    }
    async closePosition(ticket) {
        try {
            console.log(`🔒 Closing position ${ticket} on Exness...`);
            const success = await exnessApi_1.exnessAPI.closePosition(ticket);
            if (success) {
                // Update local database
                const { data: { user } } = await client_1.supabase.auth.getUser();
                if (user) {
                    await client_1.supabase
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
        }
        catch (error) {
            console.error('Failed to close position:', error);
            return false;
        }
    }
    async closeAllPositions() {
        try {
            console.log('🔒 Closing all positions...');
            const positions = await this.getOpenPositions();
            if (positions.length === 0) {
                console.log('No positions to close');
                return;
            }
            const closePromises = positions.map(position => this.closePosition(position.ticket));
            const results = await Promise.allSettled(closePromises);
            const successCount = results.filter(result => result.status === 'fulfilled' && result.value === true).length;
            console.log(`✅ Closed ${successCount} out of ${positions.length} positions`);
        }
        catch (error) {
            console.error('Failed to close all positions:', error);
        }
    }
    // Enhanced method to get real-time account status
    async getAccountStatus() {
        try {
            const accountInfo = await exnessApi_1.exnessAPI.getAccountInfo();
            const positions = await this.getOpenPositions();
            return {
                accountInfo,
                openPositions: positions.length,
                totalUnrealizedPnL: positions.reduce((sum, pos) => sum + pos.profit, 0),
                isConnected: exnessApi_1.exnessAPI.isConnectedToExness(),
                connectionStatus: exnessApi_1.exnessAPI.getConnectionStatus(),
                dailyTradeCount: this.dailyTradeCount,
                maxDailyTrades: this.maxDailyTrades,
                riskParameters: this.riskParams
            };
        }
        catch (error) {
            console.error('Failed to get account status:', error);
            return null;
        }
    }
    // Method to validate if we can trade a specific symbol
    async canTradeSymbol(symbol) {
        try {
            const price = await exnessApi_1.exnessAPI.getCurrentPrice(symbol);
            const marketOpen = await exnessApi_1.exnessAPI.isMarketOpen(symbol);
            return price !== null && marketOpen;
        }
        catch (error) {
            console.error(`Cannot trade symbol ${symbol}:`, error);
            return false;
        }
    }
    async emergencyStop() {
        const accountType = exnessApi_1.exnessAPI.getAccountType();
        console.log(`🚨 EMERGENCY STOP ACTIVATED for ${accountType?.toUpperCase()} account`);
        try {
            // Disable auto trading immediately
            this.setAutoTrading(false);
            // Close all positions
            await this.closeAllPositions();
            // Reset daily counters to prevent further trading
            this.dailyTradeCount = this.maxDailyTrades;
            // Log emergency stop
            const { data: { user } } = await client_1.supabase.auth.getUser();
            if (user) {
                console.log('🚨 Emergency stop executed for user:', user.id);
                // Update bot settings to disable
                await client_1.supabase
                    .from('bot_settings')
                    .update({
                    is_active: false,
                    updated_at: new Date().toISOString()
                })
                    .eq('user_id', user.id);
            }
        }
        catch (error) {
            console.error('Emergency stop failed:', error);
        }
    }
    // Method to get trading statistics
    async getTradingStatistics() {
        try {
            const { data: { user } } = await client_1.supabase.auth.getUser();
            if (!user)
                return null;
            const { data: trades } = await client_1.supabase
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
        }
        catch (error) {
            console.error('Failed to get trading statistics:', error);
            return null;
        }
    }
    // Method to update risk parameters
    updateRiskParameters(newParams) {
        this.riskParams = { ...this.riskParams, ...newParams };
        console.log('Risk parameters updated:', this.riskParams);
    }
    getRiskParameters() {
        return { ...this.riskParams };
    }
}
exports.orderManager = new OrderManager();
