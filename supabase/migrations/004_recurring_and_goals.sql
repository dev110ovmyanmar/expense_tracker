-- Fixed bills and savings envelopes. Run this once in the Supabase SQL editor.

create table if not exists public.recurring_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  name text not null,
  amount numeric(14, 2) not null check (amount > 0),
  category text not null,
  type text not null check (type in ('income', 'expense')),
  frequency text not null check (frequency in ('weekly', 'monthly')),
  next_due date not null,
  auto_log boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists recurring_items_user_due_idx on public.recurring_items (user_id, next_due);

create table if not exists public.savings_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  name text not null,
  target_amount numeric(14, 2) not null check (target_amount > 0),
  target_date date,
  monthly_allocation numeric(14, 2) not null default 0 check (monthly_allocation >= 0),
  saved_amount numeric(14, 2) not null default 0 check (saved_amount >= 0),
  last_allocated text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists savings_goals_user_idx on public.savings_goals (user_id);

alter table public.recurring_items enable row level security;
alter table public.savings_goals enable row level security;

grant select, insert, update, delete on public.recurring_items to anon, authenticated;
grant select, insert, update, delete on public.savings_goals to anon, authenticated;

drop policy if exists "recurring_public_select" on public.recurring_items;
drop policy if exists "recurring_public_insert" on public.recurring_items;
drop policy if exists "recurring_public_update" on public.recurring_items;
drop policy if exists "recurring_public_delete" on public.recurring_items;
drop policy if exists "goals_public_select" on public.savings_goals;
drop policy if exists "goals_public_insert" on public.savings_goals;
drop policy if exists "goals_public_update" on public.savings_goals;
drop policy if exists "goals_public_delete" on public.savings_goals;

create policy "recurring_public_select" on public.recurring_items
  for select to anon, authenticated using (true);
create policy "recurring_public_insert" on public.recurring_items
  for insert to anon, authenticated with check (true);
create policy "recurring_public_update" on public.recurring_items
  for update to anon, authenticated using (true) with check (true);
create policy "recurring_public_delete" on public.recurring_items
  for delete to anon, authenticated using (true);

create policy "goals_public_select" on public.savings_goals
  for select to anon, authenticated using (true);
create policy "goals_public_insert" on public.savings_goals
  for insert to anon, authenticated with check (true);
create policy "goals_public_update" on public.savings_goals
  for update to anon, authenticated using (true) with check (true);
create policy "goals_public_delete" on public.savings_goals
  for delete to anon, authenticated using (true);
