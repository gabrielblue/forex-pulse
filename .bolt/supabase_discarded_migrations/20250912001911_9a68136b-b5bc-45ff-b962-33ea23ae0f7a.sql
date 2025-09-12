-- Fix security issue: Update RLS policies for exness_sessions table
-- to ensure only authenticated users can access their own session data

-- Drop existing policies to recreate them properly
DROP POLICY IF EXISTS "Users can view only their own Exness sessions" ON exness_sessions;
DROP POLICY IF EXISTS "Users can create only their own Exness sessions" ON exness_sessions;
DROP POLICY IF EXISTS "Users can update only their own Exness sessions" ON exness_sessions;
DROP POLICY IF EXISTS "Users can delete only their own Exness sessions" ON exness_sessions;

-- Ensure RLS is enabled
ALTER TABLE exness_sessions ENABLE ROW LEVEL SECURITY;

-- Create secure policies that properly restrict access
CREATE POLICY "Users can view their own Exness sessions"
ON exness_sessions
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own Exness sessions"
ON exness_sessions
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own Exness sessions"
ON exness_sessions
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own Exness sessions"
ON exness_sessions
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);