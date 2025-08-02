/*
  # Trading Bot Infrastructure

  1. New Tables
    - `api_keys` - Secure storage for broker API keys
    - `trading_accounts` - Broker account information
    - `live_trades` - Active trading positions
    - `trade_orders` - Order management system
    - `market_data` - Real-time price feeds
    - `bot_performance` - Performance tracking
    - `risk_settings` - Risk management parameters

  2. Security
    - Enable RLS on all tables
    - Add policies for secure access
    - Encrypt sensitive data

  3. Functions
    - Order execution functions
    - Risk management checks
    - Performance calculations
*/

-- API Keys table for secure storage
CREATE TABLE IF NOT EXISTS api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  broker_name TEXT NOT NULL,
  api_key_encrypted TEXT NOT NULL,
  api_secret_encrypted TEXT,
  account_number TEXT,
  server_name TEXT,
  is_demo BOOLEAN DEFAULT true,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Trading accounts table
CREATE TABLE IF NOT EXISTS trading_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  api_key_id UUID REFERENCES api_keys(id) ON DELETE CASCADE,
  account_number TEXT NOT NULL,
  broker_name TEXT NOT NULL,
  account_type TEXT DEFAULT 'demo',
  balance DECIMAL(15,2) DEFAULT 0,
  equity DECIMAL(15,2) DEFAULT 0,
  margin DECIMAL(15,2) DEFAULT 0,
  free_margin DECIMAL(15,2) DEFAULT 0,
  margin_level DECIMAL(5,2) DEFAULT 0,
  currency TEXT DEFAULT 'USD',
  leverage TEXT DEFAULT '1:100',
  server_name TEXT,
  last_sync TIMESTAMPTZ DEFAULT now(),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Live trades table
CREATE TABLE IF NOT EXISTS live_trades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id UUID REFERENCES trading_accounts(id) ON DELETE CASCADE,
  signal_id UUID REFERENCES trading_signals(id),
  pair_id UUID REFERENCES currency_pairs(id),
  trade_type TEXT NOT NULL CHECK (trade_type IN ('BUY', 'SELL')),
  lot_size DECIMAL(10,4) NOT NULL,
  entry_price DECIMAL(10,5) NOT NULL,
  current_price DECIMAL(10,5),
  stop_loss DECIMAL(10,5),
  take_profit DECIMAL(10,5),
  commission DECIMAL(10,2) DEFAULT 0,
  swap DECIMAL(10,2) DEFAULT 0,
  profit DECIMAL(10,2) DEFAULT 0,
  profit_pips DECIMAL(8,2) DEFAULT 0,
  status TEXT DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'CLOSED', 'PENDING')),
  broker_trade_id TEXT,
  opened_at TIMESTAMPTZ DEFAULT now(),
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Trade orders table
CREATE TABLE IF NOT EXISTS trade_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id UUID REFERENCES trading_accounts(id) ON DELETE CASCADE,
  signal_id UUID REFERENCES trading_signals(id),
  pair_id UUID REFERENCES currency_pairs(id),
  order_type TEXT NOT NULL CHECK (order_type IN ('MARKET', 'LIMIT', 'STOP', 'STOP_LIMIT')),
  trade_type TEXT NOT NULL CHECK (trade_type IN ('BUY', 'SELL')),
  lot_size DECIMAL(10,4) NOT NULL,
  price DECIMAL(10,5),
  stop_loss DECIMAL(10,5),
  take_profit DECIMAL(10,5),
  expiry TIMESTAMPTZ,
  status TEXT DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'FILLED', 'CANCELLED', 'REJECTED')),
  broker_order_id TEXT,
  filled_price DECIMAL(10,5),
  filled_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Market data table for real-time feeds
CREATE TABLE IF NOT EXISTS market_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pair_id UUID REFERENCES currency_pairs(id),
  symbol TEXT NOT NULL,
  bid DECIMAL(10,5) NOT NULL,
  ask DECIMAL(10,5) NOT NULL,
  spread DECIMAL(8,5),
  volume BIGINT DEFAULT 0,
  timestamp TIMESTAMPTZ DEFAULT now(),
  source TEXT DEFAULT 'MT5'
);

