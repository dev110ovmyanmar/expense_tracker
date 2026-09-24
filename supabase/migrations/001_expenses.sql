-- Aura ledger. Run this in the Supabase SQL editor.
-- No sign-in is required. The anon key reads and writes these tables.

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
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
  user_id uuid primary key,
  amount numeric(14, 2) not null check (amount >= 0),
  updated_at timestamptz not null default now()
);

alter table public.expenses enable row level security;
alter table public.budgets enable row level security;

grant select, insert, update, delete on public.expenses to anon, authenticated;
grant select, insert, update, delete on public.budgets to anon, authenticated;

create policy "expenses_public_select" on public.expenses
  for select to anon, authenticated using (true);
create policy "expenses_public_insert" on public.expenses
  for insert to anon, authenticated with check (true);
create policy "expenses_public_update" on public.expenses
  for update to anon, authenticated using (true) with check (true);
create policy "expenses_public_delete" on public.expenses
  for delete to anon, authenticated using (true);

create policy "budgets_public_select" on public.budgets
  for select to anon, authenticated using (true);
create policy "budgets_public_insert" on public.budgets
  for insert to anon, authenticated with check (true);
create policy "budgets_public_update" on public.budgets
  for update to anon, authenticated using (true) with check (true);
