begin;

-- Enable RLS on user_roles
alter table if exists public.user_roles enable row level security;

-- Drop policies if exist
drop policy if exists "user_roles_select_self_or_admin" on public.user_roles;
drop policy if exists "user_roles_modify_admin_only" on public.user_roles;

-- Users can read their own role; admins can read all
create policy "user_roles_select_self_or_admin" on public.user_roles
  for select to authenticated
  using (user_id = auth.uid() or has_role(auth.uid(), 'admin'));

-- Only admins can insert/update/delete roles
create policy "user_roles_modify_admin_only" on public.user_roles
  for all to authenticated
  using (has_role(auth.uid(), 'admin'))
  with check (has_role(auth.uid(), 'admin'));

commit;