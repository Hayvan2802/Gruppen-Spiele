// app.js — Werwolf v0.17 (Vue 3, esm-browser)
import { createApp, reactive, computed, watch } from './vue.esm-browser.prod.js';
import { BUILD, CHANGELOG } from './buildinfo.js';
import { ROLES, NIGHT_ORDER, DONATE_URL, COOP_MAX_PLAYERS } from './config.js';
import * as Coop from './coop.js';
import { log, exportLogToFile } from './debuglog.js';
import {
  loadSettings, saveSettings, loadSeenVersion, saveSeenVersion,
  loadLastNames, saveLastNames, loadConfigs, saveConfig, deleteConfig,
  loadUserName, saveUserName,
} from './storage.js';
import { t, setLocale, detectLocale, i18nState, SUPPORTED_LOCALES } from './i18n/index.js';

const APP_START = Date.now();
// Kein Splash/Version mehr — Versionskontrolle liegt bei Gruppen-Spiele.

// Wurzel-Element für Theme-Klasse und Toasts.
// Standalone (/werwolf/) = document.body; eingebettet in Gruppen-Spiele
// setzt das Embed-Glue hier das .ww-root-Element im Shadow-DOM.
let wwRoot = document.body;
export function setWwRoot(el) { wwRoot = el || document.body; }

// ─── STATE ────────────────────────────────────────────────────────────────────
const state = reactive({
  screen: 'home',
  settings: loadSettings(),
  showWhatsNew: false,
  showHistory:  false,
  historyDetail: null,  // { version, date, changes } — angezeigte Version
  updateReady:  false,

  // Setup
  gameMode: 'local',
  playerCount: 8,
  playerNames: Array(8).fill(''),
  selectedRoles: {},
  setupTab: 'std',

  // Gespeicherte Konfigurationen
  savedConfigs: loadConfigs(),
  showConfigs: false,
  configNameDraft: '',
  showSavedNamesHint: false,
  lastSavedNames: loadLastNames(),
  userName: loadUserName(),   // geräteweiter Benutzername (in Einstellungen änderbar)

  // Coop
  coop: {
    phase: 'idle',
    code: '', codeDraft: '',
    myName: loadUserName(), myUid: null,
    isHost: false,
    players: [],
    error: null,
    myRoleId: null,
  },

  showRevealTips: false,
  showSettingsModal: false,
  showWwRules: false,
  gameMenu: { active: false },
  gamePaused: false,
  gameEndConfirm: false,
  // Coop Phase 3
  coopVote: {
    active: false,
    candidates: [],        // [{name, roleId}] — nur lebende Spieler
    votes: {},             // { playerName: count }
    myVote: null,          // Name des gewählten Spielers (Gast)
    result: null,          // { eliminated, votes }
  },
  coopNight: {
    active: false,
    roleId: null,          // Welche Rolle ist gerade dran
    targets: [],           // Mögliche Ziele
    submitted: false,      // Hat dieser Spieler schon gehandelt
  },

  // Sitzreihenfolge
  seatOrder: [],          // Indizes in Sitzreihenfolge (im Uhrzeigersinn)
  seatSelected: null,     // Index des angetippten Spielers (zum Tauschen)
  showSeating: false,     // Sitzreihenfolge-Screen anzeigen

  // Rollenverteilung
  revealIdx: 0,
  revealFlipped: false,
  players: [],

  // Spielphase
  round: 1,
  phase: 'night',
  nightPhaseStarted: false,
  nightQueue: [],
  nightQueueIdx: 0,
  nightActions: {},
  nightSelection: null,
  nightMultiSel: [],
  showNightHint: false,
  dawnMsg: '',
  daySelection: null,
  showDayHint: false,
  gameLog: [],
  logNow: '',

  // Sonderflags
  healUsed: false,
  poisonUsed: false,
  lovUsed: false,
  lovers: [],
  amHit: false,
  ddRevealed: false,
  lastHeal: null,
  jaegerModal: { active: false },
  nightWolfTarget: null,   // Wer von den Wölfen angegriffen wurde (für Hexe sichtbar)
  logVisible: true,        // Spielverlauf ein-/ausblendbar
  ritterWolfTarget: null,
  winner: null,

  // Rolle nochmal anzeigen
  roleRevealModal: { active: false, playerIdx: null, flipped: false, showTips: false },
});

// ─── UTILS ───────────────────────────────────────────────────────────────────
function roleName(id)    { return t(`role.${id}.name`); }
function roleDesc(id)    { return t(`role.${id}.desc`); }
function roleAbility(id) { return t(`role.${id}.ability`); }
function roleGoal(id)    { return t(`role.${id}.goal`); }
function teamLabel(team) {
  if (team === 'wolf') return t('team.wolf');
  if (team === 'dorf') return t('team.village');
  return t('team.solo');
}
function gpn(i) {
  const n = (state.playerNames[i] || '').trim();
  return n || `${t('setup.playerUnit')} ${i + 1}`;
}
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
function addLog(txt, type = '') {
  state.gameLog.push({ txt, type, id: Date.now() + Math.random() });
}
function setNow(txt) { state.logNow = '📍 ' + txt; }
function showToast(msg) {
  let el = wwRoot.querySelector('#ww-toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'ww-toast';
    el.className = 'toast';
    wwRoot.appendChild(el);
  }
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(el._timer);
  el._timer = setTimeout(() => el.classList.remove('show'), 2600);
}
function genId() { return Math.random().toString(36).slice(2, 10); }

// Haptic Feedback (iOS Safari + Android)
function haptic(style = 'light') {
  // iOS: keine navigator.vibrate, aber CSS-Trick via AudioContext oder einfach skip
  // Moderne Browser: navigator.vibrate
  try {
    if (navigator.vibrate) {
      const patterns = { light: [10], medium: [20], heavy: [30, 10, 30], success: [10, 50, 10], error: [50, 10, 50, 10, 50] };
      navigator.vibrate(patterns[style] || [10]);
    }
  } catch(e) {}
}

// ─── THEME / LOCALE ──────────────────────────────────────────────────────────
function applyTheme() {
  const theme = state.settings.theme;
  let isLight;
  if (theme === 'auto') {
    isLight = window.matchMedia('(prefers-color-scheme: light)').matches;
  } else {
    isLight = theme === 'light';
  }
  wwRoot.classList.toggle('light', isLight);
}
function setTheme(t) {
  state.settings.theme = t;
  saveSettings(state.settings);
  applyTheme();
}
// Wird von der Haupt-App (Einbettung) aufgerufen, damit Werwolf DERSELBEN
// Theme-Einstellung folgt wie der Rest der App (inkl. 'auto' = System). Bewusst
// OHNE saveSettings — die eigenständige Werwolf-App behält ihre eigene Einstellung.
export function applyThemeFromHost(theme) {
  if (!theme) return;
  state.settings.theme = theme;
  applyTheme();
}
// System-Theme-Änderung live erkennen
window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => {
  if (state.settings.theme === 'auto') applyTheme();
});
function applyLocale() { setLocale(state.settings.lang); }
function setLang(id) { state.settings.lang = id; saveSettings(state.settings); applyLocale(); }
// Geräteweiten Benutzernamen setzen (geteilt mit Gruppen-Spiele) + Coop-Feld übernehmen.
function setUserName(n) {
  const name = (n ?? '').slice(0, 20);
  state.userName = name;
  saveUserName(name);
  state.coop.myName = name;
}

// ─── VERSION ─────────────────────────────────────────────────────────────────
function maybeShowWhatsNew() {
  const seen = loadSeenVersion();
  if (seen !== BUILD && CHANGELOG.length) state.showWhatsNew = true;
}
function dismissWhatsNew() { state.showWhatsNew = false; saveSeenVersion(BUILD); }

// ─── SW UPDATE ───────────────────────────────────────────────────────────────
async function checkForUpdate() {
  if (window._swReg) {
    showToast('Suche nach Updates…');
    try {
      await window._swReg.update();
      // Kurz warten ob ein neuer SW gefunden wurde
      await new Promise(r => setTimeout(r, 2000));
    } catch(e) {}
  }
  if (state.updateReady) {
    // Update bereits bekannt — Banner zeigen
  } else if (waitingWorker) {
    state.updateReady = true;
  } else {
    showToast('Keine Updates verfügbar ✓');
  }
}

function applyUpdate() {
  if (!waitingWorker) { location.reload(); return; }
  waitingWorker.postMessage({ type: 'skipWaiting' });
}

// ─── SETUP ───────────────────────────────────────────────────────────────────
function changePlayerCount(d) {
  const n = Math.max(4, Math.min(40, state.playerCount + d));
  state.playerCount = n;
  while (state.playerNames.length < n) state.playerNames.push('');
  state.playerNames = state.playerNames.slice(0, n);
}

const roleCountTotal = computed(() => Object.values(state.selectedRoles).reduce((s, c) => s + c, 0));
const roleSummary = computed(() => {
  let w = 0, d = 0, s = 0;
  for (const [id, c] of Object.entries(state.selectedRoles)) {
    if (!c) continue;
    const r = ROLES[id];
    if (r.team === 'wolf') w += c; else if (r.team === 'dorf') d += c; else s += c;
  }
  return { w, d, s };
});
const canStart = computed(() => roleCountTotal.value === state.playerCount && roleSummary.value.w > 0);

function toggleRole(id) {
  const r = ROLES[id];
  if (r.max === 1) state.selectedRoles[id] = state.selectedRoles[id] ? 0 : 1;
  else if (!state.selectedRoles[id]) state.selectedRoles[id] = 1;
}
function changeRole(id, d) {
  const r = ROLES[id];
  const cur = state.selectedRoles[id] || 0;
  state.selectedRoles[id] = Math.max(0, Math.min(r.max, cur + d));
}

// ─── NAMEN MERKEN ─────────────────────────────────────────────────────────────
function loadLastNamesIntoSetup() {
  const last = state.lastSavedNames;
  if (!last.length) return;
  state.playerCount = Math.max(4, Math.min(40, last.length));
  while (state.playerNames.length < state.playerCount) state.playerNames.push('');
  state.playerNames = state.playerNames.slice(0, state.playerCount);
  last.forEach((n, i) => { if (i < state.playerNames.length) state.playerNames[i] = n; });
  state.showSavedNamesHint = false;
  showToast(t('savedNames.load'));
}
function dismissNamesHint() { state.showSavedNamesHint = false; }

// ─── KONFIGURATIONEN ─────────────────────────────────────────────────────────
function saveCurrentConfig() {
  const name = state.configNameDraft.trim() || `${state.playerCount} Spieler`;
  saveConfig({
    id: genId(),
    name,
    playerCount: state.playerCount,
    playerNames: [...state.playerNames],
    selectedRoles: { ...state.selectedRoles },
    createdAt: Date.now(),
  });
  state.savedConfigs = loadConfigs();
  state.configNameDraft = '';
  showToast(t('configs.saved'));
}
function loadConfig(cfg) {
  state.playerCount = cfg.playerCount;
  state.playerNames = [...cfg.playerNames];
  while (state.playerNames.length < state.playerCount) state.playerNames.push('');
  state.selectedRoles = { ...cfg.selectedRoles };
  state.showConfigs = false;
  showToast(cfg.name);
}
function removeConfig(id) {
  deleteConfig(id);
  state.savedConfigs = loadConfigs();
}

