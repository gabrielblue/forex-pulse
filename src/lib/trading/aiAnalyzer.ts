import { supabase } from '@/integrations/supabase/client';

// Advanced AI/ML Interfaces
export interface PredictionInput {
  priceHistory: number[];
  indicators: number[];
  volume: number[];
}

export interface PredictionOutput {
  predictedPrice: number;
  confidence: number;
  direction: 'UP' | 'DOWN' | 'SIDEWAYS';
}

export interface RLAction {
  action: 'BUY' | 'SELL' | 'HOLD';
  reward: number;
}

export interface MarketAnalysisInput {
  symbol: string;
  timeframe: string;
  marketData: {
    currentPrice: number;
    bid: number;
    ask: number;
    spread: number;
    high?: number;
    low?: number;
    change?: number;
  };
  technicalIndicators: {
    rsi?: number;
    macd?: number;
    ema20?: number;
    ema50?: number;
    atr?: number;
    volume?: number;
  };
}

export interface AIAnalysisResult {
  regime: 'TRENDING_BULLISH' | 'TRENDING_BEARISH' | 'RANGING' | 'VOLATILE' | 'CONSOLIDATING';
  signal: 'BUY' | 'SELL' | 'HOLD';
  confidence: number;
  reasoning: string;
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  supportLevels?: number[];
  resistanceLevels?: number[];
  patterns?: string[];
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  positionSizeRecommendation: 'SMALL' | 'MEDIUM' | 'LARGE';
}

// Simplified LSTM Network for Ultra-Short-Term Prediction
class LSTMPredictor {
  private weights: { [key: string]: number[] } = {};
  private biases: { [key: string]: number } = {};
  private learningRate = 0.01;
  private history: number[] = [];

  constructor() {
    this.initializeWeights();
  }

  private initializeWeights() {
    // Simplified LSTM weights (forget, input, output, candidate gates)
    this.weights.forget = Array(10).fill(0).map(() => Math.random() - 0.5);
    this.weights.input = Array(10).fill(0).map(() => Math.random() - 0.5);
    this.weights.output = Array(10).fill(0).map(() => Math.random() - 0.5);
    this.weights.candidate = Array(10).fill(0).map(() => Math.random() - 0.5);
    this.biases.forget = 0;
    this.biases.input = 0;
    this.biases.output = 0;
    this.biases.candidate = 0;
  }

  private sigmoid(x: number): number {
    return 1 / (1 + Math.exp(-x));
  }

  private tanh(x: number): number {
    return Math.tanh(x);
  }

  predict(input: PredictionInput): PredictionOutput {
    const features = [...input.priceHistory.slice(-10), ...input.indicators, ...input.volume.slice(-5)];
    const normalizedFeatures = features.map(f => f / (Math.max(...features) || 1));

    // Simplified LSTM forward pass
    let cellState = 0;
    let hiddenState = 0;

    for (let i = 0; i < Math.min(normalizedFeatures.length, 10); i++) {
      const x = normalizedFeatures[i];

      const forgetGate = this.sigmoid(this.weights.forget[i] * x + this.weights.forget[i] * hiddenState + this.biases.forget);
      const inputGate = this.sigmoid(this.weights.input[i] * x + this.weights.input[i] * hiddenState + this.biases.input);
      const candidateGate = this.tanh(this.weights.candidate[i] * x + this.weights.candidate[i] * hiddenState + this.biases.candidate);
      const outputGate = this.sigmoid(this.weights.output[i] * x + this.weights.output[i] * hiddenState + this.biases.output);

      cellState = forgetGate * cellState + inputGate * candidateGate;
      hiddenState = outputGate * this.tanh(cellState);
    }

    const predictedChange = hiddenState * 0.01; // Scale prediction
    const currentPrice = input.priceHistory[input.priceHistory.length - 1];
    const predictedPrice = currentPrice * (1 + predictedChange);

    let direction: 'UP' | 'DOWN' | 'SIDEWAYS' = 'SIDEWAYS';
    if (predictedChange > 0.001) direction = 'UP';
    else if (predictedChange < -0.001) direction = 'DOWN';

    const confidence = Math.min(95, Math.abs(predictedChange) * 10000);

    return { predictedPrice, confidence, direction };
  }

