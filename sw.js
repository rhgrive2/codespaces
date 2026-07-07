/* Service worker for Sundai ID Viewer PWA.
   Shell (same-origin) is cached for offline / instant load with a
   stale-while-revalidate strategy. Cross-origin requests (the streaks.jp
   player iframe) always go straight to the network. */
const VERSION = 'v1';
const CACHE = `sundai-id-viewer-${VERSION}`;
const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/favicon-64.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/maskable-512.png',
  './icons/apple-touch-icon.png',
  './icons/icon.svg'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      // addAll fails atomically if any file 404s; add individually so a
      // single missing asset can't break the whole install.
      .then(cache => Promise.all(SHELL.map(url =>
        cache.add(new Request(url, { cache: 'reload' })).catch(() => null))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', event => {
  if (event.data === 'skipWaiting') self.skipWaiting();
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  // Only manage our own origin/scope. Let the external player and any other
  // cross-origin request pass through untouched.
  if (url.origin !== self.location.origin) return;

  // Navigations: serve cached shell first, fall back to network, then to
  // the cached index.html so the app opens offline.
  if (req.mode === 'navigate') {
    event.respondWith(
      caches.match(req).then(hit => hit ||
        fetch(req).catch(() => caches.match('./index.html')))
    );
    return;
  }

  // Stale-while-revalidate for same-origin assets.
  event.respondWith(
    caches.match(req).then(hit => {
      const network = fetch(req).then(res => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy));
        }
        return res;
      }).catch(() => hit);
      return hit || network;
    })
  );
});
