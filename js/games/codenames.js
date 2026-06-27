// codenames.js — Codenames Spiellogik
// Sauber getrennt. Coop-Pflicht: Spymasters sehen Karte nur auf eigenem Handy.
// Version: 0.45

import { reactive } from '../vue.esm-browser.prod.js';
import { getCNWords } from './codenames-words.js';
import * as Coop from '../coop.js';
import { log } from '../debuglog.js';

// ── Karten-Typen ─────────────────────────────────────────────────────────────
export const CN_TYPE = { RED: 'red', BLUE: 'blue', BLACK: 'black', NEUTRAL: 'neutral' };

// ── State ─────────────────────────────────────────────────────────────────────
export const cnState = reactive({
  phase: 'setup', // setup | playing | gameover

  // Setup
  lang: 'de',
  coop: {
    phase: 'idle', // idle | hosting | lobby | joining | joined | playing | gameover
    code: '', codeDraft: '',
    myName: '', myUid: null,
    isHost: false,
    players: [],
    error: null,
    myRole: null,    // 'spymaster-red' | 'spymaster-blue' | 'operative'
    myTeam: null,    // 'red' | 'blue'
  },

  // Spielfeld
  words: [],       // [{ word, type, revealed, highlight }] — 25 Karten
  redCount: 0,     // Anzahl rote Karten gesamt
  blueCount: 0,    // Anzahl blaue Karten gesamt
  redLeft: 0,      // Noch nicht aufgedeckte rote Karten
  blueLeft: 0,     // Noch nicht aufgedeckte blaue Karten

  // Spielzug
  currentTeam: 'red',          // 'red' | 'blue'
  hint: '',                    // Aktueller Hinweis-Text
  hintCount: 0,                // Anzahl zu ratender Wörter
  hintDraft: '',               // Eingabe Spymaster
  hintCountDraft: 1,
  guessesLeft: 0,              // Noch mögliche Rateversuche
  phase2: 'hint',              // 'hint' | 'guess' — innerhalb des Zugs

  // Ergebnis
  winner: null,                // 'red' | 'blue'
  winReason: '',               // 'all-found' | 'black-card'

  // UI
  showSecretMap: false,        // Spymaster-Sicht ein/aus (nur lokal zum Testen)
  cnMenu: false,
  cnEndConfirm: false,
  highlightIdx: null,
});

// ── Hilfsfunktionen ───────────────────────────────────────────────────────────
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function haptic(style = 'light') {
  try {
    const p = { light:[10], medium:[20], success:[10,50,10], error:[50,10,50] };
    if (navigator.vibrate) navigator.vibrate(p[style] || [10]);
  } catch {}
}

function showToast(msg) {
  let el = document.getElementById('gs-toast');
  if (!el) {
    el = Object.assign(document.createElement('div'), { id:'gs-toast', className:'toast' });
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('show'), 2600);
}

// ── Grid erstellen ────────────────────────────────────────────────────────────
function createGrid(lang) {
  const words = getCNWords(lang, 25);

  // Rot startet → bekommt 9 Karten, Blau 8, Schwarz 1, Neutral 7
  const types = shuffle([
    ...Array(9).fill(CN_TYPE.RED),
    ...Array(8).fill(CN_TYPE.BLUE),
    CN_TYPE.BLACK,
    ...Array(7).fill(CN_TYPE.NEUTRAL),
  ]);

  return words.map((word, i) => ({
    word,
    type:     types[i],
    revealed: false,
    highlight: false,
  }));
}

// ── Lokales Spiel (nur für Host zum Starten) ──────────────────────────────────
export function cnStartLocal() {
  const grid = createGrid(cnState.lang);
  cnState.words       = grid;
  cnState.redCount    = grid.filter(c => c.type === CN_TYPE.RED).length;
  cnState.blueCount   = grid.filter(c => c.type === CN_TYPE.BLUE).length;
  cnState.redLeft     = cnState.redCount;
  cnState.blueLeft    = cnState.blueCount;
  cnState.currentTeam = 'red';
  cnState.hint        = '';
  cnState.hintCount   = 0;
  cnState.guessesLeft = 0;
  cnState.phase2      = 'hint';
  cnState.winner      = null;
  cnState.winReason   = '';
  cnState.phase       = 'playing';
  haptic('success');
}

