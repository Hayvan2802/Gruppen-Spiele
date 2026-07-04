// scope-werwolf-css.mjs — erzeugt eine unter .wwapp isolierte Variante des
// Werwolf-CSS, damit es OHNE Shadow-DOM in die Haupt-App eingebettet werden kann
// (Werwolf ist eine normale Vue-Komponente der Haupt-App).
//
// Werwolf und Gruppen-Spiele teilen ~187 gleichnamige Klassen (.btn, .modal …).
// Statt Shadow-DOM kapseln wir das Werwolf-CSS per Nachfahren-Selektor: jede
// Regel bekommt `.wwapp ` vorangestellt, globale Selektoren (:root/html/body)
// werden auf `.wwapp` umgeschrieben. Da das Werwolf-Wurzelelement `class="wwapp"`
// trägt, gewinnt `.wwapp .btn` (Spezifität 0,2,0) im Werwolf-Teilbaum immer
// gegen die `.btn` (0,1,0) der Haupt-App.
//
// Aufruf: node scripts/scope-werwolf-css.mjs
// Eingabe:  js/games/werwolf/css/styles.css
// Ausgabe:  js/games/werwolf/css/styles.scoped.css   (eingecheckt, kein Build)

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'js/games/werwolf/css/styles.css');
const OUT = join(ROOT, 'js/games/werwolf/css/styles.scoped.css');
const SCOPE = '.wwapp';

// Einen einzelnen Selektor auf .wwapp umschreiben.
function scopeSelector(sel) {
  sel = sel.trim();
  if (!sel) return sel;
  if (sel === '*') return `${SCOPE},${SCOPE} *`;
  if (sel === ':root') return SCOPE;
  // body.light … → .wwapp.light …
  if (sel === 'body.light') return `${SCOPE}.light`;
  if (sel.startsWith('body.light ')) return `${SCOPE}.light ${sel.slice('body.light '.length)}`;
  // html / body als Wurzel → .wwapp (evtl. mit Rest als Nachfahre)
  if (sel === 'html' || sel === 'body') return SCOPE;
  if (sel.startsWith('body ')) return `${SCOPE} ${sel.slice('body '.length)}`;
  if (sel.startsWith('html ')) return `${SCOPE} ${sel.slice('html '.length)}`;
  // alles andere: als Nachfahre von .wwapp
  return `${SCOPE} ${sel}`;
}

function scopePrelude(prelude) {
  const parts = prelude.split(',').map(scopeSelector);
  // Duplikate zusammenfassen (html,body → beide .wwapp)
  return [...new Set(parts)].join(',');
}

// Balancierten { … }-Block ab Position i (i zeigt auf '{') lesen → { body, end }.
function readBlock(css, i) {
  let depth = 0, j = i;
  for (; j < css.length; j++) {
    const c = css[j];
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) { j++; break; } }
    else if (c === '/' && css[j + 1] === '*') { const e = css.indexOf('*/', j + 2); j = e < 0 ? css.length : e + 1; }
  }
  return { body: css.slice(i + 1, j - 1), end: j };
}

function transform(css) {
  let out = '';
  let i = 0;
  const n = css.length;
  while (i < n) {
    const c = css[i];
    // Kommentar durchreichen
    if (c === '/' && css[i + 1] === '*') {
      const e = css.indexOf('*/', i + 2);
      const end = e < 0 ? n : e + 2;
      out += css.slice(i, end); i = end; continue;
    }
    // Whitespace durchreichen
    if (/\s/.test(c)) { out += c; i++; continue; }

    // Prelude bis '{' oder ';' lesen (Kommentare überspringen)
    let j = i, prelude = '';
    while (j < n) {
      const cc = css[j];
      if (cc === '/' && css[j + 1] === '*') { const e = css.indexOf('*/', j + 2); j = e < 0 ? n : e + 2; continue; }
      if (cc === '{' || cc === ';') break;
      prelude += cc; j++;
    }
    if (j >= n) { out += css.slice(i); break; }

    if (css[j] === ';') {
      // At-Statement ohne Block (z.B. @import) → unverändert
      out += css.slice(i, j + 1); i = j + 1; continue;
    }

    // Block-Regel
    const { body, end } = readBlock(css, j);
    const trimmed = prelude.trim();
    if (/^@(keyframes|-webkit-keyframes|font-face|page)/i.test(trimmed)) {
      // Keyframes/Font-Face: komplett unverändert lassen
      out += css.slice(i, end);
    } else if (/^@(media|supports|container|layer)/i.test(trimmed)) {
      // Verschachtelt: Prelude behalten, Inhalt rekursiv scopen
      out += prelude + '{' + transform(body) + '}';
    } else {
      // Normale Style-Regel: Selektoren scopen
      out += scopePrelude(trimmed) + '{' + body + '}';
    }
    i = end;
  }
  return out;
}

const src = readFileSync(SRC, 'utf8');
const header = `/* AUTO-GENERIERT von scripts/scope-werwolf-css.mjs — nicht manuell editieren.\n` +
  `   Quelle: css/styles.css. Alle Selektoren sind unter .wwapp isoliert, damit\n` +
  `   Werwolf ohne Shadow-DOM als Vue-Komponente der Haupt-App laufen kann. */\n`;
writeFileSync(OUT, header + transform(src));
console.log('geschrieben:', OUT);
