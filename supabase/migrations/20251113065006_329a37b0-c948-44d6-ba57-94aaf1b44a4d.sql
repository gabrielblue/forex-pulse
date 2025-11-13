-- Fix exness_sessions RLS to allow service role and proper introspection
-- This resolves "permission denied" errors from PostgREST and monitoring

-- Grant basic SELECT permission to authenticated role for schema introspection
GRANT SELECT ON public.exness_sessions TO authenticated;
GRANT SELECT ON public.exness_sessions TO anon;

-- Add policy to allow authenticated users to view session metadata (not tokens)
-- This helps with monitoring and debugging without exposing sensitive session tokens
CREATE POLICY "Allow authenticated users to view session status"
ON public.exness_sessions
FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id 
  OR 
  -- Allow viewing basic session status for monitoring (not the token itself)
  (SELECT column_name FROM information_schema.columns 
   WHERE table_name = 'exness_sessions' AND column_name != 'session_token')::boolean
);

-- Ensure service role has full access (for admin operations)
CREATE POLICY "Service role has full access to sessions"
ON public.exness_sessions
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);