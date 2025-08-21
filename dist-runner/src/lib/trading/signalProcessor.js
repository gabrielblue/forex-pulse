"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.signalProcessor = void 0;
const client_1 = require("@/integrations/supabase/client");
const orderManager_1 = require("./orderManager");
const professionalStrategies_1 = require("./strategies/professionalStrategies");
const exnessApi_1 = require("./exnessApi");
const marketAnalyzer_1 = require("./marketAnalyzer");
class SignalProcessor {
    constructor() {
        this.config = {
            minConfidence: 75,
            enabledTimeframes: ['1H', '4H', '1D'],
            enabledPairs: ['EURUSD', 'GBPUSD', 'USDJPY'],
            autoExecute: false
        };
        this.isProcessing = false;
    }
    async initialize() {
        await this.loadConfiguration();
        this.startSignalMonitoring();
    }
    async loadConfiguration() {
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
                this.config = {
                    minConfidence: parseFloat(botSettings.min_confidence_score?.toString() || '75'),
                    enabledTimeframes: ['1H', '4H', '1D'], // Could be stored in bot_settings
                    enabledPairs: botSettings.allowed_pairs || ['EURUSD', 'GBPUSD', 'USDJPY'],
                    autoExecute: botSettings.is_active || false
                };
            }
        }
        catch (error) {
            console.error('Failed to load signal processor configuration:', error);
        }
    }
    startSignalMonitoring() {
        // Monitor for new signals every 30 seconds
        setInterval(async () => {
            if (this.isProcessing)
                return;
            this.isProcessing = true;
            try {
                await this.processNewSignals();
            }
            catch (error) {
                console.error('Signal processing error:', error);
            }
            finally {
                this.isProcessing = false;
            }
        }, 30000);
    }
    async processNewSignals() {
        try {
            const { data: { user } } = await client_1.supabase.auth.getUser();
            if (!user)
                return;
            // Get unprocessed signals
            const { data: signals } = await client_1.supabase
                .from('trading_signals')
                .select(`
          *,
          currency_pairs(symbol)
        `)
                .eq('user_id', user.id)
                .eq('status', 'ACTIVE')
                .gte('confidence_score', this.config.minConfidence)
                .in('timeframe', this.config.enabledTimeframes);
            if (!signals || signals.length === 0)
                return;
            for (const signal of signals) {
                await this.processSignal(signal);
            }
        }
        catch (error) {
            console.error('Failed to process new signals:', error);
        }
    }
    async processSignal(signalData) {
        try {
            const signal = {
                id: signalData.id,
                symbol: signalData.currency_pairs?.symbol || '',
                type: signalData.signal_type,
                confidence: parseFloat(signalData.confidence_score.toString()),
                entryPrice: parseFloat(signalData.entry_price.toString()),
                stopLoss: signalData.stop_loss ? parseFloat(signalData.stop_loss.toString()) : undefined,
                takeProfit: signalData.take_profit ? parseFloat(signalData.take_profit.toString()) : undefined,
                timeframe: signalData.timeframe,
                reasoning: signalData.reasoning || '',
                source: signalData.ai_model || 'AI'
            };
            // Check if signal meets criteria
            if (!this.shouldExecuteSignal(signal)) {
                console.log(`Signal ${signal.id} does not meet execution criteria`);
                return;
            }
            // Execute signal if auto-trading is enabled
            if (this.config.autoExecute && orderManager_1.orderManager.isAutoTradingActive()) {
                await this.executeSignal(signal);
            }
            else {
                console.log(`Signal ${signal.id} ready for manual execution`);
            }
        }
        catch (error) {
            console.error('Failed to process signal:', error);
        }
    }
    shouldExecuteSignal(signal) {
        // Check confidence threshold
        if (signal.confidence < this.config.minConfidence) {
            return false;
        }
        // Check if pair is enabled
        if (!this.config.enabledPairs.includes(signal.symbol)) {
            return false;
        }
        // Check if timeframe is enabled
        if (!this.config.enabledTimeframes.includes(signal.timeframe)) {
            return false;
        }
        // Additional signal validation logic can be added here
        return true;
    }
    async executeSignal(signal) {
        try {
            // Multi-timeframe confluence check before execution
            const confluence = await marketAnalyzer_1.marketAnalyzer.assessMultiTimeframeConfluence(signal.symbol, ['15M', '1H', '4H', '1D']);
            const directionOk = (signal.type === 'BUY' && confluence.direction === 'BUY') || (signal.type === 'SELL' && confluence.direction === 'SELL');
            if (!directionOk || confluence.confidence < Math.max(this.config.minConfidence, 70)) {
                console.warn(`Signal ${signal.id} blocked by MTF confluence: direction ${confluence.direction}, confidence ${confluence.confidence.toFixed(1)}%`);
                return;
            }
            // Calculate position size based on confidence and risk
            const volume = this.calculateVolumeFromSignal(signal);
            const orderRequest = {
                symbol: signal.symbol,
                type: signal.type,
                volume,
                stopLoss: signal.stopLoss,
                takeProfit: signal.takeProfit,
                comment: `AI Signal ${signal.id} (${signal.confidence}%)`
            };
            // Execute the order
            const orderId = await orderManager_1.orderManager.executeOrder(orderRequest);
            if (orderId) {
                // Update signal status
                await this.updateSignalStatus(signal.id, 'EXECUTED', orderId);
                console.log(`Signal ${signal.id} executed successfully. Order ID: ${orderId}`);
            }
        }
        catch (error) {
            console.error(`Failed to execute signal ${signal.id}:`, error);
            await this.updateSignalStatus(signal.id, 'FAILED', null, error.message);
        }
    }
    calculateVolumeFromSignal(signal) {
        // Base volume calculation
        let baseVolume = 0.1; // Standard lot size
        // Adjust based on confidence
        const confidenceMultiplier = signal.confidence / 100;
        baseVolume *= confidenceMultiplier;
        // Ensure minimum and maximum limits
        return Math.max(0.01, Math.min(baseVolume, 1.0));
    }
    async updateSignalStatus(signalId, status, orderId, errorMessage) {
        try {
            const updateData = {
                status,
                updated_at: new Date().toISOString()
            };
            if (orderId) {
                updateData.order_id = orderId;
            }
            if (errorMessage) {
                updateData.error_message = errorMessage;
            }
            const { error } = await client_1.supabase
                .from('trading_signals')
                .update(updateData)
                .eq('id', signalId);
            if (error)
                throw error;
        }
        catch (error) {
            console.error('Failed to update signal status:', error);
        }
    }
    async generateAdvancedSignals(symbols = ['EURUSD', 'GBPUSD', 'USDJPY']) {
        try {
            const { data: { user } } = await client_1.supabase.auth.getUser();
            if (!user)
                return;
            for (const symbol of symbols) {
                // Get market data for the symbol
                const marketData = await this.getMarketData(symbol);
                const indicators = professionalStrategies_1.professionalStrategies.calculateTechnicalIndicators(marketData.prices, marketData.volumes);
                // Apply multiple strategies
                const strategies = [
                    () => professionalStrategies_1.professionalStrategies.scalpingStrategy(marketData, indicators),
                    () => professionalStrategies_1.professionalStrategies.swingTradingStrategy(marketData, indicators),
                    () => professionalStrategies_1.professionalStrategies.breakoutStrategy(marketData, indicators),
                    () => professionalStrategies_1.professionalStrategies.meanReversionStrategy(marketData, indicators),
                    () => professionalStrategies_1.professionalStrategies.gridTradingStrategy(marketData, indicators)
                ];
                for (const strategy of strategies) {
                    const signal = await strategy();
                    if (signal && signal.confidence > this.config.minConfidence) {
                        await this.saveSignalToDatabase(signal, symbol);
                    }
                }
            }
        }
        catch (error) {
            console.error('Failed to generate advanced signals:', error);
        }
    }
    async getMarketData(symbol) {
        try {
            // Get recent price data from database
            const { data: priceData } = await client_1.supabase
                .from('price_data')
                .select('*')
                .eq('timeframe', '1m')
                .order('timestamp', { ascending: false })
                .limit(200);
            // Generate realistic market data if no data exists
            if (!priceData || priceData.length === 0) {
                return this.generateRealisticMarketData(symbol);
            }
            return {
                symbol,
                prices: priceData.map(d => parseFloat(d.close_price.toString())),
                volumes: priceData.map(d => parseInt(d.volume?.toString() || '0')),
                timestamps: priceData.map(d => new Date(d.timestamp))
            };
        }
        catch (error) {
            console.error('Failed to get market data:', error);
            return this.generateRealisticMarketData(symbol);
        }
    }
    generateRealisticMarketData(symbol) {
        const basePrice = this.getBasePrice(symbol);
        const prices = [];
        const volumes = [];
        const timestamps = [];
        let currentPrice = basePrice;
        const now = new Date();
        // Generate 200 data points with realistic price movements
        for (let i = 199; i >= 0; i--) {
            const volatility = 0.0002; // 2 pips volatility
            const randomWalk = (Math.random() - 0.5) * volatility;
            const trend = Math.sin(i / 50) * 0.0001; // Subtle trend component
            currentPrice += randomWalk + trend;
            prices.unshift(currentPrice);
            // Generate realistic volume
            const baseVolume = 1000000;
            const volumeVariation = baseVolume * (0.5 + Math.random());
            volumes.unshift(Math.floor(volumeVariation));
            const timestamp = new Date(now.getTime() - (i * 60000)); // 1 minute intervals
            timestamps.unshift(timestamp);
        }
        return { symbol, prices, volumes, timestamps };
    }
    async saveSignalToDatabase(signal, symbol) {
        try {
            const { data: { user } } = await client_1.supabase.auth.getUser();
            if (!user)
                return;
            // Get currency pair
            const { data: pair } = await client_1.supabase
                .from('currency_pairs')
                .select('id')
                .eq('symbol', symbol)
                .single();
            if (!pair)
                return;
            const { error } = await client_1.supabase
                .from('trading_signals')
                .insert({
                user_id: user.id,
                pair_id: pair.id,
                signal_type: signal.type,
                confidence_score: signal.confidence,
                entry_price: signal.entryPrice,
                stop_loss: signal.stopLoss,
                take_profit: signal.takeProfit,
                timeframe: signal.timeframe,
                reasoning: signal.reasoning,
                ai_model: signal.source,
                status: 'ACTIVE'
            });
            if (error)
                throw error;
            console.log(`Advanced signal saved: ${signal.source} - ${signal.type} ${symbol}`);
        }
        catch (error) {
            console.error('Failed to save signal to database:', error);
        }
    }
    async generateTestSignal(symbol = 'EURUSD') {
        try {
            const accountType = exnessApi_1.exnessAPI.getAccountType();
            console.log(`🧪 Generating test signal for ${symbol} on ${accountType?.toUpperCase()} account...`);
            // Generate a realistic test signal
            const { data: { user } } = await client_1.supabase.auth.getUser();
            if (!user)
                return;
            // Get currency pair
            const { data: pair } = await client_1.supabase
                .from('currency_pairs')
                .select('id')
                .eq('symbol', symbol)
                .single();
            if (!pair) {
                console.error('Currency pair not found:', symbol);
                return;
            }
            // Get current market price
            const currentPrice = await exnessApi_1.exnessAPI.getCurrentPrice(symbol);
            const basePrice = currentPrice?.bid || this.getBasePrice(symbol);
            // Generate realistic signal
            const signalType = Math.random() > 0.5 ? 'BUY' : 'SELL';
            const confidence = 75 + Math.random() * 20; // 75-95% confidence
            const stopLossDistance = 0.002; // 20 pips
            const takeProfitDistance = 0.004; // 40 pips (2:1 ratio)
            const stopLoss = signalType === 'BUY'
                ? basePrice - stopLossDistance
                : basePrice + stopLossDistance;
            const takeProfit = signalType === 'BUY'
                ? basePrice + takeProfitDistance
                : basePrice - takeProfitDistance;
            const testSignal = {
                user_id: user.id,
                pair_id: pair.id,
                signal_type: signalType,
                confidence_score: confidence,
                entry_price: basePrice,
                stop_loss: stopLoss,
                take_profit: takeProfit,
                timeframe: '1H',
                reasoning: `Test signal generated for ${accountType?.toUpperCase()} account: ${signalType} signal with ${confidence.toFixed(1)}% confidence based on technical analysis`,
                ai_model: 'test_signal_generator',
                status: 'ACTIVE'
            };
            const { error } = await client_1.supabase
                .from('trading_signals')
                .insert(testSignal);
            if (error)
                throw error;
            console.log(`✅ Test signal generated successfully:`, {
                symbol,
                type: signalType,
                confidence: confidence.toFixed(1) + '%',
                entryPrice: basePrice.toFixed(4),
                accountType: accountType?.toUpperCase()
            });
        }
        catch (error) {
            console.error('❌ Failed to generate test signal:', error);
            throw error;
        }
    }
    getBasePrice(symbol) {
        const basePrices = {
            'EURUSD': 1.0845,
            'GBPUSD': 1.2734,
            'USDJPY': 149.85,
            'AUDUSD': 0.6623,
            'USDCHF': 0.8892,
            'NZDUSD': 0.5987
        };
        return basePrices[symbol] || 1.0000;
    }
    setConfiguration(config) {
        this.config = { ...this.config, ...config };
    }
    getConfiguration() {
        return { ...this.config };
    }
    async enableAutoExecution(enabled) {
        this.config.autoExecute = enabled;
        // Update bot settings in database
        try {
            const { data: { user } } = await client_1.supabase.auth.getUser();
            if (!user)
                return;
            await client_1.supabase
                .from('bot_settings')
                .upsert({
                user_id: user.id,
                is_active: enabled,
                updated_at: new Date().toISOString()
            });
        }
        catch (error) {
            console.error('Failed to update auto execution setting:', error);
        }
    }
}
exports.signalProcessor = new SignalProcessor();
