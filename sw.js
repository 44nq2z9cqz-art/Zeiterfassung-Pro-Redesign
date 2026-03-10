const CACHE = 'zeiterfassung-v2';
const ASSETS = [
  './', './index.html', './manifest.json',
  './style.css',
  'feiertage.js', 'data.js', 'timer.js',
  'calendar.js', 'zeitkonto.js', 'settings.js', 'app.js',
  'icon-192.png', 'icon-512.png'
];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(
    ks.filter(k => k !== CACHE).map(k => caches.delete(k))
  )));
  self.clients.claim();
});
self.addEventListener('fetch', e => {
  e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)));
});
