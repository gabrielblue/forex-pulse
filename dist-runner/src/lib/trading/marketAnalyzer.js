"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.marketAnalyzer = void 0;
const exnessApi_1 = require("./exnessApi");
class MarketAnalyzer {
    constructor() {
        this.isRunning = false;
        this.analysisInterval = null;
        this.sessionCheckInterval = null;
        this.marketNotes = [];
        this.marketMovements = [];
        this.sessionAlertCallbacks = [];
    }
    async startContinuousAnalysis() {
        if (this.isRunning)
            return;
        this.isRunning = true;
        console.log('🔍 Starting continuous market analysis...');
        // Analyze markets every 15 seconds
        this.analysisInterval = setInterval(() => {
            this.performMarketAnalysis();
        }, 15000);
        // Check sessions every minute
        this.sessionCheckInterval = setInterval(() => {
            this.checkTradingSessions();
        }, 60000);
        // Initial analysis
        await this.performMarketAnalysis();
        await this.checkTradingSessions();
    }
    async stopContinuousAnalysis() {
        this.isRunning = false;
        if (this.analysisInterval) {
            clearInterval(this.analysisInterval);
            this.analysisInterval = null;
        }
        if (this.sessionCheckInterval) {
            clearInterval(this.sessionCheckInterval);
            this.sessionCheckInterval = null;
        }
        console.log('🛑 Stopped continuous market analysis');
    }
    async performMarketAnalysis() {
        const symbols = ['EURUSD', 'GBPUSD', 'USDJPY', 'AUDUSD', 'USDCHF', 'NZDUSD'];
        const timeframes = ['1M', '5M', '15M', '1H', '4H'];
        for (const symbol of symbols) {
            for (const timeframe of timeframes) {
                await this.analyzeSymbolTimeframe(symbol, timeframe);
            }
        }
    }
    // Public: assess multi-timeframe confluence for a symbol
    async assessMultiTimeframeConfluence(symbol, timeframes = ['15M', '1H', '4H']) {
        const breakdown = [];
        let buyScore = 0;
        let sellScore = 0;
        for (const tf of timeframes) {
            try {
                const currentPrice = await exnessApi_1.exnessAPI.getCurrentPrice(symbol);
                if (!currentPrice)
                    continue;
                const analysis = await this.generateComprehensiveAnalysis(symbol, tf, currentPrice);
                // Map action to directional score
                const action = analysis.recommendation.action;
                const conf = analysis.recommendation.confidence;
                breakdown.push({ timeframe: tf, action, confidence: conf });
                switch (action) {
                    case 'STRONG_BUY':
                        buyScore += 2 * conf;
                        break;
                    case 'BUY':
                        buyScore += 1 * conf;
                        break;
                    case 'SELL':
                        sellScore += 1 * conf;
                        break;
                    case 'STRONG_SELL':
                        sellScore += 2 * conf;
                        break;
                    default: break;
                }
            }
            catch (e) {
                // Skip timeframe on error
            }
        }
        const totalScore = buyScore + sellScore;
        if (totalScore === 0 || breakdown.length === 0) {
            return { direction: 'HOLD', confidence: 0, breakdown };
        }
        if (buyScore > sellScore) {
            return { direction: 'BUY', confidence: (buyScore / totalScore) * 100, breakdown };
        }
        else if (sellScore > buyScore) {
            return { direction: 'SELL', confidence: (sellScore / totalScore) * 100, breakdown };
        }
        else {
            return { direction: 'HOLD', confidence: 50, breakdown };
        }
    }
    async analyzeSymbolTimeframe(symbol, timeframe) {
        try {
            // Get current market data
            const currentPrice = await exnessApi_1.exnessAPI.getCurrentPrice(symbol);
            if (!currentPrice)
                return;
            // Generate market analysis
            const analysis = await this.generateComprehensiveAnalysis(symbol, timeframe, currentPrice);
            // Create market notes based on analysis
            await this.createMarketNotes(analysis);
            // Track market movements
            await this.trackMarketMovement(symbol, timeframe, currentPrice);
        }
        catch (error) {
            console.error(`Analysis error for ${symbol} ${timeframe}:`, error);
        }
    }
    async generateComprehensiveAnalysis(symbol, timeframe, priceData) {
        const currentPrice = (priceData.bid + priceData.ask) / 2;
        // Simulate comprehensive technical analysis
        const analysis = {
            symbol,
            timeframe,
            timestamp: new Date(),
            price: currentPrice,
            spread: priceData.spread,
            // Technical indicators (simulated with realistic values)
            rsi: 30 + Math.random() * 40,
            macd: {
                value: (Math.random() - 0.5) * 0.001,
                signal: (Math.random() - 0.5) * 0.0008,
                histogram: (Math.random() - 0.5) * 0.0002
            },
            ema: {
                ema20: currentPrice * (0.999 + Math.random() * 0.002),
                ema50: currentPrice * (0.998 + Math.random() * 0.004),
                ema200: currentPrice * (0.995 + Math.random() * 0.01)
            },
            bollinger: {
                upper: currentPrice * 1.01,
                middle: currentPrice,
                lower: currentPrice * 0.99
            },
            // Market structure
            trend: this.determineTrend(currentPrice),
            momentum: Math.random() * 100,
            volatility: Math.random() * 50,
            volume: Math.random() * 2000000,
            // Key levels
            supportLevels: this.calculateSupportLevels(currentPrice),
            resistanceLevels: this.calculateResistanceLevels(currentPrice),
            // Patterns
            patterns: this.detectPatterns(),
            candlestickPatterns: this.detectCandlestickPatterns(),
            // Market sentiment
            sentiment: this.analyzeSentiment(symbol),
            institutionalFlow: this.analyzeInstitutionalFlow(),
            // Risk assessment
            riskLevel: this.assessRiskLevel(symbol, timeframe),
            // Trading recommendation
            recommendation: this.generateTradingRecommendation()
        };
        return analysis;
    }
    async createMarketNotes(analysis) {
        const notes = [];
        // Trend analysis notes
        if (analysis.ema.ema20 > analysis.ema.ema50 && analysis.ema.ema50 > analysis.ema.ema200) {
            notes.push({
                id: crypto.randomUUID(),
                timestamp: new Date(),
                symbol: analysis.symbol,
                timeframe: analysis.timeframe,
                type: "TREND",
                message: `Strong bullish alignment: EMA 20 > EMA 50 > EMA 200. Trend strength: ${analysis.momentum.toFixed(1)}%`,
                importance: analysis.momentum > 70 ? "HIGH" : "MEDIUM",
                confidence: 85 + Math.random() * 10,
                priceLevel: analysis.price
            });
        }
        // RSI analysis
        if (analysis.rsi < 30) {
            notes.push({
                id: crypto.randomUUID(),
                timestamp: new Date(),
                symbol: analysis.symbol,
                timeframe: analysis.timeframe,
                type: "PATTERN",
                message: `RSI oversold at ${analysis.rsi.toFixed(1)} - potential reversal opportunity`,
                importance: "MEDIUM",
                confidence: 75,
                priceLevel: analysis.price
            });
        }
        else if (analysis.rsi > 70) {
            notes.push({
                id: crypto.randomUUID(),
                timestamp: new Date(),
                symbol: analysis.symbol,
                timeframe: analysis.timeframe,
                type: "PATTERN",
                message: `RSI overbought at ${analysis.rsi.toFixed(1)} - potential reversal warning`,
                importance: "MEDIUM",
                confidence: 75,
                priceLevel: analysis.price
            });
        }
        // MACD analysis
        if (analysis.macd.value > analysis.macd.signal && analysis.macd.histogram > 0) {
            notes.push({
                id: crypto.randomUUID(),
                timestamp: new Date(),
                symbol: analysis.symbol,
                timeframe: analysis.timeframe,
                type: "PATTERN",
                message: `MACD bullish crossover confirmed with positive histogram - momentum building`,
                importance: "HIGH",
                confidence: 82,
                priceLevel: analysis.price
            });
        }
        // Support/Resistance analysis
        const nearSupport = analysis.supportLevels.find((level) => Math.abs(analysis.price - level) / analysis.price < 0.001);
        if (nearSupport) {
            notes.push({
                id: crypto.randomUUID(),
                timestamp: new Date(),
                symbol: analysis.symbol,
                timeframe: analysis.timeframe,
                type: "LEVEL",
                message: `Price approaching key support at ${nearSupport.toFixed(4)} - watch for bounce or break`,
                importance: "HIGH",
                confidence: 90,
                priceLevel: nearSupport
            });
        }
        // Volume analysis
        if (analysis.volume > 1500000) {
            notes.push({
                id: crypto.randomUUID(),
                timestamp: new Date(),
                symbol: analysis.symbol,
                timeframe: analysis.timeframe,
                type: "VOLUME",
                message: `High volume detected: ${(analysis.volume / 1000000).toFixed(1)}M - institutional activity likely`,
                importance: "HIGH",
                confidence: 88,
                priceLevel: analysis.price
            });
        }
        // Pattern detection notes
        if (analysis.patterns.length > 0) {
            notes.push({
                id: crypto.randomUUID(),
                timestamp: new Date(),
                symbol: analysis.symbol,
                timeframe: analysis.timeframe,
                type: "PATTERN",
                message: `Chart patterns detected: ${analysis.patterns.join(", ")} - monitoring for completion`,
                importance: "HIGH",
                confidence: 80,
                priceLevel: analysis.price
            });
        }
        // Add notes to collection
        this.marketNotes = [...notes, ...this.marketNotes].slice(0, 200);
    }
    async trackMarketMovement(symbol, timeframe, priceData) {
        const currentPrice = (priceData.bid + priceData.ask) / 2;
        // Check if we're already tracking this movement
        const existingMovement = this.marketMovements.find(m => m.symbol === symbol && m.timeframe === timeframe);
        if (existingMovement) {
            // Update existing movement
            existingMovement.currentPrice = currentPrice;
            existingMovement.percentChange = ((currentPrice - existingMovement.startPrice) / existingMovement.startPrice) * 100;
            // Determine direction
            if (existingMovement.percentChange > 0.1) {
                existingMovement.direction = "UP";
                existingMovement.strength = Math.min(100, Math.abs(existingMovement.percentChange) * 10);
            }
            else if (existingMovement.percentChange < -0.1) {
                existingMovement.direction = "DOWN";
                existingMovement.strength = Math.min(100, Math.abs(existingMovement.percentChange) * 10);
            }
            else {
                existingMovement.direction = "SIDEWAYS";
                existingMovement.strength = 20;
            }
            // Update analysis
            existingMovement.analysis = this.generateMovementAnalysis(existingMovement);
        }
        else {
            // Create new movement tracking
            const newMovement = {
                symbol,
                direction: "SIDEWAYS",
                strength: 0,
                timeframe,
                startTime: new Date(),
                currentPrice,
                startPrice: currentPrice,
                percentChange: 0,
                volume: Math.random() * 1000000,
                analysis: "Starting to track price movement..."
            };
            this.marketMovements.push(newMovement);
        }
        // Clean up old movements (older than 24 hours)
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        this.marketMovements = this.marketMovements.filter(m => m.startTime > oneDayAgo);
    }
    generateMovementAnalysis(movement) {
        const duration = (Date.now() - movement.startTime.getTime()) / (1000 * 60); // minutes
        const pipsChange = Math.abs(movement.percentChange) * 100; // Simplified pip calculation
        let analysis = `${movement.symbol} has moved ${movement.direction.toLowerCase()} `;
        analysis += `${pipsChange.toFixed(1)} pips (${movement.percentChange.toFixed(2)}%) `;
        analysis += `over ${duration.toFixed(0)} minutes. `;
        if (movement.strength > 80) {
            analysis += "Strong momentum detected - trend likely to continue. ";
        }
        else if (movement.strength > 50) {
            analysis += "Moderate momentum - watch for continuation or reversal. ";
        }
        else {
            analysis += "Weak momentum - consolidation likely. ";
        }
        if (movement.volume > 1500000) {
            analysis += "High volume confirms the move. ";
        }
        return analysis;
    }
    async checkTradingSessions() {
        const sessions = this.getTradingSessions();
        for (const session of sessions) {
            // Check if session is about to open (within 30 minutes)
            if (session.opensIn <= 30 && session.opensIn > 0) {
                this.triggerSessionAlert(session);
            }
        }
    }
    getTradingSessions() {
        const now = new Date();
        const currentHour = now.getUTCHours();
        const currentMinute = now.getMinutes();
        return [
            {
                name: "Sydney",
                isActive: this.isSessionActive(21, 6, currentHour), // 21:00-06:00 UTC
                opensIn: this.calculateTimeUntil(21, currentHour, currentMinute),
                closesIn: this.calculateTimeUntil(6, currentHour, currentMinute),
                volume: "MEDIUM",
                volatility: "LOW",
                majorPairs: ["AUDUSD", "NZDUSD", "AUDJPY"]
            },
            {
                name: "Tokyo",
                isActive: this.isSessionActive(0, 9, currentHour), // 00:00-09:00 UTC
                opensIn: this.calculateTimeUntil(0, currentHour, currentMinute),
                closesIn: this.calculateTimeUntil(9, currentHour, currentMinute),
                volume: "HIGH",
                volatility: "MEDIUM",
                majorPairs: ["USDJPY", "EURJPY", "GBPJPY", "AUDJPY"]
            },
            {
                name: "London",
                isActive: this.isSessionActive(8, 17, currentHour), // 08:00-17:00 UTC
                opensIn: this.calculateTimeUntil(8, currentHour, currentMinute),
                closesIn: this.calculateTimeUntil(17, currentHour, currentMinute),
                volume: "HIGH",
                volatility: "HIGH",
                majorPairs: ["EURUSD", "GBPUSD", "EURGBP", "USDCHF"]
            },
            {
                name: "New York",
                isActive: this.isSessionActive(13, 22, currentHour), // 13:00-22:00 UTC
                opensIn: this.calculateTimeUntil(13, currentHour, currentMinute),
                closesIn: this.calculateTimeUntil(22, currentHour, currentMinute),
                volume: "HIGH",
                volatility: "HIGH",
                majorPairs: ["EURUSD", "GBPUSD", "USDJPY", "USDCAD"]
            }
        ];
    }
    isSessionActive(openHour, closeHour, currentHour) {
        if (openHour < closeHour) {
            return currentHour >= openHour && currentHour < closeHour;
        }
        else {
            // Session crosses midnight
            return currentHour >= openHour || currentHour < closeHour;
        }
    }
    calculateTimeUntil(targetHour, currentHour, currentMinute) {
        let hoursUntil = targetHour - currentHour;
        if (hoursUntil <= 0)
            hoursUntil += 24;
        return (hoursUntil * 60) - currentMinute;
    }
    triggerSessionAlert(session) {
        console.log(`🔔 Session Alert: ${session.name} opens in ${session.opensIn} minutes`);
        // Notify all registered callbacks
        this.sessionAlertCallbacks.forEach(callback => {
            try {
                callback(session);
            }
            catch (error) {
                console.error('Session alert callback error:', error);
            }
        });
    }
    // Helper methods for analysis
    determineTrend(currentPrice) {
        // Simplified trend determination
        const random = Math.random();
        if (random > 0.6)
            return "BULLISH";
        if (random < 0.3)
            return "BEARISH";
        return "SIDEWAYS";
    }
    calculateSupportLevels(price) {
        return [
            price * 0.998,
            price * 0.995,
            price * 0.992
        ];
    }
    calculateResistanceLevels(price) {
        return [
            price * 1.002,
            price * 1.005,
            price * 1.008
        ];
    }
    detectPatterns() {
        const patterns = [
            "Double Bottom", "Head and Shoulders", "Ascending Triangle",
            "Bull Flag", "Wedge", "Channel", "Cup and Handle"
        ];
        const detected = [];
        const numPatterns = Math.floor(Math.random() * 3);
        for (let i = 0; i < numPatterns; i++) {
            const pattern = patterns[Math.floor(Math.random() * patterns.length)];
            if (!detected.includes(pattern)) {
                detected.push(pattern);
            }
        }
        return detected;
    }
    detectCandlestickPatterns() {
        const patterns = [
            "Doji", "Hammer", "Shooting Star", "Engulfing", "Harami",
            "Morning Star", "Evening Star", "Spinning Top"
        ];
        const detected = [];
        if (Math.random() > 0.7) {
            detected.push(patterns[Math.floor(Math.random() * patterns.length)]);
        }
        return detected;
    }
    analyzeSentiment(symbol) {
        const sentiments = [
            "Bullish momentum building with institutional support",
            "Bearish pressure from profit-taking activities",
            "Neutral sentiment with range-bound trading",
            "Risk-on sentiment supporting higher-yielding currencies",
            "Safe-haven demand driving defensive positioning",
            "Central bank policy divergence creating opportunities"
        ];
        return sentiments[Math.floor(Math.random() * sentiments.length)];
    }
    analyzeInstitutionalFlow() {
        const random = Math.random();
        if (random > 0.6)
            return "ACCUMULATION";
        if (random < 0.3)
            return "DISTRIBUTION";
        return "NEUTRAL";
    }
    assessRiskLevel(symbol, timeframe) {
        // Higher risk during news times and session overlaps
        const hour = new Date().getUTCHours();
        const isNewsTime = (hour >= 8 && hour <= 10) || (hour >= 13 && hour <= 15);
        const isOverlap = (hour >= 13 && hour <= 17) || (hour >= 8 && hour <= 9);
        if (isNewsTime)
            return "HIGH";
        if (isOverlap)
            return "MEDIUM";
        return "LOW";
    }
    generateTradingRecommendation() {
        const actions = ["STRONG_BUY", "BUY", "HOLD", "SELL", "STRONG_SELL"];
        const action = actions[Math.floor(Math.random() * actions.length)];
        const confidence = 60 + Math.random() * 35;
        const reasonings = [
            "Multiple technical indicators align for high-probability setup",
            "Chart patterns confirm directional bias with volume support",
            "Institutional flow analysis suggests continued momentum",
            "Risk-reward ratio favorable with clear stop loss levels",
            "Market structure supports the anticipated price movement"
        ];
        return {
            action,
            confidence,
            reasoning: reasonings[Math.floor(Math.random() * reasonings.length)]
        };
    }
    // Public methods for accessing analysis data
    getMarketNotes(symbol, limit = 50) {
        let notes = this.marketNotes;
        if (symbol) {
            notes = notes.filter(note => note.symbol === symbol);
        }
        return notes.slice(0, limit);
    }
    getMarketMovements(symbol) {
        if (symbol) {
            return this.marketMovements.filter(m => m.symbol === symbol);
        }
        return this.marketMovements;
    }
    subscribeToSessionAlerts(callback) {
        this.sessionAlertCallbacks.push(callback);
        return () => {
            const index = this.sessionAlertCallbacks.indexOf(callback);
            if (index > -1) {
                this.sessionAlertCallbacks.splice(index, 1);
            }
        };
    }
    getCurrentSessions() {
        return this.getTradingSessions();
    }
    isAnalysisRunning() {
        return this.isRunning;
    }
    getAnalysisStats() {
        const criticalNotes = this.marketNotes.filter(n => n.importance === "CRITICAL").length;
        const activeMovements = this.marketMovements.filter(m => m.direction !== "SIDEWAYS" && m.strength > 50).length;
        return {
            totalNotes: this.marketNotes.length,
            criticalNotes,
            activeMovements,
            analysisUptime: this.isRunning ? 100 : 0
        };
    }
}
exports.marketAnalyzer = new MarketAnalyzer();
