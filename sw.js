// SPL HQ service worker: network first for the app's own files, cached copy when offline.
// Never caches the backend (script.google.com): live data is always fetched fresh.
var CACHE = "splhq-v30";
self.addEventListener("install", function (e) { self.skipWaiting(); });
// Drop every older splhq-v* cache (WS7: phones were keeping one full copy of the app per version, 27 and counting).
self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (ks) { return Promise.all(ks.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); })); })
    .then(function () { return self.clients.claim(); }));
});
self.addEventListener("fetch", function (e) {
  var u = new URL(e.request.url);
  if (e.request.method !== "GET" || u.origin !== self.location.origin) return;
  e.respondWith(fetch(e.request).then(function (r) {
    var copy = r.clone(); caches.open(CACHE).then(function (c) { c.put(e.request, copy); }); return r;
  }).catch(function () { return caches.match(e.request); }));
});
