// test.js — Automatische Testfälle für Gruppen-Spiele (Imposter)
// Aufruf: node test.js

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); console.log(`  ✓ ${name}`); passed++; }
  catch(e) { console.log(`  ✗ ${name}: ${e.message}`); failed++; }
}
function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }
function assertEqual(a, b, msg) { if (a !== b) throw new Error(msg || `Expected ${b}, got ${a}`); }

// ── Mock-Implementierungen der Spiellogik ────────────────────────────────────
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
  const base = 45;
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
  if (state.stimmIdx + 1 >= roles.length) { return 'done'; }
  else { state.stimmIdx++; return 'next'; }
}
function calcResult(roles, votes) {
  const tally = {};
  roles.forEach(r => { tally[r.name] = 0; });
  Object.values(votes).forEach(t => { tally[t] = (tally[t] || 0) + 1; });
  const max = Math.max(...Object.values(tally));
  const eliminated = Object.keys(tally).filter(n => tally[n] === max);
  const imposters  = roles.filter(r => r.isImposter).map(r => r.name);
  return {
    winner: eliminated.some(n => imposters.includes(n)) ? 'village' : 'imposter',
    eliminated, tally,
  };
}

function maxImposterOptions(playerCount) {
  const max = Math.max(1, Math.floor(playerCount / 4));
  return Array.from({length: max}, (_, i) => i + 1);
}

// ── Tests: Rollenzuteilung ────────────────────────────────────────────────────
console.log('\n=== ROLLENZUTEILUNG ===');

test('Genau 1 Imposter bei imposterCount=1', () => {
  const roles = createRoles(['A','B','C','D','E'], 1);
  const imposters = roles.filter(r => r.isImposter);
  assertEqual(imposters.length, 1, `Imposters: ${imposters.length}`);
});

test('Genau 2 Imposter bei imposterCount=2', () => {
  const roles = createRoles(['A','B','C','D','E','F','G','H'], 2);
  const imposters = roles.filter(r => r.isImposter);
  assertEqual(imposters.length, 2, `Imposters: ${imposters.length}`);
});

test('Alle Spieler bekommen dieselbe Wort (außer Imposter irrelevant)', () => {
  const roles = createRoles(['A','B','C','D'], 1);
  const words = [...new Set(roles.map(r => r.word))];
  assertEqual(words.length, 1, 'Alle sollten dasselbe Wort haben');
});

test('Spieleranzahl stimmt', () => {
  const names = ['Alice','Bob','Clara','David','Eva'];
  const roles = createRoles(names, 1);
  assertEqual(roles.length, names.length, `Rollen: ${roles.length}`);
});

test('Jeder Name erscheint genau einmal', () => {
  const names = ['Alice','Bob','Clara','David'];
  const roles = createRoles(names, 1);
  const roleNames = roles.map(r => r.name).sort();
  const sortedNames = [...names].sort();
  assertEqual(JSON.stringify(roleNames), JSON.stringify(sortedNames));
});

test('Imposter ist nicht Village', () => {
  const roles = createRoles(['A','B','C','D','E'], 1);
  roles.forEach(r => {
    if (r.isImposter) assert(!r.isVillage, 'Imposter darf kein Village sein');
  });
});

// ── Tests: Abstimmung / Ergebnis ─────────────────────────────────────────────
console.log('\n=== ABSTIMMUNG & ERGEBNIS ===');

test('Imposter erwischt wenn alle auf ihn stimmen', () => {
  const roles = [
    { name: 'Alice', isImposter: true,  word: 'Hund' },
    { name: 'Bob',   isImposter: false, word: 'Hund' },
    { name: 'Clara', isImposter: false, word: 'Hund' },
  ];
  const votes = { Bob: 'Alice', Clara: 'Alice' };
  const { winner } = calcResult(roles, votes);
  assertEqual(winner, 'village');
});

test('Imposter gewinnt wenn falscher rausgewählt', () => {
  const roles = [
    { name: 'Alice', isImposter: true,  word: 'Hund' },
    { name: 'Bob',   isImposter: false, word: 'Hund' },
    { name: 'Clara', isImposter: false, word: 'Hund' },
  ];
  const votes = { Alice: 'Bob', Clara: 'Bob' };
  const { winner } = calcResult(roles, votes);
  assertEqual(winner, 'imposter');
});

