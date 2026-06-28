# Changelog — Werwolf

## v0.08 — Kompletter Neuaufbau nach coop-number-sums Architektur
- Multi-File-Struktur: index.html + css/ + js/ (app.js, config.js, coop.js, firebase.js, storage.js, debuglog.js, i18n/)
- Vue 3 Composition API (esm-browser, kein Build-Schritt nötig)
- Service Worker exakt nach Referenz: kein auto-skipWaiting, Update-Banner via state.updateReady
- Firebase Vendor Files lokal (js/vendor/firebase/) wie im Referenz-Repo
- Ko-fi Spenden-Button (☕) mit pulsierendem Herz auf dem Startbildschirm
- Firebase Realtime Database für Coop (6-stelliger Zahlencode, Rules in database.rules.json)
- Coop: Host erstellt Raum, Spieler treten bei, jeder sieht seine Rolle auf eigenem Gerät
- 9 Sprachen: DE, EN, TR, FR, ES, IT, PL, RU, AR
- Dark Mode & Light Mode
- 21 Rollen: 6 Standard + 15 Extra
- Versionshistorie in Einstellungen
- Fehler-Overlay (window.onerror) wie im Referenz-Repo
- Splash-Screen mit App-Icon und Version

## v0.07 — SW Update-System nach Referenz-Pattern
## v0.06 — Firebase Coop-Modus
## v0.05 — Update-System überarbeitet
## v0.04 — Coop-Grundlage & Update-Modal
## v0.03 — Einstellungen, Sprachen & Versionssystem
## v0.02 — Namen, Pflichtauswahl & Spielverlauf
## v0.01 — Erstes Release
