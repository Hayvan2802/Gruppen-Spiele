// Gruppen-Spiele Service Worker v0.62
// Kein self.skipWaiting() im install — Nutzer entscheidet per Banner.
const CACHE = 'gruppen-spiele-v0.62';
const ASSETS = [
  './index.html', './css/styles.css',
  './js/app.js', './js/buildinfo.js', './js/werwolf-embed.js',
  './js/games/werbinich.js', './js/games/werbinich-words.js',
  './js/games/codenames.js', './js/games/codenames-words.js', './js/config.js', './js/storage.js',
  './js/coop.js', './js/firebase.js', './js/debuglog.js',
  './js/i18n/index.js', './js/i18n/de.js', './js/i18n/en.js',
  './js/i18n/tr.js', './js/i18n/fr.js', './js/i18n/es.js',
  './js/i18n/it.js', './js/i18n/pl.js', './js/i18n/ru.js', './js/i18n/ar.js',
  './manifest.json', './icons/icon-192.png', './icons/icon-512.png',
  './icons/games/imposter.png', './icons/games/wbi.png',
  './icons/games/codenames.png', './icons/games/werwolf.png',
  './js/vendor/firebase/firebase-app.js',
  './js/vendor/firebase/firebase-auth.js',
  './js/vendor/firebase/firebase-database.js',
  // Werwolf-Unter-App: Kern-Assets vorab cachen, damit der erste Klick auf
  // Werwolf sofort lädt (kein langsames Nachladen eines zweiten Vue-Bundles).
  // Die Firebase-SDK-Module der Unter-App lädt der Network-First-Handler erst
  // bei Bedarf (Coop) nach.
  './werwolf/', './werwolf/index.html', './werwolf/manifest.json',
  './werwolf/css/styles.css', './werwolf/css/styles.shadow.css',
  './werwolf/js/vue.esm-browser.prod.js',
  './werwolf/js/app.js', './werwolf/js/config.js', './werwolf/js/storage.js',
  './werwolf/js/coop.js', './werwolf/js/firebase.js', './werwolf/js/debuglog.js',
  './werwolf/js/buildinfo.js', './werwolf/js/i18n/index.js',
  './werwolf/js/i18n/de.js', './werwolf/js/i18n/en.js', './werwolf/js/i18n/tr.js',
  './werwolf/js/i18n/fr.js', './werwolf/js/i18n/es.js', './werwolf/js/i18n/it.js',
  './werwolf/js/i18n/pl.js', './werwolf/js/i18n/ru.js', './werwolf/js/i18n/ar.js',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).catch(() => {}));
  // Kein skipWaiting — Nutzer entscheidet per Banner
});

// Nutzer hat "Aktualisieren" getippt
self.addEventListener('message', e => {
  if (e.data && e.data.type === 'skipWaiting')
  // EINMALIG v0.48: erzwingt Cache-Reset auf iOS
  self.skipWaiting();
  //
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
