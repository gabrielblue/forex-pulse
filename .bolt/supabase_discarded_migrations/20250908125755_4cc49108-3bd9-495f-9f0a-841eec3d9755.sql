-- Fix critical security vulnerability: Remove permissive market_data insertion policy
-- that allows any authenticated user to inject fake market data

-- Drop the vulnerable policy that allows any authenticated user to insert
DROP POLICY IF EXISTS "Authenticated users can insert market data" ON market_data;

-- Ensure only admins and service role can insert market data
-- First drop any duplicate/conflicting policies
DROP POLICY IF EXISTS "market_data_insert_admin_only" ON market_data;
DROP POLICY IF EXISTS "Allow admin to manage market data" ON market_data;

-- Create a single, secure policy for market data management
CREATE POLICY "Only admin and service role can manage market data"
ON market_data
FOR ALL
USING (
  -- For SELECT, allow everyone to read
  CASE 
    WHEN current_setting('request.method', true) = 'GET' THEN true
    -- For other operations, only admin or service role
    ELSE (auth.role() = 'service_role' OR has_role(auth.uid(), 'admin'::app_role))
  END
)
WITH CHECK (
  -- Only admin or service role can insert/update
  (auth.role() = 'service_role' OR has_role(auth.uid(), 'admin'::app_role))
);

-- Add audit logging for market data changes
CREATE OR REPLACE FUNCTION log_market_data_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM log_security_event(
      'market_data_insert',
      'market_data',
      NEW.id,
      jsonb_build_object(
        'symbol', NEW.symbol,
        'bid', NEW.bid,
        'ask', NEW.ask,
        'timestamp', NEW.timestamp,
        'source', 'manual_insert'
      )
    );
  ELSIF TG_OP = 'UPDATE' THEN
    PERFORM log_security_event(
      'market_data_update',
      'market_data',
      NEW.id,
      jsonb_build_object(
        'symbol', NEW.symbol,
        'old_bid', OLD.bid,
        'new_bid', NEW.bid,
        'old_ask', OLD.ask,
        'new_ask', NEW.ask
      )
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger to audit market data changes
DROP TRIGGER IF EXISTS audit_market_data_changes ON market_data;
CREATE TRIGGER audit_market_data_changes
AFTER INSERT OR UPDATE ON market_data
FOR EACH ROW
EXECUTE FUNCTION log_market_data_changes();

-- Add data validation to prevent unrealistic market data
CREATE OR REPLACE FUNCTION validate_market_data()
RETURNS TRIGGER AS $$
BEGIN
  -- Check for reasonable price ranges (prevent obviously fake data)
  IF NEW.bid <= 0 OR NEW.ask <= 0 THEN
    RAISE EXCEPTION 'Invalid market data: prices must be positive';
  END IF;
  
  IF NEW.bid >= NEW.ask THEN
    RAISE EXCEPTION 'Invalid market data: bid must be less than ask';
  END IF;
  
  -- Check for unrealistic spreads (more than 10% difference)
  IF (NEW.ask - NEW.bid) / NEW.bid > 0.1 THEN
    RAISE EXCEPTION 'Invalid market data: spread too wide (>10%%)';
  END IF;
  
  -- Prevent backdated data insertion
  IF NEW.timestamp > now() + interval '1 minute' THEN
    RAISE EXCEPTION 'Invalid market data: future timestamps not allowed';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for market data validation
DROP TRIGGER IF EXISTS validate_market_data_trigger ON market_data;
CREATE TRIGGER validate_market_data_trigger
BEFORE INSERT OR UPDATE ON market_data
FOR EACH ROW
EXECUTE FUNCTION validate_market_data();