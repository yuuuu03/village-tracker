-- Village Tracker · send push reminders every minute
-- 1. Database → Extensions: enable pg_cron and pg_net.
-- 2. Replace YOUR-PROJECT-REF and YOUR-CRON-SECRET below (same secret you set with `supabase secrets set CRON_SECRET=...`).
-- 3. Run in the SQL Editor.
select cron.schedule(
  'send-reminders',
  '* * * * *',
  $$
  select net.http_post(
    url     := 'https://YOUR-PROJECT-REF.supabase.co/functions/v1/send-reminders',
    headers := jsonb_build_object('Content-Type','application/json','x-cron-secret','YOUR-CRON-SECRET'),
    body    := '{}'::jsonb
  );
  $$
);
-- To stop: select cron.unschedule('send-reminders');

-- Keep the free database small: delete reminders that were sent more than 7 days ago (daily, 03:17 UTC)
select cron.schedule(
  'tidy-reminders',
  '17 3 * * *',
  $$ delete from public.reminders where sent_at is not null and sent_at < now() - interval '7 days'; $$
);
