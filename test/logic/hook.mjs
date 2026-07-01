// hook.mjs — ESM-Loader-Resolve-Hook für die Logik-/Paritätstests.
// Leitet Browser-Abhängigkeiten auf Node-taugliche Stubs um, damit die ECHTEN
// Spielmodule (codenames.js, werbinich.js) importiert und getestet werden können:
//   • vue.esm-browser.prod.js → vue-shim.mjs (reactive/computed-Stubs)
//   • firebase.js             → ../coop/fake-firebase.mjs (In-Memory-RTDB)
const VUE  = new URL('./vue-shim.mjs', import.meta.url).href;
const FAKE = new URL('../coop/fake-firebase.mjs', import.meta.url).href;

export async function resolve(specifier, context, nextResolve) {
  if (/vue\.esm-browser\.prod\.js(\?|$)/.test(specifier)) return { url: VUE, shortCircuit: true };
  if (/(^|\/)firebase\.js(\?|$)/.test(specifier))          return { url: FAKE, shortCircuit: true };
  return nextResolve(specifier, context);
}
