// firebase-hook.mjs — ESM-Loader-Resolve-Hook für die Coop-Tests.
// Leitet jeden Import von js/firebase.js (egal mit welchem ?query-Cache-Buster)
// auf den In-Memory-Fake um, damit coop.js ohne echtes Firebase / ohne Browser läuft.
const FAKE = new URL('./fake-firebase.mjs', import.meta.url).href;

export async function resolve(specifier, context, nextResolve) {
  if (/(^|\/)firebase\.js(\?|$)/.test(specifier)) {
    return { url: FAKE, shortCircuit: true };
  }
  return nextResolve(specifier, context);
}
