// app.js — Werwolf (Vue 3, esm-browser). Exakt nach coop-number-sums Architektur.
import { createApp, reactive, computed, watch, nextTick } from './vue.esm-browser.prod.js';
import { BUILD, CHANGELOG } from './buildinfo.js';
import { ROLES, NIGHT_ORDER, DONATE_URL, COOP_MAX_PLAYERS } from './config.js';
import * as Coop from './coop.js';
import { log, exportLogToFile } from './debuglog.js';
import { loadSettings, saveSettings, loadSeenVersion, saveSeenVersion } from './storage.js';
import { t, setLocale, detectLocale, i18nState, SUPPORTED_LOCALES } from './i18n/index.js';

const APP_START = Date.now();
const splashVersion = document.getElementById('splash-version');
if (splashVersion) splashVersion.textContent = `v${BUILD}`;

// ─── GLOBALER ZUSTAND ─────────────────────────────────────────────────────────
const state = reactive({
  screen: 'home',         // home | setup | reveal | game | result | settings
  settings: loadSettings(),
  showWhatsNew: false,
  showHistory:  false,
  updateReady:  false,    // neue Version im SW wartend

  // Spielmodus
  gameMode: 'local',      // 'local' | 'coop'

  // Setup
  playerCount: 8,
  playerNames: Array(8).fill(''),
  selectedRoles: {},      // roleId -> count
  setupTab: 'std',        // 'std' | 'extra'

  // Coop
  coop: {
    phase: 'idle',        // idle | hosting | joining | lobby | joined | myRole
    code: '',
    codeDraft: '',
    myName: '',
    myUid: null,
    isHost: false,
    players: [],          // [{uid, name, ready}]
    error: null,
    myRoleId: null,
  },

  // Rollenverteilung
  revealIdx: 0,
  revealFlipped: false,
  players: [],            // [{name, roleId, alive}]

  // Spielphase
  round: 1,
  phase: 'night',         // night | day
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

  // Flags
  healUsed: false,
  poisonUsed: false,
  lovUsed: false,
  lovers: [],
  amHit: false,
  ddRevealed: false,
  lastHeal: null,
});

// ─── HILFSFUNKTIONEN ──────────────────────────────────────────────────────────
function roleName(id) {
  return t(`role.${id}.name`);
}
function roleDesc(id) {
  return t(`role.${id}.desc`);
}
function roleAbility(id) {
  return t(`role.${id}.ability`);
}
function roleGoal(id) {
  return t(`role.${id}.goal`);
}
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
  // Simple toast via DOM
  let el = document.getElementById('ww-toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'ww-toast';
    el.className = 'toast';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(el._timer);
  el._timer = setTimeout(() => el.classList.remove('show'), 2600);
}

// ─── EINSTELLUNGEN ────────────────────────────────────────────────────────────
function applyTheme() {
  document.body.classList.toggle('light', state.settings.theme === 'light');
}
function toggleTheme() {
  state.settings.theme = state.settings.theme === 'dark' ? 'light' : 'dark';
  saveSettings(state.settings);
  applyTheme();
}
function applyLocale() {
  setLocale(state.settings.lang);
}
function setLang(id) {
  state.settings.lang = id;
  saveSettings(state.settings);
  applyLocale();
}

// ─── VERSION / CHANGELOG ──────────────────────────────────────────────────────
function maybeShowWhatsNew() {
  const seen = loadSeenVersion();
  if (seen !== BUILD && CHANGELOG.length) state.showWhatsNew = true;
}
function dismissWhatsNew() {
  state.showWhatsNew = false;
  saveSeenVersion(BUILD);
}

// ─── APP-UPDATE (Service Worker) ──────────────────────────────────────────────
let waitingWorker = null;
let reloadingForUpdate = false;
function applyUpdate() {
  if (!waitingWorker) { location.reload(); return; }
  log('sw', 'Update wird angewendet');
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloadingForUpdate) return;
    reloadingForUpdate = true;
    log('sw', 'Neuer Worker aktiv – lade neu');
    location.reload();
  });
  waitingWorker.postMessage({ type: 'skipWaiting' });
}

// ─── SETUP ────────────────────────────────────────────────────────────────────
function changePlayerCount(d) {
  const n = Math.max(4, Math.min(20, state.playerCount + d));
  state.playerCount = n;
  while (state.playerNames.length < n) state.playerNames.push('');
  state.playerNames = state.playerNames.slice(0, n);
}

const roleCountTotal = computed(() => {
  return Object.values(state.selectedRoles).reduce((s, c) => s + c, 0);
});
const roleSummary = computed(() => {
  let w = 0, d = 0, s = 0;
  for (const [id, c] of Object.entries(state.selectedRoles)) {
    if (!c) continue;
    const r = ROLES[id];
    if (r.team === 'wolf') w += c;
    else if (r.team === 'dorf') d += c;
    else s += c;
  }
  return { w, d, s };
});
const canStart = computed(() => {
  const tot = roleCountTotal.value;
  return tot === state.playerCount && roleSummary.value.w > 0;
});

