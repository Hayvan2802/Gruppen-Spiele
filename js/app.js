// app.js — Gruppen-Spiele v0.0.5 (Vue 3, esm-browser)
// Portiert vom Werwolf-Projekt — nur Imposter-Spiellogik
import { createApp, reactive, computed } from './vue.esm-browser.prod.js';
import { BUILD, CHANGELOG } from './buildinfo.js';
import {
  cnState, cnStartLocal, cnGiveHint, cnRevealCard, cnPassTurn, cnReset,
  cnShowHostSetup, cnCreateRoom, cnShowJoinSetup, cnJoinRoom,
  cnStartCoopGame, cnCancelCoop, cnShareLink, cnSetRole,
  cnIsSpymaster, cnMyTeam, cnCardColor,
} from './games/codenames.js';
import {
  wbiState, WBI_KATEGORIEN, WBI_DEFAULT_KATEGORIEN,
  wbiStartLocal, wbiShowCard, wbiHideCard, wbiMarkGuessed, wbiMarkNotGuessed,
  wbiMarkSkipped, wbiNextCard, wbiToggleDiscussCard, wbiStartResolve,
  wbiRestart, wbiSelectMode, wbiShowHostSetup, wbiCreateRoom,
  wbiShowJoinSetup, wbiJoinRoom, wbiStartCoopGame, wbiCancelCoop,
  wbiShareLink, wbiSendGuess, wbiCurrentCard, wbiRemainingCount, wbiGuessedCount,
} from './games/werbinich.js';
import { ALL_WORDS, KATEGORIEN, DEFAULT_KATEGORIEN, DONATE_URL, COOP_MAX_PLAYERS } from './config.js';
import * as Coop from './coop.js';
import { log, exportLogToFile } from './debuglog.js';
import {
  loadSettings, saveSettings, loadSeenVersion, saveSeenVersion,
  loadLastNames, saveLastNames, loadConfigs, saveConfig, deleteConfig,
} from './storage.js';
import { t, setLocale, detectLocale, i18nState, SUPPORTED_LOCALES } from './i18n/index.js';

const APP_START = Date.now();

// ── Timer-Dauer nach Spieleranzahl ────────────────────────────────────────────
function getTimerSeconds(playerCount) {
  // 3-4 Spieler: 45s, +10s pro 2 weitere Spieler, max 120s
  const base = 45;
  const extra = Math.floor((playerCount - 3) / 2) * 10;
  return Math.min(120, base + extra);
}

// ── Sound via Web Audio API ───────────────────────────────────────────────────
function playBeep(freq = 880, duration = 0.15, gain = 0.3) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const g   = ctx.createGain();
    osc.connect(g); g.connect(ctx.destination);
    osc.frequency.value = freq;
    g.gain.setValueAtTime(gain, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.start(); osc.stop(ctx.currentTime + duration);
  } catch(e) {}
}


const splashVersion = document.getElementById('splash-version');
if (splashVersion) splashVersion.textContent = `v${BUILD}`;


// ── Utils ─────────────────────────────────────────────────────────────────────
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function rndWord() {
  // Wörter aus gewählten Kategorien + eigene Wörter
  let pool = [];
  state.selectedKats.forEach(k => { if (KATEGORIEN[k]) pool.push(...KATEGORIEN[k]); });
  pool.push(...state.customWords);
  if (!pool.length) pool = ALL_WORDS;
  return pool[Math.floor(Math.random() * pool.length)];
}
function genId()   { return Math.random().toString(36).slice(2, 10); }
function haptic(style = 'light') {
  try {
    if (navigator.vibrate) {
      const p = { light:[10], medium:[20], heavy:[30,10,30], success:[10,50,10], error:[50,10,50,10,50] };
      navigator.vibrate(p[style] || [10]);
    }
  } catch {}
}
function showToast(msg) {
  let el = document.getElementById('gs-toast');
  if (!el) { el = Object.assign(document.createElement('div'), { id:'gs-toast', className:'toast' }); document.body.appendChild(el); }
  el.textContent = msg; el.classList.add('show');
  clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove('show'), 2600);
}

