// qrcode.js — Minimaler QR-Code-Generator (reines Vanilla-JS, keine Abhängigkeit).
//
// Bewusst klein gehalten und nur so mächtig wie hier gebraucht (Einladungs-Links):
//   • Byte-Modus (UTF-8), Fehlerkorrektur-Level L, Version 1–5 (bis 106 Bytes)
//   • feste Maske 0 — jede gültige Maske ist per Spezifikation dekodierbar;
//     die Masken-Optimierung dient nur der Lesbarkeit bei schwierigen Mustern
//   • ein Fehlerkorrektur-Block (gilt für Version 1–5 bei Level L)
// Ausgabe: SVG-String (skaliert verlustfrei, kein Canvas nötig).

// ── GF(256)-Arithmetik (Polynom 0x11D) für Reed-Solomon ──────────────────────
const GF_EXP = new Array(512);
const GF_LOG = new Array(256);
(function initGf() {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    GF_EXP[i] = x;
    GF_LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) GF_EXP[i] = GF_EXP[i - 255];
})();

export function gfMul(a, b) {
  if (a === 0 || b === 0) return 0;
  return GF_EXP[GF_LOG[a] + GF_LOG[b]];
}

// Generator-Polynom für n Fehlerkorrektur-Codewörter: ∏ (x − α^i), i = 0…n−1
function rsGeneratorPoly(n) {
  let poly = [1];
  for (let i = 0; i < n; i++) {
    const next = new Array(poly.length + 1).fill(0);
    for (let j = 0; j < poly.length; j++) {
      next[j] ^= gfMul(poly[j], GF_EXP[i]);
      next[j + 1] ^= poly[j];
    }
    poly = next;
  }
  return poly.reverse(); // absteigende Potenzen, poly[0] = 1
}

// Rest der Polynomdivision (Daten·x^n mod Generator) → n EC-Codewörter
export function rsRemainder(data, n) {
  const gen = rsGeneratorPoly(n);
  const res = data.concat(new Array(n).fill(0));
  for (let i = 0; i < data.length; i++) {
    const factor = res[i];
    if (factor === 0) continue;
    for (let j = 1; j < gen.length; j++) {
      res[i + j] ^= gfMul(gen[j], factor);
    }
  }
  return res.slice(data.length);
}

// ── Versions-Tabellen (Fehlerkorrektur-Level L, 1 Block) ─────────────────────
const DATA_CODEWORDS = [0, 19, 34, 55, 80, 108]; // Index = Version
const EC_CODEWORDS   = [0, 7, 10, 15, 20, 26];
const MAX_VERSION    = 5;

// Format-Info für Level L + Maske 0 (BCH-kodiert, per Spezifikation konstant)
const FORMAT_BITS_L_MASK0 = 0x77c4; // 111011111000100

