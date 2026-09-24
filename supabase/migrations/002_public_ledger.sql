-- Existing projects: run this once in the SQL editor.
-- Anonymous sign-in stays off. The anon key can read and write the ledger.

alter table public.expenses drop constraint if exists expenses_user_id_fkey;
alter table public.budgets drop constraint if exists budgets_user_id_fkey;

grant select, insert, update, delete on public.expenses to anon, authenticated;
grant select, insert, update, delete on public.budgets to anon, authenticated;

drop policy if exists "expenses_select_own" on public.expenses;
drop policy if exists "expenses_insert_own" on public.expenses;
drop policy if exists "expenses_update_own" on public.expenses;
drop policy if exists "expenses_delete_own" on public.expenses;
drop policy if exists "expenses_public_select" on public.expenses;
drop policy if exists "expenses_public_insert" on public.expenses;
drop policy if exists "expenses_public_update" on public.expenses;
drop policy if exists "expenses_public_delete" on public.expenses;

create policy "expenses_public_select" on public.expenses
  for select to anon, authenticated using (true);
create policy "expenses_public_insert" on public.expenses
  for insert to anon, authenticated with check (true);
create policy "expenses_public_update" on public.expenses
  for update to anon, authenticated using (true) with check (true);
create policy "expenses_public_delete" on public.expenses
  for delete to anon, authenticated using (true);

drop policy if exists "budgets_select_own" on public.budgets;
drop policy if exists "budgets_insert_own" on public.budgets;
drop policy if exists "budgets_update_own" on public.budgets;
drop policy if exists "budgets_public_select" on public.budgets;
drop policy if exists "budgets_public_insert" on public.budgets;
drop policy if exists "budgets_public_update" on public.budgets;

create policy "budgets_public_select" on public.budgets
  for select to anon, authenticated using (true);
create policy "budgets_public_insert" on public.budgets
  for insert to anon, authenticated with check (true);
create policy "budgets_public_update" on public.budgets
  for update to anon, authenticated using (true) with check (true);
