// app.js — Gruppen-Spiele v0.0.5 (Vue 3, esm-browser)
// Portiert vom Werwolf-Projekt — nur Imposter-Spiellogik
import { createApp, reactive, computed, watchEffect } from './vue.esm-browser.prod.js';
import { BUILD, CHANGELOG } from './buildinfo.js';
import {
  cnState, cnSelectMode, cnStartLocal, cnGiveHint, cnRevealCard, cnPassTurn, cnReset,
  cnShowHostSetup, cnCreateRoom, cnShowJoinSetup, cnJoinRoom,
  cnStartCoopGame, cnCancelCoop, cnShareLink, cnHostSetRole,
  cnIsSpymaster, cnMyTeam, cnCardColor,
} from './games/codenames.js';
import {
  wbiState, WBI_KATEGORIEN, WBI_DEFAULT_KATEGORIEN,
  wbiStartLocal, wbiShowCard, wbiHideCard, wbiMarkGuessed, wbiMarkNotGuessed,
  wbiMarkSkipped, wbiNextCard, wbiToggleDiscussCard, wbiStartResolve,
  wbiRestart, wbiSelectMode, wbiShowHostSetup, wbiCreateRoom,
  wbiShowJoinSetup, wbiJoinRoom, wbiStartCoopGame, wbiCancelCoop, wbiToggleReady,
  wbiShareLink, wbiSendGuess, wbiCurrentCard, wbiRemainingCount, wbiGuessedCount,
} from './games/werbinich.js';
import { ALL_WORDS, KATEGORIEN, DEFAULT_KATEGORIEN, DONATE_URL, COOP_MAX_PLAYERS } from './config.js';
import * as Coop from './coop.js';
import { log, exportLogToFile, logDeviceSnapshot, installGlobalErrorHandlers, installJankDetector } from './debuglog.js';
import {
  loadSettings, saveSettings, loadSeenVersion, saveSeenVersion,
  loadLastNames, saveLastNames, loadConfigs, saveConfig, deleteConfig,
} from './storage.js';
import { t, setLocale, detectLocale, i18nState, SUPPORTED_LOCALES } from './i18n/index.js';

const APP_START = Date.now();

// ── Pinch-Zoom global sperren (iOS ignoriert viewport user-scalable=no) ───────
document.addEventListener('gesturestart', e => e.preventDefault(), { passive: false });
document.addEventListener('touchmove', e => {
  if (e.touches.length > 1) e.preventDefault();
}, { passive: false });

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
  showRulesGame: null, // 'imposter' | 'wbi' | 'cn' | 'ww' | null
  // Theme
  activeTheme: 'dark',  // 'dark'|'light'|'auto'|'neon'
  settings: loadSettings(),
  showWhatsNew: false,
  showHistory:  false,
  historyDetail: null,
  historyList: false,
  updateReady: false,
  showSettingsModal: false,
  settingsTab: 'allgemein',
  wwScreen: 'home',
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
    phase: 'idle', // idle|hosting|lobby|joining|joined|myRole|discussion|postTimer|coopVoting|coopResult
    code: '', codeDraft: '',
    myName: '', myUid: null,
    isHost: false,
    hostUid: null,
    players: [],
    error: null,
    myRoleIsImposter: null,
    myWord: null,
    coopWord: null,
    cardRevealed: false,         // tap-to-reveal
    cardConfirmedUids: [],       // UIDs die ihre Karte bestätigt haben
    myCardConfirmed: false,
    lobbyPlayers: [],            // Gäste sehen die Lobby (broadcast vom Host)
    // Diskussion
    coopTimerSeconds: 120,
    coopTimerInterval: null,
    // Post-Timer-Abstimmung
    postTimerVotes: { extend: 0, vote: 0 },
    postTimerVoters: [],
    myPostTimerVote: null,
    // Abstimmung
    voteSelection: null,
    myVoteDone: false,
    votesReceived: {},           // { voterUid: targetName } — nur Host sieht alle
    votesProgress: { count: 0, total: 0, voters: [] },
    voteResult: null,            // { eliminated, imposters, winner, tally }
    allPlayers: [],              // snapshot aller Spieler für Ergebnisanzeige
    showCardPeek: false,        // Karte nochmal ansehen während Diskussion
    myReady: false,             // eigener Bereitschaftsstatus (Gast)
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

// ── SERVICE WORKER — exakt nach Werwolf-Pattern ─────────────────────────────
// Kein auto-skipWaiting. Nutzer entscheidet per Banner wann er aktualisiert.
let waitingWorker = null;
let reloadingAfterUpdate = false;

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').then(reg => {
      window._swReg = reg;
      log('sw', 'Service Worker registriert');

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
      // Alle 12 Sek auf Updates prüfen
      setInterval(() => reg.update(), 12000);

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

// ── Theme / Locale ────────────────────────────────────────────────────────────
function applyTheme() {
  const theme = state.settings.theme;
  document.body.classList.remove('light','neon');
  if (theme === 'neon') { document.body.classList.add('neon'); return; }
  const isLight = theme === 'auto'
    ? window.matchMedia('(prefers-color-scheme: light)').matches
    : theme === 'light';
  document.body.classList.toggle('light', isLight);
}
window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => {
  if (state.settings.theme === 'auto') applyTheme();
});
function setTheme(th) { state.settings.theme = th; saveSettings(state.settings); applyTheme(); }
function applyLocale() { setLocale(state.settings.lang); }
function setLang(id) { state.settings.lang = id; saveSettings(state.settings); applyLocale(); }

// ── Version / Update ──────────────────────────────────────────────────────────
function maybeShowWhatsNew() {
  const seen = loadSeenVersion();
  if (seen !== BUILD && CHANGELOG.length) state.showWhatsNew = true;
}
function dismissWhatsNew() { state.showWhatsNew = false; saveSeenVersion(BUILD); }

// ── Setup ─────────────────────────────────────────────────────────────────────
function changePlayerCount(d) {
  const n = Math.max(3, Math.min(16, state.playerCount + d));
  state.playerCount = n;
  while (state.playerNames.length < n) state.playerNames.push('');
  state.playerNames = state.playerNames.slice(0, n);
}

function loadLastNamesIntoSetup() {
  const last = state.lastSavedNames;
  if (!last.length) return;
  state.playerCount = Math.max(3, Math.min(16, last.length));
  while (state.playerNames.length < state.playerCount) state.playerNames.push('');
  state.playerNames = state.playerNames.slice(0, state.playerCount);
  last.forEach((n, i) => { if (i < state.playerNames.length) state.playerNames[i] = n; });
  state.showSavedNamesHint = false;
  showToast('Namen geladen');
}
function dismissNamesHint() { state.showSavedNamesHint = false; }

// Werwolf ist als eigene Vue-Instanz in einem Shadow-DOM eingebettet
// (siehe werwolf-embed.js) — nahtlos wie die anderen Spiele, ohne Reload.
// Werwolf meldet seinen internen Screen per Custom Event → state.wwScreen
// steuert, ob der ←-Button der Haupt-App sichtbar ist (nur auf Werwolf-Home).
window.addEventListener('ww-screen', e => { state.wwScreen = e.detail; });

function openWerwolf() {
  state.screen = 'ww';
  state.wwScreen = 'home';
  const host = document.getElementById('ww-host');
  if (host) import('./werwolf-embed.js').then(m => m.ensureWerwolf(host));
}
function closeWerwolf() { state.screen = 'home'; state.wwScreen = 'home'; }

// ── Konfigurationen ───────────────────────────────────────────────────────────
function saveCurrentConfig() {
  const name = state.configNameDraft.trim() || `${state.playerCount} Spieler`;
  saveConfig({ id: genId(), name, playerCount: state.playerCount, playerNames: [...state.playerNames], imposterCount: state.imposterCount, createdAt: Date.now() });
  state.savedConfigs = loadConfigs();
  state.configNameDraft = '';
  showToast('Gespeichert!');
}
function loadConfig(cfg) {
  state.playerCount   = cfg.playerCount;
  state.playerNames   = [...cfg.playerNames];
  state.imposterCount = cfg.imposterCount || 1;
  while (state.playerNames.length < state.playerCount) state.playerNames.push('');
  state.showConfigs   = false;
  showToast(cfg.name);
}
function removeConfig(id) { deleteConfig(id); state.savedConfigs = loadConfigs(); }

// ── Spielmenü ─────────────────────────────────────────────────────────────────
function openGameMenu()  {
  state.gameMenu.active = true;
  // Timer sofort pausieren wenn Menü geöffnet wird
  if (state.screen === 'timer') {
    clearInterval(state.timerInterval);
  }
}
function closeGameMenu() {
  state.gameMenu.active = false;
  // Timer fortsetzen wenn Menü geschlossen
  if (state.screen === 'timer' && state.timerSeconds > 0) startTimer();
}
function pauseGame()     { state.gamePaused = true; state.gameMenu.active = false; clearInterval(state.timerInterval); }
function resumeGame() {
  if (state.screen === 'timer' && state.timerSeconds > 0) startTimer();
}
function confirmEndGame() {
  state.gameEndConfirm = false; state.gameMenu.active = false;
  clearInterval(state.timerInterval);
  state.screen = 'home';
}

// ── Game Logic — Lokal ────────────────────────────────────────────────────────
function startLocalGame() {
  const names = state.playerNames.slice(0, state.playerCount).map((n, i) => n.trim() || `Spieler ${i + 1}`);
  saveLastNames(names);
  state.lastSavedNames = names;

  const word     = rndWord();
  const shuffled = shuffle(names);
  const impIdx   = new Set(shuffle([...Array(shuffled.length).keys()]).slice(0, state.imposterCount));
  state.roles    = shuffled.map((name, i) => ({ name, isImposter: impIdx.has(i), word }));

  state.revealIdx    = 0;
  state.revealFlipped = false;
  state.votes        = {};
  state.stimmIdx     = 0;
  state.winner       = null;
  state.eliminatedNames = [];
  state.tally        = {};
  state.scores       = {};
  state.roundsCurrent = 1;
  state.voteSelection = null;
  state.lobbyHistory  = [];
  state.timerSeconds = getTimerSeconds(state.playerCount);
  clearInterval(state.timerInterval);
  state.screen = 'reveal';
  haptic('success');
}

function revealCard() { state.revealFlipped = true; haptic('medium'); }

function nextReveal() {
  if (state.revealIdx + 1 >= state.roles.length) {
    // Alle haben ihre Karte gesehen → Timer
    state.screen = 'timer';
    state.timerSeconds = getTimerSeconds(state.roles.length);
    startTimer();
  } else {
    state.revealIdx++;
    state.revealFlipped = false;
  }
}

function startTimer() {
  clearInterval(state.timerInterval);
  state.timerInterval = setInterval(() => {
    state.timerSeconds--;
    if (state.timerSeconds === 30) playBeep(660, 0.2, 0.25);
    if (state.timerSeconds === 15) playBeep(880, 0.25, 0.3);
    if (state.timerSeconds <= 15 && state.timerSeconds > 0) playBeep(1100, 0.08, 0.15);
    if (state.timerSeconds <= 0) {
      clearInterval(state.timerInterval);
      playBeep(440, 0.5, 0.4);
      haptic('medium');
      setTimeout(() => { state.screen = 'postTimer'; }, 600);
    }
  }, 1000);
}

function skipTimer() {
  clearInterval(state.timerInterval);
  state.screen = 'postTimer';
}

function localExtendDiscussion() {
  state.timerSeconds = getTimerSeconds(state.roles.length);
  state.screen = 'timer';
  startTimer();
}

function localStartVoting() {
  state.screen = 'voting';
  state.stimmIdx = 0;
}

function selectVote(target) {
  state.voteSelection = target;
  haptic('light');
}
function confirmVote() {
  if (!state.voteSelection) return;
  const voter = state.roles[state.stimmIdx].name;
  state.votes[voter] = state.voteSelection;
  state.voteSelection = null;
  haptic('medium');
  if (state.stimmIdx + 1 >= state.roles.length) {
    calcResult();
  } else {
    state.stimmIdx++;
  }
}

function calcResult() {
  const tally = {};
  state.roles.forEach(r => { tally[r.name] = 0; });
  Object.values(state.votes).forEach(t => { tally[t] = (tally[t] || 0) + 1; });
  const max = Math.max(...Object.values(tally));
  const eliminated = Object.keys(tally).filter(n => tally[n] === max);
  const imposters  = state.roles.filter(r => r.isImposter).map(r => r.name);
  state.winner          = eliminated.some(n => imposters.includes(n)) ? 'village' : 'imposter';
  state.eliminatedNames = eliminated;
  state.tally           = tally;
  // Punkte vergeben
  if (state.winner === 'village') {
    state.roles.filter(r => !r.isImposter).forEach(r => {
      state.scores[r.name] = (state.scores[r.name] || 0) + 1;
    });
  } else {
    state.roles.filter(r => r.isImposter).forEach(r => {
      state.scores[r.name] = (state.scores[r.name] || 0) + 2;
    });
  }
  // Runde in Lobby-History speichern
  state.lobbyHistory.push({
    round:     state.roundsCurrent,
    word:      state.roles[0]?.word || '',
    winner:    state.winner,
    imposters: imposters,
    eliminated,
    tally:     { ...tally },
    roles:     state.roles.map(r => ({ name: r.name, isImposter: r.isImposter })),
    ts:        Date.now(),
  });
  state.screen = 'result';
  haptic(state.winner === 'village' ? 'success' : 'error');
}

function newGame() { state.screen = 'home'; }
function nextRound() {
  // Nächste Runde — Namen bleiben, Punkte bleiben
  state.roundsCurrent++;
  state.revealIdx = 0; state.revealFlipped = false;
  state.votes = {}; state.stimmIdx = 0;
  state.winner = null; state.eliminatedNames = []; state.tally = {};
  state.voteSelection = null;
  state.timerSeconds = getTimerSeconds(state.playerCount);
  clearInterval(state.timerInterval);
  const names = state.playerNames.slice(0, state.playerCount).map((n,i) => n.trim() || `Spieler ${i+1}`);
  const word = rndWord();
  const shuffled = shuffle(names);
  const impIdx = new Set(shuffle([...Array(shuffled.length).keys()]).slice(0, state.imposterCount));
  state.roles = shuffled.map((name,i) => ({ name, isImposter: impIdx.has(i), word }));
  state.screen = 'reveal';
  haptic('success');
}
function resetGame() {
  state.roundsCurrent = 1; state.scores = {}; state.lobbyHistory = [];
  state.screen = 'home';
}

// ── Coop ─────────────────────────────────────────────────────────────────────
function selectMode(mode) { state.gameMode = mode; }
function genCode() { return String(Math.floor(100000 + Math.random() * 900000)); }

async function showHostSetup() {
  state.coop.phase = 'hosting'; state.coop.codeDraft = '';
  state.coop.players = []; state.coop.error = null; state.coop.isHost = true;
}

async function createRoom() {
  const code = state.coop.codeDraft.replace(/\D/g, '').slice(0, 6);
  if (code.length !== 6) { state.coop.error = t('coop.codeHint'); return; }
  const myName = state.coop.myName.trim() || 'Host';
  state.coop.code = code; state.coop.error = null; state.coop.phase = 'lobby';
  state.coop.players = [{ uid: 'host', name: myName, ready: true, isHost: true }];
  const lobbyBroadcast = () => Coop.send({
    type: 'LOBBY_UPDATE',
    players: state.coop.players.map(p => ({ uid: p.uid, name: p.name, ready: p.ready, isHost: p.isHost })),
  });
  await Coop.hostGame({
    code, name: myName,
    onOpen: (uid) => {
      state.coop.myUid = uid;
      const h = state.coop.players.find(p => p.isHost);
      if (h) h.uid = uid; // Host-UID von 'host' auf echte Firebase-UID aktualisieren
    },
    onError: (e) => { Coop.resetFb(); state.coop.error = e.type === 'code-taken' ? t('coop.codeTaken') : e.type === 'timeout' ? t('coop.errorTimeout') : `${t('coop.errorGeneric')} (${e.code || e.message || e.type || JSON.stringify(e)})`; state.coop.phase = 'hosting'; },
    onJoin: (uid, data) => {
      if (!state.coop.players.find(p => p.uid === uid))
        state.coop.players.push({ uid, name: data?.name || uid, ready: false, isHost: false });
      lobbyBroadcast();
    },
    onLeave: (uid) => {
      state.coop.players = state.coop.players.filter(p => p.uid !== uid);
      lobbyBroadcast();
    },
    onMessage: (msg) => {
      if (msg.type === Coop.MSG.READY) {
        const p = state.coop.players.find(x => x.uid === msg.author);
        if (p) p.ready = msg.ready;
        lobbyBroadcast();
      }
      handleCoopMessage(msg);
    },
  });
}

async function startCoopGame() {
  const players  = state.coop.players;
  const word     = rndWord();
  const impIdx   = new Set(shuffle([...Array(players.length).keys()]).slice(0, state.imposterCount));
  const assignments = players.map((p, i) => ({
    uid: p.uid, name: p.name, isImposter: impIdx.has(i), word,
  }));
  // allPlayers VOR dem Senden setzen — Host verarbeitet eigene Nachrichten nicht
  state.coop.allPlayers = assignments.map(a => ({ uid: a.uid, name: a.name, isImposter: a.isImposter }));
  state.coop.cardRevealed = false;
  state.coop.cardConfirmedUids = [];
  state.coop.myCardConfirmed = false;
  state.coop.hostUid = state.coop.myUid;
  state.coop.coopWord = word;
  await Coop.send({ type: Coop.MSG.START, assignments, hostUid: state.coop.myUid });

  // Host sieht auch seine eigene Karte
  const mine = assignments.find(a => a.uid === state.coop.myUid);
  if (mine) { state.coop.myRoleIsImposter = mine.isImposter; state.coop.myWord = mine.word; state.coop.phase = 'myRole'; }
}

function showJoinSetup() {
  state.coop.phase = 'joining'; state.coop.codeDraft = ''; state.coop.myName = ''; state.coop.error = null; state.coop.isHost = false;
}

async function joinRoom() {
  const name = state.coop.myName.trim();
  const code = state.coop.codeDraft.replace(/\D/g, '').slice(0, 6);
  if (!name) { state.coop.error = t('coop.yourName'); return; }
  if (code.length !== 6) { state.coop.error = t('coop.codeHint'); return; }
  state.coop.error = null; state.coop.code = code;
  await Coop.joinGame({
    code, name,
    onOpen: (uid) => { state.coop.myUid = uid; state.coop.phase = 'joined'; },
    onError: (e) => {
      if (e.type === 'code-not-found') state.coop.error = t('coop.codeWrong');
      else if (e.type === 'room-full') state.coop.error = t('coop.roomFull');
      else if (e.type === 'timeout')   state.coop.error = t('coop.errorTimeout');
      else state.coop.error = `${t('coop.errorGeneric')} (${e.code || e.message || e.type || JSON.stringify(e)})`;
    },
    onMessage: handleCoopMessage,
    onClose: () => { state.coop.phase = 'idle'; },
  });
}

async function toggleReady() {
  state.coop.myReady = !state.coop.myReady;
  await Coop.send({ type: Coop.MSG.READY, ready: state.coop.myReady });
}

function getInviteLink() {
  const base = window.location.origin + window.location.pathname;
  return `${base}?code=${state.coop.code}`;
}

