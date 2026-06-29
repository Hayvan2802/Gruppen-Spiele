# 🎮 Gruppen-Spiele

> Kostenlose Party Games für Gruppen – ohne Werbung, ohne App-Store.

**Live spielen:** [hayvan2802.github.io/Gruppen-Spiele](https://hayvan2802.github.io/Gruppen-Spiele)

---

## 🕹 Spiele

| Spiel | Status | Spieler | Modi |
|-------|--------|---------|------|
| 🕵️ Imposter | ✅ Live | 3–12 | Lokal + Coop |
| 🧩 Codenames | ✅ Live | 4+ | Lokal + Coop |
| 🤔 Wer bin ich? | ✅ Live | 2+ | Lokal + Coop |

---

## 📁 Projektstruktur

```
Gruppen-Spiele/
├── index.html              # Einstiegspunkt & Splash
├── manifest.json           # PWA-Manifest
├── sw.js                   # Service Worker (Offline-Cache, Update-Banner)
├── css/
│   └── styles.css          # Gesamtes Styling
├── icons/                  # PWA-Icons & Spiel-Icons
│   ├── icon-192.png
│   ├── icon-512.png
│   └── games/
│       ├── imposter.png
│       ├── codenames.png
│       └── wbi.png
└── js/
    ├── app.js              # Vue-App, Imposter-Logik & Inline-Template
    ├── config.js           # Kategorien, Konstanten, Standard-Einstellungen
    ├── buildinfo.js        # Version & Changelog (auto-generiert)
    ├── storage.js          # localStorage-Wrapper
    ├── debuglog.js         # Lokales Diagnoseprotokoll
    ├── coop.js             # Firebase RTDB Raum-Transport
    ├── firebase.js         # Firebase Lazy-Init (anonyme Auth)
    ├── vue.esm-browser.prod.js
    ├── games/
    │   ├── codenames.js        # Codenames-Logik & State
    │   ├── codenames-words.js  # Codenames-Wortlisten (mehrsprachig)
    │   ├── werbinich.js        # "Wer bin ich?"-Logik & State
    │   └── werbinich-words.js  # "Wer bin ich?"-Kartendeck
    ├── i18n/
    │   ├── index.js            # t(), Locale-Handling
    │   └── de|en|tr|fr|es|it|pl|ru|ar.js
    └── vendor/firebase/        # Eingebundene Firebase-SDK-Module
```

---

## 🚀 Versionen

| Version | Datum | Was ist neu |
|---------|-------|-------------|
| v0.59 | 27.06.2026 | Codenames: Startteam zufällig (wie beim Original) |
| v0.58 | 27.06.2026 | Codenames Kernlogik neu, Coop Rollenvergabe |
| v1.0.0 | 23.06.2026 | Erstveröffentlichung – Imposter |

---

## 💡 Geplante Features

- [ ] Mafia / Werwolf
- [ ] Eigene Wörter hinzufügen
- [ ] Spieler-Statistiken
- [ ] Sound-Effekte

---

*Entwickelt mit Claude – Anthropic AI*