// ─── GAME MENÜ (Pause / Beenden) ────────────────────────────────────────────
function openGameMenu() {
  state.gameMenu.active = true;
  state.gamePaused = false;
  state.gameEndConfirm = false;
}
function closeGameMenu() {
  state.gameMenu.active = false;
  state.gamePaused = false;
  state.gameEndConfirm = false;
}
function pauseGame() {
  state.gamePaused = true;
  state.gameMenu.active = false;
}
function resumeGame() {
  state.gamePaused = false;
  state.gameMenu.active = false;
}
function confirmEndGame() {
  closeGameMenu();
  state.gamePaused = false;
  state.screen = 'home';
  resetGameState();
}

// ─── SITZREIHENFOLGE ─────────────────────────────────────────────────────────
function initSeatOrder(count) {
  state.seatOrder = Array.from({ length: count }, (_, i) => i);
  state.seatSelected = null;
}
function selectSeat(i) {
  if (state.seatSelected === null) {
    state.seatSelected = i;
  } else {
    // Tauschen
    const a = state.seatSelected, b = i;
    if (a !== b) {
      [state.seatOrder[a], state.seatOrder[b]] = [state.seatOrder[b], state.seatOrder[a]];
    }
    state.seatSelected = null;
  }
}
function moveSeat(i, dir) {
  // dir: -1 = nach oben, +1 = nach unten
  const j = i + dir;
  if (j < 0 || j >= state.seatOrder.length) return;
  [state.seatOrder[i], state.seatOrder[j]] = [state.seatOrder[j], state.seatOrder[i]];
}
function openSeating() {
  initSeatOrder(state.playerCount);
  state.showSeating = true;
}
function closeSeating() { state.showSeating = false; }

// Ritter: finde Wolf unmittelbar links vom Ritter in Sitzreihenfolge
function findWolfLeftOfRitter(ritterIdx) {
  if (!state.seatOrder.length) {
    // Kein Sitzplan — nimm ersten lebenden Wolf
    return state.players.find(p => p.alive && ROLES[p.roleId].team === 'wolf');
  }
  // Finde Ritter-Position im Sitzkreis
  const ritterSeatPos = state.seatOrder.indexOf(ritterIdx);
  if (ritterSeatPos === -1) return state.players.find(p => p.alive && ROLES[p.roleId].team === 'wolf');
  const n = state.seatOrder.length;
  // Gehe links (counter-clockwise) bis zum ersten lebenden Wolf
  for (let step = 1; step < n; step++) {
    const pos = (ritterSeatPos - step + n) % n;
    const playerIdx = state.seatOrder[pos];
    const p = state.players[playerIdx];
    if (p && p.alive && ROLES[p.roleId].team === 'wolf') return p;
  }
  return null;
}

// ─── SPIELSTART ──────────────────────────────────────────────────────────────
function startLocalGame() {
  // Namen für nächstes Mal merken
  const realNames = state.playerNames.slice(0, state.playerCount).filter(n => n.trim());
  if (realNames.length) saveLastNames(state.playerNames.slice(0, state.playerCount));
  state.lastSavedNames = loadLastNames();

  let pool = [];
  for (const [id, c] of Object.entries(state.selectedRoles)) for (let i = 0; i < c; i++) pool.push(id);
  shuffle(pool);
  state.players = pool.map((roleId, i) => ({ name: gpn(i), roleId, alive: true }));
  resetGameState();
  state.revealIdx = 0; state.revealFlipped = false;
  state.screen = 'reveal';
  haptic('medium');
}

function resetGameState() {
  state.round = 1; state.phase = 'night';
  state.nightPhaseStarted = false;
  state.jaegerModal.active = false;
  state.ritterWolfTarget = null;
  state.nightQueue = []; state.nightQueueIdx = 0;
  state.nightActions = {}; state.nightSelection = null;
  state.nightMultiSel = []; state.showNightHint = false;
  state.daySelection = null; state.showDayHint = false;
  state.gameLog = []; state.logNow = '';
  state.healUsed = false; state.poisonUsed = false;
  state.lovUsed = false; state.lovers = [];
  state.amHit = false; state.ddRevealed = false; state.lastHeal = null;
  state.winner = null;
  state.showSeating = false;
  state.seatSelected = null;
  state.roleRevealModal = { active: false, playerIdx: null, flipped: false };
}

// ─── REVEAL ──────────────────────────────────────────────────────────────────
function revealRole() { state.revealFlipped = true; haptic('light'); }
function nextReveal() {
  state.showRevealTips = false;
  if (state.revealIdx + 1 >= state.players.length) {
    state.screen = 'game'; initGame();
  } else {
    state.revealIdx++; state.revealFlipped = false;
  }
}

// ─── ROLLE NOCHMAL ANZEIGEN ──────────────────────────────────────────────────
function openRoleReveal(playerIdx) {
  state.roleRevealModal = { active: true, playerIdx, flipped: false, showTips: false };
}
function closeRoleReveal() {
  state.roleRevealModal = { active: false, playerIdx: null, flipped: false, showTips: false };
}
function revealRoleAgain() { state.roleRevealModal.flipped = true; }

// ─── SPIELVERLAUF EXPORTIEREN ─────────────────────────────────────────────────
async function exportGameLog() {
  const lines = [
    `🐺 WERWOLF — Spielverlauf`,
    `Datum: ${new Date().toLocaleString('de-DE')}`,
    `Spieler: ${state.players.map(p => p.name).join(', ')}`,
    `Ergebnis: ${state.winner ? t(`result.${state.winner === 'dorf' ? 'village' : state.winner}`) : '–'}`,
    ``,
    `─── VERLAUF ───`,
    ...state.gameLog.map(e => (e.type === 'phase' ? `\n${e.txt}` : `▸ ${e.txt}`)),
    ``,
    `─── ROLLEN ───`,
    ...state.players.map(p => `${p.alive ? '✓' : '✗'} ${p.name}: ${roleName(p.roleId)}`),
  ];
  const text = lines.join('\n');
  const filename = `werwolf-${Date.now()}.txt`;
  const blob = new Blob([text], { type: 'text/plain' });
  if (navigator.canShare) {
    try {
      const file = new File([blob], filename, { type: 'text/plain' });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Werwolf Spielverlauf' });
        return;
      }
    } catch (e) { if (e.name === 'AbortError') return; }
  }
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ─── STATISTIKEN ─────────────────────────────────────────────────────────────
// ─── COOP ABSTIMMUNG (Tagesphase) ───────────────────────────────────────────
function startCoopVote() {
  // Host startet Abstimmung
  const candidates = state.players
    .filter(p => p.alive)
    .map(p => ({ name: p.name, roleId: p.roleId }));
  state.coopVote = { active: true, candidates, votes: {}, myVote: null, result: null };
  Coop.send({ type: Coop.MSG.VOTE_START, candidates });
}

function castCoopVote(targetName) {
  if (state.coopVote.myVote) return; // Nur einmal
  state.coopVote.myVote = targetName;
  Coop.send({ type: Coop.MSG.VOTE_CAST, targetName });
  showToast('Stimme abgegeben!');
}

function handleVoteCast(msg) {
  // Host empfängt Stimmen
  const name = msg.targetName;
  if (!name) return;
  state.coopVote.votes[name] = (state.coopVote.votes[name] || 0) + 1;
}

function resolveCoopVote() {
  // Host wertet aus
  const votes = state.coopVote.votes;
  const sorted = Object.entries(votes).sort((a, b) => b[1] - a[1]);
  const eliminated = sorted[0]?.[0] || null;
  state.coopVote.result = { eliminated, votes };
  Coop.send({ type: Coop.MSG.VOTE_RESULT, eliminated, votes });
  state.coopVote.active = false;
  // Spieler eliminieren
  if (eliminated) {
    const idx = state.players.findIndex(p => p.name === eliminated);
    if (idx >= 0) { killPlayer(idx, 'day'); checkWin(); }
  }
}

function skipCoopVote() {
  state.coopVote.active = false;
  Coop.send({ type: Coop.MSG.VOTE_RESULT, eliminated: null, votes: {} });
  addLog(`☀️ ${t('log.noExec')}`, 'dorf');
}

// ─── COOP NACHT (Nachtaktionen auf eigenem Gerät) ────────────────────────────
function sendNightRequest(roleId, targets) {
  // Host sendet Anfrage an Rolle
  state.coopNight = { active: false, roleId: null, targets: [], submitted: false };
  Coop.send({
    type: Coop.MSG.NIGHT_REQUEST,
    roleId,
    targets: targets.map(p => p.name),
  });
}

function handleNightRequest(msg) {
  // Gast empfängt Nacht-Anfrage für seine Rolle
  // Prüfe ob dieser Spieler die Rolle hat
  const myAssignment = state.players.find(p =>
    p.name === state.coop.myName && p.roleId === msg.roleId
  );
  if (!myAssignment) return;
  state.coopNight = {
    active: true,
    roleId: msg.roleId,
    targets: msg.targets || [],
    submitted: false,
  };
}

function submitNightAction(targetName) {
  if (state.coopNight.submitted) return;
  state.coopNight.submitted = true;
  state.coopNight.active = false;
  Coop.send({
    type: Coop.MSG.NIGHT_SUBMIT,
    roleId: state.coopNight.roleId,
    targetName,
  });
  showToast('Aktion übermittelt!');
}

function handleCoopMessage(msg) {
  if (!msg) return;
  switch(msg.type) {
    case Coop.MSG.START:
      // Rollenzuteilung empfangen (schon implementiert)
      const mine = msg.assignments?.find(a => a.uid === state.coop.myUid);
      if (mine) { state.coop.myRoleId = mine.roleId; state.coop.phase = 'myRole'; }
      break;
    case Coop.MSG.VOTE_START:
      state.coopVote = { active: true, candidates: msg.candidates || [], votes: {}, myVote: null, result: null };
      break;
    case Coop.MSG.VOTE_CAST:
      if (state.coop.isHost) handleVoteCast(msg);
      break;
    case Coop.MSG.VOTE_RESULT:
      state.coopVote.active = false;
      state.coopVote.result = { eliminated: msg.eliminated, votes: msg.votes };
      break;
    case Coop.MSG.NIGHT_REQUEST:
      handleNightRequest(msg);
      break;
    case Coop.MSG.NIGHT_SUBMIT:
      // Host empfängt Nacht-Aktion
      if (state.coop.isHost) {
        const targetIdx = state.players.findIndex(p => p.name === msg.targetName);
        if (targetIdx >= 0) state.nightActions[msg.roleId] = targetIdx;
        addLog(`${ROLES[msg.roleId]?.icon} ${roleName(msg.roleId)} ${t('log.acted')}`, 'ev');
      }
      break;
    case Coop.MSG.NIGHT_DONE:
      state.coopNight = { active: false, roleId: null, targets: [], submitted: false };
      break;
  }
}

