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

    const systemPrompt = `You are an elite forex trading analyst trained in Smart Money Concepts (SMC) and institutional trading strategies, similar to ChartLord AI.

SMART MONEY CONCEPTS TO ANALYZE:
1. Order Blocks - Areas where institutions placed large orders
2. Fair Value Gaps (FVGs) - Imbalanced price areas that tend to fill
3. Liquidity Zones - Areas with stop losses that institutions hunt
4. Break of Structure (BOS) - Trend continuation signals
5. Change of Character (CHoCH) - Trend reversal signals
6. Breaker Blocks - Failed order blocks that become support/resistance

CONFLUENCE REQUIREMENT (ChartLord Style):
- Only give BUY/SELL if at least 5 of these factors align:
  1. Trend direction (use EMA 20/50)
  2. RSI confirming momentum (not overbought for BUY, not oversold for SELL)
  3. Price at/near order block or FVG
  4. Recent BOS in trade direction
  5. Volume confirmation
  6. Key support/resistance level
  7. Clean price action setup

CRITICAL RULES:
1. Be SELECTIVE - only trade with 5+ confluence factors
2. Use HOLD when confluence < 5 factors
3. Assign confidence 75-95% for clear setups with 7+ factors
4. Assign confidence 65-74% for decent setups with 5-6 factors
5. Below 65% = HOLD - not enough confluence

When analyzing:
- Multiple confluence factors aligned = HIGH confidence (75%+)
- Single indicator without confirmation = HOLD
- Choppy/ranging with no clear direction = HOLD

Provide:
1. Market regime (trending/ranging/volatile/consolidating)
2. Clear BUY/SELL/HOLD signal with SMC reasoning
3. Confidence score reflecting confluence strength
4. Precise entry, stop-loss (20-30 pips), take-profit (40-60 pips, 2:1 R:R)
5. Risk assessment
6. Position sizing recommendation (SMALL for cautious entries)
7. Support/resistance levels
8. SMC patterns detected (order blocks, FVGs, BOS)`;

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
