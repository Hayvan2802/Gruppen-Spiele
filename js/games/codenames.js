// codenames.js — Codenames Spiellogik v0.58
// Coop: Host verteilt Rollen, Spymasters sehen Geheimkarte auf eigenem Handy.
// Operatives tippen Karten auf eigenem Handy an.
// WICHTIG: card.type ist bei Operatives null (unbekannt) bis aufgedeckt.
//          Nur Spymasters und Host kennen alle Typen von Anfang an.

import { reactive } from '../vue.esm-browser.prod.js';
import { getCNWords } from './codenames-words.js';
import * as Coop from '../coop.js';
import { log } from '../debuglog.js';

export const CN_TYPE = { RED: 'red', BLUE: 'blue', BLACK: 'black', NEUTRAL: 'neutral' };

// ── State ─────────────────────────────────────────────────────────────────────
export const cnState = reactive({
  phase: 'setup',   // setup | playing | gameover
  lang: 'de',

  // Coop
  coop: {
    phase: 'idle',  // idle | hosting | lobby | joining | joined | playing | gameover
    code: '', codeDraft: '',
    myName: '', myUid: null,
    isHost: false,
    players: [],    // [{ uid, name, role, isHost }]
    error: null,
    myRole: null,   // 'spymaster-red'|'spymaster-blue'|'operative-red'|'operative-blue'
    myTeam: null,   // 'red'|'blue'
  },

  // Spielfeld — words[i].type ist null für Operatives bis aufgedeckt
  words: [],
  secretTypes: [],  // Nur Spymaster/Host: vollständige Typenliste [25]
  redCount: 0,
  blueCount: 0,
  redLeft: 0,
  blueLeft: 0,

  // Spielzug
  currentTeam: 'red',
  hint: '',
  hintCount: 0,
  hintDraft: '',
  hintCountDraft: 1,
  guessesLeft: 0,
  phase2: 'hint',   // 'hint' | 'guess'

  // Ergebnis
  winner: null,
  winReason: '',

  // UI
  showSecretMap: false,
  cnMenu: false,
  cnEndConfirm: false,
});

// ── Hilfs ─────────────────────────────────────────────────────────────────────
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length-1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i+1));
    [a[i],a[j]] = [a[j],a[i]];
  }
  return a;
}
function haptic(s='light') {
  try { if(navigator.vibrate) navigator.vibrate({light:[10],medium:[20],success:[10,50,10],error:[50,10,50]}[s]||[10]); } catch{}
}
function toast(msg) {
  let el = document.getElementById('gs-toast');
  if (!el) { el = Object.assign(document.createElement('div'),{id:'gs-toast',className:'toast'}); document.body.appendChild(el); }
  el.textContent = msg; el.classList.add('show');
  clearTimeout(el._t); el._t = setTimeout(()=>el.classList.remove('show'),2600);
}

// ── Grid erzeugen ─────────────────────────────────────────────────────────────
function createGrid(lang) {
  const words = getCNWords(lang, 25);
  const types = shuffle([
    ...Array(9).fill(CN_TYPE.RED),
    ...Array(8).fill(CN_TYPE.BLUE),
    CN_TYPE.BLACK,
    ...Array(7).fill(CN_TYPE.NEUTRAL),
  ]);
  return {
    words: words.map((word, i) => ({ word, type: types[i], revealed: false })),
    types,
    startingTeam,
  };
}

// ── Lokales Spiel ─────────────────────────────────────────────────────────────
export function cnStartLocal() {
  const { words, startingTeam } = createGrid(cnState.lang);
  cnState.words        = words;
  cnState.secretTypes  = words.map(c => c.type);
  cnState.redCount     = words.filter(c => c.type===CN_TYPE.RED).length;
  cnState.blueCount    = words.filter(c => c.type===CN_TYPE.BLUE).length;
  cnState.redLeft      = cnState.redCount;
  cnState.blueLeft     = cnState.blueCount;
  cnState.currentTeam  = startingTeam; // Team mit 9 Karten startet
  cnState.hint         = '';
  cnState.hintCount    = 0;
  cnState.guessesLeft  = 0;
  cnState.phase2       = 'hint';
  cnState.winner       = null;
  cnState.winReason    = '';
  cnState.showSecretMap = true; // Ein-Gerät: Spymaster sieht immer alles
  cnState.phase        = 'playing';
  haptic('success');
}

