// Village Tracker · Clash of Clans API relay
// Keeps your API key on the server. Calls go through RoyaleAPI's proxy so the key's
// allowed IP can be the proxy's fixed address (45.79.218.79) instead of Supabase's changing IPs.
// Secrets: COC_API_TOKEN (required), COC_BASE_URL (optional, default below)
// Deploy with JWT verification OFF: this function checks the signed-in user itself,
// and only emails in public.allowed_emails may use it.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const BASE = Deno.env.get("COC_BASE_URL") ?? "https://cocproxy.royaleapi.dev/v1";
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
const ALLOWED = /^\/((players|clans)\/%23[0-9A-Z]+(\/(currentwar|currentwar\/leaguegroup|warlog|capitalraidseasons))?|clanwarleagues\/wars\/%23[0-9A-Z]+)(\?limit=\d{1,2})?$/i;

// Server key: legacy service_role, or the new secret key (SUPABASE_SECRET_KEYS is JSON keyed by name)
const serverKey = () => {
  const legacy = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (legacy) return legacy;
  try { const all = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}"); return all.default ?? Object.values(all)[0]; } catch { return undefined; }
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    // 1. who is asking? (the site sends the signed-in user's token)
    const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
    if (!token) return json({ error: "sign in first" }, 401);
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, serverKey()!);
    const { data: { user } } = await sb.auth.getUser(token);
    if (!user?.email) return json({ error: "sign in first" }, 401);
    const { data: ok } = await sb.from("allowed_emails").select("email").ilike("email", user.email).maybeSingle();
    if (!ok) return json({ error: "not invited" }, 403);

    // 2. relay the request
    const { path } = await req.json();
    if (typeof path !== "string" || !ALLOWED.test(path)) return json({ error: "path not allowed" }, 400);
    const r = await fetch(BASE + path, { headers: { Authorization: `Bearer ${Deno.env.get("COC_API_TOKEN")}`, Accept: "application/json" } });
    return new Response(await r.text(), { status: r.status, headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "max-age=60" } });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
