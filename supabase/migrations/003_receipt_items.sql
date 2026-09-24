-- Item prices from scanned vouchers. Run this once in the SQL editor.

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

grant select, insert, update, delete on public.receipt_items to anon, authenticated;

drop policy if exists "receipt_items_public_select" on public.receipt_items;
drop policy if exists "receipt_items_public_insert" on public.receipt_items;
drop policy if exists "receipt_items_public_update" on public.receipt_items;
drop policy if exists "receipt_items_public_delete" on public.receipt_items;

create policy "receipt_items_public_select" on public.receipt_items
  for select to anon, authenticated using (true);
create policy "receipt_items_public_insert" on public.receipt_items
  for insert to anon, authenticated with check (true);
create policy "receipt_items_public_update" on public.receipt_items
  for update to anon, authenticated using (true) with check (true);
create policy "receipt_items_public_delete" on public.receipt_items
  for delete to anon, authenticated using (true);
