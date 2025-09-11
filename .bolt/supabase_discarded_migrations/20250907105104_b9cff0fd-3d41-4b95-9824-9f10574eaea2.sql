-- Fix 1: Since secure_exness_sessions is a view, let's drop it and use the encrypted exness_sessions table instead
DROP VIEW IF EXISTS public.secure_exness_sessions;

-- Fix 2: Encrypt session tokens in exness_sessions table
-- Create encryption function if not exists
CREATE OR REPLACE FUNCTION public.encrypt_exness_token()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.session_token IS NOT NULL AND NEW.session_token NOT LIKE 'eyJ%' THEN
    -- Only encrypt if not already encrypted (base64 encoded)
    NEW.session_token = encode(pgp_sym_encrypt(NEW.session_token, 'forex-exness-strong-encryption-key-2025'), 'base64');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create decryption function
CREATE OR REPLACE FUNCTION public.decrypt_exness_token(encrypted_token text)
RETURNS text AS $$
BEGIN
  IF encrypted_token IS NULL THEN
    RETURN NULL;
  ELSIF encrypted_token LIKE 'eyJ%' THEN
    -- Already encrypted
    RETURN pgp_sym_decrypt(decode(encrypted_token, 'base64'), 'forex-exness-strong-encryption-key-2025')::TEXT;
  ELSE
    -- Not encrypted, return as is
    RETURN encrypted_token;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    -- On error, return NULL instead of exposing error details
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Add trigger to encrypt tokens on insert/update
DROP TRIGGER IF EXISTS encrypt_exness_token_trigger ON public.exness_sessions;
CREATE TRIGGER encrypt_exness_token_trigger
  BEFORE INSERT OR UPDATE ON public.exness_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.encrypt_exness_token();

-- Fix 3: Update profiles table RLS to be more restrictive
DROP POLICY IF EXISTS "Users can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Authenticated users can read profiles" ON profiles;

-- Add public flag column if not exists
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT false;

-- Allow users to view only their own profile
CREATE POLICY "Users can view their own profile" 
ON public.profiles 
FOR SELECT 
USING (auth.uid() = user_id);

-- Allow viewing public profiles
CREATE POLICY "Public profiles are viewable" 
ON public.profiles 
FOR SELECT 
USING (is_public = true);

-- Fix 4: Update function search paths for security
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert profile
  INSERT INTO public.profiles (user_id, username, display_name)
  VALUES (
    NEW.id, 
    COALESCE(NEW.raw_user_meta_data ->> 'username', 'user_' || substr(NEW.id::text, 1, 8)),
    COALESCE(NEW.raw_user_meta_data ->> 'display_name', 'User')
  );
  
  -- Assign default role (viewer for new users, admin will promote)
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'viewer');
  
  -- Create default portfolio for traders
  INSERT INTO public.user_portfolios (user_id)
  VALUES (NEW.id);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE OR REPLACE FUNCTION public.encrypt_session_token()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.session_token IS NOT NULL THEN
    -- Use pgcrypto extension with hardcoded secret (replace in production)
    NEW.session_token = encode(pgp_sym_encrypt(NEW.session_token, 'forex-pulse-strong-encryption-key-2025'), 'base64');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.decrypt_session_token(encrypted_token text)
RETURNS text AS $$
BEGIN
  IF encrypted_token IS NULL THEN
    RETURN NULL;
  ELSE
    -- Decrypt the token with the same hardcoded secret
    RETURN pgp_sym_decrypt(decode(encrypted_token, 'base64'), 'forex-pulse-strong-encryption-key-2025')::TEXT;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    -- On error, return NULL instead of exposing error details
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Fix 5: Add security audit log for sensitive operations
CREATE TABLE IF NOT EXISTS public.security_audit_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  table_name TEXT,
  record_id UUID,
  ip_address INET,
  user_agent TEXT,
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on audit log
ALTER TABLE public.security_audit_log ENABLE ROW LEVEL SECURITY;

-- Only admins can view audit logs
CREATE POLICY "Only admins can view audit logs" 
ON public.security_audit_log 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role));

-- System can insert audit logs
CREATE POLICY "System can insert audit logs" 
ON public.security_audit_log 
FOR INSERT 
WITH CHECK (true);

-- Create function to log sensitive operations
CREATE OR REPLACE FUNCTION public.log_security_event(
  p_action TEXT,
  p_table_name TEXT DEFAULT NULL,
  p_record_id UUID DEFAULT NULL,
  p_details JSONB DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO public.security_audit_log (user_id, action, table_name, record_id, details)
  VALUES (auth.uid(), p_action, p_table_name, p_record_id, p_details);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Fix 6: Add rate limiting for trading operations
CREATE TABLE IF NOT EXISTS public.rate_limits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  request_count INTEGER DEFAULT 0,
  window_start TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, action)
);

-- Enable RLS on rate limits
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

-- Users can only see their own rate limits
CREATE POLICY "Users can view their own rate limits" 
ON public.rate_limits 
FOR SELECT 
USING (auth.uid() = user_id);

-- System can update rate limits
CREATE POLICY "System can update rate limits" 
ON public.rate_limits 
FOR ALL 
USING (true)
WITH CHECK (true);

-- Fix 7: Create password strength requirements
-- Update auth settings to enforce password strength (this is configuration, not SQL)