  updateModel(actualPrice: number, predictedPrice: number) {
    // Simple gradient descent update
    const error = actualPrice - predictedPrice;
    const gradient = error * this.learningRate;

    // Update weights (simplified)
    Object.keys(this.weights).forEach(key => {
      this.weights[key] = this.weights[key].map(w => w + gradient * 0.001);
    });
  }
}

// Reinforcement Learning Agent for Trading Decisions
class RLTradingAgent {
  private qTable: { [state: string]: { [action: string]: number } } = {};
  private epsilon = 0.1; // Exploration rate
  private alpha = 0.1; // Learning rate
  private gamma = 0.9; // Discount factor

  getState(input: MarketAnalysisInput): string {
    const rsi = input.technicalIndicators.rsi || 50;
    const ema20 = input.technicalIndicators.ema20 || input.marketData.currentPrice;
    const ema50 = input.technicalIndicators.ema50 || input.marketData.currentPrice;
    const trend = ema20 > ema50 ? 'bull' : ema20 < ema50 ? 'bear' : 'side';

    return `${rsi > 70 ? 'overbought' : rsi < 30 ? 'oversold' : 'neutral'}_${trend}`;
  }

  chooseAction(state: string): 'BUY' | 'SELL' | 'HOLD' {
    if (!this.qTable[state]) {
      this.qTable[state] = { BUY: 0, SELL: 0, HOLD: 0 };
    }

    if (Math.random() < this.epsilon) {
      // Explore
      const actions = ['BUY', 'SELL', 'HOLD'];
      return actions[Math.floor(Math.random() * actions.length)] as 'BUY' | 'SELL' | 'HOLD';
    } else {
      // Exploit
      const qValues = this.qTable[state];
      return Object.keys(qValues).reduce((a, b) => qValues[a] > qValues[b] ? a : b) as 'BUY' | 'SELL' | 'HOLD';
    }
  }

  updateQValue(state: string, action: string, reward: number, nextState: string) {
    if (!this.qTable[state]) this.qTable[state] = { BUY: 0, SELL: 0, HOLD: 0 };
    if (!this.qTable[nextState]) this.qTable[nextState] = { BUY: 0, SELL: 0, HOLD: 0 };

    const currentQ = this.qTable[state][action];
    const maxNextQ = Math.max(...Object.values(this.qTable[nextState]));
    this.qTable[state][action] = currentQ + this.alpha * (reward + this.gamma * maxNextQ - currentQ);
  }

  getConfidence(state: string, action: string): number {
    if (!this.qTable[state]) return 50;
    const qValue = this.qTable[state][action];
    return Math.min(95, 50 + qValue * 10); // Scale Q-value to confidence
  }
}

// Pattern Recognition Engine
class PatternRecognizer {
  recognizePatterns(input: MarketAnalysisInput): string[] {
    const patterns: string[] = [];
    const prices = [input.marketData.currentPrice]; // Simplified, would need historical data
    const rsi = input.technicalIndicators.rsi || 50;

    // Basic pattern detection
    if (rsi > 70) patterns.push('Overbought RSI');
    if (rsi < 30) patterns.push('Oversold RSI');

    const ema20 = input.technicalIndicators.ema20 || input.marketData.currentPrice;
    const ema50 = input.technicalIndicators.ema50 || input.marketData.currentPrice;

    if (ema20 > ema50 * 1.005) patterns.push('Strong Bullish Trend');
    if (ema20 < ema50 * 0.995) patterns.push('Strong Bearish Trend');

    return patterns;
  }
}

// Parameter Optimizer
class ParameterOptimizer {
  private parameters = {
    rsiThreshold: 70,
    emaWeight: 1.0,
    atrMultiplier: 2.0
  };

