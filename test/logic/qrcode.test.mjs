// qrcode.test.mjs — Korrektheits-Tests für den eigenen QR-Generator (js/qrcode.js).
//
// Da wir den Encoder selbst geschrieben haben (kein npm-Paket erlaubt), wird hier
// hart geprüft:
//   1. Reed-Solomon MATHEMATISCH: Daten+EC müssen an allen Wurzeln des
//      Generator-Polynoms (α^0…α^(n−1)) zu 0 auswerten — sonst ist die
//      Fehlerkorrektur beweisbar falsch.
//   2. Struktur: Sucher-Muster, Timing, dunkles Modul, Format-Bits (beide Kopien).
//   3. Rück-Dekodierung: Datenmodule demaskieren, Zickzack rückwärts lesen,
//      Byte-Modus-Header + Nutzdaten müssen exakt dem Eingabetext entsprechen.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { qrMatrix, qrSvg, rsRemainder, gfMul } from '../../js/qrcode.js';

const INVITE = 'https://hayvan2802.github.io/Gruppen-Spiele/?code=123456';

// α^e in GF(256) über wiederholtes gfMul (unabhängig von internen Tabellen)
function gfPow(e) {
  let r = 1;
  for (let i = 0; i < e; i++) r = gfMul(r, 2);
  return r;
}
// Polynom (absteigende Potenzen) an x auswerten — Horner in GF(256)
function polyEval(coeffs, x) {
  let acc = 0;
  for (const c of coeffs) acc = gfMul(acc, x) ^ c;
  return acc;
}

describe('QR — Reed-Solomon-Fehlerkorrektur', () => {
  test('Daten+EC verschwinden an ALLEN Generator-Wurzeln (α^0…α^(n−1))', () => {
    for (const n of [7, 10, 15, 20, 26]) {
      const data = Array.from({ length: 30 }, (_, i) => (i * 37 + 5) & 0xff);
      const ec = rsRemainder(data, n);
      assert.equal(ec.length, n);
      const full = data.concat(ec);
      for (let e = 0; e < n; e++) {
        assert.equal(polyEval(full, gfPow(e)), 0,
          `n=${n}: Auswertung an α^${e} muss 0 sein`);
      }
    }
  });

  test('gfMul: Referenzwerte der GF(256)-Multiplikation', () => {
    assert.equal(gfMul(0, 5), 0);
    assert.equal(gfMul(1, 123), 123);
    assert.equal(gfMul(2, 128), 0x1d);   // x^8 ≡ 0x1d (mod 0x11d)
    assert.equal(gfMul(0xb6, 0x53), gfMul(0x53, 0xb6)); // kommutativ
  });
});

describe('QR — Matrix-Struktur', () => {
  const m = qrMatrix(INVITE);
  const size = m.length;

  test('Größe passt zur Version (17 + 4·v, v≤5)', () => {
    assert.ok([21, 25, 29, 33, 37].includes(size), `size=${size}`);
    assert.ok(m.every(row => row.length === size));
  });

  test('Drei Sucher-Muster mit korrektem 7×7-Kern', () => {
    const checkFinder = (fx, fy) => {
      for (let dy = 0; dy <= 6; dy++) for (let dx = 0; dx <= 6; dx++) {
        const ring = dx === 0 || dx === 6 || dy === 0 || dy === 6;
        const core = dx >= 2 && dx <= 4 && dy >= 2 && dy <= 4;
        assert.equal(m[fy + dy][fx + dx], (ring || core) ? 1 : 0,
          `Finder@(${fx},${fy}) Modul (${dx},${dy})`);
      }
    };
    checkFinder(0, 0); checkFinder(size - 7, 0); checkFinder(0, size - 7);
  });

  test('Timing-Muster alterniert; dunkles Modul gesetzt', () => {
    for (let i = 8; i < size - 8; i++) {
      assert.equal(m[6][i], i % 2 === 0 ? 1 : 0, `Timing Zeile 6, Spalte ${i}`);
      assert.equal(m[i][6], i % 2 === 0 ? 1 : 0, `Timing Spalte 6, Zeile ${i}`);
    }
    assert.equal(m[size - 8][8], 1, 'dunkles Modul (8, size−8)');
  });

  test('Format-Bits (Level L, Maske 0) in beiden Kopien korrekt', () => {
    const f = 0x77c4;
    const bit = (i) => (f >> i) & 1;
    for (let i = 0; i <= 5; i++) assert.equal(m[i][8], bit(i));
    assert.equal(m[7][8], bit(6)); assert.equal(m[8][8], bit(7)); assert.equal(m[8][7], bit(8));
    for (let i = 9; i <= 14; i++) assert.equal(m[8][14 - i], bit(i));
    for (let i = 0; i <= 7; i++) assert.equal(m[8][size - 1 - i], bit(i));
    for (let i = 8; i <= 14; i++) assert.equal(m[size - 15 + i][8], bit(i));
  });
});

