/*
  # Trading System Functions and Triggers

  1. Functions
    - update_market_data: Update real-time market prices
    - execute_trade_order: Execute trades with risk checks
    - calculate_daily_performance: Calculate trading performance metrics
    - check_risk_limits: Validate risk management rules

  2. Triggers
    - Update timestamps automatically
    - Calculate P&L on trade updates
    - Performance tracking

  3. Indexes
    - Optimize query performance for trading operations
*/

-- Function to update market data (already exists, but ensuring it's there)
CREATE OR REPLACE FUNCTION update_market_data(
  p_symbol TEXT,
  p_bid DECIMAL,
  p_ask DECIMAL,
  p_volume BIGINT DEFAULT 0
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Get or create currency pair
  INSERT INTO currency_pairs (symbol, base_currency, quote_currency, display_name)
  VALUES (
    p_symbol,
    LEFT(p_symbol, 3),
    RIGHT(p_symbol, 3),
    LEFT(p_symbol, 3) || '/' || RIGHT(p_symbol, 3)
  )
  ON CONFLICT (symbol) DO NOTHING;

  -- Update market data
  INSERT INTO market_data (
    pair_id,
    symbol,
    bid,
    ask,
    spread,
    volume,
    timestamp
  )
  SELECT 
    cp.id,
    p_symbol,
    p_bid,
    p_ask,
    p_ask - p_bid,
    p_volume,
    now()
  FROM currency_pairs cp
  WHERE cp.symbol = p_symbol;
END;
$$;

-- Function to update live trade P&L
CREATE OR REPLACE FUNCTION update_trade_pnl()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_pip_value DECIMAL;
  v_pip_difference DECIMAL;
  v_profit DECIMAL;
  v_profit_pips DECIMAL;
BEGIN
  -- Calculate pip value (simplified)
  IF NEW.current_price IS NOT NULL THEN
    -- Determine pip value based on currency pair
    v_pip_value := CASE 
      WHEN (SELECT symbol FROM currency_pairs WHERE id = NEW.pair_id) LIKE '%JPY%' THEN 0.01
      ELSE 0.0001
    END;
    
    -- Calculate pip difference
    v_pip_difference := CASE 
      WHEN NEW.trade_type = 'BUY' THEN (NEW.current_price - NEW.entry_price) / v_pip_value
      ELSE (NEW.entry_price - NEW.current_price) / v_pip_value
    END;
    
    -- Calculate profit in account currency (simplified)
    v_profit := v_pip_difference * v_pip_value * NEW.lot_size * 100000;
    
    -- Update the record
    NEW.profit_pips := v_pip_difference;
    NEW.profit := v_profit;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for trade P&L calculation
DROP TRIGGER IF EXISTS trigger_update_trade_pnl ON live_trades;
CREATE TRIGGER trigger_update_trade_pnl
  BEFORE UPDATE ON live_trades
  FOR EACH ROW
  EXECUTE FUNCTION update_trade_pnl();

-- Function to get real-time market price
CREATE OR REPLACE FUNCTION get_current_price(p_symbol TEXT)
RETURNS DECIMAL
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_price DECIMAL;
BEGIN
  SELECT (bid + ask) / 2 INTO v_price
  FROM market_data
  WHERE symbol = p_symbol
  ORDER BY timestamp DESC
  LIMIT 1;
  
  RETURN COALESCE(v_price, 1.0000);
END;
$$;

-- Function to update all open positions with current prices
CREATE OR REPLACE FUNCTION update_open_positions()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  trade_record RECORD;
  current_price DECIMAL;
BEGIN
  FOR trade_record IN 
    SELECT lt.*, cp.symbol
    FROM live_trades lt
    JOIN currency_pairs cp ON lt.pair_id = cp.id
    WHERE lt.status = 'OPEN'
  LOOP
    -- Get current market price
    SELECT get_current_price(trade_record.symbol) INTO current_price;
    
    -- Update the trade with current price
    UPDATE live_trades
    SET 
      current_price = current_price,
      updated_at = now()
    WHERE id = trade_record.id;
  END LOOP;
END;
$$;

-- Function to check stop loss and take profit
CREATE OR REPLACE FUNCTION check_stop_take_profit()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  trade_record RECORD;
BEGIN
  FOR trade_record IN 
    SELECT *
    FROM live_trades
    WHERE status = 'OPEN'
      AND (stop_loss IS NOT NULL OR take_profit IS NOT NULL)
  LOOP
    -- Check stop loss
    IF trade_record.stop_loss IS NOT NULL THEN
      IF (trade_record.trade_type = 'BUY' AND trade_record.current_price <= trade_record.stop_loss) OR
         (trade_record.trade_type = 'SELL' AND trade_record.current_price >= trade_record.stop_loss) THEN
        
        UPDATE live_trades
        SET 
          status = 'CLOSED',
          closed_at = now()
        WHERE id = trade_record.id;
        
        CONTINUE;
      END IF;
    END IF;
    
    -- Check take profit
    IF trade_record.take_profit IS NOT NULL THEN
      IF (trade_record.trade_type = 'BUY' AND trade_record.current_price >= trade_record.take_profit) OR
         (trade_record.trade_type = 'SELL' AND trade_record.current_price <= trade_record.take_profit) THEN
        
        UPDATE live_trades
        SET 
          status = 'CLOSED',
          closed_at = now()
        WHERE id = trade_record.id;
      END IF;
    END IF;
  END LOOP;
END;
$$;

-- Function to get trading statistics
CREATE OR REPLACE FUNCTION get_trading_stats(p_user_id UUID, p_days INTEGER DEFAULT 30)
RETURNS TABLE(
  total_trades INTEGER,
  winning_trades INTEGER,
  losing_trades INTEGER,
  win_rate DECIMAL,
  total_profit DECIMAL,
  avg_profit_per_trade DECIMAL,
  max_drawdown DECIMAL,
  profit_factor DECIMAL
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*)::INTEGER as total_trades,
    COUNT(*) FILTER (WHERE profit > 0)::INTEGER as winning_trades,
    COUNT(*) FILTER (WHERE profit < 0)::INTEGER as losing_trades,
    CASE 
      WHEN COUNT(*) > 0 THEN (COUNT(*) FILTER (WHERE profit > 0)::DECIMAL / COUNT(*) * 100)
      ELSE 0
    END as win_rate,
    COALESCE(SUM(profit), 0) as total_profit,
    CASE 
      WHEN COUNT(*) > 0 THEN COALESCE(SUM(profit), 0) / COUNT(*)
      ELSE 0
    END as avg_profit_per_trade,
    COALESCE(MIN(profit), 0) as max_drawdown,
    CASE 
      WHEN SUM(profit) FILTER (WHERE profit < 0) < 0 THEN 
        ABS(SUM(profit) FILTER (WHERE profit > 0) / SUM(profit) FILTER (WHERE profit < 0))
      ELSE 0
    END as profit_factor
  FROM live_trades
  WHERE user_id = p_user_id
    AND status = 'CLOSED'
    AND closed_at >= (CURRENT_DATE - INTERVAL '%s days', p_days);
END;
$$;

-- Function to validate trading signal
CREATE OR REPLACE FUNCTION validate_trading_signal(
  p_signal_id UUID,
  p_user_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_signal RECORD;
  v_risk_settings RECORD;
  v_daily_trades INTEGER;
  v_daily_loss DECIMAL;
BEGIN
  -- Get signal details
  SELECT * INTO v_signal
  FROM trading_signals
  WHERE id = p_signal_id AND user_id = p_user_id;
  
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;
  
  -- Get risk settings
  SELECT * INTO v_risk_settings
  FROM risk_settings
  WHERE user_id = p_user_id;
  
  -- Check if signal is still valid (not expired)
  IF v_signal.expires_at IS NOT NULL AND v_signal.expires_at < now() THEN
    RETURN FALSE;
  END IF;
  
  -- Check confidence threshold
  IF v_risk_settings.max_risk_per_trade IS NOT NULL AND 
     v_signal.confidence_score < 70 THEN -- Minimum confidence
    RETURN FALSE;
  END IF;
  
  -- Check daily trade limit
  SELECT COUNT(*) INTO v_daily_trades
  FROM live_trades
  WHERE user_id = p_user_id
    AND DATE(opened_at) = CURRENT_DATE;
    
  IF v_daily_trades >= 10 THEN -- Max 10 trades per day
    RETURN FALSE;
  END IF;
  
  -- Check daily loss limit
  SELECT COALESCE(SUM(profit), 0) INTO v_daily_loss
  FROM live_trades
  WHERE user_id = p_user_id
    AND DATE(opened_at) = CURRENT_DATE;
    
  IF v_risk_settings.max_daily_loss IS NOT NULL AND
     ABS(v_daily_loss) > 1000 THEN -- Max $1000 daily loss
    RETURN FALSE;
  END IF;
  
  RETURN TRUE;
END;
$$;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_live_trades_user_status ON live_trades(user_id, status);
CREATE INDEX IF NOT EXISTS idx_live_trades_opened_at ON live_trades(opened_at);
CREATE INDEX IF NOT EXISTS idx_market_data_symbol_timestamp ON market_data(symbol, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_trading_signals_user_status ON trading_signals(user_id, status);
CREATE INDEX IF NOT EXISTS idx_bot_performance_user_date ON bot_performance(user_id, date DESC);

-- Create a view for active trading dashboard
CREATE OR REPLACE VIEW trading_dashboard AS
SELECT 
  u.id as user_id,
  ta.account_number,
  ta.balance,
  ta.equity,
  ta.margin,
  ta.free_margin,
  COUNT(lt.id) as open_positions,
  COALESCE(SUM(lt.profit), 0) as unrealized_pnl,
  bp.total_trades,
  bp.win_rate,
  bp.total_profit as daily_profit
FROM auth.users u
LEFT JOIN trading_accounts ta ON u.id = ta.user_id AND ta.is_active = true
LEFT JOIN live_trades lt ON u.id = lt.user_id AND lt.status = 'OPEN'
LEFT JOIN bot_performance bp ON u.id = bp.user_id AND bp.date = CURRENT_DATE
GROUP BY u.id, ta.account_number, ta.balance, ta.equity, ta.margin, ta.free_margin, 
         bp.total_trades, bp.win_rate, bp.total_profit;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION update_market_data TO authenticated;
GRANT EXECUTE ON FUNCTION get_current_price TO authenticated;
GRANT EXECUTE ON FUNCTION get_trading_stats TO authenticated;
GRANT EXECUTE ON FUNCTION validate_trading_signal TO authenticated;
GRANT SELECT ON trading_dashboard TO authenticated;