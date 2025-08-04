-- Create a table to store Exness API configurations and session tokens
CREATE TABLE IF NOT EXISTS public.exness_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  session_token TEXT,
  server_name TEXT NOT NULL,
  login_id BIGINT NOT NULL,
  account_balance DECIMAL(15,2) DEFAULT 0,
  account_equity DECIMAL(15,2) DEFAULT 0,
  account_margin DECIMAL(15,2) DEFAULT 0,
  account_free_margin DECIMAL(15,2) DEFAULT 0,
  account_currency TEXT DEFAULT 'USD',
  is_connected BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE
);

-- Enable Row Level Security
ALTER TABLE public.exness_sessions ENABLE ROW LEVEL SECURITY;

-- Create policies for user access
CREATE POLICY "Users can view their own Exness sessions" 
ON public.exness_sessions 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own Exness sessions" 
ON public.exness_sessions 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own Exness sessions" 
ON public.exness_sessions 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own Exness sessions" 
ON public.exness_sessions 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_exness_sessions_updated_at
  BEFORE UPDATE ON public.exness_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();