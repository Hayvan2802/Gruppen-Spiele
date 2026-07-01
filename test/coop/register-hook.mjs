// register-hook.mjs — Preload für die Coop-Tests (via `node --import`).
// Registriert den Loader-Hook (firebase.js → Fake) VOR dem Laden der Testmodule
// und stellt einen localStorage-Stub bereit (debuglog.js nutzt ihn).
import { register } from 'node:module';

register('./firebase-hook.mjs', import.meta.url);

globalThis.localStorage ??= {
  _s: new Map(),
  getItem(k) { return this._s.has(k) ? this._s.get(k) : null; },
  setItem(k, v) { this._s.set(k, String(v)); },
  removeItem(k) { this._s.delete(k); },
};
