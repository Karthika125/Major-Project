-- Ecommerce schema migration for Supabase Postgres
-- Creates: profiles, stores, products, carts, cart_items, orders, order_items
-- Includes FKs, indexes, constraints, triggers, and RLS policies.

begin;

create extension if not exists "pgcrypto";

-- =====================================================
-- CLEAN RESET (DESTRUCTIVE)
-- This migration recreates ecommerce tables from scratch.
-- Remove this block only if you are adapting manually.
-- =====================================================

drop table if exists public.order_items cascade;
drop table if exists public.orders cascade;
drop table if exists public.cart_items cascade;
drop table if exists public.carts cascade;
drop table if exists public.products cascade;
drop table if exists public.stores cascade;
drop table if exists public.profiles cascade;

-- =====================================================
-- 1) TABLES
-- =====================================================

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique,
  avatar_url text,
  created_at timestamptz not null default now()
);

create table if not exists public.stores (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  store_name text not null,
  description text,
  created_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  name text not null,
  description text,
  price numeric(12, 2) not null check (price >= 0),
  image_url text,
  stock integer not null default 0 check (stock >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.carts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete cascade,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.cart_items (
  id uuid primary key default gen_random_uuid(),
  cart_id uuid not null references public.carts(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  quantity integer not null check (quantity > 0)
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete restrict,
  store_id uuid not null references public.stores(id) on delete restrict,
  status text not null default 'pending' check (status in ('pending', 'paid', 'fulfilled', 'cancelled')),
  total_price numeric(12, 2) not null default 0 check (total_price >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_name text not null,
  product_price numeric(12, 2) not null check (product_price >= 0),
  quantity integer not null check (quantity > 0)
);

-- =====================================================
-- 2) INTEGRITY + DOMAIN CONSTRAINTS
-- =====================================================

-- One product line per product per cart
create unique index if not exists ux_cart_items_cart_product
  on public.cart_items(cart_id, product_id);

-- Users can have multiple carts, but only one active cart per store
create unique index if not exists ux_carts_one_active_per_user_store
  on public.carts(user_id, store_id)
  where is_active = true;

-- Product in cart_items must belong to same store as the cart
create or replace function public.validate_cart_item_store_match()
returns trigger
language plpgsql
as $$
declare
  v_cart_store_id uuid;
  v_product_store_id uuid;
begin
  select c.store_id into v_cart_store_id
  from public.carts c
  where c.id = new.cart_id;

  if v_cart_store_id is null then
    raise exception 'Cart % does not exist', new.cart_id;
  end if;

  select p.store_id into v_product_store_id
  from public.products p
  where p.id = new.product_id;

  if v_product_store_id is null then
    raise exception 'Product % does not exist', new.product_id;
  end if;

  if v_cart_store_id <> v_product_store_id then
    raise exception 'Product % belongs to store %, but cart % belongs to store %',
      new.product_id, v_product_store_id, new.cart_id, v_cart_store_id;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_validate_cart_item_store_match on public.cart_items;
create trigger trg_validate_cart_item_store_match
before insert or update of cart_id, product_id on public.cart_items
for each row execute function public.validate_cart_item_store_match();

-- =====================================================
-- 3) ORDER SNAPSHOT LOGIC
-- Requirement: when orders are created, copy product name and price to order_items
-- =====================================================

create or replace function public.populate_order_items_from_active_cart()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cart_id uuid;
  v_has_items boolean;
begin
  -- Find active cart for this user + store
  select c.id into v_cart_id
  from public.carts c
  where c.user_id = new.user_id
    and c.store_id = new.store_id
    and c.is_active = true
  order by c.created_at desc
  limit 1
  for update;

  if v_cart_id is null then
    raise exception 'No active cart found for user % in store %', new.user_id, new.store_id;
  end if;

  select exists(
    select 1
    from public.cart_items ci
    where ci.cart_id = v_cart_id
  ) into v_has_items;

  if not v_has_items then
    raise exception 'Active cart % is empty', v_cart_id;
  end if;

  -- Validate stock before snapshot/checkout
  if exists (
    select 1
    from public.cart_items ci
    join public.products p on p.id = ci.product_id
    where ci.cart_id = v_cart_id
      and p.stock < ci.quantity
  ) then
    raise exception 'Insufficient stock for one or more products in active cart %', v_cart_id;
  end if;

  -- Copy product snapshot to order_items
  insert into public.order_items (order_id, product_name, product_price, quantity)
  select
    new.id,
    p.name,
    p.price,
    ci.quantity
  from public.cart_items ci
  join public.products p on p.id = ci.product_id
  where ci.cart_id = v_cart_id;

  -- Reduce product stock
  update public.products p
  set stock = p.stock - ci.quantity
  from public.cart_items ci
  where ci.cart_id = v_cart_id
    and ci.product_id = p.id;

  -- Compute total from immutable snapshot
  update public.orders o
  set total_price = (
    select coalesce(sum(oi.product_price * oi.quantity), 0)
    from public.order_items oi
    where oi.order_id = new.id
  )
  where o.id = new.id;

  -- Mark cart inactive (user can create another active cart later)
  update public.carts
  set is_active = false
  where id = v_cart_id;

  return new;
end;
$$;

drop trigger if exists trg_populate_order_items_from_active_cart on public.orders;
create trigger trg_populate_order_items_from_active_cart
after insert on public.orders
for each row execute function public.populate_order_items_from_active_cart();

-- Auto-create a profile row when a new auth user is created
create or replace function public.handle_new_auth_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  base_username text;
  safe_username text;
  suffix text;
begin
  base_username := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'username'), ''),
    split_part(new.email, '@', 1),
    'user'
  );

  base_username := lower(base_username);
  base_username := regexp_replace(base_username, '[^a-z0-9_]+', '_', 'g');
  base_username := trim(both '_' from base_username);

  if base_username = '' then
    base_username := 'user';
  end if;

  suffix := substr(replace(new.id::text, '-', ''), 1, 6);
  safe_username := base_username;

  if exists (
    select 1
    from public.profiles p
    where p.username = safe_username
      and p.id <> new.id
  ) then
    safe_username := base_username || '_' || suffix;
  end if;

  insert into public.profiles (id, username, avatar_url)
  values (
    new.id,
    safe_username,
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do update
  set username = excluded.username,
      avatar_url = coalesce(excluded.avatar_url, public.profiles.avatar_url);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_profiles on auth.users;
create trigger on_auth_user_created_profiles
after insert on auth.users
for each row execute function public.handle_new_auth_user_profile();

-- =====================================================
-- 4) INDEXES FOR PERFORMANCE
-- =====================================================

