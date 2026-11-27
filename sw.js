// SPL HQ service worker: cached copy first for the app's own files (refreshed in the background), network when there is no copy.
// Never caches the backend (script.google.com): live data is always fetched fresh.
var CACHE = "splhq-v64";
self.addEventListener("install", function (e) { self.skipWaiting(); });
// Drop every older splhq-v* cache (WS7: phones were keeping one full copy of the app per version, 27 and counting).
self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (ks) { return Promise.all(ks.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); })); })
    .then(function () { return self.clients.claim(); }));
});
// ⚡ Cached copy first (instant launch, no waiting on the network for 300+ KB), fresh copy fetched behind it for next time.
// The app's ✨ update check notices a newer page within seconds and reloads / shows the pill, so nobody is stuck on an old copy.
// Exception: the update check's own fetches (cache: "no-store") always go to the network.
self.addEventListener("fetch", function (e) {
  var u = new URL(e.request.url);
  if (e.request.method !== "GET" || u.origin !== self.location.origin) return;
  var probe = e.request.cache === "no-store" || e.request.cache === "reload";
  var net = fetch(e.request).then(function (r) {
    if (r.ok && !probe) { var copy = r.clone(); caches.open(CACHE).then(function (c) { c.put(e.request, copy); }); } return r;
  });
  if (probe) { e.respondWith(net.catch(function () { return caches.match(e.request); })); return; }
  e.respondWith(caches.match(e.request).then(function (hit) { if (hit) { e.waitUntil(net.catch(function () {})); return hit; } return net; }));
});
