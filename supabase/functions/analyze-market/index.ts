import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('📊 Market analysis request received');

    const requestBody = await req.json();
    console.log('📋 Request body:', JSON.stringify(requestBody, null, 2));
    
    const { symbol, timeframe, marketData, technicalIndicators } = requestBody;
    
    // Validate required fields
    if (!symbol || !marketData || !technicalIndicators) {
      throw new Error(`Missing required fields. Symbol: ${!!symbol}, MarketData: ${!!marketData}, TechnicalIndicators: ${!!technicalIndicators}`);
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

    const systemPrompt = `You are an elite forex trading analyst with deep expertise in technical analysis, market microstructure, and algorithmic trading. Your role is to provide highly accurate, data-driven trading analysis.

IMPORTANT: You must be DECISIVE and provide actionable signals. Do not default to HOLD unless the market is truly uncertain.

Analyze the provided market data and provide:
1. Market regime classification (trending/ranging/volatile)
2. Trading signal (BUY/SELL/HOLD) with detailed reasoning
3. Confidence score (0-100) based on technical alignment - Be confident with your analysis! Use 60-90% confidence for clear signals.
4. Risk assessment and position sizing recommendation
5. Entry, stop-loss, and take-profit levels with precise calculations
6. Key support/resistance levels
7. Pattern recognition (if any chart patterns are forming)

Guidelines for confidence scoring:
- 80-100%: Very strong technical confluence, multiple indicators aligned
- 60-79%: Good technical setup, most indicators aligned
- 40-59%: Mixed signals but leaning one direction
- 20-39%: Uncertain market, conflicting signals
- 0-19%: No clear direction, true HOLD situation

Be proactive with trade recommendations. If RSI shows oversold/overbought, if price is near key levels, or if there's momentum - recommend a trade with appropriate confidence.`;

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
    console.log('🤖 AI Response received:', JSON.stringify(aiResponse, null, 2));
    
    const toolCall = aiResponse.choices?.[0]?.message?.tool_calls?.[0];
    
    if (!toolCall) {
      console.error('❌ No tool call in AI response');
      throw new Error("No analysis returned from AI");
    }

    const analysis = JSON.parse(toolCall.function.arguments);
    console.log('✅ Analysis parsed:', JSON.stringify(analysis, null, 2));

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