create index if not exists idx_stores_owner_id_created_at
  on public.stores(owner_id, created_at desc);

create index if not exists idx_products_store_id_created_at
  on public.products(store_id, created_at desc);

create index if not exists idx_products_store_id_name
  on public.products(store_id, name);

create index if not exists idx_carts_user_store_created_at
  on public.carts(user_id, store_id, created_at desc);

create index if not exists idx_cart_items_cart_id
  on public.cart_items(cart_id);

create index if not exists idx_cart_items_product_id
  on public.cart_items(product_id);

create index if not exists idx_orders_user_id_created_at
  on public.orders(user_id, created_at desc);

create index if not exists idx_orders_store_id_created_at
  on public.orders(store_id, created_at desc);

create index if not exists idx_orders_status_created_at
  on public.orders(status, created_at desc);

create index if not exists idx_order_items_order_id
  on public.order_items(order_id);

-- =====================================================
-- 5) RLS
-- =====================================================

alter table public.profiles enable row level security;
alter table public.stores enable row level security;
alter table public.products enable row level security;
alter table public.carts enable row level security;
alter table public.cart_items enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;

-- Profiles
-- Readable by authenticated users; writable by owner only.
drop policy if exists profiles_select_authenticated on public.profiles;
create policy profiles_select_authenticated
on public.profiles
for select
to authenticated
using (true);

drop policy if exists profiles_insert_self on public.profiles;
create policy profiles_insert_self
on public.profiles
for insert
to authenticated
with check (auth.uid() = id);

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self
on public.profiles
for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

-- Stores
-- Anyone authenticated can browse stores; only owner can mutate.
drop policy if exists stores_select_authenticated on public.stores;
create policy stores_select_authenticated
on public.stores
for select
to authenticated
using (true);

drop policy if exists stores_insert_owner on public.stores;
create policy stores_insert_owner
on public.stores
for insert
to authenticated
with check (auth.uid() = owner_id);

drop policy if exists stores_update_owner on public.stores;
create policy stores_update_owner
on public.stores
for update
to authenticated
using (auth.uid() = owner_id)
with check (auth.uid() = owner_id);

drop policy if exists stores_delete_owner on public.stores;
create policy stores_delete_owner
on public.stores
for delete
to authenticated
using (auth.uid() = owner_id);

-- Products
-- Browsable by authenticated users; store owner controls CRUD.
drop policy if exists products_select_authenticated on public.products;
create policy products_select_authenticated
on public.products
for select
to authenticated
using (true);

drop policy if exists products_insert_store_owner on public.products;
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

drop policy if exists products_update_store_owner on public.products;
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

drop policy if exists products_delete_store_owner on public.products;
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

-- Carts
-- User can only read/write their own carts.
drop policy if exists carts_select_self on public.carts;
create policy carts_select_self
on public.carts
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists carts_insert_self on public.carts;
create policy carts_insert_self
on public.carts
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists carts_update_self on public.carts;
create policy carts_update_self
on public.carts
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists carts_delete_self on public.carts;
create policy carts_delete_self
on public.carts
for delete
to authenticated
using (auth.uid() = user_id);

-- Cart items
-- User can only access items in carts they own.
drop policy if exists cart_items_select_own_cart on public.cart_items;
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

drop policy if exists cart_items_insert_own_cart on public.cart_items;
create policy cart_items_insert_own_cart
on public.cart_items
for insert
to authenticated
with check (
  exists (
    select 1
    from public.carts c
    where c.id = cart_items.cart_id
      and c.user_id = auth.uid()
  )
);

drop policy if exists cart_items_update_own_cart on public.cart_items;
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
    where c.id = cart_items.cart_id
      and c.user_id = auth.uid()
  )
);

drop policy if exists cart_items_delete_own_cart on public.cart_items;
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

-- Orders
-- Buyer can read own orders; store owner can read store orders.
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

drop policy if exists orders_insert_self on public.orders;
create policy orders_insert_self
on public.orders
for insert
to authenticated
with check (auth.uid() = user_id);

-- Store owner can update order status (e.g., fulfilled/cancelled)
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

-- Order items
-- Read-only for buyer and store owner; writes happen via trigger.
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
