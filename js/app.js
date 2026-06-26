// app.js — Gruppen-Spiele v0.0.5 (Vue 3, esm-browser)
// Portiert vom Werwolf-Projekt — nur Imposter-Spiellogik
import { createApp, reactive, computed } from './vue.esm-browser.prod.js';
import { BUILD, CHANGELOG } from './buildinfo.js';
import { ALL_WORDS, TIMER_SECONDS, DONATE_URL, COOP_MAX_PLAYERS } from './config.js';
import * as Coop from './coop.js';
import { log, exportLogToFile } from './debuglog.js';
import {
  loadSettings, saveSettings, loadSeenVersion, saveSeenVersion,
  loadLastNames, saveLastNames, loadConfigs, saveConfig, deleteConfig,
} from './storage.js';
import { t, setLocale, detectLocale, i18nState, SUPPORTED_LOCALES } from './i18n/index.js';

const APP_START = Date.now();
const splashVersion = document.getElementById('splash-version');
if (splashVersion) splashVersion.textContent = `v${BUILD}`;

// ── Service Worker ────────────────────────────────────────────────────────────
let waitingWorker = null;
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').then(reg => {
    window._swReg = reg;
    if (reg.waiting) { waitingWorker = reg.waiting; state.updateReady = true; }
    reg.addEventListener('updatefound', () => {
      const nw = reg.installing;
      nw.addEventListener('statechange', () => {
        if (nw.state === 'installed' && navigator.serviceWorker.controller) {
          waitingWorker = nw; state.updateReady = true;
        }
      });
    });
  }).catch(e => log('sw', 'Registrierung fehlgeschlagen', e));
  navigator.serviceWorker.addEventListener('controllerchange', () => location.reload());
}

// ── Utils ─────────────────────────────────────────────────────────────────────
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function rndWord() { return ALL_WORDS[Math.floor(Math.random() * ALL_WORDS.length)]; }
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
  settings: loadSettings(),
  showWhatsNew: false,
  showHistory:  false,
  historyDetail: null,
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
    phase: 'idle', // idle | hosting | lobby | joining | joined | myRole
    code: '', codeDraft: '',
    myName: '', myUid: null,
    isHost: false,
    players: [],
    error: null,
    myRoleIsImposter: null,
    myWord: null,
  },

  // Rollenverteilung
  revealIdx: 0,
  revealFlipped: false,
  roles: [],   // [{name, isImposter, word}]

  // Timer
  timerSeconds: TIMER_SECONDS,
  timerInterval: null,

  // Abstimmung
  stimmIdx: 0,
  votes: {},

  // Ergebnis
  winner: null,      // 'village' | 'imposter'
  eliminatedNames: [],
  tally: {},
});

// ── Theme / Locale ────────────────────────────────────────────────────────────
function applyTheme() {
  const theme = state.settings.theme;
  let isLight = theme === 'auto'
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

async function checkForUpdate() {
  if (window._swReg) {
    showToast('Suche nach Updates…');
    try {
      await window._swReg.update();
      await new Promise(r => setTimeout(r, 2000));
    } catch(e) {}
  }
  if (state.updateReady || waitingWorker) {
    state.updateReady = true;
  } else {
    showToast('Keine Updates verfügbar ✓');
  }
}

function applyUpdate() {
  if (!waitingWorker) { location.reload(); return; }
  waitingWorker.postMessage({ type: 'skipWaiting' });
}

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
function openGameMenu()  { state.gameMenu.active = true; }
function closeGameMenu() { state.gameMenu.active = false; }
function pauseGame()     { state.gamePaused = true; state.gameMenu.active = false; }
function resumeGame()    { state.gamePaused = false; }
function confirmEndGame() {
  state.gameEndConfirm = false; state.gamePaused = false; state.gameMenu.active = false;
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
  state.timerSeconds = TIMER_SECONDS;
  clearInterval(state.timerInterval);
  state.screen = 'reveal';
  haptic('success');
}

function revealCard() { state.revealFlipped = true; haptic('medium'); }

function nextReveal() {
  if (state.revealIdx + 1 >= state.roles.length) {
    // Alle haben ihre Karte gesehen → Timer
    state.screen = 'timer';
    state.timerSeconds = TIMER_SECONDS;
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
    if (state.timerSeconds <= 0) {
      clearInterval(state.timerInterval);
      setTimeout(() => { state.screen = 'voting'; state.stimmIdx = 0; }, 600);
    }
  }, 1000);
}

