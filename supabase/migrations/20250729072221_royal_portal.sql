/*
  # Fix RLS Policy Errors

  1. Policy Fixes
    - Fix INSERT policies that need WITH CHECK expressions
    - Ensure proper policy syntax for all operations
    - Add missing policies where needed

  2. Security
    - Maintain proper access controls
    - Fix policy expressions for INSERT operations
*/

-- Fix trading_signals policies
DROP POLICY IF EXISTS "Traders and admins can manage signals" ON trading_signals;

CREATE POLICY "Traders can view own signals"
  ON trading_signals
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Traders can insert own signals"
  ON trading_signals
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Traders can update own signals"
  ON trading_signals
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Traders can delete own signals"
  ON trading_signals
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Fix trades policies
DROP POLICY IF EXISTS "Traders and admins can manage trades" ON trades;

CREATE POLICY "Traders can view own trades"
  ON trades
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Traders can insert own trades"
  ON trades
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Traders can update own trades"
  ON trades
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Traders can delete own trades"
  ON trades
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Fix bot_settings policies
DROP POLICY IF EXISTS "Traders and admins can manage bot settings" ON bot_settings;

CREATE POLICY "Users can view own bot settings"
  ON bot_settings
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own bot settings"
  ON bot_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own bot settings"
  ON bot_settings
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own bot settings"
  ON bot_settings
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Fix user_portfolios policies
DROP POLICY IF EXISTS "Traders and admins can manage portfolios" ON user_portfolios;

CREATE POLICY "Users can view own portfolios"
  ON user_portfolios
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own portfolios"
  ON user_portfolios
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own portfolios"
  ON user_portfolios
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own portfolios"
  ON user_portfolios
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create missing users table if it doesn't exist
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT auth.uid(),
  email text UNIQUE NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own data"
  ON users
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own data"
  ON users
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own data"
  ON users
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Add foreign key constraints that reference users table
DO $$
BEGIN
  -- Add foreign key for trading_signals if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'trading_signals_user_id_fkey'
  ) THEN
    ALTER TABLE trading_signals 
    ADD CONSTRAINT trading_signals_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;

  -- Add foreign key for trades if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'trades_user_id_fkey'
  ) THEN
    ALTER TABLE trades 
    ADD CONSTRAINT trades_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;

  -- Add foreign key for bot_settings if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'bot_settings_user_id_fkey'
  ) THEN
    ALTER TABLE bot_settings 
    ADD CONSTRAINT bot_settings_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;

  -- Add foreign key for user_portfolios if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'user_portfolios_user_id_fkey'
  ) THEN
    ALTER TABLE user_portfolios 
    ADD CONSTRAINT user_portfolios_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Create helper functions for role checking
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid
LANGUAGE sql STABLE
AS $$
  SELECT COALESCE(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$$;

-- Update the has_role function to work with the new structure
CREATE OR REPLACE FUNCTION has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM user_roles 
    WHERE user_id = _user_id AND role = _role
  );
END;
$$;

-- Create function to get current user role
CREATE OR REPLACE FUNCTION get_current_user_role()
RETURNS app_role
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_role app_role;
BEGIN
  SELECT role INTO user_role
  FROM user_roles
  WHERE user_id = auth.uid()
  LIMIT 1;
  
  RETURN COALESCE(user_role, 'viewer'::app_role);
END;
$$;

-- Create trigger function for updating updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Add updated_at triggers where missing
DO $$
BEGIN
  -- Add trigger for users table
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.triggers 
    WHERE trigger_name = 'update_users_updated_at'
  ) THEN
    CREATE TRIGGER update_users_updated_at
      BEFORE UPDATE ON users
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;

  -- Add trigger for trading_signals table
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.triggers 
    WHERE trigger_name = 'update_trading_signals_updated_at'
  ) THEN
    CREATE TRIGGER update_trading_signals_updated_at
      BEFORE UPDATE ON trading_signals
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;

  -- Add trigger for trades table
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.triggers 
    WHERE trigger_name = 'update_trades_updated_at'
  ) THEN
    CREATE TRIGGER update_trades_updated_at
      BEFORE UPDATE ON trades
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;

  -- Add trigger for bot_settings table
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.triggers 
    WHERE trigger_name = 'update_bot_settings_updated_at'
  ) THEN
    CREATE TRIGGER update_bot_settings_updated_at
      BEFORE UPDATE ON bot_settings
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;

  -- Add trigger for user_portfolios table
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.triggers 
    WHERE trigger_name = 'update_user_portfolios_updated_at'
  ) THEN
    CREATE TRIGGER update_user_portfolios_updated_at
      BEFORE UPDATE ON user_portfolios
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;