// ─── SPIELLOGIK ──────────────────────────────────────────────────────────────
function initGame() {
  addLog(t('log.begin'), 'ev');
  buildNightQueue(); showNight();
}

function buildNightQueue() {
  const alive = new Set(state.players.filter(p => p.alive).map(p => p.roleId));
  state.nightQueue = NIGHT_ORDER.filter(id => {
    if (!alive.has(id)) return false;
    const r = ROLES[id];
    if (!r.nightAction) return false;
    if (r.firstNightOnly && state.round > 1) return false;
    if (id === 'amor' && state.lovUsed) return false;
    if (r.everyOtherNight && state.round % 2 === 0) return false;
    return true;
  });
  state.nightPhaseStarted = false;
  state.nightQueueIdx = 0;
  state.nightActions = {}; state.nightSelection = null; state.nightMultiSel = [];
}

function showNight() {
  state.phase = 'night';
  setNow(`${t('game.night')} ${state.round}`);
  addLog(`── ${t('game.night')} ${state.round} ──`, 'phase');
}

function startNight() { state.nightPhaseStarted = true; processNightRole(); }

function processNightRole() {
  if (state.nightQueueIdx >= state.nightQueue.length) { buildDawnMsg(); return; }
  const id = state.nightQueue[state.nightQueueIdx];
  state.nightSelection = null; state.nightMultiSel = []; state.showNightHint = false;
  setNow(`${ROLES[id].icon} ${roleName(id)}`);
}

function currentNightRole() { return state.nightQueue[state.nightQueueIdx] || null; }

function nightTargets() {
  const id = currentNightRole(); if (!id) return [];
  const alive = state.players.filter(p => p.alive);
  const r = ROLES[id];
  switch (r.nightAction) {
    case 'kill': return alive.filter(p => ROLES[p.roleId].team !== 'wolf');
    case 'killWolf': return alive.filter(p => ROLES[p.roleId].team === 'wolf' && p.roleId !== 'weisserWolf');
    case 'killSolo': return alive;
    case 'see': return alive;
    case 'detect': return alive;
    case 'heal': return alive.filter((_, i) => state.players.indexOf(alive[i]) !== state.lastHeal);
    case 'witch': return alive; // Hexe sieht Wolfopfer über state.nightWolfTarget
    case 'love': return alive;
    case 'sisters': return alive.filter(p => p.roleId === 'zweiSchwestern');
    case 'brothers': return alive.filter(p => p.roleId === 'dreiBrueder');
    default: return [];
  }
}

function selectNightTarget(pi) {
  const id = currentNightRole(); const r = ROLES[id];
  if (r.nightAction === 'love' || r.nightAction === 'detect') {
    const idx = state.nightMultiSel.indexOf(pi);
    if (idx >= 0) state.nightMultiSel.splice(idx, 1);
    else if (state.nightMultiSel.length < 2) state.nightMultiSel.push(pi);
    state.nightSelection = state.nightMultiSel.length === 2 ? [...state.nightMultiSel] : null;
  } else { state.nightSelection = pi; }
  state.showNightHint = false;
}

function confirmNight() {
  const id = currentNightRole(); const r = ROLES[id];
  if (r.mustSelect && state.nightSelection === null) {
    state.showNightHint = true; showToast(t('game.needTarget')); return;
  }
  if (state.nightSelection !== null) {
    state.nightActions[id] = state.nightSelection;
    // Wolfopfer merken (für Hexe)
    if ((id === 'werwolf' || id === 'alphawerwolf') && state.nightSelection !== null) {
      state.nightWolfTarget = state.nightSelection;
    }
    if (id === 'amor') {
      state.lovUsed = true; state.lovers = [...state.nightMultiSel];
      const l1 = state.players[state.nightMultiSel[0]]?.name;
      const l2 = state.players[state.nightMultiSel[1]]?.name;
      addLog(`💘 Amor verbindet ${l1} & ${l2} als Liebende.`, 'ev');
    }
    if (id === 'heiler') {
      const target = state.players[state.nightSelection];
      state.lastHeal = state.nightSelection;
      addLog(`💉 Heiler schützt ${target?.name} diese Nacht.`, 'ev');
    }
    if (id === 'hexe') {
      // Hexe: Heiltrank oder Gifttrank?
      // Wenn Wolfopfer gewählt → Heiltrank (rettet)
      if (state.nightSelection === state.nightWolfTarget && !state.healUsed) {
        state.healUsed = true;
        addLog(`🧪 Hexe setzt Heiltrank ein.`, 'ev');
      } else if (!state.poisonUsed) {
        state.poisonUsed = true;
        const target = state.players[state.nightSelection];
        addLog(`☠️ Hexe vergiftet ${target?.name}.`, 'ev');
      }
    }
    if (id === 'seherin') {
      const p = state.players[state.nightSelection];
      const isWolf = ROLES[p.roleId].team === 'wolf';
      addLog(`🔮 ${t('log.seer')} ${p.name} → ${isWolf ? '🐺 WOLF' : '🏡 kein Wolf'} (${roleName(p.roleId)})`, 'ev');
    }
    if (id === 'detektiv' && Array.isArray(state.nightSelection)) {
      const p1 = state.players[state.nightSelection[0]], p2 = state.players[state.nightSelection[1]];
      const same = ROLES[p1.roleId].team === ROLES[p2.roleId].team;
      addLog(`🔍 ${t('log.det')} ${p1.name} & ${p2.name} → ${same ? '✓ gleiches Team' : '✗ verschiedene Teams'}`, 'ev');
    }
    if (id === 'werwolf' || id === 'alphawerwolf') {
      const target = state.players[state.nightSelection];
      addLog(`🐺 Werwölfe wählen ${target?.name} als Opfer.`, 'wolf');
    }
    if (id === 'serienkiller') {
      const target = state.players[state.nightSelection];
      addLog(`🔪 Serienkiller wählt ${target?.name}.`, 'wolf');
    }
    if (!['amor','heiler','hexe','seherin','detektiv','werwolf','alphawerwolf','serienkiller'].includes(id)) {
      addLog(`${ROLES[id].icon} ${roleName(id)} ${t('log.acted')}`, 'ev');
    }
  }
  state.nightMultiSel = []; state.nightQueueIdx++; processNightRole();
}

function skipNight() {
  const id = currentNightRole();
  addLog(`${ROLES[id].icon} ${roleName(id)} ${t('log.skipped')}`, 'ev');
  state.nightMultiSel = []; state.nightQueueIdx++; processNightRole();
}

function buildDawnMsg() {
  const wk = state.nightActions['werwolf'] ?? state.nightActions['alphawerwolf'];
  if (wk !== undefined) {
    const p = state.players[wk];
    state.dawnMsg = state.nightActions['heiler'] === wk ? t('log.savedHeal') : `${p.name} ${t('log.attacked')}`;
  } else { state.dawnMsg = t('log.quiet'); }
}

function startDay() {
  resolveNight(); if (checkWin()) return;
  state.phase = 'day';
  setNow(`${t('game.day')} ${state.round}`);
  addLog(`── ${t('game.day')} ${state.round} ──`, 'phase');
  state.daySelection = null; state.showDayHint = false;
}

function resolveNight() {
  const saves = new Set();
  const kills = new Set();

  // Heiler schützt
  const healed = state.nightActions['heiler'];
  if (healed !== undefined) { saves.add(healed); }

  // Hexe: Heiltrank (rettet Wolfopfer) oder Gifttrank (tötet jemanden)
  // Hexe-Logik: nightActions['hexe'] enthält das gewählte Ziel
  // Wurde Wolfopfer gewählt → Heiltrank, sonst → Gifttrank (healUsed/poisonUsed bereits in confirmNight gesetzt)
  const hexeTarget = state.nightActions['hexe'];
  const wolfVictim = state.nightActions['werwolf'] ?? state.nightActions['alphawerwolf'];
  if (hexeTarget !== undefined) {
    if (hexeTarget === wolfVictim) {
      // Heiltrank: Wolfopfer gerettet
      saves.add(hexeTarget);
    } else {
      // Gifttrank: jemand anderes vergiftet
      kills.add(hexeTarget);
    }
  }

  // Werwolf-Angriff
  if (wolfVictim !== undefined) {
    if (!saves.has(wolfVictim)) {
      const p = state.players[wolfVictim];
      if (p && p.roleId === 'alterMann' && !state.amHit) {
        state.amHit = true;
        addLog(`👴 ${p.name} ${t('log.amSurv')}`, 'dorf');
      } else {
        kills.add(wolfVictim);
      }
    } else {
      addLog(`💉 Das Wolfopfer wurde gerettet!`, 'dorf');
    }
  }

  // Serienkiller und Weißer Wolf
  ['serienkiller', 'weisserWolf'].forEach(id => {
    if (state.nightActions[id] !== undefined) kills.add(state.nightActions[id]);
  });

  // Ritter-Effekt (verzögerter Wolf-Tod)
  if (state.ritterWolfTarget !== null) { kills.add(state.ritterWolfTarget); state.ritterWolfTarget = null; }

  // Alle Kills auflösen
  kills.forEach(i => { if (state.players[i]?.alive) killPlayer(i, 'wolf'); });

  // Wolfopfer zurücksetzen
  state.nightWolfTarget = null;
}

function killPlayer(idx, cause) {
  const p = state.players[idx]; if (!p || !p.alive) return;
  p.alive = false;
  haptic('heavy');
  const why = cause === 'wolf' ? t('log.killed') : t('log.executed');
  addLog(`💀 ${p.name} (${roleName(p.roleId)}) ${why}.`, cause === 'wolf' ? 'wolf' : 'ev');

  if (p.roleId === 'jaeger') {
    addLog(`🏹 ${t('log.jaeger')}`, 'ev');
    state.jaegerModal = { active: true, cause };
    return;
  }
  if (p.roleId === 'ritter' && cause === 'wolf') {
    addLog(`⚔️ ${t('log.ritter')}`, 'ev');
    const wolfLeft = findWolfLeftOfRitter(idx);
    if (wolfLeft) state.ritterWolfTarget = state.players.indexOf(wolfLeft);
  }
  if (p.roleId === 'alterMann' && cause !== 'wolf') addLog(`👴 ${t('log.amKill')}`, 'wolf');

  // Liebeskette: Partner stirbt aus Kummer — REKURSIV (löst auch dessen Jäger etc. aus)
  if (state.lovers.length === 2 && state.lovers.includes(idx)) {
    const partnerIdx = state.lovers.find(l => l !== idx);
    if (partnerIdx !== undefined && state.players[partnerIdx]?.alive) {
      addLog(`💔 ${state.players[partnerIdx].name} ${t('log.lovDie')} ${p.name}.`, 'ev');
      killPlayer(partnerIdx, 'grief'); // rekursiv — löst Jäger, Ritter etc. aus
    }
  }
}

