-- Security hardening migration: enforce RLS and add missing triggers
-- 1) exness_sessions: ensure strict RLS and encryption/timestamp triggers
BEGIN;

-- Ensure RLS is enabled
ALTER TABLE public.exness_sessions ENABLE ROW LEVEL SECURITY;

-- Recreate strict per-user policies (idempotent)
DROP POLICY IF EXISTS "Users can view their own Exness sessions" ON public.exness_sessions;
DROP POLICY IF EXISTS "Users can create their own Exness sessions" ON public.exness_sessions;
DROP POLICY IF EXISTS "Users can update their own Exness sessions" ON public.exness_sessions;
DROP POLICY IF EXISTS "Users can delete their own Exness sessions" ON public.exness_sessions;

CREATE POLICY "Users can view their own Exness sessions"
ON public.exness_sessions
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own Exness sessions"
ON public.exness_sessions
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own Exness sessions"
ON public.exness_sessions
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own Exness sessions"
ON public.exness_sessions
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Encryption trigger for session_token
DROP TRIGGER IF EXISTS encrypt_exness_token_trigger ON public.exness_sessions;
CREATE TRIGGER encrypt_exness_token_trigger
  BEFORE INSERT OR UPDATE ON public.exness_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.encrypt_exness_token();

-- Updated_at maintenance trigger
DROP TRIGGER IF EXISTS update_exness_sessions_updated_at ON public.exness_sessions;
CREATE TRIGGER update_exness_sessions_updated_at
  BEFORE UPDATE ON public.exness_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 2) rate_limits: prevent manipulation + audit triggers and uniqueness on (user_id, action)
-- Ensure a uniqueness to avoid duplicates
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'rate_limits_user_action_unique'
  ) THEN
    CREATE UNIQUE INDEX rate_limits_user_action_unique ON public.rate_limits(user_id, action);
  END IF;
END$$;

-- Prevent direct manipulation (service role exempt)
DROP TRIGGER IF EXISTS prevent_rate_limit_manipulation_trigger ON public.rate_limits;
CREATE TRIGGER prevent_rate_limit_manipulation_trigger
  BEFORE INSERT OR UPDATE ON public.rate_limits
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_rate_limit_manipulation();

-- Audit significant changes
DROP TRIGGER IF EXISTS audit_rate_limit_changes_trigger ON public.rate_limits;
CREATE TRIGGER audit_rate_limit_changes_trigger
  AFTER UPDATE ON public.rate_limits
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_rate_limit_changes();

-- 3) market_data validation + audit triggers
DROP TRIGGER IF EXISTS validate_market_data_trigger ON public.market_data;
CREATE TRIGGER validate_market_data_trigger
  BEFORE INSERT OR UPDATE ON public.market_data
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_market_data();

DROP TRIGGER IF EXISTS audit_market_data_changes ON public.market_data;
CREATE TRIGGER audit_market_data_changes
  AFTER INSERT OR UPDATE ON public.market_data
  FOR EACH ROW
  EXECUTE FUNCTION public.log_market_data_changes();

-- 4) Log security hardening applied
SELECT public.log_security_event(
  'security_hardening_applied',
  NULL,
  NULL,
  jsonb_build_object(
    'areas', ARRAY['exness_sessions_rls','rate_limits_triggers','market_data_triggers'],
    'timestamp', now()
  )
);

COMMIT;