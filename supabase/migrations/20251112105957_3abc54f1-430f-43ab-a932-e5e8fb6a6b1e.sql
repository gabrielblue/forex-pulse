-- Update handle_new_user function to assign admin role to primary account
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_role app_role;
BEGIN
  -- Insert profile
  INSERT INTO public.profiles (user_id, username, display_name)
  VALUES (
    NEW.id, 
    COALESCE(NEW.raw_user_meta_data ->> 'username', 'user_' || substr(NEW.id::text, 1, 8)),
    COALESCE(NEW.raw_user_meta_data ->> 'display_name', 'User')
  );
  
  -- Assign admin role to primary account, viewer for others
  IF NEW.email = 'gabrielwambua9659@gmail.com' THEN
    v_role := 'admin';
  ELSE
    v_role := 'viewer';
  END IF;
  
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, v_role);
  
  -- Create default portfolio
  INSERT INTO public.user_portfolios (user_id)
  VALUES (NEW.id);
  
  RETURN NEW;
END;
$function$;