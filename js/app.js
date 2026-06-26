// app.js — Gruppen-Spiele v1.0.0
import { BUILD, CHANGELOG } from './buildinfo.js';
import { ALL_WORDS, TIMER_SECONDS } from './config.js';
import {
  loadSettings, saveSettings, loadSeenVersion, saveSeenVersion,
  loadLastNames, saveLastNames, loadConfigs, saveConfig, deleteConfig,
} from './storage.js';
import { log } from './debuglog.js';

// ── Splash ───────────────────────────────────────────────────────────────────
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
          waitingWorker = nw;
          state.updateReady = true;
          render();
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
  if (!el) {
    el = Object.assign(document.createElement('div'), { id: 'gs-toast', className: 'toast' });
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('show'), 2600);
}

// ── State ─────────────────────────────────────────────────────────────────────
const state = {
  screen: 'home', // home | setup | reveal | timer | voting | result
  settings: loadSettings(),
  showWhatsNew: false,
  showHistory: false,
  historyDetail: null,
  updateReady: false,
  showSettingsDrawer: false,
  showGameMenu: false,
  showConfigs: false,
  configNameDraft: '',
  savedConfigs: loadConfigs(),
  lastSavedNames: loadLastNames(),
  showSavedNamesHint: false,

  // Setup
  playerCount: 5,
  playerNames: Array(5).fill(''),
  imposterCount: 1,

  // Game
  roles: [],       // [{name, isImposter, word}]
  revealIdx: 0,
  revealFlipped: false,
  timerSeconds: TIMER_SECONDS,
  timerInterval: null,
  stimmIdx: 0,
  votes: {},
  winner: null,   // 'village' | 'imposter'
};

// ── Theme ─────────────────────────────────────────────────────────────────────
function applyTheme() {
  const t = state.settings.theme;
  const isLight = t === 'auto'
    ? window.matchMedia('(prefers-color-scheme: light)').matches
    : t === 'light';
  document.body.classList.toggle('light', isLight);
}
window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => {
  if (state.settings.theme === 'auto') applyTheme();
});
function setTheme(t) { state.settings.theme = t; saveSettings(state.settings); applyTheme(); render(); }

// ── Version / Update ──────────────────────────────────────────────────────────
function maybeShowWhatsNew() {
  if (loadSeenVersion() !== BUILD && CHANGELOG.length) state.showWhatsNew = true;
}
function dismissWhatsNew() { state.showWhatsNew = false; saveSeenVersion(BUILD); render(); }

function applyUpdate() {
  if (!waitingWorker) { location.reload(); return; }
  waitingWorker.postMessage({ type: 'skipWaiting' });
}

// ── Game Logic ────────────────────────────────────────────────────────────────
function startGame() {
  const names = state.playerNames.slice(0, state.playerCount).map((n,i) => n.trim() || `Spieler ${i+1}`);
  saveLastNames(names);
  state.lastSavedNames = names;

  const word      = rndWord();
  const shuffled  = shuffle(names);
  const impIdx    = new Set(shuffle([...Array(shuffled.length).keys()]).slice(0, state.imposterCount));
  state.roles     = shuffled.map((name, i) => ({ name, isImposter: impIdx.has(i), word }));
  state.revealIdx = 0;
  state.revealFlipped = false;
  state.votes     = {};
  state.stimmIdx  = 0;
  state.winner    = null;
  state.screen    = 'reveal';
  haptic('success');
  render();
}

function nextReveal() {
  if (state.revealIdx + 1 >= state.roles.length) {
    clearInterval(state.timerInterval);
    state.timerSeconds = TIMER_SECONDS;
    state.screen = 'timer';
    render();
    startTimer();
  } else {
    state.revealIdx++;
    state.revealFlipped = false;
    render();
  }
}

function startTimer() {
  state.timerInterval = setInterval(() => {
    state.timerSeconds--;
    updateTimerDOM();
    if (state.timerSeconds <= 0) {
      clearInterval(state.timerInterval);
      setTimeout(() => { state.screen = 'voting'; state.stimmIdx = 0; render(); }, 600);
    }
  }, 1000);
}

