/* Offline copy for the foyer TV player. Only the foyer player's own requests are handled; the hub and editor pass straight through.
   The page and its scripts: fresh from the internet when it's there, the saved copy when it isn't.
   Listings: the same. Pictures (posters, food, logos): the saved copy first, so the TVs keep their pictures with no internet.
   YouTube itself can't be saved; the player skips YouTube trailers while the internet is down. */
const PAGE = "imc-foyer-page-v5", PICS = "imc-foyer-pics-v1", MAX_PICS = 400;
const CORE = ["foyer.html", "tv.html", "tv.webmanifest", "tv-192.png", "imc-logo.png"]  /* the pages carry their own scripts (they are packed inside the locked pages) */;

self.addEventListener("install", (e) => { e.waitUntil(caches.open(PAGE).then((c) => c.addAll(CORE).catch(() => {})).then(() => self.skipWaiting())); });
self.addEventListener("activate", (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k.startsWith("imc-foyer-") && k !== PAGE && k !== PICS).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });

const fromFoyer = (req) => /\/(foyer|tv)\.html/.test(req.referrer || "") || /\/(foyer|tv)\.html/.test(req.url) || /\/(ident|qr|music|priceboard|gauth)\.js|tv\.webmanifest|tv-\d+\.png/.test(req.url);
const isPic = (u) => /\.(png|jpe?g|webp|gif|svg)(\?|$)/i.test(u.pathname) || u.hostname === "i.ytimg.com";

async function networkFirst(req, cacheName) {
  const c = await caches.open(cacheName);
  try { const r = await fetch(req); if (r && (r.ok || r.type === "opaque")) c.put(stripTs(req), r.clone()); return r; }
  catch (e) { const hit = await c.match(stripTs(req), { ignoreSearch: true }); if (hit) { const h = new Headers(hit.headers); h.set("x-imc-saved", "1"); return new Response(await hit.blob(), { status: hit.status, headers: h }); } throw e; }
}
async function cacheFirst(req) {
  const c = await caches.open(PICS), hit = await c.match(req);
  if (hit) { fetch(req).then((r) => { if (r && (r.ok || r.type === "opaque")) c.put(req, r); }).catch(() => {}); return hit; }
  const r = await fetch(req);
  if (r && (r.ok || r.type === "opaque")) { c.put(req, r.clone()); c.keys().then((ks) => { if (ks.length > MAX_PICS) for (const k of ks.slice(0, ks.length - MAX_PICS)) c.delete(k); }); }
  return r;
}
/* listings are fetched with ?ts=… to dodge caches; save them under one name */
function stripTs(req) { const u = new URL(req.url); u.searchParams.delete("ts"); u.searchParams.delete("v"); return u.href; }

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET" || !fromFoyer(req)) return;
  const u = new URL(req.url);
  if (/youtube|googlevideo|doubleclick|google\.com/.test(u.hostname)) return;
  if (isPic(u)) { e.respondWith(cacheFirst(req)); return; }
  if (u.origin === self.location.origin || u.hostname === "raw.githubusercontent.com") e.respondWith(networkFirst(req, PAGE));
});