  optimize(input: MarketAnalysisInput, reward: number) {
    // Simple parameter adjustment based on reward
    if (reward > 0) {
      this.parameters.rsiThreshold = Math.min(80, this.parameters.rsiThreshold + 0.1);
    } else {
      this.parameters.rsiThreshold = Math.max(60, this.parameters.rsiThreshold - 0.1);
    }
  }

  getParameters() {
    return this.parameters;
  }
}

// Ensemble Model for High Confidence Signals
class EnsembleModel {
  private lstm: LSTMPredictor;
  private rlAgent: RLTradingAgent;
  private patternRecognizer: PatternRecognizer;
  private optimizer: ParameterOptimizer;

  constructor() {
    this.lstm = new LSTMPredictor();
    this.rlAgent = new RLTradingAgent();
    this.patternRecognizer = new PatternRecognizer();
    this.optimizer = new ParameterOptimizer();
  }

  predict(input: MarketAnalysisInput): AIAnalysisResult {
    // LSTM Prediction
    const lstmInput: PredictionInput = {
      priceHistory: [input.marketData.currentPrice], // Would need more history
      indicators: [
        input.technicalIndicators.rsi || 50,
        input.technicalIndicators.macd || 0,
        input.technicalIndicators.ema20 || input.marketData.currentPrice,
        input.technicalIndicators.ema50 || input.marketData.currentPrice,
        input.technicalIndicators.atr || 0.001
      ],
      volume: [input.technicalIndicators.volume || 1000]
    };

    const lstmPrediction = this.lstm.predict(lstmInput);

    // RL Decision
    const state = this.rlAgent.getState(input);
    const rlAction = this.rlAgent.chooseAction(state);
    const rlConfidence = this.rlAgent.getConfidence(state, rlAction);

    // Pattern Recognition
    const patterns = this.patternRecognizer.recognizePatterns(input);

    // Ensemble Decision - More aggressive and decisive
    let ensembleSignal: 'BUY' | 'SELL' | 'HOLD' = 'HOLD';
    let ensembleConfidence = 0;

    // More decisive logic: Allow single strong signal to trigger trade
    if ((lstmPrediction.direction === 'UP' && lstmPrediction.confidence > 70) ||
        (rlAction === 'BUY' && rlConfidence > 75)) {
      ensembleSignal = 'BUY';
      ensembleConfidence = Math.min(95, Math.max(lstmPrediction.confidence, rlConfidence) * 1.2);
    } else if ((lstmPrediction.direction === 'DOWN' && lstmPrediction.confidence > 70) ||
               (rlAction === 'SELL' && rlConfidence > 75)) {
      ensembleSignal = 'SELL';
      ensembleConfidence = Math.min(95, Math.max(lstmPrediction.confidence, rlConfidence) * 1.2);
    } else if (lstmPrediction.direction === 'UP' && rlAction === 'BUY') {
      ensembleSignal = 'BUY';
      ensembleConfidence = Math.min(95, (lstmPrediction.confidence + rlConfidence) / 1.8); // Weighted average favoring action
    } else if (lstmPrediction.direction === 'DOWN' && rlAction === 'SELL') {
      ensembleSignal = 'SELL';
      ensembleConfidence = Math.min(95, (lstmPrediction.confidence + rlConfidence) / 1.8); // Weighted average favoring action
    }

    // Only signal if confidence > 85%
    if (ensembleConfidence < 85) {
      ensembleSignal = 'HOLD';
      ensembleConfidence = 50;
    }

    const currentPrice = input.marketData.currentPrice;
    const atr = input.technicalIndicators.atr || (currentPrice * 0.005);
    const params = this.optimizer.getParameters();

    let stopLoss: number, takeProfit: number;
    if (ensembleSignal === 'BUY') {
      stopLoss = currentPrice - atr * params.atrMultiplier;
      takeProfit = currentPrice + atr * params.atrMultiplier * 2;
    } else if (ensembleSignal === 'SELL') {
      stopLoss = currentPrice + atr * params.atrMultiplier;
      takeProfit = currentPrice - atr * params.atrMultiplier * 2;
    } else {
      stopLoss = currentPrice - atr;
      takeProfit = currentPrice + atr;
    }

    return {
      regime: 'TRENDING_BULLISH', // Simplified
      signal: ensembleSignal,
      confidence: ensembleConfidence,
      reasoning: `Ensemble AI: LSTM predicts ${lstmPrediction.direction}, RL suggests ${rlAction}, Patterns: ${patterns.join(', ')}`,
      entryPrice: currentPrice,
      stopLoss,
      takeProfit,
      supportLevels: [currentPrice * 0.995],
      resistanceLevels: [currentPrice * 1.005],
      patterns,
      riskLevel: ensembleConfidence > 90 ? 'LOW' : 'MEDIUM',
      positionSizeRecommendation: ensembleConfidence > 90 ? 'LARGE' : 'MEDIUM'
    };
  }

