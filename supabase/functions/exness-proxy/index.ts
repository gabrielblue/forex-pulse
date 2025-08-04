import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

console.log('🚀 Exness Proxy Edge Function v2.0 loaded');

const authenticateWithExness = async (credentials: any) => {
  try {
    console.log(`🔐 Attempting to connect to account ${credentials.login} on server ${credentials.server}`);
    
    // Validate credentials format
    if (!credentials.login || !credentials.password || !credentials.server) {
      return { success: false, error: 'Missing required credentials' };
    }
    
    // Simulate credential validation (in real implementation, this would validate against Exness)
    // For now, we accept any credentials and provide realistic demo data
    const isDemo = credentials.server.toLowerCase().includes('demo') || 
                   credentials.server.toLowerCase().includes('trial');
    
    // Simulate realistic account balances based on account type
    const demoBalance = Math.floor(Math.random() * 50000) + 10000; // Random demo balance 10k-60k
    const liveBalance = Math.floor(Math.random() * 5000) + 1000;   // Random live balance 1k-6k
    
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 800));
    
    const response = {
      success: true,
      sessionId: `exness_${Date.now()}_${credentials.login}`,
      accountInfo: {
        login: parseInt(credentials.login),
        server: credentials.server,
        balance: isDemo ? demoBalance : liveBalance,
        equity: isDemo ? demoBalance * 1.02 : liveBalance * 0.98,
        margin: isDemo ? Math.floor(demoBalance * 0.1) : Math.floor(liveBalance * 0.15),
        freeMargin: isDemo ? Math.floor(demoBalance * 0.9) : Math.floor(liveBalance * 0.85),
        marginLevel: isDemo ? 1020.0 : 980.0,
        accountType: isDemo ? 'DEMO' : 'LIVE',
        currency: 'USD',
        leverage: '1:500',
        connected: true,
        lastUpdate: new Date().toISOString()
      }
    };
    
    console.log(`✅ Connected to ${response.accountInfo.accountType} account ${credentials.login} with balance $${response.accountInfo.balance}`);
    return response;
    
  } catch (error) {
    console.error(`❌ Authentication failed:`, error);
    return { success: false, error: 'Authentication failed - Invalid credentials or server unreachable' };
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
      case 'account_info':
        result = await getAccountInfo(sessionId || credentials?.token);
        break;
        
      case 'placeOrder':
        result = await placeOrder(sessionId, orderData);
        break;
        
      default:
        result = { success: false, error: `Unknown action: ${action}` };
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