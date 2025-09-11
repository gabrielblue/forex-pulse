-- Enforce strict RLS and access controls for sensitive tables
-- This migration drops any existing policies on the target tables and recreates secure ones

begin;

-- Helper: drop all policies on a table
create or replace function public.__drop_all_policies(_schema regnamespace, _table regclass)
returns void language plpgsql as $$
declare
  pol record;
begin
  for pol in
    select polname from pg_policies
    where schemaname = nspname(_schema)
      and tablename = relname(_table)
  loop
    execute format('drop policy if exists %I on %s.%s', pol.polname, nspname(_schema), relname(_table));
  end loop;
end;
$$;

-- Ensure RLS is enabled and reset policies for market_data
alter table if exists public.market_data enable row level security;
select public.__drop_all_policies('public', 'market_data'::regclass);

-- Only admins can insert market data (service_role bypasses RLS by design)
create policy "market_data_insert_admin_only" on public.market_data
  for insert to authenticated
  using (has_role(auth.uid(), 'admin'))
  with check (has_role(auth.uid(), 'admin'));

-- Allow authenticated users to read market data
create policy "market_data_select_authenticated" on public.market_data
  for select to authenticated
  using (true);

-- Ensure RLS is enabled and reset policies for profiles
alter table if exists public.profiles enable row level security;
select public.__drop_all_policies('public', 'profiles'::regclass);

-- Users can select only their own profile; admins can access all
create policy "profiles_select_self_or_admin" on public.profiles
  for select to authenticated
  using (user_id = auth.uid() or has_role(auth.uid(), 'admin'));

-- Users can insert/update their own profile; admins can manage all
create policy "profiles_modify_self_or_admin" on public.profiles
  for all to authenticated
  using (user_id = auth.uid() or has_role(auth.uid(), 'admin'))
  with check (user_id = auth.uid() or has_role(auth.uid(), 'admin'));

-- Ensure RLS is enabled and reset policies for exness_sessions
alter table if exists public.exness_sessions enable row level security;
select public.__drop_all_policies('public', 'exness_sessions'::regclass);

-- Only owner or admin can read their financial/session data
create policy "exness_sessions_select_owner_or_admin" on public.exness_sessions
  for select to authenticated
  using (user_id = auth.uid() or has_role(auth.uid(), 'admin'));

-- Only owner or admin can insert/update/delete their sessions
create policy "exness_sessions_modify_owner_or_admin" on public.exness_sessions
  for all to authenticated
  using (user_id = auth.uid() or has_role(auth.uid(), 'admin'))
  with check (user_id = auth.uid() or has_role(auth.uid(), 'admin'));

-- Optional hardening (commented): disallow selecting session_token value unless admin via a view approach
-- You can create a view without session_token and grant app access to it instead of the base table.
-- create view public.exness_sessions_public as
--   select id, user_id, login_id, server_name, is_connected, created_at, updated_at,
--          account_balance, account_equity, account_margin, account_free_margin
--   from public.exness_sessions;
-- revoke all on public.exness_sessions from anon, authenticated;
-- grant select on public.exness_sessions_public to authenticated;
-- Then adjust the application to read from exness_sessions_public.

-- Cleanup helper
drop function if exists public.__drop_all_policies(regnamespace, regclass);

commit;