// ── Spielzug-Logik ────────────────────────────────────────────────────────────
export function cnGiveHint() {
  const hint = cnState.hintDraft.trim();
  if (!hint) return;
  cnState.hint        = hint;
  cnState.hintCount   = cnState.hintCountDraft;
  cnState.guessesLeft = cnState.hintCountDraft + 1; // +1 Bonus
  cnState.hintDraft   = '';
  cnState.phase2      = 'guess';
  haptic('medium');
  if (cnState.coop.phase === 'playing') {
    Coop.send({ type:'CN_HINT', hint, count:cnState.hintCountDraft, team:cnState.currentTeam });
  }
}

export function cnRevealCard(idx) {
  const card = cnState.words[idx];
  if (!card || card.revealed || cnState.phase2 !== 'guess') return;
  if (cnState.winner) return;

  // Echter Typ: bei Coop via secretTypes (Spymaster/Host), sonst direkt
  const realType = cnState.secretTypes[idx] || card.type;
  if (!realType) return; // Sicherheit

  card.revealed = true;
  card.type     = realType; // jetzt für alle sichtbar

  haptic('medium');
  if (cnState.coop.phase === 'playing') {
    Coop.send({ type:'CN_REVEAL', idx, realType, team:cnState.currentTeam });
  }
  cnProcessReveal(idx, realType);
}

function cnProcessReveal(idx, realType) {
  // Schwarze Karte → sofort verloren
  if (realType === CN_TYPE.BLACK) {
    cnState.winner    = cnState.currentTeam === 'red' ? 'blue' : 'red';
    cnState.winReason = 'black-card';
    cnFinish(); haptic('error'); return;
  }

  // Zähler
  cnState.redLeft  = cnState.words.filter(c => c.type===CN_TYPE.RED  && !c.revealed).length;
  cnState.blueLeft = cnState.words.filter(c => c.type===CN_TYPE.BLUE && !c.revealed).length;

  if (cnState.redLeft  === 0) { cnState.winner='red';  cnState.winReason='all-found'; cnFinish(); return; }
  if (cnState.blueLeft === 0) { cnState.winner='blue'; cnState.winReason='all-found'; cnFinish(); return; }

  // Neutrale oder gegnerische Karte → Zug wechseln
  if (realType !== cnState.currentTeam) {
    cnPassTurn(); return;
  }

  // Richtige Karte
  cnState.guessesLeft--;
  if (cnState.guessesLeft <= 0) cnPassTurn();
}

function cnFinish() {
  cnState.phase = 'gameover';
  if (cnState.coop.phase === 'playing') {
    Coop.send({ type:'CN_END', winner:cnState.winner, reason:cnState.winReason });
  }
  haptic(cnState.winner === cnState.coop.myTeam ? 'success' : 'error');
}

export function cnPassTurn() {
  cnState.currentTeam = cnState.currentTeam === 'red' ? 'blue' : 'red';
  cnState.hint        = '';
  cnState.hintCount   = 0;
  cnState.guessesLeft = 0;
  cnState.phase2      = 'hint';
  haptic('light');
  if (cnState.coop.phase === 'playing') {
    Coop.send({ type:'CN_PASS', team:cnState.currentTeam });
  }
}

export function cnReset() {
  cnState.phase        = 'setup';
  cnState.words        = [];
  cnState.secretTypes  = [];
  cnState.winner       = null;
  cnState.hint         = '';
  cnState.hintDraft    = '';
  cnState.phase2       = 'hint';
  cnState.showSecretMap = false;
  cnState.cnMenu       = false;
  cnState.cnEndConfirm = false;
  cnState.coop.myRole  = null;
  cnState.coop.myTeam  = null;
}

// ── COOP ──────────────────────────────────────────────────────────────────────
export function cnShowHostSetup() {
  cnState.coop.phase    = 'hosting';
  cnState.coop.codeDraft = '';
  cnState.coop.error    = null;
  cnState.coop.isHost   = true;
  cnState.coop.players  = [];
  cnState.coop.myRole   = null;
  cnState.coop.myTeam   = null;
}

