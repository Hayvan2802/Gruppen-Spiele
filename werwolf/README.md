# 🐺 Werwolf

Ein kostenloses, werbefreies Werwolf-Partyspiel für den Browser.

🌐 **Live:** https://hayvan2802.github.io/Werwolf

☕ **Unterstützen:** https://ko-fi.com/hayvan

## Features
- 21 Rollen: 6 Standard + 15 Extra
- Dark Mode & Light Mode  
- 9 Sprachen: DE, EN, TR, FR, ES, IT, PL, RU, AR
- Coop-Modus via Firebase Realtime Database
- PWA / Safari Homescreen-Icon
- Update-Banner (SW-basiert, exakt wie tomanderss/coop-number-sums)

## Architektur (nach coop-number-sums)
```
Werwolf/
├── index.html               # Minimal: Splash, #app, Fehler-Overlay, <script type="module">
├── sw.js                    # Service Worker (kein skipWaiting@install!)
├── manifest.json            # PWA
├── database.rules.json      # Firebase RTDB Rules
├── .release-counter         # Versionszähler für build.js
├── changes.txt              # Änderungen für nächsten Build
├── css/
│   └── styles.css           # Extern (kein inline CSS)
├── js/
│   ├── app.js               # Vue 3 Hauptapp
│   ├── buildinfo.js         # Auto-generiert von build.js
│   ├── config.js            # Rollen, Konstanten
│   ├── coop.js              # Firebase Transport
│   ├── firebase.js          # Lazy Firebase Init
│   ├── debuglog.js          # Diagnoseprotokoll
│   ├── storage.js           # localStorage
│   ├── i18n/                # Übersetzungen
│   │   ├── index.js
│   │   ├── de.js, en.js, tr.js, fr.js, es.js, it.js, pl.js, ru.js, ar.js
│   └── vendor/
│       ├── vue.esm-browser.prod.js
│       └── firebase/
│           ├── firebase-app.js
│           ├── firebase-auth.js
│           └── firebase-database.js
├── icons/
│   ├── icon-192.png
│   └── icon-512.png
└── backups/                 # Versionsschnappschüsse
```

## Deploy
Jeder Deploy braucht nur eine Zeile in `sw.js`:
```js
const CACHE = 'werwolf-v0.09'; // ← erhöhen
```
Dann auch `BUILD` in `js/buildinfo.js` + `CHANGELOG` updaten.
