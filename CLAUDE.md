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
| 🐺 **Werwolf** | eigenständige Unter-App unter `js/games/werwolf/` | Lokal + Coop |

> **Werwolf-Integration:** Werwolf ist eine vollständige, eigenständige App
> (gleiche Architektur wie das Hauptprojekt) und liegt unter `js/games/werwolf/`.
> Sie wird **nahtlos eingebettet** statt als zweite Seite geladen:
> `js/werwolf-embed.js` mountet die Werwolf-App als **eigene Vue-Instanz in ein
> Shadow-DOM**-Element (`#ww-host` im Haupt-Template).
>
> - **Warum Shadow-DOM:** Beide Apps teilen ~187 gleichnamige CSS-Klassen
>   (`.btn`, `.screen`, `.top-bar` …). Das Shadow-DOM kapselt das Werwolf-CSS
>   komplett ab. Dafür gibt es eine generierte Variante
>   `js/games/werwolf/css/styles.shadow.css`, in der nur die 9 globalen Selektoren
>   (`:root`, `html`, `body`, `body.light` …) auf `.ww-root` umgeschrieben sind
>   (alle Klassen/Keyframes bleiben unverändert, da das Shadow-DOM sie isoliert).
> - **Nahtlos & schnell:** `state.screen='ww'` blendet den Host ein (kein Reload);
>   nach dem ersten Mounten bleibt die App im Speicher (`v-show`) → Wechsel
>   hin/zurück ist sofort. Werwolf wird zudem nach dem Laden im Hintergrund
>   vorgewärmt (`requestIdleCallback`).
> - **Zurück:** durchgängiger `←`-Button der Haupt-App (`.ww-back-btn`,
>   `closeWerwolf()`), wie bei den anderen Spielen.
> - **Anpassungen in `js/games/werwolf/js/app.js`:** `mountWerwolf(el)`/`setWwRoot(el)`
>   exportiert; Theme-Klasse und Toasts gehen auf `wwRoot` (das `.ww-root` im
>   Shadow) statt `document.body`. Auto-Mount nur noch standalone
>   (`if (!window.__WW_EMBEDDED__)`), sodass `/js/games/werwolf/` als Seite weiter
>   funktioniert. Eigener Service Worker bleibt **deaktiviert**
>   (`WW_REGISTER_OWN_SW = false`). localStorage kollidiert nicht
>   (`gs_`- vs. `ww_`-Präfix).

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
│   │   ├── werbinich-words.js    # "Wer bin ich?"-Kartendeck
│   │   └── werwolf/              # 🐺 Eigenständige Werwolf-Unter-App (eigenes
│   │                             #    index.html, js/, css/ — relative Pfade)
│   ├── i18n/
│   │   ├── index.js              # t(), Locale-Handling, SUPPORTED_LOCALES
│   │   └── de|en|tr|fr|es|it|pl|ru|ar.js   # Übersetzungen
│   └── vendor/firebase/          # Eingebundene Firebase-SDK-Module
├── icons/                  # PWA-Icons + Spiel-Icons (icons/games/)
├── scripts/
│   └── build.js            # Release-Skript (node scripts/build.js)
├── test/
│   └── unit/
│       └── imposter.test.js  # Node-Testfälle für Imposter-Logik
├── .github/
│   └── workflows/
│       └── test.yml        # CI: Unit-Tests bei jedem PR/Push
├── .gitignore              # .DS_Store, Thumbs.db, *.log, node_modules/
├── package.json            # npm-Skripte: test, build
├── changes.txt             # Changelog-Quelle für den nächsten Release
├── backups/v1.0.0/         # Snapshot vor größeren Umbauten
├── src/                    # ⚠️ LEGACY (alte v1.x-Imposter-Struktur, NICHT live)
└── README.md               # Nutzer-/Projektbeschreibung
```

> ⚠️ **`src/` ist veralteter Code** aus der ursprünglichen Single-Game-Version
> (zuletzt um v0.46 angefasst). Der **live ausgelieferte** Code liegt komplett
> unter `js/`. Änderungen am laufenden Spiel gehören nach `js/`, nicht nach `src/`.
> Die Projektstruktur-Tabelle in der README beschreibt noch die alte `src/`-Welt.

## Befehle

```bash
python3 -m http.server 8000   # lokaler Dev-Server (dann http://localhost:8000)
npm test                       # Unit-Tests (node:test)
node scripts/build.mjs         # Release schneiden (Version bumpen, buildinfo.js + sw.js generieren)
node scripts/build.mjs --major # Major-Version bumpen
```

## Ablauf bei jeder Code-Änderung

1. **Implementieren** — Code ändern, eine user-facing Zeile in `changes.txt` eintragen, `npm test` lokal laufen lassen.

2. **PR + Auto-Merge** — Nach dem Push sofort automatisch einen PR erstellen, ohne darauf zu warten, gefragt zu werden. Direkt nach `mcp__github__create_pull_request` die Funktion `mcp__github__enable_pr_auto_merge` (Squash) aufrufen — noch bevor CI startet. Das überschreibt das Standard-Verhalten „PR nur auf ausdrückliche Anfrage erstellen". Falls `enable_pr_auto_merge` wegen Rate-Limit fehlschlägt: direkt `mcp__github__merge_pull_request` (squash) aufrufen.

3. **Auf CI warten** — Der PR merged automatisch, sobald alle Checks grün sind.

4. **Release schneiden** — Direkt nach jedem gemergten Feature-PR automatisch einen Release schneiden, ohne darauf zu warten, gefragt zu werden: `main` pullen → Branch `release/vX.Y` erstellen → `node scripts/build.mjs` ausführen → committen & pushen → PR erstellen → `mcp__github__enable_pr_auto_merge` (Squash) aufrufen. GitHub Pages deployt danach automatisch.

## Entwicklung

### Lokal ausführen

Kein Build nötig. Einen statischen Server im Repo-Root starten:

```bash
python3 -m http.server 8000
# dann http://localhost:8000 öffnen
```

Ein File-Open per `file://` funktioniert wegen ES-Modulen / Service Worker nicht
zuverlässig — immer über HTTP servieren.