function toggleRole(id) {
  const r = ROLES[id];
  if (r.max === 1) {
    state.selectedRoles[id] = state.selectedRoles[id] ? 0 : 1;
  } else if (!state.selectedRoles[id]) {
    state.selectedRoles[id] = 1;
  }
}
function changeRole(id, d) {
  const r = ROLES[id];
  const cur = state.selectedRoles[id] || 0;
  state.selectedRoles[id] = Math.max(0, Math.min(r.max, cur + d));
}

// ─── SPIELSTART (LOKAL) ───────────────────────────────────────────────────────
function startLocalGame() {
  let pool = [];
  for (const [id, c] of Object.entries(state.selectedRoles)) {
    for (let i = 0; i < c; i++) pool.push(id);
  }
  shuffle(pool);
  state.players = pool.map((roleId, i) => ({ name: gpn(i), roleId, alive: true }));
  resetGameState();
  state.revealIdx = 0;
  state.revealFlipped = false;
  state.screen = 'reveal';
}

function resetGameState() {
  state.round = 1; state.phase = 'night';
  state.nightQueue = []; state.nightQueueIdx = 0;
  state.nightActions = {}; state.nightSelection = null;
  state.nightMultiSel = []; state.showNightHint = false;
  state.daySelection = null; state.showDayHint = false;
  state.gameLog = []; state.logNow = '';
  state.healUsed = false; state.poisonUsed = false;
  state.lovUsed = false; state.lovers = [];
  state.amHit = false; state.ddRevealed = false; state.lastHeal = null;
}

// ─── ROLLENVERTEILUNG ─────────────────────────────────────────────────────────
function revealRole() { state.revealFlipped = true; }
function nextReveal() {
  if (state.revealIdx + 1 >= state.players.length) {
    state.screen = 'game';
    initGame();
  } else {
    state.revealIdx++;
    state.revealFlipped = false;
  }
}

// ─── SPIELLOGIK ───────────────────────────────────────────────────────────────
function initGame() {
  addLog(t('log.begin'), 'ev');
  buildNightQueue();
  showNight();
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
  state.nightQueueIdx = 0;
  state.nightActions = {};
  state.nightSelection = null;
  state.nightMultiSel = [];
}

function showNight() {
  state.phase = 'night';
  setNow(`${t('game.night')} ${state.round}`);
  addLog(`── ${t('game.night')} ${state.round} ──`, 'phase');
}

function startNight() { processNightRole(); }

function processNightRole() {
  if (state.nightQueueIdx >= state.nightQueue.length) {
    buildDawnMsg();
    return;
  }
  const id = state.nightQueue[state.nightQueueIdx];
  state.nightSelection = null;
  state.nightMultiSel = [];
  state.showNightHint = false;
  setNow(`${ROLES[id].icon} ${roleName(id)}`);
}

function currentNightRole() {
  return state.nightQueue[state.nightQueueIdx] || null;
}

function nightTargets() {
  const id = currentNightRole();
  if (!id) return [];
  const alive = state.players.filter(p => p.alive);
  const r = ROLES[id];
  switch (r.nightAction) {
    case 'kill': return alive.filter(p => ROLES[p.roleId].team !== 'wolf');
    case 'killWolf': return alive.filter(p => ROLES[p.roleId].team === 'wolf' && p.roleId !== 'weisserWolf');
    case 'killSolo': return alive;
    case 'see': return alive;
    case 'detect': return alive;
    case 'heal': return alive.filter((_, i) => i !== state.lastHeal);
    case 'witch': return alive;
    case 'love': return alive;
    case 'sisters': return alive.filter(p => p.roleId === 'zweiSchwestern');
    case 'brothers': return alive.filter(p => p.roleId === 'dreiBrueder');
    default: return [];
  }
}

function selectNightTarget(pi) {
  const id = currentNightRole();
  const r = ROLES[id];
  if (r.nightAction === 'love' || r.nightAction === 'detect') {
    const idx = state.nightMultiSel.indexOf(pi);
    if (idx >= 0) state.nightMultiSel.splice(idx, 1);
    else if (state.nightMultiSel.length < 2) state.nightMultiSel.push(pi);
    state.nightSelection = state.nightMultiSel.length === 2 ? [...state.nightMultiSel] : null;
  } else {
    state.nightSelection = pi;
  }
  state.showNightHint = false;
}

function confirmNight() {
  const id = currentNightRole();
  const r = ROLES[id];
  if (r.mustSelect && state.nightSelection === null) {
    state.showNightHint = true;
    showToast(t('game.needTarget'));
    return;
  }
  if (state.nightSelection !== null) {
    state.nightActions[id] = state.nightSelection;
    if (id === 'amor') { state.lovUsed = true; state.lovers = [...state.nightMultiSel]; }
    if (id === 'heiler') state.lastHeal = state.nightSelection;
    if (id === 'seherin') {
      const p = state.players[state.nightSelection];
      addLog(`🔮 ${t('log.seer')} ${p.name} = ${roleName(p.roleId)} (${teamLabel(ROLES[p.roleId].team)})`, 'ev');
    }
    if (id === 'detektiv' && Array.isArray(state.nightSelection)) {
      const p1 = state.players[state.nightSelection[0]];
      const p2 = state.players[state.nightSelection[1]];
      const same = ROLES[p1.roleId].team === ROLES[p2.roleId].team;
      addLog(`🔍 ${t('log.det')} ${p1.name} & ${p2.name} → ${same ? t('log.sameTeam') : t('log.diffTeam')}`, 'ev');
    }
    addLog(`${ROLES[id].icon} ${roleName(id)} ${t('log.acted')}`, 'ev');
  }
  state.nightMultiSel = [];
  state.nightQueueIdx++;
  processNightRole();
}

