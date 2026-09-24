-- Aura ledger. Run this in the Supabase SQL editor.
-- Authentication → Providers → enable Anonymous sign-ins so each browser gets a user id.

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  item_name text not null,
  shop_name text not null,
  amount numeric(14, 2) not null check (amount > 0),
  category text not null,
  type text not null default 'expense' check (type in ('income', 'expense')),
  date date not null,
  line_items jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists expenses_user_date_idx on public.expenses (user_id, date desc);

create table if not exists public.budgets (
  user_id uuid primary key references auth.users (id) on delete cascade,
  amount numeric(14, 2) not null check (amount >= 0),
  updated_at timestamptz not null default now()
);

alter table public.expenses enable row level security;
alter table public.budgets enable row level security;

create policy "expenses_select_own" on public.expenses
  for select to authenticated using (auth.uid() = user_id);
create policy "expenses_insert_own" on public.expenses
  for insert to authenticated with check (auth.uid() = user_id);
create policy "expenses_update_own" on public.expenses
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "expenses_delete_own" on public.expenses
  for delete to authenticated using (auth.uid() = user_id);

create policy "budgets_select_own" on public.budgets
  for select to authenticated using (auth.uid() = user_id);
create policy "budgets_insert_own" on public.budgets
  for insert to authenticated with check (auth.uid() = user_id);
create policy "budgets_update_own" on public.budgets
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
