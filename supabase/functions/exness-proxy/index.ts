import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const authenticateWithExness = async (credentials: any) => {
  try {
    console.log(`Testing connection for account ${credentials.login} on server ${credentials.server}`);
    
    // Validate credentials format
    if (!credentials.login || !credentials.password || !credentials.server) {
      return { success: false, error: 'Missing required credentials' };
    }
    
    // For demo purposes, we'll simulate a successful connection
    // In production, you would integrate with actual MT5 API or terminal
    const isDemo = credentials.server.toLowerCase().includes('demo') || 
                   credentials.server.toLowerCase().includes('trial');
    
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const mockResponse = {
      success: true,
      sessionId: `session_${Date.now()}_${credentials.login}`,
      accountInfo: {
        login: credentials.login,
        server: credentials.server,
        balance: isDemo ? 10000.00 : 0.00,
        equity: isDemo ? 10000.00 : 0.00,
        margin: 0.00,
        freeMargin: isDemo ? 10000.00 : 0.00,
        marginLevel: 0.00,
        accountType: isDemo ? 'DEMO' : 'LIVE',
        currency: 'USD',
        leverage: '1:500',
        connected: true
      }
    };
    
    console.log(`Authentication successful for account ${credentials.login}`);
    return mockResponse;
    
  } catch (error) {
    console.error(`Authentication failed:`, error);
    return { success: false, error: 'Authentication failed' };
  }
};

const getAccountInfo = async (sessionId: string) => {
  try {
    console.log(`Getting account info for session ${sessionId}`);
    
    // Extract login from session ID
    const login = sessionId.split('_')[2];
    
    const accountInfo = {
      login: parseInt(login),
      balance: 10000.00,
      equity: 10000.00,
      margin: 0.00,
      freeMargin: 10000.00,
      marginLevel: 0.00,
      currency: 'USD',
      leverage: '1:500',
      connected: true,
      positions: [],
      orders: []
    };
    
    console.log(`Account info retrieved for session ${sessionId}`);
    return { success: true, data: accountInfo };
    
  } catch (error) {
    console.error(`Failed to get account info:`, error);
    return { success: false, error: 'Failed to get account info' };
  }
};

const placeOrder = async (sessionId: string, orderData: any) => {
  try {
    console.log(`Placing order for session ${sessionId}:`, orderData);
    
    // Simulate order placement
    const order = {
      ticket: Math.floor(Math.random() * 1000000) + 100000,
      symbol: orderData.symbol,
      type: orderData.type,
      volume: orderData.volume,
      openPrice: orderData.price || 1.0000,
      sl: orderData.stopLoss || 0,
      tp: orderData.takeProfit || 0,
      comment: orderData.comment || '',
      magic: orderData.magic || 0,
      openTime: new Date().toISOString(),
      profit: 0.00,
      swap: 0.00,
      commission: 0.00
    };
    
    console.log(`Order placed successfully:`, order);
    return { success: true, data: order };
    
  } catch (error) {
    console.error(`Failed to place order:`, error);
    return { success: false, error: 'Failed to place order' };
  }
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, credentials, sessionId, orderData } = await req.json();
    
    console.log(`Processing action: ${action}`);
    
    let result;
    
    switch (action) {
      case 'authenticate':
        result = await authenticateWithExness(credentials);
        break;
        
      case 'getAccountInfo':
        result = await getAccountInfo(sessionId);
        break;
        
      case 'placeOrder':
        result = await placeOrder(sessionId, orderData);
        break;
        
      default:
        result = { success: false, error: 'Unknown action' };
    }
    
    return new Response(
      JSON.stringify(result),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    );
    
  } catch (error) {
    console.error('Edge function error:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Internal server error' 
      }),
      { 
        status: 500,
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    );
  }
});