// Village Tracker · private calendar feed (subscribe in any calendar app).
// URL: https://YOUR-PROJECT-REF.supabase.co/functions/v1/calendar?k=TOKEN
// The token is the secret: it comes from the `feeds` table (Calendar tab → Live calendar link).
// Deploy with --no-verify-jwt so calendar apps can fetch it.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const z = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const esc = (s: string) => s.replace(/[\;,]/g, (m) => "\\" + m).replace(/\n/g, "\\n");

Deno.serve(async (req) => {
  const k = new URL(req.url).searchParams.get("k") ?? "";
  if (!/^[a-f0-9]{32}$/.test(k)) return new Response("not found", { status: 404 });
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: feed } = await sb.from("feeds").select("user_id").eq("token", k).maybeSingle();
  if (!feed) return new Response("not found", { status: 404 });

  const since = new Date(Date.now() - 2 * 864e5).toISOString();
  const { data: rows } = await sb.from("reminders").select("id, village_id, fire_at, title")
    .eq("user_id", feed.user_id).like("body", "Done%").gte("fire_at", since).order("fire_at").limit(500);

  const now = new Date();
  const L = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Village Tracker//EN", "CALSCALE:GREGORIAN",
    "X-WR-CALNAME:Village Tracker", "REFRESH-INTERVAL;VALUE=DURATION:PT15M", "X-PUBLISHED-TTL:PT15M"];
  for (const r of rows ?? []) {
    const t = new Date(r.fire_at);
    L.push("BEGIN:VEVENT", `UID:vt-${r.id}@village-tracker`, `DTSTAMP:${z(now)}`, `DTSTART:${z(t)}`,
      `DTEND:${z(new Date(t.getTime() + 5 * 6e4))}`, `SUMMARY:${esc(r.title + " done")}`,
      "BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${esc(r.title + " finishes in 1 minute")}`, "TRIGGER:-PT1M", "END:VALARM", "END:VEVENT");
  }
  L.push("END:VCALENDAR");
  return new Response(L.join("\r\n"), { headers: { "content-type": "text/calendar; charset=utf-8", "cache-control": "max-age=300" } });
});