function confirmJaeger(targetIdx) {
  state.jaegerModal.active = false;
  if (targetIdx !== null) haptic('heavy');
  if (targetIdx !== null) {
    const t2 = state.players[targetIdx];
    if (t2 && t2.alive) {
      t2.alive = false;
      addLog(`🏹 ${t2.name} ${t('log.jaegerKill')}`, 'wolf');
      if (state.lovers.length === 2 && state.lovers.includes(targetIdx)) {
        const partner = state.lovers.find(l => l !== targetIdx);
        if (partner !== undefined && state.players[partner]?.alive) {
          state.players[partner].alive = false;
          addLog(`💔 ${state.players[partner].name} ${t('log.lovDie')} ${t2.name}.`, 'ev');
        }
      }
    }
  }
  checkWin();
}

function selectDay(i) { state.daySelection = i; state.showDayHint = false; }

function confirmDay() {
  if (state.daySelection === null) { state.showDayHint = true; showToast(t('game.needPlayer')); return; }
  const p = state.players[state.daySelection];
  if (p.roleId === 'dorfdepp' && !state.ddRevealed) {
    state.ddRevealed = true; addLog(`🤡 ${p.name} ${t('log.ddMsg')}`, 'ev'); endDay(); return;
  }
  killPlayer(state.daySelection, 'day'); if (checkWin()) return; endDay();
}

function skipDay() { addLog(`☀️ ${t('log.noExec')}`, 'dorf'); endDay(); }
function endDay() { state.round++; buildNightQueue(); showNight(); }

function checkWin() {
  const alive = state.players.filter(p => p.alive);
  const wolves = alive.filter(p => ROLES[p.roleId].team === 'wolf');
  const dorf = alive.filter(p => ROLES[p.roleId].team === 'dorf');
  const solo = alive.filter(p => ROLES[p.roleId].team === 'solo');
  if (state.lovers.length === 2) {
    const la = state.lovers.filter(i => state.players[i]?.alive);
    if (la.length === 2 && alive.length === 2) { gameOver('lovers'); return true; }
  }
  if (alive.length === 1 && solo.length === 1) { gameOver('solo'); return true; }
  if (wolves.length > 0 && wolves.length >= dorf.length + solo.length) { gameOver('wolf'); return true; }
  if (wolves.length === 0) { gameOver('dorf'); return true; }
  return false;
}

function gameOver(winner) {
  state.winner = winner;
  state.screen = 'result';
  haptic('success');
  addLog(`🏆 ${t(`result.${winner === 'dorf' ? 'village' : winner}`)}`, 'ev');
}

function newGame() { state.screen = 'home'; }

// ─── COOP ────────────────────────────────────────────────────────────────────
function selectMode(mode) { state.gameMode = mode; }
function genCode() { return String(Math.floor(100000 + Math.random() * 900000)); }

async function showHostSetup() {
  state.coop.phase = 'hosting'; state.coop.codeDraft = '';
  state.coop.players = []; state.coop.error = null; state.coop.isHost = true;
}
async function createRoom() {
  const code = state.coop.codeDraft.replace(/\D/g, '').slice(0, 6);
  if (code.length !== 6) { state.coop.error = t('coop.codeHint'); return; }
  const myName = (state.coop.myName || '').trim() || 'Host';
  state.coop.code = code; state.coop.error = null; state.coop.phase = 'lobby';
  state.coop.players = [{ uid: 'host', name: myName, ready: true, isHost: true }];
  await Coop.hostGame({
    code, name: myName,
    onOpen: (uid) => { state.coop.myUid = uid; },
    onError: (e) => { state.coop.error = e.type === 'code-taken' ? t('coop.codeTaken') : t('coop.errorGeneric'); state.coop.phase = 'hosting'; },
    onJoin: (uid, data) => { if (!state.coop.players.find(p => p.uid === uid)) state.coop.players.push({ uid, name: data?.name || uid, ready: false, isHost: false }); },
    onLeave: (uid) => { state.coop.players = state.coop.players.filter(p => p.uid !== uid); },
    onMessage: (msg) => { if (msg.type === Coop.MSG.READY) { const p = state.coop.players.find(x => x.uid === msg.author); if (p) p.ready = msg.ready; } },
  });
}
async function startCoopGame() {
  const allPlayers = state.coop.players;
  let pool = [];
  for (const [id, c] of Object.entries(state.selectedRoles)) for (let i = 0; i < c; i++) pool.push(id);
  shuffle(pool);
  while (pool.length < allPlayers.length) pool.push('dorfbewohner');
  const assignments = allPlayers.map((p, i) => ({ uid: p.uid, name: p.name, roleId: pool[i] }));
  await Coop.send({ type: Coop.MSG.START, assignments });
  state.players = assignments.map(a => ({ name: a.name, roleId: a.roleId, alive: true }));
  resetGameState(); state.revealIdx = 0; state.revealFlipped = false; state.screen = 'reveal';
}
function showJoinSetup() { state.coop.phase = 'joining'; state.coop.codeDraft = ''; state.coop.myName = loadUserName(); state.coop.error = null; state.coop.isHost = false; }
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
      else if (e.type === 'timeout') state.coop.error = t('coop.errorTimeout');
      else state.coop.error = t('coop.errorGeneric');
    },
    onMessage: handleCoopMessage,
    onClose: () => { state.coop.phase = 'idle'; },
  });
}
async function toggleReady() { await Coop.send({ type: Coop.MSG.READY, ready: true }); }
function getInviteLink() {
  const base = window.location.origin + window.location.pathname;
  return `${base}?code=${state.coop.code}`;
}
async function shareInviteLink() {
  const url = getInviteLink();
  if (navigator.share) {
    try {
      await navigator.share({
        title: 'Werwolf — Raum beitreten',
        text: `Tritt meinem Werwolf-Raum bei! Code: ${state.coop.code}`,
        url,
      });
      return;
    } catch(e) { if (e.name === 'AbortError') return; }
  }
  // Fallback: in Zwischenablage kopieren
  try {
    await navigator.clipboard.writeText(url);
    showToast('Link kopiert!');
  } catch(e) {
    showToast(url);
  }
}

async function cancelCoop() {
  await Coop.leave();
  state.coop.phase = 'idle'; state.coop.players = []; state.coop.error = null;
  state.coop.myUid = null; state.coop.myRoleId = null;
}

// ─── INIT ────────────────────────────────────────────────────────────────────
function init() {
  applyTheme(); applyLocale();
  // maybeShowWhatsNew() entfällt — Versionshinweise zeigt Gruppen-Spiele.
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

  // Kein Splash-Fade mehr — die App startet direkt mit der Werwolf-Auswahl.
}

