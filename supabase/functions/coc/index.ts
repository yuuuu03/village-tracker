// Village Tracker · Clash of Clans API relay
// Keeps your API key on the server. Calls go through RoyaleAPI's proxy so the key's
// allowed IP can be the proxy's fixed address (45.79.218.79) instead of Supabase's changing IPs.
// Secrets: COC_API_TOKEN (required), COC_BASE_URL (optional, default below)
const BASE = Deno.env.get("COC_BASE_URL") ?? "https://cocproxy.royaleapi.dev/v1";
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const ALLOWED = /^\/(players|clans)\/%23[0-9A-Z]+(\/(currentwar|currentwar\/leaguegroup|warlog))?$/i;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const { path } = await req.json();
    if (typeof path !== "string" || !ALLOWED.test(path)) {
      return new Response(JSON.stringify({ error: "path not allowed" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
    }
    const r = await fetch(BASE + path, { headers: { Authorization: `Bearer ${Deno.env.get("COC_API_TOKEN")}`, Accept: "application/json" } });
    return new Response(await r.text(), { status: r.status, headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "max-age=60" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
  }
});
