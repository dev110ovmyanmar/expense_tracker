-- Category spending limits on the existing monthly budget row.
-- Run this in the Supabase SQL editor after 005_user_auth.sql.

alter table public.budgets
  add column if not exists category_limits jsonb not null default '{}'::jsonb;
