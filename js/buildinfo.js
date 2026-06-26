// Auto-generiert — nicht manuell bearbeiten!
export const BUILD      = '0.28';
export const BUILD_HASH = 'wer-bin-ich';

export const CHANGELOG = [
  {
    version: '0.28',
    date: '26.06.2026',
    changes: [
      'Neues Spiel: 🤔 Wer bin ich? — sauber getrennt von Imposter',
      '300+ Karten in 11 Kategorien (Prominente, Sport, Film, Politik...)',
      'Ein-Gerät-Modus: Karte gegen Stirn halten',
      'Coop-Modus: jeder sieht seine Karte auf eigenem Handy',
      'Eigene Begriffe hinzufügen',
      'Kategorien auswählbar, einzel- und ausklappbar',
      'Einladungslink via ?wbi=CODE',
      '48 automatische Tests — alle grün',
    ],
  },
  {
    version: '0.28',
    date: '26.06.2026',
    changes: [
      'UI-Audit: alle fehlenden CSS-Klassen ergänzt',
      'Touch-Targets überall min. 44px (iOS Standard)',
      'Voting-Buttons, Karte, Timer, Setup komplett überarbeitet',
      'Coop-Screens: Name/Code-Input, Lobby-Liste, Buttons einheitlich',
      'Reveal-Karte: größer, klarer, besser klickbar',
    ],
  },
  {
    version: '0.28',
    date: '26.06.2026',
    changes: [
      'Phase 3b: Lobby-History — alle Runden der Session einsehbar',
      'Jede Runde zeigt Wort, Imposter, Stimmen und Ergebnis',
      'Gesamtpunktestand über alle Runden',
      'Button im Ergebnis-Screen — erscheint ab Runde 1',
    ],
  },
  {
    version: '0.28',
    date: '26.06.2026',
    changes: [
      'Phase 3a: Coop-Abstimmung — jeder stimmt auf eigenem Handy ab',
      'Host sendet VOTE_START → alle sehen Abstimmungs-Screen',
      'Stimmen per Firebase gesammelt → Host berechnet Ergebnis',
      'VOTE_RESULT an alle gesendet → Ergebnis-Screen auf allen Geräten',
      'Gäste sehen Wartescreen bis Host Abstimmung startet',
    ],
  },
  {
    version: '0.28',
    date: '26.06.2026',
    changes: [
      'Multiplayer Beitreten: Button jetzt groß und auffällig wie beim Host',
      'Code-Input: größere Schrift, zentriert, gleich wie beim Erstellen',
      'Button deaktiviert bis Name und 6-stelliger Code eingegeben',
    ],
  },
  {
    version: '0.28',
    date: '26.06.2026',
    changes: [
      'SW 1:1 wie Werwolf — keine Extras, kein getVersion MessageChannel',
      'buildinfo.js wieder in ASSETS — neuer SW liefert neue Version nach reload()',
      'Versionsanzeige nach Update jetzt immer korrekt',
    ],
  },
  {
    version: '0.28',
    date: '26.06.2026',
    changes: [
      'buildinfo.js komplett ungecacht — Version stimmt immer',
      'Update-Banner: zentriertes Modal statt Bottom-Sheet',
      'Whats-New: fadeIn Animation beim Aufploppen',
    ],
  },
  {
    version: '0.28',
    date: '26.06.2026',
    changes: [
      'Update-Polling: 60s → 30s',
      'Update-Banner nicht mehr durch Hintergrund-Klick schließbar',
      'Update-Banner: Protokoll-Export Button hinzugefügt',
      'Nur Später-Button schließt den Banner',
    ],
  },
  {
    version: '0.28',
    date: '26.06.2026',
    changes: [
      'Phase 1: 13 Kategorien mit 300+ Wörtern — ein-/ausklappbar',
      'Kategorien auswählen: Alle, Keine, oder beliebige Kombination',
      'Eigene Wörter hinzufügen und verwalten',
      'Runden-Modus: 1–10 Runden wählbar mit Punktestand',
      'Neon-Theme als viertes Theme',
      '40 automatische Tests — alle grün',
    ],
  },
  {
    version: '0.28',
    date: '26.06.2026',
    changes: [
      'buildinfo.js wird nie gecacht — Version stimmt immer nach Update',
      'Whats-New zeigt korrekte neue Version nach Aktualisierung',
    ],
  },
  {
    version: '0.28',
    date: '26.06.2026',
    changes: [
      'Update-Banner zeigt korrekte Version des neuen SW',
      'SW meldet eigene Version per MessageChannel zurück',
    ],
  },
  {
    version: '0.28',
    date: '26.06.2026',
    changes: [
      'Multiplayer Host: Zufallscode entfernt — Code selbst eintippen',
      'Raum erstellen Button groß und auffällig',
      'Button deaktiviert bis Name und 6-stelliger Code eingegeben',
    ],
  },
  {
    version: '0.28',
    date: '26.06.2026',
    changes: [
      'Toast-Nachricht korrekt sichtbar — z-index erhöht, über allen Ebenen',
      'Toast-Design verbessert',
    ],
  },
  {
    version: '0.28',
    date: '26.06.2026',
    changes: [
      'Versionsnummern korrigiert — Format 0.X statt 0.0.X',
      'Komplette Versionshistorie sauber neu aufgebaut',
    ],
  },
  {
    version: '0.14',
    date: '26.06.2026',
    changes: [
      'Crash behoben: reg nicht gefunden im setInterval',
      'Weiter-Button jetzt groß und deutlich sichtbar',
    ],
  },
  {
    version: '0.13',
    date: '26.06.2026',
    changes: [
      'SW-Registrierung 1:1 nach Werwolf-Pattern',
      'Update-Banner erscheint automatisch ohne Neustart',
      'promote()-Funktion mit korrektem SW-Controller-Check',
      'Update-Polling alle 60 Sekunden',
    ],
  },
  {
    version: '0.12',
    date: '26.06.2026',
    changes: [
      'Spielmenü: Timer pausiert sofort beim Öffnen',
      'Spielmenü: Einstellungen direkt erreichbar',
      'Imposter-Warnung: Text korrigiert',
    ],
  },
  {
    version: '0.11',
    date: '26.06.2026',
    changes: [
      'Karte antippen zum Aufdecken — komplett klickbar',
      'Timer: neues Design mit großem Ring und Spieler-Avataren',
      'Abstimmung: Vorauswahl + Bestätigungsbutton, große Felder',
      'Imposter frei wählbar 1–5, unabhängig von Spielerzahl',
    ],
  },
  {
    version: '0.10',
    date: '26.06.2026',
    changes: [
      'Cache-Fix: SW erzwingt sofortigen Cache-Reset',
      'Behebt dauerhaften state-Crash auf gecachten Geräten',
    ],
  },
  {
    version: '0.9',
    date: '26.06.2026',
    changes: [
      '30 automatische Tests — alle grün',
      'Tests: Rollenzuteilung, Abstimmung, Timer, Shuffle',
    ],
  },
  {
    version: '0.8',
    date: '26.06.2026',
    changes: [
      'Crash behoben: state vor Initialisierung',
      'SW-Block korrekt nach state-Definition verschoben',
    ],
  },
  {
    version: '0.7',
    date: '26.06.2026',
    changes: [
      'Fehler TIMER_SECONDS behoben',
      'Update-Banner als Bottom-Sheet auf allen Screens',
    ],
  },
  {
    version: '0.6',
    date: '26.06.2026',
    changes: [
      'Timer pausiert bei Pause, dynamisch nach Spieleranzahl (45s–120s)',
      'Sound bei 30s und 15s, Countdown ab 15s',
      'Imposter-Buttons: aktiver Zustand sichtbar',
      'Versionshistorie als eigene scrollbare Seite',
    ],
  },
  {
    version: '0.5',
    date: '26.06.2026',
    changes: [
      'Kompletter Neuaufbau nach Werwolf-Muster',
      'Vue 3, Firebase Coop-Modus, Einladungslink',
      'Dark / Light / Auto Theme, Splash Screen',
      'Service Worker, Offline-Support',
      'Spielernamen & Konfigurationen speichern',
    ],
  },
  {
    version: '0.4',
    date: '26.06.2026',
    changes: [
      'Auf Update prüfen Button in Einstellungen',
      'Seitwärts-Wischen auf iOS behoben',
    ],
  },
  {
    version: '0.3',
    date: '26.06.2026',
    changes: [
      'Ordnerstruktur neu nach Werwolf-Muster',
      'Service Worker, PWA Icon, Dark/Light/Auto Theme',
    ],
  },
  {
    version: '0.2',
    date: '26.06.2026',
    changes: [
      'Timer (45 Sekunden), weiße Ränder behoben, PWA Icon',
    ],
  },
  {
    version: '0.1',
    date: '26.06.2026',
    changes: [
      'Imposter Game — Erstveröffentlichung',
      '60+ Wörter in 7 Kategorien',
    ],
  },
];