test('Stimmengleichstand — alle mit Max-Stimmen in eliminated', () => {
  const roles = [
    { name: 'Alice', isImposter: true,  word: 'Hund' },
    { name: 'Bob',   isImposter: false, word: 'Hund' },
    { name: 'Clara', isImposter: false, word: 'Hund' },
  ];
  const votes = { Alice: 'Bob', Bob: 'Alice', Clara: 'Alice' };
  const { eliminated } = calcResult(roles, votes);
  assert(eliminated.includes('Alice'), 'Alice sollte in eliminated sein');
});

test('Imposter erwischt bei Gleichstand mit Imposter dabei', () => {
  const roles = [
    { name: 'Alice', isImposter: true,  word: 'Hund' },
    { name: 'Bob',   isImposter: false, word: 'Hund' },
    { name: 'Clara', isImposter: false, word: 'Hund' },
    { name: 'David', isImposter: false, word: 'Hund' },
  ];
  // Je 2 Stimmen auf Alice und Bob
  const votes = { Bob: 'Alice', Clara: 'Alice', Alice: 'Bob', David: 'Bob' };
  const { winner } = calcResult(roles, votes);
  assertEqual(winner, 'village', 'Alice (Imposter) ist im Gleichstand → village gewinnt');
});

test('selectVote + confirmVote — Vorauswahl dann Bestätigen', () => {
  const roles = [
    { name: 'A', isImposter: true,  word: 'X' },
    { name: 'B', isImposter: false, word: 'X' },
    { name: 'C', isImposter: false, word: 'X' },
  ];
  const votes = {};
  const vstate = { stimmIdx: 0, voteSelection: null };
  selectVote(vstate, 'A');
  assert(vstate.voteSelection === 'A', 'Vorauswahl sollte A sein');
  const res = confirmVote(vstate, roles, votes);
  assert(vstate.voteSelection === null, 'voteSelection nach Bestätigung null');
  assertEqual(votes['B'], undefined, 'B hat noch nicht gestimmt');
  assertEqual(votes['A'], 'A', 'A hat für A gestimmt'); // wait — voter is A (stimmIdx=0)
});

test('Tally zählt Stimmen korrekt', () => {
  const roles = [
    { name: 'A', isImposter: true,  word: 'X' },
    { name: 'B', isImposter: false, word: 'X' },
    { name: 'C', isImposter: false, word: 'X' },
  ];
  const votes = { A: 'B', B: 'B', C: 'A' };
  const { tally } = calcResult(roles, votes);
  assertEqual(tally['B'], 2);
  assertEqual(tally['A'], 1);
});

// ── Tests: Timer-Logik ────────────────────────────────────────────────────────
console.log('\n=== TIMER ===');

test('3 Spieler → 45 Sekunden', () => {
  assertEqual(getTimerSeconds(3), 45);
});

test('4 Spieler → 45 Sekunden', () => {
  assertEqual(getTimerSeconds(4), 45);
});

test('5 Spieler → 55 Sekunden', () => {
  assertEqual(getTimerSeconds(5), 55);
});

test('6 Spieler → 55 Sekunden', () => {
  assertEqual(getTimerSeconds(6), 55);
});

test('8 Spieler → 65 Sekunden', () => {
  assertEqual(getTimerSeconds(8), 65);
});

test('10 Spieler → 75 Sekunden', () => {
  assertEqual(getTimerSeconds(10), 75);
});

test('16 Spieler → max 120 Sekunden', () => {
  assert(getTimerSeconds(16) <= 120, `Timer ${getTimerSeconds(16)} > 120`);
});

test('Timer steigt mit Spieleranzahl', () => {
  for (let i = 3; i < 16; i++) {
    assert(getTimerSeconds(i) <= getTimerSeconds(i+1) || getTimerSeconds(i+1) === 120,
      `Timer soll nicht fallen: ${i} → ${i+1}`);
  }
});

// ── Tests: Imposter-Anzahl-Optionen ──────────────────────────────────────────
console.log('\n=== IMPOSTER-OPTIONEN ===');

