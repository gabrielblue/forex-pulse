import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Allowed trading symbols whitelist
const ALLOWED_SYMBOLS = [
  'EURUSD', 'GBPUSD', 'USDJPY', 'USDCHF', 'AUDUSD', 'USDCAD', 'NZDUSD',
  'EURGBP', 'EURJPY', 'GBPJPY', 'AUDJPY', 'CADJPY', 'CHFJPY',
  'XAUUSD', 'XAGUSD', 'BTCUSD', 'ETHUSD',
  'EUR/USD', 'GBP/USD', 'USD/JPY', 'USD/CHF', 'AUD/USD', 'USD/CAD', 'NZD/USD',
  'EUR/GBP', 'EUR/JPY', 'GBP/JPY', 'AUD/JPY', 'CAD/JPY', 'CHF/JPY',
  'XAU/USD', 'XAG/USD', 'BTC/USD', 'ETH/USD'
];

const ALLOWED_TIMEFRAMES = ['1m', '5m', '15m', '30m', '1h', '4h', '1d', '1w', 'M1', 'M5', 'M15', 'M30', 'H1', 'H4', 'D1', 'W1'];

// Input validation functions
function validateSymbol(symbol: string): boolean {
  if (!symbol || typeof symbol !== 'string') return false;
  const normalizedSymbol = symbol.toUpperCase().replace('/', '');
  return ALLOWED_SYMBOLS.some(s => s.toUpperCase().replace('/', '') === normalizedSymbol);
}

function validateTimeframe(timeframe: string): boolean {
  if (!timeframe || typeof timeframe !== 'string') return false;
  return ALLOWED_TIMEFRAMES.includes(timeframe);
}

function validateNumericRange(value: unknown, min: number, max: number): boolean {
  if (typeof value !== 'number' || isNaN(value)) return false;
  return value >= min && value <= max;
}

function validateMarketData(marketData: unknown): { valid: boolean; error?: string } {
  if (!marketData || typeof marketData !== 'object') {
    return { valid: false, error: 'marketData must be an object' };
  }
  
  const data = marketData as Record<string, unknown>;
  
  // Validate currentPrice
  if (data.currentPrice !== undefined && !validateNumericRange(data.currentPrice, 0, 1000000)) {
    return { valid: false, error: 'currentPrice must be a positive number' };
  }
  
  // Validate bid/ask
  if (data.bid !== undefined && !validateNumericRange(data.bid, 0, 1000000)) {
    return { valid: false, error: 'bid must be a positive number' };
  }
  if (data.ask !== undefined && !validateNumericRange(data.ask, 0, 1000000)) {
    return { valid: false, error: 'ask must be a positive number' };
  }
  
  // Validate spread
  if (data.spread !== undefined && !validateNumericRange(data.spread, 0, 1000)) {
    return { valid: false, error: 'spread must be between 0 and 1000' };
  }
  
  return { valid: true };
}

