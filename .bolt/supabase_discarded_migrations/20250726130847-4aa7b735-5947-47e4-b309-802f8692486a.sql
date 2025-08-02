-- Create user profiles table
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create app role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'trader', 'viewer');

-- Create user roles table
CREATE TABLE public.user_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

-- Enable RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check user roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Create function to get current user role
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS app_role
LANGUAGE SQL
STABLE
SECURITY DEFINER
AS $$
  SELECT role FROM public.user_roles 
  WHERE user_id = auth.uid() 
  ORDER BY 
    CASE 
      WHEN role = 'admin' THEN 1
      WHEN role = 'trader' THEN 2
      WHEN role = 'viewer' THEN 3
    END
  LIMIT 1
$$;

-- RLS policies for profiles
CREATE POLICY "Users can view all profiles" 
ON public.profiles 
FOR SELECT 
USING (true);

CREATE POLICY "Users can update their own profile" 
ON public.profiles 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile" 
ON public.profiles 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Only admins can delete profiles" 
ON public.profiles 
FOR DELETE 
USING (public.has_role(auth.uid(), 'admin'));

-- RLS policies for user_roles
CREATE POLICY "Admins can manage all roles" 
ON public.user_roles 
FOR ALL 
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view their own roles" 
ON public.user_roles 
FOR SELECT 
USING (auth.uid() = user_id);

-- Update existing table policies to include role checks
-- Bot settings: only traders and admins can manage
DROP POLICY IF EXISTS "Users can manage their own bot settings" ON public.bot_settings;
CREATE POLICY "Traders and admins can manage bot settings" 
ON public.bot_settings 
FOR ALL 
USING (
  auth.uid() = user_id AND 
  (public.has_role(auth.uid(), 'trader') OR public.has_role(auth.uid(), 'admin'))
);

-- Trading signals: only traders and admins can create
DROP POLICY IF EXISTS "Users can manage their own signals" ON public.trading_signals;
CREATE POLICY "Traders and admins can manage signals" 
ON public.trading_signals 
FOR ALL 
USING (
  auth.uid() = user_id AND 
  (public.has_role(auth.uid(), 'trader') OR public.has_role(auth.uid(), 'admin'))
);

-- Trades: only traders and admins can manage
DROP POLICY IF EXISTS "Users can manage their own trades" ON public.trades;
CREATE POLICY "Traders and admins can manage trades" 
ON public.trades 
FOR ALL 
USING (
  auth.uid() = user_id AND 
  (public.has_role(auth.uid(), 'trader') OR public.has_role(auth.uid(), 'admin'))
);

-- User portfolios: only traders and admins can manage
DROP POLICY IF EXISTS "Users can manage their own portfolio" ON public.user_portfolios;
CREATE POLICY "Traders and admins can manage portfolios" 
ON public.user_portfolios 
FOR ALL 
USING (
  auth.uid() = user_id AND 
  (public.has_role(auth.uid(), 'trader') OR public.has_role(auth.uid(), 'admin'))
);

-- Function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
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
$$;

-- Trigger for new user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add triggers for updating timestamps
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();