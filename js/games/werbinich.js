// werbinich.js — "Wer bin ich?" Spiellogik
// Sauber getrennt von Imposter. Gleiche Coop-Infrastruktur.
// Version: 0.28

import { reactive, computed } from '../vue.esm-browser.prod.js';
import { WBI_KATEGORIEN, WBI_ALL_CARDS, WBI_DEFAULT_KATEGORIEN } from './werbinich-words.js';
import * as Coop from '../coop.js';
import { log } from '../debuglog.js';
import { loadSettings, saveSettings } from '../storage.js';

export { WBI_KATEGORIEN, WBI_DEFAULT_KATEGORIEN };

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
    if (navigator.vibrate) {
      const p = { light:[10], medium:[20], success:[10,50,10], error:[50,10,50] };
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
export const wbiState = reactive({
  // Setup
  phase: 'setup', // setup | local-reveal | coop-lobby | coop-joined | coop-play | result
  gameMode: 'local',
  playerCount: 4,
  playerNames: Array(4).fill(''),
  customCards: [],
  customCardDraft: '',
  selectedKats: [...WBI_DEFAULT_KATEGORIEN],
  showKats: false,
  roundsTotal: 1,

  // Lokales Spiel
  localCards: [],      // [{ word, category, playerName, guessed, skipped }]
  currentIdx: 0,       // aktueller Spieler beim Kartenverteilen
  showCard: false,     // Karte sichtbar für anderen Spieler
  cardSeen: false,      // Karte wurde mindestens einmal aufgedeckt
  localPhase: 'distribute', // distribute | discuss | resolve
  // Diskussionsphase: welche Karte gerade sichtbar
  discussIdx: 0,
  discussCardVisible: false,

  // Coop
  coop: {
    phase: 'idle',     // idle | hosting | lobby | joining | joined | playing | result
    code: '', codeDraft: '',
    myName: '', myUid: null,
    isHost: false,
    players: [],
    lobbyPlayers: [],  // Gäste: Spielerliste vom Host (WBI_LOBBY-Broadcast)
    myReady: false,
    error: null,
    myCard: null,      // { word, category } — nur ich sehe meine Karte
    allCards: {},      // { uid: { word, category, guessed, skipped } } — Host verwaltet
    guesses: [],       // History der Runde
    roundOver: false,
  },

  // Ergebnis
  results: [],         // [{ playerName, word, guessed }]
  scores: {},          // { name: punkte }
});

// ── Karten-Pool ───────────────────────────────────────────────────────────────
function getCardPool() {
  let pool = [];
  wbiState.selectedKats.forEach(k => {
    if (WBI_KATEGORIEN[k]) pool.push(...WBI_KATEGORIEN[k].map(w => ({ word: w, category: k })));
  });
  wbiState.customCards.forEach(w => pool.push({ word: w, category: '✏️ Eigene' }));
  if (!pool.length) pool = [...WBI_ALL_CARDS];
  return shuffle(pool);
}

// ── Lokales Spiel ─────────────────────────────────────────────────────────────
export function wbiStartLocal() {
  const names = wbiState.playerNames.slice(0, wbiState.playerCount)
    .map((n, i) => n.trim() || `Spieler ${i + 1}`);
  const pool  = getCardPool();

  wbiState.localCards = names.map((name, i) => ({
    word:       pool[i % pool.length]?.word || '???',
    category:   pool[i % pool.length]?.category || '',
    playerName: name,
    guessed:    false,
    skipped:    false,
  }));

  wbiState.currentIdx      = 0;
  wbiState.showCard         = false;
  wbiState.localPhase       = 'distribute';
  wbiState.discussIdx       = 0;
  wbiState.discussCardVisible = false;
  wbiState.results          = [];
  wbiState.scores           = {};
  wbiState.phase            = 'local-reveal';
  haptic('success');
}

export function wbiShowCard()  { wbiState.showCard = true; wbiState.cardSeen = true; haptic('medium'); }
export function wbiHideCard()  { wbiState.showCard = false; }

export function wbiMarkGuessed(idx) {
  wbiState.localCards[idx].guessed = true;
  wbiState.scores[wbiState.localCards[idx].playerName] =
    (wbiState.scores[wbiState.localCards[idx].playerName] || 0) + 1;
  haptic('success');
  if (wbiState.localPhase === 'distribute') wbiNextCard();
  else wbiCheckResolveDone();
}

export function wbiMarkNotGuessed(idx) {
  wbiState.localCards[idx].skipped = true;
  haptic('light');
  wbiCheckResolveDone();
}

function wbiCheckResolveDone() {
  const done = wbiState.localCards.every(c => c.guessed || c.skipped);
  if (done) wbiFinishLocal();
}

// Diskussionsphase: Karte kurz aufdecken/zuklappen
export function wbiToggleDiscussCard(idx) {
  if (wbiState.discussIdx === idx && wbiState.discussCardVisible) {
    wbiState.discussCardVisible = false;
  } else {
    wbiState.discussIdx = idx;
    wbiState.discussCardVisible = true;
  }
  haptic('light');
}

// Zur Auflösungsphase wechseln
export function wbiStartResolve() {
  wbiState.localPhase = 'resolve';
  haptic('medium');
}

export function wbiNextCard() {
  if (wbiState.localPhase === 'distribute') {
    // Nächster Spieler bekommt Karte
    if (wbiState.currentIdx + 1 >= wbiState.localCards.length) {
      // Alle haben ihre Karte — Diskussion starten
      wbiState.localPhase = 'discuss';
      wbiState.discussIdx = 0;
      wbiState.discussCardVisible = false;
      wbiState.showCard = false;
    } else {
      wbiState.currentIdx++;
      wbiState.showCard = false;
      wbiState.cardSeen = false;
    }
  }
}

function wbiFinishLocal() {
  wbiState.results = wbiState.localCards.map(c => ({
    playerName: c.playerName,
    word:       c.word,
    category:   c.category,
    guessed:    c.guessed,
    skipped:    c.skipped,
  }));
  wbiState.phase = 'result';
  haptic(wbiState.results.filter(r => r.guessed).length > 0 ? 'success' : 'error');
}

export function wbiRestart() {
  wbiState.phase            = 'setup';
  wbiState.localCards        = [];
  wbiState.currentIdx        = 0;
  wbiState.showCard          = false;
  wbiState.cardSeen          = false;
  wbiState.localPhase        = 'distribute';
  wbiState.discussIdx        = 0;
  wbiState.discussCardVisible = false;
  wbiState.results           = [];
  wbiState.scores            = {};
}

// ── Coop ──────────────────────────────────────────────────────────────────────
export function wbiSelectMode(m) { wbiState.gameMode = m; }

export function wbiShowHostSetup() {
  wbiState.coop.phase = 'hosting';
  wbiState.coop.codeDraft = '';
  wbiState.coop.players = [];
  wbiState.coop.error = null;
  wbiState.coop.isHost = true;
}

export async function wbiCreateRoom() {
  const code = wbiState.coop.codeDraft.replace(/\D/g, '').slice(0, 6);
  if (code.length !== 6) { wbiState.coop.error = '6-stelligen Code eingeben'; return; }
  const myName = wbiState.coop.myName.trim() || 'Host';
  wbiState.coop.code = code;
  wbiState.coop.error = null;
  wbiState.coop.phase = 'lobby';
  wbiState.coop.players = [{ uid: 'host', name: myName, ready: true, isHost: true }];

  const lobbyBroadcast = () => Coop.send({
    type: 'WBI_LOBBY',
    players: wbiState.coop.players.map(p => ({ uid: p.uid, name: p.name, ready: p.ready, isHost: p.isHost })),
  });

  await Coop.hostGame({
    code, name: myName,
    onOpen: (uid) => {
      wbiState.coop.myUid = uid;
      const h = wbiState.coop.players.find(p => p.isHost);
      if (h) h.uid = uid;
    },
    onError: (e) => {
      Coop.resetFb();
      if (e.type === 'code-taken') wbiState.coop.error = 'Code bereits vergeben!';
      else if (e.type === 'timeout') wbiState.coop.error = 'Timeout — bitte erneut versuchen.';
      else wbiState.coop.error = 'Verbindungsfehler — bitte erneut versuchen.';
      wbiState.coop.phase = 'hosting';
    },
    onJoin: (uid, data) => {
      if (!wbiState.coop.players.find(p => p.uid === uid))
        wbiState.coop.players.push({ uid, name: data?.name || uid, ready: false, isHost: false });
      lobbyBroadcast();
    },
    onLeave: (uid) => {
      wbiState.coop.players = wbiState.coop.players.filter(p => p.uid !== uid);
      lobbyBroadcast();
    },
    onMessage: (msg) => {
      if (msg.type === 'WBI_READY') {
        const p = wbiState.coop.players.find(x => x.uid === msg.author);
        if (p) p.ready = msg.ready;
        lobbyBroadcast();
      }
      wbiHandleCoopMsg(msg);
    },
  });
}

export async function wbiToggleReady() {
  wbiState.coop.myReady = !wbiState.coop.myReady;
  await Coop.send({ type: 'WBI_READY', ready: wbiState.coop.myReady });
}

export function wbiShowJoinSetup() {
  wbiState.coop.phase = 'joining';
  wbiState.coop.codeDraft = '';
  wbiState.coop.myName = '';
  wbiState.coop.error = null;
  wbiState.coop.isHost = false;
}

export async function wbiJoinRoom() {
  const name = wbiState.coop.myName.trim();
  const code = wbiState.coop.codeDraft.replace(/\D/g, '').slice(0, 6);
  if (!name) { wbiState.coop.error = 'Name eingeben'; return; }
  if (code.length !== 6) { wbiState.coop.error = '6-stelligen Code eingeben'; return; }
  wbiState.coop.error = null;
  wbiState.coop.code = code;

  await Coop.joinGame({
    code, name,
    onOpen: (uid) => { wbiState.coop.myUid = uid; wbiState.coop.phase = 'joined'; },
    onError: (e) => {
      Coop.resetFb();
      if (e.type === 'code-not-found') wbiState.coop.error = 'Raum nicht gefunden!';
      else if (e.type === 'room-full')  wbiState.coop.error = 'Raum ist voll!';
      else if (e.type === 'timeout')    wbiState.coop.error = 'Timeout — bitte erneut versuchen.';
      else wbiState.coop.error = 'Verbindungsfehler — bitte erneut versuchen.';
    },
    onMessage: wbiHandleCoopMsg,
    onClose: () => { wbiState.coop.phase = 'idle'; },
  });
}

export async function wbiStartCoopGame() {
  // Host teilt Karten zu und sendet sie verschlüsselt
  const pool    = getCardPool();
  const players = wbiState.coop.players;
  const assignments = players.map((p, i) => ({
    uid:      p.uid,
    name:     p.name,
    word:     pool[i % pool.length]?.word || '???',
    category: pool[i % pool.length]?.category || '',
  }));

  wbiState.coop.allCards = {};
  assignments.forEach(a => {
    wbiState.coop.allCards[a.uid] = { word: a.word, category: a.category, guessed: false, skipped: false };
  });
  wbiState.coop.guesses  = [];
  wbiState.coop.roundOver = false;

  // Jeder bekommt nur seine eigene Karte
  for (const a of assignments) {
    await Coop.sendTo(a.uid, {
      type:     'WBI_CARD',
      word:     a.word,
      category: a.category,
    });
  }
  // Host auch selbst
  const mine = assignments.find(a => a.uid === wbiState.coop.myUid);
  if (mine) {
    wbiState.coop.myCard = { word: mine.word, category: mine.category };
  }

  await Coop.send({ type: 'WBI_START', players: assignments.map(a => ({ uid: a.uid, name: a.name })) });
  wbiState.coop.phase = 'playing';
}

function wbiHandleCoopMsg(msg) {
  if (!msg) return;

  if (msg.type === 'WBI_LOBBY') {
    wbiState.coop.lobbyPlayers = msg.players || [];
  }

  if (msg.type === 'WBI_CARD' && msg.targetUid === wbiState.coop.myUid) {
    wbiState.coop.myCard = { word: msg.word, category: msg.category };
  }

  if (msg.type === 'WBI_START') {
    wbiState.coop.phase = 'playing';
    wbiState.coop.guesses = [];
    if (msg.targetUid) return; // Ignore targeted
  }

  if (msg.type === 'WBI_GUESS') {
    // Spieler hat geraten — alle sehen's
    wbiState.coop.guesses.push({
      name:    msg.guesserName,
      word:    msg.word,
      correct: msg.correct,
      ts:      msg.ts || Date.now(),
    });
    if (wbiState.coop.isHost && wbiState.coop.allCards[msg.author]) {
      wbiState.coop.allCards[msg.author].guessed = msg.correct;
    }
    haptic(msg.correct ? 'success' : 'light');
    // Prüfen ob alle fertig
    if (wbiState.coop.isHost) wbiCheckCoopDone();
  }

  if (msg.type === 'WBI_RESULT') {
    wbiState.results = msg.results;
    wbiState.scores  = msg.scores;
    wbiState.coop.phase = 'result';
    haptic('success');
  }
}

async function wbiCheckCoopDone() {
  const all = Object.values(wbiState.coop.allCards);
  if (all.every(c => c.guessed || c.skipped)) {
    // Alle fertig → Ergebnis senden
    const results = wbiState.coop.players.map(p => {
      const card = wbiState.coop.allCards[p.uid];
      return { playerName: p.name, word: card?.word || '', guessed: card?.guessed || false };
    });
    const scores = {};
    results.filter(r => r.guessed).forEach(r => { scores[r.playerName] = (scores[r.playerName] || 0) + 1; });
    await Coop.send({ type: 'WBI_RESULT', results, scores });
  }
}

export async function wbiSendGuess(correct) {
  const card = wbiState.coop.myCard;
  if (!card) return;
  await Coop.send({
    type:        'WBI_GUESS',
    guesserName: wbiState.coop.myName || wbiState.coop.players.find(p => p.uid === wbiState.coop.myUid)?.name || '?',
    word:        card.word,
    correct,
  });
  haptic(correct ? 'success' : 'light');
}

export async function wbiCancelCoop() {
  await Coop.leave();
  wbiState.coop.phase        = 'idle';
  wbiState.coop.players      = [];
  wbiState.coop.lobbyPlayers = [];
  wbiState.coop.myReady      = false;
  wbiState.coop.error        = null;
  wbiState.coop.myUid        = null;
  wbiState.coop.myCard       = null;
  wbiState.coop.allCards     = {};
  wbiState.coop.guesses      = [];
}

export async function wbiGetInviteLink() {
  const base = window.location.origin + window.location.pathname;
  return `${base}?wbi=${wbiState.coop.code}`;
}

export async function wbiShareLink() {
  const url = await wbiGetInviteLink();
  if (navigator.share) {
    try { await navigator.share({ title: 'Wer bin ich? — Beitreten', text: `Code: ${wbiState.coop.code}`, url }); return; }
    catch(e) { if (e.name === 'AbortError') return; }
  }
  try { await navigator.clipboard.writeText(url); showToast('Link kopiert!'); }
  catch { showToast(url); }
}

// Computed Helpers
export function wbiCurrentCard() {
  return wbiState.localCards[wbiState.currentIdx] || null;
}
export function wbiRemainingCount() {
  return wbiState.localCards.filter(c => !c.guessed && !c.skipped).length;
}
export function wbiGuessedCount() {
  return wbiState.localCards.filter(c => c.guessed).length;
}

// Alias für Rückwärtskompatibilität
export const wbiMarkSkipped = wbiMarkNotGuessed;