export async function cnCreateRoom() {
  const code   = cnState.coop.codeDraft.replace(/[^0-9]/g,'').slice(0,6);
  const myName = cnState.coop.myName.trim() || 'Host';
  if (code.length !== 6) { cnState.coop.error = '6-stelligen Code eingeben'; return; }
  cnState.coop.code  = code;
  cnState.coop.error = null;
  cnState.coop.phase = 'lobby';
  cnState.coop.players = [{ uid:'host', name:myName, role:null, isHost:true }];

  await Coop.hostGame({
    code, name: myName,
    onOpen:    (uid) => { cnState.coop.myUid = uid; },
    onError:   (e)   => {
      cnState.coop.error = e.type==='code-taken' ? 'Code bereits vergeben!' : 'Verbindungsfehler.';
      cnState.coop.phase = 'hosting';
    },
    onJoin:    (uid, data) => {
      const existing = cnState.coop.players.find(p => p.uid===uid);
      if (existing) { existing.name=data?.name||uid; existing.role=data?.role||null; }
      else cnState.coop.players.push({ uid, name:data?.name||uid, role:data?.role||null, isHost:false });
    },
    onLeave:   (uid) => { cnState.coop.players = cnState.coop.players.filter(p=>p.uid!==uid); },
    onMessage: cnHandleCoopMsg,
  });
}

export function cnShowJoinSetup() {
  cnState.coop.phase     = 'joining';
  cnState.coop.codeDraft = '';
  cnState.coop.myName    = '';
  cnState.coop.error     = null;
  cnState.coop.isHost    = false;
  cnState.coop.myRole    = null;
  cnState.coop.myTeam    = null;
}

export async function cnJoinRoom() {
  const name = cnState.coop.myName.trim();
  const code = cnState.coop.codeDraft.replace(/[^0-9]/g,'').slice(0,6);
  if (!name)          { cnState.coop.error='Name eingeben'; return; }
  if (code.length!==6){ cnState.coop.error='6-stelligen Code eingeben'; return; }
  cnState.coop.error = null;
  cnState.coop.code  = code;

  await Coop.joinGame({
    code, name,
    onOpen:    (uid) => { cnState.coop.myUid=uid; cnState.coop.phase='joined'; },
    onError:   (e)   => {
      cnState.coop.error =
        e.type==='code-not-found' ? 'Raum nicht gefunden!'   :
        e.type==='room-full'      ? 'Raum ist voll!'         :
        e.type==='timeout'        ? 'Timeout — Private Relay? VPN ausschalten und nochmal versuchen.' :
        'Verbindungsfehler.';
    },
    onMessage: cnHandleCoopMsg,
    onClose:   () => { cnState.coop.phase='idle'; },
  });
}

// Host: Rolle eines Spielers setzen
export async function cnHostSetRole(uid, role) {
  const p = cnState.coop.players.find(p=>p.uid===uid);
  if (p) p.role = role;
  // Spieler informieren
  await Coop.sendTo(uid, { type:'CN_ASSIGNED_ROLE', role });
  // Eigene Rolle auch setzen wenn Host
  if (uid === cnState.coop.myUid) {
    cnState.coop.myRole = role;
    cnState.coop.myTeam = role?.includes('red') ? 'red' : 'blue';
  }
}

export async function cnStartCoopGame() {
  if (!cnState.coop.isHost) return;
  const { words, types, startingTeam } = createGrid(cnState.lang);
  const players = cnState.coop.players;

  // Zähler
  const redCount  = types.filter(t=>t===CN_TYPE.RED).length;
  const blueCount = types.filter(t=>t===CN_TYPE.BLUE).length;

  // Public Grid — alle Typen null (unbekannt)
  const publicGrid = words.map(c=>({ word:c.word, type:null, revealed:false }));
  // Secret Grid — Typen bekannt
  const secretGrid = words;

  // Host-State setzen
  cnState.words       = secretGrid; // Host sieht alles
  cnState.secretTypes = types;
  cnState.redCount    = redCount;
  cnState.blueCount   = blueCount;
  cnState.redLeft     = redCount;
  cnState.blueLeft    = blueCount;
  cnState.currentTeam = startingTeam;
  cnState.hint        = '';
  cnState.hintCount   = 0;
  cnState.guessesLeft = 0;
  cnState.phase2      = 'hint';
  cnState.winner      = null;
  cnState.showSecretMap = false;
  cnState.coop.phase  = 'playing';
  cnState.phase       = 'playing';

  // Spymaster-UIDs
  const spymasters = players.filter(p => p.role?.startsWith('spymaster'));

  // An alle: Public Grid
  await Coop.send({
    type:'CN_START', publicGrid, types,
    redCount, blueCount, startingTeam,
    players: players.map(p=>({ uid:p.uid, name:p.name, role:p.role }))
  });

  // An Spymasters: Secret Types
  for (const sm of spymasters) {
    if (sm.uid === cnState.coop.myUid) continue; // Host selbst schon gesetzt
    await Coop.sendTo(sm.uid, { type:'CN_SECRET', types });
  }
}