function skipTimer() {
  clearInterval(state.timerInterval);
  state.screen = 'voting';
  state.stimmIdx = 0;
}

function castVote(target) {
  const voter = state.roles[state.stimmIdx].name;
  state.votes[voter] = target;
  haptic('light');
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
  state.screen          = 'result';
  haptic(state.winner === 'village' ? 'success' : 'error');
}

function newGame() { state.screen = 'home'; }

// ── Coop ─────────────────────────────────────────────────────────────────────
function selectMode(mode) { state.gameMode = mode; }
function genCode() { return String(Math.floor(100000 + Math.random() * 900000)); }

async function showHostSetup() {
  state.coop.phase = 'hosting'; state.coop.codeDraft = genCode();
  state.coop.players = []; state.coop.error = null; state.coop.isHost = true;
}

async function createRoom() {
  const code = state.coop.codeDraft.replace(/\D/g, '').slice(0, 6);
  if (code.length !== 6) { state.coop.error = t('coop.codeHint'); return; }
  const myName = state.coop.myName.trim() || 'Host';
  state.coop.code = code; state.coop.error = null; state.coop.phase = 'lobby';
  state.coop.players = [{ uid: 'host', name: myName, ready: true, isHost: true }];
  await Coop.hostGame({
    code, name: myName,
    onOpen: (uid) => { state.coop.myUid = uid; },
    onError: (e) => { state.coop.error = e.type === 'code-taken' ? t('coop.codeTaken') : t('coop.errorGeneric'); state.coop.phase = 'hosting'; },
    onJoin: (uid, data) => {
      if (!state.coop.players.find(p => p.uid === uid))
        state.coop.players.push({ uid, name: data?.name || uid, ready: false, isHost: false });
    },
    onLeave: (uid) => { state.coop.players = state.coop.players.filter(p => p.uid !== uid); },
    onMessage: (msg) => {
      if (msg.type === Coop.MSG.READY) {
        const p = state.coop.players.find(x => x.uid === msg.author);
        if (p) p.ready = msg.ready;
      }
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
  await Coop.send({ type: Coop.MSG.START, assignments });

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
    try { await navigator.share({ title: 'Gruppen-Spiele — Raum beitreten', text: `Tritt meinem Raum bei! Code: ${state.coop.code}`, url }); return; }
    catch(e) { if (e.name === 'AbortError') return; }
  }
  try { await navigator.clipboard.writeText(url); showToast('Link kopiert!'); }
  catch(e) { showToast(url); }
}

async function cancelCoop() {
  await Coop.leave();
  state.coop.phase = 'idle'; state.coop.players = []; state.coop.error = null;
  state.coop.myUid = null; state.coop.myRoleIsImposter = null; state.coop.myWord = null;
}

function handleCoopMessage(msg) {
  if (!msg) return;
  if (msg.type === Coop.MSG.START) {
    const mine = msg.assignments?.find(a => a.uid === state.coop.myUid);
    if (mine) {
      state.coop.myRoleIsImposter = mine.isImposter;
      state.coop.myWord = mine.word;
      state.coop.phase = 'myRole';
    }
  }
}

// ── Init ──────────────────────────────────────────────────────────────────────
function init() {
  applyTheme(); applyLocale(); maybeShowWhatsNew();
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

  setTimeout(() => {
    const splash = document.getElementById('splash');
    if (splash) splash.classList.add('fade-out');
  }, Math.max(0, 600 - (Date.now() - APP_START)));
}

// ── Vue App ───────────────────────────────────────────────────────────────────
const App = {
  setup() {
    const timerPct = computed(() => state.timerSeconds / TIMER_SECONDS * 100);
    const revealPlayer = computed(() => state.roles[state.revealIdx]);
    const currentVoter = computed(() => state.roles[state.stimmIdx]);
    const voteOptions  = computed(() => state.roles.filter(r => r.name !== currentVoter.value?.name));
    const imposters    = computed(() => state.roles.filter(r => r.isImposter).map(r => r.name));

    return {
      state, BUILD, CHANGELOG, DONATE_URL, SUPPORTED_LOCALES, TIMER_SECONDS,
      timerPct, revealPlayer, currentVoter, voteOptions, imposters,
      t, i18nState,
      setTheme, setLang,
      changePlayerCount, selectMode,
      loadLastNamesIntoSetup, dismissNamesHint,
      saveCurrentConfig, loadConfig, removeConfig,
      openGameMenu, closeGameMenu, pauseGame, resumeGame, confirmEndGame,
      startLocalGame, revealCard, nextReveal, skipTimer, castVote, newGame,
      showHostSetup, createRoom, startCoopGame,
      showJoinSetup, joinRoom, toggleReady, cancelCoop,
      getInviteLink, shareInviteLink,
      dismissWhatsNew, applyUpdate, checkForUpdate,
      exportLogToFile,
    };
  },
  template: `
  <div class="app" :class="{ rtl: i18nState.rtl }">

    <!-- ── PAUSE OVERLAY ── -->
    <div v-if="state.gamePaused" class="modal-bg" style="z-index:500">
      <div class="modal" style="text-align:center">
        <div style="font-size:3rem;margin-bottom:.8rem">🕵️</div>
        <h3 style="color:var(--gold);margin-bottom:.5rem">PAUSIERT</h3>
        <p class="confirm-msg">Das Spiel ist pausiert. Tippe Fortsetzen wenn alle bereit sind.</p>
        <button class="btn btn-primary" @click="resumeGame">▶ Fortsetzen</button>
        <button class="btn btn-ghost btn-sm" @click="state.gamePaused=false;state.gameEndConfirm=true">Spiel beenden</button>
      </div>
    </div>

    <!-- ── SPIELMENÜ ── -->
    <div v-if="state.gameMenu.active" class="modal-bg" @click.self="closeGameMenu">
      <div class="modal" style="animation:fadeIn .2s ease">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1.1rem">
          <span style="font-size:.9rem;letter-spacing:.15em;color:var(--gold);font-weight:700">SPIELMENÜ</span>
          <button class="icon-btn" @click="closeGameMenu">✕</button>
        </div>
        <button class="btn btn-primary" style="margin-bottom:.6rem" @click="closeGameMenu">▶ Fortsetzen</button>
        <button class="btn btn-ghost" style="margin-bottom:.6rem" @click="pauseGame">⏸ Pausieren</button>
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

    <!-- ── COOP: MEINE KARTE (Gast) ── -->
    <div v-if="state.coop.phase === 'myRole'" class="modal-bg" style="z-index:400">
      <div class="modal" style="text-align:center">
        <div class="whatsnew-badge">🕵️ Deine Karte</div>
        <div v-if="state.coop.myRoleIsImposter">
          <div style="font-size:3rem;margin:.8rem 0">🕵️</div>
          <div style="font-size:1.2rem;font-weight:900;color:var(--blood2);margin-bottom:.5rem">DU BIST DER IMPOSTER!</div>
          <p class="confirm-msg">Du kennst das Wort nicht. Tu so als ob — lass dich nicht erwischen!</p>
        </div>
        <div v-else>
          <div style="font-size:3rem;margin:.8rem 0">💬</div>
          <div style="font-size:.78rem;letter-spacing:.15em;color:var(--txt2);margin-bottom:.3rem">DEIN WORT</div>
          <div style="font-size:2.2rem;font-weight:900;color:var(--gold);margin:.4rem 0">{{ state.coop.myWord }}</div>
          <p class="confirm-msg">Beschreibe es ohne das Wort zu sagen!</p>
        </div>
        <button class="btn btn-primary" style="margin-top:1rem" @click="state.coop.phase = 'idle'">Verstanden ✓</button>
      </div>
    </div>

    <!-- ── WHATS NEW ── -->
    <div v-if="state.showWhatsNew && !state.showHistory" class="modal-bg">
      <div class="modal">
        <span class="whatsnew-badge">✦ NEU IN VERSION {{ CHANGELOG[0]?.version }}</span>
        <div class="wnv-version">v{{ CHANGELOG[0]?.version }}</div>
        <ul class="wnv-list">
          <li v-for="c in CHANGELOG[0]?.changes" :key="c">{{ c }}</li>
        </ul>
        <button class="btn-start" @click="dismissWhatsNew">Los geht's! 🎮</button>
      </div>
    </div>

    <!-- ── UPDATE BANNER ── -->
    <div v-if="state.updateReady && state.screen === 'home' && !state.showWhatsNew" class="modal-bg">
      <div class="uc-card">
        <span class="uc-badge">✦ UPDATE VERFÜGBAR</span>
        <div class="uc-title">Version {{ CHANGELOG[0]?.version }} ist da!</div>
        <div class="uc-desc">{{ CHANGELOG[0]?.changes?.slice(0,2).join(' · ') }}</div>
        <button class="uc-btn-primary" @click="applyUpdate">⬆ Aktualisieren & neu starten</button>
        <button class="uc-btn-later" @click="state.updateReady = false">Später</button>
      </div>
    </div>

    <!-- ── VERSIONSHISTORIE DETAIL ── -->
    <div v-if="state.showHistory && state.historyDetail" style="padding:1.2rem;max-width:480px;margin:0 auto">
      <div class="cl-detail-back" @click="state.showHistory=false;state.historyDetail=null">← Zurück</div>
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
        <div class="drawer-body">

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
              <button class="ver-hist-btn" @click="state.showHistory=true;state.historyDetail=CHANGELOG[0]">Anzeigen</button>
            </div>
            <div class="srow">
              <div><div class="slabel">Auf Update prüfen</div><div class="ssub">Sucht nach neuer Version</div></div>
              <button class="ver-hist-btn" @click="checkForUpdate" style="white-space:nowrap">🔄 Prüfen</button>
            </div>
            <div v-if="state.updateReady" class="srow">
              <div><div class="slabel">Update verfügbar</div></div>
              <button class="ver-hist-btn" @click="applyUpdate" style="color:var(--gold)">Installieren</button>
            </div>
            <div class="srow">
              <div><div class="slabel">Diagnoseprotokoll</div></div>
              <button class="ver-hist-btn" @click="exportLogToFile">Exportieren</button>
            </div>
          </div>

          <!-- Versionshistorie Liste -->
          <div v-if="state.showHistory && !state.historyDetail" class="drawer-section">
            <div class="drawer-section-title">Versionshistorie</div>
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

        </div>
      </div>
    </template>

    <!-- ══════════════════════════════════════════════════════════════════ -->
    <!-- ── HOME SCREEN ── -->
    <!-- ══════════════════════════════════════════════════════════════════ -->
    <div v-if="!state.showWhatsNew && !state.showHistory && !state.showSettingsModal && (state.updateReady ? state.screen !== 'home' : true) || (!state.updateReady && !state.showWhatsNew)">

    <template v-if="state.screen === 'home' && !state.showWhatsNew && !(state.updateReady)">
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
          <div style="background:var(--sur);border:2px solid var(--gold);border-radius:14px;padding:1.2rem;cursor:pointer;transition:all .2s" @click="state.screen='setup'">
            <div style="font-size:2rem;margin-bottom:.4rem">🕵️</div>
            <div style="font-size:1rem;font-weight:700;color:var(--txt)">Imposter</div>
            <div style="font-size:.78rem;color:var(--txt2);margin-top:.2rem">Finde den Verräter — 3 bis 16 Spieler</div>
          </div>
        </div>

        <button class="btn-start" @click="state.screen='setup'">🎮 Spiel starten</button>
      </div>
    </template>

    <!-- ══════════════════════════════════════════════════════════════════ -->
    <!-- ── SETUP SCREEN ── -->
    <!-- ══════════════════════════════════════════════════════════════════ -->
    <template v-if="state.screen === 'setup'">
      <div class="top-bar">
        <button class="icon-btn" @click="state.screen='home'" title="Zurück">←</button>
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
            <button class="btn-pri" style="flex:1" @click="showHostSetup">🏠 {{ t('coop.host') }}</button>
            <button class="btn-sec" style="flex:1" @click="showJoinSetup">🚪 {{ t('coop.join') }}</button>
          </div>

          <!-- Hosting -->
          <div v-if="state.coop.phase==='hosting'">
            <div class="coop-hint">{{ t('coop.yourName') }}</div>
            <input class="name-input-big" v-model="state.coop.myName" :placeholder="t('coop.namePlaceholder')" />
            <div class="coop-hint">{{ t('coop.code') }}</div>
            <input class="code-input" v-model="state.coop.codeDraft" maxlength="6" type="tel" placeholder="000000" />
            <div v-if="state.coop.error" class="coop-error">{{ state.coop.error }}</div>
            <button class="btn-pri" @click="createRoom">🏠 Raum erstellen</button>
            <button class="btn-sec" style="margin-top:.5rem" @click="state.coop.phase='idle'">{{ t('coop.cancel') }}</button>
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
            <button class="btn-pri" @click="startCoopGame" :disabled="state.coop.players.length < 2">{{ t('coop.startBtn') }}</button>
            <button class="btn-sec" style="margin-top:.5rem" @click="cancelCoop">{{ t('coop.leave') }}</button>
          </div>

          <!-- Joining -->
          <div v-if="state.coop.phase==='joining'">
            <div class="coop-hint">{{ t('coop.yourName') }}</div>
            <input class="name-input-big" v-model="state.coop.myName" :placeholder="t('coop.namePlaceholder')" />
            <div class="coop-hint">{{ t('coop.code') }}</div>
            <input class="code-input" v-model="state.coop.codeDraft" maxlength="6" type="tel" :placeholder="t('coop.codeHint')" />
            <div v-if="state.coop.error" class="coop-error">{{ state.coop.error }}</div>
            <button class="btn-pri" @click="joinRoom">🚪 {{ t('coop.joinBtn') }}</button>
            <button class="btn-sec" style="margin-top:.5rem" @click="state.coop.phase='idle'">{{ t('coop.cancel') }}</button>
          </div>

          <!-- Joined (Gast wartet) -->
          <div v-if="state.coop.phase==='joined'" style="text-align:center;padding:1rem">
            <div style="font-size:1.5rem;margin-bottom:.5rem">⏳</div>
            <p style="color:var(--txt2);font-size:.9rem">{{ t('coop.waiting') }}</p>
            <div style="font-size:1.4rem;font-weight:900;color:var(--gold);letter-spacing:.2em;margin:.6rem 0">{{ state.coop.code }}</div>
            <button class="btn-pri" @click="toggleReady" style="margin-bottom:.5rem">✓ {{ t('coop.readyBtn') }}</button>
            <button class="btn-sec" @click="cancelCoop">{{ t('coop.leave') }}</button>
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
            <h2>🕵️ {{ t('setup.imposter') }}</h2>
            <div style="display:flex;gap:.6rem">
              <button v-for="n in [1,2]" :key="n"
                :style="{ flex:1, padding:'.7rem', borderRadius:'10px', border:'none', cursor:'pointer', fontWeight:'700', fontSize:'.9rem', color:'#fff', background: state.imposterCount===n ? 'linear-gradient(135deg,var(--pri),var(--pri2))' : 'var(--sur)', border: state.imposterCount===n ? 'transparent' : '1px solid var(--bdr2)', transition:'all .15s' }"
                @click="state.imposterCount=n">{{ n }}</button>
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
        <div style="width:100%;max-width:360px">
          <div class="prog-bar"><div class="prog-fill" :style="{width: (state.revealIdx / state.roles.length * 100) + '%'}"></div></div>
        </div>
        <div class="rev-head">
          <div class="for">{{ t('reveal.for') }}</div>
          <div class="pname">{{ revealPlayer?.name }}</div>
        </div>
        <div class="rev-card" :class="{ flipped: state.revealFlipped, imposter: state.revealFlipped && revealPlayer?.isImposter }">
          <div v-if="!state.revealFlipped" class="card-back">
            <span class="cbi">🃏</span>
            <span class="cbt">{{ t('reveal.tap') }}</span>
          </div>
          <div v-else class="card-front">
            <template v-if="revealPlayer?.isImposter">
              <span class="cfi">🕵️</span>
              <div class="cft" style="color:var(--blood2)">IMPOSTER!</div>
              <div class="cfa">Du kennst das Wort nicht. Tu so als ob — lass dich nicht erwischen!</div>
              <div class="cfg">Beobachte die anderen genau und passe dich an.</div>
            </template>
            <template v-else>
              <span class="cfi">💬</span>
              <div class="cft">Dein Wort:</div>
              <div style="font-size:2rem;font-weight:900;color:var(--gold);margin:.3rem 0">{{ revealPlayer?.word }}</div>
              <div class="cfg">Beschreibe es ohne das Wort zu nennen!</div>
            </template>
          </div>
        </div>
        <button v-if="!state.revealFlipped" class="btn-rev" @click="revealCard">👁 {{ t('reveal.show') }}</button>
        <button v-else class="btn-nxt" @click="nextReveal">
          {{ state.revealIdx + 1 >= state.roles.length ? '▶ Diskussion starten' : '➡ ' + t('reveal.next') }}
        </button>
        <div class="rev-prog">{{ state.revealIdx + 1 }} / {{ state.roles.length }}</div>
      </div>
    </template>

    <!-- ══════════════════════════════════════════════════════════════════ -->
    <!-- ── TIMER SCREEN ── -->
    <!-- ══════════════════════════════════════════════════════════════════ -->
    <template v-if="state.screen === 'timer'">
      <div class="top-bar">
        <button class="icon-btn" @click="openGameMenu" title="Spielmenü">⏸</button>
      </div>
      <div class="timer-wrap">
        <div style="font-size:1.1rem;font-weight:700;color:var(--txt);margin-bottom:.4rem">{{ t('timer.title') }}</div>
        <div class="timer-desc">{{ t('timer.desc') }}</div>
        <div class="timer-ring-outer">
          <svg width="140" height="140" viewBox="0 0 140 140">
            <circle class="timer-track" cx="70" cy="70" r="54"/>
            <circle class="timer-fill" cx="70" cy="70" r="54"
              :stroke="state.timerSeconds <= 10 ? '#ef4444' : state.timerSeconds <= 20 ? '#f59e0b' : 'var(--gold)'"
              :style="{
                strokeDasharray: 2 * Math.PI * 54,
                strokeDashoffset: 2 * Math.PI * 54 * (1 - state.timerSeconds / TIMER_SECONDS),
                transition: 'stroke-dashoffset 1s linear, stroke .5s'
              }"/>
          </svg>
          <div class="timer-num" :style="{color: state.timerSeconds <= 10 ? '#ef4444' : state.timerSeconds <= 20 ? '#f59e0b' : 'var(--gold)'}">
            {{ state.timerSeconds }}
          </div>
        </div>
        <div class="timer-label">{{ t('timer.seconds') }}</div>
        <button class="btn-sec" style="max-width:300px;width:100%" @click="skipTimer">{{ t('timer.skip') }}</button>
      </div>
    </template>

    <!-- ══════════════════════════════════════════════════════════════════ -->
    <!-- ── VOTING SCREEN ── -->
    <!-- ══════════════════════════════════════════════════════════════════ -->
    <template v-if="state.screen === 'voting'">
      <div class="top-bar">
        <button class="icon-btn" @click="openGameMenu" title="Spielmenü">⏸</button>
      </div>
      <div style="padding:1.2rem;max-width:480px;margin:0 auto">
        <div class="prog-bar"><div class="prog-fill" :style="{width: (state.stimmIdx / state.roles.length * 100) + '%'}"></div></div>
        <div style="text-align:center;margin-bottom:1.5rem">
          <div style="font-size:2rem;margin-bottom:.5rem">🗳</div>
          <div style="font-size:1.1rem;font-weight:900;color:var(--txt);margin-bottom:.2rem">{{ t('voting.title') }}</div>
          <div style="color:var(--gold);font-weight:700;font-size:1rem">{{ currentVoter?.name }} {{ t('voting.sub') }}</div>
          <div style="font-size:.75rem;color:var(--txt3);margin-top:.2rem">{{ state.stimmIdx + 1 }} {{ t('voting.of') }} {{ state.roles.length }}</div>
        </div>
        <button v-for="r in voteOptions" :key="r.name" class="vote-btn" @click="castVote(r.name)">
          <span>👤</span> {{ r.name }}
        </button>
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

        <button class="btn-start" @click="startLocalGame">🔄 {{ t('result.newGame') }}</button>
        <button class="btn-sec" style="margin-top:.5rem" @click="newGame">{{ t('result.backHome') }}</button>
      </div>
    </template>

    </div>

  </div>
  `,
};

createApp(App).mount('#app');
init();