function skipNight() {
  const id = currentNightRole();
  addLog(`${ROLES[id].icon} ${roleName(id)} ${t('log.skipped')}`, 'ev');
  state.nightMultiSel = [];
  state.nightQueueIdx++;
  processNightRole();
}

function buildDawnMsg() {
  const wk = state.nightActions['werwolf'] ?? state.nightActions['alphawerwolf'];
  if (wk !== undefined) {
    const p = state.players[wk];
    state.dawnMsg = state.nightActions['heiler'] === wk
      ? t('log.savedHeal')
      : `${p.name} ${t('log.attacked')}`;
  } else {
    state.dawnMsg = t('log.quiet');
  }
}

function startDay() {
  resolveNight();
  if (checkWin()) return;
  state.phase = 'day';
  setNow(`${t('game.day')} ${state.round}`);
  addLog(`── ${t('game.day')} ${state.round} ──`, 'phase');
  state.daySelection = null;
  state.showDayHint = false;
}

function resolveNight() {
  const saves = new Set();
  const kills = new Set();
  const h = state.nightActions['heiler'];
  if (h !== undefined) saves.add(h);
  const wk = state.nightActions['werwolf'] ?? state.nightActions['alphawerwolf'];
  if (wk !== undefined) {
    if (!saves.has(wk)) {
      const p = state.players[wk];
      if (p.roleId === 'alterMann' && !state.amHit) {
        state.amHit = true;
        addLog(`👴 ${p.name} ${t('log.amSurv')}`, 'dorf');
      } else kills.add(wk);
    } else { addLog(`💉 ${t('log.saved')}`, 'dorf'); }
  }
  ['serienkiller', 'weisserWolf'].forEach(id => {
    if (state.nightActions[id] !== undefined) kills.add(state.nightActions[id]);
  });
  kills.forEach(i => { if (state.players[i]?.alive) killPlayer(i, 'wolf'); });
}

function killPlayer(idx, cause) {
  const p = state.players[idx];
  if (!p) return;
  p.alive = false;
  const why = cause === 'wolf' ? t('log.killed') : t('log.executed');
  addLog(`💀 ${p.name} (${roleName(p.roleId)}) ${why}.`, cause === 'wolf' ? 'wolf' : 'ev');
  if (p.roleId === 'jaeger') addLog(`🏹 ${t('log.jaeger')}`, 'ev');
  if (p.roleId === 'ritter' && cause === 'wolf') addLog(`⚔️ ${t('log.ritter')}`, 'ev');
  if (p.roleId === 'alterMann' && cause !== 'wolf') addLog(`👴 ${t('log.amKill')}`, 'wolf');
  if (state.lovers.length === 2 && state.lovers.includes(idx)) {
    const partner = state.lovers.find(l => l !== idx);
    if (partner !== undefined && state.players[partner]?.alive) {
      state.players[partner].alive = false;
      addLog(`💔 ${state.players[partner].name} ${t('log.lovDie')} ${p.name}.`, 'ev');
    }
  }
}

function selectDay(i) {
  state.daySelection = i;
  state.showDayHint = false;
}

function confirmDay() {
  if (state.daySelection === null) {
    state.showDayHint = true;
    showToast(t('game.needPlayer'));
    return;
  }
  const p = state.players[state.daySelection];
  if (p.roleId === 'dorfdepp' && !state.ddRevealed) {
    state.ddRevealed = true;
    addLog(`🤡 ${p.name} ${t('log.ddMsg')}`, 'ev');
    endDay();
    return;
  }
  killPlayer(state.daySelection, 'day');
  if (checkWin()) return;
  endDay();
}

function skipDay() {
  addLog(`☀️ ${t('log.noExec')}`, 'dorf');
  endDay();
}

function endDay() {
  state.round++;
  buildNightQueue();
  showNight();
}

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
  state.screen = 'result';
  addLog(`🏆 ${t(`result.${winner === 'dorf' ? 'village' : winner}`)}`, 'ev');
  state.winner = winner;
}

function newGame() {
  state.screen = 'home';
}

// ─── COOP ─────────────────────────────────────────────────────────────────────
function selectMode(mode) {
  state.gameMode = mode;
}

function genCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

async function showHostSetup() {
  state.coop.phase = 'hosting';
  state.coop.codeDraft = genCode();
  state.coop.players = [];
  state.coop.error = null;
  state.coop.isHost = true;
}

