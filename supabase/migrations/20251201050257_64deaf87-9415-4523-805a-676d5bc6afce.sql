-- Create trade execution log table for audit trail
CREATE TABLE IF NOT EXISTS public.trade_execution_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  symbol TEXT NOT NULL,
  order_type TEXT NOT NULL,
  volume NUMERIC NOT NULL,
  entry_price NUMERIC,
  stop_loss NUMERIC,
  take_profit NUMERIC,
  order_id TEXT,
  ticket_id TEXT,
  status TEXT NOT NULL,
  error_message TEXT,
  account_type TEXT,
  daily_trade_count INTEGER,
  execution_timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.trade_execution_log ENABLE ROW LEVEL SECURITY;

-- Users can view their own execution logs
CREATE POLICY "Users can view their own execution logs" 
ON public.trade_execution_log 
FOR SELECT 
USING (auth.uid() = user_id);

-- Users can insert their own execution logs
CREATE POLICY "Users can insert their own execution logs" 
ON public.trade_execution_log 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Create index for faster queries
CREATE INDEX idx_trade_execution_log_user_timestamp 
ON public.trade_execution_log(user_id, execution_timestamp DESC);

CREATE INDEX idx_trade_execution_log_status 
ON public.trade_execution_log(status);