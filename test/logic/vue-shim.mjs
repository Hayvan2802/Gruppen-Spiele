// vue-shim.mjs — Minimaler Ersatz für vue.esm-browser.prod.js in Node-Tests.
// Wir testen reine Spiellogik (kein Rendering), daher genügen einfache Stubs:
// reactive = Objekt unverändert durchreichen, computed/ref = .value-Wrapper.
export const reactive = (o) => o;
export const ref = (v) => ({ value: v });
export const computed = (fn) => ({ get value() { return fn(); } });
export const watch = () => () => {};
export const watchEffect = (fn) => { try { fn(); } catch {} return () => {}; };
export const nextTick = (fn) => Promise.resolve().then(fn);
export const createApp = () => ({ mount() {}, unmount() {}, use() { return this; }, component() { return this; }, directive() { return this; } });
export default { reactive, ref, computed, watch, watchEffect, nextTick, createApp };
