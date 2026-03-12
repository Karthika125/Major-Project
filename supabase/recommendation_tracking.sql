-- ============================================================
-- Recommendation System Tracking Tables
-- Run this in your Supabase SQL Editor
-- ============================================================

-- user_activity table (may already exist from schema.sql, 
-- this ensures it works correctly)
create table if not exists public.user_activity (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  product_id  uuid references public.products(id) on delete set null,
  action_type text not null check (action_type in ('view', 'click', 'add_to_cart', 'purchase', 'wishlist')),
  duration    integer default 5,   -- seconds spent viewing
  metadata    jsonb,
  created_at  timestamptz not null default now()
);

-- Indexes for fast recommendation queries
create index if not exists idx_user_activity_user_id_created
  on public.user_activity(user_id, created_at desc);

create index if not exists idx_user_activity_product_id
  on public.user_activity(product_id);

create index if not exists idx_user_activity_user_product
  on public.user_activity(user_id, product_id);

-- RLS: users can read/write only their own activity
alter table public.user_activity enable row level security;

drop policy if exists user_activity_select_self on public.user_activity;
create policy user_activity_select_self
  on public.user_activity
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists user_activity_insert_self on public.user_activity;
create policy user_activity_insert_self
  on public.user_activity
  for insert
  to authenticated
  with check (auth.uid() = user_id);

-- Allow the recommendation engine to see all activity for trending (read-only)
-- Comment this out if you want strict privacy
drop policy if exists user_activity_select_trending on public.user_activity;
create policy user_activity_select_trending
  on public.user_activity
  for select
  to authenticated
  using (true);  -- all authenticated users can see all activity (for trending)

-- ──────────────────────────────────────────────────────────────────
-- Optional: Product popularity view for faster trending queries
-- ──────────────────────────────────────────────────────────────────
create or replace view public.product_popularity as
select
  product_id,
  count(*)         as view_count,
  sum(duration)    as total_view_seconds,
  max(created_at)  as last_viewed_at
from public.user_activity
where
  product_id is not null
  and action_type = 'view'
  and created_at >= now() - interval '30 days'
group by product_id;