// ─── TEMPLATE ────────────────────────────────────────────────────────────────
const App = {
  setup() {
    // Haupt-App informieren wenn sich der Screen ändert (steuert den ←-Button)
    watch(() => state.screen, s => window.dispatchEvent(new CustomEvent('ww-screen', { detail: s })), { immediate: true });

    const stdRoles    = computed(() => Object.values(ROLES).filter(r => r.std));
    const extraRoles  = computed(() => Object.values(ROLES).filter(r => !r.std));
    const alivePlayers = computed(() => state.players.filter(p => p.alive));
    const nightRole   = computed(() => state.nightQueue[state.nightQueueIdx] || null);
    const nightRoleDef = computed(() => nightRole.value ? ROLES[nightRole.value] : null);
    const nightTargetList = computed(() => nightTargets());
    const nightIsDone = computed(() => state.nightQueueIdx >= state.nightQueue.length);
    const revealPlayer = computed(() => state.players[state.revealIdx]);
    const revealRole2  = computed(() => revealPlayer.value ? ROLES[revealPlayer.value.roleId] : null);
    const rrPlayer = computed(() => state.roleRevealModal.playerIdx !== null ? state.players[state.roleRevealModal.playerIdx] : null);
    const rrRole   = computed(() => rrPlayer.value ? ROLES[rrPlayer.value.roleId] : null);

    return {
      state, BUILD, CHANGELOG, DONATE_URL, SUPPORTED_LOCALES, ROLES,
      stdRoles, extraRoles, alivePlayers, nightRole, nightRoleDef,
      nightTargetList, nightIsDone, roleCountTotal, roleSummary, canStart,
      nightQueueIdx: computed(() => state.nightQueueIdx),
      revealPlayer, revealRole2, rrPlayer, rrRole,
      t, i18nState, roleName, roleDesc, roleAbility, roleGoal, teamLabel,
      setTheme, setLang, setUserName, haptic, changePlayerCount, toggleRole, changeRole, selectMode,
      openSeating, closeSeating, selectSeat, moveSeat,
      openGameMenu, closeGameMenu, pauseGame, resumeGame, confirmEndGame,
      getInviteLink, shareInviteLink,
      startCoopVote, castCoopVote, resolveCoopVote, skipCoopVote,
      sendNightRequest, submitNightAction,
      startLocalGame, revealRole, nextReveal,
      loadLastNamesIntoSetup, dismissNamesHint,
      saveCurrentConfig, loadConfig, removeConfig,
      openRoleReveal, closeRoleReveal, revealRoleAgain,
      exportGameLog,
      startNight, confirmNight, skipNight, selectNightTarget, startDay,
      confirmDay, skipDay, selectDay, newGame,
      confirmJaeger,
      showHostSetup, createRoom, startCoopGame,
      showJoinSetup, joinRoom, toggleReady, cancelCoop,
      dismissWhatsNew, applyUpdate, checkForUpdate,
    };
  },
  template: `
  <div class="app" :class="{ rtl: i18nState.rtl }">

    <!-- ── SITZREIHENFOLGE MODAL ── -->
    <div v-if="state.showSeating" class="modal-bg" @click.self="closeSeating">
      <div class="modal modal-wide">
        <div class="modal-head">
          <h2>{{ t('seating.title') }}</h2>
          <button class="modal-close" @click="closeSeating">✕</button>
        </div>
        <div class="modal-body">
          <p class="confirm-msg" style="margin-bottom:.5rem">{{ t('seating.sub') }}</p>
          <p class="seat-hint">{{ state.seatSelected !== null ? '✓ Ausgewählt — tippe einen anderen Platz zum Tauschen' : t('seating.hint') }}</p>
          <div class="seat-list">
            <div v-for="(playerIdx, seatPos) in state.seatOrder" :key="seatPos"
              class="seat-item"
              :class="{ 'seat-item-selected': state.seatSelected === seatPos }"
              @click="selectSeat(seatPos)">
              <div class="seat-num">{{ seatPos + 1 }}</div>
              <div class="seat-avatar">
                {{ (state.playerNames[playerIdx] || '?')[0].toUpperCase() }}
              </div>
              <div class="seat-name">
                {{ state.playerNames[playerIdx] || (t('setup.playerUnit') + ' ' + (playerIdx+1)) }}
              </div>
              <div class="seat-arrows" @click.stop>
                <button class="seat-arrow" @click="moveSeat(seatPos,-1)" :disabled="seatPos===0">▲</button>
                <button class="seat-arrow" @click="moveSeat(seatPos, 1)" :disabled="seatPos===state.seatOrder.length-1">▼</button>
              </div>
            </div>
          </div>
          <div class="seat-circle-hint">🔄 {{ t('seating.circle') }}</div>
          <button class="btn btn-primary" style="margin-top:.5rem" @click="closeSeating">{{ t('seating.done') }}</button>
        </div>
      </div>
    </div>

    <!-- ── PAUSE OVERLAY ── -->
    <div v-if="state.gamePaused" class="modal-bg" style="z-index:500">
      <div class="modal" style="text-align:center">
        <div style="font-size:3rem;margin-bottom:.8rem">🌙</div>
        <h3 style="font-family:Cinzel,serif;color:var(--gold);margin-bottom:.5rem">PAUSIERT</h3>
        <p class="confirm-msg">Das Spiel ist pausiert. Tippe Fortsetzen wenn alle bereit sind.</p>
        <button class="btn btn-primary" @click="resumeGame">▶ Fortsetzen</button>
        <button class="btn btn-ghost btn-sm" @click="state.gamePaused=false;state.gameEndConfirm=true">Spiel beenden</button>
      </div>
    </div>

    <!-- ── GAME MENÜ ── -->
    <div v-if="state.gameMenu.active" class="modal-bg" @click.self="closeGameMenu">
      <div class="modal">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1.1rem">
          <span style="font-family:'Cinzel',serif;font-size:.9rem;letter-spacing:.15em;color:var(--gold)">SPIELMENÜ</span>
          <button class="icon-btn" @click="closeGameMenu">✕</button>
        </div>
        <button class="btn btn-primary" style="margin-bottom:.6rem" @click="closeGameMenu">▶ Fortsetzen</button>
        <button class="btn btn-ghost" style="margin-bottom:.6rem" @click="openRoleReveal(null);state.gameMenu.active=false">🃏 Karten anzeigen</button>
        <div style="height:1px;background:var(--bdr);margin:.4rem 0 .9rem"></div>
        <button class="btn btn-ghost" style="margin-bottom:.6rem" @click="state.showSettingsModal=true;state.gameMenu.active=false">⚙️ Einstellungen</button>
        <button class="btn btn-ghost" style="margin-bottom:.6rem" @click="state.showWwRules=true;state.gameMenu.active=false">❓ Anleitung</button>
        <div style="height:1px;background:var(--bdr);margin:.4rem 0 .9rem"></div>
        <button class="btn btn-ghost" style="color:#e07070;border-color:#e07070" @click="state.gameEndConfirm=true;state.gameMenu.active=false">
          🚪 Spiel beenden
        </button>
      </div>
    </div>

    <!-- ── SPIEL BEENDEN BESTÄTIGUNG ── -->
    <div v-if="state.gameEndConfirm" class="modal-bg" style="z-index:510">
      <div class="modal">
        <div class="whatsnew-badge" style="background:#8b1a1a">⚠ Beenden</div>
        <h3>Spiel wirklich beenden?</h3>
        <p class="confirm-msg">Der aktuelle Spielstand geht verloren. Alle Rollen werden aufgedeckt.</p>
        <button class="btn btn-ghost" style="color:#e07070;border-color:#e07070;margin-bottom:.6rem" @click="confirmEndGame">
          Ja, Spiel beenden
        </button>
        <button class="btn btn-primary" @click="state.gameEndConfirm=false;state.gamePaused=false;state.gameMenu.active=false">
          Nein, weiterspielen
        </button>
      </div>
    </div>

    <!-- ── WERWOLF ANLEITUNG ── -->
    <div v-if="state.showWwRules" class="modal-bg" @click.self="state.showWwRules=false" style="z-index:520">
      <div class="modal" style="max-height:85vh;overflow-y:auto">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem">
          <span style="font-family:'Cinzel',serif;font-size:.9rem;letter-spacing:.15em;color:var(--gold)">ANLEITUNG</span>
          <button class="icon-btn" @click="state.showWwRules=false">✕</button>
        </div>
        <div class="rules-section">
          <div class="rules-step">1️⃣ <strong>Rollen verteilen</strong><br>Jeder Spieler bekommt heimlich eine Rolle: Dorfbewohner, Werwolf, Seherin, Hexe oder andere Sonderrollen.</div>
          <div class="rules-step">🌙 <strong>Nachtphase</strong><br>Alle schließen die Augen. Der Spielleiter weckt die Werwölfe — sie wählen ein Opfer. Dann kommen Seherin und Hexe dran.</div>
          <div class="rules-step">☀️ <strong>Tagphase</strong><br>Das Dorf diskutiert, wer ein Werwolf sein könnte. Am Ende stimmt das Dorf ab und eliminiert einen Spieler.</div>
          <div class="rules-step">🔁 <strong>Rundenablauf</strong><br>Nacht und Tag wechseln sich ab bis das Dorf alle Werwölfe gefunden hat — oder die Werwölfe in der Mehrheit sind.</div>
          <div class="rules-step">🏆 <strong>Wer gewinnt?</strong><br>Das Dorf gewinnt wenn alle Werwölfe eliminiert sind. Die Werwölfe gewinnen wenn sie gleich viele oder mehr Spieler sind als das Dorf.</div>
        </div>
        <button class="btn btn-primary" style="margin-top:.8rem" @click="state.showWwRules=false">Verstanden ✓</button>
      </div>
    </div>

    <!-- ── JÄGER POPUP ── -->
    <div v-if="state.jaegerModal.active" class="modal-bg">
      <div class="modal">
        <div class="whatsnew-badge">🏹 Jäger</div>
        <h3>{{ t('jaeger.title') }}</h3>
        <p class="confirm-msg">{{ t('jaeger.sub') }}</p>
        <div class="abtns" style="margin-bottom:1rem">
          <button v-for="(p,i) in state.players.filter(pl=>pl.alive)" :key="i" class="abtn"
            @click="confirmJaeger(state.players.indexOf(p))">
            {{ ROLES[p.roleId]?.icon }} {{ p.name }}
          </button>
        </div>
        <button class="btn btn-ghost btn-sm" @click="confirmJaeger(null)">{{ t('jaeger.skip') }}</button>
      </div>
    </div>

    <!-- ── COOP ABSTIMMUNG (Gast-Ansicht) ── -->
    <div v-if="state.coopVote.active && !state.coop.isHost" class="modal-bg" style="z-index:400">
      <div class="modal">
        <div class="whatsnew-badge">☀️ Abstimmung</div>
        <h3>Wen hinrichten?</h3>
        <p class="confirm-msg">Wähle einen Spieler zur Hinrichtung.</p>
        <div v-if="!state.coopVote.myVote">
          <div class="abtns" style="margin-bottom:1rem">
            <button v-for="c in state.coopVote.candidates" :key="c.name"
              class="abtn" @click="castCoopVote(c.name)">
              {{ ROLES[c.roleId]?.icon }} {{ c.name }}
            </button>
          </div>
          <button class="btn btn-ghost btn-sm" @click="castCoopVote(null)">Enthalten</button>
        </div>
        <div v-else style="text-align:center;padding:1rem">
          <div style="font-size:1.5rem">✓</div>
          <p style="color:var(--txt2);font-size:.85rem;margin-top:.4rem">
            Stimme abgegeben für <strong>{{ state.coopVote.myVote }}</strong>
          </p>
          <p style="color:var(--txt3);font-size:.78rem;margin-top:.3rem">Warte auf Host…</p>
        </div>
      </div>
    </div>

    <!-- ── COOP ABSTIMMUNG (Host-Ansicht: Live-Stimmen) ── -->
    <div v-if="state.coopVote.active && state.coop.isHost" class="modal-bg" style="z-index:400">
      <div class="modal">
        <div class="whatsnew-badge">☀️ Live-Abstimmung</div>
        <h3>Stimmen</h3>
        <div class="vote-results">
          <div v-for="c in state.coopVote.candidates" :key="c.name" class="vote-row">
            <span class="vote-name">{{ ROLES[c.roleId]?.icon }} {{ c.name }}</span>
            <span class="vote-bar">
              <span class="vote-fill" :style="{width: Math.min(100,(state.coopVote.votes[c.name]||0)*25)+'%'}"></span>
            </span>
            <span class="vote-count">{{ state.coopVote.votes[c.name] || 0 }}</span>
          </div>
        </div>
        <button class="btn btn-primary" style="margin-top:1rem" @click="resolveCoopVote">Auswerten</button>
        <button class="btn btn-ghost btn-sm" @click="skipCoopVote">Niemanden hinrichten</button>
      </div>
    </div>

    <!-- ── COOP NACHTAKTION (Gast mit Nacht-Rolle) ── -->
    <div v-if="state.coopNight.active" class="modal-bg" style="z-index:400">
      <div class="modal">
        <div class="whatsnew-badge">🌙 Nacht</div>
        <h3>{{ ROLES[state.coopNight.roleId]?.icon }} {{ roleName(state.coopNight.roleId) }}</h3>
        <p class="confirm-msg">{{ roleAbility(state.coopNight.roleId) }}</p>
        <div class="abtns" style="margin-bottom:1rem">
          <button v-for="name in state.coopNight.targets" :key="name"
            class="abtn" @click="submitNightAction(name)">
            👤 {{ name }}
          </button>
        </div>
        <button class="btn btn-ghost btn-sm" @click="submitNightAction(null)">Überspringen</button>
      </div>
    </div>

    <!-- ── UPDATE MODAL — exakt wie Screenshot ── -->
    <div v-if="state.updateReady" class="modal-bg">
      <div class="uc-card">
        <div class="uc-badge">⬆ Update</div>
        <div class="uc-title">Neue Version verfügbar</div>
        <div class="uc-desc">Eine neue Version ist bereit. Du kannst vorher ein Backup deiner Daten herunterladen, danach wird die App aktualisiert und neu gestartet.</div>
        <button class="uc-btn-backup" @click="exportGameLog">
          ⬇ Backup herunterladen
        </button>
        <button class="uc-btn-primary" @click="applyUpdate">
          Aktualisieren &amp; neu starten
        </button>
        <button class="uc-btn-later" @click="state.updateReady=false">Später</button>
      </div>
    </div>

    <!-- ── WHATS NEW / VERSIONSHISTORIE ── -->
    <div v-if="state.showWhatsNew || state.showHistory" class="modal-bg" @click.self="dismissWhatsNew();state.showHistory=false;state.historyDetail=null">
      <div class="modal modal-wide">

        <!-- Detail-Ansicht einer Version -->
        <template v-if="state.historyDetail">
          <div class="cl-detail-back" @click="state.historyDetail=null">← Zurück zur Übersicht</div>
          <div style="margin-bottom:.3rem">
            <span class="cl-version-badge">v{{ state.historyDetail.version }}</span>
          </div>
          <h3 style="margin-bottom:.3rem">v{{ state.historyDetail.version }}</h3>
          <div style="font-size:.74rem;color:var(--txt3);margin-bottom:.9rem">{{ state.historyDetail.date }}</div>
          <ul class="whatsnew-list">
            <li v-for="c in state.historyDetail.changes" :key="c">{{ c }}</li>
          </ul>
          <button class="btn btn-primary" @click="state.historyDetail=null">← Zurück</button>
        </template>

        <!-- Übersicht aller Versionen -->
        <template v-else>
          <div class="whatsnew-badge">{{ state.showHistory ? '📋' : '✨' }} {{ state.showHistory ? t('settings.history') : t('whatsNew.badge') }}</div>

          <!-- showWhatsNew: aktuelle Version groß (Screenshot 1) -->
          <template v-if="CHANGELOG.length && !state.showHistory">
            <div class="wnv-version">Version {{ CHANGELOG[0].version }}</div>
            <ul class="wnv-list">
              <li v-for="c in CHANGELOG[0].changes" :key="c">{{ c }}</li>
            </ul>
          </template>

          <!-- showHistory: scrollbare Karten-Liste -->
          <template v-if="CHANGELOG.length && state.showHistory">
            <div style="max-height:55vh;overflow-y:auto;margin:.3rem -0.2rem 0;padding:.2rem">
              <div v-for="(entry, idx) in CHANGELOG" :key="entry.version"
                class="cl-version-card" @click="state.historyDetail=entry">
                <div class="cl-version-card-head">
                  <span class="cl-version-num">v{{ entry.version }}</span>
                  <span class="cl-version-date">{{ entry.date }}{{ idx===0 ? ' · Aktuell' : '' }}</span>
                </div>
                <ul class="cl-version-preview-list">
                  <li v-for="c in entry.changes.slice(0,2)" :key="c">{{ c }}</li>
                  <li v-if="entry.changes.length > 2" class="cl-more">+{{ entry.changes.length - 2 }} weitere…</li>
                </ul>
                <div class="cl-tap-hint">Antippen für Details →</div>
              </div>
            </div>
          </template>

          <button class="btn btn-primary" style="margin-top:.9rem" @click="dismissWhatsNew();state.showHistory=false;state.historyDetail=null">{{ t('whatsNew.close') }}</button>
        </template>

      </div>
    </div>

    <!-- ── EINSTELLUNGEN DRAWER ── -->
    <template v-if="state.showSettingsModal">
      <div class="settings-overlay" @click="state.showSettingsModal=false"></div>
      <div class="settings-drawer">
        <div class="drawer-head">
          <span class="drawer-title">{{ t('settings.title') }}</span>
          <button class="icon-btn" @click="state.showSettingsModal=false">✕</button>
        </div>
        <div class="drawer-body">

          <!-- Allgemein -->
          <div class="drawer-section">
            <div class="drawer-section-title">Allgemein</div>
            <div class="srow">
              <div><div class="slabel">Benutzername</div><div class="ssub">Für Multiplayer-Spiele</div></div>
              <input class="ninput" type="text" maxlength="20" placeholder="Dein Name"
                :value="state.userName" @input="setUserName($event.target.value)" style="max-width:150px;padding-left:.6rem"/>
            </div>
          </div>

          <!-- Darstellung -->
          <div class="drawer-section">
            <div class="drawer-section-title">Darstellung</div>
            <div class="srow" style="flex-direction:column;align-items:flex-start;gap:.6rem">
              <div class="slabel">Theme</div>
              <div class="theme-btns">
                <button v-for="th in ['dark','light','auto']" :key="th"
                  class="theme-btn" :class="{active: state.settings.theme===th}"
                  @click="setTheme(th)">
                  {{ th==='dark'?'🌙 Dunkel':th==='light'?'☀️ Hell':'🔄 System' }}
                </button>
              </div>
            </div>
            <div class="srow" style="border:none">
              <div><div class="slabel">{{ t('settings.lang') }}</div><div class="ssub">{{ t('settings.langSub') }}</div></div>
              <select class="lsel" :value="state.settings.lang" @change="setLang($event.target.value)">
                <option v-for="l in SUPPORTED_LOCALES" :key="l.id" :value="l.id">{{ l.label }}</option>
              </select>
            </div>
          </div>

          <!-- Version/Updates entfernt — Versionskontrolle liegt bei Gruppen-Spiele. -->

        </div>
      </div>
    </template>

    <!-- ── ROLLE NOCHMAL ANZEIGEN ── -->
    <div v-if="state.roleRevealModal.active" class="modal-bg" @click.self="closeRoleReveal">
      <div class="modal">
        <div class="modal-head"><h2>{{ t('roleReveal.title') }}</h2><button class="modal-close" @click="closeRoleReveal">✕</button></div>
        <div class="modal-body">
          <template v-if="state.roleRevealModal.playerIdx === null">
            <p class="confirm-msg">{{ t('roleReveal.sub') }}</p>
            <div class="abtns">
              <button v-for="(p,i) in state.players" :key="i" class="abtn" @click="state.roleRevealModal.playerIdx=i">
                {{ p.alive ? ROLES[p.roleId]?.icon : '💀' }} {{ p.name }}
              </button>
            </div>
          </template>
          <template v-else-if="rrPlayer">
            <div style="text-align:center">
              <div class="rev-head" style="margin-bottom:.8rem">
                <div class="for">{{ t('reveal.for') }}</div>
                <div class="pname">{{ rrPlayer.name }}</div>
              </div>
              <div class="rev-card" :class="[state.roleRevealModal.flipped?'flipped':'', state.roleRevealModal.flipped?(rrRole?.team==='wolf'?'wc':rrRole?.team==='dorf'?'dc':'sc'):'']" style="margin:0 auto">
                <div class="card-back" v-show="!state.roleRevealModal.flipped" @click="revealRoleAgain" style="cursor:pointer">
                  <div class="cbi">🌑</div><div class="cbt">{{ t('reveal.tap') }}</div>
                </div>
                <div class="card-front" v-show="state.roleRevealModal.flipped" @click="state.roleRevealModal.flipped=false;state.roleRevealModal.showTips=false" style="cursor:pointer">
                  <div class="cfi">{{ rrRole?.icon }}</div>
                  <div class="cft">{{ roleName(rrPlayer.roleId) }}</div>
                  <div class="ctbadge" :class="rrRole?.team==='wolf'?'wb':rrRole?.team==='dorf'?'db':'sb'">{{ teamLabel(rrRole?.team) }}</div>
                  <div class="cfa">{{ roleAbility(rrPlayer.roleId) }}</div>
                  <div class="cfg">{{ roleGoal(rrPlayer.roleId) }}</div>
                </div>
              </div>
              <!-- Tipps -->
              <div v-if="state.roleRevealModal.flipped" style="margin-top:.9rem">
                <button class="ver-hist-btn" style="width:100%;text-align:center" @click="state.roleRevealModal.showTips=!state.roleRevealModal.showTips">
                  {{ state.roleRevealModal.showTips ? t('tips.hide') : t('tips.show') }}
                </button>
                <div v-if="state.roleRevealModal.showTips" class="tips-box">
                  <div class="tips-title">{{ t('tips.title') }}</div>
                  <ul class="tips-list">
                    <li v-for="tip in (t('tips.'+rrPlayer.roleId) || t('tips.default'))" :key="tip">{{ tip }}</li>
                  </ul>
                </div>
              </div>
              <button class="btn btn-ghost btn-sm" style="margin-top:.8rem;width:100%" @click="state.roleRevealModal.playerIdx=null; state.roleRevealModal.flipped=false; state.roleRevealModal.showTips=false">← Anderen Spieler wählen</button>
            </div>
          </template>
          <button class="btn btn-ghost btn-sm" style="margin-top:.8rem;width:100%" @click="closeRoleReveal">{{ t('roleReveal.back') }}</button>
        </div>
      </div>
    </div>

    <!-- ═══ HOME ═══ -->
    <div v-if="state.screen==='home'" class="screen">
      <div class="top-bar">
        <a v-if="DONATE_URL" class="home-donate-btn icon-btn" :href="DONATE_URL" target="_blank" rel="noopener">☕ <span class="home-donate-heart">❤</span></a>
        <button class="icon-btn" @click="state.showSettingsModal=true">⚙️</button>
      </div>
      <div style="max-width:680px;margin:0 auto;padding:0 1.4rem 4rem">
        <div class="logo">
          <span class="logo-moon">🌕</span>
          <h1>{{ t('app.title') }}</h1>
          <p>{{ t('app.sub') }}</p>
        </div>

        <!-- Namen-Hint -->
        <div v-if="state.showSavedNamesHint && state.gameMode==='local'" class="names-hint">
          <span>{{ t('savedNames.hint') }} ({{ state.lastSavedNames.filter(n=>n).slice(0,3).join(', ') }}…)</span>
          <div style="display:flex;gap:.5rem;margin-top:.5rem">
            <button class="btn-blue" style="flex:1;padding:.5rem;font-size:.78rem;margin:0" @click="loadLastNamesIntoSetup">{{ t('savedNames.load') }}</button>
            <button class="btn-sec" style="flex:1;padding:.5rem;font-size:.78rem;margin:0" @click="dismissNamesHint">{{ t('savedNames.dismiss') }}</button>
          </div>
        </div>

        <!-- Spielmodus -->
        <div class="sec"><h2>{{ t('mode.title') }}</h2>
          <div class="mode-grid">
            <div class="mode-card" :class="{active:state.gameMode==='local'}" @click="selectMode('local')">
              <span class="mode-icon">📱</span><div class="mode-name">{{ t('mode.local') }}</div><div class="mode-desc">{{ t('mode.localSub') }}</div>
            </div>
            <div class="mode-card" :class="{active:state.gameMode==='coop'}" @click="selectMode('coop')">
              <span class="mode-icon">🌐</span><div class="mode-name">{{ t('mode.coop') }}</div><div class="mode-desc">{{ t('mode.coopSub') }}</div>
            </div>
          </div>
        </div>

        <!-- Lokaler Modus -->
        <template v-if="state.gameMode==='local'">
          <!-- Konfigurationen -->
          <div class="sec">
            <h2>{{ t('configs.title') }}
              <button class="ver-hist-btn" style="margin-left:auto" @click="state.showConfigs=!state.showConfigs">
                {{ state.showConfigs ? '▲' : '▼' }} ({{ state.savedConfigs.length }})
              </button>
            </h2>
            <div v-if="state.showConfigs">
              <div v-if="!state.savedConfigs.length" style="color:var(--txt2);font-size:.82rem;margin-bottom:.7rem">{{ t('configs.empty') }}</div>
              <div v-for="cfg in state.savedConfigs" :key="cfg.id" class="config-row">
                <div class="config-info">
                  <div class="config-name">{{ cfg.name }}</div>
                  <div class="config-sub">{{ cfg.playerCount }} Spieler</div>
                </div>
                <button class="btn-blue" style="padding:.35rem .7rem;font-size:.74rem;margin:0;width:auto" @click="loadConfig(cfg)">{{ t('configs.load') }}</button>
                <button class="btn-sec" style="padding:.35rem .6rem;font-size:.74rem;margin:0;width:auto" @click="removeConfig(cfg.id)">🗑</button>
              </div>
              <div style="display:flex;gap:.5rem;margin-top:.6rem">
                <input class="ninput" v-model="state.configNameDraft" style="flex:1;padding:.5rem .8rem" :placeholder="t('configs.placeholder')"/>
                <button class="btn-blue" style="white-space:nowrap;padding:.5rem .8rem;font-size:.78rem;margin:0;width:auto" @click="saveCurrentConfig">💾 {{ t('configs.save') }}</button>
              </div>
            </div>
          </div>

          <div class="sec"><h2>{{ t('setup.players') }}</h2>
            <div class="pc-row">
              <button class="cnt-btn" @touchstart.prevent="changePlayerCount(-1)" @click="changePlayerCount(-1)">−</button>
              <div class="pc-stepper"><span class="pc-num">{{ state.playerCount }}</span><span class="cnt-lbl">{{ t('setup.playerUnit') }}</span></div>
              <button class="cnt-btn" @touchstart.prevent="changePlayerCount(1)" @click="changePlayerCount(1)">+</button>
            </div>
          </div>

          <div class="sec">
            <h2>{{ t('setup.names') }}
              <button class="ver-hist-btn" style="margin-left:auto;font-size:.7rem" @click="openSeating">💺 {{ t('seating.title') }}</button>
            </h2>
            <div class="names-scroll">
              <div class="names-grid">
                <div v-for="(n,i) in state.playerNames" :key="i" class="nwrap">
                  <span>👤</span>
                  <input class="ninput" type="text" maxlength="20" :placeholder="t('setup.playerUnit')+' '+(i+1)" v-model="state.playerNames[i]"/>
                </div>
              </div>
            </div>
          </div>

          <div class="sec"><h2>{{ t('setup.roles') }}</h2>
            <div class="tabs">
              <button class="tbtn" :class="{active:state.setupTab==='std'}" @click="state.setupTab='std'">⚔ {{ t('setup.std') }}</button>
              <button class="tbtn" :class="{active:state.setupTab==='extra'}" @click="state.setupTab='extra'">✦ {{ t('setup.extra') }}</button>
            </div>
            <div class="rgrid">
              <div v-for="r in (state.setupTab==='std'?stdRoles:extraRoles)" :key="r.id"
                class="rcard" :class="['t'+r.team[0],(state.selectedRoles[r.id]||0)>0?'sel':'']"
                @click="toggleRole(r.id)">
                <span class="ri">{{ r.icon }}</span>
                <span class="tbadge" :class="r.team">{{ teamLabel(r.team) }}</span>
                <div class="rn">{{ roleName(r.id) }}</div>
                <div class="rd">{{ roleDesc(r.id) }}</div>
                <div v-if="r.max>1" class="rcnt" @click.stop>
                  <button class="mbtn" @click="changeRole(r.id,-1)">−</button>
                  <span class="cmini">{{ state.selectedRoles[r.id]||0 }}</span>
                  <button class="mbtn" @click="changeRole(r.id,1)">+</button>
                </div>
              </div>
            </div>
            <div class="rsum">
              <div class="sitem"><div class="sdot wolf"></div>{{ roleSummary.w }} {{ t('team.wolves') }}</div>
              <div class="sitem"><div class="sdot dorf"></div>{{ roleSummary.d }} {{ t('team.villageSingle') }}</div>
              <div class="sitem"><div class="sdot solo"></div>{{ roleSummary.s }} {{ t('team.soloSingle') }}</div>
              <div class="sitem" style="margin-left:auto;color:var(--gold);font-family:Cinzel,serif;font-size:.72rem">{{ roleCountTotal }} / {{ state.playerCount }}</div>
              <div v-if="!canStart" class="swarn">{{ roleSummary.w===0?t('setup.warnNeedWolf'):t('setup.warnCount') }}</div>
            </div>
          </div>
          <button class="btn-start" :disabled="!canStart" @click="startLocalGame">🐺 {{ t('setup.startBtn') }}</button>
        </template>

        <!-- Coop -->
        <template v-else>
          <template v-if="state.coop.phase==='idle'">
            <div class="sec"><h2>{{ t('mode.coop') }}</h2>
              <div style="display:flex;gap:.7rem">
                <button class="btn-blue" style="flex:1" @click="showHostSetup">👑 {{ t('coop.host') }}</button>
                <button class="btn-sec" style="flex:1" @click="showJoinSetup">🚪 {{ t('coop.join') }}</button>
              </div>
            </div>
          </template>
          <template v-else-if="state.coop.phase==='hosting'">
            <div class="sec"><h2>{{ t('coop.code') }}</h2>
              <div class="coop-box">
                <p class="coop-hint">{{ t('coop.codeSub') }}</p>
                <input class="code-input" v-model="state.coop.codeDraft" type="text" maxlength="6" inputmode="numeric" pattern="[0-9]*" placeholder="123456" @input="state.coop.codeDraft=state.coop.codeDraft.replace(/\\D/g,'').slice(0,6)" style="margin-bottom:.5rem"/>
                <div v-if="state.coop.error" class="coop-error">{{ state.coop.error }}</div>
                <button class="btn-blue" @click="createRoom">{{ t('coop.host') }}</button>
                <button class="btn-sec" style="margin-top:.5rem" @click="state.coop.phase='idle'">{{ t('coop.cancel') }}</button>
              </div>
            </div>
          </template>
          <template v-else-if="state.coop.phase==='lobby'">
            <div class="sec"><h2>{{ t('coop.code') }}: {{ state.coop.code }}</h2>
              <div class="coop-box">
                <p class="coop-hint">{{ t('coop.waiting') }}</p>

                <!-- Einladungslink -->
                <div class="invite-box">
                  <div class="invite-code">{{ state.coop.code }}</div>
                  <button class="btn-blue" style="margin:0;padding:.55rem 1rem;font-size:.8rem" @click="shareInviteLink">
                    🔗 Link teilen
                  </button>
                </div>

                <ul class="lobby-list">
                  <li v-for="p in state.coop.players" :key="p.uid" class="lobby-item">
                    <span class="li-icon">{{ p.isHost?'👑':'👤' }}</span>
                    <span class="li-name">{{ p.name }}</span>
                    <span class="li-ready" :class="p.isHost?'host':p.ready?'yes':'no'">{{ p.isHost?t('coop.host'):p.ready?t('coop.ready'):t('coop.notReady') }}</span>
                  </li>
                </ul>
                <div style="margin-top:1rem">
                  <div class="tabs">
                    <button class="tbtn" :class="{active:state.setupTab==='std'}" @click="state.setupTab='std'">⚔ {{ t('setup.std') }}</button>
                    <button class="tbtn" :class="{active:state.setupTab==='extra'}" @click="state.setupTab='extra'">✦ {{ t('setup.extra') }}</button>
                  </div>
                  <div class="rgrid" style="max-height:260px;overflow-y:auto">
                    <div v-for="r in (state.setupTab==='std'?stdRoles:extraRoles)" :key="r.id"
                      class="rcard" :class="['t'+r.team[0],(state.selectedRoles[r.id]||0)>0?'sel':'']" @click="toggleRole(r.id)">
                      <span class="ri">{{ r.icon }}</span><span class="tbadge" :class="r.team">{{ teamLabel(r.team) }}</span>
                      <div class="rn">{{ roleName(r.id) }}</div>
                      <div v-if="r.max>1" class="rcnt" @click.stop>
                        <button class="mbtn" @click="changeRole(r.id,-1)">−</button>
                        <span class="cmini">{{ state.selectedRoles[r.id]||0 }}</span>
                        <button class="mbtn" @click="changeRole(r.id,1)">+</button>
                      </div>
                    </div>
                  </div>
                </div>
                <button class="btn-start" style="margin-top:1rem" :disabled="state.coop.players.length<2" @click="startCoopGame">🐺 {{ t('coop.startBtn') }}</button>
                <button class="btn-sec" style="margin-top:.5rem" @click="cancelCoop">{{ t('coop.cancel') }}</button>
              </div>
            </div>
          </template>
          <template v-else-if="state.coop.phase==='joining'">
            <div class="sec"><h2>{{ t('coop.join') }}</h2>
              <div class="coop-box">
                <input class="name-input-big" v-model="state.coop.myName" type="text" maxlength="20" :placeholder="t('coop.namePlaceholder')"/>
                <input class="code-input" v-model="state.coop.codeDraft" type="text" maxlength="6" inputmode="numeric" placeholder="123456" @input="state.coop.codeDraft=state.coop.codeDraft.replace(/\\D/g,'').slice(0,6)"/>
                <div v-if="state.coop.error" class="coop-error">{{ state.coop.error }}</div>
                <button class="btn-blue" @click="joinRoom">{{ t('coop.joinBtn') }}</button>
                <button class="btn-sec" style="margin-top:.5rem" @click="state.coop.phase='idle'">{{ t('coop.cancel') }}</button>
              </div>
            </div>
          </template>
          <template v-else-if="state.coop.phase==='joined'">
            <div class="sec"><h2>{{ t('coop.code') }}: {{ state.coop.code }}</h2>
              <div class="coop-box" style="text-align:center">
                <div style="font-size:2rem;margin-bottom:.6rem">⏳</div>
                <div class="coop-hint">{{ t('coop.waiting') }}</div>
                <button class="btn-blue" style="max-width:220px;margin:.8rem auto .5rem" @click="toggleReady">{{ t('coop.readyBtn') }}</button>
                <button class="btn-sec" style="max-width:220px;margin:0 auto" @click="cancelCoop">{{ t('coop.leave') }}</button>
              </div>
            </div>
          </template>
          <template v-else-if="state.coop.phase==='myRole'">
            <div class="sec" style="text-align:center;padding-top:1rem">
              <div class="rev-card dc" style="margin:1rem auto;max-width:300px">
                <div class="card-front" style="display:block">
                  <div class="cfi">{{ ROLES[state.coop.myRoleId]?.icon }}</div>
                  <div class="cft">{{ roleName(state.coop.myRoleId) }}</div>
                  <div class="ctbadge" :class="ROLES[state.coop.myRoleId]?.team==='wolf'?'wb':ROLES[state.coop.myRoleId]?.team==='dorf'?'db':'sb'">{{ teamLabel(ROLES[state.coop.myRoleId]?.team) }}</div>
                  <div class="cfa">{{ roleAbility(state.coop.myRoleId) }}</div>
                  <div class="cfg">{{ roleGoal(state.coop.myRoleId) }}</div>
                </div>
              </div>
            </div>
          </template>
        </template>
      </div>
    </div>

    <!-- ═══ REVEAL ═══ -->
    <div v-if="state.screen==='reveal'" class="screen">
      <div class="top-bar"><button class="icon-btn" @click="state.showSettingsModal=true">⚙️</button></div>
      <div class="reveal-inner">
        <div class="rev-head"><div class="for">{{ t('reveal.for') }}</div><div class="pname">{{ revealPlayer?.name }}</div></div>
        <div class="rev-card" :class="[state.revealFlipped?'flipped':'', state.revealFlipped?(revealRole2?.team==='wolf'?'wc':revealRole2?.team==='dorf'?'dc':'sc'):'']">
          <div class="card-back" v-show="!state.revealFlipped" @click="revealRole" style="cursor:pointer">
            <div class="cbi">🌑</div><div class="cbt">{{ t('reveal.tap') }}</div>
          </div>
          <div class="card-front" v-show="state.revealFlipped" @click="state.revealFlipped=false;state.showRevealTips=false" style="cursor:pointer" :title="'Antippen zum Verdecken'">
            <div class="cfi">{{ revealRole2?.icon }}</div>
            <div class="cft">{{ roleName(revealPlayer?.roleId) }}</div>
            <div class="ctbadge" :class="revealRole2?.team==='wolf'?'wb':revealRole2?.team==='dorf'?'db':'sb'">{{ teamLabel(revealRole2?.team) }}</div>
            <div class="cfa">{{ roleAbility(revealPlayer?.roleId) }}</div>
            <div class="cfg">{{ roleGoal(revealPlayer?.roleId) }}</div>
          </div>
        </div>
        <button class="btn-rev" v-if="!state.revealFlipped" @click="revealRole">{{ t('reveal.show') }}</button>
        <template v-else>
          <!-- Tipps nach Aufdecken -->
          <div style="width:100%;max-width:310px;margin-bottom:.6rem">
            <button class="ver-hist-btn" style="width:100%;text-align:center" @click="state.showRevealTips=!state.showRevealTips">
              {{ state.showRevealTips ? t('tips.hide') : t('tips.show') }}
            </button>
            <div v-if="state.showRevealTips" class="tips-box">
              <div class="tips-title">{{ t('tips.title') }}</div>
              <ul class="tips-list">
                <li v-for="tip in (t('tips.'+revealPlayer?.roleId) || t('tips.default'))" :key="tip">{{ tip }}</li>
              </ul>
            </div>
          </div>
          <button class="btn-nxt" @click="nextReveal">{{ t('reveal.next') }} →</button>
        </template>
        <div class="rev-prog">{{ state.revealIdx+1 }} / {{ state.players.length }}</div>
      </div>
    </div>

    <!-- ═══ GAME ═══ -->
    <div v-if="state.screen==='game'" class="screen">
      <div class="top-bar">
        <button class="icon-btn" @click="openGameMenu" title="Spielmenü" style="color:#e07070">⏸</button>
      </div>
      <div class="game-inner">
        <div class="game-hdr">
          <div class="phase-badge"><span class="phicon">{{ state.phase==='night'?'🌙':'☀️' }}</span><span>{{ state.phase==='night'?t('game.night'):t('game.day') }} {{ state.round }}</span></div>
          <div class="rinfo">{{ t('game.round') }} {{ state.round }}</div>
        </div>
        <div class="log-now">{{ state.logNow }}</div>
        <div class="psec"><h3>{{ t('game.players') }}</h3>
          <div class="plist">
            <div v-for="(p,i) in state.players" :key="i" class="pchip" :class="{dead:!p.alive}">
              <span class="pi">{{ p.alive?ROLES[p.roleId]?.icon:'💀' }}</span>
              <span class="pn">{{ p.name }}</span>
            </div>
          </div>
        </div>

        <!-- Nacht -->
        <div v-if="state.phase==='night'" class="nseq">
          <div v-if="!state.nightPhaseStarted" class="nstep">
            <div class="si">😴</div>
            <h3>{{ t('game.sleep') }}</h3><p>{{ t('game.sleepSub') }}</p>
            <div class="brow"><button class="bpri" @click="startNight">{{ t('game.startNight') }}</button></div>
          </div>
          <div v-else-if="!nightIsDone" class="nstep">
            <div class="si">{{ nightRoleDef?.icon }}</div>
            <h3>{{ nightRole?roleName(nightRole):'' }}</h3>
            <!-- Hexe: zeige Wolfopfer -->
            <div v-if="nightRole==='hexe' && state.nightWolfTarget!==null && !state.nightActions['werwolf'] || nightRole==='hexe' && state.nightWolfTarget!==null"
              class="witch-info">
              <span class="witch-victim-label">🐺 Wolfopfer:</span>
              <strong>{{ state.players[state.nightWolfTarget]?.name }}</strong>
              <span v-if="!state.healUsed" style="color:var(--green);font-size:.75rem;margin-left:.4rem">(Heiltrank verfügbar)</span>
              <span v-else style="color:var(--txt3);font-size:.75rem;margin-left:.4rem">(Heiltrank verbraucht)</span>
            </div>
            <p>{{ nightRole?roleAbility(nightRole):'' }}</p>
            <div v-if="nightTargetList.length" class="aarea">
              <h3>{{ t('game.target') }}</h3>
              <div class="abtns">
                <button v-for="(p,i) in nightTargetList" :key="i" class="abtn"
                  :class="{sel:Array.isArray(state.nightSelection)?state.nightSelection.includes(state.players.indexOf(p)):state.nightSelection===state.players.indexOf(p)}"
                  @click="selectNightTarget(state.players.indexOf(p))">
                  {{ ROLES[p.roleId]?.icon }} {{ p.name }}
                </button>
              </div>
              <div v-if="state.showNightHint" class="req-hint">⚠ {{ t('game.needTarget') }}</div>
            </div>
            <div class="brow">
              <button class="bpri" @click="confirmNight">{{ t('game.confirm') }}</button>
              <button class="bsec" @click="skipNight">{{ t('game.skip') }}</button>
            </div>
          </div>
          <div v-else class="nstep">
            <div class="si">🌅</div>
            <h3>{{ t('game.dawn') }}</h3><p>{{ state.dawnMsg }}</p>
            <div class="brow"><button class="bpri" @click="startDay">{{ t('game.startDay') }}</button></div>
          </div>
        </div>

        <!-- Tag -->
        <div v-if="state.phase==='day'" class="daybox">
          <div class="dt">☀️ {{ t('game.dayTitle') }}</div>
          <p>{{ t('game.daySub') }}</p>
          <div class="aarea">
            <h3>{{ t('game.execute') }}</h3>
            <div class="abtns">
              <button v-for="(p,i) in alivePlayers" :key="i" class="abtn"
                :class="{sel:state.daySelection===state.players.indexOf(p)}"
                @click="selectDay(state.players.indexOf(p))">
                {{ ROLES[p.roleId]?.icon }} {{ p.name }}
              </button>
            </div>
            <div v-if="state.showDayHint" class="req-hint">⚠ {{ t('game.needPlayer') }}</div>
          </div>
          <div class="brow">
            <button class="bpri" @click="confirmDay">{{ t('game.executeBtn') }}</button>
            <button v-if="state.coop.isHost" class="bsec" @click="startCoopVote" title="Alle stimmen auf eigenem Handy ab">🗳 Coop-Abstimmung</button>
            <button class="bsec" @click="skipDay">{{ t('game.skipExec') }}</button>
          </div>
        </div>

        <div class="sec">
          <h2 style="cursor:pointer;user-select:none" @click="state.logVisible=!state.logVisible">
            {{ t('game.log') }}
            <span style="font-size:.8rem;margin-left:.4rem;color:var(--txt3)">{{ state.logVisible ? '▲ ausblenden' : '▼ anzeigen' }}</span>
          </h2>
          <div v-show="state.logVisible" class="glog">
            <div v-for="entry in state.gameLog" :key="entry.id" class="le" :class="entry.type">
              {{ entry.type==='phase'?entry.txt:'▸ '+entry.txt }}
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ═══ RESULT ═══ -->
    <div v-if="state.screen==='result'" class="screen">
      <div class="top-bar"><button class="icon-btn" @click="state.showSettingsModal=true">⚙️</button></div>
      <div class="go-inner">
        <div class="wicon">{{ state.winner==='wolf'?'🐺':state.winner==='dorf'?'🏡':state.winner==='lovers'?'💘':'🔪' }}</div>
        <div class="wtitle">{{ t('result.'+(state.winner==='dorf'?'village':state.winner)) }}</div>
        <div class="wsub">{{ t('result.'+(state.winner==='dorf'?'village':state.winner)+'Sub') }}</div>
        <div class="surv-box">
          <h3>{{ t('result.survivors') }}</h3>
          <div v-for="p in alivePlayers" :key="p.name" class="surv-item">
            {{ ROLES[p.roleId]?.icon }} <strong>{{ p.name }}</strong>
            <span style="margin-left:auto;font-size:.72rem;color:var(--txt2)">{{ roleName(p.roleId) }}</span>
          </div>
        </div>
        <div class="brow">
          <button class="bpri" @click="newGame">{{ t('result.newGame') }}</button>
          <button class="bsec" @click="exportGameLog">📤 {{ t('exportLog.btn') }}</button>
        </div>
      </div>
    </div>
  </div>
  `,
};

