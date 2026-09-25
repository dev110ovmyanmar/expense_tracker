-- Open the ledger without sign-in. Run this in the Supabase SQL editor.

do $$
declare
  target text;
  policy_name text;
begin
  foreach target in array array[
    'expenses',
    'budgets',
    'recurring_items',
    'savings_goals',
    'receipt_items',
    'user_settings',
    'daily_bills',
    'profiles'
  ]
  loop
    if to_regclass('public.' || target) is null then
      continue;
    end if;
    execute format('grant select, insert, update, delete on public.%I to anon, authenticated', target);
    for policy_name in
      select pol.polname
      from pg_policy pol
      join pg_class cls on cls.oid = pol.polrelid
      join pg_namespace nsp on nsp.oid = cls.relnamespace
      where nsp.nspname = 'public' and cls.relname = target
    loop
      execute format('drop policy if exists %I on public.%I', policy_name, target);
    end loop;
    execute format('create policy "%s_public_select" on public.%I for select to anon, authenticated using (true)', target, target);
    execute format('create policy "%s_public_insert" on public.%I for insert to anon, authenticated with check (true)', target, target);
    execute format('create policy "%s_public_update" on public.%I for update to anon, authenticated using (true) with check (true)', target, target);
    execute format('create policy "%s_public_delete" on public.%I for delete to anon, authenticated using (true)', target, target);
  end loop;
end $$;