-- Bot performance tracking
CREATE TABLE IF NOT EXISTS bot_performance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id UUID REFERENCES trading_accounts(id),
  date DATE DEFAULT CURRENT_DATE,
  total_trades INTEGER DEFAULT 0,
  winning_trades INTEGER DEFAULT 0,
  losing_trades INTEGER DEFAULT 0,
  win_rate DECIMAL(5,2) DEFAULT 0,
  total_profit DECIMAL(15,2) DEFAULT 0,
  total_pips DECIMAL(10,2) DEFAULT 0,
  max_drawdown DECIMAL(5,2) DEFAULT 0,
  profit_factor DECIMAL(8,4) DEFAULT 0,
  sharpe_ratio DECIMAL(8,4) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, account_id, date)
);

-- Risk settings table
CREATE TABLE IF NOT EXISTS risk_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id UUID REFERENCES trading_accounts(id),
  max_risk_per_trade DECIMAL(5,2) DEFAULT 2.0,
  max_daily_loss DECIMAL(5,2) DEFAULT 5.0,
  max_drawdown DECIMAL(5,2) DEFAULT 15.0,
  max_position_size DECIMAL(15,2) DEFAULT 10000,
  max_leverage INTEGER DEFAULT 100,
  use_stop_loss BOOLEAN DEFAULT true,
  use_take_profit BOOLEAN DEFAULT true,
  use_trailing_stop BOOLEAN DEFAULT false,
  emergency_stop_enabled BOOLEAN DEFAULT true,
  trading_hours JSONB DEFAULT '{"start": "00:00", "end": "23:59", "timezone": "UTC"}',
  allowed_pairs TEXT[] DEFAULT ARRAY['EURUSD', 'GBPUSD', 'USDJPY'],
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, account_id)
);

-- Enable RLS on all tables
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE trading_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE live_trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE trade_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE market_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE bot_performance ENABLE ROW LEVEL SECURITY;
ALTER TABLE risk_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for api_keys
CREATE POLICY "Users can manage their own API keys"
  ON api_keys
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id);

-- RLS Policies for trading_accounts
CREATE POLICY "Users can manage their own trading accounts"
  ON trading_accounts
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id);

-- RLS Policies for live_trades
CREATE POLICY "Users can view their own trades"
  ON live_trades
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id);

-- RLS Policies for trade_orders
CREATE POLICY "Users can manage their own orders"
  ON trade_orders
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id);

-- RLS Policies for market_data (read-only for all authenticated users)
CREATE POLICY "Authenticated users can read market data"
  ON market_data
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Only service role can write market data"
  ON market_data
  FOR INSERT
  TO service_role
  USING (true);

-- RLS Policies for bot_performance
CREATE POLICY "Users can view their own performance"
  ON bot_performance
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id);

-- RLS Policies for risk_settings
CREATE POLICY "Users can manage their own risk settings"
  ON risk_settings
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_trading_accounts_user_id ON trading_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_live_trades_user_id ON live_trades(user_id);
CREATE INDEX IF NOT EXISTS idx_live_trades_status ON live_trades(status);
CREATE INDEX IF NOT EXISTS idx_trade_orders_user_id ON trade_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_trade_orders_status ON trade_orders(status);
CREATE INDEX IF NOT EXISTS idx_market_data_symbol ON market_data(symbol);
CREATE INDEX IF NOT EXISTS idx_market_data_timestamp ON market_data(timestamp);
CREATE INDEX IF NOT EXISTS idx_bot_performance_user_date ON bot_performance(user_id, date);

