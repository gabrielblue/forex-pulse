-- Fix remaining security warnings from the linter

-- 1. Fix Function Search Path Mutable warning
-- Update all functions to have explicit search_path

-- Update existing functions with proper search_path
ALTER FUNCTION encrypt_exness_token() SET search_path = public;
ALTER FUNCTION decrypt_exness_token(text) SET search_path = public;
ALTER FUNCTION encrypt_session_token() SET search_path = public;
ALTER FUNCTION decrypt_session_token(text) SET search_path = public;
ALTER FUNCTION validate_market_data() SET search_path = public;
ALTER FUNCTION log_market_data_changes() SET search_path = public;

-- 2. For the Auth OTP expiry warning
-- This is configured in supabase/config.toml - already set to 300 seconds (5 minutes)
-- which is a reasonable value, but we can make it stricter if needed

-- 3. Leaked Password Protection
-- This needs to be enabled in the Supabase dashboard settings, not via SQL

-- 4. Postgres version upgrade
-- This requires platform-level action from the user

-- Additional security hardening for the fixed vulnerability
-- Create a dedicated function for legitimate market data updates from external sources
CREATE OR REPLACE FUNCTION update_market_data_secure(
  p_symbol text,
  p_bid numeric,
  p_ask numeric,
  p_spread numeric,
  p_volume bigint DEFAULT 0
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_market_id uuid;
BEGIN
  -- Only allow service role or admin to call this function
  IF auth.role() != 'service_role' AND NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Unauthorized: Only service role or admin can update market data';
  END IF;

  -- Validate the data
  IF p_bid <= 0 OR p_ask <= 0 THEN
    RAISE EXCEPTION 'Invalid market data: prices must be positive';
  END IF;
  
  IF p_bid >= p_ask THEN
    RAISE EXCEPTION 'Invalid market data: bid must be less than ask';
  END IF;
  
  -- Insert or update the market data
  INSERT INTO market_data (symbol, bid, ask, spread, volume, timestamp)
  VALUES (p_symbol, p_bid, p_ask, p_spread, p_volume, now())
  ON CONFLICT (symbol, timestamp) 
  DO UPDATE SET 
    bid = EXCLUDED.bid,
    ask = EXCLUDED.ask,
    spread = EXCLUDED.spread,
    volume = EXCLUDED.volume
  RETURNING id INTO v_market_id;
  
  RETURN v_market_id;
END;
$$;

-- Grant execute permission only to authenticated users (who must be admin)
GRANT EXECUTE ON FUNCTION update_market_data_secure TO authenticated;