function cnHandleCoopMsg(msg) {
  if (!msg) return;

  if (msg.type === 'CN_ASSIGNED_ROLE') {
    cnState.coop.myRole = msg.role;
    cnState.coop.myTeam = msg.role?.includes('red') ? 'red' : 'blue';
    toast(`Deine Rolle: ${msg.role}`);
  }

  if (msg.type === 'CN_ROLE_UPDATE') {
    // Andere Spieler sehen Rollenvergabe in der Lobby
    const p = cnState.coop.players.find(p=>p.uid===msg.uid);
    if (p) p.role = msg.role;
  }

  if (msg.type === 'CN_START') {
    // Operatives: Public Grid (keine Typen)
    // Spymasters bekommen danach CN_SECRET
    cnState.words       = msg.publicGrid.map(c=>({...c}));
    cnState.secretTypes = []; // wird via CN_SECRET gefüllt
    cnState.redCount    = msg.redCount;
    cnState.blueCount   = msg.blueCount;
    cnState.redLeft     = msg.redCount;
    cnState.blueLeft    = msg.blueCount;
    cnState.currentTeam = startingTeam;
    cnState.hint        = '';
    cnState.hintCount   = 0;
    cnState.guessesLeft = 0;
    cnState.phase2      = 'hint';
    cnState.winner      = null;
    cnState.showSecretMap = false;
    cnState.coop.phase  = 'playing';
    cnState.phase       = 'playing';
    haptic('success');
  }

  if (msg.type === 'CN_SECRET') {
    // Spymaster: echte Typen laden
    cnState.secretTypes = msg.types;
    // Grid mit echten Typen anreichern (nur für Spymaster-Anzeige)
    msg.types.forEach((t,i) => {
      if (cnState.words[i]) cnState.words[i]._secretType = t;
    });
    toast('Du bist Spymaster — du siehst alle Karten!');
  }

  if (msg.type === 'CN_HINT') {
    if (msg.team !== cnState.currentTeam) return; // Sicherheit
    cnState.hint        = msg.hint;
    cnState.hintCount   = msg.count;
    cnState.guessesLeft = msg.count + 1;
    cnState.phase2      = 'guess';
    haptic('light');
    toast(`Hinweis: "${msg.hint}" (${msg.count})`);
  }

  if (msg.type === 'CN_REVEAL') {
    const card = cnState.words[msg.idx];
    if (card) {
      card.revealed = true;
      card.type     = msg.realType; // echter Typ für alle sichtbar
      cnProcessReveal(msg.idx, msg.realType);
    }
  }

  if (msg.type === 'CN_PASS') {
    cnState.currentTeam = msg.team;
    cnState.hint        = '';
    cnState.hintCount   = 0;
    cnState.guessesLeft = 0;
    cnState.phase2      = 'hint';
    haptic('light');
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
  const url = `${location.origin}${location.pathname}?cn=${cnState.coop.code}`;
  if (navigator.share) {
    try { await navigator.share({ title:'Codenames', text:`Code: ${cnState.coop.code}`, url }); return; }
    catch(e) { if(e.name==='AbortError') return; }
  }
  try { await navigator.clipboard.writeText(url); toast('Link kopiert!'); }
  catch { toast(url); }
}

// ── Template-Helfer ───────────────────────────────────────────────────────────
export function cnIsSpymaster() {
  return cnState.coop.myRole?.startsWith('spymaster') ?? false;
}
export function cnMyTeam() {
  return cnState.coop.myTeam;
}

// Farbe einer Karte für Template
// - Spymaster: sieht Farbe immer (via _secretType oder type)
// - Operative: sieht Farbe nur nach Aufdecken
export function cnCardColor(card) {
  if (card.revealed) return card.type || 'neutral';
  const isSpyOrHost = cnIsSpymaster() || (!cnState.coop.myRole && cnState.coop.isHost);
  if (isSpyOrHost || cnState.showSecretMap) {
    return card._secretType || card.type || 'neutral';
  }
  return 'hidden'; // Operative: keine Farbe
}