async function shareInviteLink() {
  const url = getInviteLink();
  if (navigator.share) {
    try { await navigator.share({ title: 'Gruppen-Spiele — Raum beitreten', text: `Tritt meinem Raum bei! Code: ${state.coop.code}`, url }); return; }
    catch(e) { if (e.name === 'AbortError') return; }
  }
  try { await navigator.clipboard.writeText(url); showToast('Link kopiert!'); }
  catch(e) { showToast(url); }
}

async function cancelCoop() {
  clearInterval(state.coop.coopTimerInterval);
  await Coop.leave();
  state.coop.phase = 'idle'; state.coop.players = []; state.coop.error = null;
  state.coop.myUid = null; state.coop.hostUid = null;
  state.coop.myRoleIsImposter = null; state.coop.myWord = null; state.coop.coopWord = null;
  state.coop.voteResult = null; state.coop.votesReceived = {};
  state.coop.myVoteDone = false; state.coop.voteSelection = null;
  state.coop.lobbyPlayers = []; state.coop.cardRevealed = false;
  state.coop.cardConfirmedUids = []; state.coop.myCardConfirmed = false;
  state.coop.coopTimerSeconds = 120; state.coop.coopTimerInterval = null;
  state.coop.postTimerVotes = { extend: 0, vote: 0 };
  state.coop.postTimerVoters = []; state.coop.myPostTimerVote = null;
  state.coop.votesProgress = { count: 0, total: 0, voters: [] };
  state.coop.showCardPeek = false;
  state.coop.myReady = false;
}

function coopSelectVote(name) {
  state.coop.voteSelection = name;
  haptic('light');
}

async function coopConfirmVote() {
  if (!state.coop.voteSelection || state.coop.myVoteDone) return;
  state.coop.myVoteDone = true;
  haptic('medium');
  if (state.coop.isHost) {
    // Host verarbeitet eigene Stimme direkt
    state.coop.votesReceived[state.coop.myUid] = state.coop.voteSelection;
    const voterNames = Object.keys(state.coop.votesReceived)
      .map(uid => state.coop.allPlayers.find(p => p.uid === uid)?.name || '?');
    state.coop.votesProgress = { count: voterNames.length, total: state.coop.allPlayers.length, voters: voterNames };
    await Coop.send({ type: Coop.MSG.VOTE_PROGRESS, count: voterNames.length, total: state.coop.allPlayers.length, voterNames });
    if (voterNames.length >= state.coop.allPlayers.length) calcCoopResult();
  } else {
    // Gast sendet nur an Host (Stimme bleibt privat)
    await Coop.sendTo(state.coop.hostUid, { type: Coop.MSG.VOTE_CAST, targetName: state.coop.voteSelection });
  }
}

function startCoopVoting() {
  state.coop.phase = 'coopVoting';
  state.coop.votesReceived = {};
  state.coop.myVoteDone = false;
  state.coop.voteSelection = null;
  state.coop.votesProgress = { count: 0, total: state.coop.allPlayers.length, voters: [] };
  Coop.send({ type: Coop.MSG.VOTE_START, candidates: state.coop.allPlayers.map(p => p.name) });
}

function calcCoopResult() {
  const votes   = state.coop.votesReceived;
  const players = state.coop.allPlayers;
  const tally   = {};
  players.forEach(p => { tally[p.name] = 0; });
  Object.values(votes).forEach(v => { tally[v] = (tally[v] || 0) + 1; });
  const max       = Math.max(...Object.values(tally));
  const eliminated = Object.keys(tally).filter(n => tally[n] === max);
  const imposters  = players.filter(p => p.isImposter).map(p => p.name);

  // Verbleibende Spieler nach Eliminierung
  const remaining          = players.filter(p => !eliminated.includes(p.name));
  const remainingImposters = remaining.filter(p => p.isImposter).length;
  const remainingVillagers = remaining.filter(p => !p.isImposter).length;

  // Gewinnbedingung:
  // Dorf gewinnt → alle Imposter eliminiert
  // Imposter gewinnen → Imposter >= Dörfler (Gleichstand ist Imposter-Sieg)
  let winner;
  if (remainingImposters === 0) {
    winner = 'village';
  } else if (remainingImposters >= remainingVillagers) {
    winner = 'imposter';
  } else {
    winner = 'imposter'; // Imposter überlebt → Imposter gewinnt diese Runde
  }

  const result = { eliminated, imposters, winner, tally, word: state.coop.coopWord || '' };
  Coop.send({ type: Coop.MSG.VOTE_RESULT, result });
  state.coop.voteResult = result;
  state.coop.phase = 'coopResult';
  clearInterval(state.coop.coopTimerInterval);
  haptic(winner === 'village' ? 'success' : 'error');
}

// ── Coop: Karten-Bestätigung ──────────────────────────────────────────────────
async function confirmCard() {
  if (state.coop.myCardConfirmed) return;
  state.coop.myCardConfirmed = true;
  if (!state.coop.cardConfirmedUids.includes(state.coop.myUid)) {
    state.coop.cardConfirmedUids.push(state.coop.myUid);
  }
  await Coop.send({ type: Coop.MSG.CARD_CONFIRMED });
  if (state.coop.isHost) checkAllConfirmed();
}

function checkAllConfirmed() {
  if (state.coop.cardConfirmedUids.length >= state.coop.allPlayers.length) {
    startDiscussion();
  }
}

async function startDiscussion() {
  state.coop.phase = 'discussion';
  state.coop.coopTimerSeconds = 120;
  clearInterval(state.coop.coopTimerInterval);
  await Coop.send({ type: Coop.MSG.DISCUSSION_START });
  startCoopTimer();
}

function startCoopTimer() {
  clearInterval(state.coop.coopTimerInterval);
  state.coop.coopTimerInterval = setInterval(() => {
    if (state.coop.coopTimerSeconds > 0) {
      state.coop.coopTimerSeconds--;
      if (state.coop.coopTimerSeconds === 0) {
        clearInterval(state.coop.coopTimerInterval);
        state.coop.phase = 'postTimer';
        haptic('medium');
      }
    }
  }, 1000);
}

// Host überspringt den Diskussions-Timer → direkt zur Post-Timer-Abstimmung
async function coopSkipTimer() {
  if (!state.coop.isHost) return;
  clearInterval(state.coop.coopTimerInterval);
  state.coop.coopTimerInterval = null;
  state.coop.phase = 'postTimer';
  state.coop.postTimerVotes = { extend: 0, vote: 0 };
  state.coop.postTimerVoters = [];
  state.coop.myPostTimerVote = null;
  await Coop.send({ type: Coop.MSG.TIMER_SKIP });
  haptic('medium');
}

// ── Coop: Post-Timer-Abstimmung ────────────────────────────────────────────────
async function sendPostTimerVote(choice) {
  if (state.coop.myPostTimerVote) return;
  state.coop.myPostTimerVote = choice;
  if (!state.coop.postTimerVoters.includes(state.coop.myUid)) {
    state.coop.postTimerVoters.push(state.coop.myUid);
  }
  state.coop.postTimerVotes[choice] = (state.coop.postTimerVotes[choice] || 0) + 1;
  haptic('light');
  await Coop.send({ type: Coop.MSG.POST_TIMER_VOTE, choice });
  if (state.coop.isHost) checkPostTimerVotes();
}

function checkPostTimerVotes() {
  if (state.coop.postTimerVoters.length >= state.coop.allPlayers.length) {
    const ext  = state.coop.postTimerVotes.extend || 0;
    const vote = state.coop.postTimerVotes.vote   || 0;
    const result = ext > vote ? 'extend' : 'vote';
    Coop.send({ type: Coop.MSG.POST_TIMER_RESULT, result });
    applyPostTimerResult(result);
  }
}

function applyPostTimerResult(result) {
  if (result === 'extend') {
    state.coop.coopTimerSeconds = 120;
    state.coop.postTimerVotes  = { extend: 0, vote: 0 };
    state.coop.postTimerVoters = [];
    state.coop.myPostTimerVote = null;
    state.coop.phase = 'discussion';
    startCoopTimer();
  } else {
    startCoopVoting();
  }
}

function handleCoopMessage(msg) {
  if (!msg) return;

  if (msg.type === 'LOBBY_UPDATE') {
    state.coop.lobbyPlayers = msg.players || [];
  }

  if (msg.type === Coop.MSG.START) {
    const mine = msg.assignments?.find(a => a.uid === state.coop.myUid);
    if (mine) {
      state.coop.myRoleIsImposter = mine.isImposter;
      state.coop.myWord = mine.word;
      if (!mine.isImposter) state.coop.coopWord = mine.word;
      state.coop.allPlayers = msg.assignments.map(a => ({ uid: a.uid, name: a.name, isImposter: a.isImposter }));
      state.coop.cardRevealed = false;
      state.coop.cardConfirmedUids = [];
      state.coop.myCardConfirmed = false;
      state.coop.hostUid = msg.hostUid || null;
      state.coop.phase = 'myRole';
    }
  }

  if (msg.type === Coop.MSG.CARD_CONFIRMED) {
    if (!state.coop.cardConfirmedUids.includes(msg.author)) {
      state.coop.cardConfirmedUids.push(msg.author);
    }
    if (state.coop.isHost) checkAllConfirmed();
  }

  if (msg.type === Coop.MSG.DISCUSSION_START) {
    state.coop.phase = 'discussion';
    state.coop.coopTimerSeconds = 120;
    clearInterval(state.coop.coopTimerInterval);
    startCoopTimer();
  }

  if (msg.type === Coop.MSG.TIMER_SKIP) {
    clearInterval(state.coop.coopTimerInterval);
    state.coop.coopTimerInterval = null;
    state.coop.phase = 'postTimer';
    state.coop.postTimerVotes = { extend: 0, vote: 0 };
    state.coop.postTimerVoters = [];
    state.coop.myPostTimerVote = null;
    haptic('medium');
  }

  if (msg.type === Coop.MSG.POST_TIMER_VOTE) {
    if (!state.coop.postTimerVoters.includes(msg.author)) {
      state.coop.postTimerVoters.push(msg.author);
      state.coop.postTimerVotes[msg.choice] = (state.coop.postTimerVotes[msg.choice] || 0) + 1;
    }
    if (state.coop.isHost) checkPostTimerVotes();
  }

  if (msg.type === Coop.MSG.POST_TIMER_RESULT) {
    applyPostTimerResult(msg.result);
  }

  if (msg.type === Coop.MSG.VOTE_START) {
    state.coop.phase = 'coopVoting';
    state.coop.myVoteDone = false;
    state.coop.voteSelection = null;
    state.coop.votesProgress = { count: 0, total: state.coop.allPlayers.length, voters: [] };
  }

  if (msg.type === Coop.MSG.VOTE_CAST) {
    // Nur Host empfängt Stimmen (targetUid-gefiltert)
    if (state.coop.isHost && (!msg.targetUid || msg.targetUid === state.coop.myUid)) {
      state.coop.votesReceived[msg.author] = msg.targetName;
      const voterNames = Object.keys(state.coop.votesReceived)
        .map(uid => state.coop.allPlayers.find(p => p.uid === uid)?.name || '?');
      state.coop.votesProgress = { count: voterNames.length, total: state.coop.allPlayers.length, voters: voterNames };
      Coop.send({ type: Coop.MSG.VOTE_PROGRESS, count: voterNames.length, total: state.coop.allPlayers.length, voterNames });
      if (voterNames.length >= state.coop.allPlayers.length) calcCoopResult();
    }
  }

  if (msg.type === Coop.MSG.VOTE_PROGRESS) {
    state.coop.votesProgress = { count: msg.count, total: msg.total, voters: msg.voterNames || [] };
  }

  if (msg.type === Coop.MSG.VOTE_RESULT) {
    state.coop.voteResult = msg.result;
    state.coop.phase = 'coopResult';
    clearInterval(state.coop.coopTimerInterval);
    haptic(msg.result?.winner === 'village' ? 'success' : 'error');
  }
}

// ── Init ──────────────────────────────────────────────────────────────────────
function init() {
  applyTheme(); applyLocale();
  logDeviceSnapshot();
  installGlobalErrorHandlers();
  installJankDetector();
  // Kurz warten damit der SW promote(reg.waiting) ausführen kann —
  // Update-Banner hat Vorrang vor der Versionsmitteilung.
  setTimeout(maybeShowWhatsNew, 800);
  if (state.lastSavedNames.length > 0) state.showSavedNamesHint = true;

  // Einladungslink: ?code=XXXXXX → direkt in Coop-Join-Ansicht
  const params = new URLSearchParams(window.location.search);
  const inviteCode = params.get('code');
  if (inviteCode && /^[0-9]{6}$/.test(inviteCode)) {
    state.gameMode = 'coop';
    state.coop.phase = 'joining';
    state.coop.codeDraft = inviteCode;
    log('coop', `Einladungslink erkannt: Code ${inviteCode}`);
  }
  const cnCode = params.get('cn');
  if (cnCode && /^[0-9]{6}$/.test(cnCode)) {
    state.screen = 'cn';
    cnState.coop.phase = 'joining';
    cnState.coop.codeDraft = cnCode;
  }
  const wbiCode = params.get('wbi');
  if (wbiCode && /^[0-9]{6}$/.test(wbiCode)) {
    state.screen = 'wbi';
    wbiState.gameMode = 'coop';
    wbiState.coop.phase = 'joining';
    wbiState.coop.codeDraft = wbiCode;
    log('coop', `WBI Einladungslink: Code ${wbiCode}`);
  }

  setTimeout(() => {
    const splash = document.getElementById('splash');
    if (splash) splash.classList.add('fade-out');
  }, Math.max(0, 600 - (Date.now() - APP_START)));
}

// ── Backup / Import ───────────────────────────────────────────────────────────
async function exportBackup() {
  const { BUILD } = await import('./buildinfo.js');
  const data = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && (key.startsWith('gs_') || key.startsWith('ww_'))) {
      try { data[key] = JSON.parse(localStorage.getItem(key)); }
      catch { data[key] = localStorage.getItem(key); }
    }
  }
  const backup = { app: 'Gruppen-Spiele', version: BUILD, exportedAt: new Date().toISOString(), data };
  const filename = `gruppen-spiele-backup-${new Date().toISOString().slice(0,10)}.json`;
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  if (navigator.canShare) {
    try {
      const file = new File([blob], filename, { type: 'application/json' });
      if (navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: 'Gruppen-Spiele Backup' }); return; }
    } catch (e) { if (e.name === 'AbortError') return; }
  }
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function importBackup() {
  const input = document.createElement('input');
  input.type = 'file'; input.accept = '.json,application/json';
  input.onchange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const backup = JSON.parse(await file.text());
      if (!backup.data || typeof backup.data !== 'object') throw new Error('Ungültiges Format');
      let count = 0;
      for (const [key, val] of Object.entries(backup.data)) {
        if (key.startsWith('gs_') || key.startsWith('ww_')) {
          localStorage.setItem(key, JSON.stringify(val)); count++;
        }
      }
      state.settings = loadSettings();
      state.savedConfigs = loadConfigs();
      state.lastSavedNames = loadLastNames();
      alert(`✅ ${count} Einträge wiederhergestellt.`);
    } catch (err) { alert('❌ Backup konnte nicht gelesen werden: ' + err.message); }
  };
  document.body.appendChild(input); input.click(); document.body.removeChild(input);
}