// ── Hinweis geben (Spymaster) ─────────────────────────────────────────────────
export function cnGiveHint() {
  const hint  = cnState.hintDraft.trim();
  const count = cnState.hintCountDraft;
  if (!hint) return;

  cnState.hint        = hint;
  cnState.hintCount   = count;
  cnState.guessesLeft = count + 1; // +1 Bonus-Rateversuch
  cnState.hintDraft   = '';
  cnState.phase2      = 'guess';
  haptic('medium');

  if (cnState.coop.phase === 'playing') {
    Coop.send({ type: 'CN_HINT', hint, count, team: cnState.currentTeam });
  }
}

// ── Karte antippen (Operative) ────────────────────────────────────────────────
export function cnRevealCard(idx) {
  const card = cnState.words[idx];
  if (!card || card.revealed || cnState.phase2 !== 'guess') return;
  if (cnState.winner) return;

  card.revealed = true;
  haptic('medium');

  if (cnState.coop.phase === 'playing') {
    Coop.send({ type: 'CN_REVEAL', idx, team: cnState.currentTeam });
  }

  cnCheckReveal(idx);
}

function cnCheckReveal(idx) {
  const card = cnState.words[idx];

  // Schwarze Karte → sofort verloren
  if (card.type === CN_TYPE.BLACK) {
    cnState.winner    = cnState.currentTeam === 'red' ? 'blue' : 'red';
    cnState.winReason = 'black-card';
    cnEndGame();
    haptic('error');
    return;
  }

  // Zähler aktualisieren
  cnState.redLeft  = cnState.words.filter(c => c.type === CN_TYPE.RED  && !c.revealed).length;
  cnState.blueLeft = cnState.words.filter(c => c.type === CN_TYPE.BLUE && !c.revealed).length;

  // Gewonnen?
  if (cnState.redLeft  === 0) { cnState.winner = 'red';  cnState.winReason = 'all-found'; cnEndGame(); return; }
  if (cnState.blueLeft === 0) { cnState.winner = 'blue'; cnState.winReason = 'all-found'; cnEndGame(); return; }

  // Falsche Farbe → Zug wechseln
  if (card.type !== cnState.currentTeam) {
    cnPassTurn();
    return;
  }

  // Richtige Farbe → Rateversuche reduzieren
  cnState.guessesLeft--;
  if (cnState.guessesLeft <= 0) cnPassTurn();
}

// ── Zug weitergeben ───────────────────────────────────────────────────────────
export function cnPassTurn() {
  cnState.currentTeam = cnState.currentTeam === 'red' ? 'blue' : 'red';
  cnState.hint        = '';
  cnState.hintCount   = 0;
  cnState.guessesLeft = 0;
  cnState.phase2      = 'hint';
  haptic('light');

  if (cnState.coop.phase === 'playing') {
    Coop.send({ type: 'CN_PASS', team: cnState.currentTeam });
  }
}

function cnEndGame() {
  cnState.phase = 'gameover';
  if (cnState.coop.phase === 'playing') {
    Coop.send({ type: 'CN_END', winner: cnState.winner, reason: cnState.winReason });
  }
  haptic(cnState.winner === cnState.coop.myTeam ? 'success' : 'error');
}

export function cnReset() {
  cnState.phase       = 'setup';
  cnState.words       = [];
  cnState.winner      = null;
  cnState.hint        = '';
  cnState.hintDraft   = '';
  cnState.phase2      = 'hint';
  cnState.showSecretMap = false;
  cnState.cnMenu      = false;
  cnState.cnEndConfirm = false;
}

// ── Coop ──────────────────────────────────────────────────────────────────────
export function cnShowHostSetup() {
  cnState.coop.phase    = 'hosting';
  cnState.coop.codeDraft = '';
  cnState.coop.error    = null;
  cnState.coop.isHost   = true;
  cnState.coop.players  = [];
}

