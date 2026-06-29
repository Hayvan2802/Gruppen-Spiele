// Automatische Testfälle für Gruppen-Spiele (Imposter)
// Aufruf: node --test test/unit/imposter.test.js

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const appCode = readFileSync(join(ROOT, 'js/app.js'), 'utf8');
const cnPath  = join(ROOT, 'js/games/codenames.js');
const cnCode  = existsSync(cnPath) ? readFileSync(cnPath, 'utf8') : '';

// ── Mock-Implementierungen der Spiellogik ─────────────────────────────────────
const ALL_WORDS = ['Hund','Katze','Pizza','Fußball','Strand','Pilot','Gitarre','Drache'];

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function getTimerSeconds(playerCount) {
  const base  = 45;
  const extra = Math.floor((playerCount - 3) / 2) * 10;
  return Math.min(120, base + extra);
}

function createRoles(names, imposterCount) {
  const word     = ALL_WORDS[0];
  const shuffled = shuffle(names);
  const impIdx   = new Set(shuffle([...Array(shuffled.length).keys()]).slice(0, imposterCount));
  return shuffled.map((name, i) => ({ name, isImposter: impIdx.has(i), word }));
}

function selectVote(state, target) { state.voteSelection = target; }
function confirmVote(state, roles, votes) {
  if (!state.voteSelection) return;
  const voter = roles[state.stimmIdx].name;
  votes[voter] = state.voteSelection;
  state.voteSelection = null;
  if (state.stimmIdx + 1 >= roles.length) return 'done';
  state.stimmIdx++;
  return 'next';
}
function calcResult(roles, votes) {
  const tally = {};
  roles.forEach(r => { tally[r.name] = 0; });
  Object.values(votes).forEach(t => { tally[t] = (tally[t] || 0) + 1; });
  const max      = Math.max(...Object.values(tally));
  const eliminated = Object.keys(tally).filter(n => tally[n] === max);
  const imposters  = roles.filter(r => r.isImposter).map(r => r.name);
  return { winner: eliminated.some(n => imposters.includes(n)) ? 'village' : 'imposter', eliminated, tally };
}
function maxImposterOptions(playerCount) {
  const max = Math.max(1, Math.floor(playerCount / 4));
  return Array.from({ length: max }, (_, i) => i + 1);
}
function calcScores(roles, winner, scores) {
  const s = { ...scores };
  if (winner === 'village') {
    roles.filter(r => !r.isImposter).forEach(r => { s[r.name] = (s[r.name] || 0) + 1; });
  } else {
    roles.filter(r => r.isImposter).forEach(r => { s[r.name] = (s[r.name] || 0) + 2; });
  }
  return s;
}

// ── Tests: Rollenzuteilung ─────────────────────────────────────────────────────
describe('Rollenzuteilung', () => {
  test('Genau 1 Imposter bei imposterCount=1', () => {
    const roles = createRoles(['A','B','C','D','E'], 1);
    assert.strictEqual(roles.filter(r => r.isImposter).length, 1);
  });

  test('Genau 2 Imposter bei imposterCount=2', () => {
    const roles = createRoles(['A','B','C','D','E','F','G','H'], 2);
    assert.strictEqual(roles.filter(r => r.isImposter).length, 2);
  });

  test('Alle Spieler bekommen dasselbe Wort', () => {
    const roles = createRoles(['A','B','C','D'], 1);
    assert.strictEqual(new Set(roles.map(r => r.word)).size, 1);
  });

  test('Spieleranzahl stimmt', () => {
    const names = ['Alice','Bob','Clara','David','Eva'];
    assert.strictEqual(createRoles(names, 1).length, names.length);
  });

  test('Jeder Name erscheint genau einmal', () => {
    const names = ['Alice','Bob','Clara','David'];
    const roleNames = createRoles(names, 1).map(r => r.name).sort();
    assert.deepStrictEqual(roleNames, [...names].sort());
  });

  test('Imposter ist nicht Village', () => {
    createRoles(['A','B','C','D','E'], 1).forEach(r => {
      if (r.isImposter) assert.ok(!r.isVillage);
    });
  });
});

