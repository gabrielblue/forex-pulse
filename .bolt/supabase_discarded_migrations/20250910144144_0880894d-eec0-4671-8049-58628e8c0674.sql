-- Drop the vulnerable public VIEW that exposes sensitive trading data
DROP VIEW IF EXISTS public.exness_sessions_public CASCADE;

-- Ensure the main exness_sessions table has proper RLS policies
-- First, check and recreate policies if needed to ensure they're correct
DROP POLICY IF EXISTS "Users can view their own Exness sessions" ON public.exness_sessions;
DROP POLICY IF EXISTS "Users can create their own Exness sessions" ON public.exness_sessions;
DROP POLICY IF EXISTS "Users can update their own Exness sessions" ON public.exness_sessions;
DROP POLICY IF EXISTS "Users can delete their own Exness sessions" ON public.exness_sessions;
DROP POLICY IF EXISTS "Users can manage their own sessions" ON public.exness_sessions;

-- Enable RLS if not already enabled
ALTER TABLE public.exness_sessions ENABLE ROW LEVEL SECURITY;

-- Create strict RLS policies that only allow users to access their own data
CREATE POLICY "Users can view only their own Exness sessions" 
ON public.exness_sessions 
FOR SELECT 
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can create only their own Exness sessions" 
ON public.exness_sessions 
FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update only their own Exness sessions" 
ON public.exness_sessions 
FOR UPDATE 
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete only their own Exness sessions" 
ON public.exness_sessions 
FOR DELETE 
TO authenticated
USING (auth.uid() = user_id);

-- Add an index on user_id for better performance
CREATE INDEX IF NOT EXISTS idx_exness_sessions_user_id ON public.exness_sessions(user_id);

-- Ensure the session_token column is properly encrypted (already has trigger)
-- Add a comment to document the security measures
COMMENT ON TABLE public.exness_sessions IS 'Stores Exness trading session data with strict RLS policies. Session tokens are encrypted automatically via trigger.';
COMMENT ON COLUMN public.exness_sessions.session_token IS 'Encrypted session token - automatically encrypted on insert/update via encrypt_exness_token() trigger';

-- Log this security fix
SELECT log_security_event(
  'security_fix_applied',
  'exness_sessions_public',
  NULL,
  jsonb_build_object(
    'action', 'dropped_public_view',
    'reason', 'Removed publicly accessible view containing sensitive trading data',
    'timestamp', now()
  )
);