export async function cnCreateRoom() {
  const code   = cnState.coop.codeDraft.replace(/\D/g, '').slice(0, 6);
  const myName = cnState.coop.myName.trim() || 'Host';
  if (code.length !== 6) { cnState.coop.error = '6-stelligen Code eingeben'; return; }

  cnState.coop.code  = code;
  cnState.coop.error = null;
  cnState.coop.phase = 'lobby';
  cnState.coop.players = [{ uid: 'host', name: myName, role: null, isHost: true }];

  await Coop.hostGame({
    code, name: myName,
    onOpen:    (uid) => { cnState.coop.myUid = uid; },
    onError:   (e)   => {
      cnState.coop.error = e.type === 'code-taken' ? 'Code bereits vergeben!' : 'Verbindungsfehler.';
      cnState.coop.phase = 'hosting';
    },
    onJoin:    (uid, data) => {
      if (!cnState.coop.players.find(p => p.uid === uid)) {
        cnState.coop.players.push({ uid, name: data?.name || uid, role: null, isHost: false });
      }
    },
    onLeave:   (uid) => { cnState.coop.players = cnState.coop.players.filter(p => p.uid !== uid); },
    onMessage: cnHandleCoopMsg,
  });
}

export function cnShowJoinSetup() {
  cnState.coop.phase     = 'joining';
  cnState.coop.codeDraft = '';
  cnState.coop.myName    = '';
  cnState.coop.error     = null;
  cnState.coop.isHost    = false;
}

export async function cnJoinRoom() {
  const name = cnState.coop.myName.trim();
  const code = cnState.coop.codeDraft.replace(/\D/g, '').slice(0, 6);
  if (!name) { cnState.coop.error = 'Name eingeben'; return; }
  if (code.length !== 6) { cnState.coop.error = '6-stelligen Code eingeben'; return; }

  cnState.coop.code  = code;
  cnState.coop.error = null;

  await Coop.joinGame({
    code, name,
    onOpen:    (uid) => { cnState.coop.myUid = uid; cnState.coop.phase = 'joined'; },
    onError:   (e)   => {
      cnState.coop.error =
        e.type === 'code-not-found' ? 'Raum nicht gefunden!' :
        e.type === 'room-full'      ? 'Raum ist voll!'       :
        e.type === 'timeout'        ? 'Verbindungs-Timeout.' : 'Verbindungsfehler.';
    },
    onMessage: cnHandleCoopMsg,
    onClose:   () => { cnState.coop.phase = 'idle'; },
  });
}

// Rolle wählen in der Lobby
export async function cnSetRole(role) {
  // role: 'spymaster-red' | 'spymaster-blue' | 'operative-red' | 'operative-blue'
  const player = cnState.coop.players.find(p => p.uid === cnState.coop.myUid);
  if (player) player.role = role;
  cnState.coop.myRole = role;
  cnState.coop.myTeam = role.includes('red') ? 'red' : 'blue';
  await Coop.send({ type: 'CN_ROLE', role, uid: cnState.coop.myUid });
}

export async function cnStartCoopGame() {
  const grid = createGrid(cnState.lang);
  // Nur Spymasters bekommen den vollständigen Grid mit Typen
  // Operatives bekommen Grid ohne Typen (type: null bis aufgedeckt)

  const publicGrid  = grid.map(c => ({ word: c.word, type: null, revealed: false }));
  const secretGrid  = grid; // mit types

  // Spymasters identifizieren
  const spymasters = cnState.coop.players.filter(p =>
    p.role && p.role.startsWith('spymaster')
  );

  // An alle: Public-Grid + Start
  await Coop.send({
    type: 'CN_START',
    publicGrid,
    redCount:  grid.filter(c => c.type === CN_TYPE.RED).length,
    blueCount: grid.filter(c => c.type === CN_TYPE.BLUE).length,
    lang: cnState.lang,
  });

  // An Spymasters: Secret Grid (per targeted message)
  for (const sm of spymasters) {
    await Coop.sendTo(sm.uid, { type: 'CN_SECRET', secretGrid });
  }

  // Host selbst
  cnApplyStart({ publicGrid,
    redCount:  grid.filter(c => c.type === CN_TYPE.RED).length,
    blueCount: grid.filter(c => c.type === CN_TYPE.BLUE).length,
  });
  if (spymasters.find(s => s.uid === cnState.coop.myUid)) {
    cnApplySecret({ secretGrid });
  }
}

