// Offline app shell for the hosted editor. The whole app is inlined into one
// index.html now, so there's almost nothing to precache: the page itself, the PWA
// bits, and the gazetteer (vendor/cities.js) that the editor lazy-loads to look up
// place coordinates. Family data never passes through here — it lives inside the
// family.html the user keeps. CACHE is auto-stamped by build.js with a content hash,
// so every change ships a fresh cache (no stale-page serving) — don't edit it by hand.
const CACHE = 'thetree-969911c52b';
const ASSETS = [
  './', './index.html', './manifest.webmanifest', './icon.svg',
  './app/vendor/cities.js',
];

self.addEventListener('install', (e) => {
  // cache:'reload' so a freshly bumped SW never re-caches a stale HTTP response.
  e.waitUntil(caches.open(CACHE)
    .then((c) => c.addAll(ASSETS.map((u) => new Request(u, { cache: 'reload' }))))
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith(
    caches.match(e.request).then((hit) => hit || fetch(e.request).then((res) => {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {});
      return res;
    }).catch(() => caches.match('./index.html')))
  );
});
