-- Create currency_pairs table for trading signals
CREATE TABLE IF NOT EXISTS currency_pairs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  symbol text NOT NULL UNIQUE,
  base_currency text NOT NULL,
  quote_currency text NOT NULL,
  display_name text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE currency_pairs ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Currency pairs are viewable by authenticated users"
ON currency_pairs
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Currency pairs can be inserted by authenticated users"
ON currency_pairs
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Allow upsert operations for authenticated users
CREATE POLICY "Currency pairs can be updated by authenticated users"
ON currency_pairs
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Create index
CREATE INDEX IF NOT EXISTS idx_currency_pairs_symbol ON currency_pairs(symbol);

-- Insert common pairs
INSERT INTO currency_pairs (symbol, base_currency, quote_currency, display_name) VALUES
('XAUUSD', 'XAU', 'USD', 'Gold vs US Dollar'),
('EURUSD', 'EUR', 'USD', 'Euro vs US Dollar'),
('GBPUSD', 'GBP', 'USD', 'British Pound vs US Dollar'),
('USDJPY', 'USD', 'JPY', 'US Dollar vs Japanese Yen')
ON CONFLICT (symbol) DO NOTHING;