function updateTimerDOM() {
  const numEl  = document.getElementById('timer-num');
  const fillEl = document.getElementById('timer-fill');
  if (!numEl) return;
  const s = state.timerSeconds;
  const color = s <= 10 ? '#ef4444' : s <= 20 ? '#f59e0b' : 'var(--gold)';
  numEl.textContent  = s;
  numEl.style.color  = color;
  if (fillEl) {
    const R    = 54;
    const circ = 2 * Math.PI * R;
    fillEl.style.strokeDasharray  = circ;
    fillEl.style.strokeDashoffset = circ * (1 - s / TIMER_SECONDS);
    fillEl.style.stroke = color;
  }
}

function skipTimer() {
  clearInterval(state.timerInterval);
  state.screen = 'voting';
  state.stimmIdx = 0;
  render();
}

function castVote(target) {
  const voter = state.roles[state.stimmIdx].name;
  state.votes[voter] = target;
  haptic('light');
  if (state.stimmIdx + 1 >= state.roles.length) {
    calcResult();
  } else {
    state.stimmIdx++;
    render();
  }
}

function calcResult() {
  const tally = {};
  state.roles.forEach(r => { tally[r.name] = 0; });
  Object.values(state.votes).forEach(t => { tally[t] = (tally[t] || 0) + 1; });
  const max = Math.max(...Object.values(tally));
  const eliminated = Object.keys(tally).filter(n => tally[n] === max);
  const imposters  = state.roles.filter(r => r.isImposter).map(r => r.name);
  state.winner = eliminated.some(n => imposters.includes(n)) ? 'village' : 'imposter';
  state.eliminatedNames = eliminated;
  state.tally = tally;
  state.screen = 'result';
  haptic(state.winner === 'village' ? 'success' : 'error');
  render();
}

// ── Configs ───────────────────────────────────────────────────────────────────
function saveCurrentConfig() {
  const name = state.configNameDraft.trim() || `${state.playerCount} Spieler`;
  saveConfig({ id: genId(), name, playerCount: state.playerCount, playerNames: [...state.playerNames], imposterCount: state.imposterCount, createdAt: Date.now() });
  state.savedConfigs = loadConfigs();
  state.configNameDraft = '';
  showToast('Konfiguration gespeichert');
  render();
}
function loadConfig(cfg) {
  state.playerCount    = cfg.playerCount;
  state.playerNames    = [...cfg.playerNames];
  state.imposterCount  = cfg.imposterCount || 1;
  while (state.playerNames.length < state.playerCount) state.playerNames.push('');
  state.showConfigs    = false;
  showToast(cfg.name);
  render();
}
function removeConfig(id) { deleteConfig(id); state.savedConfigs = loadConfigs(); render(); }

// ── Render ────────────────────────────────────────────────────────────────────
function render() {
  applyTheme();
  const app = document.getElementById('app');
  let html = `<div class="app">`;

  // Update banner
  if (state.updateReady && state.screen === 'home') {
    html += renderUpdateBanner();
  }

  // Whats New
  if (state.showWhatsNew) {
    html += renderWhatsNew();
  }

  // History detail
  else if (state.showHistory && state.historyDetail) {
    html += renderHistoryDetail();
  }

  // Settings
  else if (state.showSettingsDrawer) {
    html += renderCurrentScreen();
    html += renderSettingsDrawer();
  }

  else {
    html += renderCurrentScreen();
  }

  html += `</div>`;
  app.innerHTML = html;
  bindEvents();

  // Timer DOM update after render
  if (state.screen === 'timer') updateTimerDOM();
}

function renderCurrentScreen() {
  switch (state.screen) {
    case 'home':   return renderHome();
    case 'setup':  return renderSetup();
    case 'reveal': return renderReveal();
    case 'timer':  return renderTimer();
    case 'voting': return renderVoting();
    case 'result': return renderResult();
    default:       return renderHome();
  }
}

