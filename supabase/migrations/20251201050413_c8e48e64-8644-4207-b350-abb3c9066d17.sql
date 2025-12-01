-- Enable realtime for trade execution log table
ALTER TABLE public.trade_execution_log REPLICA IDENTITY FULL;

-- Add table to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.trade_execution_log;