// Service worker di Cerca squadra: serve solo a renderla installabile e a mostrare la pagina anche senza rete.
// Le chiamate /api passano sempre dalla rete (dati sempre freschi).
const CACHE = "squadre-v1";
const FILE = ["/squadre", "/squadre.js", "/squadre.css", "/piazza.css", "/style.css", "/assets/logo-192.png"];
self.addEventListener("install", (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILE)).then(() => self.skipWaiting())); });
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((k) => Promise.all(k.filter((x) => x !== CACHE).map((x) => caches.delete(x)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== "GET" || u.origin !== location.origin || u.pathname.startsWith("/api/")) return;
  // Prima la rete, poi la copia salvata
  e.respondWith(fetch(e.request).then((r) => {
    if (r.ok) { const c = r.clone(); caches.open(CACHE).then((x) => x.put(e.request, c)); }
    return r;
  }).catch(() => caches.match(e.request)));
});
