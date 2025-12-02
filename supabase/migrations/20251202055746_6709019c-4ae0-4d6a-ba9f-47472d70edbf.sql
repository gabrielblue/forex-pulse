-- Create default bot settings for users on signup
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add trigger to handle_new_user function
DROP TRIGGER IF EXISTS create_bot_settings_on_signup ON auth.users;
CREATE TRIGGER create_bot_settings_on_signup
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION create_default_bot_settings();

-- Create bot_settings for existing users who don't have one
INSERT INTO public.bot_settings (user_id, bot_name, is_active)
SELECT id, 'Default Trading Bot', false
FROM auth.users
WHERE NOT EXISTS (
  SELECT 1 FROM public.bot_settings 
  WHERE bot_settings.user_id = auth.users.id
);