// Standalone (eigene Seite /werwolf/) mountet sich selbst auf #app.
// Eingebettet in Gruppen-Spiele setzt das Embed-Glue window.__WW_EMBEDDED__,
// und das Mounten übernimmt mountWerwolf() in ein Shadow-DOM-Element.
if (!window.__WW_EMBEDDED__) {
  createApp(App).mount('#app');
  init();
}

// Einstieg für die eingebettete Nutzung in Gruppen-Spiele.
export function mountWerwolf(el) {
  createApp(App).mount(el);
  init();
}

// ── SERVICE WORKER — exakt nach Tom's Pattern ────────────────────────────────
// Kein auto-skipWaiting. Nutzer entscheidet per Banner wann er aktualisiert.
let waitingWorker = null;
let reloadingAfterUpdate = false;

// HINWEIS: In der Gruppen-Spiele-Integration ist Werwolf ein Unter-App unter
// /werwolf/. Den eigenen Service Worker hier NICHT registrieren — der
// Root-Service-Worker von Gruppen-Spiele (Scope '/') betreut auch /werwolf/.
// Zwei SWs auf derselben Origin würden sich beim 'activate' gegenseitig die
// Caches löschen (beide löschen alle fremden Caches). Deshalb deaktiviert.
const WW_REGISTER_OWN_SW = false;
if (WW_REGISTER_OWN_SW && 'serviceWorker' in navigator && !(window.Capacitor?.isNativePlatform?.())) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').then(reg => {
      window._swReg = reg; // für manuellen Update-Check
      log('sw', 'Service Worker registriert');

      // Wenn neuer SW übernimmt → Seite neu laden
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (reloadingAfterUpdate) return;
        reloadingAfterUpdate = true;
        log('sw', 'Neuer SW aktiv — lade neu');
        window.location.reload();
      });

      const promote = (w) => {
        if (!w) return;
        // Nur als Update werten wenn bereits ein SW aktiv ist (nicht Erst-Installation)
        if (w.state === 'installed' && navigator.serviceWorker.controller) {
          waitingWorker = w;
          state.updateReady = true;
          log('sw', 'Update verfügbar — zeige Banner');
        }
      };
      promote(reg.waiting);
      reg.addEventListener('updatefound', () => {
        const nw = reg.installing; if (!nw) return;
        nw.addEventListener('statechange', () => promote(nw));
      });
      // Alle 60 Sek auf Updates prüfen
      setInterval(() => reg.update(), 60000);

    }).catch(e => log('sw', 'SW-Registrierung fehlgeschlagen', e));
  });
}
