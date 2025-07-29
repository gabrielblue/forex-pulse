-- Create the live_trades table for real-time trading positions
CREATE TABLE public.live_trades (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users NOT NULL,
  pair_id UUID REFERENCES public.currency_pairs(id),
  symbol TEXT NOT NULL,
  trade_type TEXT NOT NULL CHECK (trade_type IN ('BUY', 'SELL')),
  lot_size NUMERIC(10,4) NOT NULL DEFAULT 0.01,
  entry_price NUMERIC(12,6) NOT NULL,
  current_price NUMERIC(12,6),
  profit NUMERIC(12,2) DEFAULT 0,
  profit_pips NUMERIC(8,2) DEFAULT 0,
  stop_loss NUMERIC(12,6),
  take_profit NUMERIC(12,6),
  status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'CLOSED', 'PENDING')),
  opened_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  closed_at TIMESTAMP WITH TIME ZONE,
  commission NUMERIC(8,2) DEFAULT 0,
  swap NUMERIC(8,2) DEFAULT 0,
  ticket_id TEXT, -- Exness ticket ID
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.live_trades ENABLE ROW LEVEL SECURITY;

-- Create policies for live_trades
CREATE POLICY "Users can view their own live trades" 
ON public.live_trades 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own live trades" 
ON public.live_trades 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own live trades" 
ON public.live_trades 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own live trades" 
ON public.live_trades 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create the trading_accounts table for Exness account info
CREATE TABLE public.trading_accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users NOT NULL,
  account_number TEXT NOT NULL,
  server TEXT NOT NULL,
  balance NUMERIC(12,2) DEFAULT 0,
  equity NUMERIC(12,2) DEFAULT 0,
  margin NUMERIC(12,2) DEFAULT 0,
  free_margin NUMERIC(12,2) DEFAULT 0,
  margin_level NUMERIC(8,2) DEFAULT 0,
  currency TEXT DEFAULT 'USD',
  leverage TEXT DEFAULT '1:100',
  is_active BOOLEAN DEFAULT true,
  is_demo BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.trading_accounts ENABLE ROW LEVEL SECURITY;

-- Create policies for trading_accounts
CREATE POLICY "Users can manage their own trading accounts" 
ON public.trading_accounts 
FOR ALL 
USING (auth.uid() = user_id);

-- Create indexes for better performance
CREATE INDEX idx_live_trades_user_id ON public.live_trades(user_id);
CREATE INDEX idx_live_trades_status ON public.live_trades(status);
CREATE INDEX idx_live_trades_opened_at ON public.live_trades(opened_at DESC);
CREATE INDEX idx_trading_accounts_user_id ON public.trading_accounts(user_id);
CREATE INDEX idx_trading_accounts_active ON public.trading_accounts(is_active);

-- Create trigger for updated_at
CREATE TRIGGER update_live_trades_updated_at
BEFORE UPDATE ON public.live_trades
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_trading_accounts_updated_at
BEFORE UPDATE ON public.trading_accounts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();