-- One-off daily bills. Run this in the Supabase SQL editor after 005_user_auth.sql.

create table if not exists public.daily_bills (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  title text not null,
  amount numeric(14, 2) not null check (amount > 0),
  category text not null,
  date date not null,
  expense_id uuid references public.expenses (id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists daily_bills_user_date_idx on public.daily_bills (user_id, date desc);

alter table public.daily_bills enable row level security;

grant select, insert, delete on public.daily_bills to authenticated;

drop policy if exists "daily_bills_own_select" on public.daily_bills;
drop policy if exists "daily_bills_own_insert" on public.daily_bills;
drop policy if exists "daily_bills_own_delete" on public.daily_bills;

create policy "daily_bills_own_select" on public.daily_bills
  for select to authenticated using (user_id = auth.uid());
create policy "daily_bills_own_insert" on public.daily_bills
  for insert to authenticated with check (user_id = auth.uid());
create policy "daily_bills_own_delete" on public.daily_bills
  for delete to authenticated using (user_id = auth.uid());
