-- Transaction-safe checkout RPC
-- Apply this in Supabase SQL Editor.

begin;

-- Disable legacy trigger-driven checkout side effects to avoid duplicate order_items/stock updates.
drop trigger if exists trg_populate_order_items_from_active_cart on public.orders;

create or replace function public.checkout_cart(p_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_auth_user_id uuid;
  v_cart_id uuid;
  v_store_id uuid;
  v_order_id uuid;
  v_item_count integer;
  v_updated_product_count integer;
  v_insufficient_product_name text;
  v_available_stock integer;
  v_requested_quantity integer;
begin
  v_auth_user_id := auth.uid();

  if v_auth_user_id is null then
    raise exception 'Authentication required for checkout.'
      using errcode = '42501';
  end if;

  if p_user_id is null then
    raise exception 'p_user_id is required.'
      using errcode = '22004';
  end if;

  if v_auth_user_id <> p_user_id then
    raise exception 'You can only checkout your own cart.'
      using errcode = '42501';
  end if;

  -- Pick the newest active cart that has items and lock the cart row.
  select c.id, c.store_id
    into v_cart_id, v_store_id
  from public.carts c
  where c.user_id = p_user_id
    and c.is_active = true
    and exists (
      select 1
      from public.cart_items ci
      where ci.cart_id = c.id
    )
  order by c.created_at desc
  limit 1
  for update;

  if v_cart_id is null then
    raise exception 'Your cart is empty.'
      using errcode = 'P0001';
  end if;

  -- Lock cart items so quantities cannot change mid-checkout.
  perform 1
  from public.cart_items ci
  where ci.cart_id = v_cart_id
  order by ci.id
  for update;

  select count(*)
    into v_item_count
  from public.cart_items ci
  where ci.cart_id = v_cart_id;

  if v_item_count = 0 then
    raise exception 'Your cart is empty.'
      using errcode = 'P0001';
  end if;

  -- Lock all product rows referenced by this cart before stock validation/update.
  perform p.stock
  from public.products p
  join public.cart_items ci on ci.product_id = p.id
  where ci.cart_id = v_cart_id
  order by p.id
  for update;

  -- Validate stock after locks are acquired.
  select p.name, p.stock, ci.quantity
    into v_insufficient_product_name, v_available_stock, v_requested_quantity
  from public.cart_items ci
  join public.products p on p.id = ci.product_id
  where ci.cart_id = v_cart_id
    and p.stock < ci.quantity
  order by p.name
  limit 1;

  if found then
    raise exception 'Insufficient stock'
      using errcode = 'P0001',
        detail = format(
          'Product "%s": requested %s, available %s',
          v_insufficient_product_name,
          v_requested_quantity,
          v_available_stock
        );
  end if;

  -- Create order shell.
  insert into public.orders (user_id, store_id, status, total_price)
  values (p_user_id, v_store_id, 'pending', 0)
  returning id into v_order_id;

  -- Snapshot line items into immutable order_items.
  insert into public.order_items (order_id, product_name, product_price, quantity)
  select
    v_order_id,
    p.name,
    p.price,
    ci.quantity
  from public.cart_items ci
  join public.products p on p.id = ci.product_id
  where ci.cart_id = v_cart_id
  order by ci.id;

  -- Safe stock decrement while product rows remain locked.
  update public.products p
  set stock = p.stock - ci.quantity
  from public.cart_items ci
  where ci.cart_id = v_cart_id
    and ci.product_id = p.id
    and p.stock >= ci.quantity;

  get diagnostics v_updated_product_count = row_count;

  if v_updated_product_count <> v_item_count then
    raise exception 'Insufficient stock'
      using errcode = 'P0001';
  end if;

  if exists (
    select 1
    from public.products p
    join public.cart_items ci on ci.product_id = p.id
    where ci.cart_id = v_cart_id
      and p.stock < 0
  ) then
    raise exception 'Insufficient stock'
      using errcode = 'P0001';
  end if;

  -- Compute total from immutable snapshot.
  update public.orders o
  set total_price = (
    select coalesce(sum(oi.product_price * oi.quantity), 0)
    from public.order_items oi
    where oi.order_id = v_order_id
  )
  where o.id = v_order_id;

  -- Clear the cart and close it.
  delete from public.cart_items
  where cart_id = v_cart_id;

  update public.carts
  set is_active = false
  where id = v_cart_id;

  return v_order_id;
exception
  when others then
    raise;
end;
$$;

revoke all on function public.checkout_cart(uuid) from public;
grant execute on function public.checkout_cart(uuid) to authenticated;
grant execute on function public.checkout_cart(uuid) to service_role;

commit;
