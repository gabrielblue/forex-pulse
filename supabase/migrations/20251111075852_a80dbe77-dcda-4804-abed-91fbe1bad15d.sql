-- Fix security_audit_log RLS policy to restrict INSERT to service_role only
-- Current policy allows anyone to insert (policy with condition 'true')

-- Drop the existing permissive policy
DROP POLICY IF EXISTS "System can insert audit logs" ON public.security_audit_log;

-- Create a new policy that only allows service_role to insert
CREATE POLICY "Only service role can insert audit logs"
ON public.security_audit_log
FOR INSERT
TO service_role
WITH CHECK (true);

-- Create a policy for authenticated users to insert their own audit logs via security definer functions
CREATE POLICY "Functions can insert audit logs"
ON public.security_audit_log
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- Add a comment explaining the security model
COMMENT ON TABLE public.security_audit_log IS 'Audit log table. Direct inserts restricted to service_role and user-scoped inserts via SECURITY DEFINER functions only. This prevents attackers from polluting audit logs.';