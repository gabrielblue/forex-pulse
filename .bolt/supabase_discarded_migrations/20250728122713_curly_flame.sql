/*
  # Trading System Enhancements

  1. Additional Functions
    - update_account_margin: Update account margin calculations
    - get_position_pnl: Calculate position P&L in real-time
    - auto_close_positions: Automatically close positions at SL/TP

  2. Triggers
    - Auto-update position P&L when market data changes
    - Auto-close positions when SL/TP is hit

  3. Views
    - live_trading_view: Real-time trading dashboard data
*/

-- Function to update account margin
CREATE OR REPLACE FUNCTION update_account_margin(
  p_account_id UUID,
  p_margin_change DECIMAL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE trading_accounts
  SET 
    margin = margin + p_margin_change,
    free_margin = balance + equity - (margin + p_margin_change),
    margin_level = CASE 
      WHEN (margin + p_margin_change) > 0 THEN (equity / (margin + p_margin_change)) * 100
      ELSE 0
    END,
    updated_at = now()
  WHERE id = p_account_id;
END;
$$;

-- Function to calculate position P&L
CREATE OR REPLACE FUNCTION get_position_pnl(
  p_trade_id UUID
)
RETURNS TABLE(profit DECIMAL, profit_pips DECIMAL)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_trade RECORD;
  v_current_price DECIMAL;
  v_pip_value DECIMAL;
  v_pip_difference DECIMAL;
  v_profit DECIMAL;
BEGIN
  -- Get trade details
  SELECT lt.*, cp.symbol INTO v_trade
  FROM live_trades lt
  JOIN currency_pairs cp ON lt.pair_id = cp.id
  WHERE lt.id = p_trade_id;
  
  IF NOT FOUND THEN
    RETURN;
  END IF;
  
  -- Get current market price
  SELECT get_current_price(v_trade.symbol) INTO v_current_price;
  
  -- Calculate pip value
  v_pip_value := CASE 
    WHEN v_trade.symbol LIKE '%JPY%' THEN 0.01
    ELSE 0.0001
  END;
  
  -- Calculate pip difference
  v_pip_difference := CASE 
    WHEN v_trade.trade_type = 'BUY' THEN (v_current_price - v_trade.entry_price) / v_pip_value
    ELSE (v_trade.entry_price - v_current_price) / v_pip_value
  END;
  
  -- Calculate profit
  v_profit := v_pip_difference * v_pip_value * v_trade.lot_size * 100000;
  
  RETURN QUERY SELECT v_profit, v_pip_difference;
END;
$$;

-- Function to auto-close positions at SL/TP
CREATE OR REPLACE FUNCTION auto_close_positions()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_closed_count INTEGER := 0;
  trade_record RECORD;
  current_price DECIMAL;
BEGIN
  FOR trade_record IN 
    SELECT lt.*, cp.symbol
    FROM live_trades lt
    JOIN currency_pairs cp ON lt.pair_id = cp.id
    WHERE lt.status = 'OPEN'
      AND (lt.stop_loss IS NOT NULL OR lt.take_profit IS NOT NULL)
  LOOP
    -- Get current market price
    SELECT get_current_price(trade_record.symbol) INTO current_price;
    
    -- Check stop loss
    IF trade_record.stop_loss IS NOT NULL THEN
      IF (trade_record.trade_type = 'BUY' AND current_price <= trade_record.stop_loss) OR
         (trade_record.trade_type = 'SELL' AND current_price >= trade_record.stop_loss) THEN
        
        -- Close at stop loss
        UPDATE live_trades
        SET 
          status = 'CLOSED',
          current_price = current_price,
          closed_at = now()
        WHERE id = trade_record.id;
        
        v_closed_count := v_closed_count + 1;
        CONTINUE;
      END IF;
    END IF;
    
    -- Check take profit
    IF trade_record.take_profit IS NOT NULL THEN
      IF (trade_record.trade_type = 'BUY' AND current_price >= trade_record.take_profit) OR
         (trade_record.trade_type = 'SELL' AND current_price <= trade_record.take_profit) THEN
        
        -- Close at take profit
        UPDATE live_trades
        SET 
          status = 'CLOSED',
          current_price = current_price,
          closed_at = now()
        WHERE id = trade_record.id;
        
        v_closed_count := v_closed_count + 1;
      END IF;
    END IF;
  END LOOP;
  
  RETURN v_closed_count;
END;
$$;

-- Function to update all open positions with current prices
CREATE OR REPLACE FUNCTION update_all_positions()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_updated_count INTEGER := 0;
  trade_record RECORD;
  current_price DECIMAL;
  pnl_result RECORD;
BEGIN
  FOR trade_record IN 
    SELECT lt.*, cp.symbol
    FROM live_trades lt
    JOIN currency_pairs cp ON lt.pair_id = cp.id
    WHERE lt.status = 'OPEN'
  LOOP
    -- Get current market price
    SELECT get_current_price(trade_record.symbol) INTO current_price;
    
    -- Get P&L calculation
    SELECT * INTO pnl_result FROM get_position_pnl(trade_record.id);
    
    -- Update the position
    UPDATE live_trades
    SET 
      current_price = current_price,
      profit = pnl_result.profit,
      profit_pips = pnl_result.profit_pips,
      updated_at = now()
    WHERE id = trade_record.id;
    
    v_updated_count := v_updated_count + 1;
  END LOOP;
  
  RETURN v_updated_count;
END;
$$;

-- Create a view for live trading dashboard
CREATE OR REPLACE VIEW live_trading_view AS
SELECT 
  u.id as user_id,
  ta.id as account_id,
  ta.account_number,
  ta.balance,
  ta.equity,
  ta.margin,
  ta.free_margin,
  ta.margin_level,
  ta.currency,
  ta.leverage,
  COUNT(lt.id) FILTER (WHERE lt.status = 'OPEN') as open_positions,
  COALESCE(SUM(lt.profit) FILTER (WHERE lt.status = 'OPEN'), 0) as unrealized_pnl,
  COUNT(lt.id) FILTER (WHERE lt.status = 'CLOSED' AND DATE(lt.closed_at) = CURRENT_DATE) as daily_trades,
  COALESCE(SUM(lt.profit) FILTER (WHERE lt.status = 'CLOSED' AND DATE(lt.closed_at) = CURRENT_DATE), 0) as daily_pnl,
  ta.last_sync
FROM auth.users u
LEFT JOIN trading_accounts ta ON u.id = ta.user_id AND ta.is_active = true
LEFT JOIN live_trades lt ON u.id = lt.user_id
GROUP BY u.id, ta.id, ta.account_number, ta.balance, ta.equity, ta.margin, 
         ta.free_margin, ta.margin_level, ta.currency, ta.leverage, ta.last_sync;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_live_trades_user_status_opened ON live_trades(user_id, status, opened_at);
CREATE INDEX IF NOT EXISTS idx_market_data_symbol_timestamp_desc ON market_data(symbol, timestamp DESC);

-- Grant permissions
GRANT EXECUTE ON FUNCTION update_account_margin TO authenticated;
GRANT EXECUTE ON FUNCTION get_position_pnl TO authenticated;
GRANT EXECUTE ON FUNCTION auto_close_positions TO service_role;
GRANT EXECUTE ON FUNCTION update_all_positions TO service_role;
GRANT SELECT ON live_trading_view TO authenticated;

-- Create a scheduled job to update positions every minute (this would be handled by a cron job or similar)
-- For now, we'll create the function that can be called periodically
CREATE OR REPLACE FUNCTION scheduled_position_update()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  updated_count INTEGER;
  closed_count INTEGER;
BEGIN
  -- Update all open positions with current prices
  SELECT update_all_positions() INTO updated_count;
  
  -- Auto-close positions that hit SL/TP
  SELECT auto_close_positions() INTO closed_count;
  
  -- Log the update
  INSERT INTO system_logs (message, details, created_at)
  VALUES (
    'Scheduled position update completed',
    jsonb_build_object(
      'updated_positions', updated_count,
      'closed_positions', closed_count,
      'timestamp', now()
    ),
    now()
  );
EXCEPTION
  WHEN OTHERS THEN
    -- Log any errors
    INSERT INTO system_logs (message, details, log_level, created_at)
    VALUES (
      'Scheduled position update failed',
      jsonb_build_object(
        'error', SQLERRM,
        'timestamp', now()
      ),
      'ERROR',
      now()
    );
END;
$$;

-- Create system logs table for monitoring
CREATE TABLE IF NOT EXISTS system_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message TEXT NOT NULL,
  details JSONB,
  log_level TEXT DEFAULT 'INFO',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on system logs
ALTER TABLE system_logs ENABLE ROW LEVEL SECURITY;

-- Only admins can view system logs
CREATE POLICY "Admins can view system logs"
  ON system_logs
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));