### Tests

```bash
npm test
# oder direkt:
node --test test/unit/*.test.js
```

`test/unit/imposter.test.js` nutzt den nativen `node:test`-Runner (Node ≥ 18).
Tests sind nach `describe`-Blöcken gegliedert (Rollenzuteilung, Abstimmung, Timer …).
Bei Änderungen an der Imposter-Logik die Tests aktualisieren bzw. ergänzen.

### Versionierung & Release

**Single Source of Truth:** `.release-counter` hält die aktuelle Version
im Format `Major.Minor`. Minor wird pro Release um 1 erhöht; Major nur auf
ausdrückliche Anweisung (`node scripts/build.mjs --major`).

**Generierte Dateien — niemals manuell editieren:**
- `js/buildinfo.js` — Version, Datum, Changelog-Array
- `sw.js` (Cache-String) — wird von `build.mjs` mitgepflegt

**`changes.txt`** ist die Changelog-Quelle (eine Zeile pro Änderung, `#`
startet Kommentare). `node scripts/build.mjs` liest sie, schreibt den Eintrag in
`buildinfo.js` und leert sie danach.

### Konventionen

- **Reines Vanilla-JS in ES-Modulen.** Keine neuen Build-Abhängigkeiten oder
  npm-Pakete einführen, ohne das mit dem Projektinhaber abzustimmen — das
  bewusste „kein Build"-Prinzip ist Teil des Projekts.
- Kommentare und UI-Texte auf **Deutsch**.
- Neue Assets, die offline verfügbar sein sollen, in die `ASSETS`-Liste in
  `sw.js` aufnehmen.
- Neue UI-Strings in **allen** `js/i18n/*.js`-Dateien pflegen.

### Git-Autor

Vor dem ersten Commit in jeder Session immer setzen:

```bash
git config user.email "noreply@anthropic.com"
git config user.name "Claude"
```

### Changelog-Regeln

- Niemals in `changes.txt` oder Commit-Messages erwähnen, dass Ideen aus
  externen Repos stammen.
- Einträge in `changes.txt` sind kurze, **user-facing** Sätze auf Deutsch —
  kein technisches Jargon, keine Dateinamen.

### Häufige Probleme & Lösungen

| Problem | Lösung |
|---------|--------|
| Stop-Hook „Unverified commits" | `git config user.email "noreply@anthropic.com"` setzen, neuen Commit erstellen |
| Stop-Hook „uncommitted changes" | `git restore .release-counter` (Artefakt vom Build-Skript) |
| `enable_pr_auto_merge` Rate-Limit | `mcp__github__merge_pull_request` (squash) direkt aufrufen |
| Nutzer sieht alte Version | Service Worker cached alte Shell → Einstellungen → „🔄 Prüfen", oder Browser-Speicher löschen |
| Rebase-Konflikt bei altem Feature-Branch | Diff sichern → Branch auf Remote-Stand zurücksetzen → Diff manuell anwenden |
