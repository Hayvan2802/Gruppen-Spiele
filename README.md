# 🎮 Gruppen-Spiele

> Kostenlose Party Games für Gruppen – ohne Werbung, ohne App-Store.

**Live spielen:** [hayvan2802.github.io/Gruppen-Spiele](https://hayvan2802.github.io/Gruppen-Spiele)

---

## 🕹 Spiele

| Spiel | Spieler | Modi |
|-------|---------|------|
| 🕵️ Imposter | 3–12 | Lokal + Coop |
| 🧩 Codenames | 4+ | Lokal + Coop |
| 🤔 Wer bin ich? | 2+ | Lokal + Coop |
| 🐺 Werwolf | 4+ | Lokal + Coop |

---

## 📁 Projektstruktur

```
Gruppen-Spiele/
├── index.html              # Einstiegspunkt & Splash
├── manifest.json           # PWA-Manifest
├── sw.js                   # Service Worker (Offline-Cache, Update-Banner)
├── database.rules.json     # Firebase RTDB Security Rules
├── playwright.config.js    # Playwright E2E-Test-Konfiguration
├── css/
│   └── styles.css          # Gesamtes Styling
├── icons/                  # PWA-Icons & Spiel-Icons
├── js/
│   ├── app.js              # Vue-App, Imposter-Logik & Inline-Template
│   ├── config.js           # Kategorien, Konstanten, Einstellungen
│   ├── buildinfo.js        # Version & Changelog (auto-generiert)
│   ├── storage.js          # localStorage-Wrapper
│   ├── debuglog.js         # Lokales Diagnoseprotokoll
│   ├── coop.js             # Firebase RTDB Raum-Transport
│   ├── firebase.js         # Firebase Lazy-Init (anonyme Auth)
│   ├── werwolf-embed.js    # Werwolf als Shadow-DOM-Embed
│   ├── games/
│   │   ├── codenames.js        # Codenames-Logik & State
│   │   ├── codenames-words.js  # Codenames-Wortlisten (mehrsprachig)
│   │   ├── werbinich.js        # "Wer bin ich?"-Logik & State
│   │   ├── werbinich-words.js  # "Wer bin ich?"-Kartendeck
│   │   └── werwolf/            # 🐺 Eigenständige Werwolf-Unter-App (Shadow DOM)
│   ├── i18n/
│   │   ├── index.js            # t(), Locale-Handling, SUPPORTED_LOCALES
│   │   └── de|en|tr|fr|es|it|pl|ru|ar.js
│   └── vendor/firebase/        # Eingebundene Firebase-SDK-Module
├── werwolf/                # Weiterleitung → js/games/werwolf/ (alter URL-Alias)
├── scripts/
│   └── build.mjs           # Release-Skript (Version bumpen, buildinfo.js + sw.js)
└── test/
    ├── unit/
    │   └── imposter.test.js    # Node:test Unit-Tests
    └── e2e/
        ├── helpers.js          # waitForApp()-Helper
        ├── app.spec.js         # Navigation & Spielauswahl
        ├── imposter.spec.js    # Imposter E2E-Tests
        ├── codenames.spec.js   # Codenames E2E-Tests
        ├── werbinich.spec.js   # Wer bin ich? E2E-Tests
        └── werwolf.spec.js     # Werwolf E2E-Tests
```

---

## 🛠 Entwicklung

```bash
# Lokaler Dev-Server (kein Build nötig)
python3 -m http.server 8000
# dann http://localhost:8000 öffnen

# Unit-Tests
npm run test:unit

# E2E-Tests (Playwright)
npm run test:e2e

# Alle Tests
npm test

# Release schneiden
node scripts/build.mjs
```

---

## 🔧 Tech-Stack

- **Frontend:** Vanilla JavaScript + Vue 3 (ESM-Browser-Build)
- **Kein Build-Schritt** — statische Dateien direkt von GitHub Pages
- **Multiplayer:** Firebase Realtime Database (anonyme Auth)
- **Tests:** Node:test (Unit) + Playwright (E2E)
- **CI:** GitHub Actions (Unit + E2E bei jedem PR)

---

*Entwickelt mit Claude – Anthropic AI*