async function createRoom() {
  const code = state.coop.codeDraft.replace(/\D/g, '').slice(0, 6);
  if (code.length !== 6) { state.coop.error = t('coop.codeHint'); return; }
  state.coop.code = code;
  state.coop.error = null;
  state.coop.phase = 'lobby';
  state.coop.players = [{ uid: 'host', name: 'Host', ready: true, isHost: true }];

  await Coop.hostGame({
    code,
    name: 'Host',
    onOpen: (uid) => { state.coop.myUid = uid; },
    onError: (e) => {
      state.coop.error = e.type === 'code-taken' ? t('coop.codeTaken') : t('coop.errorGeneric');
      state.coop.phase = 'hosting';
    },
    onJoin: (uid, data) => {
      if (!state.coop.players.find(p => p.uid === uid)) {
        state.coop.players.push({ uid, name: data?.name || uid, ready: false, isHost: false });
      }
    },
    onLeave: (uid) => {
      state.coop.players = state.coop.players.filter(p => p.uid !== uid);
    },
    onMessage: (msg) => {
      if (msg.type === Coop.MSG.READY) {
        const p = state.coop.players.find(x => x.uid === msg.author);
        if (p) p.ready = msg.ready;
      }
    },
  });
}

async function startCoopGame() {
  const allPlayers = state.coop.players;
  let pool = [];
  for (const [id, c] of Object.entries(state.selectedRoles)) {
    for (let i = 0; i < c; i++) pool.push(id);
  }
  shuffle(pool);
  while (pool.length < allPlayers.length) pool.push('dorfbewohner');
  const assignments = allPlayers.map((p, i) => ({ uid: p.uid, name: p.name, roleId: pool[i] }));
  await Coop.send({ type: Coop.MSG.START, assignments });
  state.players = assignments.map(a => ({ name: a.name, roleId: a.roleId, alive: true }));
  resetGameState();
  state.revealIdx = 0;
  state.revealFlipped = false;
  state.screen = 'reveal';
}

function showJoinSetup() {
  state.coop.phase = 'joining';
  state.coop.codeDraft = '';
  state.coop.myName = '';
  state.coop.error = null;
  state.coop.isHost = false;
}

async function joinRoom() {
  const name = state.coop.myName.trim();
  const code = state.coop.codeDraft.replace(/\D/g, '').slice(0, 6);
  if (!name) { state.coop.error = t('coop.yourName'); return; }
  if (code.length !== 6) { state.coop.error = t('coop.codeHint'); return; }
  state.coop.error = null;
  state.coop.code = code;

  await Coop.joinGame({
    code, name,
    onOpen: (uid) => {
      state.coop.myUid = uid;
      state.coop.phase = 'joined';
    },
    onError: (e) => {
      if (e.type === 'code-not-found') state.coop.error = t('coop.codeWrong');
      else if (e.type === 'room-full') state.coop.error = t('coop.roomFull');
      else if (e.type === 'timeout') state.coop.error = t('coop.errorTimeout');
      else state.coop.error = t('coop.errorGeneric');
    },
    onMessage: (msg) => {
      if (msg.type === Coop.MSG.START) {
        const mine = msg.assignments?.find(a => a.uid === state.coop.myUid);
        if (mine) {
          state.coop.myRoleId = mine.roleId;
          state.coop.myName = mine.name;
          state.coop.phase = 'myRole';
        }
      }
    },
    onClose: () => { state.coop.phase = 'idle'; },
  });
}

async function toggleReady() {
  const isReady = !state.coop.players?.find(p => p.uid === state.coop.myUid)?.ready;
  await Coop.send({ type: Coop.MSG.READY, ready: isReady });
}

async function cancelCoop() {
  await Coop.leave();
  state.coop.phase = 'idle';
  state.coop.players = [];
  state.coop.error = null;
  state.coop.myUid = null;
  state.coop.myRoleId = null;
}

// ─── INIT ─────────────────────────────────────────────────────────────────────
function init() {
  applyTheme();
  applyLocale();
  maybeShowWhatsNew();

  // Splash ausblenden
  setTimeout(() => {
    const splash = document.getElementById('splash');
    if (splash) splash.classList.add('fade-out');
  }, Math.max(0, 600 - (Date.now() - APP_START)));
}

