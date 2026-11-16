// Village Tracker · sends due reminders as Web Push notifications.
// Called every minute by pg_cron (see cron.sql). Deploy with --no-verify-jwt.
// Secrets: CRON_SECRET, VAPID_PUBLIC, VAPID_PRIVATE, VAPID_CONTACT (an email address)
import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import webpush from "npm:web-push@3.6.7";

// Server key: legacy service_role, or the new secret key (SUPABASE_SECRET_KEYS is JSON keyed by name)
const serverKey = () => {
  const legacy = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (legacy) return legacy;
  try { const all = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}"); return all.default ?? Object.values(all)[0]; } catch { return undefined; }
};

Deno.serve(async (req) => {
  if (req.headers.get("x-cron-secret") !== Deno.env.get("CRON_SECRET")) return new Response("unauthorized", { status: 401 });
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, serverKey()!);
  webpush.setVapidDetails(`mailto:${Deno.env.get("VAPID_CONTACT")}`, Deno.env.get("VAPID_PUBLIC")!, Deno.env.get("VAPID_PRIVATE")!);

  const soon = new Date(Date.now() + 30_000).toISOString();
  const { data: due, error } = await sb.from("reminders").select("*").is("sent_at", null).lte("fire_at", soon).limit(300);
  if (error) return new Response(error.message, { status: 500 });

  let sent = 0;
  const subsCache = new Map<string, any[]>();
  for (const r of due ?? []) {
    if (!subsCache.has(r.user_id)) {
      const { data } = await sb.from("push_subs").select("endpoint, sub").eq("user_id", r.user_id);
      subsCache.set(r.user_id, data ?? []);
    }
    for (const s of subsCache.get(r.user_id)!) {
      try {
        await webpush.sendNotification(s.sub, JSON.stringify({ title: r.title, body: r.body, tag: `${r.village_id}-${r.id}`, url: `./#${r.village_id}` }));
        sent++;
      } catch (e: any) {
        if (e?.statusCode === 404 || e?.statusCode === 410) await sb.from("push_subs").delete().eq("endpoint", s.endpoint);
      }
    }
    await sb.from("reminders").update({ sent_at: new Date().toISOString() }).eq("id", r.id);
  }
  // tidy up: sent more than 2 days ago
  await sb.from("reminders").delete().lt("fire_at", new Date(Date.now() - 2 * 864e5).toISOString());
  return new Response(JSON.stringify({ due: due?.length ?? 0, sent }), { headers: { "Content-Type": "application/json" } });
});