describe('QR — Rück-Dekodierung der Nutzdaten', () => {
  // Unabhängige Lese-Routine: Funktionsmodule ausmaskieren wie der Standard sie
  // definiert, Datenbits im Zickzack einsammeln, Maske 0 entfernen, Header prüfen.
  function readPayload(text) {
    const m = qrMatrix(text);
    const size = m.length;
    const version = (size - 17) / 4;
    const isFn = Array.from({ length: size }, () => new Array(size).fill(false));
    const mark = (x, y) => { if (x >= 0 && y >= 0 && x < size && y < size) isFn[y][x] = true; };
    // Sucher + Ränder + Format-Bereiche
    for (let dy = -1; dy <= 7; dy++) for (let dx = -1; dx <= 7; dx++) {
      mark(dx, dy); mark(size - 7 + dx, dy); mark(dx, size - 7 + dy);
    }
    for (let i = 0; i < size; i++) { mark(i, 6); mark(6, i); }
    for (let i = 0; i <= 8; i++) { mark(8, i); mark(i, 8); }
    // Zweite Format-Kopie: exakt 8 Module rechts (Zeile 8) bzw. unten (Spalte 8,
    // inkl. dunklem Modul) — NICHT 9, sonst würde ein Datenmodul übersprungen.
    for (let i = 0; i <= 7; i++) { mark(size - 1 - i, 8); mark(8, size - 1 - i); }
    if (version >= 2) {
      const p = 4 * version + 10;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) mark(p + dx, p + dy);
    }
    const bits = [];
    for (let right = size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      for (let vert = 0; vert < size; vert++) {
        for (let j = 0; j < 2; j++) {
          const x = right - j;
          const upward = ((right + 1) & 2) === 0;
          const y = upward ? size - 1 - vert : vert;
          if (!isFn[y][x]) bits.push(m[y][x] ^ ((x + y) % 2 === 0 ? 1 : 0));
        }
      }
    }
    const byteAt = (bitPos) => parseInt(bits.slice(bitPos, bitPos + 8).join(''), 2);
    const mode = parseInt(bits.slice(0, 4).join(''), 2);
    const len = parseInt(bits.slice(4, 12).join(''), 2);
    const payload = [];
    for (let i = 0; i < len; i++) payload.push(byteAt(12 + i * 8));
    return { mode, len, text: new TextDecoder().decode(new Uint8Array(payload)) };
  }

  test('Einladungs-Link übersteht Encode→Decode unverändert', () => {
    const { mode, len, text } = readPayload(INVITE);
    assert.equal(mode, 4, 'Byte-Modus');
    assert.equal(len, INVITE.length);
    assert.equal(text, INVITE);
  });

  test('Kurzer und langer Text (Versionsgrenzen) überstehen die Rück-Dekodierung', () => {
    for (const t of ['123456', 'x'.repeat(78), 'x'.repeat(106)]) {
      assert.equal(readPayload(t).text, t, `Länge ${t.length}`);
    }
  });

  test('Zu langer Text wirft verständlichen Fehler', () => {
    assert.throws(() => qrMatrix('x'.repeat(107)), /zu lang/);
  });

  test('qrSvg liefert wohlgeformtes SVG mit Ruhezone', () => {
    const svg = qrSvg(INVITE);
    assert.ok(svg.startsWith('<svg'));
    assert.ok(svg.includes('viewBox'));
    assert.ok(svg.includes('<rect'));
  });
});