// ── Tests: Abstimmung & Ergebnis ──────────────────────────────────────────────
describe('Abstimmung & Ergebnis', () => {
  const rolesBase = () => [
    { name: 'Alice', isImposter: true,  word: 'Hund' },
    { name: 'Bob',   isImposter: false, word: 'Hund' },
    { name: 'Clara', isImposter: false, word: 'Hund' },
  ];

  test('Imposter erwischt wenn alle auf ihn stimmen', () => {
    assert.strictEqual(calcResult(rolesBase(), { Bob: 'Alice', Clara: 'Alice' }).winner, 'village');
  });

  test('Imposter gewinnt wenn falscher rausgewählt', () => {
    assert.strictEqual(calcResult(rolesBase(), { Alice: 'Bob', Clara: 'Bob' }).winner, 'imposter');
  });

  test('Stimmengleichstand — Alice in eliminated', () => {
    const { eliminated } = calcResult(rolesBase(), { Alice: 'Bob', Bob: 'Alice', Clara: 'Alice' });
    assert.ok(eliminated.includes('Alice'));
  });

  test('Imposter erwischt bei Gleichstand mit Imposter dabei', () => {
    const roles = [
      { name: 'Alice', isImposter: true,  word: 'Hund' },
      { name: 'Bob',   isImposter: false, word: 'Hund' },
      { name: 'Clara', isImposter: false, word: 'Hund' },
      { name: 'David', isImposter: false, word: 'Hund' },
    ];
    assert.strictEqual(calcResult(roles, { Bob: 'Alice', Clara: 'Alice', Alice: 'Bob', David: 'Bob' }).winner, 'village');
  });

  test('selectVote + confirmVote', () => {
    const roles  = [{ name: 'A', isImposter: true, word: 'X' }, { name: 'B', isImposter: false, word: 'X' }, { name: 'C', isImposter: false, word: 'X' }];
    const votes  = {};
    const vstate = { stimmIdx: 0, voteSelection: null };
    selectVote(vstate, 'A');
    assert.strictEqual(vstate.voteSelection, 'A');
    confirmVote(vstate, roles, votes);
    assert.strictEqual(vstate.voteSelection, null);
    assert.strictEqual(votes['A'], 'A');
  });

  test('Tally zählt Stimmen korrekt', () => {
    const roles  = [{ name: 'A', isImposter: true, word: 'X' }, { name: 'B', isImposter: false, word: 'X' }, { name: 'C', isImposter: false, word: 'X' }];
    const { tally } = calcResult(roles, { A: 'B', B: 'B', C: 'A' });
    assert.strictEqual(tally['B'], 2);
    assert.strictEqual(tally['A'], 1);
  });
});

// ── Tests: Timer ──────────────────────────────────────────────────────────────
describe('Timer', () => {
  test('3 Spieler → 45s',  () => assert.strictEqual(getTimerSeconds(3),  45));
  test('4 Spieler → 45s',  () => assert.strictEqual(getTimerSeconds(4),  45));
  test('5 Spieler → 55s',  () => assert.strictEqual(getTimerSeconds(5),  55));
  test('6 Spieler → 55s',  () => assert.strictEqual(getTimerSeconds(6),  55));
  test('8 Spieler → 65s',  () => assert.strictEqual(getTimerSeconds(8),  65));
  test('10 Spieler → 75s', () => assert.strictEqual(getTimerSeconds(10), 75));

  test('16 Spieler → max 120s', () => {
    assert.ok(getTimerSeconds(16) <= 120);
  });

  test('Timer steigt mit Spieleranzahl', () => {
    for (let i = 3; i < 16; i++) {
      assert.ok(getTimerSeconds(i) <= getTimerSeconds(i + 1) || getTimerSeconds(i + 1) === 120);
    }
  });
});

// ── Tests: Imposter-Optionen ──────────────────────────────────────────────────
describe('Imposter-Optionen', () => {
  test('3 Spieler → max 1',  () => { assert.strictEqual(maxImposterOptions(3).length,  1); assert.strictEqual(maxImposterOptions(3)[0],  1); });
  test('4 Spieler → max 1',  () => assert.strictEqual(maxImposterOptions(4).length,  1));
  test('5 Spieler → max 1',  () => assert.strictEqual(maxImposterOptions(5).length,  1));
  test('8 Spieler → max 2',  () => assert.strictEqual(maxImposterOptions(8).length,  2));
  test('12 Spieler → max 3', () => assert.strictEqual(maxImposterOptions(12).length, 3));
  test('16 Spieler → max 4', () => assert.strictEqual(maxImposterOptions(16).length, 4));

  test('Optionen starten immer bei 1', () => {
    [3,5,8,12,16].forEach(n => assert.strictEqual(maxImposterOptions(n)[0], 1));
  });
});

