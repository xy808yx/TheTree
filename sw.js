// Offline app shell. Precaches the app CODE only — family data is read straight
// from disk via the File System Access API and photos via object URLs, so they
// never pass through here. Bump CACHE to ship updated code.
const CACHE = 'thetree-v2';
const ASSETS = [
  './', './index.html', './styles.css', './manifest.webmanifest', './icon.svg',
  './app/main.js', './app/dom.js', './app/store.js', './app/parse.js', './app/fsa.js', './app/sample-data.js',
  './app/views/tree.js', './app/views/person.js', './app/views/lessons.js', './app/views/query.js', './app/views/edit.js',
  './app/vendor/marked.esm.js', './app/vendor/js-yaml.js', './app/vendor/purify.es.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
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