// ── Home ──────────────────────────────────────────────────────────────────────
function renderHome() {
  return `
    <div class="top-bar">
      <button class="icon-btn" id="btn-settings" title="Einstellungen">⚙️</button>
    </div>
    <div style="padding:0 1.2rem 3rem;max-width:480px;margin:0 auto;">
      <div class="logo">
        <span class="logo-icon">🕵️</span>
        <h1>GRUPPEN-SPIELE</h1>
        <p>Party Games · Kostenlos · Werbefrei</p>
      </div>

      ${state.showSavedNamesHint && state.lastSavedNames.length ? `
        <div class="names-hint">
          💾 Letzte Spieler: <strong>${state.lastSavedNames.slice(0,3).join(', ')}${state.lastSavedNames.length > 3 ? ` +${state.lastSavedNames.length - 3}` : ''}</strong>
          <br><button class="btn-sec" style="margin-top:.5rem;padding:.4rem" id="btn-load-names">Spieler laden</button>
        </div>
      ` : ''}

      <div class="sec">
        <h2>🎮 Spiel wählen</h2>
        <div style="background:var(--sur);border:2px solid var(--pri);border-radius:14px;padding:1.2rem;cursor:pointer;transition:all .2s;" id="btn-goto-setup">
          <div style="font-size:2rem;margin-bottom:.4rem">🕵️</div>
          <div style="font-size:1rem;font-weight:700;color:var(--txt)">Imposter</div>
          <div style="font-size:.78rem;color:var(--txt2);margin-top:.2rem">Finde den Verräter in eurer Gruppe – 3 bis 12 Spieler</div>
        </div>
      </div>

      <button class="btn-start" id="btn-goto-setup2">🎮 Spiel starten</button>
    </div>
  `;
}

// ── Setup ─────────────────────────────────────────────────────────────────────
function renderSetup() {
  const names = state.playerNames.slice(0, state.playerCount);
  const inputs = names.map((n, i) => `
    <div class="nwrap">
      <span>${i + 1}</span>
      <input class="ninput player-name-input" data-idx="${i}" type="text" placeholder="Name..." value="${n}" autocomplete="off" />
    </div>
  `).join('');

  const configs = state.savedConfigs.length ? `
    <div style="margin-top:1rem">
      <button class="btn-sec btn-sm" id="btn-show-configs">📋 Gespeicherte Konfigurationen (${state.savedConfigs.length})</button>
    </div>
    ${state.showConfigs ? `
      <div style="margin-top:.7rem;background:var(--sur);border:1px solid var(--bdr);border-radius:10px;padding:.7rem .9rem">
        ${state.savedConfigs.map(c => `
          <div class="config-row">
            <div class="config-info">
              <div class="config-name">${c.name}</div>
              <div class="config-sub">${c.playerCount} Spieler · ${c.imposterCount || 1} Imposter</div>
            </div>
            <button class="btn-sec btn-sm" data-load-cfg="${c.id}" style="flex-shrink:0">Laden</button>
            <button class="btn-sec btn-sm" data-del-cfg="${c.id}" style="flex-shrink:0;margin-left:.3rem;color:var(--red2)">✕</button>
          </div>
        `).join('')}
      </div>
    ` : ''}
  ` : '';

  return `
    <div class="top-bar">
      <button class="icon-btn" id="btn-back-home" title="Zurück">←</button>
      <button class="icon-btn" id="btn-settings" title="Einstellungen">⚙️</button>
    </div>
    <div style="padding:0 1.2rem 3rem;max-width:480px;margin:0 auto;">
      <div style="padding:1.2rem 0 .8rem;font-size:1.2rem;font-weight:900;color:var(--txt)">🕵️ Imposter</div>

      <div class="sec">
        <h2>👥 Spieler</h2>
        <div class="pc-row" style="margin-bottom:.8rem">
          <button class="cnt-btn" id="btn-pc-down">−</button>
          <div class="pc-stepper">
            <div class="pc-num">${state.playerCount}</div>
            <div class="cnt-lbl">Spieler</div>
          </div>
          <button class="cnt-btn" id="btn-pc-up">+</button>
        </div>
        <div class="names-scroll">
          <div class="names-grid">${inputs}</div>
        </div>
      </div>

      <div class="sec">
        <h2>🕵️ Imposter</h2>
        <div style="display:flex;gap:.6rem">
          ${[1,2].map(n => `
            <button style="flex:1;padding:.7rem;border-radius:10px;border:none;cursor:pointer;font-weight:700;font-size:.9rem;color:#fff;background:${state.imposterCount===n ? 'linear-gradient(135deg,var(--pri),var(--pri2))' : 'var(--sur)'};border:1px solid ${state.imposterCount===n ? 'transparent' : 'var(--bdr2)'};transition:all .15s" data-imposter="${n}">${n}</button>
          `).join('')}
        </div>
      </div>

      <div class="sec">
        <h2>💾 Konfiguration speichern</h2>
        <div style="display:flex;gap:.5rem">
          <input class="ninput" id="cfg-name-input" placeholder="Name (optional)" value="${state.configNameDraft}" style="flex:1;margin:0" />
          <button class="btn-sec btn-sm" id="btn-save-cfg" style="flex-shrink:0;white-space:nowrap">Speichern</button>
        </div>
        ${configs}
      </div>

      <button class="btn-start" id="btn-start-game" ${state.playerCount < 3 ? 'disabled' : ''}>
        ▶ Spiel starten
      </button>
    </div>
  `;
}

