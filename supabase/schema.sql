-- Village Tracker · database schema
-- Run once in Supabase: SQL Editor → New query → paste → Run.

-- Villages: one row per village per user (the whole parsed export + your notes)
create table if not exists public.villages (
  user_id    uuid not null default auth.uid() references auth.users on delete cascade,
  id         text not null,
  data       jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);
alter table public.villages enable row level security;
drop policy if exists "villages: own rows" on public.villages;
create policy "villages: own rows" on public.villages
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Push subscriptions (one per device that turned on reminders)
create table if not exists public.push_subs (
  endpoint   text primary key,
  user_id    uuid not null default auth.uid() references auth.users on delete cascade,
  sub        jsonb not null,
  created_at timestamptz not null default now()
);
alter table public.push_subs enable row level security;
drop policy if exists "push_subs: own rows" on public.push_subs;
create policy "push_subs: own rows" on public.push_subs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Reminders: written by the app after each paste, sent by the send-reminders function
create table if not exists public.reminders (
  id         bigint generated always as identity primary key,
  user_id    uuid not null default auth.uid() references auth.users on delete cascade,
  village_id text not null,
  fire_at    timestamptz not null,
  title      text not null,
  body       text not null,
  sent_at    timestamptz
);
create index if not exists reminders_due on public.reminders (fire_at) where sent_at is null;
alter table public.reminders enable row level security;
drop policy if exists "reminders: own rows" on public.reminders;
create policy "reminders: own rows" on public.reminders
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Read-only share links
create table if not exists public.shares (
  token      text primary key default replace(gen_random_uuid()::text, '-', ''),
  user_id    uuid not null default auth.uid() references auth.users on delete cascade,
  village_id text not null,
  created_at timestamptz not null default now()
);
alter table public.shares enable row level security;
drop policy if exists "shares: own rows" on public.shares;
create policy "shares: own rows" on public.shares
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Anyone holding a token can read that one village, nothing else
create or replace function public.get_share(t text)
returns jsonb language sql stable security definer set search_path = public as $$
  select v.data from public.shares s
  join public.villages v on v.user_id = s.user_id and v.id = s.village_id
  where s.token = t
$$;
revoke all on function public.get_share(text) from public;
grant execute on function public.get_share(text) to anon, authenticated;

-- ===================================================================
-- Lock the tracker to you (run after creating your user, see README 2b)
-- Only emails in this list can read or write anything, even if someone
-- manages to get an account.
-- ===================================================================
create table if not exists public.allowed_emails ( email text primary key );
alter table public.allowed_emails enable row level security;   -- no policies: invisible to the app

create or replace function public.is_allowed()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.allowed_emails where lower(email) = lower(auth.jwt() ->> 'email'))
$$;
grant execute on function public.is_allowed() to authenticated;

drop policy if exists "villages: own rows" on public.villages;
create policy "villages: own rows" on public.villages
  for all using (auth.uid() = user_id and public.is_allowed()) with check (auth.uid() = user_id and public.is_allowed());
drop policy if exists "reminders: own rows" on public.reminders;
create policy "reminders: own rows" on public.reminders
  for all using (auth.uid() = user_id and public.is_allowed()) with check (auth.uid() = user_id and public.is_allowed());
drop policy if exists "push_subs: own rows" on public.push_subs;
create policy "push_subs: own rows" on public.push_subs
  for all using (auth.uid() = user_id and public.is_allowed()) with check (auth.uid() = user_id and public.is_allowed());
drop policy if exists "shares: own rows" on public.shares;
create policy "shares: own rows" on public.shares
  for all using (auth.uid() = user_id and public.is_allowed()) with check (auth.uid() = user_id and public.is_allowed());

-- Private calendar feed: one secret link per user (Calendar tab → Live calendar link)
create table if not exists public.feeds (
  user_id    uuid primary key default auth.uid() references auth.users on delete cascade,
  token      text not null unique default replace(gen_random_uuid()::text, '-', ''),
  created_at timestamptz not null default now()
);
alter table public.feeds enable row level security;
drop policy if exists "feeds: own row" on public.feeds;
create policy "feeds: own row" on public.feeds
  for all using (auth.uid() = user_id and public.is_allowed()) with check (auth.uid() = user_id and public.is_allowed());

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

-- Let the signed-in app use these tables (row security above still limits it to your own rows)
grant select, insert, update, delete on public.villages, public.push_subs, public.reminders, public.shares, public.feeds to authenticated;

-- Then add yourself (change the address):
-- insert into public.allowed_emails (email) values ('you@example.com');
