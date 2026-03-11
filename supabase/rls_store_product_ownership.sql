-- Store/Product ownership RLS hardening
-- Safe to re-run in Supabase SQL Editor.

begin;

-- =====================================================
-- 1) Ensure RLS is enabled
-- =====================================================
alter table if exists public.stores enable row level security;
alter table if exists public.products enable row level security;

-- =====================================================
-- 2) STORES policies
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
-- 3) PRODUCTS policies
-- products.store_id must belong to a store owned by auth.uid()
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

commit;
