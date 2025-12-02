-- Fix function search_path for security
CREATE OR REPLACE FUNCTION create_default_bot_settings()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.bot_settings (user_id, bot_name, is_active)
  VALUES (
    NEW.id,
    'Default Trading Bot',
    false
  )
  ON CONFLICT (user_id, bot_name) DO NOTHING;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;