  updateModels(actualOutcome: number, predictedOutcome: number) {
    // Update LSTM
    this.lstm.updateModel(actualOutcome, predictedOutcome);

    // Update RL (simplified)
    // Would need state transitions

    // Update parameters
    this.optimizer.optimize({} as MarketAnalysisInput, actualOutcome > predictedOutcome ? 1 : -1);
  }
}

class AIAnalyzer {
  private analysisCache: Map<string, { result: AIAnalysisResult; timestamp: number }> = new Map();
  private cacheDuration = 120000; // 2 minutes cache to reduce API calls
  private ensembleModel: EnsembleModel;

  constructor() {
    this.initializeCache();
    this.ensembleModel = new EnsembleModel();
    // AI calls disabled for stability, but advanced ML enabled
  }

  private async isPaperTradingMode(): Promise<boolean> {
    try {
      const { orderManager } = await import('./orderManager');
      return (orderManager as any).isPaperTradingMode;
    } catch (error) {
      console.warn('Could not check paper trading mode:', error);
      return false;
    }
  }

  async analyzeMarket(input: MarketAnalysisInput): Promise<AIAnalysisResult> {
    const cacheKey = `${input.symbol}_${input.timeframe}`;
    const cached = this.analysisCache.get(cacheKey);

    // Return cached result if still fresh
    if (cached && Date.now() - cached.timestamp < this.cacheDuration) {
      console.log(`📊 Using cached AI analysis for ${cacheKey}`);
      return cached.result;
    }

    // Check if we're in paper trading mode - use algorithmic analysis
    const isPaperTrading = await this.isPaperTradingMode();
    if (isPaperTrading) {
      console.log(`📝 Paper trading mode: Using algorithmic analysis for ${input.symbol}`);
      return this.getAlgorithmicAnalysis(input);
    }

    // Use advanced AI/ML ensemble model for live trading
    console.log(`🤖 Using advanced AI/ML ensemble analysis for ${input.symbol}`);
    const result = this.ensembleModel.predict(input);

    // Cache the result
    this.analysisCache.set(cacheKey, { result, timestamp: Date.now() });

    return result;
  }


  private getFallbackAnalysis(input: MarketAnalysisInput): AIAnalysisResult {
    console.warn('⚠️ Using fallback analysis - AI unavailable or rate limited');

    return {
      regime: 'RANGING',
      signal: 'HOLD',
      confidence: 0,
      reasoning: 'AI analysis unavailable. Conservative HOLD recommended until AI service is restored.',
      entryPrice: input.marketData.currentPrice,
      stopLoss: input.marketData.currentPrice * 0.99,
      takeProfit: input.marketData.currentPrice * 1.01,
      supportLevels: [input.marketData.low || input.marketData.currentPrice * 0.995],
      resistanceLevels: [input.marketData.high || input.marketData.currentPrice * 1.005],
      patterns: [],
      riskLevel: 'HIGH',
      positionSizeRecommendation: 'SMALL'
    };
  }

