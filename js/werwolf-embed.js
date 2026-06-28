// werwolf-embed.js — bettet die Werwolf-App nahtlos in Gruppen-Spiele ein.
//
// Werwolf ist eine vollständige eigene Vue-App. Statt sie als zweite Seite zu
// laden (Reload + langer Ladevorgang), mounten wir sie als EIGENE Vue-Instanz
// in ein Shadow-DOM-Element:
//   • Shadow-DOM kapselt das komplette Werwolf-CSS ab → keine Kollision mit den
//     ~187 gleichnamigen Klassen der Haupt-App (.btn, .screen, .top-bar …).
//   • Eigene Vue-Instanz → keine Namens-Kollisionen im JS.
//   • Nach dem ersten Mounten bleibt die App im Speicher (nur ein-/ausgeblendet)
//     → Wechsel hin und zurück ist danach sofort, ohne Reload.

let mounted = false;
let mountPromise = null;

// Bettet Werwolf einmalig in den übergebenen Host ein. Mehrfachaufrufe sind
// unschädlich (idempotent) — nützlich fürs Vorwärmen im Hintergrund.
export function ensureWerwolf(host) {
  if (mounted) return mountPromise;
  mounted = true;
  mountPromise = (async () => {
    // Signal an werwolf/js/app.js: nicht selbst auf #app mounten.
    window.__WW_EMBEDDED__ = true;

    const shadow = host.attachShadow({ mode: 'open' });

    // Werwolf-Styles (für Shadow-DOM auf .ww-root umgeschrieben) laden.
    // Als <style> mit gefetchtem Text injizieren statt <link>: wird sofort und
    // zuverlässig im Shadow-DOM angewandt und behält den @import der Schriftarten
    // (den konstruierte Stylesheets verwerfen würden).
    const cssHref = './werwolf/css/styles.shadow.css';
    try {
      const css = await fetch(cssHref).then(r => r.ok ? r.text() : Promise.reject(r.status));
      const style = document.createElement('style');
      style.textContent = css;
      shadow.appendChild(style);
    } catch (e) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = cssHref;
      shadow.appendChild(link);
    }

    // Wurzel-Element: trägt Theme-Klasse + Hintergrund, füllt den Host.
    const root = document.createElement('div');
    root.className = 'ww-root';
    shadow.appendChild(root);

    // Werwolf-App laden und in die Shadow-Wurzel mounten (eigene Vue-Instanz).
    const mod = await import('../werwolf/js/app.js');
    mod.setWwRoot(root);
    mod.mountWerwolf(root);
  })();
  return mountPromise;
}
