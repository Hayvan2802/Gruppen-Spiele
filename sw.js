// Gruppen-Spiele Service Worker v1.0.0
// Kein self.skipWaiting() im install — neuer SW wartet bis Nutzer
// aktiv auf "Aktualisieren & neu starten" tippt (exakt wie Werwolf-App).
const CACHE = 'gruppen-spiele-v1.0.1';
const ASSETS = [
  './index.html',
  './css/styles.css',
  './js/app.js',
  './js/buildinfo.js',
  './js/config.js',
  './js/storage.js',
  './js/debuglog.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).catch(() => {}));
  // Bewusst KEIN self.skipWaiting() — Nutzer entscheidet per Banner.
});

// Nutzer hat "Aktualisieren" getippt
self.addEventListener('message', e => {
  if (e.data && e.data.type === 'skipWaiting') self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
  ));
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  if (e.request.url.includes('/icons/')) {
    e.respondWith(caches.match(e.request).then(c => c || fetch(e.request)));
    return;
  }
  e.respondWith(
    fetch(e.request).then(res => {
      const clone = res.clone();
      caches.open(CACHE).then(cache => cache.put(e.request, clone));
      return res;
    }).catch(() => caches.match(e.request))
  );
});