// ── Reveal ────────────────────────────────────────────────────────────────────
function renderReveal() {
  const sp    = state.roles[state.revealIdx];
  const total = state.roles.length;
  const pct   = (state.revealIdx / total * 100).toFixed(0);
  const isLast = state.revealIdx + 1 >= total;

  return `
    <div class="top-bar">
      <button class="icon-btn" id="btn-game-menu" title="Spielmenü">⏸</button>
    </div>
    <div class="reveal-inner">
      <div class="prog-bar"><div class="prog-fill" style="width:${pct}%"></div></div>
      <div class="rev-head">
        <div class="for">Karte für</div>
        <div class="pname">${sp.name}</div>
      </div>
      <div class="rev-card ${state.revealFlipped ? ('flipped' + (sp.isImposter ? ' imposter' : '')) : ''}">
        ${!state.revealFlipped ? `
          <div class="card-back">
            <span class="cbi">🃏</span>
            <span class="cbt">TIPPEN ZUM AUFDECKEN</span>
          </div>
        ` : `
          <div class="card-front">
            ${sp.isImposter ? `
              <span class="cfi">🕵️</span>
              <div class="cft" style="color:var(--red2)">IMPOSTER!</div>
              <div class="cfa">Du kennst das Wort nicht.<br>Tu so als ob — lass dich nicht erwischen!</div>
              <div class="cfg">Beobachte die Anderen genau und passe dich an.</div>
            ` : `
              <span class="cfi">💬</span>
              <div class="cft">Dein Wort:</div>
              <div style="font-size:2rem;font-weight:900;color:var(--gold);margin:.3rem 0">${sp.word}</div>
              <div class="cfg">Beschreibe es ohne das Wort zu nennen!</div>
            `}
          </div>
        `}
      </div>
      ${!state.revealFlipped
        ? `<button class="btn-rev" id="btn-flip">👁 Karte aufdecken</button>`
        : `<button class="btn-nxt" id="btn-next-reveal">${isLast ? '▶ Diskussion starten' : '➡ Weiter'}</button>`
      }
      <div class="rev-prog">${state.revealIdx + 1} / ${total}</div>
    </div>
    ${renderGameMenuModal()}
  `;
}

// ── Timer ─────────────────────────────────────────────────────────────────────
function renderTimer() {
  const R    = 54;
  const circ = 2 * Math.PI * R;
  return `
    <div class="top-bar">
      <button class="icon-btn" id="btn-game-menu" title="Spielmenü">⏸</button>
    </div>
    <div class="timer-wrap">
      <div style="font-size:1.1rem;font-weight:700;color:var(--txt);margin-bottom:.4rem">💬 Jetzt diskutieren!</div>
      <div class="timer-desc">Wer verhält sich verdächtig?<br>Redet über das geheime Wort, ohne es zu sagen!</div>
      <div class="timer-ring-outer">
        <svg width="140" height="140" viewBox="0 0 140 140">
          <circle class="timer-track" cx="70" cy="70" r="${R}" />
          <circle id="timer-fill" class="timer-fill" cx="70" cy="70" r="${R}"
            stroke="var(--gold)"
            stroke-dasharray="${circ}"
            stroke-dashoffset="0"
          />
        </svg>
        <div class="timer-num" id="timer-num">${state.timerSeconds}</div>
      </div>
      <div class="timer-label">SEKUNDEN</div>
      <button class="btn-sec" style="max-width:300px;width:100%" id="btn-skip-timer">Abstimmung jetzt starten →</button>
    </div>
    ${renderGameMenuModal()}
  `;
}