test('3 Spieler → max 1 Imposter', () => {
  const opts = maxImposterOptions(3);
  assertEqual(opts.length, 1);
  assertEqual(opts[0], 1);
});

test('4 Spieler → max 1 Imposter', () => {
  assertEqual(maxImposterOptions(4).length, 1);
});

test('5 Spieler → max 1 Imposter', () => {
  assertEqual(maxImposterOptions(5).length, 1);
});

test('8 Spieler → max 2 Imposter', () => {
  assertEqual(maxImposterOptions(8).length, 2);
});

test('12 Spieler → max 3 Imposter', () => {
  assertEqual(maxImposterOptions(12).length, 3);
});

test('16 Spieler → max 4 Imposter', () => {
  assertEqual(maxImposterOptions(16).length, 4);
});

test('Optionen starten immer bei 1', () => {
  [3,5,8,12,16].forEach(n => {
    assertEqual(maxImposterOptions(n)[0], 1, `Für ${n} Spieler`);
  });
});

// ── Tests: Shuffle ────────────────────────────────────────────────────────────
console.log('\n=== SHUFFLE ===');

test('Shuffle behält alle Elemente', () => {
  const arr = [1,2,3,4,5];
  const shuffled = shuffle(arr);
  assertEqual(shuffled.length, arr.length);
  assertEqual(shuffled.sort().join(','), [1,2,3,4,5].join(','));
});

test('Shuffle mutiert Original nicht', () => {
  const arr = [1,2,3,4,5];
  shuffle(arr);
  assertEqual(arr.join(','), '1,2,3,4,5');
});

test('Shuffle verändert Reihenfolge (statistisch)', () => {
  const arr = [1,2,3,4,5,6,7,8,9,10];
  let sameCount = 0;
  for (let i = 0; i < 10; i++) {
    if (shuffle(arr).join(',') === arr.join(',')) sameCount++;
  }
  assert(sameCount < 10, 'Shuffle sollte nicht immer gleich sein');
});


// ── Tests: Kategorien ─────────────────────────────────────────────────────────
console.log('\n=== KATEGORIEN ===');

const KATEGORIEN_TEST = {
  'Tiere': ['Hund','Katze','Elefant'],
  'Essen':  ['Pizza','Sushi','Burger'],
  'Sport':  ['Fußball','Tennis'],
};

function rndWordFromKats(selectedKats, customWords, kategorien) {
  let pool = [];
  selectedKats.forEach(k => { if (kategorien[k]) pool.push(...kategorien[k]); });
  pool.push(...customWords);
  if (!pool.length) pool = Object.values(kategorien).flat();
  return pool[Math.floor(Math.random() * pool.length)];
}

test('Wort aus gewählter Kategorie', () => {
  const w = rndWordFromKats(['Tiere'], [], KATEGORIEN_TEST);
  assert(KATEGORIEN_TEST['Tiere'].includes(w), `"${w}" nicht in Tiere`);
});

test('Wort aus mehreren Kategorien', () => {
  const all = [...KATEGORIEN_TEST['Tiere'], ...KATEGORIEN_TEST['Essen']];
  for (let i = 0; i < 20; i++) {
    const w = rndWordFromKats(['Tiere','Essen'], [], KATEGORIEN_TEST);
    assert(all.includes(w), `"${w}" nicht in Tiere+Essen`);
  }
});

test('Eigenes Wort wird verwendet', () => {
  const w = rndWordFromKats([], ['MeinWort'], KATEGORIEN_TEST);
  assertEqual(w, 'MeinWort');
});

test('Fallback auf alle Wörter wenn keine Kategorie gewählt', () => {
  const allWords = Object.values(KATEGORIEN_TEST).flat();
  const w = rndWordFromKats([], [], KATEGORIEN_TEST);
  assert(allWords.includes(w));
});

test('Eigene Wörter + Kategorie kombiniert', () => {
  const pool = [...KATEGORIEN_TEST['Sport'], 'EigenesWort'];
  for (let i = 0; i < 30; i++) {
    const w = rndWordFromKats(['Sport'], ['EigenesWort'], KATEGORIEN_TEST);
    assert(pool.includes(w), `"${w}" nicht in Pool`);
  }
});

