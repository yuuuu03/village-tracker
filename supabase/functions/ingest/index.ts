// Village Tracker · auto-upload from your phone
// Your phone (an iPhone Shortcut or an Android automation) sends the village export you just copied in the game
// to this address. It's parked in your "inbox"; the website imports it the next time it's open (or within a minute).
// The link's key identifies you, so keep the link private. Make a new one in Settings if it ever leaks.
// Deploy with JWT verification OFF (the key in the link is the check).
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, x-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const text = (body: string, status = 200) => new Response(body, { status, headers: { ...cors, "Content-Type": "text/plain; charset=utf-8" } });
const serverKey = () => {
  const legacy = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (legacy) return legacy;
  try { const all = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}"); return all.default ?? Object.values(all)[0]; } catch { return undefined; }
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return text("Send the export with POST.", 405);
  try {
    const key = new URL(req.url).searchParams.get("key") ?? req.headers.get("x-key") ?? "";
    if (!/^[0-9a-f]{32}$/i.test(key)) return text("Missing or bad key in the link.", 401);
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, serverKey()!);
    const { data: k } = await sb.from("ingest_keys").select("user_id").eq("token", key).maybeSingle();
    if (!k) return text("This link isn't valid any more. Make a new one in Settings.", 401);

    const raw = (await req.text()).trim();
    if (raw.length > 3_000_000) return text("That's too big to be a village export.", 413);
    let tag = "";
    try { const j = JSON.parse(raw); tag = j.tag ?? ""; if (!tag || !Array.isArray(j.buildings)) throw 0; }
    catch { return text("The clipboard doesn't hold a village export. In the game: Settings › More Settings › Data Export › Copy.", 400); }

    await sb.from("inbox").insert({ user_id: k.user_id, raw });
    // keep only the latest 20 waiting exports
    const { data: old } = await sb.from("inbox").select("id").eq("user_id", k.user_id).order("id", { ascending: false }).range(20, 200);
    if (old?.length) await sb.from("inbox").delete().in("id", old.map((r: { id: number }) => r.id));
    return text(`Sent ${tag} to Village Tracker.`);
  } catch (e) {
    return text("Something went wrong: " + String(e instanceof Error ? e.message : e), 500);
  }
});
