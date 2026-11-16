-- Run once in Supabase → SQL Editor to switch on auto-upload from your phone
-- Auto-upload from your phone: a private link per user, and an inbox the website empties
create table if not exists public.ingest_keys (
  user_id    uuid primary key default auth.uid() references auth.users on delete cascade,
  token      text not null unique default replace(gen_random_uuid()::text, '-', ''),
  created_at timestamptz not null default now()
);
alter table public.ingest_keys enable row level security;
drop policy if exists "ingest_keys: own row" on public.ingest_keys;
create policy "ingest_keys: own row" on public.ingest_keys
  for all using (auth.uid() = user_id and public.is_allowed()) with check (auth.uid() = user_id and public.is_allowed());
create table if not exists public.inbox (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references auth.users on delete cascade,
  raw        text not null,
  created_at timestamptz not null default now()
);
alter table public.inbox enable row level security;
drop policy if exists "inbox: own rows" on public.inbox;
create policy "inbox: own rows" on public.inbox
  for all using (auth.uid() = user_id and public.is_allowed()) with check (auth.uid() = user_id and public.is_allowed());
grant select, insert, update, delete on public.ingest_keys, public.inbox to authenticated;
