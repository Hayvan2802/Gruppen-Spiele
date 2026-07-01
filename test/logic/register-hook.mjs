// register-hook.mjs — Preload für die Logik-/Paritätstests (via `node --import`).
// Registriert den Loader-Hook (vue/firebase → Stubs) und stellt die Browser-
// Globals bereit, die die Spielmodule zur Laufzeit anfassen (haptic/showToast).
import { register } from 'node:module';

register('./hook.mjs', import.meta.url);

globalThis.localStorage ??= {
  _s: new Map(),
  getItem(k) { return this._s.has(k) ? this._s.get(k) : null; },
  setItem(k, v) { this._s.set(k, String(v)); },
  removeItem(k) { this._s.delete(k); },
};
globalThis.navigator ??= {}; // haptic() prüft navigator.vibrate (nicht vorhanden → no-op)
globalThis.document ??= {     // showToast() greift auf document zu
  getElementById: () => null,
  createElement: () => ({ style: {}, classList: { add() {}, remove() {} }, appendChild() {} }),
  body: { appendChild() {} },
};