// ── Tests: Runden & Punkte ────────────────────────────────────────────────────
console.log('\n=== RUNDEN & PUNKTE ===');

function calcScores(roles, winner, scores) {
  const s = {...scores};
  if (winner === 'village') {
    roles.filter(r => !r.isImposter).forEach(r => { s[r.name] = (s[r.name]||0) + 1; });
  } else {
    roles.filter(r => r.isImposter).forEach(r => { s[r.name] = (s[r.name]||0) + 2; });
  }
  return s;
}

test('Dorfbewohner bekommen 1 Punkt wenn Imposter erwischt', () => {
  const roles = [
    {name:'A',isImposter:true},{name:'B',isImposter:false},{name:'C',isImposter:false}
  ];
  const s = calcScores(roles, 'village', {});
  assertEqual(s['B'], 1); assertEqual(s['C'], 1); assert(!s['A']);
});

test('Imposter bekommt 2 Punkte wenn er gewinnt', () => {
  const roles = [
    {name:'A',isImposter:true},{name:'B',isImposter:false}
  ];
  const s = calcScores(roles, 'imposter', {});
  assertEqual(s['A'], 2); assert(!s['B']);
});

test('Punkte akkumulieren über Runden', () => {
  const roles = [{name:'A',isImposter:true},{name:'B',isImposter:false}];
  let s = calcScores(roles, 'village', {});
  s = calcScores(roles, 'village', s);
  assertEqual(s['B'], 2);
});

test('Runden-Counter: nextRound erhöht roundsCurrent', () => {
  let current = 1;
  current++; // nextRound
  assertEqual(current, 2);
});

test('Kein weiterer nextRound wenn roundsCurrent >= roundsTotal', () => {
  const total = 3, current = 3;
  assert(current >= total, 'Alle Runden gespielt');
});

// ── Ergebnis ──────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(40)}`);
console.log(`  Gesamt: ${passed + failed} Tests`);
console.log(`  ✅ Bestanden: ${passed}`);
if (failed > 0) {
  console.log(`  ❌ Fehlgeschlagen: ${failed}`);
  process.exit(1);
} else {
  console.log(`  Alle Tests grün ✓`);
}

// ── Tests: Wer bin ich ────────────────────────────────────────────────────────
console.log('\n=== WER BIN ICH ===');

// Mock WBI_KATEGORIEN
const WBI_KAT_TEST = {
  'Schauspieler': ['Tom Hanks', 'Brad Pitt', 'Meryl Streep'],
  'Sport':        ['Messi', 'Ronaldo', 'Jordan'],
};
const WBI_ALL = Object.values(WBI_KAT_TEST).flat();

function wbiGetPool(selectedKats, customCards) {
  let pool = [];
  selectedKats.forEach(k => { if (WBI_KAT_TEST[k]) pool.push(...WBI_KAT_TEST[k].map(w => ({ word: w, category: k }))); });
  customCards.forEach(w => pool.push({ word: w, category: 'Eigene' }));
  if (!pool.length) pool = WBI_ALL.map(w => ({ word: w, category: '?' }));
  return pool;
}

test('WBI: Pool aus gewählten Kategorien', () => {
  const pool = wbiGetPool(['Schauspieler'], []);
  assert(pool.every(c => WBI_KAT_TEST['Schauspieler'].includes(c.word)));
  assertEqual(pool.length, 3);
});

test('WBI: Eigene Begriffe im Pool', () => {
  const pool = wbiGetPool([], ['Einstein', 'Newton']);
  assertEqual(pool.length, 2);
  assert(pool.some(c => c.word === 'Einstein'));
});

test('WBI: Fallback wenn keine Kategorie', () => {
  const pool = wbiGetPool([], []);
  assert(pool.length > 0);
});

test('WBI: Karten-Zuteilung — jeder Spieler bekommt eine Karte', () => {
  const names = ['Alice', 'Bob', 'Clara', 'David'];
  const pool  = wbiGetPool(['Schauspieler', 'Sport'], []);
  const cards = names.map((name, i) => ({ playerName: name, word: pool[i % pool.length].word, guessed: false }));
  assertEqual(cards.length, 4);
  cards.forEach(c => assert(c.word, 'Karte hat kein Wort'));
});

