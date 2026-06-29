// coop.js — Echtzeit-Coop-Transport via Firebase Realtime Database (RTDB).
// Struktur: /rooms/{6-stelliger-code}/meta + players + events
// Exakt nach coop-number-sums Pattern (tomanderss/coop-number-sums).
import { log } from './debuglog.js';
import { COOP_MAX_PLAYERS } from './config.js';

let fb = null;
let roomCode = null;
let myPlayerRef = null;
let unsubJoin = null;
let unsubLeave = null;
let unsubEvents = null;

export function isAvailable() { return typeof window !== 'undefined' && typeof fetch !== 'undefined'; }

async function ensureDb() {
  if (!fb) {
    log('coop', 'Verbinde mit Firebase…');
    const { ensureFirebase } = await import('./firebase.js');
    fb = await ensureFirebase();
    log('coop', 'Firebase verbunden', { uid: fb.uid });
  }
  return fb;
}

const TIMEOUT_MS = 20000; // Erhöht für iCloud Private Relay (blockiert manchmal WebSocket)
function withTimeout(promise) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject({ type: 'timeout' }), TIMEOUT_MS)),
  ]);
}

function attachListeners(f, code, { onJoin, onLeave, onMessage }) {
  unsubJoin && unsubJoin();
  unsubLeave && unsubLeave();
  unsubEvents && unsubEvents();

  const playersRef = f.ref(f.db, `rooms/${code}/players`);
  const eventsRef  = f.ref(f.db, `rooms/${code}/events`);

  unsubJoin = f.onChildAdded(playersRef, (snap) => {
    if (snap.key === f.uid) return;
    onJoin && onJoin(snap.key, snap.val());
  });
  // Ready-Status-Änderungen
  f.onChildChanged(playersRef, (snap) => {
    if (snap.key === f.uid) return;
    onJoin && onJoin(snap.key, snap.val()); // reuse onJoin for updates
  });
  unsubLeave = f.onChildRemoved(playersRef, (snap) => {
    if (snap.key === f.uid) return;
    onLeave && onLeave(snap.key);
  });
  unsubEvents = f.onChildAdded(eventsRef, (snap) => {
    const msg = snap.val();
    if (!msg || msg.author === f.uid) return;
    onMessage && onMessage(msg);
  });
}

// ─── HOST ─────────────────────────────────────────────────────────────────────
// players/$uid braucht name + role + joinedAt (RTDB-Rules validieren das)
export async function hostGame({ code, name, onOpen, onError, onJoin, onLeave, onMessage }) {
  try {
    const f = await ensureDb();
    log('coop', `Hoste Raum ${code}…`);
    const playersSnap = await withTimeout(f.get(f.ref(f.db, `rooms/${code}/players`)));
    if (playersSnap.exists() && playersSnap.size > 0) {
      // Prüfen ob wir selbst der frühere Host waren — dann abgelaufenen Raum übernehmen
      const metaSnap = await f.get(f.ref(f.db, `rooms/${code}/meta`));
      if (metaSnap.exists() && metaSnap.val().hostId === f.uid) {
        log('coop', `Code ${code}: eigener alter Raum — wird zurückgesetzt`);
        await f.remove(f.ref(f.db, `rooms/${code}/players`));
      } else {
        log('coop', `Code ${code} bereits belegt`);
        onError && onError({ type: 'code-taken' });
        return;
      }
    }
    roomCode = code;
    await f.remove(f.ref(f.db, `rooms/${code}/events`));
    await f.set(f.ref(f.db, `rooms/${code}/meta`), {
      hostId: f.uid, createdAt: f.serverTimestamp(), status: 'open'
    });
    myPlayerRef = f.ref(f.db, `rooms/${code}/players/${f.uid}`);
    await f.set(myPlayerRef, { name, color: '#c9a84c', role: 'host', joinedAt: f.serverTimestamp() });
    f.onDisconnect(myPlayerRef).remove();
    attachListeners(f, code, { onJoin, onLeave, onMessage });
    log('coop', `Raum ${code} gehostet`, { uid: f.uid });
    onOpen && onOpen(f.uid);
  } catch (e) {
    log('coop', `Hosten fehlgeschlagen`, e);
    onError && onError(e);
  }
}

