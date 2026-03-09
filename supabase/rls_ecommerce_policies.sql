-- Strict RLS policy patch for ecommerce tables
-- Apply in Supabase SQL Editor (safe to re-run).

begin;

-- Ensure RLS is enabled on all ecommerce tables
alter table if exists public.profiles enable row level security;
alter table if exists public.stores enable row level security;
alter table if exists public.products enable row level security;
alter table if exists public.carts enable row level security;
alter table if exists public.cart_items enable row level security;
alter table if exists public.orders enable row level security;
alter table if exists public.order_items enable row level security;

-- =====================================================
-- PROFILES
-- =====================================================
drop policy if exists profiles_select_authenticated on public.profiles;
drop policy if exists profiles_insert_self on public.profiles;
drop policy if exists profiles_update_self on public.profiles;

create policy profiles_select_authenticated
on public.profiles
for select
to authenticated
using (true);

create policy profiles_insert_self
on public.profiles
for insert
to authenticated
with check (auth.uid() = id);

create policy profiles_update_self
on public.profiles
for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

-- =====================================================
-- STORES
-- =====================================================
drop policy if exists stores_select_authenticated on public.stores;
drop policy if exists stores_insert_owner on public.stores;
drop policy if exists stores_update_owner on public.stores;
drop policy if exists stores_delete_owner on public.stores;

create policy stores_select_authenticated
on public.stores
for select
to authenticated
using (true);

create policy stores_insert_owner
on public.stores
for insert
to authenticated
with check (auth.uid() = owner_id);

create policy stores_update_owner
on public.stores
for update
to authenticated
using (auth.uid() = owner_id)
with check (auth.uid() = owner_id);

create policy stores_delete_owner
on public.stores
for delete
to authenticated
using (auth.uid() = owner_id);

-- =====================================================
-- PRODUCTS
-- Store owners can CRUD products only in their own stores.
-- Customers can read products.
-- =====================================================
drop policy if exists products_select_authenticated on public.products;
drop policy if exists products_insert_store_owner on public.products;
drop policy if exists products_update_store_owner on public.products;
drop policy if exists products_delete_store_owner on public.products;

create policy products_select_authenticated
on public.products
for select
to authenticated
using (true);

create policy products_insert_store_owner
on public.products
for insert
to authenticated
with check (
  exists (
    select 1
    from public.stores s
    where s.id = products.store_id
      and s.owner_id = auth.uid()
  )
);

create policy products_update_store_owner
on public.products
for update
to authenticated
using (
  exists (
    select 1
    from public.stores s
    where s.id = products.store_id
      and s.owner_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.stores s
    where s.id = products.store_id
      and s.owner_id = auth.uid()
  )
);

create policy products_delete_store_owner
on public.products
for delete
to authenticated
using (
  exists (
    select 1
    from public.stores s
    where s.id = products.store_id
      and s.owner_id = auth.uid()
  )
);

-- =====================================================
-- CARTS
-- Users can only see/manage their own carts.
-- Customers can create carts.
-- =====================================================
drop policy if exists carts_select_self on public.carts;
drop policy if exists carts_insert_self on public.carts;
drop policy if exists carts_update_self on public.carts;
drop policy if exists carts_delete_self on public.carts;

create policy carts_select_self
on public.carts
for select
to authenticated
using (auth.uid() = user_id);

create policy carts_insert_self
on public.carts
for insert
to authenticated
with check (auth.uid() = user_id);

create policy carts_update_self
on public.carts
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy carts_delete_self
on public.carts
for delete
to authenticated
using (auth.uid() = user_id);

-- =====================================================
-- CART ITEMS
-- Users can only access cart items in their own carts.
-- Extra check enforces product/store consistency at policy level.
-- =====================================================
drop policy if exists cart_items_select_own_cart on public.cart_items;
drop policy if exists cart_items_insert_own_cart on public.cart_items;
drop policy if exists cart_items_update_own_cart on public.cart_items;
drop policy if exists cart_items_delete_own_cart on public.cart_items;

create policy cart_items_select_own_cart
on public.cart_items
for select
to authenticated
using (
  exists (
    select 1
    from public.carts c
    where c.id = cart_items.cart_id
      and c.user_id = auth.uid()
  )
);

create policy cart_items_insert_own_cart
on public.cart_items
for insert
to authenticated
with check (
  exists (
    select 1
    from public.carts c
    join public.products p on p.id = cart_items.product_id
    where c.id = cart_items.cart_id
      and c.user_id = auth.uid()
      and p.store_id = c.store_id
  )
);

create policy cart_items_update_own_cart
on public.cart_items
for update
to authenticated
using (
  exists (
    select 1
    from public.carts c
    where c.id = cart_items.cart_id
      and c.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.carts c
    join public.products p on p.id = cart_items.product_id
    where c.id = cart_items.cart_id
      and c.user_id = auth.uid()
      and p.store_id = c.store_id
  )
);

create policy cart_items_delete_own_cart
on public.cart_items
for delete
to authenticated
using (
  exists (
    select 1
    from public.carts c
    where c.id = cart_items.cart_id
      and c.user_id = auth.uid()
  )
);

-- =====================================================
-- ORDERS
-- Buyers can see/create their own orders.
-- Store owners can read and update status for their store orders.
-- =====================================================
drop policy if exists orders_select_buyer_or_store_owner on public.orders;
drop policy if exists orders_select_self on public.orders;
drop policy if exists orders_insert_self on public.orders;
drop policy if exists orders_update_store_owner on public.orders;

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

create policy orders_insert_self
on public.orders
for insert
to authenticated
with check (
  auth.uid() = user_id
  and status = 'pending'
);

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

-- =====================================================
-- ORDER ITEMS
-- Users can read order items for own orders.
-- Store owners can read order items for their store orders.
-- Writes are intentionally blocked for authenticated users.
-- =====================================================
drop policy if exists order_items_select_buyer_or_store_owner on public.order_items;
drop policy if exists order_items_select_self_order on public.order_items;

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