function validateTechnicalIndicators(indicators: unknown): { valid: boolean; error?: string } {
  if (!indicators || typeof indicators !== 'object') {
    return { valid: false, error: 'technicalIndicators must be an object' };
  }
  
  const data = indicators as Record<string, unknown>;
  
  // Validate RSI (0-100)
  if (data.rsi !== undefined && !validateNumericRange(data.rsi, 0, 100)) {
    return { valid: false, error: 'RSI must be between 0 and 100' };
  }
  
  // Validate ATR
  if (data.atr !== undefined && !validateNumericRange(data.atr, 0, 10000)) {
    return { valid: false, error: 'ATR must be a positive number' };
  }
  
  return { valid: true };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('📊 Market analysis request received');

    // Optional authentication - allow anonymous access for AI analysis
    const authHeader = req.headers.get('authorization');
    let user = null;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        // Create Supabase client to verify the user if token provided
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
        const supabase = createClient(supabaseUrl, supabaseAnonKey, {
          global: { headers: { Authorization: authHeader } }
        });

        // Verify the user is authenticated
        const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
        if (!authError && authUser) {
          user = authUser;
          console.log('✅ Authenticated user:', user.id);
        } else {
          console.log('⚠️ Invalid token provided, proceeding anonymously');
        }
      } catch (error) {
        console.log('⚠️ Authentication check failed, proceeding anonymously:', error);
      }
    } else {
      console.log('ℹ️ No authentication token provided, proceeding anonymously');
    }

    const requestBody = await req.json();
    console.log('📋 Request body:', JSON.stringify(requestBody, null, 2));
    
    const { symbol, timeframe, marketData, technicalIndicators } = requestBody;
    
    // Validate required fields
    if (!symbol || !marketData || !technicalIndicators) {
      return new Response(
        JSON.stringify({ error: `Missing required fields. Symbol: ${!!symbol}, MarketData: ${!!marketData}, TechnicalIndicators: ${!!technicalIndicators}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate symbol against whitelist
    if (!validateSymbol(symbol)) {
      console.error('❌ Invalid symbol:', symbol);
      return new Response(
        JSON.stringify({ error: `Invalid symbol: ${symbol}. Must be a valid trading pair.` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate timeframe
    if (timeframe && !validateTimeframe(timeframe)) {
      console.error('❌ Invalid timeframe:', timeframe);
      return new Response(
        JSON.stringify({ error: `Invalid timeframe: ${timeframe}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate marketData
    const marketDataValidation = validateMarketData(marketData);
    if (!marketDataValidation.valid) {
      console.error('❌ Invalid marketData:', marketDataValidation.error);
      return new Response(
        JSON.stringify({ error: `Invalid marketData: ${marketDataValidation.error}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate technicalIndicators
    const indicatorsValidation = validateTechnicalIndicators(technicalIndicators);
    if (!indicatorsValidation.valid) {
      console.error('❌ Invalid technicalIndicators:', indicatorsValidation.error);
      return new Response(
        JSON.stringify({ error: `Invalid technicalIndicators: ${indicatorsValidation.error}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    console.log('🔍 Market context prepared for', symbol);

    // Build comprehensive market context for AI analysis
    const marketContext = `
Symbol: ${symbol}
Timeframe: ${timeframe}
Current Price: ${marketData.currentPrice}
Bid: ${marketData.bid}
Ask: ${marketData.ask}
Spread: ${marketData.spread}

Technical Indicators:
- RSI: ${technicalIndicators.rsi || 'N/A'}
- MACD: ${technicalIndicators.macd || 'N/A'}
- EMA 20: ${technicalIndicators.ema20 || 'N/A'}
- EMA 50: ${technicalIndicators.ema50 || 'N/A'}
- ATR: ${technicalIndicators.atr || 'N/A'}
- Volume: ${technicalIndicators.volume || 'N/A'}

Recent Price Action:
- High: ${marketData.high || 'N/A'}
- Low: ${marketData.low || 'N/A'}
- Change: ${marketData.change || 'N/A'}%
    `.trim();

    const systemPrompt = `You are an elite forex analyst using Smart Money Concepts (SMC).

ANALYZE for BUY/SELL/HOLD based on confluence of:
- Trend (EMA 20/50)
- RSI momentum
- Order blocks/FVGs
- BOS/CHoCH signals
- Support/resistance levels

REQUIREMENTS:
- BUY/SELL only with 5+ confluence factors
- HOLD if <5 factors or unclear
- Confidence: 75-95% for 7+ factors, 65-74% for 5-6 factors
- Entry: precise price, SL: 20-30 pips, TP: 40-60 pips (2:1 RR)
- Risk: LOW/MEDIUM/HIGH, Position size: SMALL/MEDIUM/LARGE

OUTPUT: regime, signal, confidence, reasoning, entry/stops, levels, patterns, risk, sizing`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash", // Free during promo period
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Analyze this market data and provide a trading recommendation:\n\n${marketContext}` }
        ],
        tools: [{
          type: "function",
          function: {
            name: "provide_trading_analysis",
            description: "Provide comprehensive trading analysis with specific recommendations",
            parameters: {
              type: "object",
              properties: {
                regime: {
                  type: "string",
                  enum: ["TRENDING_BULLISH", "TRENDING_BEARISH", "RANGING", "VOLATILE", "CONSOLIDATING"],
                  description: "Current market regime classification"
                },
                signal: {
                  type: "string",
                  enum: ["BUY", "SELL", "HOLD"],
                  description: "Trading signal recommendation"
                },
                confidence: {
                  type: "number",
                  minimum: 0,
                  maximum: 100,
                  description: "Confidence score for the signal (0-100)"
                },
                reasoning: {
                  type: "string",
                  description: "Detailed reasoning for the recommendation including technical factors"
                },
                entryPrice: {
                  type: "number",
                  description: "Recommended entry price"
                },
                stopLoss: {
                  type: "number",
                  description: "Recommended stop-loss level"
                },
                takeProfit: {
                  type: "number",
                  description: "Recommended take-profit level"
                },
                supportLevels: {
                  type: "array",
                  items: { type: "number" },
                  description: "Key support price levels"
                },
                resistanceLevels: {
                  type: "array",
                  items: { type: "number" },
                  description: "Key resistance price levels"
                },
                patterns: {
                  type: "array",
                  items: { type: "string" },
                  description: "Detected chart patterns if any"
                },
                riskLevel: {
                  type: "string",
                  enum: ["LOW", "MEDIUM", "HIGH"],
                  description: "Risk level assessment"
                },
                positionSizeRecommendation: {
                  type: "string",
                  enum: ["SMALL", "MEDIUM", "LARGE"],
                  description: "Recommended position size based on risk"
                }
              },
              required: ["regime", "signal", "confidence", "reasoning", "entryPrice", "stopLoss", "takeProfit", "riskLevel", "positionSizeRecommendation"],
              additionalProperties: false
            }
          }
        }],
        tool_choice: { type: "function", function: { name: "provide_trading_analysis" } }
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        console.error('⚠️ Rate limit exceeded');
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        console.error('💳 AI credits exhausted');
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add credits to your workspace." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("❌ AI gateway error:", response.status, errorText);
      throw new Error(`AI gateway error: ${response.status} - ${errorText}`);
    }

    const aiResponse = await response.json();
    console.log('🤖 Raw AI Response:', JSON.stringify(aiResponse, null, 2));
    
    const toolCall = aiResponse.choices?.[0]?.message?.tool_calls?.[0];
    
    if (!toolCall || !toolCall.function || !toolCall.function.arguments) {
      console.error('❌ No valid tool call in AI response. Full response:', JSON.stringify(aiResponse, null, 2));
      throw new Error("AI did not return a structured analysis. This may indicate poor data quality or AI service issues.");
    }

    let analysis;
    try {
      analysis = JSON.parse(toolCall.function.arguments);
    } catch (parseError) {
      console.error('❌ Failed to parse tool call arguments:', toolCall.function.arguments);
      throw new Error(`Failed to parse AI analysis: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`);
    }
    
    // Validate required fields
    const requiredFields = ['regime', 'signal', 'confidence', 'reasoning', 'entryPrice', 'stopLoss', 'takeProfit', 'riskLevel', 'positionSizeRecommendation'];
    const missingFields = requiredFields.filter(field => !(field in analysis));
    
    if (missingFields.length > 0) {
      console.error('❌ AI analysis missing required fields:', missingFields);
      console.error('Received analysis:', JSON.stringify(analysis, null, 2));
      throw new Error(`AI analysis incomplete. Missing fields: ${missingFields.join(', ')}`);
    }
    
    console.log('✅ Valid analysis parsed:', JSON.stringify(analysis, null, 2));

    return new Response(
      JSON.stringify({ 
        success: true, 
        analysis,
        timestamp: new Date().toISOString()
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("❌ Analysis error:", error);
    console.error("Error stack:", error instanceof Error ? error.stack : 'No stack trace');
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Unknown error",
        success: false 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});