// ── Voting ────────────────────────────────────────────────────────────────────
function renderVoting() {
  const voter  = state.roles[state.stimmIdx];
  const others = state.roles.filter(r => r.name !== voter.name);
  const pct    = (state.stimmIdx / state.roles.length * 100).toFixed(0);

  return `
    <div class="top-bar">
      <button class="icon-btn" id="btn-game-menu" title="Spielmenü">⏸</button>
    </div>
    <div style="padding:1.2rem;max-width:480px;margin:0 auto">
      <div class="prog-bar"><div class="prog-fill" style="width:${pct}%"></div></div>
      <div style="text-align:center;margin-bottom:1.5rem">
        <div style="font-size:2rem;margin-bottom:.5rem">🗳</div>
        <div style="font-size:1.1rem;font-weight:900;color:var(--txt);margin-bottom:.2rem">Wer ist der Imposter?</div>
        <div style="color:var(--gold);font-weight:700;font-size:1rem">${voter.name} stimmt ab</div>
        <div style="font-size:.75rem;color:var(--txt3);margin-top:.2rem">${state.stimmIdx + 1} von ${state.roles.length}</div>
      </div>
      ${others.map(r => `
        <button class="vote-btn" data-vote="${r.name}">
          <span>👤</span> ${r.name}
        </button>
      `).join('')}
    </div>
    ${renderGameMenuModal()}
  `;
}

// ── Result ────────────────────────────────────────────────────────────────────
function renderResult() {
  const win       = state.winner === 'village';
  const imposters = state.roles.filter(r => r.isImposter).map(r => r.name);
  const tally     = state.tally || {};

  return `
    <div class="top-bar">
      <button class="icon-btn" id="btn-settings" title="Einstellungen">⚙️</button>
    </div>
    <div class="go-inner">
      <div class="wicon">${win ? '🎉' : '🕵️'}</div>
      <div class="wtitle" style="color:${win ? 'var(--green)' : 'var(--red2)'}">${win ? 'Imposter erwischt!' : 'Imposter gewinnt!'}</div>
      <div class="wsub">${win ? 'Das Dorf hat gewonnen 🥳' : 'Der Imposter hat alle getäuscht 😈'}</div>

      <div class="surv-box" style="margin-bottom:1rem">
        <h3>🔍 Auflösung</h3>
        <div style="margin-bottom:.6rem">
          <span style="font-size:.78rem;color:var(--txt3)">Das Wort war: </span>
          <strong style="font-size:1.1rem;color:var(--txt)">${state.roles[0]?.word}</strong>
        </div>
        <div style="margin-bottom:.8rem">
          <span style="font-size:.78rem;color:var(--txt3)">Imposter: </span>
          ${imposters.map(n => `<span style="background:rgba(176,32,32,.3);color:#f87171;border-radius:20px;padding:2px 10px;font-size:.78rem;margin-left:4px">${n}</span>`).join('')}
        </div>
        <div style="border-top:1px solid var(--bdr);padding-top:.6rem">
          <div style="font-size:.65rem;letter-spacing:.15em;color:var(--txt3);text-transform:uppercase;margin-bottom:.5rem">Stimmen</div>
          ${state.roles.map(r => `
            <div class="surv-item">
              <span>${r.name}${r.isImposter ? ' 🕵️' : ''}</span>
              <span style="margin-left:auto;color:var(--gold);font-weight:700">${tally[r.name] || 0}×</span>
              ${(state.eliminatedNames || []).includes(r.name) ? `<span style="background:rgba(124,58,237,.3);color:#c4b5fd;border-radius:20px;padding:2px 8px;font-size:.7rem;margin-left:.3rem">Raus</span>` : ''}
            </div>
          `).join('')}
        </div>
      </div>

      <button class="btn-start" id="btn-new-game">🔄 Neues Spiel</button>
      <button class="btn-sec" style="margin-top:.5rem" id="btn-back-home-result">Zurück zum Menü</button>
    </div>
  `;
}

// ── Game Menu Modal ───────────────────────────────────────────────────────────
function renderGameMenuModal() {
  if (!state.showGameMenu) return '';
  return `
    <div class="game-menu-overlay" id="game-menu-overlay">
      <div class="game-menu-card">
        <h3>⏸ Spiel</h3>
        <button class="btn-sec" style="width:100%;margin-bottom:.5rem" id="btn-resume">▶ Fortsetzen</button>
        <button class="btn-sec" style="width:100%;margin-bottom:.5rem;color:var(--red2)" id="btn-end-game">✕ Spiel beenden</button>
      </div>
    </div>
  `;
}

