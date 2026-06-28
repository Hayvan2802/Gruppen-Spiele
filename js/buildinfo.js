// Auto-generiert — nicht manuell bearbeiten!
export const BUILD      = '0.68';
export const BUILD_HASH = 'cnselectmode-im-vue-setu';

export const CHANGELOG = [
  {
    version: '0.68',
    date: '28.06.2026',
    changes: [
    'Codenames: Modus-Auswahl (Multiplayer/Ein Gerät) reagiert nun korrekt',
    ],
  },
{
    version: '0.67',
    date: '28.06.2026',
    changes: [
    'Codenames: Singleplayer/Multiplayer-Auswahl wie bei den anderen Spielen strukturiert',
    'Codenames: Sprachauswahl (DE/EN/TR/FR/ES) direkt im lokalen Setup sichtbar',
    'Werwolf: Anleitung-Button auf der Startseite und im Spielmenü ergänzt',
    ],
  },
{
    version: '0.66',
    date: '28.06.2026',
    changes: [
    'Codenames: Singleplayer/Multiplayer-Auswahl wie bei allen anderen Spielen',
    'Codenames: Bug behoben — Startteam war immer Rot (jetzt zufällig wie gewollt)',
    ],
  },
{
    version: '0.65',
    date: '28.06.2026',
    changes: [
      'Werwolf: Design vereinheitlicht — gleiche Farben & Schrift wie alle anderen Spiele',
      'Keine Google Fonts mehr — Werwolf lädt jetzt ohne externen Font-Request',
    ],
  },
  {
    version: '0.64',
    date: '28.06.2026',
    changes: [
      'Eigene Firebase-Datenbank (gruppen-spiele) — kein fremder API-Key mehr',
    ],
  },
  {
    version: '0.63',
    date: '28.06.2026',
    changes: [
      'Zurück-Pfeil (←) jetzt bei allen Spielen einheitlich oben links',
    ],
  },
  {
    version: '0.62',
    date: '28.06.2026',
    changes: [
      'Werwolf öffnet jetzt nahtlos wie die anderen Spiele — ohne Neuladen',
      'Durchgängiger Zurück-Pfeil (←) oben, sofortiger Wechsel hin und zurück',
      'Werwolf wird im Hintergrund vorgeladen → kein Warten beim ersten Klick',
    ],
  },
  {
    version: '0.61',
    date: '28.06.2026',
    changes: [
      'Werwolf öffnet direkt die Auswahl — kein eigener Splashscreen mehr',
      'Werwolf lädt schneller (Kern-Assets werden vorab gecacht)',
      'Versionsanzeige & Update-Prüfung nur noch zentral in Gruppen-Spiele',
    ],
  },
  {
    version: '0.60',
    date: '28.06.2026',
    changes: [
      'Neues Spiel: Werwolf ist jetzt direkt in Gruppen-Spiele integriert',
      'Über die Spielauswahl startet Werwolf als nahtlose Unter-App',
      'Zurück zu Gruppen-Spiele per 🎮-Button im Werwolf-Menü',
    ],
  },
  {
    version: '0.59',
    date: '27.06.2026',
    changes: [
      'Codenames: Startteam zufällig — wie beim Original (9 Karten = startet)',
      'Manchmal fängt Rot an, manchmal Blau — per Zufall',
    ],
  },
  {
    version: '0.58',
    date: '27.06.2026',
    changes: [
      'Codenames Kernlogik neu geschrieben — graue Punkte behoben',
      'Codenames Coop: Host verteilt Rollen an alle Spieler',
      'Operative sehen Karten-Typ erst nach Aufdecken',
      'Spymaster sieht alle Farben auf eigenem Handy',
      'Schwarze Karte, Züge, Gewinnbedingungen korrekt implementiert',
      'Private Relay Fehlermeldung verbessert',
    ],
  },
  {
    version: '0.57',
    date: '27.06.2026',
    changes: [
      'Codenames: Beitreten-Button wieder sichtbar',
      'Alle Spiele: Host + Beitreten Buttons einheitlich groß',
      'iCloud Private Relay Fix: Timeout 20s, Long Polling Fallback',
    ],
  },
  {
    version: '0.56',
    date: '27.06.2026',
    changes: [
      'Codenames: Sprachen aus Setup entfernt (kommen in Einstellungen)',
      'Codenames: Einstellungs-Button nur im Setup, im Spiel nur Pause',
      'Codenames: Spymaster-Sicht ein/ausklappbar mit Geheimkarten-Farben',
      'Codenames: Karten-Farben korrekt — rot/blau/schwarz/neutral',
      'Codenames: Zug weitergeben Button verbessert',
    ],
  },
  {
    version: '0.55',
    date: '27.06.2026',
    changes: [
      'Codenames schwarzer Screen endgültig behoben — alle CN-Funktionen im return',
    ],
  },
  {
    version: '0.54',
    date: '27.06.2026',
    changes: [
      'Cache-Reset: erzwingt sofortiges Update auf iOS (v0.52 → v0.54)',
    ],
  },
  {
    version: '0.53',
    date: '27.06.2026',
    changes: [
      'Codenames: Objekt-Literal in v-for entfernt — Safari-Bug behoben',
      'Sprach-Buttons jetzt als einzelne Buttons statt v-for mit Objekt',
    ],
  },
  {
    version: '0.52',
    date: '27.06.2026',
    changes: [
      'Codenames: schwarzer Screen behoben — /\\D/g Safari-Escape-Fix',
      'replace(/[^0-9]/g) statt /\\D/g in Vue-Templates',
    ],
  },
  {
    version: '0.51',
    date: '27.06.2026',
    changes: [
      'Crash behoben: doppeltes async checkForUpdate + applyUpdate entfernt',
      '6 automatische Syntax-Tests: Duplikate, loses async, imports, if-Blöcke',
    ],
  },
  {
    version: '0.50',
    date: '27.06.2026',
    changes: [
      'Crash behoben: applyUpdate und checkForUpdate doppelt definiert',
    ],
  },
  {
    version: '0.49',
    date: '27.06.2026',
    changes: [
      'SW dauerhaft gefixt — top-level wie Werwolf, kein function wrapper',
      'Update-Banner erscheint jetzt zuverlässig auf iOS',
      'app.js Duplikat bereinigt, applyUpdate korrekt definiert',
    ],
  },
  {
    version: '0.48',
    date: '27.06.2026',
    changes: [
      'Cache-Reset: erzwingt sofortiges Update auf iOS',
    ],
  },
  {
    version: '0.47',
    date: '27.06.2026',
    changes: [
      'Codenames: Safari-SyntaxError behoben — if ohne {} vor push({})',
    ],
  },
  {
    version: '0.46',
    date: '27.06.2026',
    changes: [
      'Codenames: Blank-Screen-Fix — CN-Funktionen im setup() return ergänzt',
    ],
  },
  {
    version: '0.45',
    date: '27.06.2026',
    changes: [
      'Neues Spiel: Codenames — 5×5 Grid, 2 Teams, Spymaster auf eigenem Handy',
      'Coop-Pflicht: Spymaster sieht geheime Karte nur bei sich',
      'Sprachen: DE, EN, TR, FR, ES',
      'Codenames-Icon, Anleitung im Hauptmenü',
    ],
  },
  {
    version: '0.44',
    date: '27.06.2026',
    changes: [
      'SW-Fix: MessageChannel entfernt — Banner erscheint jetzt korrekt',
      'registerSW() bereinigt — exakt nach Werwolf-Muster',
      'iOS Cache-Reset erzwungen',
    ],
  },
  {
    version: '0.43',
    date: '27.06.2026',
    changes: [
      'Versionshistorie bereinigt — keine Duplikate mehr',
      'Fehlende Version 0.41 nachgetragen',
    ],
  },
  {
    version: '0.42',
    date: '27.06.2026',
    changes: [
      'Neues App-Icon — Gamepad-Design mit Gruppen-Spiele Branding',
      'Imposter-Icon — Astronauten-Figur mit Visier',
      'Wer bin ich?-Icon — Spielkarte mit verdecktem Gesicht',
      'Icons im Hauptmenü und Anleitungs-Modals',
    ],
  },
  {
    version: '0.41',
    date: '27.06.2026',
    changes: [
      'Versionshistorie bereinigt',
      'Englische Übersetzung auf Gruppen-Spiele angepasst',
      'Rechtschreibung Deutsch korrigiert',
    ],
  },
  {
    version: '0.40',
    date: '27.06.2026',
    changes: [
      'WBI: Text korrigiert — Spieler hält Handy zur Gruppe',
      'Hauptmenü: Extra-Buttons entfernt',
      'Anleitungs-Button auf jeder Spielkarte',
      'Anleitung auch im Spielmenü erreichbar',
    ],
  },
  {
    version: '0.39',
    date: '27.06.2026',
    changes: [
      'Imposter: doppeltes Pause-Menü behoben',
    ],
  },
  {
    version: '0.38',
    date: '27.06.2026',
    changes: [
      'WBI: Zurück-Pfeil nur im Setup sichtbar',
      'WBI: Pause-Button während dem Spiel wie bei Imposter',
      'WBI: Spielmenü mit Fortsetzen, Einstellungen, Spiel beenden',
    ],
  },
  {
    version: '0.37',
    date: '27.06.2026',
    changes: [
      'WBI: Weiter-Button funktioniert jetzt — wbiNextCard im return ergänzt',
    ],
  },
  {
    version: '0.36',
    date: '27.06.2026',
    changes: [
      'WBI: Weiter-Button erst nach Aufdecken und Schließen sichtbar',
      'Update-Banner: Button lila wie Los geht\'s',
    ],
  },
  {
    version: '0.35',
    date: '27.06.2026',
    changes: [
      'WBI: Weiter-Button Fix — wbiNextCard war nicht exportiert',
      'Sternenpunkte auf allen Screens entfernt',
    ],
  },
  {
    version: '0.34',
    date: '27.06.2026',
    changes: [
      'Weiter-Button Fix, Versionsanzeige im Hauptmenü',
      'Versionshistorie bereinigt',
    ],
  },
  {
    version: '0.33',
    date: '26.06.2026',
    changes: [
      'Crash behoben: doppelter Import wbiMarkNotGuessed',
    ],
  },
  {
    version: '0.32',
    date: '26.06.2026',
    changes: [
      'Crash behoben: wbiMarkSkipped Import-Fehler',
    ],
  },
  {
    version: '0.31',
    date: '26.06.2026',
    changes: [
      'Cache-Reset: SW erzwingt sofortiges Update',
    ],
  },
  {
    version: '0.30',
    date: '26.06.2026',
    changes: [
      'Crash behoben: doppelter Export wbiMarkNotGuessed',
    ],
  },
  {
    version: '0.29',
    date: '26.06.2026',
    changes: [
      'WBI: 3-Phasen-Flow — Verteilen, Diskutieren, Auflösung',
    ],
  },
  {
    version: '0.28',
    date: '26.06.2026',
    changes: [
      'Neues Spiel: Wer bin ich? — 300+ Karten in 11 Kategorien',
      'Ein-Gerät und Coop-Modus, Einladungslink via ?wbi=CODE',
    ],
  },
  {
    version: '0.27',
    date: '26.06.2026',
    changes: [
      'UI-Audit: alle fehlenden CSS-Klassen, Touch-Targets min. 44px',
    ],
  },
  {
    version: '0.26',
    date: '26.06.2026',
    changes: [
      'Lobby-History: alle Runden der Session einsehbar',
      'Gesamtpunktestand über alle Runden',
    ],
  },
  {
    version: '0.25',
    date: '26.06.2026',
    changes: [
      'Coop-Abstimmung: jeder stimmt auf eigenem Handy ab',
    ],
  },
  {
    version: '0.24',
    date: '26.06.2026',
    changes: [
      'Multiplayer Beitreten: Button groß wie beim Host',
    ],
  },
  {
    version: '0.23',
    date: '26.06.2026',
    changes: [
      'SW exakt nach Werwolf-Muster — Version nach Update immer korrekt',
    ],
  },
  {
    version: '0.22',
    date: '26.06.2026',
    changes: [
      'Update-Banner: zentriertes Modal statt Bottom-Sheet',
    ],
  },
  {
    version: '0.21',
    date: '26.06.2026',
    changes: [
      'Update-Polling alle 30 Sekunden, Banner nicht wegklickbar',
    ],
  },
  {
    version: '0.20',
    date: '26.06.2026',
    changes: [
      '13 Kategorien mit 300+ Wörtern, Runden-Modus 1–10, Neon-Theme',
    ],
  },
  {
    version: '0.19',
    date: '26.06.2026',
    changes: [
      'buildinfo.js nie gecacht — Version stimmt immer nach Update',
    ],
  },
  {
    version: '0.18',
    date: '26.06.2026',
    changes: [
      'Update-Banner zeigt korrekte Version des neuen SW',
    ],
  },
  {
    version: '0.17',
    date: '26.06.2026',
    changes: [
      'Multiplayer Host: Code selbst eintippen, kein Zufallscode',
    ],
  },
  {
    version: '0.16',
    date: '26.06.2026',
    changes: [
      'Toast-Nachrichten korrekt sichtbar über allen Ebenen',
    ],
  },
  {
    version: '0.15',
    date: '26.06.2026',
    changes: [
      'Versionsnummern korrigiert — Format 0.X statt 0.0.X',
    ],
  },
  {
    version: '0.14',
    date: '26.06.2026',
    changes: [
      'Weiter-Button nach Karte aufdecken auffälliger',
      'Crash behoben: reg-Scope-Fehler im setInterval',
    ],
  },
  {
    version: '0.13',
    date: '26.06.2026',
    changes: [
      'SW nach Werwolf-Muster — Update-Banner funktioniert korrekt',
    ],
  },
  {
    version: '0.12',
    date: '26.06.2026',
    changes: [
      'Spielmenü: Timer pausiert sofort, Einstellungen direkt erreichbar',
    ],
  },
  {
    version: '0.11',
    date: '26.06.2026',
    changes: [
      'Karte antippen zum Aufdecken, Timer neu gestaltet, Abstimmung mit Bestätigung',
    ],
  },
  {
    version: '0.10',
    date: '26.06.2026',
    changes: [
      'Cache-Fix: behebt dauerhaften state-Crash auf alten Geräten',
    ],
  },
  {
    version: '0.9',
    date: '26.06.2026',
    changes: [
      '40 automatische Tests eingeführt',
    ],
  },
  {
    version: '0.8',
    date: '26.06.2026',
    changes: [
      'Crash behoben: state vor Initialisierung zugegriffen',
    ],
  },
  {
    version: '0.7',
    date: '26.06.2026',
    changes: [
      'TIMER_SECONDS-Fehler behoben, Update-Banner auf allen Screens',
    ],
  },
  {
    version: '0.6',
    date: '26.06.2026',
    changes: [
      'Timer dynamisch nach Spielerzahl, Sound-Effekte, Versionshistorie',
    ],
  },
  {
    version: '0.5',
    date: '26.06.2026',
    changes: [
      'Vue 3, Firebase Coop, Dark/Light/Auto Theme, Service Worker',
    ],
  },
  {
    version: '0.4',
    date: '26.06.2026',
    changes: [
      'Auf Update prüfen Button, Seitwärts-Wischen behoben',
    ],
  },
  {
    version: '0.3',
    date: '26.06.2026',
    changes: [
      'Neue Ordnerstruktur, Service Worker, PWA-Icon',
    ],
  },
  {
    version: '0.2',
    date: '26.06.2026',
    changes: [
      '45-Sekunden Timer, weiße Ränder behoben, PWA-Icon für Safari',
    ],
  },
  {
    version: '0.1',
    date: '26.06.2026',
    changes: [
      'Imposter — Erstveröffentlichung',
      '60+ Wörter in 7 Kategorien, Abstimmung, Ergebnis-Screen',
    ],
  },
];