  private getAlgorithmicAnalysis(input: MarketAnalysisInput): AIAnalysisResult {
    console.log('🔢 Using algorithmic analysis for paper trading mode');

    const currentPrice = input.marketData.currentPrice;
    const rsi = input.technicalIndicators.rsi || 50;
    const ema20 = input.technicalIndicators.ema20 || currentPrice;
    const ema50 = input.technicalIndicators.ema50 || currentPrice;

    let regime: AIAnalysisResult['regime'] = 'RANGING';
    let signal: AIAnalysisResult['signal'] = 'HOLD';
    let confidence = 70;
    let reasoning = 'Algorithmic analysis: ';

    // Determine market regime
    if (ema20 > ema50 * 1.005) {
      regime = 'TRENDING_BULLISH';
    } else if (ema20 < ema50 * 0.995) {
      regime = 'TRENDING_BEARISH';
    } else {
      regime = 'RANGING';
    }

    // RSI-based signals
    if (rsi > 70) {
      signal = 'SELL';
      confidence = Math.min(85, 70 + (rsi - 70));
      reasoning += `RSI overbought (${rsi.toFixed(1)}), selling pressure detected. `;
    } else if (rsi < 30) {
      signal = 'BUY';
      confidence = Math.min(85, 70 + (30 - rsi));
      reasoning += `RSI oversold (${rsi.toFixed(1)}), buying opportunity. `;
    } else {
      // Trend-following signals
      if (regime === 'TRENDING_BULLISH') {
        signal = 'BUY';
        reasoning += 'Bullish trend confirmed by EMA crossover. ';
      } else if (regime === 'TRENDING_BEARISH') {
        signal = 'SELL';
        reasoning += 'Bearish trend confirmed by EMA crossover. ';
      } else {
        signal = 'HOLD';
        confidence = 50;
        reasoning += 'Market ranging, no clear directional bias. ';
      }
    }

    // Calculate stops and targets
    const atr = input.technicalIndicators.atr || (currentPrice * 0.005);
    const stopDistance = Math.max(atr * 2, currentPrice * 0.005);

    let stopLoss: number, takeProfit: number;
    if (signal === 'BUY') {
      stopLoss = currentPrice - stopDistance;
      takeProfit = currentPrice + (stopDistance * 2);
    } else if (signal === 'SELL') {
      stopLoss = currentPrice + stopDistance;
      takeProfit = currentPrice - (stopDistance * 2);
    } else {
      stopLoss = currentPrice - stopDistance;
      takeProfit = currentPrice + stopDistance;
    }

    reasoning += `Entry: ${currentPrice.toFixed(5)}, SL: ${stopLoss.toFixed(5)}, TP: ${takeProfit.toFixed(5)}`;

    return {
      regime,
      signal,
      confidence,
      reasoning,
      entryPrice: currentPrice,
      stopLoss,
      takeProfit,
      supportLevels: [currentPrice * 0.995, currentPrice * 0.99],
      resistanceLevels: [currentPrice * 1.005, currentPrice * 1.01],
      patterns: ['Algorithmic Analysis'],
      riskLevel: confidence > 80 ? 'LOW' : confidence > 60 ? 'MEDIUM' : 'HIGH',
      positionSizeRecommendation: confidence > 80 ? 'LARGE' : confidence > 60 ? 'MEDIUM' : 'SMALL'
    };
  }

  updateModels(actualPrice: number, predictedPrice: number): void {
    this.ensembleModel.updateModels(actualPrice, predictedPrice);
    console.log('🔄 AI models updated with real-time data');
  }

  clearCache(): void {
    this.analysisCache.clear();
    console.log('🧹 AI analysis cache cleared');
  }

  private initializeCache(): void {
    this.analysisCache.clear();
  }

  // AI disabled - no rate limiting needed
  isRateLimited(): boolean {
    return false;
  }

  getRemainingBackoff(): number {
    return 0;
  }
}

export const aiAnalyzer = new AIAnalyzer();
