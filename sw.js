// SW-RESET: löscht alle alten Caches und verwendet kein Caching mehr
self.addEventListener('install', e => {
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(ks => Promise.all(ks.map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Network only — kein Cache
self.addEventListener('fetch', e => {
  e.respondWith(fetch(e.request));
});