// ── Vue App ───────────────────────────────────────────────────────────────────
const App = {
  setup() {
    // Scroll-Sperre für Spielphasen wo nichts gescrollt werden soll
    const noScrollScreens = new Set(['reveal', 'timer', 'postTimer']);
    const noScrollCoopPhases = new Set(['myRole', 'discussion', 'postTimer']);
    watchEffect(() => {
      const block = noScrollScreens.has(state.screen) || noScrollCoopPhases.has(state.coop.phase);
      document.body.classList.toggle('no-scroll', block);
    });

    const timerPct = computed(() => state.timerSeconds / getTimerSeconds(state.roles.length || state.playerCount) * 100);
    // Dynamische Imposter-Optionen: 1 per 4 Spieler, min 1, max 4
    // Frei wählbar 1–5 Imposter, unabhängig von Spielerzahl
    const maxImposterOptions = computed(() => [1, 2, 3, 4, 5]);
    const revealPlayer = computed(() => state.roles[state.revealIdx]);
    const currentVoter = computed(() => state.roles[state.stimmIdx]);
    const voteOptions  = computed(() => state.roles.filter(r => r.name !== currentVoter.value?.name));
    const imposters    = computed(() => state.roles.filter(r => r.isImposter).map(r => r.name));
    // Alle Versionen die der Nutzer noch nicht gesehen hat (neueste zuerst)
    const newChangelogs = computed(() => {
      const seen = loadSeenVersion();
      if (!seen || !CHANGELOG.length) return CHANGELOG;
      const idx = CHANGELOG.findIndex(cl => cl.version === seen);
      if (idx === -1) return CHANGELOG;
      const fresh = CHANGELOG.slice(0, idx);
      return fresh.length ? fresh : [CHANGELOG[0]];
    });

    return {
      state, BUILD, CHANGELOG, DONATE_URL, SUPPORTED_LOCALES,
      timerPct, revealPlayer, currentVoter, voteOptions, imposters, maxImposterOptions, getTimerSeconds,
      newChangelogs,
      t, i18nState,
      setTheme, setLang,
      changePlayerCount, selectMode,
      loadLastNamesIntoSetup, dismissNamesHint, openWerwolf, closeWerwolf,
      saveCurrentConfig, loadConfig, removeConfig,
      openGameMenu, closeGameMenu, pauseGame, resumeGame, confirmEndGame,
      startLocalGame, revealCard, nextReveal, skipTimer, localExtendDiscussion, localStartVoting, selectVote, confirmVote, newGame, nextRound, resetGame,
      KATEGORIEN, DEFAULT_KATEGORIEN,
      // Wer bin ich
      wbiState, WBI_KATEGORIEN, WBI_DEFAULT_KATEGORIEN,
      wbiStartLocal, wbiShowCard, wbiHideCard, wbiMarkGuessed, wbiMarkNotGuessed,
      wbiMarkSkipped, wbiNextCard, wbiToggleDiscussCard, wbiStartResolve,
      wbiRestart, wbiSelectMode, wbiShowHostSetup, wbiCreateRoom,
      wbiShowJoinSetup, wbiJoinRoom, wbiStartCoopGame, wbiCancelCoop, wbiToggleReady,
      wbiShareLink, wbiSendGuess, wbiCurrentCard, wbiRemainingCount, wbiGuessedCount,
      showHostSetup, createRoom, startCoopGame,
      showJoinSetup, joinRoom, toggleReady, cancelCoop,
      getInviteLink, shareInviteLink,
      confirmCard, sendPostTimerVote, coopSkipTimer,
      coopSelectVote, coopConfirmVote, startCoopVoting,
      dismissWhatsNew, applyUpdate, checkForUpdate,
      exportLogToFile, exportBackup, importBackup,
      // Codenames
      cnState, cnSelectMode, cnStartLocal, cnGiveHint, cnRevealCard, cnPassTurn, cnReset,
      cnShowHostSetup, cnCreateRoom, cnShowJoinSetup, cnJoinRoom,
      cnStartCoopGame, cnCancelCoop, cnShareLink, cnHostSetRole,
      cnIsSpymaster, cnMyTeam, cnCardColor,
    };
  },
  template: `
  <div class="app" :class="{ rtl: i18nState.rtl }">

    <!-- ── WERWOLF: eingebettete Unter-App (eigene Vue-Instanz im Shadow-DOM) ──
         v-show statt v-if, damit Host + Shadow-DOM erhalten bleiben und der
         Wechsel hin/zurück ohne Reload sofort ist. -->
    <div id="ww-host" class="ww-host" v-show="state.screen==='ww'"></div>
    <button v-if="state.screen==='ww' && state.wwScreen==='home'" class="back-corner icon-btn" @click="closeWerwolf" title="Zurück" aria-label="Zurück">←</button>

    <!-- Pause-Overlay entfernt — nur gameMenu Modal wird verwendet -->


    <!-- ── ANLEITUNGS-MODAL ── -->
    <div v-if="state.showRulesGame" class="modal-bg" @click.self="state.showRulesGame=null">
      <div class="modal" style="max-height:85vh;overflow-y:auto">
        <!-- Imposter Anleitung -->
        <template v-if="state.showRulesGame==='imposter'">
          <img src='./icons/games/imposter.png' style='width:72px;height:72px;display:block;margin:0 auto .5rem;border-radius:16px'/>
          <h3 style="text-align:center;margin-bottom:1rem">Imposter — Anleitung</h3>
          <div class="rules-section">
            <div class="rules-step">1️⃣ <strong>Karten verteilen</strong><br>Jeder schaut heimlich auf sein Handy und sieht ein geheimes Wort — außer dem Imposter!</div>
            <div class="rules-step">2️⃣ <strong>Diskutieren</strong><br>Alle beschreiben das Wort abwechselnd, ohne es direkt zu sagen. Der Imposter muss so tun als ob er es kennt.</div>
            <div class="rules-step">3️⃣ <strong>Abstimmen</strong><br>Jeder stimmt ab, wer der Imposter ist. Wer die meisten Stimmen bekommt fliegt raus.</div>
            <div class="rules-step">🏆 <strong>Wer gewinnt?</strong><br>Das Dorf gewinnt wenn der Imposter erwischt wird. Der Imposter gewinnt wenn er nicht enttarnt wird.</div>
          </div>
        </template>
        <!-- Wer bin ich Anleitung -->
        <template v-if="state.showRulesGame==='wbi'">
          <img src='./icons/games/wbi.png' style='width:72px;height:72px;display:block;margin:0 auto .5rem;border-radius:16px'/>
          <h3 style="text-align:center;margin-bottom:1rem">Wer bin ich? — Anleitung</h3>
          <div class="rules-section">
            <div class="rules-step">1️⃣ <strong>Karten verteilen</strong><br>Jeder hält das Handy mit dem Bildschirm zur Gruppe — alle anderen sehen den Begriff, nur der Spieler selbst nicht!</div>
            <div class="rules-step">2️⃣ <strong>Fragen stellen</strong><br>Jeder Spieler stellt reihum Ja/Nein-Fragen über sich selbst. z.B. „Bin ich ein Mensch?" „Bin ich berühmt?"</div>
            <div class="rules-step">3️⃣ <strong>Erraten</strong><br>Wer glaubt zu wissen wer er ist, tippt auf ✓ Erraten. Wer es noch nicht weiß stellt weiter Fragen.</div>
            <div class="rules-step">🏆 <strong>Wer gewinnt?</strong><br>Wer seinen Begriff als erstes errät gewinnt die Runde. Alle können weiterspielen bis alle fertig sind.</div>
          </div>
        </template>
        <!-- Werwolf Anleitung -->
        <template v-if="state.showRulesGame==='ww'">
          <img src='./icons/games/werwolf.png' style='width:72px;height:72px;display:block;margin:0 auto .5rem;border-radius:16px'/>
          <h3 style="text-align:center;margin-bottom:1rem">Werwolf — Anleitung</h3>
          <div class="rules-section">
            <div class="rules-step">1️⃣ <strong>Rollen verteilen</strong><br>Jeder Spieler bekommt heimlich eine Rolle: Dorfbewohner, Werwolf, Seherin, Hexe oder andere Sonderrollen.</div>
            <div class="rules-step">🌙 <strong>Nachtphase</strong><br>Alle schließen die Augen. Der Spielleiter weckt die Werwölfe — sie wählen ein Opfer. Dann kommen Seherin und Hexe dran.</div>
            <div class="rules-step">☀️ <strong>Tagphase</strong><br>Das Dorf diskutiert, wer ein Werwolf sein könnte. Am Ende stimmt das Dorf ab und eliminiert einen Spieler.</div>
            <div class="rules-step">🔁 <strong>Rundenablauf</strong><br>Nacht und Tag wechseln sich ab bis das Dorf alle Werwölfe gefunden hat — oder die Werwölfe in der Mehrheit sind.</div>
            <div class="rules-step">🏆 <strong>Wer gewinnt?</strong><br>Das Dorf gewinnt wenn alle Werwölfe eliminiert sind. Die Werwölfe gewinnen wenn sie gleich viele oder mehr Spieler sind als das Dorf.</div>
          </div>
        </template>
        <!-- Codenames Anleitung -->
        <template v-if="state.showRulesGame==='cn'">
          <img src='./icons/games/codenames.png' style='width:72px;height:72px;display:block;margin:0 auto .5rem;border-radius:16px'/>
          <h3 style="text-align:center;margin-bottom:1rem">Codenames — Anleitung</h3>
          <div class="rules-section">
            <div class="rules-step">1️⃣ <strong>Teams bilden</strong><br>2 Teams (Rot & Blau). Jedes Team wählt einen Spymaster — der sieht die geheime Karte auf seinem Handy.</div>
            <div class="rules-step">2️⃣ <strong>Hinweis geben</strong><br>Der Spymaster gibt einen Ein-Wort-Hinweis + Zahl (z.B. „Tier, 3"). Die Zahl zeigt wie viele Wörter gemeint sind.</div>
            <div class="rules-step">3️⃣ <strong>Wörter erraten</strong><br>Das Team tippt auf Wörter die sie für richtig halten. Richtige Farbe = weiter raten. Falsche Farbe = Zug vorbei.</div>
            <div class="rules-step">☠️ <strong>Achtung: Schwarze Karte</strong><br>Wer die schwarze Karte aufdeckt verliert sofort das Spiel!</div>
            <div class="rules-step">🏆 <strong>Wer gewinnt?</strong><br>Das Team das alle seine Wörter zuerst aufdeckt gewinnt. Rot startet und hat eine Karte mehr.</div>
          </div>
        </template>
        <button class="btn-start" style="margin-top:1rem" @click="state.showRulesGame=null">Verstanden ✓</button>
      </div>
    </div>

    <!-- ── Hintergrund-Abdeckung für Coop-Spielphasen ── -->
    <div v-if="['myRole','discussion','postTimer','coopVoting','coopResult'].includes(state.coop.phase)"
      style="position:fixed;inset:0;background:var(--bg);z-index:395">
    </div>

    <!-- ── SPIELMENÜ ── -->
    <div v-if="state.gameMenu.active" class="modal-bg" @click.self="closeGameMenu">
      <div class="modal" style="animation:fadeIn .2s ease">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1.1rem">
          <span style="font-size:.9rem;letter-spacing:.15em;color:var(--gold);font-weight:700">SPIELMENÜ</span>
          <button class="icon-btn" @click="closeGameMenu">✕</button>
        </div>
        <button class="btn btn-primary" style="margin-bottom:.6rem" @click="closeGameMenu()">▶ Fortsetzen</button>
        <button class="btn btn-ghost" style="margin-bottom:.6rem" @click="state.showSettingsModal=true;state.gameMenu.active=false">⚙️ Einstellungen</button>
        <button class="btn btn-ghost" style="margin-bottom:.6rem" @click="state.showRulesGame='imposter';state.gameMenu.active=false">❓ Anleitung</button>
        <div style="height:1px;background:var(--bdr);margin:.4rem 0 .9rem"></div>
        <button class="btn btn-ghost" style="color:#e07070;border-color:#e07070" @click="state.gameEndConfirm=true;state.gameMenu.active=false">
          🚪 Spiel beenden
        </button>
      </div>
    </div>

    <!-- ── SPIEL BEENDEN BESTÄTIGUNG ── -->
    <div v-if="state.gameEndConfirm" class="modal-bg" style="z-index:510">
      <div class="modal">
        <div class="whatsnew-badge" style="background:var(--blood2)">⚠ Beenden</div>
        <h3>Spiel wirklich beenden?</h3>
        <p class="confirm-msg">Der aktuelle Spielstand geht verloren.</p>
        <button class="btn btn-ghost" style="color:#e07070;border-color:#e07070;margin-bottom:.6rem" @click="confirmEndGame">Ja, Spiel beenden</button>
        <button class="btn btn-primary" @click="state.gameEndConfirm=false;state.gamePaused=false;state.gameMenu.active=false">Nein, weiterspielen</button>
      </div>
    </div>

    <!-- ── COOP: MEINE KARTE + BESTÄTIGUNG ── -->
    <div v-if="state.coop.phase === 'myRole'" class="modal-bg" style="z-index:400">
      <div class="modal" style="text-align:center">
        <div class="whatsnew-badge">🕵️ Deine Karte</div>

        <!-- Karte: erst verdeckt, nach Antippen aufgedeckt -->
        <div @click="state.coop.cardRevealed = !state.coop.cardRevealed"
          style="cursor:pointer;margin:.8rem 0;padding:1rem;border-radius:16px;border:2px dashed var(--bdr);transition:border-color .2s"
          :style="state.coop.cardRevealed ? 'border-color:var(--gold)' : ''">
          <template v-if="!state.coop.cardRevealed">
            <div style="font-size:3rem">🃏</div>
            <div style="font-size:.85rem;color:var(--txt2);margin-top:.4rem">Antippen zum Aufdecken</div>
            <div style="font-size:.72rem;color:var(--txt3);margin-top:.2rem">(nur du siehst die Karte)</div>
          </template>
          <template v-else>
            <div v-if="state.coop.myRoleIsImposter">
              <div style="font-size:3rem;margin:.4rem 0">🕵️</div>
              <div style="font-size:1.2rem;font-weight:900;color:var(--blood2)">DU BIST DER IMPOSTER!</div>
              <p class="confirm-msg" style="margin:.4rem 0">Du kennst das Wort nicht. Tu so als ob!</p>
            </div>
            <div v-else>
              <div style="font-size:3rem;margin:.4rem 0">💬</div>
              <div style="font-size:.75rem;letter-spacing:.15em;color:var(--txt2)">DEIN WORT</div>
              <div style="font-size:2.2rem;font-weight:900;color:var(--gold);margin:.3rem 0">{{ state.coop.myWord }}</div>
              <p class="confirm-msg" style="margin:.3rem 0">Beschreibe es ohne das Wort zu sagen!</p>
            </div>
            <div style="font-size:.7rem;color:var(--txt3);margin-top:.5rem">Nochmal antippen zum Verbergen</div>
          </template>
        </div>

        <!-- Bestätigungs-Zähler -->
        <div style="font-size:.82rem;color:var(--txt2);margin:.4rem 0">
          <span style="font-weight:700;color:var(--gold)">{{ state.coop.cardConfirmedUids.length }}</span>
          von {{ state.coop.allPlayers.length }} haben bestätigt
        </div>
        <div class="timer-players" style="margin:.4rem 0">
          <div v-for="p in state.coop.allPlayers" :key="p.uid" class="timer-player-dot"
            :style="{background: state.coop.cardConfirmedUids.includes(p.uid) ? 'rgba(16,163,74,.5)' : 'rgba(124,58,237,.2)'}">
            {{ p.name[0].toUpperCase() }}
          </div>
        </div>

        <!-- Karte bestätigen: erst nach Aufdecken sichtbar -->
        <template v-if="!state.coop.cardRevealed && !state.coop.myCardConfirmed">
          <div style="font-size:.82rem;color:var(--txt3);margin-top:.6rem">
            👆 Tippe die Karte an um sie aufzudecken
          </div>
        </template>
        <template v-else-if="state.coop.myCardConfirmed">
          <div style="margin-top:.8rem;padding:.7rem;background:rgba(16,163,74,.15);border-radius:12px;border:1px solid rgba(16,163,74,.3)">
            <div style="font-size:1.3rem">✓</div>
            <div style="font-size:.85rem;color:var(--green)">Bestätigt — warte auf andere…</div>
          </div>
        </template>
        <template v-else>
          <button class="btn-start" style="margin-top:.8rem" @click="confirmCard">
            Ich hab meine Karte verstanden ✓
          </button>
        </template>
      </div>
    </div>

    <!-- ── COOP: DISKUSSION (Full Screen) ── -->
    <div v-if="state.coop.phase === 'discussion'"
      style="position:fixed;inset:0;background:var(--bg);z-index:400;display:flex;flex-direction:column;overflow-y:auto">
      <div class="top-bar">
        <div style="width:40px"></div>
        <span style="font-size:.78rem;letter-spacing:.15em;color:var(--gold);font-weight:700">IMPOSTER · MULTIPLAYER</span>
        <button class="icon-btn" @click="state.showSettingsModal=true" title="Einstellungen">⚙️</button>
      </div>
      <div class="timer-screen" style="flex:1">
        <div class="whatsnew-badge" style="margin-bottom:.5rem">💬 DISKUSSION</div>
        <h3 style="margin-bottom:.2rem">Jetzt diskutieren!</h3>
        <p class="timer-subtitle" style="margin-bottom:.8rem">
          Beschreibt das Wort abwechselnd — ohne es direkt zu sagen.<br>Wer verhält sich verdächtig?
        </p>

        <!-- Timer Ring -->
        <div style="position:relative;width:160px;height:160px;margin:0 auto .8rem">
          <svg width="160" height="160" viewBox="0 0 160 160">
            <circle cx="80" cy="80" r="68" fill="none" stroke="var(--bdr2)" stroke-width="10"/>
            <circle cx="80" cy="80" r="68" fill="none"
              :stroke="state.coop.coopTimerSeconds <= 10 ? '#ef4444' : state.coop.coopTimerSeconds <= 30 ? '#f59e0b' : 'var(--gold)'"
              stroke-width="10" stroke-linecap="round"
              :stroke-dasharray="2 * Math.PI * 68"
              :stroke-dashoffset="2 * Math.PI * 68 * (1 - state.coop.coopTimerSeconds / 120)"
              style="transform:rotate(-90deg);transform-origin:50% 50%;transition:stroke-dashoffset 1s linear,stroke .4s"/>
          </svg>
          <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);text-align:center;line-height:1">
            <div class="timer-sec"
              :style="{color: state.coop.coopTimerSeconds <= 10 ? '#ef4444' : state.coop.coopTimerSeconds <= 30 ? '#f59e0b' : 'var(--gold)'}">
              {{ state.coop.coopTimerSeconds }}
            </div>
            <div class="timer-sec-label">SEK</div>
          </div>
        </div>

        <div class="timer-players" style="margin-bottom:1.2rem">
          <div v-for="p in state.coop.allPlayers" :key="p.uid" class="timer-player-dot"
            style="background:rgba(124,58,237,.25)">
            {{ p.name[0].toUpperCase() }}
          </div>
        </div>

        <!-- Karte nochmal ansehen -->
        <button class="btn-sec" style="margin-bottom:.6rem;max-width:320px"
          @click="state.coop.showCardPeek=true">
          🃏 Meine Karte nochmal ansehen
        </button>

        <!-- Timer überspringen (nur Host) -->
        <button v-if="state.coop.isHost" class="timer-skip-btn" style="max-width:320px"
          @click="coopSkipTimer">
          Abstimmung starten →
        </button>
        <div v-else style="font-size:.75rem;color:var(--txt3);margin-top:.3rem">
          Warte auf den Host…
        </div>
      </div>

      <!-- Karten-Peek Modal -->
      <div v-if="state.coop.showCardPeek" class="modal-bg" style="z-index:410"
        @click.self="state.coop.showCardPeek=false">
        <div class="modal" style="text-align:center">
          <div v-if="state.coop.myRoleIsImposter">
            <div style="font-size:3rem;margin-bottom:.5rem">🕵️</div>
            <div style="font-size:1.1rem;font-weight:900;color:var(--blood2)">DU BIST DER IMPOSTER!</div>
            <p style="font-size:.85rem;color:var(--txt2);margin-top:.4rem">Du kennst das Wort nicht. Tu so als ob!</p>
          </div>
          <div v-else>
            <div style="font-size:.7rem;letter-spacing:.15em;color:var(--txt3);text-transform:uppercase;margin-bottom:.3rem">Dein Wort</div>
            <div style="font-size:2.2rem;font-weight:900;color:var(--gold)">{{ state.coop.myWord }}</div>
            <p style="font-size:.8rem;color:var(--txt2);margin-top:.4rem">Beschreibe es ohne das Wort zu sagen!</p>
          </div>
          <button class="btn-sec" style="margin-top:1rem" @click="state.coop.showCardPeek=false">✕ Schließen</button>
        </div>
      </div>
    </div>

    <!-- ── COOP: NACH DEM TIMER ── -->
    <div v-if="state.coop.phase === 'postTimer'" class="modal-bg" style="z-index:400">
      <div class="modal" style="text-align:center">
        <div class="whatsnew-badge" style="background:var(--blood2)">⏰ ZEIT ABGELAUFEN</div>
        <h3 style="margin-bottom:.3rem">Was jetzt?</h3>
        <p style="font-size:.8rem;color:var(--txt2);margin-bottom:.5rem">
          Stimmt ab: Noch eine Diskussionsrunde oder direkt zur Abstimmung?
        </p>
        <div style="font-size:.78rem;color:var(--txt3);margin-bottom:1rem">
          {{ state.coop.postTimerVoters.length }} / {{ state.coop.allPlayers.length }} haben abgestimmt
        </div>

        <div v-if="!state.coop.myPostTimerVote" style="display:flex;gap:.6rem;margin-bottom:.8rem">
          <button class="btn btn-ghost" style="flex:1;padding:.8rem .5rem;line-height:1.3" @click="sendPostTimerVote('extend')">
            🔄 Noch eine<br>Runde
            <div style="font-size:.7rem;opacity:.7;margin-top:.2rem">{{ state.coop.postTimerVotes.extend || 0 }} Stimmen</div>
          </button>
          <button class="btn btn-primary" style="flex:1;padding:.8rem .5rem;line-height:1.3" @click="sendPostTimerVote('vote')">
            🗳 Abstimmung<br>starten
            <div style="font-size:.7rem;opacity:.8;margin-top:.2rem">{{ state.coop.postTimerVotes.vote || 0 }} Stimmen</div>
          </button>
        </div>
        <div v-else style="padding:.8rem 0;color:var(--txt2);margin-bottom:.8rem">
          <div style="font-size:1.5rem;margin-bottom:.3rem">✓</div>
          Deine Stimme: <strong>{{ state.coop.myPostTimerVote === 'extend' ? 'Noch eine Runde' : 'Abstimmung' }}</strong>
          <br><span style="font-size:.75rem;color:var(--txt3)">Warte auf die anderen…</span>
        </div>

        <div class="timer-players">
          <div v-for="p in state.coop.allPlayers" :key="p.uid" class="timer-player-dot"
            :style="{background: state.coop.postTimerVoters.includes(p.uid) ? 'rgba(16,163,74,.5)' : 'rgba(124,58,237,.2)'}">
            {{ p.name[0].toUpperCase() }}
          </div>
        </div>
      </div>
    </div>

    <!-- ── WHATS NEW — nur wenn kein Update-Banner aktiv ── -->
    <div v-if="state.showWhatsNew && !state.showHistory && !state.updateReady" class="modal-bg">
      <div class="modal whatsnew-modal">
        <span class="whatsnew-badge">✨ {{ newChangelogs.length > 1 ? newChangelogs.length + ' NEUE VERSIONEN' : 'NEU IN VERSION ' + newChangelogs[0]?.version }}</span>
        <div class="wnv-scroll">
          <div v-for="cl in newChangelogs" :key="cl.version" class="wnv-entry">
            <div class="wnv-header-row">
              <div class="wnv-version">v{{ cl.version }}</div>
              <div class="wnv-date-chip">{{ cl.date }}</div>
            </div>
            <ul class="wnv-list">
              <li v-for="c in cl.changes" :key="c">{{ c }}</li>
            </ul>
          </div>
        </div>
        <button class="btn-start" style="margin-top:.5rem;flex-shrink:0" @click="dismissWhatsNew">Los geht's! 🎮</button>
      </div>
    </div>

    <!-- ── UPDATE BANNER (hat Vorrang vor Versionsmitteilung) ── -->
    <div v-if="state.updateReady" class="update-modal-overlay">
      <div class="update-modal" style="animation:fadeIn .25s ease">
        <div style="font-size:2.2rem;margin-bottom:.6rem">🆕</div>
        <span class="uc-badge" style="margin-bottom:.8rem">✦ UPDATE VERFÜGBAR</span>
        <div class="uc-title">Update ist bereit!</div>
        <div class="uc-desc">
          Eine neue Version steht bereit.<br>
          <span style="font-size:.75rem;color:var(--txt3)">Exportiere zuerst dein Protokoll falls nötig.</span>
        </div>
        <button class="btn-start" style="margin-bottom:.6rem" @click="applyUpdate">⬆ Aktualisieren & neu starten</button>
        <button class="uc-btn-export" @click="exportLogToFile">📋 Protokoll exportieren</button>
        <button class="uc-btn-later" @click="state.updateReady=false">Später</button>
      </div>
    </div>

    <!-- ── COOP: ABSTIMMUNG (jeder auf eigenem Handy) ── -->
    <div v-if="state.coop.phase === 'coopVoting'" class="modal-bg" style="z-index:400">
      <div class="modal" style="max-height:88vh;overflow-y:auto">
        <div class="whatsnew-badge" style="margin-bottom:.8rem">🗳 ABSTIMMUNG</div>
        <h3 style="margin-bottom:.3rem">Wer ist der Imposter?</h3>

        <!-- Fortschrittsanzeige: wer hat schon abgestimmt -->
        <div style="margin-bottom:.8rem">
          <div style="font-size:.78rem;color:var(--txt2);margin-bottom:.4rem">
            <span style="font-weight:700;color:var(--gold)">{{ state.coop.votesProgress.count }}</span>
            von {{ state.coop.votesProgress.total || state.coop.allPlayers.length }} haben abgestimmt
          </div>
          <div class="timer-players" style="gap:.3rem">
            <div v-for="p in state.coop.allPlayers" :key="p.uid" class="timer-player-dot"
              :style="{background: state.coop.votesProgress.voters?.includes(p.name) ? 'rgba(16,163,74,.5)' : 'rgba(124,58,237,.2)',fontSize:'.62rem'}">
              {{ p.name[0].toUpperCase() }}
            </div>
          </div>
        </div>

        <div v-if="!state.coop.myVoteDone">
          <p style="font-size:.8rem;color:var(--txt2);margin-bottom:.8rem">Wähle einen Spieler aus und bestätige.</p>
          <!-- Kandidaten -->
          <div class="voting-options">
            <button v-for="p in state.coop.allPlayers.filter(p => p.uid !== state.coop.myUid)"
              :key="p.uid" class="voting-option"
              :class="{'voting-option-selected': state.coop.voteSelection === p.name}"
              @click="coopSelectVote(p.name)">
              <div class="voting-option-avatar">{{ p.name[0].toUpperCase() }}</div>
              <div class="voting-option-name">{{ p.name }}</div>
              <div class="voting-option-check" v-if="state.coop.voteSelection === p.name">✓</div>
            </button>
          </div>
          <button class="voting-confirm-btn"
            :disabled="!state.coop.voteSelection"
            @click="coopConfirmVote"
            style="position:relative;margin-top:.8rem">
            {{ state.coop.voteSelection ? '✓ ' + state.coop.voteSelection + ' beschuldigen' : 'Spieler auswählen…' }}
          </button>
        </div>

        <div v-else style="text-align:center;padding:1rem 0">
          <div style="font-size:2rem;margin-bottom:.6rem">✓</div>
          <p style="color:var(--txt2);font-size:.9rem">Deine Stimme wurde abgegeben.<br>Warte auf die anderen…</p>
        </div>
      </div>
    </div>

    <!-- ── COOP: ERGEBNIS ── -->
    <div v-if="state.coop.phase === 'coopResult' && state.coop.voteResult" class="modal-bg" style="z-index:400">
      <div class="modal" style="text-align:center;max-height:88vh;overflow-y:auto">
        <div style="font-size:3.5rem;margin-bottom:.6rem">
          {{ state.coop.voteResult.winner === 'village' ? '🎉' : '🕵️' }}
        </div>
        <div style="font-size:1.3rem;font-weight:900;margin-bottom:.3rem"
          :style="{color: state.coop.voteResult.winner==='village' ? 'var(--green)' : 'var(--red2)'}">
          {{ state.coop.voteResult.winner === 'village' ? 'Imposter erwischt!' : 'Imposter gewinnt!' }}
        </div>
        <div style="color:var(--txt2);font-size:.85rem;margin-bottom:1.2rem">
          {{ state.coop.voteResult.winner === 'village' ? 'Die Gruppe hat gewonnen 🥳' : 'Der Imposter hat alle getäuscht 😈' }}
        </div>

        <div class="result-box" style="text-align:left;margin-bottom:1rem">
          <div style="font-size:.68rem;letter-spacing:.15em;color:var(--gold);text-transform:uppercase;margin-bottom:.6rem">Auflösung</div>
          <div style="margin-bottom:.5rem;font-size:.85rem">
            <span style="color:var(--txt3)">Imposter: </span>
            <span v-for="n in state.coop.voteResult.imposters" :key="n"
              style="background:rgba(176,32,32,.3);color:#f87171;border-radius:20px;padding:2px 10px;font-size:.78rem;margin-left:4px">{{ n }}</span>
          </div>
          <div style="border-top:1px solid var(--bdr);padding-top:.6rem">
            <div style="font-size:.65rem;letter-spacing:.15em;color:var(--txt3);text-transform:uppercase;margin-bottom:.5rem">Stimmen</div>
            <div v-for="p in state.coop.allPlayers" :key="p.uid" class="surv-item">
              <span>{{ p.name }}{{ p.isImposter ? ' 🕵️' : '' }}</span>
              <span style="margin-left:auto;color:var(--gold);font-weight:700">
                {{ state.coop.voteResult.tally[p.name] || 0 }}×
              </span>
              <span v-if="state.coop.voteResult.eliminated.includes(p.name)"
                style="background:rgba(124,58,237,.3);color:#c4b5fd;border-radius:20px;padding:2px 8px;font-size:.7rem;margin-left:.3rem">
                Raus
              </span>
            </div>
          </div>
        </div>

        <button class="btn-start" @click="cancelCoop">🏠 Zurück zum Menü</button>
      </div>
    </div>

    <!-- ── VERSIONSHISTORIE DETAIL ── -->
    <div v-if="state.showHistory && state.historyDetail" style="padding:1.2rem;max-width:480px;margin:0 auto">
      <div class="cl-detail-back" @click="state.historyDetail ? state.historyDetail=null : state.screen='home'">← Zurück</div>
      <div style="margin-bottom:.4rem">
        <span class="cl-version-num">v{{ state.historyDetail.version }}</span>
        <span class="cl-version-date" style="margin-left:.5rem">{{ state.historyDetail.date }}</span>
      </div>
      <ul style="list-style:none;padding:0;margin-top:.8rem">
        <li v-for="c in state.historyDetail.changes" :key="c" style="font-size:.85rem;color:var(--txt2);padding:.3rem 0;border-bottom:1px solid var(--bdr);display:flex;gap:.5rem">
          <span style="color:var(--gold);flex-shrink:0">✦</span>{{ c }}
        </li>
      </ul>
    </div>

    <!-- ── SETTINGS DRAWER ── -->
    <template v-if="state.showSettingsModal && !state.showHistory">
      <div class="settings-overlay" @click="state.showSettingsModal=false"></div>
      <div class="settings-drawer">
        <div class="drawer-head">
          <span class="drawer-title">⚙️ EINSTELLUNGEN</span>
          <button class="icon-btn" @click="state.showSettingsModal=false">✕</button>
        </div>
        <!-- Tab-Leiste -->
        <div class="stab-bar">
          <button class="stab-btn" :class="{active:state.settingsTab==='allgemein'}" @click="state.settingsTab='allgemein'">Allgemein</button>
          <button class="stab-btn" :class="{active:state.settingsTab==='daten'}" @click="state.settingsTab='daten'">Daten</button>
        </div>
        <div class="drawer-body">

          <!-- ── ALLGEMEIN ── -->
          <template v-if="state.settingsTab==='allgemein'">
            <div class="drawer-section">
              <div class="drawer-section-title">Darstellung</div>
              <div class="srow">
                <div><div class="slabel">Theme</div></div>
                <div class="theme-btns">
                  <button v-for="th in ['dark','light','auto']" :key="th"
                    class="theme-btn" :class="{active: state.settings.theme===th}"
                    @click="setTheme(th)">
                    {{ th==='dark'?'🌙 Dunkel':th==='light'?'☀️ Hell':'🔄 System' }}
                  </button>
                </div>
              </div>
              <div class="srow">
                <div><div class="slabel">Sprache</div></div>
                <select class="lsel" :value="state.settings.lang" @change="setLang($event.target.value)">
                  <option v-for="l in SUPPORTED_LOCALES" :key="l.id" :value="l.id">{{ l.label }}</option>
                </select>
              </div>
            </div>

            <div class="drawer-section">
              <div class="drawer-section-title">Über die App</div>
              <div class="srow">
                <div><div class="slabel">Version</div><div class="ssub">Gruppen-Spiele</div></div>
                <span class="verbadge">v{{ BUILD }}</span>
              </div>
              <div class="srow">
                <div><div class="slabel">Versionshistorie</div><div class="ssub">Alle Änderungen</div></div>
                <button class="ver-hist-btn" @click="state.screen='history';state.showSettingsModal=false;state.historyDetail=null">Anzeigen</button>
              </div>
              <div class="srow">
                <div><div class="slabel">Auf Update prüfen</div><div class="ssub">Sucht nach neuer Version</div></div>
                <button class="ver-hist-btn" @click="checkForUpdate" style="white-space:nowrap">🔄 Prüfen</button>
              </div>
              <div v-if="state.updateReady" class="srow">
                <div><div class="slabel">Update verfügbar</div></div>
                <button class="ver-hist-btn" @click="applyUpdate" style="color:var(--gold)">Installieren</button>
              </div>
            </div>
          </template>

          <!-- ── DATEN ── -->
          <template v-else-if="state.settingsTab==='daten'">
            <div class="drawer-section">
              <div class="drawer-section-title">Sicherung</div>
              <button class="srow-btn" @click="exportBackup">📤 Backup exportieren</button>
              <button class="srow-btn" @click="importBackup">📥 Backup importieren</button>
            </div>
            <div class="drawer-section">
              <div class="drawer-section-title">Diagnose</div>
              <button class="srow-btn" @click="exportLogToFile">🐛 Diagnoseprotokoll exportieren</button>
            </div>
          </template>

        </div>
      </div>
    </template>

    <!-- ══════════════════════════════════════════════════════════════════ -->
    <!-- ── LOBBY HISTORY SCREEN ── -->
    <!-- ══════════════════════════════════════════════════════════════════ -->
    <template v-if="state.screen === 'lobbyHistory'">
      <div class="top-bar">
        <button class="icon-btn" @click="state.screen='result'">←</button>
      </div>
      <div style="padding:0 1.2rem 3rem;max-width:480px;margin:0 auto">
        <div style="padding:1.2rem 0 .8rem;font-size:1.1rem;font-weight:900;color:var(--txt)">
          📋 Rundenhistorie
        </div>

        <!-- Gesamtpunktestand -->
        <div v-if="state.roundsTotal > 1 || state.lobbyHistory.length > 1" class="scores-box" style="margin-bottom:1.2rem">
          <div style="font-size:.68rem;letter-spacing:.15em;color:var(--gold);text-transform:uppercase;margin-bottom:.7rem">
            🏆 Gesamtpunktestand
          </div>
          <div v-for="(pts, name) in Object.fromEntries(Object.entries(state.scores).sort(([,a],[,b])=>b-a))"
            :key="name" class="score-row">
            <span style="font-weight:600">{{ name }}</span>
            <span class="score-val">{{ pts }} Pkt</span>
          </div>
          <div v-if="!Object.keys(state.scores).length" style="font-size:.82rem;color:var(--txt3)">
            Noch keine Punkte
          </div>
        </div>

        <!-- Runden-Karten -->
        <div v-for="entry in [...state.lobbyHistory].reverse()" :key="entry.round"
          class="history-card">
          <!-- Header -->
          <div class="history-card-head">
            <span class="history-round-badge">Runde {{ entry.round }}</span>
            <span class="history-winner-badge"
              :style="{background: entry.winner==='village' ? 'rgba(16,163,74,.25)' : 'rgba(220,38,38,.25)',
                       color: entry.winner==='village' ? '#4ade80' : '#f87171'}">
              {{ entry.winner === 'village' ? '🎉 Dorf gewinnt' : '🕵️ Imposter gewinnt' }}
            </span>
          </div>

          <!-- Wort -->
          <div style="margin:.6rem 0;font-size:.82rem;color:var(--txt2)">
            Wort: <strong style="color:var(--txt)">{{ entry.word }}</strong>
          </div>

          <!-- Imposter -->
          <div style="font-size:.78rem;color:var(--txt2);margin-bottom:.5rem">
            Imposter:
            <span v-for="n in entry.imposters" :key="n"
              style="background:rgba(176,32,32,.25);color:#f87171;border-radius:20px;padding:1px 8px;margin-left:4px;font-size:.72rem">
              {{ n }}
            </span>
          </div>

          <!-- Stimmen -->
          <div style="border-top:1px solid var(--bdr);padding-top:.5rem;margin-top:.3rem">
            <div style="font-size:.65rem;letter-spacing:.12em;color:var(--txt3);text-transform:uppercase;margin-bottom:.4rem">
              Stimmen
            </div>
            <div v-for="r in entry.roles" :key="r.name"
              style="display:flex;justify-content:space-between;font-size:.8rem;padding:.2rem 0;border-bottom:1px solid var(--bdr)">
              <span>{{ r.name }}{{ r.isImposter ? ' 🕵️' : '' }}</span>
              <div style="display:flex;align-items:center;gap:.4rem">
                <span style="color:var(--gold);font-weight:700">{{ entry.tally[r.name] || 0 }}×</span>
                <span v-if="entry.eliminated.includes(r.name)"
                  style="background:rgba(124,58,237,.25);color:#c4b5fd;border-radius:20px;padding:1px 7px;font-size:.67rem">
                  Raus
                </span>
              </div>
            </div>
          </div>
        </div>

        <button class="btn-sec" style="margin-top:1.2rem" @click="state.screen='result'">
          ← Zurück
        </button>
      </div>
    </template>


    <!-- ══════════════════════════════════════════════════════════════════ -->
    <!-- ── WER BIN ICH? SCREEN ── -->
    <!-- ══════════════════════════════════════════════════════════════════ -->
    <template v-if="state.screen === 'wbi'">
      <div class="top-bar">
        <!-- Im Setup: Zurück-Pfeil. Im Spiel: Pause-Button -->
        <button v-if="wbiState.phase === 'setup'" class="back-corner icon-btn"
          @click="state.screen='home';wbiRestart()" title="Zurück">←</button>
        <button v-else class="icon-btn"
          @click="state.wbiMenu=true" title="Spielmenü">⏸</button>
        <button class="icon-btn" @click="state.showSettingsModal=true" title="Einstellungen">⚙️</button>
      </div>
      <!-- WBI Spielmenü -->
      <div v-if="state.wbiMenu" class="modal-bg" @click.self="state.wbiMenu=false">
        <div class="modal" style="animation:fadeIn .2s ease">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1.1rem">
            <span style="font-size:.9rem;letter-spacing:.15em;color:var(--gold);font-weight:700">SPIELMENÜ</span>
            <button class="icon-btn" @click="state.wbiMenu=false">✕</button>
          </div>
          <button class="btn btn-primary" style="margin-bottom:.6rem" @click="state.wbiMenu=false">▶ Fortsetzen</button>
          <button class="btn btn-ghost" style="margin-bottom:.6rem" @click="state.showSettingsModal=true;state.wbiMenu=false">⚙️ Einstellungen</button>
          <button class="btn btn-ghost" style="margin-bottom:.6rem" @click="state.showRulesGame='wbi';state.wbiMenu=false">❓ Anleitung</button>
          <div style="height:1px;background:var(--bdr);margin:.4rem 0 .9rem"></div>
          <button class="btn btn-ghost" style="color:#e07070;border-color:#e07070"
            @click="state.wbiEndConfirm=true;state.wbiMenu=false">
            🚪 Spiel beenden
          </button>
        </div>
      </div>

      <!-- WBI Beenden Bestätigung -->
      <div v-if="state.wbiEndConfirm" class="modal-bg" style="z-index:510">
        <div class="modal">
          <div class="whatsnew-badge" style="background:var(--red2)">⚠ Beenden</div>
          <h3>Spiel wirklich beenden?</h3>
          <p class="confirm-msg">Der aktuelle Spielstand geht verloren.</p>
          <button class="btn btn-ghost" style="color:#e07070;border-color:#e07070;margin-bottom:.6rem"
            @click="state.wbiEndConfirm=false;wbiRestart();state.screen='home'">
            Ja, Spiel beenden
          </button>
          <button class="btn btn-primary" @click="state.wbiEndConfirm=false">Nein, weiterspielen</button>
        </div>
      </div>

      <div style="padding:0 1.2rem 3rem;max-width:480px;margin:0 auto">
        <div style="padding:1rem 0 .6rem;font-size:1.2rem;font-weight:900;color:var(--txt)">🤔 Wer bin ich?</div>

        <!-- SETUP -->
        <template v-if="wbiState.phase === 'setup' && wbiState.coop.phase !== 'playing' && wbiState.coop.phase !== 'result'">
          <!-- Spielmodus -->
          <div class="sec">
            <h2>📱 Spielmodus</h2>
            <div class="mode-grid">
              <div class="mode-card" :class="{active: wbiState.gameMode==='local'}" @click="wbiSelectMode('local')">
                <span class="mode-icon">📱</span>
                <div class="mode-name">Ein Gerät</div>
                <div class="mode-desc">Alle spielen auf einem Handy</div>
              </div>
              <div class="mode-card" :class="{active: wbiState.gameMode==='coop'}" @click="wbiSelectMode('coop')">
                <span class="mode-icon">🌐</span>
                <div class="mode-name">Multiplayer</div>
                <div class="mode-desc">Jeder auf eigenem Handy</div>
              </div>
            </div>
          </div>

          <!-- COOP Setup -->
          <div v-if="wbiState.gameMode==='coop'" class="coop-box">
            <!-- Idle -->
            <div v-if="wbiState.coop.phase==='idle'" style="display:flex;gap:.6rem">
              <button class="btn-create-room" style="flex:1;margin-top:0" @click="wbiShowHostSetup">🏠 Raum erstellen</button>
              <button class="btn-create-room" style="flex:1;margin-top:0;background:linear-gradient(135deg,#0ea5e9,#0284c7)" @click="wbiShowJoinSetup">🚪 Beitreten</button>
            </div>
            <!-- Hosting -->
            <div v-if="wbiState.coop.phase==='hosting'">
              <div class="coop-hint">Dein Name</div>
              <input class="name-input-big" v-model="wbiState.coop.myName" placeholder="Name eingeben..." />
              <div class="coop-hint" style="margin-top:.8rem">Raumcode (6 Ziffern)</div>
              <input class="code-input" v-model="wbiState.coop.codeDraft" maxlength="6" type="tel" inputmode="numeric" placeholder="z.B. 123456"
                style="font-size:1.6rem;letter-spacing:.3em;text-align:center;padding:.8rem" />
              <div v-if="wbiState.coop.error" class="coop-error">{{ wbiState.coop.error }}</div>
              <button class="btn-create-room"
                :disabled="wbiState.coop.codeDraft.replace(/[^0-9]/g,'').length!==6 || !wbiState.coop.myName.trim()"
                @click="wbiCreateRoom">🏠 Raum erstellen</button>
              <button class="btn-sec" style="margin-top:.5rem" @click="wbiState.coop.phase='idle'">Abbrechen</button>
            </div>
            <!-- Lobby -->
            <div v-if="wbiState.coop.phase==='lobby'">
              <div class="invite-box">
                <span class="invite-code">{{ wbiState.coop.code }}</span>
                <button class="btn-sec btn-sm" @click="wbiShareLink">🔗 Link teilen</button>
              </div>
              <div class="coop-hint">Spieler in der Lobby</div>
              <ul class="lobby-list">
                <li v-for="p in wbiState.coop.players" :key="p.uid" class="lobby-item">
                  <span class="li-icon">{{ p.isHost ? '👑' : '👤' }}</span>
                  <span class="li-name">{{ p.name }}</span>
                  <span class="li-ready" :class="p.isHost ? 'host' : p.ready ? 'yes' : 'no'">
                    {{ p.isHost ? 'Host' : p.ready ? '✓ Bereit' : 'Wartet…' }}
                  </span>
                </li>
              </ul>
              <button class="btn-create-room" :disabled="wbiState.coop.players.length < 2" @click="wbiStartCoopGame">
                ▶ Spiel starten ({{ wbiState.coop.players.length }} Spieler)
              </button>
              <button class="btn-sec" style="margin-top:.5rem" @click="wbiCancelCoop">Verlassen</button>
            </div>
            <!-- Joining -->
            <div v-if="wbiState.coop.phase==='joining'">
              <div class="coop-hint">Dein Name</div>
              <input class="name-input-big" v-model="wbiState.coop.myName" placeholder="Name eingeben..." />
              <div class="coop-hint" style="margin-top:.8rem">Raumcode (6 Ziffern)</div>
              <input class="code-input" v-model="wbiState.coop.codeDraft" maxlength="6" type="tel" inputmode="numeric" placeholder="z.B. 123456"
                style="font-size:1.6rem;letter-spacing:.3em;text-align:center;padding:.8rem" />
              <div v-if="wbiState.coop.error" class="coop-error">{{ wbiState.coop.error }}</div>
              <button class="btn-create-room"
                :disabled="wbiState.coop.codeDraft.replace(/[^0-9]/g,'').length!==6 || !wbiState.coop.myName.trim()"
                @click="wbiJoinRoom">🚪 Beitreten</button>
              <button class="btn-sec" style="margin-top:.5rem" @click="wbiState.coop.phase='idle'">Abbrechen</button>
            </div>
            <!-- Joined: Lobby-Ansicht -->
            <div v-if="wbiState.coop.phase==='joined'">
              <div class="invite-box" style="margin-bottom:.8rem">
                <span class="invite-code">{{ wbiState.coop.code }}</span>
              </div>
              <div class="coop-hint">Lobby ({{ wbiState.coop.lobbyPlayers.length }} Spieler)</div>
              <ul class="lobby-list" v-if="wbiState.coop.lobbyPlayers.length">
                <li v-for="p in wbiState.coop.lobbyPlayers" :key="p.uid" class="lobby-item">
                  <span class="li-icon">{{ p.isHost ? '👑' : '👤' }}</span>
                  <span class="li-name">{{ p.name }}</span>
                  <span class="li-ready" :class="p.isHost ? 'host' : p.ready ? 'yes' : 'no'">
                    {{ p.isHost ? 'Host' : p.ready ? '✓ Bereit' : 'Wartet…' }}
                  </span>
                </li>
              </ul>
              <div v-else style="text-align:center;padding:.6rem;color:var(--txt2);font-size:.85rem">⏳ Verbinde…</div>
              <button class="btn-create-room" style="margin-top:.8rem;background:linear-gradient(135deg,#16a34a,#15803d)"
                @click="wbiToggleReady">
                {{ wbiState.coop.myReady ? '✗ Nicht mehr bereit' : '✅ Ich bin bereit!' }}
              </button>
              <button class="btn-sec" style="margin-top:.5rem" @click="wbiCancelCoop">Verlassen</button>
            </div>
          </div>

          <!-- LOKAL Setup -->
          <template v-if="wbiState.gameMode==='local'">
            <div class="sec">
              <h2>👥 Spieler</h2>
              <div class="pc-row" style="margin-bottom:.8rem">
                <button class="cnt-btn" @click="wbiState.playerCount = Math.max(2, wbiState.playerCount-1)">−</button>
                <div class="pc-stepper">
                  <div class="pc-num">{{ wbiState.playerCount }}</div>
                  <div class="cnt-lbl">Spieler</div>
                </div>
                <button class="cnt-btn" @click="wbiState.playerCount = Math.min(16, wbiState.playerCount+1)">+</button>
              </div>
              <div class="names-scroll">
                <div class="names-grid">
                  <div v-for="(name, i) in wbiState.playerNames.slice(0, wbiState.playerCount)" :key="i" class="nwrap">
                    <span>{{ i+1 }}</span>
                    <input class="ninput" v-model="wbiState.playerNames[i]" :placeholder="'Spieler '+(i+1)" type="text" autocomplete="off" />
                  </div>
                </div>
              </div>
            </div>

            <!-- Kategorien -->
            <div class="sec">
              <h2 style="cursor:pointer" @click="wbiState.showKats=!wbiState.showKats">
                🗂 Kategorien
                <span style="font-size:.75rem;color:var(--txt3);font-weight:500;letter-spacing:0;text-transform:none;margin-left:.4rem">
                  {{ wbiState.selectedKats.length }} / {{ Object.keys(WBI_KATEGORIEN).length }}
                </span>
                <span style="margin-left:auto;font-size:.9rem;color:var(--txt3)">{{ wbiState.showKats ? '▲' : '▼' }}</span>
              </h2>
              <div v-if="wbiState.showKats">
                <div style="display:flex;gap:.5rem;margin-bottom:.7rem">
                  <button class="btn-sec btn-sm" style="flex:1" @click="wbiState.selectedKats=Object.keys(WBI_KATEGORIEN)">✓ Alle</button>
                  <button class="btn-sec btn-sm" style="flex:1" @click="wbiState.selectedKats=[]">✗ Keine</button>
                </div>
                <div class="kat-grid">
                  <button v-for="(words, kat) in WBI_KATEGORIEN" :key="kat"
                    class="kat-btn" :class="{'kat-btn-active': wbiState.selectedKats.includes(kat)}"
                    @click="wbiState.selectedKats.includes(kat)
                      ? wbiState.selectedKats=wbiState.selectedKats.filter(k=>k!==kat)
                      : wbiState.selectedKats.push(kat)">
                    <span class="kat-label">{{ kat }}</span>
                    <span class="kat-count">{{ words.length }} Karten</span>
                  </button>
                </div>
                <!-- Eigene Karten -->
                <div style="margin-top:1rem">
                  <div style="font-size:.72rem;color:var(--txt3);letter-spacing:.1em;text-transform:uppercase;margin-bottom:.5rem">➕ Eigene Begriffe</div>
                  <div style="display:flex;gap:.5rem">
                    <input class="ninput" v-model="wbiState.customCardDraft" placeholder="Begriff eingeben..." style="flex:1;margin:0;padding:.5rem .7rem"
                      @keydown.enter="wbiState.customCardDraft.trim() && !wbiState.customCards.includes(wbiState.customCardDraft.trim()) && wbiState.customCards.push(wbiState.customCardDraft.trim()) && (wbiState.customCardDraft='')" />
                    <button class="btn-sec btn-sm" @click="wbiState.customCardDraft.trim() && (wbiState.customCards.push(wbiState.customCardDraft.trim()), wbiState.customCardDraft='')">+ Add</button>
                  </div>
                  <div v-if="wbiState.customCards.length" style="display:flex;flex-wrap:wrap;gap:.4rem;margin-top:.6rem">
                    <span v-for="w in wbiState.customCards" :key="w" class="custom-word-tag">
                      {{ w }}
                      <button @click="wbiState.customCards=wbiState.customCards.filter(x=>x!==w)" style="background:none;border:none;color:var(--txt3);cursor:pointer;margin-left:.2rem">×</button>
                    </span>
                  </div>
                </div>
              </div>
              <div v-else style="display:flex;flex-wrap:wrap;gap:.3rem;margin-top:.4rem">
                <span v-for="kat in wbiState.selectedKats.slice(0,3)" :key="kat" style="font-size:.7rem;background:rgba(124,58,237,.15);border:1px solid rgba(124,58,237,.3);border-radius:20px;padding:2px 8px;color:var(--gold)">
                  {{ kat.split(' ').slice(1).join(' ') }}
                </span>
                <span v-if="wbiState.selectedKats.length>3" style="font-size:.7rem;color:var(--txt3)">+{{ wbiState.selectedKats.length-3 }}</span>
              </div>
            </div>

            <button class="btn-start" @click="wbiStartLocal" :disabled="wbiState.playerCount < 2">
              ▶ Spiel starten
            </button>
          </template>
        </template>

        <!-- LOKAL: PHASE 1 — KARTEN VERTEILEN -->
        <template v-if="wbiState.phase === 'local-reveal' && wbiState.localPhase === 'distribute'">
          <div style="text-align:center;margin-bottom:.8rem">
            <div style="font-size:.72rem;color:var(--txt3);letter-spacing:.12em;text-transform:uppercase">
              Schritt 1: Karten verteilen — {{ wbiState.currentIdx + 1 }} / {{ wbiState.localCards.length }}
            </div>
            <div class="prog-bar" style="margin-top:.5rem">
              <div class="prog-fill" :style="{width: ((wbiState.currentIdx)/wbiState.localCards.length*100)+'%'}"></div>
            </div>
          </div>

          <div class="wbi-card-wrap">
            <div class="wbi-for-label">Karte für</div>
            <div class="wbi-player-name">{{ wbiState.localCards[wbiState.currentIdx]?.playerName }}</div>
            <div class="wbi-hint" v-if="!wbiState.showCard">
              📱 <strong>{{ wbiState.localCards[wbiState.currentIdx]?.playerName }}</strong> hält das Handy mit dem Bildschirm zur Gruppe.<br>
              Alle außer {{ wbiState.localCards[wbiState.currentIdx]?.playerName }} schauen drauf!
            </div>
            <div class="wbi-hint" v-else style="color:var(--gold)">
              👥 Alle anderen sehen jetzt den Begriff! {{ wbiState.localCards[wbiState.currentIdx]?.playerName }} schaut weg. Nochmals antippen zum Schließen.
            </div>

            <!-- Karte: Antippen öffnet/schließt -->
            <div class="wbi-card" :class="{'wbi-card-visible': wbiState.showCard}"
              @click="wbiState.showCard ? wbiHideCard() : wbiShowCard()"
              style="cursor:pointer;width:100%;max-width:340px">
              <div v-if="!wbiState.showCard" class="wbi-card-back">
                <div style="font-size:3rem;margin-bottom:.6rem">🤔</div>
                <div style="font-size:.85rem;letter-spacing:.1em;color:var(--txt2);text-transform:uppercase">
                  Antippen zum Aufdecken
                </div>
              </div>
              <div v-else class="wbi-card-front">
                <div style="font-size:.75rem;letter-spacing:.12em;color:var(--txt3);text-transform:uppercase;margin-bottom:.4rem">
                  {{ wbiState.localCards[wbiState.currentIdx]?.category }}
                </div>
                <div class="wbi-word">{{ wbiState.localCards[wbiState.currentIdx]?.word }}</div>
                <div style="font-size:.8rem;color:var(--txt3);margin-top:.8rem">
                  {{ wbiState.localCards[wbiState.currentIdx]?.playerName }} schaut weg! Nochmals antippen zum Schließen 👆
                </div>
              </div>
            </div>

            <!-- Weiter: nur wenn Karte geschlossen -->
            <!-- Weiter nur wenn Karte gesehen UND wieder geschlossen -->
            <button v-if="wbiState.cardSeen && !wbiState.showCard"
              class="btn-start" style="margin-top:1rem" @click="wbiNextCard()">
              {{ wbiState.currentIdx + 1 >= wbiState.localCards.length ? '▶ Diskussion starten' : '➡ Weiter zu ' + (wbiState.localCards[wbiState.currentIdx+1]?.playerName || '') }}
            </button>
            <div v-if="!wbiState.cardSeen" style="text-align:center;margin-top:.8rem;font-size:.82rem;color:var(--txt3)">
              👆 Erst Karte aufdecken
            </div>
          </div>
        </template>

        <!-- LOKAL: PHASE 2 — DISKUSSION -->
        <template v-if="wbiState.phase === 'local-reveal' && wbiState.localPhase === 'discuss'">
          <div style="text-align:center;margin-bottom:.8rem">
            <div style="font-size:.9rem;font-weight:700;color:var(--txt)">💬 Schritt 2: Diskutieren!</div>
            <div style="font-size:.8rem;color:var(--txt2);margin-top:.3rem">
              Stellt euch gegenseitig Ja/Nein-Fragen. Tippt auf euren Namen um eure Karte kurz zu sehen.
            </div>
          </div>

          <!-- Alle Spieler-Karten -->
          <div v-for="(card, idx) in wbiState.localCards" :key="idx" style="margin-bottom:.7rem">
            <!-- Spieler-Header: Antippen öffnet/schließt Karte -->
            <div class="wbi-discuss-player"
              @click="wbiToggleDiscussCard(idx)"
              :class="{'wbi-discuss-player-active': wbiState.discussIdx===idx && wbiState.discussCardVisible}">
              <div class="wbi-discuss-avatar">{{ card.playerName[0].toUpperCase() }}</div>
              <div class="wbi-discuss-name">{{ card.playerName }}</div>
              <div style="margin-left:auto;font-size:.8rem;color:var(--txt3)">
                {{ wbiState.discussIdx===idx && wbiState.discussCardVisible ? '🙈 zuklappen' : '👆 meine Karte' }}
              </div>
            </div>

            <!-- Karte aufgeklappt -->
            <div v-if="wbiState.discussIdx===idx && wbiState.discussCardVisible"
              class="wbi-discuss-card" @click="wbiToggleDiscussCard(idx)">
              <div style="font-size:.7rem;color:var(--txt3);margin-bottom:.3rem">{{ card.category }}</div>
              <div class="wbi-word" style="font-size:1.8rem">{{ card.word }}</div>
              <div style="font-size:.75rem;color:var(--txt3);margin-top:.4rem">Antippen zum Schließen 👆</div>
            </div>
          </div>

          <button class="btn-start" style="margin-top:1rem" @click="wbiStartResolve">
            ✓ Auflösung — Wer hat's erraten?
          </button>
        </template>

        <!-- LOKAL: PHASE 3 — AUFLÖSUNG -->
        <template v-if="wbiState.phase === 'local-reveal' && wbiState.localPhase === 'resolve'">
          <div style="text-align:center;margin-bottom:1rem">
            <div style="font-size:.9rem;font-weight:700;color:var(--txt)">🎯 Schritt 3: Auflösung</div>
            <div style="font-size:.8rem;color:var(--txt2);margin-top:.3rem">Wer hat seinen Begriff erraten?</div>
          </div>

          <div v-for="(card, idx) in wbiState.localCards" :key="idx" class="wbi-resolve-row">
            <div class="wbi-resolve-player">
              <div class="wbi-discuss-avatar" style="width:44px;height:44px;font-size:1.1rem">
                {{ card.playerName[0].toUpperCase() }}
              </div>
              <div style="flex:1">
                <div style="font-weight:700;font-size:.95rem">{{ card.playerName }}</div>
                <div style="font-size:.78rem;color:var(--txt3)">{{ card.word }}</div>
              </div>
              <!-- Noch nicht bewertet -->
              <template v-if="!card.guessed && !card.skipped">
                <button class="wbi-resolve-yes" @click="wbiMarkGuessed(idx)">✓ Ja</button>
                <button class="wbi-resolve-no"  @click="wbiMarkNotGuessed(idx)">✗ Nein</button>
              </template>
              <!-- Bewertet -->
              <span v-else-if="card.guessed"
                style="background:rgba(16,163,74,.2);color:#4ade80;border-radius:20px;padding:4px 12px;font-size:.8rem;font-weight:700">
                ✓ Erraten
              </span>
              <span v-else
                style="background:rgba(220,38,38,.15);color:#f87171;border-radius:20px;padding:4px 12px;font-size:.8rem;font-weight:700">
                ✗ Nicht erraten
              </span>
            </div>
          </div>
        </template>

        <!-- COOP: MEINE KARTE -->
        <template v-if="wbiState.coop.phase === 'playing'">
          <div class="wbi-card-wrap" style="text-align:center">
            <div class="wbi-for-label">Deine Karte (nur du siehst sie NICHT)</div>
            <div class="wbi-player-name">Du bist…</div>
            <div class="wbi-hint" v-if="!wbiState.coop.cardFlipped" style="margin-bottom:.5rem">
              📱 Antippen um deine Karte kurz zu sehen — dann wieder antippen zum Verdecken.
            </div>
            <div class="wbi-card" :class="{'wbi-card-visible': wbiState.coop.cardFlipped}"
              @click="wbiState.coop.cardFlipped = !wbiState.coop.cardFlipped"
              style="cursor:pointer;margin:1rem 0;width:100%;max-width:340px">
              <div v-if="!wbiState.coop.cardFlipped" class="wbi-card-back">
                <div style="font-size:3rem;margin-bottom:.6rem">🤔</div>
                <div style="font-size:.85rem;letter-spacing:.1em;color:var(--txt2);text-transform:uppercase">Antippen zum Aufdecken</div>
              </div>
              <div v-if="wbiState.coop.cardFlipped" class="wbi-card-front">
                <div style="font-size:.75rem;color:var(--txt3);margin-bottom:.4rem">{{ wbiState.coop.myCard?.category }}</div>
                <div class="wbi-word">{{ wbiState.coop.myCard?.word }}</div>
                <div style="font-size:.78rem;color:var(--txt2);margin-top:.6rem">
                  Die anderen sehen deine Karte. Stelle Ja/Nein-Fragen!
                </div>
              </div>
            </div>
            <div style="font-size:.85rem;color:var(--txt2);margin-bottom:1rem">Hast du erraten wer du bist?</div>
            <button class="btn-start" @click="wbiSendGuess(true)">✓ Ja, ich hab's erraten!</button>
            <button class="btn-sec" style="margin-top:.5rem" @click="wbiSendGuess(false)">✗ Noch nicht</button>

            <!-- Guess-History -->
            <div v-if="wbiState.coop.guesses.length" style="margin-top:1.2rem;text-align:left">
              <div style="font-size:.68rem;letter-spacing:.12em;color:var(--txt3);text-transform:uppercase;margin-bottom:.5rem">Verlauf</div>
              <div v-for="g in wbiState.coop.guesses" :key="g.ts" class="surv-item">
                <span>{{ g.correct ? '✓' : '✗' }}</span>
                <span>{{ g.name }}: <strong>{{ g.word }}</strong></span>
              </div>
            </div>
          </div>
        </template>

        <!-- ERGEBNIS -->
        <template v-if="wbiState.phase === 'result' || wbiState.coop.phase === 'result'">
          <div class="go-inner" style="padding-top:1rem">
            <div class="wicon">🎉</div>
            <div class="wtitle">Runde vorbei!</div>
            <div class="wsub">{{ wbiState.results.filter(r=>r.guessed).length }} von {{ wbiState.results.length }} erraten</div>

            <div class="surv-box" style="width:100%">
              <h3>Ergebnisse</h3>
              <div v-for="r in wbiState.results" :key="r.playerName" class="surv-item">
                <span style="font-size:1rem">{{ r.guessed ? '✓' : '✗' }}</span>
                <div style="flex:1">
                  <div style="font-weight:600">{{ r.playerName }}</div>
                  <div style="font-size:.75rem;color:var(--txt3)">{{ r.word }}</div>
                </div>
                <span :style="{color: r.guessed ? 'var(--green)' : 'var(--red2)', fontWeight:700}">
                  {{ r.guessed ? '+1' : '0' }}
                </span>
              </div>
            </div>

            <button class="btn-start" @click="wbiRestart();wbiCancelCoop()">🔄 Neues Spiel</button>
            <button class="btn-sec" style="margin-top:.5rem" @click="state.screen='home';wbiRestart();wbiCancelCoop()">🏠 Hauptmenü</button>
          </div>
        </template>

      </div>
    </template>


    <!-- ══════════════════════════════════════════════════════════════════ -->
    <!-- ── CODENAMES SCREEN ── -->
    <!-- ══════════════════════════════════════════════════════════════════ -->
    <template v-if="state.screen === 'cn'">
      <div class="top-bar">
        <button v-if="cnState.phase === 'setup'" class="back-corner icon-btn"
          @click="state.screen='home';cnReset()" title="Zurück">←</button>
        <button v-if="cnState.phase === 'setup'" class="icon-btn"
          @click="state.showSettingsModal=true" title="Einstellungen">⚙️</button>
        <button v-if="cnState.phase !== 'setup'" class="icon-btn"
          @click="cnState.cnMenu=true" title="Spielmenü">⏸</button>
      </div>

      <!-- CN Spielmenü -->
      <div v-if="cnState.cnMenu" class="modal-bg" @click.self="cnState.cnMenu=false">
        <div class="modal">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1.1rem">
            <span style="font-size:.9rem;letter-spacing:.15em;color:var(--gold);font-weight:700">SPIELMENÜ</span>
            <button class="icon-btn" @click="cnState.cnMenu=false">✕</button>
          </div>
          <button class="btn btn-primary" style="margin-bottom:.6rem" @click="cnState.cnMenu=false">▶ Fortsetzen</button>
          <button class="btn btn-ghost" style="margin-bottom:.6rem" @click="state.showSettingsModal=true;cnState.cnMenu=false">⚙️ Einstellungen</button>
          <button class="btn btn-ghost" style="margin-bottom:.6rem" @click="state.showRulesGame='cn';cnState.cnMenu=false">❓ Anleitung</button>
          <div style="height:1px;background:var(--bdr);margin:.4rem 0 .9rem"></div>
          <button class="btn btn-ghost" style="color:#e07070;border-color:#e07070"
            @click="cnState.cnEndConfirm=true;cnState.cnMenu=false">🚪 Spiel beenden</button>
        </div>
      </div>

      <!-- CN Beenden-Bestätigung -->
      <div v-if="cnState.cnEndConfirm" class="modal-bg" style="z-index:510">
        <div class="modal">
          <div class="whatsnew-badge" style="background:var(--red2)">⚠ Beenden</div>
          <h3>Spiel wirklich beenden?</h3>
          <p class="confirm-msg">Der aktuelle Spielstand geht verloren.</p>
          <button class="btn btn-ghost" style="color:#e07070;border-color:#e07070;margin-bottom:.6rem"
            @click="cnState.cnEndConfirm=false;cnCancelCoop();cnReset();state.screen='home'">
            Ja, beenden
          </button>
          <button class="btn btn-primary" @click="cnState.cnEndConfirm=false">Weiterspielen</button>
        </div>
      </div>

      <div style="padding:0 1rem 5rem;max-width:600px;margin:0 auto">
        <div style="padding:1rem 0 .6rem;font-size:1.2rem;font-weight:900;color:var(--txt)">🗺 Codenames</div>

        <!-- ── SETUP ── -->
        <template v-if="cnState.phase === 'setup'">
          <!-- Spielmodus -->
          <div class="sec">
            <h2>📱 Spielmodus</h2>
            <div class="mode-grid">
              <div class="mode-card" :class="{active: cnState.gameMode==='local'}" @click="cnSelectMode('local')">
                <span class="mode-icon">📱</span>
                <div class="mode-name">Ein Gerät</div>
                <div class="mode-desc">Alle spielen auf einem Handy</div>
              </div>
              <div class="mode-card" :class="{active: cnState.gameMode==='coop'}" @click="cnSelectMode('coop')">
                <span class="mode-icon">🌐</span>
                <div class="mode-name">Multiplayer</div>
                <div class="mode-desc">Jeder auf eigenem Handy</div>
              </div>
            </div>
          </div>

          <!-- Coop Setup -->
          <div v-if="cnState.gameMode==='coop'" class="coop-box">
            <!-- Idle -->
            <div v-if="cnState.coop.phase==='idle'" style="display:flex;gap:.6rem">
              <button class="btn-create-room" style="flex:1;margin-top:0" @click="cnShowHostSetup">🏠 Raum erstellen</button>
              <button class="btn-create-room" style="flex:1;margin-top:0;background:linear-gradient(135deg,#0ea5e9,#0284c7)" @click="cnShowJoinSetup">🚪 Beitreten</button>
            </div>
            <!-- Hosting -->
            <div v-if="cnState.coop.phase==='hosting'">
              <div class="coop-hint">Dein Name</div>
              <input class="name-input-big" v-model="cnState.coop.myName" placeholder="Name eingeben..."/>
              <div class="coop-hint" style="margin-top:.8rem">Raumcode (6 Ziffern)</div>
              <input class="code-input" v-model="cnState.coop.codeDraft" maxlength="6" type="tel"
                inputmode="numeric" placeholder="z.B. 123456"
                style="font-size:1.6rem;letter-spacing:.3em;text-align:center;padding:.8rem"/>
              <div v-if="cnState.coop.error" class="coop-error">{{ cnState.coop.error }}</div>
              <button class="btn-create-room"
                :disabled="cnState.coop.codeDraft.replace(/[^0-9]/g,'').length < 6 || !cnState.coop.myName.trim()"
                @click="cnCreateRoom">🏠 Raum erstellen</button>
              <button class="btn-sec" style="margin-top:.5rem" @click="cnState.coop.phase='idle'">Abbrechen</button>
            </div>
            <!-- Lobby -->
            <div v-if="cnState.coop.phase==='lobby'">
              <div class="invite-box">
                <span class="invite-code">{{ cnState.coop.code }}</span>
                <button class="btn-sec btn-sm" @click="cnShareLink">🔗 Link teilen</button>
              </div>
              <div class="coop-hint">Spieler & Rollen ({{ cnState.coop.players.length }})</div>
              <div style="font-size:.75rem;color:var(--txt2);margin-bottom:.8rem;line-height:1.5">
                Als Host weist du jedem Spieler eine Rolle zu.<br>
                Jedes Team braucht einen <strong>Spymaster</strong> (gibt Hinweise) und <strong>Operatives</strong> (raten).
              </div>
              <!-- Spielerliste mit Rollenvergabe durch Host -->
              <div v-for="p in cnState.coop.players" :key="p.uid" class="cn-lobby-player">
                <span class="li-icon">{{ p.isHost ? '👑' : '👤' }}</span>
                <span class="li-name" style="flex:1">{{ p.name }}</span>
                <!-- Host: Rollenvergabe -->
                <div v-if="cnState.coop.isHost" style="display:flex;gap:.3rem">
                  <button class="cn-role-mini"
                    :class="{'cn-role-mini-active-red': p.role==='spymaster-red'}"
                    @click="cnHostSetRole(p.uid,'spymaster-red')" title="Spymaster Rot">🔴S</button>
                  <button class="cn-role-mini"
                    :class="{'cn-role-mini-active-blue': p.role==='spymaster-blue'}"
                    @click="cnHostSetRole(p.uid,'spymaster-blue')" title="Spymaster Blau">🔵S</button>
                  <button class="cn-role-mini"
                    :class="{'cn-role-mini-active-red': p.role==='operative-red'}"
                    @click="cnHostSetRole(p.uid,'operative-red')" title="Operative Rot">🔴O</button>
                  <button class="cn-role-mini"
                    :class="{'cn-role-mini-active-blue': p.role==='operative-blue'}"
                    @click="cnHostSetRole(p.uid,'operative-blue')" title="Operative Blau">🔵O</button>
                </div>
                <!-- Gast: zeigt eigene Rolle -->
                <span v-else-if="p.uid===cnState.coop.myUid && p.role"
                  class="li-ready" :class="p.role.includes('red')?'cn-role-red':'cn-role-blue'"
                  style="font-size:.72rem">
                  {{ p.role==='spymaster-red'?'🔴 Spymaster':p.role==='spymaster-blue'?'🔵 Spymaster':p.role==='operative-red'?'🔴 Operative':'🔵 Operative' }}
                </span>
                <span v-else-if="p.role" class="li-ready yes" style="font-size:.68rem">
                  {{ p.role==='spymaster-red'?'🔴S':p.role==='spymaster-blue'?'🔵S':p.role==='operative-red'?'🔴O':'🔵O' }}
                </span>
              </div>
              <!-- Rollenübersicht -->
              <div style="margin:.8rem 0;padding:.6rem;background:var(--sur);border-radius:10px;font-size:.75rem;color:var(--txt2)">
                🔴 Rot: {{ cnState.coop.players.filter(p=>p.role&&p.role.includes('red')).map(p=>p.name).join(', ') || '—' }}<br>
                🔵 Blau: {{ cnState.coop.players.filter(p=>p.role&&p.role.includes('blue')).map(p=>p.name).join(', ') || '—' }}
              </div>
              <button v-if="cnState.coop.isHost" class="btn-create-room" style="margin-top:.5rem"
                :disabled="cnState.coop.players.length < 2 || !cnState.coop.players.every(p=>p.role)"
                @click="cnStartCoopGame">
                ▶ Spiel starten
              </button>
              <div v-if="cnState.coop.isHost && !cnState.coop.players.every(p=>p.role)"
                style="font-size:.72rem;color:var(--txt3);text-align:center;margin-top:.4rem">
                Alle Spieler brauchen eine Rolle
              </div>
              <div v-if="!cnState.coop.isHost" style="text-align:center;padding:.8rem 0;color:var(--txt2);font-size:.85rem">
                ⏳ Warte auf den Host…
                <div v-if="cnState.coop.myRole" style="margin-top:.3rem;color:var(--gold);font-weight:700">
                  Deine Rolle: {{ cnState.coop.myRole }}
                </div>
              </div>
              <button class="btn-sec" style="margin-top:.5rem" @click="cnCancelCoop">Verlassen</button>
            </div>
            <!-- Joining -->
            <div v-if="cnState.coop.phase==='joining'">
              <div class="coop-hint">Dein Name</div>
              <input class="name-input-big" v-model="cnState.coop.myName" placeholder="Name eingeben..."/>
              <div class="coop-hint" style="margin-top:.8rem">Raumcode (6 Ziffern)</div>
              <input class="code-input" v-model="cnState.coop.codeDraft" maxlength="6" type="tel"
                inputmode="numeric" placeholder="z.B. 123456"
                style="font-size:1.6rem;letter-spacing:.3em;text-align:center;padding:.8rem"/>
              <div v-if="cnState.coop.error" class="coop-error">{{ cnState.coop.error }}</div>
              <button class="btn-create-room"
                :disabled="cnState.coop.codeDraft.replace(/[^0-9]/g,'').length < 6 || !cnState.coop.myName.trim()"
                @click="cnJoinRoom">🚪 Beitreten</button>
              <button class="btn-sec" style="margin-top:.5rem" @click="cnState.coop.phase='idle'">Abbrechen</button>
            </div>
            <!-- Joined: Lobby-Ansicht -->
            <div v-if="cnState.coop.phase==='joined'">
              <div class="invite-box" style="margin-bottom:.8rem">
                <span class="invite-code">{{ cnState.coop.code }}</span>
              </div>
              <div class="coop-hint">Lobby ({{ cnState.coop.lobbyPlayers.length }} Spieler)</div>
              <div v-if="cnState.coop.lobbyPlayers.length">
                <div v-for="p in cnState.coop.lobbyPlayers" :key="p.uid" class="cn-lobby-player">
                  <span class="li-icon">{{ p.isHost ? '👑' : '👤' }}</span>
                  <span class="li-name" style="flex:1">{{ p.name }}</span>
                  <span v-if="p.role" class="li-ready yes" style="font-size:.72rem">
                    {{ p.role==='spymaster-red'?'🔴 Spym.':p.role==='spymaster-blue'?'🔵 Spym.':p.role==='operative-red'?'🔴 Op.':'🔵 Op.' }}
                  </span>
                  <span v-else class="li-ready no" style="font-size:.72rem">Keine Rolle</span>
                </div>
              </div>
              <div v-else style="text-align:center;padding:.6rem;color:var(--txt2);font-size:.85rem">⏳ Verbinde…</div>
              <div v-if="cnState.coop.myRole" style="margin-top:.8rem;padding:.8rem;background:rgba(124,58,237,.1);border-radius:12px;border:1px solid rgba(124,58,237,.3)">
                <div style="font-size:.72rem;color:var(--txt3);margin-bottom:.3rem">DEINE ROLLE</div>
                <div style="font-size:1rem;font-weight:700;color:var(--gold)">{{ cnState.coop.myRole }}</div>
              </div>
              <p style="font-size:.82rem;color:var(--txt3);text-align:center;margin-top:.6rem">Der Host vergibt die Rollen…</p>
              <button class="btn-sec" style="margin-top:.8rem" @click="cnCancelCoop">Verlassen</button>
            </div>
          </div>

          <!-- Lokal Setup -->
          <template v-if="cnState.gameMode==='local'">
            <div class="sec" style="margin-top:.5rem">
              <h2>🌍 Wortsprache</h2>
              <div style="display:flex;gap:.5rem;flex-wrap:wrap">
                <button v-for="l in [{id:'de',label:'🇩🇪 Deutsch'},{id:'en',label:'🇬🇧 English'},{id:'tr',label:'🇹🇷 Türkçe'},{id:'fr',label:'🇫🇷 Français'},{id:'es',label:'🇪🇸 Español'}]"
                  :key="l.id"
                  class="btn-sec"
                  :style="cnState.lang===l.id ? 'background:var(--gold);color:#fff;border-color:var(--gold)' : ''"
                  @click="cnState.lang=l.id">{{ l.label }}</button>
              </div>
            </div>
            <button class="btn-start" style="margin-top:.5rem" @click="cnStartLocal">▶ Spielen</button>
          </template>
        </template>

        <!-- ── SPIELFELD ── -->
        <template v-if="cnState.phase === 'playing'">

          <!-- Status Bar -->
          <div class="cn-status-bar">
            <div class="cn-team-badge cn-team-red">🔴 {{ cnState.redLeft }}</div>
            <div class="cn-turn-indicator"
              :class="cnState.currentTeam==='red' ? 'cn-turn-red' : 'cn-turn-blue'">
              {{ cnState.currentTeam==='red' ? '🔴 Rot' : '🔵 Blau' }} ist dran
            </div>
            <div class="cn-team-badge cn-team-blue">🔵 {{ cnState.blueLeft }}</div>
          </div>

          <!-- Hinweis -->
          <div v-if="cnState.hint" class="cn-hint-display"
            :class="cnState.currentTeam==='red' ? 'cn-hint-red' : 'cn-hint-blue'">
            <span class="cn-hint-word">{{ cnState.hint }}</span>
            <span class="cn-hint-count">× {{ cnState.hintCount }}</span>
            <span class="cn-hint-left">noch {{ cnState.guessesLeft }}×</span>
          </div>
          <div v-else class="cn-waiting-hint"
            :class="cnState.currentTeam==='red' ? 'cn-hint-red' : 'cn-hint-blue'">
            ⏳ {{ cnState.currentTeam==='red' ? '🔴 Rot' : '🔵 Blau' }} gibt einen Hinweis…
          </div>

          <!-- Spymaster: Geheimkarte anzeigen / Hinweis eingeben -->
          <div v-if="!cnState.coop.myRole || (cnIsSpymaster() && cnMyTeam()===cnState.currentTeam)"
            class="cn-spymaster-panel">

            <!-- Geheimkarte ein/ausblenden -->
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.6rem">
              <span style="font-size:.72rem;color:var(--gold);letter-spacing:.12em;text-transform:uppercase;font-weight:700">
                🕵️ Spymaster-Sicht
              </span>
              <button class="btn-sec btn-sm" @click="cnState.showSecretMap=!cnState.showSecretMap">
                {{ cnState.showSecretMap ? '🙈 Verbergen' : '👁 Karte zeigen' }}
              </button>
            </div>

            <!-- Hinweis-Eingabe nur wenn dran -->
            <div v-if="cnState.phase2==='hint'">
              <input class="name-input-big" v-model="cnState.hintDraft"
                placeholder="Hinweis-Wort eingeben…" style="margin-bottom:.5rem"
                @keydown.enter="cnGiveHint"/>
              <div style="display:flex;gap:.4rem;margin-bottom:.6rem;flex-wrap:wrap">
                <button v-for="n in [1,2,3,4,5,6,7,8,9]" :key="n"
                  class="imposter-btn"
                  :class="{'imposter-btn-active': cnState.hintCountDraft===n}"
                  style="flex:unset;width:42px;height:42px;padding:0;font-size:.88rem"
                  @click="cnState.hintCountDraft=n">{{ n }}</button>
              </div>
              <button class="btn-create-room" :disabled="!cnState.hintDraft.trim()" @click="cnGiveHint">
                ✓ Hinweis geben
              </button>
            </div>
            <div v-else style="font-size:.82rem;color:var(--txt2);text-align:center;padding:.4rem 0">
              Dein Team rät gerade — {{ cnState.guessesLeft }} Versuch{{ cnState.guessesLeft!==1?'e':'' }} übrig
            </div>
          </div>

          <!-- Karten-Grid -->
          <div class="cn-grid">
            <button v-for="(card, idx) in cnState.words" :key="idx"
              class="cn-card"
              :class="[
                cnState.showSecretMap && !card.revealed ? 'cn-card-' + card.type : '',
                !cnState.showSecretMap && card.revealed ? 'cn-card-' + card.type : '',
                card.revealed ? 'cn-card-revealed' : 'cn-card-hidden',
                cnState.phase2==='guess' && !card.revealed ? 'cn-card-clickable' : ''
              ]"
              @click="cnRevealCard(idx)">
              <span class="cn-card-word">{{ card.word }}</span>
              <!-- Spymaster: Typ-Indikator auf unaufgedeckten Karten -->
              <span v-if="cnState.showSecretMap && !card.revealed" class="cn-card-type-dot"
                :style="{background: card.type==='red'?'#f87171':card.type==='blue'?'#60a5fa':card.type==='black'?'#1e293b':'#94a3b8'}">
              </span>
              <!-- Aufgedeckte Karten -->
              <span v-if="card.revealed" class="cn-card-icon">
                {{ card.type==='red'?'🔴':card.type==='blue'?'🔵':card.type==='black'?'☠️':'⬜' }}
              </span>
            </button>
          </div>

          <!-- Zug abgeben -->
          <div v-if="cnState.phase2==='guess'" style="margin-top:.5rem">
            <button class="btn-sec" style="width:100%" @click="cnPassTurn">
              ↩ Zug weitergeben
            </button>
          </div>

        </template>

        <!-- ── GAME OVER ── -->
        <template v-if="cnState.phase === 'gameover'">
          <div class="go-inner" style="padding-top:1rem">
            <div class="wicon">{{ cnState.winner === 'red' ? '🔴' : '🔵' }}</div>
            <div class="wtitle"
              :style="{color: cnState.winner === 'red' ? '#f87171' : '#60a5fa'}">
              Team {{ cnState.winner === 'red' ? 'Rot' : 'Blau' }} gewinnt!
            </div>
            <div class="wsub">
              {{ cnState.winReason === 'black-card' ? '☠️ Schwarze Karte aufgedeckt!' : '🎉 Alle Wörter gefunden!' }}
            </div>
            <div class="surv-box" style="width:100%;margin-bottom:1rem">
              <h3>Endstand</h3>
              <div class="surv-item">
                <span>🔴 Rot</span>
                <span :style="{color: cnState.redLeft===0 ? '#4ade80' : '#f87171'}">
                  {{ cnState.redLeft }} übrig
                </span>
              </div>
              <div class="surv-item">
                <span>🔵 Blau</span>
                <span :style="{color: cnState.blueLeft===0 ? '#4ade80' : '#60a5fa'}">
                  {{ cnState.blueLeft }} übrig
                </span>
              </div>
            </div>
            <button class="btn-start" @click="cnReset();cnCancelCoop()">🔄 Neues Spiel</button>
            <button class="btn-sec" style="margin-top:.5rem"
              @click="cnReset();cnCancelCoop();state.screen='home'">🏠 Hauptmenü</button>
          </div>
        </template>

      </div>
    </template>

    <!-- ══════════════════════════════════════════════════════════════════ -->
    <!-- ── HOME SCREEN ── -->
    <!-- ══════════════════════════════════════════════════════════════════ -->
    <div v-if="!state.showWhatsNew && !state.showHistory && !state.showSettingsModal">

    <template v-if="state.screen === 'home' && !state.showWhatsNew">
      <div class="top-bar">
        <button class="icon-btn" @click="state.showSettingsModal=true" title="Einstellungen">⚙️</button>
      </div>
      <div style="padding:0 1.2rem 3rem;max-width:480px;margin:0 auto">
        <div class="logo">
          <span class="logo-moon" style="animation:none;filter:drop-shadow(0 0 20px rgba(124,58,237,.5))">🕵️</span>
          <h1>GRUPPEN-SPIELE</h1>
          <p>Party Games · Kostenlos · Werbefrei</p>
        </div>

        <div v-if="state.showSavedNamesHint && state.lastSavedNames.length" class="names-hint">
          💾 Letzte Spieler: <strong>{{ state.lastSavedNames.slice(0,3).join(', ') }}{{ state.lastSavedNames.length > 3 ? ' +' + (state.lastSavedNames.length - 3) : '' }}</strong>
          <br><button class="btn-sec" style="margin-top:.5rem;padding:.4rem" @click="loadLastNamesIntoSetup;state.screen='setup'">Spieler laden</button>
          <button class="btn-sec" style="margin-top:.5rem;padding:.4rem;margin-left:.4rem" @click="dismissNamesHint">✕</button>
        </div>

        <div class="sec">
          <h2>🎮 Spiel wählen</h2>
          <!-- Imposter -->
          <div class="game-select-card" :class="{active: state.screen==='setup'}"
            @click="state.screen='setup'">
            <img src="./icons/games/imposter.png" class="game-select-img" alt="Imposter"/>
            <div class="game-select-name">Imposter</div>
            <div class="game-select-desc">Finde den Verräter — 3 bis 16 Spieler</div>
            <div class="game-select-hint-btn" @click.stop="state.showRulesGame='imposter'">❓ Anleitung</div>
          </div>
          <!-- Wer bin ich -->
          <div class="game-select-card" :class="{active: state.screen==='wbi'}"
            @click="state.screen='wbi'">
            <img src="./icons/games/wbi.png" class="game-select-img" alt="Wer bin ich?"/>
            <div class="game-select-name">Wer bin ich?</div>
            <div class="game-select-desc">Errate deinen Begriff — 2 bis 16 Spieler</div>
            <div class="game-select-hint-btn" @click.stop="state.showRulesGame='wbi'">❓ Anleitung</div>
          </div>
          <!-- Codenames -->
          <div class="game-select-card" :class="{active: state.screen==='cn'}"
            @click="state.screen='cn'">
            <img src="./icons/games/codenames.png" class="game-select-img" alt="Codenames"/>
            <div class="game-select-name">Codenames</div>
            <div class="game-select-desc">Teamspiel mit Geheimwörtern — 4 bis 16 Spieler</div>
            <div class="game-select-hint-btn" @click.stop="state.showRulesGame='cn'">❓ Anleitung</div>
          </div>
          <!-- Werwolf (eigenständige Unter-App unter ./werwolf/) -->
          <div class="game-select-card" @click="openWerwolf">
            <img src="./icons/games/werwolf.png" class="game-select-img" alt="Werwolf"/>
            <div class="game-select-name">Werwolf</div>
            <div class="game-select-desc">Das Dorf gegen die Wölfe — ab 4 Spieler</div>
            <div class="game-select-hint-btn" @click.stop="state.showRulesGame='ww'">❓ Anleitung</div>
          </div>
        </div>


      <div style="text-align:center;padding:1.5rem 0 .5rem;font-size:.72rem;color:var(--txt3);letter-spacing:.08em">
          v{{ BUILD }}
        </div>
      </div>
    </template>

    <!-- ══════════════════════════════════════════════════════════════════ -->
    <!-- ── SETUP SCREEN ── -->
    <!-- ══════════════════════════════════════════════════════════════════ -->
    <template v-if="state.screen === 'setup'">
      <div class="top-bar">
        <button class="back-corner icon-btn" @click="state.screen='home'" title="Zurück">←</button>
        <button class="icon-btn" @click="state.showSettingsModal=true" title="Einstellungen">⚙️</button>
      </div>
      <div style="padding:0 1.2rem 3rem;max-width:480px;margin:0 auto">
        <div style="padding:1.2rem 0 .8rem;font-size:1.2rem;font-weight:900;color:var(--txt)">🕵️ Imposter</div>

        <!-- Spielmodus -->
        <div class="sec">
          <h2>{{ t('mode.title') }}</h2>
          <div class="mode-grid">
            <div class="mode-card" :class="{active: state.gameMode==='local'}" @click="selectMode('local')">
              <span class="mode-icon">📱</span>
              <div class="mode-name">{{ t('mode.local') }}</div>
              <div class="mode-desc">{{ t('mode.localSub') }}</div>
            </div>
            <div class="mode-card" :class="{active: state.gameMode==='coop'}" @click="selectMode('coop')">
              <span class="mode-icon">🌐</span>
              <div class="mode-name">{{ t('mode.coop') }}</div>
              <div class="mode-desc">{{ t('mode.coopSub') }}</div>
            </div>
          </div>
        </div>

        <!-- Coop Setup -->
        <div v-if="state.gameMode==='coop'" class="coop-box">

          <!-- Idle -->
          <div v-if="state.coop.phase==='idle'" style="display:flex;gap:.6rem">
            <button class="btn-create-room" style="flex:1;margin-top:0" @click="showHostSetup">🏠 Raum erstellen</button>
            <button class="btn-create-room" style="flex:1;margin-top:0;background:linear-gradient(135deg,#0ea5e9,#0284c7)" @click="showJoinSetup">🚪 Beitreten</button>
          </div>

          <!-- Hosting -->
          <div v-if="state.coop.phase==='hosting'">
            <div class="coop-hint">{{ t('coop.yourName') }}</div>
            <input class="name-input-big" v-model="state.coop.myName" :placeholder="t('coop.namePlaceholder')" />

            <div class="coop-hint" style="margin-top:.8rem">Raumcode (6 Ziffern)</div>
            <input class="code-input" v-model="state.coop.codeDraft"
              maxlength="6" type="tel" inputmode="numeric" pattern="[0-9]*"
              placeholder="z.B. 123456"
              style="font-size:1.6rem;letter-spacing:.3em;text-align:center;padding:.8rem" />
            <div style="font-size:.72rem;color:var(--txt3);margin:.3rem 0 .6rem;text-align:center">
              Wähle einen Code, den alle Mitspieler leicht eintippen können
            </div>

            <div v-if="state.coop.error" class="coop-error">{{ state.coop.error }}</div>

            <button class="btn-create-room"
              :disabled="state.coop.codeDraft.replace(/[^0-9]/g,'').length !== 6 || !state.coop.myName.trim()"
              @click="createRoom">
              🏠 Raum erstellen
            </button>
            <button class="btn-sec" style="margin-top:.6rem" @click="state.coop.phase='idle'">{{ t('coop.cancel') }}</button>
          </div>

          <!-- Lobby (Host) -->
          <div v-if="state.coop.phase==='lobby'">
            <div class="invite-box">
              <span class="invite-code">{{ state.coop.code }}</span>
              <button class="btn-sec btn-sm" @click="shareInviteLink">🔗 Link teilen</button>
            </div>
            <div class="coop-hint">{{ t('coop.waiting') }}</div>
            <ul class="lobby-list">
              <li v-for="p in state.coop.players" :key="p.uid" class="lobby-item">
                <span class="li-icon">{{ p.isHost ? '👑' : '👤' }}</span>
                <span class="li-name">{{ p.name }}</span>
                <span class="li-ready" :class="p.isHost ? 'host' : p.ready ? 'yes' : 'no'">
                  {{ p.isHost ? t('coop.host') : p.ready ? t('coop.readyDone') : t('coop.notReady') }}
                </span>
              </li>
            </ul>
            <button class="btn-start" style="margin-top:.8rem" @click="startCoopGame"
              :disabled="state.coop.players.length < 2 || !state.coop.players.filter(p=>!p.isHost).every(p=>p.ready)">
              ▶ Spiel starten ({{ state.coop.players.length }} Spieler)
            </button>
            <button class="btn-sec" style="margin-top:.5rem" @click="cancelCoop">{{ t('coop.leave') }}</button>
          </div>

          <!-- Joining -->
          <div v-if="state.coop.phase==='joining'">
            <div class="coop-hint">{{ t('coop.yourName') }}</div>
            <input class="name-input-big" v-model="state.coop.myName" :placeholder="t('coop.namePlaceholder')" />

            <div class="coop-hint" style="margin-top:.8rem">Raumcode (6 Ziffern)</div>
            <input class="code-input" v-model="state.coop.codeDraft"
              maxlength="6" type="tel" inputmode="numeric" pattern="[0-9]*"
              :placeholder="t('coop.codeHint')"
              style="font-size:1.6rem;letter-spacing:.3em;text-align:center;padding:.8rem" />

            <div v-if="state.coop.error" class="coop-error">{{ state.coop.error }}</div>

            <button class="btn-create-room"
              :disabled="state.coop.codeDraft.replace(/[^0-9]/g,'').length !== 6 || !state.coop.myName.trim()"
              @click="joinRoom">
              🚪 Beitreten
            </button>
            <button class="btn-sec" style="margin-top:.6rem" @click="state.coop.phase='idle'">{{ t('coop.cancel') }}</button>
          </div>

          <!-- Joined (Gast in Lobby) -->
          <div v-if="state.coop.phase==='joined'">
            <div class="invite-box" style="margin-bottom:.8rem">
              <span class="invite-code">{{ state.coop.code }}</span>
            </div>
            <div class="coop-hint">Lobby ({{ state.coop.lobbyPlayers.length }} Spieler)</div>
            <ul class="lobby-list" v-if="state.coop.lobbyPlayers.length">
              <li v-for="p in state.coop.lobbyPlayers" :key="p.uid" class="lobby-item">
                <span class="li-icon">{{ p.isHost ? '👑' : '👤' }}</span>
                <span class="li-name">{{ p.name }}</span>
                <span class="li-ready" :class="p.isHost ? 'host' : p.ready ? 'yes' : 'no'">
                  {{ p.isHost ? 'Host' : p.ready ? '✓ Bereit' : 'Wartet…' }}
                </span>
              </li>
            </ul>
            <div v-else style="text-align:center;padding:.6rem;color:var(--txt2);font-size:.85rem">⏳ Verbinde…</div>
            <button class="btn-create-room" style="margin-top:.8rem"
              :style="state.coop.myReady ? 'background:linear-gradient(135deg,#16a34a,#15803d)' : 'background:linear-gradient(135deg,var(--pri),var(--pri2))'"
              @click="toggleReady">
              {{ state.coop.myReady ? '✗ Nicht mehr bereit' : '✅ Ich bin bereit!' }}
            </button>
            <button class="btn-sec" style="margin-top:.5rem" @click="cancelCoop">{{ t('coop.leave') }}</button>
          </div>

        </div>

        <!-- Spieler (nur Lokal) -->
        <template v-if="state.gameMode==='local'">
          <div class="sec" style="margin-top:1rem">
            <h2>👥 {{ t('setup.players') }}</h2>
            <div class="pc-row" style="margin-bottom:.8rem">
              <button class="cnt-btn" @click="changePlayerCount(-1)">−</button>
              <div class="pc-stepper">
                <div class="pc-num">{{ state.playerCount }}</div>
                <div class="cnt-lbl">{{ t('setup.playerUnit') }}</div>
              </div>
              <button class="cnt-btn" @click="changePlayerCount(1)">+</button>
            </div>
            <div class="names-scroll">
              <div class="names-grid">
                <div v-for="(name, i) in state.playerNames.slice(0, state.playerCount)" :key="i" class="nwrap">
                  <span>{{ i + 1 }}</span>
                  <input class="ninput" v-model="state.playerNames[i]" :placeholder="t('setup.playerUnit') + ' ' + (i+1)" type="text" autocomplete="off" />
                </div>
              </div>
            </div>
          </div>

          <div class="sec">
            <h2>🕵️ Imposter</h2>
            <div style="font-size:.8rem;color:var(--txt3);margin-bottom:.6rem">Wie viele Imposter soll es geben?</div>
            <div style="display:flex;gap:.5rem;flex-wrap:wrap">
              <button v-for="n in [1,2,3,4,5]" :key="n"
                class="imposter-btn"
                :class="{ 'imposter-btn-active': state.imposterCount===n }"
                @click="state.imposterCount=n">
                {{ n }}
                <span style="display:block;font-size:.62rem;font-weight:500;opacity:.75">{{ n === 1 ? 'Imposter' : 'Imposter' }}</span>
              </button>
            </div>
            <div v-if="state.imposterCount >= state.playerCount" style="font-size:.75rem;color:#f59e0b;margin-top:.5rem">
              ⚠ Mehr Imposter als Spieler möglich!
            </div>
          </div>

          <!-- Kategorien -->
          <div class="sec">
            <h2 style="cursor:pointer" @click="state.showKats=!state.showKats">
              🗂 Kategorien
              <span style="font-size:.75rem;color:var(--txt3);font-weight:500;letter-spacing:0;text-transform:none;margin-left:.4rem">
                {{ state.selectedKats.length }} / {{ Object.keys(KATEGORIEN).length }} ausgewählt
              </span>
              <span style="margin-left:auto;font-size:.9rem;color:var(--txt3)">{{ state.showKats ? '▲' : '▼' }}</span>
            </h2>
            <div v-if="state.showKats">
              <!-- Alle / Keine -->
              <div style="display:flex;gap:.5rem;margin-bottom:.7rem">
                <button class="btn-sec btn-sm" style="flex:1"
                  @click="state.selectedKats = Object.keys(KATEGORIEN)">✓ Alle</button>
                <button class="btn-sec btn-sm" style="flex:1"
                  @click="state.selectedKats = []">✗ Keine</button>
              </div>
              <!-- Kategorie-Buttons -->
              <div class="kat-grid">
                <button v-for="(words, kat) in KATEGORIEN" :key="kat"
                  class="kat-btn"
                  :class="{ 'kat-btn-active': state.selectedKats.includes(kat) }"
                  @click="state.selectedKats.includes(kat)
                    ? state.selectedKats = state.selectedKats.filter(k=>k!==kat)
                    : state.selectedKats.push(kat)">
                  <span class="kat-label">{{ kat }}</span>
                  <span class="kat-count">{{ words.length }} Wörter</span>
                </button>
              </div>
              <!-- Eigene Wörter -->
              <div style="margin-top:1rem">
                <div style="font-size:.72rem;color:var(--txt3);letter-spacing:.1em;text-transform:uppercase;margin-bottom:.5rem">➕ Eigene Wörter</div>
                <div style="display:flex;gap:.5rem">
                  <input class="ninput" v-model="state.customWordDraft"
                    placeholder="Wort eingeben..." style="flex:1;margin:0;padding:.5rem .7rem"
                    @keydown.enter="state.customWordDraft.trim() && !state.customWords.includes(state.customWordDraft.trim()) && state.customWords.push(state.customWordDraft.trim()) && (state.customWordDraft='')" />
                  <button class="btn-sec btn-sm" style="flex-shrink:0"
                    @click="state.customWordDraft.trim() && !state.customWords.includes(state.customWordDraft.trim()) ? (state.customWords.push(state.customWordDraft.trim()), state.customWordDraft='') : null">
                    + Hinzufügen
                  </button>
                </div>
                <div v-if="state.customWords.length" style="display:flex;flex-wrap:wrap;gap:.4rem;margin-top:.6rem">
                  <span v-for="w in state.customWords" :key="w" class="custom-word-tag">
                    {{ w }}
                    <button @click="state.customWords = state.customWords.filter(x=>x!==w)"
                      style="background:none;border:none;color:var(--txt3);cursor:pointer;margin-left:.2rem;font-size:.9rem">×</button>
                  </span>
                </div>
              </div>
            </div>
            <div v-else style="display:flex;flex-wrap:wrap;gap:.3rem;margin-top:.4rem">
              <span v-for="kat in state.selectedKats.slice(0,4)" :key="kat"
                style="font-size:.7rem;background:rgba(124,58,237,.15);border:1px solid rgba(124,58,237,.3);border-radius:20px;padding:2px 8px;color:var(--gold)">
                {{ kat.split(' ').slice(1).join(' ') }}
              </span>
              <span v-if="state.selectedKats.length > 4"
                style="font-size:.7rem;color:var(--txt3)">+{{ state.selectedKats.length - 4 }}</span>
            </div>
          </div>

          <!-- Runden -->
          <div class="sec">
            <h2>🔄 Runden</h2>
            <div class="pc-row">
              <button class="cnt-btn" @click="state.roundsTotal = Math.max(1, state.roundsTotal - 1)">−</button>
              <div class="pc-stepper">
                <div class="pc-num">{{ state.roundsTotal }}</div>
                <div class="cnt-lbl">{{ state.roundsTotal === 1 ? 'Runde' : 'Runden' }}</div>
              </div>
              <button class="cnt-btn" @click="state.roundsTotal = Math.min(10, state.roundsTotal + 1)">+</button>
            </div>
          </div>

          <div class="sec">
            <h2>💾 Konfiguration</h2>
            <div style="display:flex;gap:.5rem;margin-bottom:.5rem">
              <input class="ninput" v-model="state.configNameDraft" placeholder="Name (optional)" style="flex:1;padding:.5rem .7rem;margin:0" />
              <button class="btn-sec btn-sm" style="flex-shrink:0;white-space:nowrap" @click="saveCurrentConfig">Speichern</button>
            </div>
            <button v-if="state.savedConfigs.length" class="btn-sec btn-sm" @click="state.showConfigs=!state.showConfigs">
              📋 Gespeicherte Konfigurationen ({{ state.savedConfigs.length }})
            </button>
            <div v-if="state.showConfigs" style="margin-top:.7rem;background:var(--sur);border:1px solid var(--bdr);border-radius:10px;padding:.7rem .9rem">
              <div v-if="!state.savedConfigs.length" style="font-size:.8rem;color:var(--txt3);text-align:center;padding:.5rem">Noch keine gespeichert.</div>
              <div v-for="c in state.savedConfigs" :key="c.id" class="config-row">
                <div class="config-info">
                  <div class="config-name">{{ c.name }}</div>
                  <div class="config-sub">{{ c.playerCount }} Spieler · {{ c.imposterCount||1 }} Imposter</div>
                </div>
                <button class="btn-sec btn-sm" style="flex-shrink:0" @click="loadConfig(c)">Laden</button>
                <button class="btn-sec btn-sm" style="flex-shrink:0;margin-left:.3rem;color:var(--blood2)" @click="removeConfig(c.id)">✕</button>
              </div>
            </div>
          </div>

          <button class="btn-start" @click="startLocalGame" :disabled="state.playerCount < 3">
            ▶ {{ t('setup.startBtn') }}
          </button>
        </template>

      </div>
    </template>

    <!-- ══════════════════════════════════════════════════════════════════ -->
    <!-- ── REVEAL SCREEN ── -->
    <!-- ══════════════════════════════════════════════════════════════════ -->
    <template v-if="state.screen === 'reveal'">
      <div class="top-bar">
        <button class="icon-btn" @click="openGameMenu" title="Spielmenü">⏸</button>
      </div>
      <div class="reveal-inner">
        <div style="width:100%;max-width:380px;margin-bottom:.5rem">
          <div class="prog-bar"><div class="prog-fill" :style="{width: (state.revealIdx / state.roles.length * 100) + '%'}"></div></div>
          <div style="font-size:.72rem;color:var(--txt3);text-align:right;margin-top:.2rem">{{ state.revealIdx + 1 }} / {{ state.roles.length }}</div>
        </div>
        <div class="rev-head">
          <div class="for">Karte für</div>
          <div class="pname">{{ revealPlayer?.name }}</div>
          <div style="font-size:.8rem;color:var(--txt3);margin-top:.3rem">
            {{ !state.revealFlipped ? 'Alle anderen wegschauen! 👀' : '' }}
          </div>
        </div>

        <!-- Karte: komplett klickbar zum Aufdecken -->
        <div class="rev-card"
          :class="{ flipped: state.revealFlipped, imposter: state.revealFlipped && revealPlayer?.isImposter }"
          @click="!state.revealFlipped && revealCard()"
          :style="{ cursor: !state.revealFlipped ? 'pointer' : 'default' }">
          <div v-if="!state.revealFlipped" class="card-back">
            <span class="cbi" style="font-size:3rem">🃏</span>
            <span class="cbt" style="font-size:.85rem;margin-top:.8rem;display:block">👆 ANTIPPEN ZUM AUFDECKEN</span>
          </div>
          <div v-else class="card-front">
            <template v-if="revealPlayer?.isImposter">
              <span class="cfi" style="font-size:3.5rem">🕵️</span>
              <div style="display:inline-block;background:rgba(176,32,32,.25);border:1px solid rgba(176,32,32,.5);border-radius:8px;padding:.3rem .9rem;font-size:.75rem;font-weight:700;color:#f87171;letter-spacing:.08em;margin:.4rem 0">IMPOSTER</div>
              <div class="cfa" style="margin-top:.6rem">Du kennst das Wort nicht.<br>Tu so als ob — lass dich nicht erwischen!</div>
              <div class="cfg" style="margin-top:.5rem">Beobachte die anderen und passe dich an 🎭</div>
            </template>
            <template v-else>
              <span class="cfi" style="font-size:3.5rem">💬</span>
              <div style="font-size:.75rem;letter-spacing:.15em;color:var(--txt3);text-transform:uppercase;margin-bottom:.3rem">Dein Wort</div>
              <div style="font-size:2.2rem;font-weight:900;color:var(--gold);letter-spacing:-.5px;margin:.2rem 0">{{ revealPlayer?.word }}</div>
              <div class="cfg" style="margin-top:.5rem">Beschreibe es ohne das Wort zu nennen! 🗣</div>
            </template>
          </div>
        </div>

        <template v-if="!state.revealFlipped">
          <div style="font-size:.8rem;color:var(--txt3);margin-top:.6rem;text-align:center">oder</div>
          <button class="btn-rev" style="margin-top:.4rem;background:linear-gradient(135deg,var(--pri),var(--pri2));color:#fff;border:1px solid rgba(124,58,237,.4);padding:.8rem 2rem;border-radius:12px;font-size:.9rem;font-weight:700;cursor:pointer;box-shadow:0 4px 16px rgba(124,58,237,.35)" @click="revealCard">
            👁 Karte aufdecken
          </button>
        </template>
        <button v-else class="btn-next-reveal" @click="nextReveal">
          {{ state.revealIdx + 1 >= state.roles.length ? '▶ Diskussion starten' : '➡ Weiter' }}
        </button>
      </div>
    </template>

    <!-- ══════════════════════════════════════════════════════════════════ -->
    <!-- ── TIMER SCREEN ── -->
    <!-- ══════════════════════════════════════════════════════════════════ -->
    <template v-if="state.screen === 'timer'">
      <div class="top-bar">
        <button class="icon-btn" @click="openGameMenu" title="Spielmenü">⏸</button>
      </div>
      <div class="timer-screen">
        <!-- Titel -->
        <div class="timer-title">💬 Jetzt diskutieren!</div>
        <div class="timer-subtitle">Wer verhält sich verdächtig?<br>Redet über das Wort — ohne es zu sagen!</div>

        <!-- Ring -->
        <div class="timer-ring-wrap">
          <svg class="timer-svg" viewBox="0 0 200 200">
            <!-- Hintergrund -->
            <circle cx="100" cy="100" r="85" fill="none" stroke="var(--bdr2)" stroke-width="10"/>
            <!-- Fortschritt -->
            <circle cx="100" cy="100" r="85" fill="none"
              :stroke="state.timerSeconds <= 10 ? '#ef4444' : state.timerSeconds <= 20 ? '#f59e0b' : 'var(--gold)'"
              stroke-width="10" stroke-linecap="round"
              :stroke-dasharray="2 * Math.PI * 85"
              :stroke-dashoffset="2 * Math.PI * 85 * (1 - timerPct / 100)"
              style="transform:rotate(-90deg);transform-origin:50% 50%;transition:stroke-dashoffset 1s linear,stroke .4s"/>
          </svg>
          <!-- Zahl innen -->
          <div class="timer-inner">
            <div class="timer-big-num"
              :style="{color: state.timerSeconds <= 10 ? '#ef4444' : state.timerSeconds <= 20 ? '#f59e0b' : 'var(--gold)'}">
              {{ state.timerSeconds }}
            </div>
            <div class="timer-sec-label">SEK</div>
          </div>
        </div>

        <!-- Spieler-Icons -->
        <div class="timer-players">
          <div v-for="r in state.roles" :key="r.name" class="timer-player-dot"
            :style="{background: r.isImposter ? 'rgba(176,32,32,.3)' : 'rgba(124,58,237,.25)'}">
            {{ r.name[0].toUpperCase() }}
          </div>
        </div>

        <button class="timer-skip-btn" @click="skipTimer">
          Weiter →
        </button>
      </div>
    </template>

    <!-- ══════════════════════════════════════════════════════════════════ -->
    <!-- ── POST-TIMER SCREEN (Lokal) ── -->
    <!-- ══════════════════════════════════════════════════════════════════ -->
    <template v-if="state.screen === 'postTimer'">
      <div class="top-bar">
        <button class="icon-btn" @click="openGameMenu" title="Spielmenü">⏸</button>
      </div>
      <div class="timer-screen">
        <div class="timer-title" style="font-size:1.5rem">⏰ Zeit abgelaufen!</div>
        <div class="timer-subtitle">Was möchtet ihr tun?</div>

        <div style="display:flex;gap:.8rem;margin:1.5rem 0;width:100%;max-width:380px">
          <button class="btn btn-ghost" style="flex:1;padding:1rem .5rem;font-size:.95rem;line-height:1.4"
            @click="localExtendDiscussion">
            🔄 Noch eine Runde<br>Diskussion
          </button>
          <button class="btn btn-primary" style="flex:1;padding:1rem .5rem;font-size:.95rem;line-height:1.4"
            @click="localStartVoting">
            🗳 Abstimmung<br>starten
          </button>
        </div>

        <div class="timer-players">
          <div v-for="r in state.roles" :key="r.name" class="timer-player-dot"
            :style="{background: r.isImposter ? 'rgba(176,32,32,.3)' : 'rgba(124,58,237,.25)'}">
            {{ r.name[0].toUpperCase() }}
          </div>
        </div>
      </div>
    </template>

    <!-- ══════════════════════════════════════════════════════════════════ -->
    <!-- ── VOTING SCREEN ── -->
    <!-- ══════════════════════════════════════════════════════════════════ -->
    <template v-if="state.screen === 'voting'">
      <div class="top-bar">
        <button class="icon-btn" @click="openGameMenu" title="Spielmenü">⏸</button>
      </div>
      <div class="voting-screen">
        <!-- Progress -->
        <div class="prog-bar"><div class="prog-fill" :style="{width: (state.stimmIdx / state.roles.length * 100) + '%'}"></div></div>

        <!-- Wer stimmt ab -->
        <div class="voting-header">
          <div class="voting-avatar">{{ currentVoter?.name?.[0]?.toUpperCase() }}</div>
          <div class="voting-voter-name">{{ currentVoter?.name }}</div>
          <div class="voting-voter-sub">wählt den Imposter</div>
          <div class="voting-counter">{{ state.stimmIdx + 1 }} von {{ state.roles.length }}</div>
        </div>

        <div class="voting-title">🕵️ Wer ist der Imposter?</div>

        <!-- Kandidaten -->
        <div class="voting-options">
          <button v-for="r in voteOptions" :key="r.name"
            class="voting-option"
            :class="{ 'voting-option-selected': state.voteSelection === r.name }"
            @click="selectVote(r.name)">
            <div class="voting-option-avatar">{{ r.name[0].toUpperCase() }}</div>
            <div class="voting-option-name">{{ r.name }}</div>
            <div class="voting-option-check" v-if="state.voteSelection === r.name">✓</div>
          </button>
        </div>

        <!-- Bestätigen -->
        <div class="voting-confirm-wrap">
          <button class="voting-confirm-btn"
            :disabled="!state.voteSelection"
            @click="confirmVote">
            {{ state.voteSelection ? '✓ ' + state.voteSelection + ' beschuldigen' : 'Spieler auswählen…' }}
          </button>
        </div>
      </div>
    </template>

    <!-- ══════════════════════════════════════════════════════════════════ -->
    <!-- ── RESULT SCREEN ── -->
    <!-- ══════════════════════════════════════════════════════════════════ -->
    <template v-if="state.screen === 'result'">
      <div class="top-bar">
        <button class="icon-btn" @click="state.showSettingsModal=true" title="Einstellungen">⚙️</button>
      </div>
      <div class="go-inner">
        <div class="wicon">{{ state.winner === 'village' ? '🎉' : '🕵️' }}</div>
        <div class="wtitle" :style="{color: state.winner==='village' ? 'var(--green)' : 'var(--blood2)'}">
          {{ state.winner === 'village' ? t('result.caught') : t('result.wins') }}
        </div>
        <div class="wsub">{{ state.winner === 'village' ? t('result.caughtSub') : t('result.winsSub') }}</div>

        <div class="surv-box" style="margin-bottom:1rem">
          <h3>🔍 {{ t('result.word') }}: <span style="color:var(--txt);font-size:1rem">{{ state.roles[0]?.word }}</span></h3>
          <div style="margin:.6rem 0">
            <span style="font-size:.78rem;color:var(--txt3)">{{ t('result.imposter') }}: </span>
            <span v-for="n in imposters" :key="n" style="background:rgba(124,58,237,.3);color:#c4b5fd;border-radius:20px;padding:2px 10px;font-size:.78rem;margin-left:4px">{{ n }}</span>
          </div>
          <div style="border-top:1px solid var(--bdr);padding-top:.6rem;margin-top:.6rem">
            <div style="font-size:.65rem;letter-spacing:.15em;color:var(--txt3);text-transform:uppercase;margin-bottom:.5rem">{{ t('result.votes') }}</div>
            <div v-for="r in state.roles" :key="r.name" class="surv-item">
              <span>{{ r.name }}{{ r.isImposter ? ' 🕵️' : '' }}</span>
              <span style="margin-left:auto;color:var(--gold);font-weight:700">{{ state.tally[r.name] || 0 }}×</span>
              <span v-if="state.eliminatedNames.includes(r.name)" style="background:rgba(124,58,237,.3);color:#c4b5fd;border-radius:20px;padding:2px 8px;font-size:.7rem;margin-left:.3rem">{{ t('result.out') }}</span>
            </div>
          </div>
        </div>

        <!-- Punkte wenn Mehrrundenspiel -->
        <div v-if="state.roundsTotal > 1" class="scores-box">
          <div style="font-size:.68rem;letter-spacing:.15em;color:var(--gold);text-transform:uppercase;margin-bottom:.6rem">
            🏆 Punktestand — Runde {{ state.roundsCurrent }} / {{ state.roundsTotal }}
          </div>
          <div v-for="r in state.roles.slice().sort((a,b)=>(state.scores[b.name]||0)-(state.scores[a.name]||0))"
            :key="r.name" class="score-row">
            <span>{{ r.name }}{{ r.isImposter ? ' 🕵️' : '' }}</span>
            <span class="score-val">{{ state.scores[r.name] || 0 }} Pkt</span>
          </div>
        </div>

        <!-- Nächste Runde oder Neues Spiel -->
        <template v-if="state.roundsTotal > 1 && state.roundsCurrent < state.roundsTotal">
          <button class="btn-start" @click="nextRound">▶ Runde {{ state.roundsCurrent + 1 }} starten</button>
          <button class="btn-sec" style="margin-top:.5rem" @click="resetGame">🏠 Abbrechen</button>
        </template>
        <template v-else>
          <div v-if="state.roundsTotal > 1" style="font-size:.85rem;color:var(--gold);text-align:center;margin-bottom:.8rem;font-weight:700">
            🎉 Alle {{ state.roundsTotal }} Runden gespielt!
          </div>
          <button class="btn-start" @click="startLocalGame">🔄 {{ t('result.newGame') }}</button>
          <button v-if="state.lobbyHistory.length > 0" class="btn-sec" style="margin-top:.5rem"
            @click="state.screen='lobbyHistory'">
            📋 Rundenhistorie ({{ state.lobbyHistory.length }})
          </button>
          <button class="btn-sec" style="margin-top:.5rem" @click="newGame">{{ t('result.backHome') }}</button>
        </template>
      </div>
    </template>


    <!-- ══════════════════════════════════════════════════════════════════ -->
    <!-- ── HISTORY SCREEN ── -->
    <!-- ══════════════════════════════════════════════════════════════════ -->
    <template v-if="state.screen === 'history'">
      <div class="top-bar" style="justify-content:center;position:relative">
        <button class="back-corner icon-btn" @click="state.historyDetail ? state.historyDetail=null : state.screen='home'" title="Zurück">←</button>
        <span style="font-weight:600;font-size:.95rem;color:var(--txt)">{{ state.historyDetail ? 'v' + state.historyDetail.version : 'Versionshistorie' }}</span>
      </div>
      <!-- Detailansicht einer Version -->
      <div v-if="state.historyDetail" style="padding:0 1.2rem 3rem;max-width:480px;margin:0 auto">
        <div style="padding:1rem 0 .5rem">
          <span class="cl-version-num">v{{ state.historyDetail.version }}</span>
          <div style="margin-top:.25rem;display:flex;align-items:center;gap:.4rem;flex-wrap:wrap">
            <span class="cl-version-date">{{ state.historyDetail.date }}</span>
            <span v-if="state.historyDetail.time" style="color:var(--txt3);font-size:.78rem">· {{ state.historyDetail.time }} Uhr</span>
          </div>
        </div>
        <ul style="list-style:none;padding:0">
          <li v-for="c in state.historyDetail.changes" :key="c"
            style="font-size:.9rem;color:var(--txt2);padding:.5rem 0;border-bottom:1px solid var(--bdr);display:flex;gap:.6rem;line-height:1.5">
            <span style="color:var(--gold);flex-shrink:0;margin-top:.1rem">✦</span>{{ c }}
          </li>
        </ul>
        <button class="btn-sec" style="margin-top:1.2rem" @click="state.historyDetail=null">← Zur Übersicht</button>
      </div>
      <!-- Liste aller Versionen -->
      <div v-else style="padding:0 1.2rem 3rem;max-width:480px;margin:0 auto">
        <div style="padding:1.2rem 0 .8rem;font-size:1.1rem;font-weight:900;color:var(--txt)">📋 Versionshistorie</div>
        <div v-for="cl in CHANGELOG" :key="cl.version" class="cl-version-card"
          @click="state.historyDetail=cl">
          <div class="cl-version-card-head">
            <span class="cl-version-num">v{{ cl.version }}</span>
            <span class="cl-version-date">{{ cl.date }}</span>
          </div>
          <ul class="cl-version-preview-list">
            <li v-for="(c,i) in cl.changes.slice(0,2)" :key="i">{{ c }}</li>
            <li v-if="cl.changes.length > 2" class="cl-more">+ {{ cl.changes.length - 2 }} weitere…</li>
          </ul>
          <div class="cl-tap-hint">Antippen für Details →</div>
        </div>
      </div>
    </template>

    </div>

  </div>
  `,
};

createApp(App).mount('#app');
init();

// Werwolf im Hintergrund vorwärmen, sobald der Browser idle ist, damit der
// erste Klick auf Werwolf sofort öffnet (kein spürbarer Ladevorgang).
(function prewarmWerwolf() {
  const warm = () => {
    const host = document.getElementById('ww-host');
    if (host) import('./werwolf-embed.js').then(m => m.ensureWerwolf(host)).catch(() => {});
  };
  if ('requestIdleCallback' in window) requestIdleCallback(warm, { timeout: 4000 });
  else setTimeout(warm, 1500);
})();
