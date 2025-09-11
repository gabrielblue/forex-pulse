-- CRITICAL SECURITY FIX: Restrict all sensitive trading data to authenticated users only
-- This migration fixes multiple critical security vulnerabilities where trading data was exposed

-- =============================================
-- 1. FIX TRADING_ACCOUNTS TABLE
-- =============================================
-- Drop existing policy and recreate with proper authentication requirement
DROP POLICY IF EXISTS "Users can manage their own trading accounts" ON public.trading_accounts;

-- Create separate policies for each action with authenticated role restriction
CREATE POLICY "Users can view their own trading accounts" 
ON public.trading_accounts 
FOR SELECT 
TO authenticated  -- CRITICAL: Only authenticated users
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own trading accounts" 
ON public.trading_accounts 
FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own trading accounts" 
ON public.trading_accounts 
FOR UPDATE 
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own trading accounts" 
ON public.trading_accounts 
FOR DELETE 
TO authenticated
USING (auth.uid() = user_id);

-- =============================================
-- 2. FIX LIVE_TRADES TABLE
-- =============================================
-- Drop all existing policies with 'public' role
DROP POLICY IF EXISTS "Users can view their own live trades" ON public.live_trades;
DROP POLICY IF EXISTS "Users can create their own live trades" ON public.live_trades;
DROP POLICY IF EXISTS "Users can update their own live trades" ON public.live_trades;
DROP POLICY IF EXISTS "Users can delete their own live trades" ON public.live_trades;

-- Recreate with authenticated role only
CREATE POLICY "Authenticated users can view their own live trades" 
ON public.live_trades 
FOR SELECT 
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Authenticated users can create their own live trades" 
ON public.live_trades 
FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Authenticated users can update their own live trades" 
ON public.live_trades 
FOR UPDATE 
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Authenticated users can delete their own live trades" 
ON public.live_trades 
FOR DELETE 
TO authenticated
USING (auth.uid() = user_id);

-- =============================================
-- 3. FIX USER_PORTFOLIOS TABLE
-- =============================================
-- Drop existing policy
DROP POLICY IF EXISTS "Traders and admins can manage portfolios" ON public.user_portfolios;

-- Create authenticated-only policies
CREATE POLICY "Authenticated users can view their own portfolio" 
ON public.user_portfolios 
FOR SELECT 
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Authenticated users can insert their own portfolio" 
ON public.user_portfolios 
FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Authenticated users can update their own portfolio" 
ON public.user_portfolios 
FOR UPDATE 
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Authenticated users can delete their own portfolio" 
ON public.user_portfolios 
FOR DELETE 
TO authenticated
USING (auth.uid() = user_id);

-- =============================================
-- 4. FIX BOT_SETTINGS TABLE
-- =============================================
-- Drop existing policy
DROP POLICY IF EXISTS "Traders and admins can manage bot settings" ON public.bot_settings;

-- Create authenticated-only policies
CREATE POLICY "Authenticated users can view their own bot settings" 
ON public.bot_settings 
FOR SELECT 
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Authenticated users can insert their own bot settings" 
ON public.bot_settings 
FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Authenticated users can update their own bot settings" 
ON public.bot_settings 
FOR UPDATE 
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Authenticated users can delete their own bot settings" 
ON public.bot_settings 
FOR DELETE 
TO authenticated
USING (auth.uid() = user_id);

-- =============================================
-- 5. ADDITIONAL SECURITY MEASURES
-- =============================================

-- Add security comments to document the protection
COMMENT ON TABLE public.trading_accounts IS 'Contains sensitive trading account information. Protected by RLS - users can only access their own accounts.';
COMMENT ON TABLE public.live_trades IS 'Active trading positions with P&L data. Protected by RLS - users can only access their own trades.';
COMMENT ON TABLE public.user_portfolios IS 'Portfolio balances and performance metrics. Protected by RLS - users can only access their own portfolio.';
COMMENT ON TABLE public.bot_settings IS 'Trading bot configurations and strategies. Protected by RLS - users can only access their own settings.';
COMMENT ON TABLE public.exness_sessions IS 'Broker session tokens (encrypted). Protected by RLS - users can only access their own sessions.';

-- Create indexes for better performance on user_id lookups
CREATE INDEX IF NOT EXISTS idx_trading_accounts_user_id ON public.trading_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_live_trades_user_id ON public.live_trades(user_id);
CREATE INDEX IF NOT EXISTS idx_user_portfolios_user_id ON public.user_portfolios(user_id);
CREATE INDEX IF NOT EXISTS idx_bot_settings_user_id ON public.bot_settings(user_id);

-- Log this critical security fix
SELECT log_security_event(
  'critical_security_fix_applied',
  NULL,
  NULL,
  jsonb_build_object(
    'action', 'fixed_public_role_exposure',
    'tables_secured', ARRAY['trading_accounts', 'live_trades', 'user_portfolios', 'bot_settings'],
    'vulnerability', 'Tables were accessible to unauthenticated users via public role',
    'fix', 'Restricted all policies to authenticated role only',
    'timestamp', now()
  )
);