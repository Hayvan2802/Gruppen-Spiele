// Gruppen-Spiele Service Worker v0.28
// Kein self.skipWaiting() im install — Nutzer entscheidet per Banner.
const CACHE = 'gruppen-spiele-v0.28';
const ASSETS = [
  './index.html', './css/styles.css',
  './js/app.js', './js/buildinfo.js',
  './js/games/werbinich.js', './js/games/werbinich-words.js', './js/config.js', './js/storage.js',
  './js/coop.js', './js/firebase.js', './js/debuglog.js',
  './js/i18n/index.js', './js/i18n/de.js', './js/i18n/en.js',
  './js/i18n/tr.js', './js/i18n/fr.js', './js/i18n/es.js',
  './js/i18n/it.js', './js/i18n/pl.js', './js/i18n/ru.js', './js/i18n/ar.js',
  './manifest.json', './icons/icon-192.png', './icons/icon-512.png',
  './js/vendor/firebase/firebase-app.js',
  './js/vendor/firebase/firebase-auth.js',
  './js/vendor/firebase/firebase-database.js',
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