// ── State ─────────────────────────────────────────────────────────────────────
const state = reactive({
  screen: 'home',
  // Kategorien
  selectedKats: [...DEFAULT_KATEGORIEN],
  showKats: false,
  customWords: [],       // eigene Wörter
  customWordDraft: '',
  // Runden
  roundsTotal: 1,
  roundsCurrent: 1,
  scores: {},            // { name: punkte }
  lobbyHistory: [],      // [{ round, word, winner, imposters, eliminated, tally, roles }]
  wbiMenu: false,
  wbiEndConfirm: false,
  showRulesGame: null, // 'imposter' | 'wbi' | null
  // Theme
  activeTheme: 'dark',  // 'dark'|'light'|'auto'|'neon'
  settings: loadSettings(),
  showWhatsNew: false,
  showHistory:  false,
  historyDetail: null,
  historyList: false,
  updateReady: false,
  showSettingsModal: false,
  gameMenu: { active: false },
  gamePaused: false,
  gameEndConfirm: false,
  showConfigs: false,
  configNameDraft: '',
  savedConfigs: loadConfigs(),
  lastSavedNames: loadLastNames(),
  showSavedNamesHint: false,

  // Setup
  gameMode: 'local',
  playerCount: 5,
  playerNames: Array(5).fill(''),
  imposterCount: 1,

  // Coop
  coop: {
    phase: 'idle', // idle | hosting | lobby | joining | joined | myRole | coopVoting | coopResult
    code: '', codeDraft: '',
    myName: '', myUid: null,
    isHost: false,
    players: [],
    error: null,
    myRoleIsImposter: null,
    myWord: null,
    // Abstimmung
    voteSelection: null,
    myVoteDone: false,
    votesReceived: {},   // { voterUid: targetName } — nur Host sieht alle
    voteResult: null,    // { eliminated, imposters, winner, tally }
    allPlayers: [],      // snapshot aller Spieler für Ergebnisanzeige
  },

  // Rollenverteilung
  revealIdx: 0,
  revealFlipped: false,
  roles: [],   // [{name, isImposter, word}]

  // Timer
  timerSeconds: 45,
  timerInterval: null,

  // Abstimmung
  stimmIdx: 0,
  votes: {},
  voteSelection: null, // Vorauswahl vor Bestätigung

  // Ergebnis
  winner: null,      // 'village' | 'imposter'
  eliminatedNames: [],
  tally: {},
});

// ── SERVICE WORKER — exakt nach Werwolf-Pattern ────────────────────────────────
// Kein auto-skipWaiting. Nutzer entscheidet per Banner wann er aktualisiert.
let waitingWorker = null;
let reloadingAfterUpdate = false;

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').then(reg => {
      window._swReg = reg;
      log('sw', 'Service Worker registriert');

      // Wenn neuer SW übernimmt → Seite neu laden (neue buildinfo.js = neue Version)
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (reloadingAfterUpdate) return;
        reloadingAfterUpdate = true;
        log('sw', 'Neuer SW aktiv — lade neu');
        window.location.reload();
      });

      const promote = (w) => {
        if (!w) return;
        if (w.state === 'installed' && navigator.serviceWorker.controller) {
          waitingWorker = w;
          state.updateReady = true;
          log('sw', 'Update verfügbar — zeige Banner');
        }
      };
      promote(reg.waiting);
      reg.addEventListener('updatefound', () => {
        const nw = reg.installing;
        if (!nw) return;
        nw.addEventListener('statechange', () => promote(nw));
      });
      // Alle 60 Sek auf Updates prüfen (wie Werwolf)
      setInterval(() => reg.update(), 60000);

    }).catch(e => log('sw', 'SW-Registrierung fehlgeschlagen', e));
  });
}

// ── Update-Funktionen ────────────────────────────────────────────────────────
function applyUpdate() {
  if (!waitingWorker) { location.reload(); return; }
  waitingWorker.postMessage({ type: 'skipWaiting' });
}
function checkForUpdate() {
  if (!window._swReg) { showToast('Kein SW aktiv'); return; }
  state.checkingUpdate = true;
  window._swReg.update().then(() => {
    setTimeout(() => {
      state.checkingUpdate = false;
      if (!state.updateReady) showToast('Keine Updates verfügbar ✓');
    }, 2000);
  }).catch(() => { state.checkingUpdate = false; });
}

init();