-- Functions for order management
CREATE OR REPLACE FUNCTION execute_trade_order(
  p_user_id UUID,
  p_account_id UUID,
  p_pair_id UUID,
  p_order_type TEXT,
  p_trade_type TEXT,
  p_lot_size DECIMAL,
  p_price DECIMAL DEFAULT NULL,
  p_stop_loss DECIMAL DEFAULT NULL,
  p_take_profit DECIMAL DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_order_id UUID;
  v_risk_check BOOLEAN;
BEGIN
  -- Check if user owns the account
  IF NOT EXISTS (
    SELECT 1 FROM trading_accounts 
    WHERE id = p_account_id AND user_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'Account not found or access denied';
  END IF;

  -- Risk management check
  SELECT check_risk_limits(p_user_id, p_account_id, p_lot_size) INTO v_risk_check;
  
  IF NOT v_risk_check THEN
    RAISE EXCEPTION 'Trade rejected: Risk limits exceeded';
  END IF;

  -- Create order
  INSERT INTO trade_orders (
    user_id, account_id, pair_id, order_type, trade_type,
    lot_size, price, stop_loss, take_profit
  ) VALUES (
    p_user_id, p_account_id, p_pair_id, p_order_type, p_trade_type,
    p_lot_size, p_price, p_stop_loss, p_take_profit
  ) RETURNING id INTO v_order_id;

  RETURN v_order_id;
END;
$$;

-- Risk management function
CREATE OR REPLACE FUNCTION check_risk_limits(
  p_user_id UUID,
  p_account_id UUID,
  p_lot_size DECIMAL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_risk_settings RECORD;
  v_account RECORD;
  v_current_exposure DECIMAL;
  v_daily_loss DECIMAL;
BEGIN
  -- Get risk settings
  SELECT * INTO v_risk_settings
  FROM risk_settings
  WHERE user_id = p_user_id AND account_id = p_account_id;

  -- Get account info
  SELECT * INTO v_account
  FROM trading_accounts
  WHERE id = p_account_id;

  -- Check position size limit
  IF p_lot_size * 100000 > v_risk_settings.max_position_size THEN
    RETURN FALSE;
  END IF;

  -- Check daily loss limit
  SELECT COALESCE(SUM(profit), 0) INTO v_daily_loss
  FROM live_trades
  WHERE user_id = p_user_id 
    AND account_id = p_account_id
    AND DATE(opened_at) = CURRENT_DATE;

  IF ABS(v_daily_loss) > (v_account.balance * v_risk_settings.max_daily_loss / 100) THEN
    RETURN FALSE;
  END IF;

  RETURN TRUE;
END;
$$;

-- Function to update market data
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
  INSERT INTO market_data (symbol, bid, ask, spread, volume)
  VALUES (p_symbol, p_bid, p_ask, p_ask - p_bid, p_volume)
  ON CONFLICT (symbol) DO UPDATE SET
    bid = EXCLUDED.bid,
    ask = EXCLUDED.ask,
    spread = EXCLUDED.spread,
    volume = EXCLUDED.volume,
    timestamp = now();
END;
$$;

-- Function to calculate performance metrics
CREATE OR REPLACE FUNCTION calculate_daily_performance(
  p_user_id UUID,
  p_account_id UUID,
  p_date DATE DEFAULT CURRENT_DATE
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_total_trades INTEGER;
  v_winning_trades INTEGER;
  v_losing_trades INTEGER;
  v_total_profit DECIMAL;
  v_total_pips DECIMAL;
  v_win_rate DECIMAL;
BEGIN
  -- Calculate metrics
  SELECT 
    COUNT(*),
    COUNT(*) FILTER (WHERE profit > 0),
    COUNT(*) FILTER (WHERE profit < 0),
    COALESCE(SUM(profit), 0),
    COALESCE(SUM(profit_pips), 0)
  INTO v_total_trades, v_winning_trades, v_losing_trades, v_total_profit, v_total_pips
  FROM live_trades
  WHERE user_id = p_user_id 
    AND account_id = p_account_id
    AND DATE(opened_at) = p_date;

  v_win_rate := CASE 
    WHEN v_total_trades > 0 THEN (v_winning_trades::DECIMAL / v_total_trades * 100)
    ELSE 0 
  END;

  -- Insert or update performance record
  INSERT INTO bot_performance (
    user_id, account_id, date, total_trades, winning_trades, losing_trades,
    win_rate, total_profit, total_pips
  ) VALUES (
    p_user_id, p_account_id, p_date, v_total_trades, v_winning_trades, v_losing_trades,
    v_win_rate, v_total_profit, v_total_pips
  )
  ON CONFLICT (user_id, account_id, date) DO UPDATE SET
    total_trades = EXCLUDED.total_trades,
    winning_trades = EXCLUDED.winning_trades,
    losing_trades = EXCLUDED.losing_trades,
    win_rate = EXCLUDED.win_rate,
    total_profit = EXCLUDED.total_profit,
    total_pips = EXCLUDED.total_pips,
    updated_at = now();
END;
$$;