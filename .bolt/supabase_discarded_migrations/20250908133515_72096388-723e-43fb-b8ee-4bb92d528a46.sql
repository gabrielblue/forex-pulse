-- Fix critical security vulnerability: Rate limiting system manipulation
-- Remove the vulnerable policy that allows any user to modify rate limits

-- Drop the vulnerable policy that allows anyone to update rate limits
DROP POLICY IF EXISTS "System can update rate limits" ON rate_limits;

-- Keep the existing read policy for users to view their own limits
-- The existing "Users can view their own rate limits" policy is correct

-- Create secure policies for rate limit management
-- Only service role should be able to modify rate limits
CREATE POLICY "Service role can manage rate limits"
ON rate_limits
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Create a secure function for rate limit enforcement
CREATE OR REPLACE FUNCTION check_and_update_rate_limit(
  p_user_id uuid,
  p_action text,
  p_limit integer DEFAULT 100,
  p_window_minutes integer DEFAULT 60
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_count integer;
  v_window_start timestamp with time zone;
  v_allowed boolean := false;
BEGIN
  -- Calculate the window start time
  v_window_start := now() - (p_window_minutes || ' minutes')::interval;
  
  -- Get or create rate limit record
  INSERT INTO rate_limits (user_id, action, request_count, window_start)
  VALUES (p_user_id, p_action, 0, now())
  ON CONFLICT (user_id, action) DO NOTHING;
  
  -- Check current request count within the window
  SELECT request_count INTO v_current_count
  FROM rate_limits
  WHERE user_id = p_user_id 
    AND action = p_action
    AND window_start > v_window_start;
  
  -- If no recent record or window expired, reset
  IF v_current_count IS NULL THEN
    UPDATE rate_limits
    SET request_count = 1,
        window_start = now()
    WHERE user_id = p_user_id AND action = p_action;
    v_allowed := true;
  ELSIF v_current_count < p_limit THEN
    -- Increment counter if under limit
    UPDATE rate_limits
    SET request_count = request_count + 1
    WHERE user_id = p_user_id AND action = p_action;
    v_allowed := true;
  ELSE
    -- Rate limit exceeded
    v_allowed := false;
    
    -- Log the rate limit violation
    PERFORM log_security_event(
      'rate_limit_exceeded',
      'rate_limits',
      NULL,
      jsonb_build_object(
        'user_id', p_user_id,
        'action', p_action,
        'current_count', v_current_count,
        'limit', p_limit
      )
    );
  END IF;
  
  RETURN v_allowed;
END;
$$;

-- Create a function to reset rate limits (admin only)
CREATE OR REPLACE FUNCTION reset_user_rate_limit(
  p_user_id uuid,
  p_action text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only admins can reset rate limits
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Unauthorized: Only admins can reset rate limits';
  END IF;
  
  IF p_action IS NULL THEN
    -- Reset all actions for the user
    UPDATE rate_limits
    SET request_count = 0,
        window_start = now()
    WHERE user_id = p_user_id;
  ELSE
    -- Reset specific action for the user
    UPDATE rate_limits
    SET request_count = 0,
        window_start = now()
    WHERE user_id = p_user_id AND action = p_action;
  END IF;
  
  -- Log the reset action
  PERFORM log_security_event(
    'rate_limit_reset',
    'rate_limits',
    NULL,
    jsonb_build_object(
      'target_user_id', p_user_id,
      'action', COALESCE(p_action, 'all'),
      'reset_by', auth.uid()
    )
  );
END;
$$;

-- Add unique constraint to prevent duplicate rate limit records
ALTER TABLE rate_limits 
DROP CONSTRAINT IF EXISTS rate_limits_user_action_unique;

ALTER TABLE rate_limits
ADD CONSTRAINT rate_limits_user_action_unique 
UNIQUE (user_id, action);

-- Create trigger to prevent direct manipulation of rate limits
CREATE OR REPLACE FUNCTION prevent_rate_limit_manipulation()
RETURNS TRIGGER AS $$
BEGIN
  -- Only allow updates through the secure function or by service role
  IF auth.role() != 'service_role' AND current_setting('app.rate_limit_bypass', true) IS NULL THEN
    RAISE EXCEPTION 'Direct manipulation of rate limits is not allowed';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger on rate_limits table
DROP TRIGGER IF EXISTS prevent_rate_limit_manipulation_trigger ON rate_limits;
CREATE TRIGGER prevent_rate_limit_manipulation_trigger
BEFORE INSERT OR UPDATE OR DELETE ON rate_limits
FOR EACH ROW
WHEN (auth.role() != 'service_role')
EXECUTE FUNCTION prevent_rate_limit_manipulation();

-- Grant execute permissions for the rate limit check function
GRANT EXECUTE ON FUNCTION check_and_update_rate_limit TO authenticated;
GRANT EXECUTE ON FUNCTION reset_user_rate_limit TO authenticated;

-- Add audit logging for rate limit changes
CREATE OR REPLACE FUNCTION audit_rate_limit_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    -- Log significant changes to rate limits
    IF OLD.request_count != NEW.request_count THEN
      PERFORM log_security_event(
        'rate_limit_modified',
        'rate_limits',
        NEW.id,
        jsonb_build_object(
          'user_id', NEW.user_id,
          'action', NEW.action,
          'old_count', OLD.request_count,
          'new_count', NEW.request_count,
          'modified_by', auth.uid()
        )
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create audit trigger
DROP TRIGGER IF EXISTS audit_rate_limit_changes_trigger ON rate_limits;
CREATE TRIGGER audit_rate_limit_changes_trigger
AFTER UPDATE ON rate_limits
FOR EACH ROW
EXECUTE FUNCTION audit_rate_limit_changes();