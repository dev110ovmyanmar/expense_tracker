-- Each account only sees its own ledger. Run once in the Supabase SQL editor.
-- This replaces the open policies that let every user read every row.

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

    execute format(
      'alter table public.%I add column if not exists user_id uuid references auth.users(id) default auth.uid()',
      target
    );
    execute format('alter table public.%I enable row level security', target);
    execute format('revoke all on table public.%I from anon', target);
    execute format('grant select, insert, update, delete on table public.%I to authenticated', target);

    for policy_name in
      select pol.polname
      from pg_policy pol
      join pg_class cls on cls.oid = pol.polrelid
      join pg_namespace nsp on nsp.oid = cls.relnamespace
      where nsp.nspname = 'public' and cls.relname = target
    loop
      execute format('drop policy if exists %I on public.%I', policy_name, target);
    end loop;

    execute format(
      'create policy "Users can only access own data" on public.%I for all using (auth.uid() = user_id) with check (auth.uid() = user_id)',
      target
    );
  end loop;
end $$;

do $$
begin
  if to_regclass('public.profiles') is not null then
    execute 'update public.profiles set user_id = id where user_id is null';
  end if;

  if to_regclass('public.receipt_items') is not null and to_regclass('public.expenses') is not null then
    execute $backfill$
      update public.receipt_items as item
      set user_id = expense.user_id
      from public.expenses as expense
      where item.expense_id = expense.id
        and item.user_id is null
        and exists (select 1 from auth.users as account where account.id = expense.user_id)
    $backfill$;
  end if;
end $$;

do $$
begin
  if to_regclass('public.receipt_items') is null then
    return;
  end if;
  create index if not exists receipt_items_user_idx on public.receipt_items (user_id);
  if not exists (select 1 from public.receipt_items where user_id is null) then
    alter table public.receipt_items alter column user_id set not null;
  end if;
end $$;

do $$
declare
  target text;
  constraint_name text;
begin
  foreach target in array array['expenses', 'budgets', 'recurring_items', 'savings_goals', 'daily_bills']
  loop
    if to_regclass('public.' || target) is null then
      continue;
    end if;
    constraint_name := target || '_user_id_fkey';
    if exists (select 1 from pg_constraint where conname = constraint_name) then
      continue;
    end if;
    begin
      execute format(
        'alter table public.%I add constraint %I foreign key (user_id) references auth.users(id) on delete cascade',
        target,
        constraint_name
      );
    exception
      when others then
        raise notice '% user_id was left without a foreign key: %', target, sqlerrm;
    end;
  end loop;
end $$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, user_id)
  values (
    new.id,
    new.email,
    coalesce(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'user_name',
      split_part(coalesce(new.email, ''), '@', 1)
    ),
    new.id
  )
  on conflict (id) do update
    set email = excluded.email,
        full_name = coalesce(excluded.full_name, public.profiles.full_name),
        user_id = excluded.user_id,
        updated_at = now();
  return new;
end;
$$;
