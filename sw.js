// MobiLoireConnect41 — Service Worker v11
// Cache App Shell pour chargement rapide + fonctionnement hors-ligne minimal
// v9 : force cache refresh apres correctifs Phase 2

const CACHE  = 'mlc41-transporteur-v19';
const ASSETS = ['/', '/index.html', '/style.css', '/js/app.js', '/manifest.json'];

self.addEventListener('install', (evt) => {
  self.skipWaiting(); // prend le controle immediatement
  evt.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS).catch(() => {}))
  );
});

self.addEventListener('activate', (evt) => {
  evt.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (evt) => {
  const url = new URL(evt.request.url);

  // OneSignal workers → reseau direct
  if (url.pathname.startsWith('/OneSignalSDKWorker') ||
      url.pathname.startsWith('/OneSignalSDKUpdaterWorker')) {
    return;
  }
  // Netlify Functions → jamais de cache
  if (url.pathname.startsWith('/.netlify/functions/')) {
    return;
  }
  // CDN / APIs externes → reseau direct
  if (url.origin !== self.location.origin) {
    return;
  }

  // Assets locaux → cache-first avec fallback reseau
  evt.respondWith(
    caches.match(evt.request).then(cached =>
      cached ||
      fetch(evt.request)
        .then(res => {
          if (res.ok && evt.request.method === 'GET') {
            const clone = res.clone();
            caches.open(CACHE).then(c => c.put(evt.request, clone));
          }
          return res;
        })
        .catch(() => caches.match('/index.html'))
    )
  );
});
