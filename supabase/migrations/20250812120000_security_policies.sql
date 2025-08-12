-- Enable RLS on sensitive tables (idempotent)
ALTER TABLE IF EXISTS public.market_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.price_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.exness_sessions ENABLE ROW LEVEL SECURITY;

-- Market Data: restrict INSERT to admins only (or service role which bypasses RLS)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'market_data' AND policyname = 'admin_insert_market_data'
  ) THEN
    EXECUTE $$
      CREATE POLICY admin_insert_market_data
      ON public.market_data
      FOR INSERT
      TO authenticated
      WITH CHECK (
        public.has_role(auth.uid(), 'admin'::app_role)
      );
    $$;
  END IF;
END$$;

-- Optionally allow authenticated users to read market data (adjust as needed)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'market_data' AND policyname = 'authenticated_select_market_data'
  ) THEN
    EXECUTE $$
      CREATE POLICY authenticated_select_market_data
      ON public.market_data
      FOR SELECT
      TO authenticated
      USING (true);
    $$;
  END IF;
END$$;

-- Price Data: restrict INSERT to admins only
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'price_data' AND policyname = 'admin_insert_price_data'
  ) THEN
    EXECUTE $$
      CREATE POLICY admin_insert_price_data
      ON public.price_data
      FOR INSERT
      TO authenticated
      WITH CHECK (
        public.has_role(auth.uid(), 'admin'::app_role)
      );
    $$;
  END IF;
END$$;

-- Allow authenticated users to read aggregated price data
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'price_data' AND policyname = 'authenticated_select_price_data'
  ) THEN
    EXECUTE $$
      CREATE POLICY authenticated_select_price_data
      ON public.price_data
      FOR SELECT
      TO authenticated
      USING (true);
    $$;
  END IF;
END$$;

-- Profiles: restrict read access to authenticated users only
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'profiles' AND policyname = 'authenticated_select_profiles'
  ) THEN
    EXECUTE $$
      CREATE POLICY authenticated_select_profiles
      ON public.profiles
      FOR SELECT
      TO authenticated
      USING (true);
    $$;
  END IF;
END$$;

-- Profiles: users can insert/update their own row only
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'profiles' AND policyname = 'user_manage_own_profile'
  ) THEN
    EXECUTE $$
      CREATE POLICY user_manage_own_profile
      ON public.profiles
      FOR ALL
      TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
    $$;
  END IF;
END$$;

-- Exness Sessions: only owner or admin can access their sessions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'exness_sessions' AND policyname = 'owner_or_admin_select_exness_sessions'
  ) THEN
    EXECUTE $$
      CREATE POLICY owner_or_admin_select_exness_sessions
      ON public.exness_sessions
      FOR SELECT
      TO authenticated
      USING (
        user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role)
      );
    $$;
  END IF;
END$$;

-- Exness Sessions: only owner or admin can insert/update/delete
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'exness_sessions' AND policyname = 'owner_or_admin_write_exness_sessions'
  ) THEN
    EXECUTE $$
      CREATE POLICY owner_or_admin_write_exness_sessions
      ON public.exness_sessions
      FOR ALL
      TO authenticated
      USING (
        user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role)
      )
      WITH CHECK (
        user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role)
      );
    $$;
  END IF;
END$$;