// ── Settings Drawer ───────────────────────────────────────────────────────────
function renderSettingsDrawer() {
  const t = state.settings.theme;
  const themes = ['dark','light','auto'];
  const themeLabels = { dark:'🌙 Dunkel', light:'☀️ Hell', auto:'🔄 System' };

  let body = `
    <div class="settings-overlay" id="settings-overlay"></div>
    <div class="settings-drawer">
      <div class="drawer-head">
        <span class="drawer-title">⚙️ Einstellungen</span>
        <button class="icon-btn" id="btn-close-settings">✕</button>
      </div>
      <div class="drawer-body">
        <div class="drawer-section">
          <div class="drawer-section-title">Darstellung</div>
          <div class="srow">
            <div><div class="slabel">Theme</div></div>
            <div class="theme-btns">
              ${themes.map(th => `
                <button class="theme-btn ${t === th ? 'active' : ''}" data-theme="${th}">${themeLabels[th]}</button>
              `).join('')}
            </div>
          </div>
        </div>

        <div class="drawer-section">
          <div class="drawer-section-title">Über die App</div>
          <div class="srow">
            <div><div class="slabel">Version</div></div>
            <span class="verbadge">v${BUILD}</span>
          </div>
          <div class="srow">
            <div><div class="slabel">Versionshistorie</div></div>
            <button class="ver-hist-btn" id="btn-show-history">Anzeigen</button>
          </div>
          ${state.updateReady ? `
            <div class="srow">
              <div><div class="slabel">Update verfügbar</div></div>
              <button class="ver-hist-btn" id="btn-apply-update" style="color:var(--gold)">Installieren</button>
            </div>
          ` : ''}
        </div>
      </div>
    </div>
  `;
  return body;
}

// ── Update Banner ─────────────────────────────────────────────────────────────
function renderUpdateBanner() {
  const latest = CHANGELOG[0];
  return `
    <div class="modal-bg" id="update-banner">
      <div class="uc-card">
        <span class="uc-badge">✦ UPDATE VERFÜGBAR</span>
        <div class="uc-title">Version ${latest?.version} ist da!</div>
        <div class="uc-desc">${latest?.changes?.slice(0,2).join(' · ')}</div>
        <button class="uc-btn-primary" id="btn-apply-update">⬆ Aktualisieren & neu starten</button>
        <button class="uc-btn-later" id="btn-dismiss-update">Später</button>
      </div>
    </div>
  `;
}

// ── Whats New ─────────────────────────────────────────────────────────────────
function renderWhatsNew() {
  const latest = CHANGELOG[0];
  return `
    <div class="modal-bg">
      <div class="modal">
        <span class="whatsnew-badge">✦ NEU IN VERSION ${latest?.version}</span>
        <div class="wnv-version">v${latest?.version}</div>
        <ul class="wnv-list">
          ${latest?.changes.map(c => `<li>${c}</li>`).join('')}
        </ul>
        <button class="btn-start" id="btn-dismiss-whatsnew">Los geht's! 🎮</button>
      </div>
    </div>
  `;
}

// ── History ───────────────────────────────────────────────────────────────────
function renderHistoryDetail() {
  const d = state.historyDetail;
  return `
    <div style="padding:1.2rem;max-width:480px;margin:0 auto">
      <div class="cl-detail-back" id="btn-back-history">← Zurück</div>
      <div style="margin-bottom:.4rem">
        <span class="cl-version-num">v${d.version}</span>
        <span class="cl-version-date" style="margin-left:.5rem">${d.date}</span>
      </div>
      <ul style="list-style:none;padding:0;margin-top:.8rem">
        ${d.changes.map(c => `
          <li style="font-size:.85rem;color:var(--txt2);padding:.3rem 0;border-bottom:1px solid var(--bdr);display:flex;gap:.5rem">
            <span style="color:var(--gold);flex-shrink:0">✦</span>${c}
          </li>
        `).join('')}
      </ul>
    </div>
  `;
}

