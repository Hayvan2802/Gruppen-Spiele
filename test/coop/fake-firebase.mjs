// fake-firebase.mjs — In-Memory-Nachbau der Firebase-RTDB-API, die coop.js nutzt.
//
// Zweck: coop.js (der gemeinsame Coop-Transport ALLER Spiele) im Node-Test ohne
// echtes Firebase / ohne Browser fahren. Bildet genau die Semantik nach, auf die
// coop.js sich verlässt:
//   • ein GETEILTER Datenbaum für alle Clients (→ echtes Broadcast-Fan-out)
//   • onChildAdded feuert beim Anhängen auch für BEREITS vorhandene Kinder (RTDB-Replay)
//   • onChildChanged / onChildRemoved für Ready-Updates bzw. Verlassen
//   • push() erzeugt Event-Kinder, get() liefert exists()/size/val()
//
// Der Loader-Hook (firebase-hook.mjs) leitet jeden Import von ./firebase.js hierher
// um. Weil alle Clients dasselbe Fake-Modul laden, teilen sie sich `store` — jeder
// coop.js-Instanz bekommt aber per ensureFirebase() eine EIGENE uid.

const store = { root: {}, listeners: [], svClock: 1_000_000, onDisc: new Map() };
let uidCounter = 0;

// ── Pfad-Helfer ──────────────────────────────────────────────────────────────
function seg(path) { return path.split('/').filter(Boolean); }
function getNode(path) {
  let n = store.root;
  for (const s of seg(path)) { if (n == null || typeof n !== 'object') return undefined; n = n[s]; }
  return n;
}
function setNode(path, value) {
  const parts = seg(path);
  let n = store.root;
  for (let i = 0; i < parts.length - 1; i++) {
    if (typeof n[parts[i]] !== 'object' || n[parts[i]] == null) n[parts[i]] = {};
    n = n[parts[i]];
  }
  n[parts[parts.length - 1]] = value;
}
function removeNode(path) {
  const parts = seg(path);
  let n = store.root;
  for (let i = 0; i < parts.length - 1; i++) { if (n == null) return; n = n[parts[i]]; }
  if (n) delete n[parts[parts.length - 1]];
}
function parentOf(path) { const p = seg(path); return { parent: p.slice(0, -1).join('/'), key: p[p.length - 1] }; }

// serverTimestamp-Sentinels auflösen (rekursiv), damit Snapshots echte Zahlen liefern
function resolve(value) {
  if (value && typeof value === 'object') {
    if (value['.sv'] === 'timestamp') return store.svClock++;
    const out = Array.isArray(value) ? [] : {};
    for (const k of Object.keys(value)) out[k] = resolve(value[k]);
    return out;
  }
  return value;
}

// ── Listener-Dispatch (asynchron wie RTDB) ─────────────────────────────────────
function childSnap(key, val) { return { key, val: () => val }; }
function dispatch(parentPath, type, key, val) {
  for (const l of store.listeners.slice()) {
    if (l.path === parentPath && l.type === type) {
      const snap = childSnap(key, val);
      queueMicrotask(() => { if (store.listeners.includes(l)) l.cb(snap); });
    }
  }
}
function register(path, type, cb) {
  const l = { path, type, cb };
  store.listeners.push(l);
  return () => { const i = store.listeners.indexOf(l); if (i >= 0) store.listeners.splice(i, 1); };
}

// ── Firebase-API-Nachbau ───────────────────────────────────────────────────────
function ref(_db, path) { return { path }; }

function get({ path }) {
  const node = getNode(path);
  const isObj = node != null && typeof node === 'object';
  return Promise.resolve({
    exists: () => node !== undefined,
    size: isObj ? Object.keys(node).length : 0,
    val: () => node,
    key: parentOf(path).key,
    forEach: (fn) => { if (isObj) for (const k of Object.keys(node)) fn(childSnap(k, node[k])); },
  });
}

function set({ path }, value) {
  const resolved = resolve(value);
  const existed = getNode(path) !== undefined;
  setNode(path, resolved);
  const { parent, key } = parentOf(path);
  dispatch(parent, existed ? 'changed' : 'added', key, resolved);
  return Promise.resolve();
}

function push({ path }, value) {
  const resolved = resolve(value);
  const key = `evt_${store.svClock++}_${Math.random().toString(36).slice(2, 8)}`;
  setNode(`${path}/${key}`, resolved);
  dispatch(path, 'added', key, resolved);
  return Promise.resolve({ key });
}

function remove({ path }) {
  const node = getNode(path);
  // a) Kind einer beobachteten Collection entfernen (z. B. players/UID)
  const { parent, key } = parentOf(path);
  if (node !== undefined) dispatch(parent, 'removed', key, node);
  // b) ganze Collection entfernen → removed pro Kind (z. B. players zurücksetzen)
  if (node != null && typeof node === 'object') {
    for (const childKey of Object.keys(node)) dispatch(path, 'removed', childKey, node[childKey]);
  }
  removeNode(path);
  return Promise.resolve();
}

function fireExisting(path, cb) {
  const node = getNode(path);
  if (node != null && typeof node === 'object') {
    for (const k of Object.keys(node)) { const v = node[k]; queueMicrotask(() => cb(childSnap(k, v))); }
  }
}
function onChildAdded({ path }, cb) { fireExisting(path, cb); return register(path, 'added', cb); }   // RTDB-Replay
function onChildChanged({ path }, cb) { return register(path, 'changed', cb); }
function onChildRemoved({ path }, cb) { return register(path, 'removed', cb); }

// onDisconnect registriert eine Aktion für den VERBINDUNGSABBRUCH — sie darf
// jetzt NICHT ausgeführt werden (echtes Firebase feuert sie erst beim Disconnect).
function onDisconnect({ path }) {
  return {
    remove: () => { store.onDisc.set(path, 'remove'); return Promise.resolve(); },
    cancel: () => { store.onDisc.delete(path); return Promise.resolve(); },
  };
}

function serverTimestamp() { return { '.sv': 'timestamp' }; }

// coop.js ruft ensureFirebase() genau einmal pro Modul-Instanz → eine uid je Client.
export function ensureFirebase() {
  return Promise.resolve({
    db: store, uid: `uid-${++uidCounter}`,
    ref, get, set, push, remove,
    onChildAdded, onChildChanged, onChildRemoved,
    onDisconnect, serverTimestamp,
  });
}

// Test-Hilfen
export function __reset() { store.root = {}; store.listeners = []; store.svClock = 1_000_000; store.onDisc = new Map(); uidCounter = 0; }
export function __store() { return store; }
// Verbindungsabbruch simulieren: registrierte onDisconnect-Aktion für path ausführen
export function __disconnect(path) {
  if (store.onDisc.get(path) === 'remove') { store.onDisc.delete(path); return remove({ path }); }
  return Promise.resolve();
}
