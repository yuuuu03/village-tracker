// Village Tracker service worker: opens instantly from the saved copy, updates in the background,
// push notifications, offline shell
const CACHE = "vt-v2", LIB = "vt-lib-v1";
const SHELL = ["./", "./index.html", "./manifest.webmanifest", "./icon-192.png", "./icon-512.png"];
self.addEventListener("install", (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener("activate", (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE && k !== LIB).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", (e) => {
  const req = e.request; if (req.method !== "GET") return;
  const url = new URL(req.url);
  // the Supabase library, the trained eye and its runtime: versioned, so keep them once downloaded
  if (url.origin === "https://cdn.jsdelivr.net" && (url.pathname.includes("@supabase") || url.pathname.includes("onnxruntime-web@")) || (url.origin === location.origin && url.pathname.endsWith(".onnx"))) {
    e.respondWith(caches.open(LIB).then((c) => c.match(req).then((hit) => hit || fetch(req).then((r) => { if (r.ok) c.put(req, r.clone()); return r; }))));
    return;
  }
  if (url.origin !== location.origin) return;
  // the page: show the saved copy straight away, fetch the newest in the background, tell the page if it changed
  if (req.mode === "navigate") {
    const net = caches.open(CACHE).then(async (c) => {
      const old = await c.match("./index.html");
      const r = await fetch(req);
      if (r.ok) {
        const fresh = await r.clone().text(), was = old ? await old.clone().text() : null;
        await c.put("./index.html", new Response(fresh, { headers: { "Content-Type": "text/html; charset=utf-8" } }));
        if (was && was !== fresh) (await self.clients.matchAll({ type: "window" })).forEach((cl) => cl.postMessage({ type: "update" }));
      }
      return r;
    });
    e.waitUntil(net.catch(() => {}));
    e.respondWith(caches.match("./index.html").then((hit) => hit || net).catch(() => net));
    return;
  }
  if (req.url.endsWith(".json") || req.url.endsWith("config.js")) {
    e.respondWith(fetch(req).then((r) => { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); return r; }).catch(() => caches.match(req)));
    return;
  }
  e.respondWith(caches.match(req).then((r) => r || fetch(req)));
});
self.addEventListener("push", (e) => {
  const d = e.data ? e.data.json() : {};
  e.waitUntil(self.registration.showNotification(d.title || "Village Tracker", { body: d.body || "", icon: "icon-192.png", badge: "icon-192.png", tag: d.tag, data: { url: d.url || "./" } }));
});
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = new URL(e.notification.data.url, self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((cs) => {
    for (const c of cs) { if ("focus" in c) { c.navigate(url); return c.focus(); } }
    return self.clients.openWindow(url);
  }));
});
