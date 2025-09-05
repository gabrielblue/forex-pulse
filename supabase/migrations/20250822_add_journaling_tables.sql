-- Journaling & Risk Tables Migration
-- 20250822_add_journaling_tables

-- trade_journal: high-level trade entries
CREATE TABLE IF NOT EXISTS trade_journal (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  ticket_id TEXT,
  symbol TEXT NOT NULL,
  side TEXT CHECK (side IN ('BUY','SELL')) NOT NULL,
  volume NUMERIC NOT NULL,
  entry_price NUMERIC,
  exit_price NUMERIC,
  spread_at_entry NUMERIC,
  modeled_slippage NUMERIC,
  realized_slippage NUMERIC,
  regime_tag TEXT,
  session_tag TEXT,
  decision_features JSONB,
  pnl NUMERIC,
  pnl_pips NUMERIC,
  opened_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  closed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- fills: granular execution info
CREATE TABLE IF NOT EXISTS fills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  ticket_id TEXT,
  symbol TEXT NOT NULL,
  side TEXT CHECK (side IN ('BUY','SELL')) NOT NULL,
  qty NUMERIC NOT NULL,
  price NUMERIC NOT NULL,
  slippage NUMERIC,
  spread NUMERIC,
  liquidity_side TEXT CHECK (liquidity_side IN ('TAKER','MAKER')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- risk_limits: runtime risk configuration snapshot
CREATE TABLE IF NOT EXISTS risk_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  max_risk_per_trade NUMERIC,
  max_daily_loss NUMERIC,
  max_drawdown NUMERIC,
  var_limit NUMERIC,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- drift_events: model/data drift alerts
CREATE TABLE IF NOT EXISTS drift_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type TEXT,
  metric JSONB,
  severity TEXT CHECK (severity IN ('LOW','MEDIUM','HIGH')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS
ALTER TABLE trade_journal ENABLE ROW LEVEL SECURITY;
ALTER TABLE fills ENABLE ROW LEVEL SECURITY;
ALTER TABLE risk_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE drift_events ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "journal_select_own" ON trade_journal FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "journal_insert_own" ON trade_journal FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "journal_update_own" ON trade_journal FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "fills_select_own" ON fills FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "fills_insert_own" ON fills FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "risk_select_own" ON risk_limits FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "risk_insert_own" ON risk_limits FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "drift_select_own" ON drift_events FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "drift_insert_own" ON drift_events FOR INSERT WITH CHECK (auth.uid() = user_id);

-- updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_trade_journal_updated_at
BEFORE UPDATE ON trade_journal
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();