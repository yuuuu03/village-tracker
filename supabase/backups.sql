-- Run once in Supabase → SQL Editor to switch on weekly online backups
-- Weekly online backups of your villages and attack log (the site keeps the last 8)
create table if not exists public.backups (
  id         bigint generated always as identity primary key,
  user_id    uuid not null default auth.uid() references auth.users on delete cascade,
  created_at timestamptz not null default now(),
  data       jsonb not null
);
alter table public.backups enable row level security;
drop policy if exists "backups: own rows" on public.backups;
create policy "backups: own rows" on public.backups
  for all using (auth.uid() = user_id and public.is_allowed()) with check (auth.uid() = user_id and public.is_allowed());
grant select, insert, delete on public.backups to authenticated;
