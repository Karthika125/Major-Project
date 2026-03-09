-- Store-scoped chat patch (safe to re-run)
-- Adds store_id to chat_messages and updates RLS for store-scoped inserts + self-delete.

begin;

alter table if exists public.chat_messages
  add column if not exists store_id uuid;

create index if not exists idx_chat_messages_store_created_at
  on public.chat_messages (store_id, created_at desc);

-- Add FK to stores only when stores table exists and FK is missing.
do $$
begin
  if to_regclass('public.chat_messages') is not null
     and to_regclass('public.stores') is not null
     and not exists (
       select 1
       from pg_constraint
       where conname = 'chat_messages_store_id_fkey'
     ) then
    alter table public.chat_messages
      add constraint chat_messages_store_id_fkey
      foreign key (store_id)
      references public.stores(id)
      on delete cascade;
  end if;
end
$$;

alter table if exists public.chat_messages enable row level security;

drop policy if exists "Chat messages are viewable by everyone" on public.chat_messages;
drop policy if exists "Authenticated users can insert chat messages" on public.chat_messages;
drop policy if exists chat_messages_select_authenticated on public.chat_messages;
drop policy if exists chat_messages_insert_self on public.chat_messages;
drop policy if exists chat_messages_delete_self on public.chat_messages;

create policy chat_messages_select_authenticated
on public.chat_messages
for select
to authenticated
using (true);

create policy chat_messages_insert_self
on public.chat_messages
for insert
to authenticated
with check (auth.uid() = user_id and store_id is not null);

create policy chat_messages_delete_self
on public.chat_messages
for delete
to authenticated
using (auth.uid() = user_id);

commit;
