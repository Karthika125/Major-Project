-- Backfill missing public.profiles rows from auth.users
-- Safe to re-run. Handles username normalization and uniqueness.
-- Run in Supabase SQL Editor.

begin;

do $$
declare
  auth_user record;
  base_username text;
  safe_username text;
  suffix text;
  attempt integer;
begin
  for auth_user in
    select
      u.id,
      u.email,
      u.raw_user_meta_data
    from auth.users u
    left join public.profiles p on p.id = u.id
    where p.id is null
  loop
    base_username := coalesce(
      nullif(trim(auth_user.raw_user_meta_data ->> 'username'), ''),
      split_part(coalesce(auth_user.email, ''), '@', 1),
      'user'
    );

    base_username := lower(base_username);
    base_username := regexp_replace(base_username, '[^a-z0-9_]+', '_', 'g');
    base_username := trim(both '_' from base_username);

    if base_username = '' then
      base_username := 'user';
    end if;

    suffix := substr(replace(auth_user.id::text, '-', ''), 1, 6);
    safe_username := base_username;
    attempt := 0;

    while exists (
      select 1
      from public.profiles p2
      where p2.username = safe_username
        and p2.id <> auth_user.id
    ) loop
      attempt := attempt + 1;
      safe_username := base_username || '_' || suffix || case when attempt > 1 then '_' || attempt::text else '' end;
    end loop;

    insert into public.profiles (id, username, avatar_url)
    values (
      auth_user.id,
      safe_username,
      auth_user.raw_user_meta_data ->> 'avatar_url'
    )
    on conflict (id) do update
    set username = excluded.username,
        avatar_url = coalesce(excluded.avatar_url, public.profiles.avatar_url);
  end loop;
end
$$;

commit;
