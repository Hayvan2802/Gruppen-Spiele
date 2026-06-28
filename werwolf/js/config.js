// config.js — statische Werwolf-Konfiguration: Rollen, Teams, Defaults
// (Analog zu coop-number-sums/js/config.js — reine Daten, keine Logik)

// Ko-fi Spendenlink
export const DONATE_URL = ''; // Deaktiviert — eigener Link folgt

// Max. Spieler im Coop-Raum
export const COOP_MAX_PLAYERS = 20;

// Standard-Einstellungen
export const DEFAULT_SETTINGS = {
  theme: 'dark',   // 'dark' | 'light'
  lang: 'de',
};

// ─── ROLLEN ───────────────────────────────────────────────────────────────────
export const ROLES = {
  dorfbewohner: {
    id: 'dorfbewohner',
    icon: '🏡',
    team: 'dorf',
    std: true,
    max: 10,
    nightAction: null,
    mustSelect: false,
  },
  werwolf: {
    id: 'werwolf',
    icon: '🐺',
    team: 'wolf',
    std: true,
    max: 6,
    nightAction: 'kill',
    mustSelect: true,
  },
  seherin: {
    id: 'seherin',
    icon: '🔮',
    team: 'dorf',
    std: true,
    max: 1,
    nightAction: 'see',
    mustSelect: true,
  },
  hexe: {
    id: 'hexe',
    icon: '🧪',
    team: 'dorf',
    std: true,
    max: 1,
    nightAction: 'witch',
    mustSelect: false,
  },
  jaeger: {
    id: 'jaeger',
    icon: '🏹',
    team: 'dorf',
    std: true,
    max: 1,
    nightAction: null,
    mustSelect: false,
  },
  amor: {
    id: 'amor',
    icon: '💘',
    team: 'dorf',
    std: true,
    max: 1,
    nightAction: 'love',
    mustSelect: true,
    firstNightOnly: true,
  },
  heiler: {
    id: 'heiler',
    icon: '💉',
    team: 'dorf',
    std: false,
    max: 1,
    nightAction: 'heal',
    mustSelect: true,
  },
  alterMann: {
    id: 'alterMann',
    icon: '👴',
    team: 'dorf',
    std: false,
    max: 1,
    nightAction: null,
    mustSelect: false,
  },
  dorfdepp: {
    id: 'dorfdepp',
    icon: '🤡',
    team: 'dorf',
    std: false,
    max: 1,
    nightAction: null,
    mustSelect: false,
  },
  zweiSchwestern: {
    id: 'zweiSchwestern',
    icon: '👭',
    team: 'dorf',
    std: false,
    max: 2,
    nightAction: 'sisters',
    mustSelect: false,
    firstNightOnly: true,
  },
  dreiBrueder: {
    id: 'dreiBrueder',
    icon: '👬',
    team: 'dorf',
    std: false,
    max: 3,
    nightAction: 'brothers',
    mustSelect: false,
    everyOtherNight: true,
  },
  ritter: {
    id: 'ritter',
    icon: '⚔️',
    team: 'dorf',
    std: false,
    max: 1,
    nightAction: null,
    mustSelect: false,
  },
  kleinesMaedchen: {
    id: 'kleinesMaedchen',
    icon: '👁️',
    team: 'dorf',
    std: false,
    max: 1,
    nightAction: null,
    mustSelect: false,
  },
  buergermeister: {
    id: 'buergermeister',
    icon: '🎖️',
    team: 'dorf',
    std: false,
    max: 1,
    nightAction: null,
    mustSelect: false,
  },
  priester: {
    id: 'priester',
    icon: '✝️',
    team: 'dorf',
    std: false,
    max: 1,
    nightAction: null,
    mustSelect: false,
  },
  detektiv: {
    id: 'detektiv',
    icon: '🔍',
    team: 'dorf',
    std: false,
    max: 1,
    nightAction: 'detect',
    mustSelect: true,
  },
  seherlehrling: {
    id: 'seherlehrling',
    icon: '📖',
    team: 'dorf',
    std: false,
    max: 1,
    nightAction: null,
    mustSelect: false,
  },
  weisserWolf: {
    id: 'weisserWolf',
    icon: '🤍',
    team: 'wolf',
    std: false,
    max: 1,
    nightAction: 'killWolf',
    mustSelect: false,
    everyOtherNight: true,
  },
  alphawerwolf: {
    id: 'alphawerwolf',
    icon: '👑',
    team: 'wolf',
    std: false,
    max: 1,
    nightAction: 'kill',
    mustSelect: true,
  },
  wolfschamane: {
    id: 'wolfschamane',
    icon: '🪄',
    team: 'wolf',
    std: false,
    max: 1,
    nightAction: 'kill',
    mustSelect: true,
  },
  serienkiller: {
    id: 'serienkiller',
    icon: '🔪',
    team: 'solo',
    std: false,
    max: 1,
    nightAction: 'killSolo',
    mustSelect: true,
  },
  dieb: {
    id: 'dieb',
    icon: '🃏',
    team: 'solo',
    std: false,
    max: 1,
    nightAction: 'steal',
    mustSelect: false,
    firstNightOnly: true,
  },
};

// Nacht-Reihenfolge (IDs in der Reihenfolge, in der sie nachts aufgeweckt werden)
// Offizielle Nacht-Reihenfolge (Werwölfe von Düsterwald):
// 1. Amor (nur Nacht 1) — verbindet Liebende VOR allem anderen
// 2. Dieb (nur Nacht 1) — tauscht Karte
// 3. Zwei Schwestern / Drei Brüder (nur Nacht 1 / jede 2. Nacht)
// 4. Heiler — schützt BEVOR Wölfe angreifen (wichtig!)
// 5. Werwölfe + Alpha + Schamane — greifen an
// 6. Weißer Wolf (jede 2. Nacht) — tötet einen Wolf
// 7. Serienkiller — tötet allein
// 8. HEXE — sieht wer angegriffen wurde, entscheidet dann (wichtig!)
// 9. Seherin — überprüft eine Person
// 10. Detektiv — vergleicht zwei Spieler
// 11. Seher-Lehrling (kein nightAction, nur passiv)
export const NIGHT_ORDER = [
  'amor',
  'dieb',
  'zweiSchwestern',
  'dreiBrueder',
  'heiler',
  'werwolf',
  'alphawerwolf',
  'wolfschamane',
  'weisserWolf',
  'serienkiller',
  'hexe',
  'seherin',
  'detektiv',
];
