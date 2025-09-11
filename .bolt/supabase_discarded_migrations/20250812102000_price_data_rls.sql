begin;

-- Enable RLS and reset policies on price_data
alter table if exists public.price_data enable row level security;

-- Drop existing policies if they exist (explicit names to be idempotent)
drop policy if exists "price_data_insert_admin_only" on public.price_data;
drop policy if exists "price_data_modify_admin_only" on public.price_data;
drop policy if exists "price_data_select_authenticated" on public.price_data;

-- Only admins can insert/update/delete price data
create policy "price_data_insert_admin_only" on public.price_data
  for insert to authenticated
  using (has_role(auth.uid(), 'admin'))
  with check (has_role(auth.uid(), 'admin'));

create policy "price_data_modify_admin_only" on public.price_data
  for update using (has_role(auth.uid(), 'admin'))
  with check (has_role(auth.uid(), 'admin'));

create policy "price_data_delete_admin_only" on public.price_data
  for delete using (has_role(auth.uid(), 'admin'));

-- Allow authenticated users to read price data
create policy "price_data_select_authenticated" on public.price_data
  for select to authenticated
  using (true);

commit;