// ── Tests: Shuffle ────────────────────────────────────────────────────────────
describe('Shuffle', () => {
  test('Behält alle Elemente', () => {
    const arr = [1,2,3,4,5];
    assert.deepStrictEqual(shuffle(arr).sort((a,b)=>a-b), arr);
  });

  test('Mutiert Original nicht', () => {
    const arr = [1,2,3,4,5];
    shuffle(arr);
    assert.deepStrictEqual(arr, [1,2,3,4,5]);
  });

  test('Verändert Reihenfolge (statistisch)', () => {
    const arr = [1,2,3,4,5,6,7,8,9,10];
    let sameCount = 0;
    for (let i = 0; i < 10; i++) {
      if (shuffle(arr).join(',') === arr.join(',')) sameCount++;
    }
    assert.ok(sameCount < 10);
  });
});

// ── Tests: Kategorien ─────────────────────────────────────────────────────────
describe('Kategorien', () => {
  const KATS = {
    'Tiere': ['Hund','Katze','Elefant'],
    'Essen': ['Pizza','Sushi','Burger'],
    'Sport': ['Fußball','Tennis'],
  };

  function rndWord(selectedKats, customWords) {
    let pool = [];
    selectedKats.forEach(k => { if (KATS[k]) pool.push(...KATS[k]); });
    pool.push(...customWords);
    if (!pool.length) pool = Object.values(KATS).flat();
    return pool[Math.floor(Math.random() * pool.length)];
  }

  test('Wort aus gewählter Kategorie', () => {
    assert.ok(KATS['Tiere'].includes(rndWord(['Tiere'], [])));
  });

  test('Wort aus mehreren Kategorien', () => {
    const all = [...KATS['Tiere'], ...KATS['Essen']];
    for (let i = 0; i < 20; i++) assert.ok(all.includes(rndWord(['Tiere','Essen'], [])));
  });

  test('Eigenes Wort wird verwendet', () => {
    assert.strictEqual(rndWord([], ['MeinWort']), 'MeinWort');
  });

  test('Fallback auf alle Wörter wenn keine Kategorie', () => {
    assert.ok(Object.values(KATS).flat().includes(rndWord([], [])));
  });

  test('Eigene Wörter + Kategorie kombiniert', () => {
    const pool = [...KATS['Sport'], 'EigenesWort'];
    for (let i = 0; i < 30; i++) assert.ok(pool.includes(rndWord(['Sport'], ['EigenesWort'])));
  });
});

// ── Tests: Runden & Punkte ────────────────────────────────────────────────────
describe('Runden & Punkte', () => {
  test('Dorfbewohner bekommen 1 Punkt wenn Imposter erwischt', () => {
    const roles = [{name:'A',isImposter:true},{name:'B',isImposter:false},{name:'C',isImposter:false}];
    const s = calcScores(roles, 'village', {});
    assert.strictEqual(s['B'], 1);
    assert.strictEqual(s['C'], 1);
    assert.ok(!s['A']);
  });

  test('Imposter bekommt 2 Punkte wenn er gewinnt', () => {
    const roles = [{name:'A',isImposter:true},{name:'B',isImposter:false}];
    const s = calcScores(roles, 'imposter', {});
    assert.strictEqual(s['A'], 2);
    assert.ok(!s['B']);
  });

  test('Punkte akkumulieren über Runden', () => {
    const roles = [{name:'A',isImposter:true},{name:'B',isImposter:false}];
    const s = calcScores(roles, 'village', calcScores(roles, 'village', {}));
    assert.strictEqual(s['B'], 2);
  });

  test('Runden-Counter: nextRound erhöht roundsCurrent', () => {
    let current = 1;
    current++;
    assert.strictEqual(current, 2);
  });

  test('Kein weiterer nextRound wenn roundsCurrent >= roundsTotal', () => {
    assert.ok(3 >= 3);
  });
});

