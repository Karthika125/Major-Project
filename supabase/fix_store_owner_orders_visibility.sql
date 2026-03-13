-- Fix: Store owners cannot see customer orders in Manage Store > Orders
-- Run this in Supabase SQL Editor.

begin;

alter table if exists public.orders enable row level security;
alter table if exists public.order_items enable row level security;

-- Replace old self-only orders read policy
drop policy if exists orders_select_self on public.orders;
drop policy if exists orders_select_buyer_or_store_owner on public.orders;

create policy orders_select_buyer_or_store_owner
on public.orders
for select
to authenticated
using (
  auth.uid() = user_id
  or exists (
    select 1
    from public.stores s
    where s.id = orders.store_id
      and s.owner_id = auth.uid()
  )
);

-- Keep insert/update policies compatible with checkout + owner status management
drop policy if exists orders_insert_self on public.orders;
create policy orders_insert_self
on public.orders
for insert
to authenticated
with check (
  auth.uid() = user_id
  and status = 'pending'
);

drop policy if exists orders_update_store_owner on public.orders;
create policy orders_update_store_owner
on public.orders
for update
to authenticated
using (
  exists (
    select 1
    from public.stores s
    where s.id = orders.store_id
      and s.owner_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.stores s
    where s.id = orders.store_id
      and s.owner_id = auth.uid()
  )
);

-- Replace old self-only order_items read policy
drop policy if exists order_items_select_self_order on public.order_items;
drop policy if exists order_items_select_buyer_or_store_owner on public.order_items;

create policy order_items_select_buyer_or_store_owner
on public.order_items
for select
to authenticated
using (
  exists (
    select 1
    from public.orders o
    join public.stores s on s.id = o.store_id
    where o.id = order_items.order_id
      and (o.user_id = auth.uid() or s.owner_id = auth.uid())
  )
);

commit;

-- Optional verification query (run after commit, as store owner account)
-- select id, user_id, store_id, created_at
-- from public.orders
-- where store_id = '<your_store_id>'
-- order by created_at desc;