// Auto-generiert — nicht manuell bearbeiten!
export const BUILD      = '0.96';
export const BUILD_HASH = 'einstellungen-tabs-backu';

export const CHANGELOG = [
  {
    version: '0.96',
    date: '29.06.2026',
    time: '20:10',
    changes: [
    'Einstellungen: Tabs (Allgemein/Daten), Backup exportieren/importieren, erweitertes Diagnoseprotokoll',
    ],
  },
{
    version: '0.95',
    date: '29.06.2026',
    time: '19:51',
    changes: [
    'Neu-Fenster zeigt jetzt Datum neben jeder Version; Versionsdetail zeigt genaue Uhrzeit',
    ],
  },
{
    version: '0.94',
    date: '29.06.2026',
    changes: [
    'Update-Fenster zeigt jetzt alle verpassten Versionen auf einmal und ist scrollbar',
    'Multiplayer Bereit-Button zeigt jetzt „Nicht mehr bereit" statt verwirrenden Text',
    ],
  },
{
    version: '0.93',
    date: '29.06.2026',
    changes: [
    'Versionshistorie: Titel in der Top-Bar, Zurück-Button oben links klar abgetrennt',
    ],
  },
{
    version: '0.92',
    date: '29.06.2026',
    changes: [
    'Werwolf-Ordner aus dem Root-Verzeichnis entfernt',
    ],
  },
{
    version: '0.91',
    date: '29.06.2026',
    changes: [
    'Werwolf nach js/games/werwolf/ verschoben (liegt jetzt neben Codenames und Wer bin ich?)',
    ],
  },
{
    version: '0.90',
    date: '29.06.2026',
    changes: [
    'Zurück-Button in der Versionshistorie nach oben links verschoben',
    ],
  },
{
    version: '0.89',
    date: '29.06.2026',
    changes: [
    'E2E-Tests für Werwolf hinzugefügt (Shadow-DOM, Navigation, Zurück-Button)',
    'README überarbeitet: Werwolf in Spieleliste, aktuelle Projektstruktur, Entwicklungshinweise',
    ],
  },
{
    version: '0.88',
    date: '29.06.2026',
    changes: [
    'E2E-Tests mit Playwright für alle Spiele (Imposter, Codenames, Wer bin ich?) hinzugefügt',
    'Firebase RTDB Security Rules (database.rules.json) hinzugefügt',
    ],
  },
{
    version: '0.87',
    date: '29.06.2026',
    changes: [
    'Tests auf node:test umgestellt, CI auf Node 22, CLAUDE.md mit Auto-PR-Workflow aktualisiert',
    ],
  },
{
    version: '0.86',
    date: '29.06.2026',
    changes: [
    'Veraltete Dateien im Root entfernt (build.js, test.js — ersetzt durch scripts/ und test/unit/)',
    ],
  },
{
    version: '0.85',
    date: '29.06.2026',
    changes: [
    'Projektstruktur aufgeräumt: scripts/, test/unit/, package.json, CI-Workflow, .gitignore',
    ],
  },
{
    version: '0.84',
    date: '29.06.2026',
    changes: [
    'Bereit-Button im Multiplayer lässt sich jetzt wieder abwählen (nochmal tippen)',
    'Scrollen und Zoomen während Spielphasen (Timer, Kartenansicht, Diskussion) deaktiviert',
    'Pinch-Zoom auf iOS global gesperrt',
    ],
  },
{
    version: '0.83',
    date: '29.06.2026',
    changes: [
    'Multiplayer-Diskussion läuft jetzt auf eigener Seite (kein Hintergrund mehr sichtbar) — mit Einstellungen-Zugang',
    'Neuer "Abstimmung starten"-Button im Diskussions-Timer für den Host',
    'Neuer "Meine Karte nochmal ansehen"-Button während der Diskussion',
    'Raumcode-Bug behoben: nach einer Runde kann derselbe Code sofort wieder verwendet werden',
    ],
  },
{
    version: '0.82',
    date: '29.06.2026',
    changes: [
    'Abstimmungs-Button ("Beschuldigen") jetzt mit Schatten und Rahmen — deutlich besser sichtbar',
    'Primäre Aktions-Buttons in allen Spielen (Imposter, Wer bin ich, Codenames, Werwolf) mit verbessertem Kontrast und aktivem Feedback',
    '"Karte aufdecken"-Button im Reveal-Screen mit sichtbarem Schatten',
    ],
  },
{
    version: '0.81',
    date: '29.06.2026',
    changes: [
    'Bugfix: Karte-Bestätigen-Button im Multiplayer war nicht tippbar bevor Karte aufgedeckt wurde',
    'Bugfix: Bestätigungs-Flow zeigt Button erst nach Aufdecken, Bestätigungszustand klar sichtbar',
    'Lobby: "Spiel starten"-Button jetzt groß und farbig, zeigt Spielerzahl, nur aktiv wenn alle bereit',
    ],
  },
{
    version: '0.80',
    date: '29.06.2026',
    changes: [
    'Imposter Multiplayer: Vollständiger Spielablauf — Karten-Bestätigung, 2-Min-Timer, Abstimmung',
    'Tap-to-Reveal: Karte erst nach Antippen sichtbar (🃏), dann Bestätigung erforderlich',
    'Bestätigungs-Zähler: "X von Y haben bestätigt" für alle sichtbar in Echtzeit',
    'Diskussionstimer startet synchron auf allen Geräten sobald alle bestätigt haben',
    'Post-Timer-Wahl: Abstimmung ob Diskussion verlängert oder Abstimmung gestartet wird',
    'Abstimmung: jeder stimmt auf eigenem Handy ab, wer schon gewählt hat ist für alle sichtbar',
    'Bestätigung vor Stimmabgabe verhindert versehentliche Klicks',
    'Ergebnis-Screen: Gewinner, Eliminierter, Imposter-Auflösung, Stimmenzählung',
    'Gewinnlogik: Dorf gewinnt nur wenn alle Imposter eliminiert; Imposter gewinnen bei Gleichstand',
    'Singleplayer: Post-Timer-Screen mit "Noch eine Runde" oder "Abstimmung starten"',
    'Bugfix: Host hat Spielnachrichten nach Spielstart nicht verarbeitet (kritischer Fix)',
    ],
  },
{
    version: '0.79',
    date: '29.06.2026',
    changes: [
    'Update-Banner erscheint jetzt vor der Versionsmitteilung (nicht mehr danach)',
    ],
  },
{
    version: '0.78',
    date: '29.06.2026',
    changes: [
    'Wer bin ich? Multiplayer: Karte startet verdeckt (Antippen zum Aufdecken/Verdecken), Host sieht nicht mehr das Setup-Menü hinter dem Spiel, Erraten-Buttons funktionieren korrekt für Host und Gast',
    ],
  },
{
    version: '0.77',
    date: '29.06.2026',
    changes: [
    'Multiplayer-Verbindungsfehler behoben: forceLongPolling() entfernt (kollidierte mit Werwolf-Firebase-Initialisierung), Fehlerdetails im Verbindungsfehler-Text sichtbar',
    ],
  },
{
    version: '0.76',
    date: '29.06.2026',
    changes: [
    'Multiplayer-Verbindungsfehler beim Hosten behoben (Firebase App-Konflikt bei Retry verhindert)',
    ],
  },
{
    version: '0.75',
    date: '29.06.2026',
    changes: [
    'Multiplayer: Firebase nutzt jetzt Long Polling statt WebSocket — behebt Verbindungsfehler bei iCloud Private Relay',
    ],
  },
{
    version: '0.74',
    date: '29.06.2026',
    changes: [
    'Update-Prüfung läuft jetzt alle 12 Sekunden statt alle 60 Sekunden',
    'Multiplayer: Verbindungsfehler zeigt jetzt "bitte erneut versuchen" und setzt Firebase zurück für sauberen Neustart',
    ],
  },
{
    version: '0.73',
    date: '29.06.2026',
    changes: [
    'Werwolf: Zurück-Button (←) im Spiel zuverlässig ausgeblendet (watch in setup() verschoben)',
    ],
  },
{
    version: '0.72',
    date: '29.06.2026',
    changes: [
    'Werwolf: Zurück-Button (←) nur noch auf dem Startbildschirm sichtbar, nicht mehr während des Spiels',
    ],
  },
{
    version: '0.71',
    date: '29.06.2026',
    changes: [
    'Werwolf: Rollentipps wurden als einzelne Buchstaben angezeigt — Fix für t()-Funktion die Arrays zurückgibt',
    'Werwolf: Karte antippen verdeckt sie wieder (Reveal-Screen und Karten-Modal)',
    'Werwolf: Pause-Menü enthält jetzt Einstellungen, Anleitung und Karten anzeigen — separate ⚙️/🃏 Top-Bar-Buttons entfernt',
    ],
  },
{
    version: '0.70',
    date: '28.06.2026',
    changes: [
    'Werwolf-Anleitung in den Spielregeln war doppelt — doppelten Block entfernt',
    ],
  },
{
    version: '0.69',
    date: '28.06.2026',
    changes: [
    'Multiplayer-Lobby für alle Spiele: Spielernamen sichtbar, Bereit-Button für Gäste, Host-Uid-Fix, Tap-to-Reveal Karte bei Imposter',
    ],
  },
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