// ─── GAST ─────────────────────────────────────────────────────────────────────
export async function joinGame({ code, name, onOpen, onError, onMessage, onClose }) {
  try {
    const f = await ensureDb();
    log('coop', `Trete Raum ${code} bei…`);
    const playersSnap = await withTimeout(f.get(f.ref(f.db, `rooms/${code}/players`)));
    if (!playersSnap.exists() || playersSnap.size === 0) {
      log('coop', `Code ${code} nicht gefunden`);
      onError && onError({ type: 'code-not-found' });
      return;
    }
    if (playersSnap.size >= COOP_MAX_PLAYERS) {
      onError && onError({ type: 'room-full' });
      return;
    }
    roomCode = code;
    myPlayerRef = f.ref(f.db, `rooms/${code}/players/${f.uid}`);
    await f.set(myPlayerRef, { name, color: '#6b7fd4', role: 'guest', joinedAt: f.serverTimestamp() });
    f.onDisconnect(myPlayerRef).remove();
    attachListeners(f, code, { onJoin: null, onLeave: (id) => onClose && onClose(id), onMessage });
    log('coop', `Raum ${code} beigetreten`, { uid: f.uid });
    onOpen && onOpen(f.uid);
  } catch (e) {
    log('coop', `Beitreten fehlgeschlagen`, e);
    onError && onError(e);
  }
}

// ─── NACHRICHTEN ─────────────────────────────────────────────────────────────
export async function send(msg) {
  if (!fb || !roomCode) return;
  try {
    await fb.push(fb.ref(fb.db, `rooms/${roomCode}/events`), {
      ...msg, author: fb.uid, ts: fb.serverTimestamp()
    });
  } catch (e) {
    log('coop', `Senden von "${msg.type}" fehlgeschlagen`, e);
  }
}

// ─── VERLASSEN ───────────────────────────────────────────────────────────────
export async function leave() {
  const f = fb, code = roomCode, playerRef = myPlayerRef;
  unsubJoin && unsubJoin();
  unsubLeave && unsubLeave();
  unsubEvents && unsubEvents();
  unsubJoin = unsubLeave = unsubEvents = null;
  roomCode = null; myPlayerRef = null;
  if (!f || !playerRef) return;
  try {
    await f.onDisconnect(playerRef).cancel();
    await f.remove(playerRef);
    const playersSnap = await f.get(f.ref(f.db, `rooms/${code}/players`));
    if (!playersSnap.exists() || playersSnap.size === 0) {
      await f.remove(f.ref(f.db, `rooms/${code}`));
    }
  } catch (e) {
    log('coop', `Verlassen fehlgeschlagen`, e);
  }
}

export function getUid() { return fb ? fb.uid : null; }

// Firebase-Verbindung zurücksetzen — nächster Verbindungsversuch initialisiert neu
export function resetFb() { fb = null; }

// Nachrichten-Typen
export const MSG = {
  START:             'start',             // Host → alle: Rollenzuteilungen
  READY:             'ready',             // Spieler → Host: Bereitschaft
  RESULT:            'result',            // Host → alle: Spielergebnis

  // Karten-Bestätigung
  CARD_CONFIRMED:    'card_confirmed',    // Spieler → alle: Karte gesehen & bestätigt
  DISCUSSION_START:  'discussion_start',  // Host → alle: Diskussionsphase startet (Timer)

  // Post-Timer-Abstimmung
  POST_TIMER_VOTE:   'post_timer_vote',   // Spieler → alle: 'extend' | 'vote'
  POST_TIMER_RESULT: 'post_timer_result', // Host → alle: Ergebnis der Post-Timer-Wahl

  // Tagesphase — Abstimmung
  VOTE_START:        'vote_start',        // Host → alle: Abstimmung beginnt (candidates[])
  VOTE_CAST:         'vote_cast',         // Spieler → Host: Stimme (targetName)
  VOTE_PROGRESS:     'vote_progress',     // Host → alle: Fortschritt (count, total, voterNames)
  VOTE_RESULT:       'vote_result',       // Host → alle: Ergebnis (eliminated, votes{})

  // Timer überspringen (nur Host)
  TIMER_SKIP:        'timer_skip',

  // Nachtphase — Aktionen auf eigenem Gerät
  NIGHT_START:       'night_start',       // Host → alle: Nacht beginnt (round)
  NIGHT_REQUEST:     'night_request',     // Host → Rolle: Deine Aktion (roleId, targets[])
  NIGHT_SUBMIT:      'night_submit',      // Spieler → Host: Aktion (roleId, targetName)
  NIGHT_DONE:        'night_done',        // Host → alle: Nacht vorbei, Ergebnis (deaths[])
};

// Sende an spezifischen Spieler (über ein geteiltes Event mit uid-Filter)
export async function sendTo(uid, msg) {
  await send({ ...msg, targetUid: uid });
}