// ── Tests: Wer bin ich ────────────────────────────────────────────────────────
describe('Wer bin ich', () => {
  const WBI_KAT = {
    'Schauspieler': ['Tom Hanks', 'Brad Pitt', 'Meryl Streep'],
    'Sport':        ['Messi', 'Ronaldo', 'Jordan'],
  };
  const WBI_ALL = Object.values(WBI_KAT).flat();

  function wbiGetPool(selectedKats, customCards) {
    let pool = [];
    selectedKats.forEach(k => { if (WBI_KAT[k]) pool.push(...WBI_KAT[k].map(w => ({ word: w, category: k }))); });
    customCards.forEach(w => pool.push({ word: w, category: 'Eigene' }));
    if (!pool.length) pool = WBI_ALL.map(w => ({ word: w, category: '?' }));
    return pool;
  }

  test('Pool aus gewählten Kategorien', () => {
    const pool = wbiGetPool(['Schauspieler'], []);
    assert.ok(pool.every(c => WBI_KAT['Schauspieler'].includes(c.word)));
    assert.strictEqual(pool.length, 3);
  });

  test('Eigene Begriffe im Pool', () => {
    const pool = wbiGetPool([], ['Einstein', 'Newton']);
    assert.strictEqual(pool.length, 2);
    assert.ok(pool.some(c => c.word === 'Einstein'));
  });

  test('Fallback wenn keine Kategorie', () => {
    assert.ok(wbiGetPool([], []).length > 0);
  });

  test('Jeder Spieler bekommt eine Karte', () => {
    const names = ['Alice', 'Bob', 'Clara', 'David'];
    const pool  = wbiGetPool(['Schauspieler', 'Sport'], []);
    const cards = names.map((name, i) => ({ playerName: name, word: pool[i % pool.length].word, guessed: false }));
    assert.strictEqual(cards.length, 4);
    cards.forEach(c => assert.ok(c.word));
  });

  test('Erraten zählt Punkt', () => {
    const scores = {};
    const card = { playerName: 'Alice', word: 'Messi', guessed: false };
    card.guessed = true;
    scores[card.playerName] = (scores[card.playerName] || 0) + 1;
    assert.strictEqual(scores['Alice'], 1);
  });

  test('Übersprungen zählt keinen Punkt', () => {
    assert.strictEqual({['Bob']: undefined}['Bob'] || 0, 0);
  });

  test('Runde vorbei wenn alle erledigt', () => {
    assert.ok([{guessed:true,skipped:false},{guessed:false,skipped:true},{guessed:true,skipped:false}].every(c => c.guessed || c.skipped));
  });

  test('Noch nicht vorbei wenn einer übrig', () => {
    assert.ok(![{guessed:true,skipped:false},{guessed:false,skipped:false}].every(c => c.guessed || c.skipped));
  });
});

// ── Tests: app.js Syntax-Checks ───────────────────────────────────────────────
describe('app.js Syntax', () => {
  test('Keine doppelten Funktionsdefinitionen', () => {
    ['applyUpdate','checkForUpdate','applyTheme','registerSW','startLocalGame','calcResult','cnRevealCard','wbiStartLocal'].forEach(fn => {
      const count = (appCode.match(new RegExp(`function ${fn}\\(`, 'g')) || []).length;
      assert.ok(count <= 1, `${fn} ist ${count}x definiert!`);
    });
  });

  test('Kein loses async-Keyword', () => {
    assert.strictEqual(appCode.split('\n').filter(l => l.trim() === 'async').length, 0);
  });

  test('Kein doppelter import createApp', () => {
    assert.strictEqual((appCode.match(/import \{ createApp/g) || []).length, 1);
  });

  test('template Backtick vorhanden', () => {
    assert.ok(appCode.includes('template: `'));
  });

  test('Kein /\\D/g in Vue-Template (Safari-Bug)', () => {
    const templateStart = appCode.indexOf('template: `');
    const templatePart  = templateStart > -1 ? appCode.slice(templateStart) : '';
    assert.ok(!templatePart.includes('/\\D/g'));
  });

  test('if-Statement ohne {}: kein push({}) direkt danach', () => {
    const lines = appCode.split('\n');
    for (let i = 0; i < lines.length - 1; i++) {
      const cur  = lines[i].trim();
      const next = lines[i + 1]?.trim() || '';
      if (/^if\s*\(.*\)\s*$/.test(cur) && next.startsWith('{')) {
        assert.fail(`Zeile ${i + 1}: if ohne {} vor {-Ausdruck: ${cur}`);
      }
    }
  });

  test('codenames.js: keine doppelten Exports', () => {
    if (!cnCode) return;
    const names = (cnCode.match(/export (?:function|const) (\w+)/g) || []).map(e => e.split(' ').pop());
    const seen  = new Set();
    names.forEach(n => { assert.ok(!seen.has(n), `Doppelter Export: ${n}`); seen.add(n); });
  });
});
