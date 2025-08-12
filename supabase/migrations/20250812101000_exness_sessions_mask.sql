begin;

-- Create a view that excludes the sensitive session_token
create or replace view public.exness_sessions_public as
select 
  id,
  user_id,
  login_id,
  server_name,
  is_connected,
  created_at,
  updated_at,
  account_balance,
  account_currency,
  account_equity,
  account_margin,
  account_free_margin
from public.exness_sessions;

-- Revoke direct access to the base table from anon and authenticated roles
revoke all on table public.exness_sessions from anon;
revoke all on table public.exness_sessions from authenticated;

-- Ensure RLS is enabled (idempotent)
alter table if exists public.exness_sessions enable row level security;

-- Grant read access to the safe view for authenticated users
grant select on public.exness_sessions_public to authenticated;

commit;