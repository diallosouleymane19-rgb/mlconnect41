// MobiLoireConnect41 — Service Worker v20
// Cache App Shell pour chargement rapide + fonctionnement hors-ligne minimal
// v20 : bump cache (fix distance auto / autocomplete v2)
//       + /api/* jamais intercepte (routes Next : /api/distance, /api/adresses/search)
//       + HTML en network-first pour ne plus servir un index.html perime

const CACHE  = 'mlc41-transporteur-v22';;
const ASSETS = ['/', '/index.html', '/style.css', '/js/app.js', '/js/autocomplete.js', '/manifest.json'];

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
  // Routes API Next.js (/api/distance, /api/adresses/search...) → jamais de cache
  if (url.pathname.startsWith('/api/')) {
    return;
  }
  // CDN / APIs externes → reseau direct
  if (url.origin !== self.location.origin) {
    return;
  }
  // Seules les requetes GET sont cachees/servies depuis le cache
  if (evt.request.method !== 'GET') {
    return;
  }

  // HTML / navigations → network-first (evite de servir un index.html perime
  // qui referencerait d'anciens JS versionnes), fallback cache hors-ligne
  const isHTML = evt.request.mode === 'navigate' ||
                 url.pathname === '/' || url.pathname.endsWith('.html');
  if (isHTML) {
    evt.respondWith(
      fetch(evt.request)
        .then(res => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE).then(c => c.put(evt.request, clone));
          }
          return res;
        })
        .catch(() => caches.match(evt.request).then(c => c || caches.match('/index.html')))
    );
    return;
  }

  // Autres assets locaux → cache-first avec fallback reseau
  evt.respondWith(
    caches.match(evt.request).then(cached =>
      cached ||
      fetch(evt.request)
        .then(res => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE).then(c => c.put(evt.request, clone));
          }
          return res;
        })
        .catch(() => caches.match('/index.html'))
    )
  );
});
