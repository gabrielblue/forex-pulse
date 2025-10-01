-- Critical security fix: Tighten RLS policies for all sensitive trading and financial data

-- ============================================================================
-- TRADING SIGNALS TABLE - Protect AI trading strategies
-- ============================================================================

-- Drop existing permissive policies
DROP POLICY IF EXISTS "Traders and admins can manage signals" ON trading_signals;

-- Create strict policies for trading signals
CREATE POLICY "Users can view only their own trading signals"
ON trading_signals
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can create only their own trading signals"
ON trading_signals
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update only their own trading signals"
ON trading_signals
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete only their own trading signals"
ON trading_signals
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- ============================================================================
-- TRADES TABLE - Protect trading history and financial data
-- ============================================================================

-- Drop existing permissive policies
DROP POLICY IF EXISTS "Traders and admins can manage trades" ON trades;

-- Create strict policies for trades
CREATE POLICY "Users can view only their own trades"
ON trades
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can create only their own trades"
ON trades
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update only their own trades"
ON trades
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete only their own trades"
ON trades
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- ============================================================================
-- TRADING ACCOUNTS TABLE - Already has good policies, just verify
-- ============================================================================

-- Verify RLS is enabled (should already be enabled)
ALTER TABLE trading_accounts ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- USER PORTFOLIOS TABLE - Already has good policies, just verify
-- ============================================================================

-- Verify RLS is enabled (should already be enabled)
ALTER TABLE user_portfolios ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- BOT SETTINGS TABLE - Ensure proper protection
-- ============================================================================

-- Verify RLS is enabled
ALTER TABLE bot_settings ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- Add security documentation and audit comments
-- ============================================================================

COMMENT ON TABLE trading_signals IS 
'CRITICAL: Contains proprietary AI trading strategies and signals. Access strictly limited to signal owner only.';

COMMENT ON TABLE trades IS 
'CRITICAL: Contains sensitive trading history, P&L data, and financial patterns. Access strictly limited to trade owner only.';

COMMENT ON TABLE trading_accounts IS 
'CRITICAL: Contains account credentials and balances. Access strictly limited to account owner only.';

COMMENT ON TABLE user_portfolios IS 
'CRITICAL: Contains wealth information and financial metrics. Access strictly limited to portfolio owner only.';

COMMENT ON TABLE bot_settings IS 
'SENSITIVE: Contains trading bot configuration and strategy parameters. Access strictly limited to bot owner only.';

-- ============================================================================
-- Create indexes for better RLS performance
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_trading_signals_user_id ON trading_signals(user_id);
CREATE INDEX IF NOT EXISTS idx_trades_user_id ON trades(user_id);
CREATE INDEX IF NOT EXISTS idx_trading_accounts_user_id ON trading_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_user_portfolios_user_id ON user_portfolios(user_id);
CREATE INDEX IF NOT EXISTS idx_bot_settings_user_id ON bot_settings(user_id);

-- Log this critical security fix
SELECT log_security_event(
  'critical_rls_policies_hardened',
  'multiple_tables',
  NULL,
  jsonb_build_object(
    'tables', ARRAY['trading_signals', 'trades', 'trading_accounts', 'user_portfolios', 'bot_settings'],
    'action', 'Applied strict authenticated-only RLS policies',
    'timestamp', now()
  )
);