// ════════════════════════════════════════════════════════════════════════════
//  TEMPLATE
// ════════════════════════════════════════════════════════════════════════════
const App = {
  setup() {
    const stdRoles = computed(() => Object.values(ROLES).filter(r => r.std));
    const extraRoles = computed(() => Object.values(ROLES).filter(r => !r.std));
    const alivePlayers = computed(() => state.players.filter(p => p.alive));
    const nightRole = computed(() => state.nightQueue[state.nightQueueIdx] || null);
    const nightRoleDef = computed(() => nightRole.value ? ROLES[nightRole.value] : null);
    const nightTargetList = computed(() => nightTargets());
    const nightIsDone = computed(() => state.nightQueueIdx >= state.nightQueue.length);

    return {
      state, BUILD, CHANGELOG, DONATE_URL, SUPPORTED_LOCALES, ROLES,
      stdRoles, extraRoles, alivePlayers, nightRole, nightRoleDef, nightTargetList, nightIsDone,
      roleCountTotal, roleSummary, canStart,
      // fns
      t, i18nState, roleName, roleDesc, roleAbility, roleGoal, teamLabel,
      toggleTheme, setLang,
      changePlayerCount,
      toggleRole, changeRole,
      selectMode,
      startLocalGame,
      revealRole, nextReveal: nextReveal,
      startNight, confirmNight, skipNight, selectNightTarget, startDay,
      confirmDay, skipDay, selectDay, newGame,
      showHostSetup, createRoom, startCoopGame,
      showJoinSetup, joinRoom, toggleReady, cancelCoop,
      maybeShowWhatsNew, dismissWhatsNew,
      applyUpdate, exportLogToFile,
    };
  },

  template: `
  <div class="app" :class="{ rtl: i18nState.rtl }">

    <!-- ── UPDATE MODAL ── -->
    <div v-if="state.updateReady" class="modal-bg" @click.self="state.updateReady=false">
      <div class="modal">
        <div class="whatsnew-badge">⬆ {{ t('update.badge') }}</div>
        <h3>{{ t('update.title') }}</h3>
        <p class="confirm-msg">{{ t('update.body') }}</p>
        <button class="btn btn-primary" @click="applyUpdate">{{ t('update.apply') }}</button>
        <button class="btn btn-ghost btn-sm" @click="state.updateReady=false">{{ t('update.later') }}</button>
      </div>
    </div>

    <!-- ── WHATS NEW MODAL ── -->
    <div v-if="state.showWhatsNew || state.showHistory" class="modal-bg" @click.self="dismissWhatsNew();state.showHistory=false">
      <div class="modal modal-wide">
        <div class="whatsnew-badge">{{ state.showHistory ? '📋' : '✨' }} {{ state.showHistory ? t('settings.history') : t('whatsNew.badge') }}</div>
        <template v-if="CHANGELOG.length">
          <h3>v{{ CHANGELOG[0].version }}</h3>
          <ul class="whatsnew-list">
            <li v-for="c in CHANGELOG[0].changes" :key="c">{{ c }}</li>
          </ul>
          <template v-if="CHANGELOG.length > 1">
            <div class="whatsnew-hist-title">{{ t('whatsNew.histTitle') }}</div>
            <div v-for="entry in CHANGELOG.slice(1)" :key="entry.version" class="whatsnew-old">
              <div class="whatsnew-old-ver">v{{ entry.version }} · {{ entry.date }}</div>
              <ul><li v-for="c in entry.changes" :key="c">{{ c }}</li></ul>
            </div>
          </template>
        </template>
        <button class="btn btn-primary" @click="dismissWhatsNew();state.showHistory=false">{{ t('whatsNew.close') }}</button>
      </div>
    </div>

    <!-- ── EINSTELLUNGEN SHEET ── -->
    <div v-if="state.screen==='settings'" class="modal-bg" @click.self="state.screen='home'">
      <div class="sheet">
        <div class="sheet-handle"></div>
        <div class="sheet-head">
          <span class="sheet-title">{{ t('settings.title') }}</span>
          <button class="icon-btn" @click="state.screen='home'">✕</button>
        </div>
        <div class="sheet-body">
          <div class="srow">
            <div><div class="slabel">{{ t('settings.theme') }}</div><div class="ssub">{{ t('settings.themeSub') }}</div></div>
            <label class="toggle"><input type="checkbox" :checked="state.settings.theme==='light'" @change="toggleTheme"/><span class="tslider"></span></label>
          </div>
          <div class="srow">
            <div><div class="slabel">{{ t('settings.lang') }}</div><div class="ssub">{{ t('settings.langSub') }}</div></div>
            <select class="lsel" :value="state.settings.lang" @change="setLang($event.target.value)">
              <option v-for="l in SUPPORTED_LOCALES" :key="l.id" :value="l.id">{{ l.label }}</option>
            </select>
          </div>
          <div class="srow">
            <div><div class="slabel">{{ t('settings.version') }}</div><div class="ssub">{{ t('settings.versionSub') }}</div></div>
            <span class="verbadge">v{{ BUILD }}</span>
          </div>
          <div class="srow" style="border:none">
            <div><div class="slabel">{{ t('settings.history') }}</div><div class="ssub">{{ t('settings.historySub') }}</div></div>
            <button class="ver-hist-btn" @click="state.showHistory=true;state.screen='home'">{{ t('settings.historyBtn') }}</button>
          </div>
        </div>
      </div>
    </div>

    <!-- ═══════════════════════════════════════════════
         HOME SCREEN
    ════════════════════════════════════════════════ -->
    <div v-if="state.screen==='home'" class="screen">
      <div class="top-bar">
        <a class="icon-btn home-donate-btn" :href="DONATE_URL" target="_blank" rel="noopener" :title="t('home.donate')">☕<span class="home-donate-heart" aria-hidden="true">❤</span></a>
        <button class="icon-btn" @click="state.screen='settings'">⚙️</button>
      </div>
      <div style="max-width:680px;margin:0 auto;padding:0 1.4rem 4rem;">
        <div class="logo">
          <span class="logo-moon">🌕</span>
          <h1>{{ t('app.title') }}</h1>
          <p>{{ t('app.sub') }}</p>
        </div>

        <!-- Spielmodus -->
        <div class="sec"><h2>{{ t('mode.title') }}</h2>
          <div class="mode-grid">
            <div class="mode-card" :class="{active:state.gameMode==='local'}" @click="selectMode('local')">
              <span class="mode-icon">📱</span>
              <div class="mode-name">{{ t('mode.local') }}</div>
              <div class="mode-desc">{{ t('mode.localSub') }}</div>
            </div>
            <div class="mode-card" :class="{active:state.gameMode==='coop'}" @click="selectMode('coop')">
              <span class="mode-icon">🌐</span>
              <div class="mode-name">{{ t('mode.coop') }}</div>
              <div class="mode-desc">{{ t('mode.coopSub') }}</div>
            </div>
          </div>
        </div>

        <!-- Lokaler Modus -->
        <template v-if="state.gameMode==='local'">
          <div class="sec"><h2>{{ t('setup.players') }}</h2>
            <div class="pc-row">
              <button class="cnt-btn" @click="changePlayerCount(-1)">−</button>
              <span class="pc-num">{{ state.playerCount }}</span>
              <span class="cnt-lbl">{{ t('setup.playerUnit') }}</span>
              <button class="cnt-btn" @click="changePlayerCount(1)">+</button>
            </div>
          </div>
          <div class="sec"><h2>{{ t('setup.names') }}</h2>
            <div class="names-grid">
              <div v-for="(n,i) in state.playerNames" :key="i" class="nwrap">
                <span>👤</span>
                <input class="ninput" type="text" maxlength="20" :placeholder="t('setup.playerUnit')+' '+(i+1)" v-model="state.playerNames[i]"/>
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
                class="rcard" :class="['t'+r.team[0], (state.selectedRoles[r.id]||0)>0?'sel':'']"
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
              <div class="sitem" style="margin-left:auto;color:var(--gold);font-family:Cinzel,serif;font-size:.72rem;">{{ roleCountTotal }} / {{ state.playerCount }}</div>
              <div v-if="!canStart" class="swarn">{{ roleSummary.w===0?t('setup.warnNeedWolf'):t('setup.warnCount') }}</div>
            </div>
          </div>
          <button class="btn-start" :disabled="!canStart" @click="startLocalGame">🐺 {{ t('setup.startBtn') }}</button>
        </template>

        <!-- Coop Modus -->
        <template v-else>
          <template v-if="state.coop.phase==='idle'">
            <div class="sec"><h2>{{ t('mode.coop') }}</h2>
              <div style="display:flex;gap:.7rem;">
                <button class="btn-blue" style="flex:1" @click="showHostSetup">👑 {{ t('coop.host') }}</button>
                <button class="btn-sec" style="flex:1" @click="showJoinSetup">🚪 {{ t('coop.join') }}</button>
              </div>
            </div>
          </template>

          <!-- HOST: Raumcode eingeben -->
          <template v-else-if="state.coop.phase==='hosting'">
            <div class="sec"><h2>{{ t('coop.code') }}</h2>
              <div class="coop-box">
                <p class="coop-hint">{{ t('coop.codeSub') }}</p>
                <div style="display:flex;gap:.5rem;margin-bottom:.5rem;">
                  <input class="code-input" v-model="state.coop.codeDraft" type="text" maxlength="6" inputmode="numeric" pattern="[0-9]*" placeholder="123456" @input="state.coop.codeDraft=state.coop.codeDraft.replace(/\\D/g,'').slice(0,6)"/>
                  <button class="btn-blue" style="width:44px;padding:0;font-size:1.2rem;border-radius:10px;margin:0" @click="state.coop.codeDraft=genCode()">🎲</button>
                </div>
                <div v-if="state.coop.error" class="coop-error">{{ state.coop.error }}</div>
                <button class="btn-blue" @click="createRoom">{{ t('coop.host') }}</button>
                <button class="btn-sec" style="margin-top:.5rem" @click="state.coop.phase='idle'">{{ t('coop.cancel') }}</button>
              </div>
            </div>
          </template>

          <!-- HOST: Lobby -->
          <template v-else-if="state.coop.phase==='lobby'">
            <div class="sec"><h2>{{ t('coop.code') }}: {{ state.coop.code }}</h2>
              <div class="coop-box">
                <p class="coop-hint">{{ t('coop.waiting') }}</p>
                <ul class="lobby-list">
                  <li v-for="p in state.coop.players" :key="p.uid" class="lobby-item">
                    <span class="li-icon">{{ p.isHost?'👑':'👤' }}</span>
                    <span class="li-name">{{ p.name }}</span>
                    <span class="li-ready" :class="p.isHost?'host':p.ready?'yes':'no'">
                      {{ p.isHost?t('coop.host'):p.ready?t('coop.ready'):t('coop.notReady') }}
                    </span>
                  </li>
                </ul>
                <!-- Rollenauswahl für Host -->
                <div style="margin-top:1rem;">
                  <div class="tabs">
                    <button class="tbtn" :class="{active:state.setupTab==='std'}" @click="state.setupTab='std'">⚔ {{ t('setup.std') }}</button>
                    <button class="tbtn" :class="{active:state.setupTab==='extra'}" @click="state.setupTab='extra'">✦ {{ t('setup.extra') }}</button>
                  </div>
                  <div class="rgrid" style="max-height:260px;overflow-y:auto;">
                    <div v-for="r in (state.setupTab==='std'?stdRoles:extraRoles)" :key="r.id"
                      class="rcard" :class="['t'+r.team[0],(state.selectedRoles[r.id]||0)>0?'sel':'']"
                      @click="toggleRole(r.id)">
                      <span class="ri">{{ r.icon }}</span>
                      <span class="tbadge" :class="r.team">{{ teamLabel(r.team) }}</span>
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

          <!-- GAST: Beitreten -->
          <template v-else-if="state.coop.phase==='joining'">
            <div class="sec"><h2>{{ t('coop.join') }}</h2>
              <div class="coop-box">
                <input class="name-input-big" v-model="state.coop.myName" type="text" maxlength="20" :placeholder="t('coop.namePlaceholder')"/>
                <input class="code-input" v-model="state.coop.codeDraft" type="text" maxlength="6" inputmode="numeric" pattern="[0-9]*" placeholder="123456" @input="state.coop.codeDraft=state.coop.codeDraft.replace(/\\D/g,'').slice(0,6)"/>
                <div v-if="state.coop.error" class="coop-error">{{ state.coop.error }}</div>
                <button class="btn-blue" @click="joinRoom">{{ t('coop.joinBtn') }}</button>
                <button class="btn-sec" style="margin-top:.5rem" @click="state.coop.phase='idle'">{{ t('coop.cancel') }}</button>
              </div>
            </div>
          </template>

          <!-- GAST: Warteraum -->
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

          <!-- GAST: Eigene Rolle anzeigen -->
          <template v-else-if="state.coop.phase==='myRole'">
            <div class="sec" style="text-align:center;padding-top:1rem">
              <div class="for">{{ t('reveal.for') }}</div>
              <div class="pname">{{ state.coop.myName }}</div>
              <div class="rev-card dc" style="margin:1rem auto;max-width:300px">
                <div class="card-front" style="display:block">
                  <div class="cfi">{{ ROLES[state.coop.myRoleId]?.icon }}</div>
                  <div class="cft">{{ roleName(state.coop.myRoleId) }}</div>
                  <div class="ctbadge" :class="ROLES[state.coop.myRoleId]?.team==='wolf'?'wb':ROLES[state.coop.myRoleId]?.team==='dorf'?'db':'sb'">
                    {{ teamLabel(ROLES[state.coop.myRoleId]?.team) }}
                  </div>
                  <div class="cfa">{{ roleAbility(state.coop.myRoleId) }}</div>
                  <div class="cfg">{{ roleGoal(state.coop.myRoleId) }}</div>
                </div>
              </div>
              <p style="color:var(--txt2);font-size:.84rem">{{ t('reveal.tap') }}</p>
            </div>
          </template>
        </template>
      </div>
    </div>

    <!-- ═══════════════════════════════════════════════
         REVEAL SCREEN
    ════════════════════════════════════════════════ -->
    <div v-if="state.screen==='reveal'" class="screen">
      <div class="top-bar"><button class="icon-btn" @click="state.screen='settings'">⚙️</button></div>
      <div class="reveal-inner">
        <div class="rev-head">
          <div class="for">{{ t('reveal.for') }}</div>
          <div class="pname">{{ state.players[state.revealIdx]?.name }}</div>
        </div>
        <div class="rev-card" :class="[state.revealFlipped?'flipped':'', state.revealFlipped?(ROLES[state.players[state.revealIdx]?.roleId]?.team==='wolf'?'wc':ROLES[state.players[state.revealIdx]?.roleId]?.team==='dorf'?'dc':'sc'):'']">
          <div class="card-back" v-show="!state.revealFlipped">
            <div class="cbi">🌑</div>
            <div class="cbt">{{ t('reveal.tap') }}</div>
          </div>
          <div class="card-front" v-show="state.revealFlipped">
            <div class="cfi">{{ ROLES[state.players[state.revealIdx]?.roleId]?.icon }}</div>
            <div class="cft">{{ roleName(state.players[state.revealIdx]?.roleId) }}</div>
            <div class="ctbadge" :class="ROLES[state.players[state.revealIdx]?.roleId]?.team==='wolf'?'wb':ROLES[state.players[state.revealIdx]?.roleId]?.team==='dorf'?'db':'sb'">
              {{ teamLabel(ROLES[state.players[state.revealIdx]?.roleId]?.team) }}
            </div>
            <div class="cfa">{{ roleAbility(state.players[state.revealIdx]?.roleId) }}</div>
            <div class="cfg">{{ roleGoal(state.players[state.revealIdx]?.roleId) }}</div>
          </div>
        </div>
        <button class="btn-rev" v-if="!state.revealFlipped" @click="revealRole">{{ t('reveal.show') }}</button>
        <button class="btn-nxt" v-else @click="nextReveal">{{ t('reveal.next') }} →</button>
        <div class="rev-prog">{{ state.revealIdx+1 }} / {{ state.players.length }}</div>
      </div>
    </div>

    <!-- ═══════════════════════════════════════════════
         GAME SCREEN
    ════════════════════════════════════════════════ -->
    <div v-if="state.screen==='game'" class="screen">
      <div class="top-bar"><button class="icon-btn" @click="state.screen='settings'">⚙️</button></div>
      <div class="game-inner">
        <div class="game-hdr">
          <div class="phase-badge"><span class="phicon">{{ state.phase==='night'?'🌙':'☀️' }}</span><span>{{ state.phase==='night'?t('game.night'):t('game.day') }} {{ state.round }}</span></div>
          <div class="rinfo">{{ t('game.round') }} {{ state.round }}</div>
        </div>
        <div class="log-now">{{ state.logNow }}</div>

        <!-- Spielerliste -->
        <div class="psec"><h3>{{ t('game.players') }}</h3>
          <div class="plist">
            <div v-for="(p,i) in state.players" :key="i" class="pchip" :class="{dead:!p.alive}">
              <span class="pi">{{ p.alive?ROLES[p.roleId]?.icon:'💀' }}</span>
              <span class="pn">{{ p.name }}</span>
            </div>
          </div>
        </div>

        <!-- Nachtphase -->
        <div v-if="state.phase==='night'" class="nseq">
          <!-- Schlafen -->
          <div v-if="state.nightQueueIdx===0 && state.nightQueue.length===0 || (state.nightQueueIdx===0 && !nightRole)" class="nstep">
            <div class="si">😴</div>
            <h3>{{ t('game.sleep') }}</h3>
            <p>{{ t('game.sleepSub') }}</p>
            <div class="brow"><button class="bpri" @click="startNight">{{ t('game.startNight') }}</button></div>
          </div>
          <div v-else-if="state.nightQueueIdx===0" class="nstep">
            <div class="si">😴</div>
            <h3>{{ t('game.sleep') }}</h3>
            <p>{{ t('game.sleepSub') }}</p>
            <div class="brow"><button class="bpri" @click="startNight">{{ t('game.startNight') }}</button></div>
          </div>
          <!-- Aktive Nachtrolle -->
          <div v-else-if="!nightIsDone" class="nstep">
            <div class="si">{{ nightRoleDef?.icon }}</div>
            <h3>{{ nightRole?roleName(nightRole):'' }}</h3>
            <p>{{ nightRole?roleAbility(nightRole):'' }}</p>
            <div v-if="nightTargetList.length>0" class="aarea">
              <h3>{{ t('game.target') }}</h3>
              <div class="abtns">
                <button v-for="(p,i) in nightTargetList" :key="i" class="abtn"
                  :class="{sel: Array.isArray(state.nightSelection)?state.nightSelection.includes(state.players.indexOf(p)):state.nightSelection===state.players.indexOf(p)}"
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
          <!-- Morgengrauen -->
          <div v-else class="nstep">
            <div class="si">🌅</div>
            <h3>{{ t('game.dawn') }}</h3>
            <p>{{ state.dawnMsg }}</p>
            <div class="brow"><button class="bpri" @click="startDay">{{ t('game.startDay') }}</button></div>
          </div>
        </div>

        <!-- Tagesphase -->
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
            <button class="bsec" @click="skipDay">{{ t('game.skipExec') }}</button>
          </div>
        </div>

        <!-- Log -->
        <div class="sec"><h2>{{ t('game.log') }}</h2>
          <div class="glog">
            <div v-for="entry in state.gameLog" :key="entry.id" class="le" :class="entry.type">
              {{ entry.type==='phase'?entry.txt:'▸ '+entry.txt }}
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ═══════════════════════════════════════════════
         RESULT SCREEN
    ════════════════════════════════════════════════ -->
    <div v-if="state.screen==='result'" class="screen">
      <div class="top-bar"><button class="icon-btn" @click="state.screen='settings'">⚙️</button></div>
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
        </div>
      </div>
    </div>

  </div>
  `,
};

// ── MOUNT ─────────────────────────────────────────────────────────────────────
const app = createApp(App);
app.mount('#app');
init();

// ── SERVICE WORKER ────────────────────────────────────────────────────────────
// Exakt nach coop-number-sums Pattern.
if ('serviceWorker' in navigator && !(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform())) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').then(reg => {
      log('sw', 'Service Worker registriert');
      const promote = (w) => {
        if (!w) return;
        if (w.state === 'installed' && navigator.serviceWorker.controller) {
          waitingWorker = w;
          state.updateReady = true;
          log('sw', 'Update verfuegbar (wartend)');
        }
      };
      promote(reg.waiting);
      reg.addEventListener('updatefound', () => {
        const nw = reg.installing;
        if (!nw) return;
        nw.addEventListener('statechange', () => promote(nw));
      });
    }).catch(e => log('sw', 'Service-Worker-Registrierung fehlgeschlagen', e));
  });
}
