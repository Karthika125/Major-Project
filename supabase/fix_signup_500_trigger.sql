-- Hotfix: prevent /auth/v1/signup 500 from auth trigger/profile creation failures
-- Run in Supabase Dashboard -> SQL Editor

begin;

-- 1) Safer profile trigger function for ecommerce schema (public.profiles)
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
exception
  when undefined_table then
    -- In case public.profiles does not exist in this environment
    return new;
end;
$$;

-- 2) Optional compatibility trigger function for legacy schema (public.users)
create or replace function public.handle_new_user()
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
    from public.users u
    where u.username = safe_username
      and u.id <> new.id
  ) then
    safe_username := base_username || '_' || suffix;
  end if;

  insert into public.users (id, username, avatar_type)
  values (new.id, safe_username, 'default')
  on conflict (id) do update
  set username = excluded.username,
      avatar_type = coalesce(public.users.avatar_type, excluded.avatar_type),
      updated_at = now();

  return new;
exception
  when undefined_table then
    -- In case public.users does not exist in this environment
    return new;
end;
$$;

-- 3) Ensure auth triggers exist and point to safe functions
-- Ecommerce trigger
create or replace trigger on_auth_user_created_profiles
after insert on auth.users
for each row execute function public.handle_new_auth_user_profile();

-- Legacy trigger
create or replace trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

commit;

-- After running this SQL, also verify in Dashboard:
-- Authentication -> Providers -> Email -> Disable "Confirm email" for local dev OR configure SMTP.