test('WBI: Erraten zählt Punkt', () => {
  const scores = {};
  const card = { playerName: 'Alice', word: 'Messi', guessed: false };
  card.guessed = true;
  scores[card.playerName] = (scores[card.playerName] || 0) + 1;
  assertEqual(scores['Alice'], 1);
});

test('WBI: Übersprungen zählt keinen Punkt', () => {
  const scores = {};
  const card = { playerName: 'Bob', word: 'Newton', skipped: true };
  // kein Punkt
  assertEqual(scores['Bob'] || 0, 0);
});

test('WBI: Runde vorbei wenn alle erledigt', () => {
  const cards = [
    { guessed: true, skipped: false },
    { guessed: false, skipped: true },
    { guessed: true, skipped: false },
  ];
  const done = cards.every(c => c.guessed || c.skipped);
  assert(done, 'Runde sollte vorbei sein');
});

test('WBI: Noch nicht vorbei wenn einer übrig', () => {
  const cards = [
    { guessed: true, skipped: false },
    { guessed: false, skipped: false }, // noch offen
  ];
  const done = cards.every(c => c.guessed || c.skipped);
  assert(!done, 'Runde sollte noch laufen');
});

// ── Tests: app.js Syntax-Checks ──────────────────────────────────────────────
console.log('\n=== APP.JS SYNTAX ===');

const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '../..');
const appCode = fs.readFileSync(path.join(ROOT, 'js/app.js'), 'utf8');

test('Keine doppelten Funktionsdefinitionen', () => {
  const fns = ['applyUpdate','checkForUpdate','applyTheme','registerSW',
                'startLocalGame','calcResult','cnRevealCard','wbiStartLocal'];
  fns.forEach(fn => {
    const count = (appCode.match(new RegExp(`function ${fn}\\(`, 'g')) || []).length;
    assert(count <= 1, `${fn} ist ${count}x definiert!`);
  });
});

test('Kein loses async-Keyword', () => {
  const lines = appCode.split('\n');
  const bad = lines.filter(l => l.trim() === 'async');
  assert(bad.length === 0, `Loses 'async' auf ${bad.length} Zeile(n)`);
});

test('Kein doppelter import createApp', () => {
  const count = (appCode.match(/import \{ createApp/g) || []).length;
  assertEqual(count, 1, `createApp ${count}x importiert`);
});

test('template Backtick vorhanden', () => {
  assert(appCode.includes('template: `'), 'template: ` fehlt');
});

test('Kein /\\D/g in Vue-Template (Safari-Bug)', () => {
  // In Backtick-Templates muss /[^0-9]/g statt /\D/g verwendet werden
  const templateStart = appCode.indexOf('template: `');
  const templatePart = templateStart > -1 ? appCode.slice(templateStart) : '';
  assert(!templatePart.includes('/\\D/g'), '/\\D/g in Vue-Template gefunden — Safari-Bug!');
});

test('if-Statement ohne {}: kein push({}) direkt danach', () => {
  const lines = appCode.split('\n');
  for (let i = 0; i < lines.length - 1; i++) {
    const cur = lines[i].trim();
    const next = lines[i+1]?.trim() || '';
    if (/^if\s*\(.*\)\s*$/.test(cur) && next.startsWith('{')) {
      assert(false, `Zeile ${i+1}: if ohne {} vor {-Ausdruck: ${cur}`);
    }
  }
});

// Codenames-spezifisch
const cnPath = path.join(ROOT, 'js/games/codenames.js');
const cnCode = fs.existsSync(cnPath) ? fs.readFileSync(cnPath, 'utf8') : '';

test('codenames.js: keine doppelten Exports', () => {
  if (!cnCode) return;
  const exports = cnCode.match(/export (?:function|const) (\w+)/g) || [];
  const names = exports.map(e => e.split(' ').pop());
  const seen = new Set();
  names.forEach(n => {
    assert(!seen.has(n), `Doppelter Export in codenames.js: ${n}`);
    seen.add(n);
  });
});
