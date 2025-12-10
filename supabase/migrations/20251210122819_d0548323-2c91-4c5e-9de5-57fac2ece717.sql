-- Fix 1: Simplify exness_sessions RLS policies to prevent session_token exposure
-- Drop the problematic complex policy that might expose session_token
DROP POLICY IF EXISTS "Allow authenticated users to view session status" ON exness_sessions;

-- Ensure the simple, secure user-based policy exists
DROP POLICY IF EXISTS "Users can view their own Exness sessions" ON exness_sessions;
CREATE POLICY "Users can view their own Exness sessions"
ON exness_sessions
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);