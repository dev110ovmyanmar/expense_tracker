-- Per-user ledger. Run once in the Supabase SQL editor.
-- Sign-up and sign-in use Supabase Auth. Each account only sees its own rows.

drop policy if exists "expenses_public_select" on public.expenses;
drop policy if exists "expenses_public_insert" on public.expenses;
drop policy if exists "expenses_public_update" on public.expenses;
drop policy if exists "expenses_public_delete" on public.expenses;
drop policy if exists "expenses_own_select" on public.expenses;
drop policy if exists "expenses_own_insert" on public.expenses;
drop policy if exists "expenses_own_update" on public.expenses;
drop policy if exists "expenses_own_delete" on public.expenses;

create policy "expenses_own_select" on public.expenses
  for select to authenticated using (user_id = auth.uid());
create policy "expenses_own_insert" on public.expenses
  for insert to authenticated with check (user_id = auth.uid());
create policy "expenses_own_update" on public.expenses
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "expenses_own_delete" on public.expenses
  for delete to authenticated using (user_id = auth.uid());

drop policy if exists "budgets_public_select" on public.budgets;
drop policy if exists "budgets_public_insert" on public.budgets;
drop policy if exists "budgets_public_update" on public.budgets;
drop policy if exists "budgets_own_select" on public.budgets;
drop policy if exists "budgets_own_insert" on public.budgets;
drop policy if exists "budgets_own_update" on public.budgets;

create policy "budgets_own_select" on public.budgets
  for select to authenticated using (user_id = auth.uid());
create policy "budgets_own_insert" on public.budgets
  for insert to authenticated with check (user_id = auth.uid());
create policy "budgets_own_update" on public.budgets
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

do $$
begin
  if to_regclass('public.recurring_items') is not null then
    execute 'drop policy if exists "recurring_public_select" on public.recurring_items';
    execute 'drop policy if exists "recurring_public_insert" on public.recurring_items';
    execute 'drop policy if exists "recurring_public_update" on public.recurring_items';
    execute 'drop policy if exists "recurring_public_delete" on public.recurring_items';
    execute 'drop policy if exists "recurring_own_select" on public.recurring_items';
    execute 'drop policy if exists "recurring_own_insert" on public.recurring_items';
    execute 'drop policy if exists "recurring_own_update" on public.recurring_items';
    execute 'drop policy if exists "recurring_own_delete" on public.recurring_items';
    execute 'create policy "recurring_own_select" on public.recurring_items for select to authenticated using (user_id = auth.uid())';
    execute 'create policy "recurring_own_insert" on public.recurring_items for insert to authenticated with check (user_id = auth.uid())';
    execute 'create policy "recurring_own_update" on public.recurring_items for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())';
    execute 'create policy "recurring_own_delete" on public.recurring_items for delete to authenticated using (user_id = auth.uid())';
  end if;

  if to_regclass('public.savings_goals') is not null then
    execute 'drop policy if exists "goals_public_select" on public.savings_goals';
    execute 'drop policy if exists "goals_public_insert" on public.savings_goals';
    execute 'drop policy if exists "goals_public_update" on public.savings_goals';
    execute 'drop policy if exists "goals_public_delete" on public.savings_goals';
    execute 'drop policy if exists "goals_own_select" on public.savings_goals';
    execute 'drop policy if exists "goals_own_insert" on public.savings_goals';
    execute 'drop policy if exists "goals_own_update" on public.savings_goals';
    execute 'drop policy if exists "goals_own_delete" on public.savings_goals';
    execute 'create policy "goals_own_select" on public.savings_goals for select to authenticated using (user_id = auth.uid())';
    execute 'create policy "goals_own_insert" on public.savings_goals for insert to authenticated with check (user_id = auth.uid())';
    execute 'create policy "goals_own_update" on public.savings_goals for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())';
    execute 'create policy "goals_own_delete" on public.savings_goals for delete to authenticated using (user_id = auth.uid())';
  end if;
end $$;

create table if not exists public.receipt_items (
  id uuid primary key default gen_random_uuid(),
  expense_id uuid not null references public.expenses (id) on delete cascade,
  shop_name text not null,
  item_name text not null,
  unit_price numeric(14, 2) not null check (unit_price >= 0),
  date date not null
);

create index if not exists receipt_items_shop_item_date_idx
  on public.receipt_items (shop_name, item_name, date desc);

alter table public.receipt_items enable row level security;
grant select, insert, update, delete on public.receipt_items to authenticated;

drop policy if exists "receipt_items_public_select" on public.receipt_items;
drop policy if exists "receipt_items_public_insert" on public.receipt_items;
drop policy if exists "receipt_items_public_update" on public.receipt_items;
drop policy if exists "receipt_items_public_delete" on public.receipt_items;
drop policy if exists "receipt_items_own_select" on public.receipt_items;
drop policy if exists "receipt_items_own_insert" on public.receipt_items;
drop policy if exists "receipt_items_own_update" on public.receipt_items;
drop policy if exists "receipt_items_own_delete" on public.receipt_items;

create policy "receipt_items_own_select" on public.receipt_items
  for select to authenticated using (
    exists (select 1 from public.expenses e where e.id = expense_id and e.user_id = auth.uid())
  );
create policy "receipt_items_own_insert" on public.receipt_items
  for insert to authenticated with check (
    exists (select 1 from public.expenses e where e.id = expense_id and e.user_id = auth.uid())
  );
create policy "receipt_items_own_update" on public.receipt_items
  for update to authenticated using (
    exists (select 1 from public.expenses e where e.id = expense_id and e.user_id = auth.uid())
  ) with check (
    exists (select 1 from public.expenses e where e.id = expense_id and e.user_id = auth.uid())
  );
create policy "receipt_items_own_delete" on public.receipt_items
  for delete to authenticated using (
    exists (select 1 from public.expenses e where e.id = expense_id and e.user_id = auth.uid())
  );

create table if not exists public.user_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  daily_reminder boolean not null default false,
  last_reminded date,
  updated_at timestamptz not null default now()
);

alter table public.user_settings enable row level security;
grant select, insert, update on public.user_settings to authenticated;

drop policy if exists "settings_own_select" on public.user_settings;
drop policy if exists "settings_own_insert" on public.user_settings;
drop policy if exists "settings_own_update" on public.user_settings;

create policy "settings_own_select" on public.user_settings
  for select to authenticated using (user_id = auth.uid());
create policy "settings_own_insert" on public.user_settings
  for insert to authenticated with check (user_id = auth.uid());
create policy "settings_own_update" on public.user_settings
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
