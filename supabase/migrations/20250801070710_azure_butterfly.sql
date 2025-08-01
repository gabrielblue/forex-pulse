/*
  # Fix duplicate policy error for trading_accounts table

  1. Changes
    - Drop existing policy if it exists before creating new one
    - Ensure proper RLS setup for trading_accounts table
    - Add proper foreign key constraint to users table

  2. Security
    - Users can only manage their own trading accounts
    - Proper RLS policies for CRUD operations
*/

-- Drop the existing policy if it exists
DROP POLICY IF EXISTS "Users can manage their own trading accounts" ON trading_accounts;

-- Ensure RLS is enabled
ALTER TABLE trading_accounts ENABLE ROW LEVEL SECURITY;

-- Create the policy with proper permissions
CREATE POLICY "Users can manage their own trading accounts"
  ON trading_accounts
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Ensure the foreign key constraint exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'trading_accounts_user_id_fkey' 
    AND table_name = 'trading_accounts'
  ) THEN
    ALTER TABLE trading_accounts 
    ADD CONSTRAINT trading_accounts_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;