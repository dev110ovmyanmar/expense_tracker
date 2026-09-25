-- Allow a fixed bill to repeat every day. Run after 004_recurring_and_goals.sql.

do $$
declare
  constraint_name text;
begin
  if to_regclass('public.recurring_items') is null then
    return;
  end if;
  for constraint_name in
    select con.conname
    from pg_constraint con
    where con.conrelid = 'public.recurring_items'::regclass
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid) ilike '%frequency%'
  loop
    execute format('alter table public.recurring_items drop constraint %I', constraint_name);
  end loop;
  alter table public.recurring_items
    add constraint recurring_items_frequency_check
    check (frequency in ('daily', 'weekly', 'monthly'));
end $$;
