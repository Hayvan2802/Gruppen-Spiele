#!/usr/bin/env node
// build.js — Release-Skript für Gruppen-Spiele
// Verwendung: node build.js
//
// Was dieser Skript tut:
//  1. Liest .release-counter (Format "Major.Minor")
//  2. Minor +1 (Major nur auf Anweisung: node build.js --major)
//  3. Liest changes.txt (eine user-facing Zeile pro Änderung)
//  4. Schreibt js/buildinfo.js (Version + Datum + Changelog-Array)
//  5. Bumpt CACHE-String in sw.js
//  6. Leert changes.txt
//  7. Schreibt neue Version in .release-counter

import { readFileSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';

// ── 1. Versionsnummer lesen & bumpen ─────────────────────────────────────────
const counterRaw = readFileSync('.release-counter', 'utf8').trim();
let [major, minor] = counterRaw.split('.').map(Number);

const isMajorBump = process.argv.includes('--major');
if (isMajorBump) { major++; minor = 0; }
else              { minor++; }

const version = `${major}.${minor}`;

// ── 2. Changelog-Zeilen lesen ────────────────────────────────────────────────
const changesRaw = readFileSync('changes.txt', 'utf8');
const changes = changesRaw
  .split('\n')
  .map(l => l.trim())
  .filter(l => l.length > 0 && !l.startsWith('#'));

if (changes.length === 0) {
  console.error('❌  changes.txt ist leer — bitte Changelog-Zeilen eintragen.');
  process.exit(1);
}

// ── 3. Datum (Heute) ─────────────────────────────────────────────────────────
const now = new Date();
const date = `${String(now.getDate()).padStart(2,'0')}.${String(now.getMonth()+1).padStart(2,'0')}.${now.getFullYear()}`;

// ── 4. buildinfo.js generieren ───────────────────────────────────────────────
const oldBuildinfo = readFileSync('js/buildinfo.js', 'utf8');

// CHANGELOG-Array aus alter Datei extrahieren (alles ab der zweiten { ... })
const changelogStart = oldBuildinfo.indexOf('export const CHANGELOG');
const arrayStart = oldBuildinfo.indexOf('[', changelogStart);
// Wir nehmen alles vom ersten "{"-Block nach dem neuen Eintrag → alten Inhalt anhängen
const oldEntries = oldBuildinfo.slice(arrayStart + 1, oldBuildinfo.lastIndexOf(']')).trimEnd();

// Neuen Eintrag bauen
const changesStr = changes.map(c => `    '${c.replace(/'/g, "\\'")}',`).join('\n');
const newEntry = `  {\n    version: '${version}',\n    date: '${date}',\n    changes: [\n${changesStr}\n    ],\n  },`;

// Git-Hash für BUILD_HASH (kurz, lesbar)
let buildHash = 'release';
try {
  const msg = execSync('git log -1 --format=%s HEAD').toString().trim();
  // Ersten sinnvollen Slug aus dem letzten Commit-Titel ableiten
  buildHash = msg.replace(/^[^:]+:\s*/,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').slice(0,24).replace(/-+$/,'');
} catch { /* ignore */ }

const newBuildinfo =
`// Auto-generiert — nicht manuell bearbeiten!
export const BUILD      = '${version}';
export const BUILD_HASH = '${buildHash}';

export const CHANGELOG = [
${newEntry}
${oldEntries.trimStart()}
];
`;

writeFileSync('js/buildinfo.js', newBuildinfo);

// ── 5. sw.js Cache-String bumpen ─────────────────────────────────────────────
let sw = readFileSync('sw.js', 'utf8');
sw = sw.replace(
  /\/\/ Gruppen-Spiele Service Worker v[\d.]+/,
  `// Gruppen-Spiele Service Worker v${version}`
);
sw = sw.replace(
  /const CACHE = 'gruppen-spiele-v[\d.]+'/,
  `const CACHE = 'gruppen-spiele-v${version}'`
);
writeFileSync('sw.js', sw);

// ── 6. changes.txt leeren ────────────────────────────────────────────────────
writeFileSync('changes.txt', '# Changelog-Zeilen für den nächsten Release (eine pro Zeile)\n');

// ── 7. .release-counter aktualisieren ────────────────────────────────────────
writeFileSync('.release-counter', version);

console.log(`✅  v${version} gebaut — ${changes.length} Änderung(en)`);
console.log(`    buildinfo.js + sw.js aktualisiert, changes.txt geleert.`);
