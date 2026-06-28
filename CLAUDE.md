# CLAUDE.md

Diese Datei gibt Claude Code (claude.ai/code) einen Überblick über das Repository
und Hinweise zum Arbeiten in diesem Projekt.

## Projektüberblick

**Gruppen-Spiele** ist eine werbefreie Sammlung von Party-Games als
**Progressive Web App (PWA)** — ohne App-Store, ohne Build-Schritt, ohne
Backend-Server (außer Firebase RTDB für den Echtzeit-Multiplayer).

- **Live:** https://hayvan2802.github.io/Gruppen-Spiele (GitHub Pages)
- **Sprache der Codebasis & UI:** Deutsch (UI zusätzlich mehrsprachig, siehe i18n)
- **Stack:** Vanilla JavaScript + Vue 3 (ESM-Browser-Build, lokal eingebunden),
  reines CSS, Firebase Realtime Database für Coop. **Kein** npm, **kein** Bundler,
  **kein** TypeScript.
- **Ausgeliefert wird statisch:** Die Dateien im Repo-Root werden 1:1 von GitHub
  Pages serviert. Was im Browser läuft, ist exakt das, was im Repo liegt.

### Enthaltene Spiele

| Spiel | Datei(en) | Modi |
|-------|-----------|------|
| 🕵️ **Imposter** | direkt in `js/app.js` | Lokal (1 Gerät) + Coop |
| 🧩 **Codenames** | `js/games/codenames.js`, `codenames-words.js` | Lokal + Coop |
| 🤔 **Wer bin ich?** | `js/games/werbinich.js`, `werbinich-words.js` | Lokal + Coop |

## Architektur

### Einstieg & Mount

- `index.html` lädt `./js/app.js` als ES-Modul (`<script type="module">`).
- `js/app.js` erstellt die Vue-App (`createApp(...)`) und mountet sie auf `#app`.
- Das **Template ist inline** in `app.js` als großer String definiert — es gibt
  **keine `.vue`-Single-File-Components**. UI-Zustand wird über
  `state.screen` (z.B. `'home'`, `'setup'`, `'reveal'`, `'timer'`, `'voting'`,
  `'result'`, `'wbi'`, `'cn'`) gesteuert; `<template v-if="state.screen === ...">`
  schaltet zwischen den Screens um.
- Imposter-Logik liegt **direkt in `app.js`**. Codenames und Wer-bin-ich sind in
  eigene Module unter `js/games/` ausgelagert und exportieren je einen
  reaktiven State (`cnState`, `wbiState`) plus Aktionsfunktionen, die `app.js`
  importiert und ins Template einbindet.

### Reaktivität

Globaler Zustand über Vues `reactive(...)`. Jedes Spielmodul hält seinen eigenen
`reactive`-State. Es gibt **keinen** zentralen Store (kein Vuex/Pinia).

### Multiplayer / Coop

- Transport: **Firebase Realtime Database** (anonyme Auth). Konfiguration und
  Lazy-Init in `js/firebase.js`.
- Raum-Abstraktion in `js/coop.js`: Struktur `/rooms/{6-stelliger-Code}/` mit
  `meta` + `players` + `events`. Spieler treten per Code bei; Events werden über
  RTDB-Listener verteilt.
- **iCloud Private Relay** blockiert teils WebSockets → Long-Polling-Fallback und
  20 s Timeout sind bewusst gesetzt (siehe Kommentare in `firebase.js`/`coop.js`).
  Beim Anfassen dieser Dateien diese Workarounds nicht versehentlich entfernen.

### Persistenz

`js/storage.js` kapselt `localStorage` (Keys mit Präfix `gs_`): Einstellungen,
zuletzt gesehene Version, letzte Spielernamen, gespeicherte Konfigurationen.
`js/debuglog.js` führt ein rein lokales Diagnoseprotokoll (Key `ww_debuglog`,
max. 400 Einträge, exportierbar) — enthält keine Spieldaten.

### Internationalisierung (i18n)

`js/i18n/index.js` exportiert `t()`, `setLocale()`, `detectLocale()` und
`SUPPORTED_LOCALES`. Pro Sprache eine Datei: `de, en, tr, fr, es, it, pl, ru, ar`
(`ar` ist RTL). Neue UI-Strings müssen in **allen** Sprachdateien ergänzt werden;
`de.js` ist die Referenz.

### Service Worker / PWA

- `sw.js` cached die App-Shell (Liste `ASSETS`) für Offline-Betrieb.
- **Wichtig:** Kein automatisches `self.skipWaiting()` im `install` — Updates
  werden dem Nutzer per Banner angeboten, er entscheidet. Diese Strategie
  beibehalten.
- `manifest.json` definiert PWA-Metadaten und Icons.

## Verzeichnisstruktur