// ── Bind Events ───────────────────────────────────────────────────────────────
function bindEvents() {
  const $ = id => document.getElementById(id);
  const on = (id, fn) => $( id)?.addEventListener('click', fn);

  // Home
  on('btn-settings', () => { state.showSettingsDrawer = true; render(); });
  on('btn-goto-setup', () => { state.screen = 'setup'; render(); });
  on('btn-goto-setup2', () => { state.screen = 'setup'; render(); });
  on('btn-load-names', () => {
    state.playerCount = Math.max(3, state.lastSavedNames.length);
    state.playerNames = [...state.lastSavedNames];
    while (state.playerNames.length < state.playerCount) state.playerNames.push('');
    state.showSavedNamesHint = false;
    state.screen = 'setup';
    showToast('Spieler geladen');
    render();
  });
  on('btn-dismiss-update', () => { state.updateReady = false; render(); });
  on('btn-apply-update', applyUpdate);
  on('btn-dismiss-whatsnew', dismissWhatsNew);

  // Setup
  on('btn-back-home', () => { state.screen = 'home'; state.showSavedNamesHint = state.lastSavedNames.length > 0; render(); });
  on('btn-pc-down', () => { if (state.playerCount > 3) { state.playerCount--; state.playerNames = state.playerNames.slice(0, state.playerCount); render(); } });
  on('btn-pc-up',   () => { if (state.playerCount < 16) { state.playerCount++; while (state.playerNames.length < state.playerCount) state.playerNames.push(''); render(); } });
  on('btn-start-game', startGame);
  on('btn-save-cfg', saveCurrentConfig);
  on('btn-show-configs', () => { state.showConfigs = !state.showConfigs; render(); });

  const cfgNameInput = $('cfg-name-input');
  if (cfgNameInput) cfgNameInput.addEventListener('input', e => { state.configNameDraft = e.target.value; });

  document.querySelectorAll('[data-imposter]').forEach(btn =>
    btn.addEventListener('click', () => { state.imposterCount = +btn.dataset.imposter; render(); })
  );
  document.querySelectorAll('[data-load-cfg]').forEach(btn =>
    btn.addEventListener('click', () => loadConfig(state.savedConfigs.find(c => c.id === btn.dataset.loadCfg)))
  );
  document.querySelectorAll('[data-del-cfg]').forEach(btn =>
    btn.addEventListener('click', () => removeConfig(btn.dataset.delCfg))
  );
  document.querySelectorAll('.player-name-input').forEach(inp =>
    inp.addEventListener('input', e => { state.playerNames[+e.target.dataset.idx] = e.target.value; })
  );

  // Reveal
  on('btn-flip', () => { state.revealFlipped = true; haptic('medium'); render(); });
  on('btn-next-reveal', nextReveal);

  // Timer
  on('btn-skip-timer', skipTimer);

  // Voting
  document.querySelectorAll('[data-vote]').forEach(btn =>
    btn.addEventListener('click', () => castVote(btn.dataset.vote))
  );

  // Result
  on('btn-new-game', startGame);
  on('btn-back-home-result', () => { state.screen = 'home'; render(); });

  // Game menu
  on('btn-game-menu', () => { state.showGameMenu = true; render(); });
  on('btn-resume', () => { state.showGameMenu = false; render(); });
  on('btn-end-game', () => {
    state.showGameMenu = false;
    clearInterval(state.timerInterval);
    state.screen = 'home';
    render();
  });
  on('game-menu-overlay', () => { state.showGameMenu = false; render(); });

  // Settings
  on('settings-overlay', () => { state.showSettingsDrawer = false; render(); });
  on('btn-close-settings', () => { state.showSettingsDrawer = false; render(); });
  on('btn-show-history', () => {
    state.showHistory = true;
    state.historyDetail = CHANGELOG[0];
    state.showSettingsDrawer = false;
    render();
  });
  on('btn-back-history', () => { state.showHistory = false; state.historyDetail = null; render(); });
  on('btn-apply-update', applyUpdate);

  document.querySelectorAll('[data-theme]').forEach(btn =>
    btn.addEventListener('click', () => setTheme(btn.dataset.theme))
  );
}

// ── Boot ──────────────────────────────────────────────────────────────────────
applyTheme();
render();
maybeShowWhatsNew();

// Splash ausblenden
setTimeout(() => {
  const splash = document.getElementById('splash');
  if (splash) {
    splash.classList.add('fade-out');
    setTimeout(() => splash.remove(), 500);
  }
}, 900);
