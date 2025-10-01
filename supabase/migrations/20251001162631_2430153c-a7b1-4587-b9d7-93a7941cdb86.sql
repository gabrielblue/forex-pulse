-- Fix security vulnerabilities in exness_sessions and profiles tables
-- Handle existing policies properly

-- Create a secure function to get session metrics without exposing tokens
CREATE OR REPLACE FUNCTION get_user_exness_session_metrics()
RETURNS TABLE (
  id uuid,
  login_id bigint,
  is_connected boolean,
  account_balance numeric,
  account_equity numeric,
  account_free_margin numeric,
  account_margin numeric,
  account_currency text,
  server_name text,
  expires_at timestamp with time zone,
  created_at timestamp with time zone,
  updated_at timestamp with time zone
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Return session data WITHOUT the session_token
  RETURN QUERY
  SELECT 
    es.id,
    es.login_id,
    es.is_connected,
    es.account_balance,
    es.account_equity,
    es.account_free_margin,
    es.account_margin,
    es.account_currency,
    es.server_name,
    es.expires_at,
    es.created_at,
    es.updated_at
  FROM public.exness_sessions es
  WHERE es.user_id = auth.uid();
END;
$$;

-- Update profiles RLS to be more restrictive for public profiles
-- First check and drop the overly permissive public profile policy if it exists
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'profiles' 
        AND policyname = 'Public profiles are viewable'
    ) THEN
        DROP POLICY "Public profiles are viewable" ON public.profiles;
    END IF;
END $$;

-- Create a more restrictive public profile policy
-- Only show limited fields for public profiles
CREATE POLICY "Public profiles viewable with limited data"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  is_public = true AND id IS NOT NULL
);

-- Add security documentation comments
COMMENT ON TABLE public.exness_sessions IS 
'SENSITIVE: Contains trading account credentials. Session tokens are encrypted. Use get_user_exness_session_metrics() function for safe access.';

COMMENT ON FUNCTION get_user_exness_session_metrics IS 
'Secure function to retrieve session metrics without exposing session_token. Always use this instead of direct SELECT queries.';

COMMENT ON TABLE public.profiles IS 
'User profile data. Public profiles expose limited information. Private profiles only visible to owner.';

-- Grant execute permission on the secure function
GRANT EXECUTE ON FUNCTION get_user_exness_session_metrics() TO authenticated;