```
Gruppen-Spiele/
├── index.html              # Einstieg: Splash, Fehler-Overlay, lädt js/app.js
├── manifest.json           # PWA-Manifest
├── sw.js                   # Service Worker (App-Shell-Cache, Update-Banner)
├── css/
│   └── styles.css          # Gesamtes Styling (~1450 Zeilen, ein File)
├── js/
│   ├── app.js              # Vue-App + Imposter-Logik + Inline-Template (~2350 Z.)
│   ├── config.js           # Imposter-Wortkategorien, Konstanten, DEFAULT_SETTINGS
│   ├── buildinfo.js        # AUTO-GENERIERT: BUILD-Version + CHANGELOG
│   ├── storage.js          # localStorage-Wrapper
│   ├── debuglog.js         # lokales Diagnoseprotokoll
│   ├── coop.js             # Firebase-RTDB-Raum-Transport
│   ├── firebase.js         # Lazy Firebase-Init (anonyme Auth, RTDB)
│   ├── vue.esm-browser.prod.js   # Vue 3 (eingebunden, nicht editieren)
│   ├── games/
│   │   ├── codenames.js          # Codenames-Spiellogik + State
│   │   ├── codenames-words.js    # Codenames-Wortlisten (mehrsprachig)
│   │   ├── werbinich.js          # "Wer bin ich?"-Logik + State
│   │   └── werbinich-words.js    # "Wer bin ich?"-Kartendeck
│   ├── i18n/
│   │   ├── index.js              # t(), Locale-Handling, SUPPORTED_LOCALES
│   │   └── de|en|tr|fr|es|it|pl|ru|ar.js   # Übersetzungen
│   └── vendor/firebase/          # Eingebundene Firebase-SDK-Module
├── icons/                  # PWA-Icons + Spiel-Icons (icons/games/)
├── test.js                 # Node-Testfälle für Imposter-Logik (node test.js)
├── backups/v1.0.0/         # Snapshot vor größeren Umbauten
├── src/                    # ⚠️ LEGACY (alte v1.x-Imposter-Struktur, NICHT live)
└── README.md               # Nutzer-/Projektbeschreibung
```

> ⚠️ **`src/` ist veralteter Code** aus der ursprünglichen Single-Game-Version
> (zuletzt um v0.46 angefasst). Der **live ausgelieferte** Code liegt komplett
> unter `js/`. Änderungen am laufenden Spiel gehören nach `js/`, nicht nach `src/`.
> Die Projektstruktur-Tabelle in der README beschreibt noch die alte `src/`-Welt.

## Entwicklung

### Lokal ausführen

Kein Build nötig. Einfach einen statischen Server im Repo-Root starten, z.B.:

```bash
python3 -m http.server 8000
# dann http://localhost:8000 öffnen
```

Ein File-Open per `file://` funktioniert wegen ES-Modulen / Service Worker nicht
zuverlässig — immer über HTTP servieren.

### Tests

```bash
node test.js
```

`test.js` enthält eigenständige Testfälle (mit Mock-Spiellogik) für die
Imposter-Mechanik. Es ist **kein** Test-Framework eingebunden — reine
`assert`-Helfer im File. Bei Änderungen an der Imposter-Logik die Tests
aktualisieren bzw. ergänzen.

### Versionierung & Release

- `js/buildinfo.js` ist **auto-generiert** und trägt oben den Hinweis
  „nicht manuell bearbeiten". Es hält `BUILD` (Version) und das `CHANGELOG`.
- `sw.js` enthält die Cache-Version (`CACHE = 'gruppen-spiele-vX.YY'`) — diese
  muss bei einem Release **mit der Build-Version mitgezogen** werden, sonst
  bekommen Nutzer den neuen Code nicht.
- Commit-Konvention im Verlauf: `feat: …` für Features, `chore: v0.XX` /
  `chore: SW v0.XX` für Versions-/Service-Worker-Bumps.
- `.release-counter` hält einen Zählerstand für den Release-Prozess.

### Git-Workflow (verbindlich)

**Jede Änderung wird über einen Pull Request eingebracht und anschließend
gemergt** — niemals direkt auf `main` committen/pushen. Ablauf:

1. Auf einem Feature-Branch arbeiten und committen.
2. Branch pushen.
3. **Pull Request** gegen `main` erstellen.
4. Den PR **mergen** (Squash-Merge als Standard).

Das gilt auch für kleine Doku-Änderungen.

### Konventionen

- **Reines Vanilla-JS in ES-Modulen.** Keine neuen Build-Abhängigkeiten oder
  npm-Pakete einführen, ohne das mit dem Projektinhaber abzustimmen — das
  bewusste „kein Build"-Prinzip ist Teil des Projekts.
- Kommentare und UI-Texte auf **Deutsch**.
- Neue Assets, die offline verfügbar sein sollen, in die `ASSETS`-Liste in
  `sw.js` aufnehmen.
- Neue UI-Strings in **allen** `js/i18n/*.js`-Dateien pflegen.