function cnApplyStart(msg) {
  cnState.words       = msg.publicGrid.map(c => ({ ...c }));
  cnState.redCount    = msg.redCount;
  cnState.blueCount   = msg.blueCount;
  cnState.redLeft     = msg.redCount;
  cnState.blueLeft    = msg.blueCount;
  cnState.currentTeam = 'red';
  cnState.hint        = '';
  cnState.hintCount   = 0;
  cnState.guessesLeft = 0;
  cnState.phase2      = 'hint';
  cnState.winner      = null;
  cnState.coop.phase  = 'playing';
  cnState.phase       = 'playing';
}

function cnApplySecret(msg) {
  // Spymaster: echte Typen einsetzen
  msg.secretGrid.forEach((c, i) => {
    cnState.words[i].type = c.type;
  });
}

function cnHandleCoopMsg(msg) {
  if (!msg) return;

  if (msg.type === 'CN_ROLE') {
    const p = cnState.coop.players.find(p => p.uid === msg.author);
    if (p) p.role = msg.role;
  }

  if (msg.type === 'CN_START') cnApplyStart(msg);

  if (msg.type === 'CN_SECRET' && msg.targetUid === cnState.coop.myUid) {
    cnApplySecret(msg);
  }

  if (msg.type === 'CN_HINT') {
    cnState.hint        = msg.hint;
    cnState.hintCount   = msg.count;
    cnState.guessesLeft = msg.count + 1;
    cnState.phase2      = 'guess';
    haptic('light');
  }

  if (msg.type === 'CN_REVEAL') {
    const card = cnState.words[msg.idx];
    if (card) {
      card.revealed = true;
      cnCheckReveal(msg.idx);
    }
  }

  if (msg.type === 'CN_PASS') {
    cnState.currentTeam = msg.team;
    cnState.hint        = '';
    cnState.hintCount   = 0;
    cnState.guessesLeft = 0;
    cnState.phase2      = 'hint';
  }

  if (msg.type === 'CN_END') {
    cnState.winner    = msg.winner;
    cnState.winReason = msg.reason;
    cnState.phase     = 'gameover';
    cnState.coop.phase = 'gameover';
    haptic(msg.winner === cnState.coop.myTeam ? 'success' : 'error');
  }
}

export async function cnCancelCoop() {
  await Coop.leave();
  cnState.coop.phase   = 'idle';
  cnState.coop.players = [];
  cnState.coop.error   = null;
  cnState.coop.myUid   = null;
  cnState.coop.myRole  = null;
  cnState.coop.myTeam  = null;
  cnReset();
}

export async function cnShareLink() {
  const base = window.location.origin + window.location.pathname;
  const url  = `${base}?cn=${cnState.coop.code}`;
  if (navigator.share) {
    try { await navigator.share({ title: 'Codenames — Beitreten', text: `Code: ${cnState.coop.code}`, url }); return; }
    catch(e) { if (e.name === 'AbortError') return; }
  }
  try { await navigator.clipboard.writeText(url); showToast('Link kopiert!'); }
  catch { showToast(url); }
}

// Hilfsfunktionen für Template
export function cnIsSpymaster() {
  return cnState.coop.myRole?.startsWith('spymaster') ?? false;
}
export function cnMyTeam() {
  return cnState.coop.myTeam;
}
export function cnCardColor(card) {
  if (!card.revealed && !cnIsSpymaster()) return 'neutral-hidden';
  return card.type || 'neutral';
}