// ── Matrix bauen ──────────────────────────────────────────────────────────────
export function qrMatrix(text) {
  const bytes = new TextEncoder().encode(text);

  // Kleinste passende Version (Byte-Modus-Header: 4 Bit Modus + 8 Bit Länge)
  let version = 0;
  for (let v = 1; v <= MAX_VERSION; v++) {
    if (bytes.length <= DATA_CODEWORDS[v] - 2) { version = v; break; }
  }
  if (!version) throw new Error(`QR: Text zu lang (${bytes.length} Bytes, max ${DATA_CODEWORDS[MAX_VERSION] - 2})`);

  // Daten-Bitstrom: Modus 0100 + Länge (8 Bit) + Daten + Terminator + Padding
  const bits = [];
  const pushBits = (val, len) => { for (let i = len - 1; i >= 0; i--) bits.push((val >> i) & 1); };
  pushBits(0b0100, 4);
  pushBits(bytes.length, 8);
  bytes.forEach(b => pushBits(b, 8));
  const capacityBits = DATA_CODEWORDS[version] * 8;
  pushBits(0, Math.min(4, capacityBits - bits.length));          // Terminator
  while (bits.length % 8 !== 0) bits.push(0);                    // Byte-Grenze
  const padBytes = [0xec, 0x11];
  for (let i = 0; bits.length < capacityBits; i++) pushBits(padBytes[i % 2], 8);

  const dataCw = [];
  for (let i = 0; i < bits.length; i += 8) {
    dataCw.push(parseInt(bits.slice(i, i + 8).join(''), 2));
  }
  const allCw = dataCw.concat(rsRemainder(dataCw, EC_CODEWORDS[version]));

  // Matrix + Funktionsmodul-Maske
  const size = 17 + 4 * version;
  const m = Array.from({ length: size }, () => new Array(size).fill(0));
  const isFn = Array.from({ length: size }, () => new Array(size).fill(false));
  const set = (x, y, dark) => { m[y][x] = dark ? 1 : 0; isFn[y][x] = true; };

  // Sucher-Muster (3×) inkl. weißem Trennrand
  const finder = (fx, fy) => {
    for (let dy = -1; dy <= 7; dy++) for (let dx = -1; dx <= 7; dx++) {
      const x = fx + dx, y = fy + dy;
      if (x < 0 || y < 0 || x >= size || y >= size) continue;
      const inRing = dx >= 0 && dx <= 6 && dy >= 0 && dy <= 6 &&
        !(dx >= 1 && dx <= 5 && dy >= 1 && dy <= 5 && !(dx >= 2 && dx <= 4 && dy >= 2 && dy <= 4));
      const inCore = dx >= 2 && dx <= 4 && dy >= 2 && dy <= 4;
      set(x, y, inRing || inCore);
    }
  };
  finder(0, 0); finder(size - 7, 0); finder(0, size - 7);

  // Timing-Muster
  for (let i = 8; i < size - 8; i++) {
    if (!isFn[6][i]) set(i, 6, i % 2 === 0);
    if (!isFn[i][6]) set(6, i, i % 2 === 0);
  }

  // Ausrichtungs-Muster (Version 2–5: genau eines bei (p,p), p = 4·Version + 10)
  if (version >= 2) {
    const p = 4 * version + 10;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      set(p + dx, p + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
    }
  }

  // Format-Info (beide Kopien) + dunkles Modul
  const f = FORMAT_BITS_L_MASK0;
  const fbit = (i) => (f >> i) & 1;
  for (let i = 0; i <= 5; i++) set(8, i, fbit(i));
  set(8, 7, fbit(6)); set(8, 8, fbit(7)); set(7, 8, fbit(8));
  for (let i = 9; i <= 14; i++) set(14 - i, 8, fbit(i));
  for (let i = 0; i <= 7; i++) set(size - 1 - i, 8, fbit(i));
  for (let i = 8; i <= 14; i++) set(8, size - 15 + i, fbit(i));
  set(8, size - 8, true); // dunkles Modul

  // Daten im Zickzack platzieren (Maske 0: (x+y) gerade → invertieren)
  const stream = [];
  allCw.forEach(cw => { for (let i = 7; i >= 0; i--) stream.push((cw >> i) & 1); });
  let k = 0;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < size; vert++) {
      for (let j = 0; j < 2; j++) {
        const x = right - j;
        const upward = ((right + 1) & 2) === 0;
        const y = upward ? size - 1 - vert : vert;
        if (!isFn[y][x] && k < stream.length) {
          m[y][x] = stream[k] ^ ((x + y) % 2 === 0 ? 1 : 0);
          k++;
        }
      }
    }
  }
  return m;
}

// ── SVG-Ausgabe (mit 4 Modulen Ruhezone, skaliert über CSS) ───────────────────
export function qrSvg(text) {
  const m = qrMatrix(text);
  const n = m.length, quiet = 4, total = n + quiet * 2;
  let rects = '';
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      if (m[y][x]) rects += `<rect x="${x + quiet}" y="${y + quiet}" width="1" height="1"/>`;
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" shape-rendering="crispEdges">` +
    `<rect width="${total}" height="${total}" fill="#fff"/><g fill="#000">${rects}</g></svg>`;
}
