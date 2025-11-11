-- Security hardening migration: fix public profile exposure, enforce strict rate_limits control, and secure exness_sessions tokens

-- 1) Profiles: restrict public profile reads to authenticated users only
DROP POLICY IF EXISTS "Public profiles viewable with limited data" ON public.profiles;
CREATE POLICY "Authenticated can view public profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (is_public = true);

-- Keep existing policy "Users can view their own profile" as-is

-- 2) Rate limits: tighten RLS and re-attach protective triggers
DROP POLICY IF EXISTS "Service role can manage rate limits" ON public.rate_limits;
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

-- Allow users to view only their own rate limits
DROP POLICY IF EXISTS "Users can view their own rate limits" ON public.rate_limits;
CREATE POLICY "Users can view their own rate limits"
ON public.rate_limits
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Only service role or admin can insert/update/delete
DROP POLICY IF EXISTS "rate_limits_manage_insert" ON public.rate_limits;
DROP POLICY IF EXISTS "rate_limits_manage_update" ON public.rate_limits;
DROP POLICY IF EXISTS "rate_limits_manage_delete" ON public.rate_limits;

CREATE POLICY "rate_limits_manage_insert"
ON public.rate_limits
FOR INSERT
TO authenticated
WITH CHECK (auth.role() = 'service_role' OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "rate_limits_manage_update"
ON public.rate_limits
FOR UPDATE
TO authenticated
USING (auth.role() = 'service_role' OR has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (auth.role() = 'service_role' OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "rate_limits_manage_delete"
ON public.rate_limits
FOR DELETE
TO authenticated
USING (auth.role() = 'service_role' OR has_role(auth.uid(), 'admin'::app_role));

-- Protective triggers (recreate to ensure present)
DROP TRIGGER IF EXISTS prevent_rate_limit_manipulation_trigger ON public.rate_limits;
CREATE TRIGGER prevent_rate_limit_manipulation_trigger
BEFORE INSERT OR UPDATE OR DELETE ON public.rate_limits
FOR EACH ROW EXECUTE FUNCTION public.prevent_rate_limit_manipulation();

DROP TRIGGER IF EXISTS audit_rate_limit_changes_trigger ON public.rate_limits;
CREATE TRIGGER audit_rate_limit_changes_trigger
AFTER UPDATE ON public.rate_limits
FOR EACH ROW EXECUTE FUNCTION public.audit_rate_limit_changes();

-- 3) Exness sessions: ensure tokens are encrypted at rest and protected
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Encrypt tokens on write
DROP TRIGGER IF EXISTS encrypt_exness_token_trigger ON public.exness_sessions;
CREATE TRIGGER encrypt_exness_token_trigger
BEFORE INSERT OR UPDATE ON public.exness_sessions
FOR EACH ROW EXECUTE FUNCTION public.encrypt_exness_token();

-- Auto-update updated_at
DROP TRIGGER IF EXISTS update_exness_sessions_updated_at ON public.exness_sessions;
CREATE TRIGGER update_exness_sessions_updated_at
BEFORE UPDATE ON public.exness_sessions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Revoke direct read access to raw session_token for authenticated users
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'exness_sessions' AND column_name = 'session_token'
  ) THEN
    REVOKE SELECT (session_token) ON public.exness_sessions FROM authenticated;
  END IF;
END $$;

COMMENT ON COLUMN public.exness_sessions.session_token IS 'Encrypted at rest via pgcrypto; SELECT revoked from authenticated. Use get_user_exness_session_metrics() for safe access.';

-- 4) Notes on other warnings (no SQL changes needed)
-- OTP expiry is already set to 300s and leaked password protection enabled in supabase/config.toml.
-- Postgres version upgrade must be done via the Supabase dashboard.
