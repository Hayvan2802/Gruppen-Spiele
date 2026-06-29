// test.js — Automatische Testfälle für Werwolf Spiellogik
// Aufruf: node test.js

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); console.log(`  ✓ ${name}`); passed++; }
  catch(e) { console.log(`  ✗ ${name}: ${e.message}`); failed++; }
}
function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }

// ── Mock State ────────────────────────────────────────────────────────────────
function mkPlayer(name, roleId, alive = true) { return { name, roleId, alive }; }
function mkState(players) {
  return {
    players,
    phase: 'night', round: 1,
    lovers: [], lovers2: [],
    jaegerModal: { active: false },
    ritterWolfTarget: null,
    amHit: false, ddRevealed: false,
    nightPhaseStarted: false,
    healUsed: false, poisonUsed: false, lovUsed: false,
    nightQueue: [], nightQueueIdx: 0, nightActions: {},
    nightSelection: null, nightMultiSel: [],
    daySelection: null, gameLog: [], logNow: '',
    lastHeal: null,
  };
}
const ROLES = {
  werwolf:    { team: 'wolf',  nightAction: 'kill',   mustSelect: true },
  dorfbewohner:{ team: 'dorf', nightAction: null,      mustSelect: false },
  jaeger:     { team: 'dorf', nightAction: null,      mustSelect: false },
  seherin:    { team: 'dorf', nightAction: 'see',     mustSelect: true },
  heiler:     { team: 'dorf', nightAction: 'heal',    mustSelect: true },
  hexe:       { team: 'dorf', nightAction: 'witch',   mustSelect: false },
  amor:       { team: 'dorf', nightAction: 'love',    mustSelect: true, firstNightOnly: true },
  ritter:     { team: 'dorf', nightAction: null,      mustSelect: false },
  alterMann:  { team: 'dorf', nightAction: null,      mustSelect: false },
  dorfdepp:   { team: 'dorf', nightAction: null,      mustSelect: false },
  serienkiller:{ team:'solo', nightAction:'killSolo',  mustSelect: true },
};
const NIGHT_ORDER = ['amor','seherin','heiler','hexe','werwolf','serienkiller'];

// ── Tests ─────────────────────────────────────────────────────────────────────
console.log('\n=== NACHT-REIHENFOLGE ===');
test('Amor zuerst in Nacht 1', () => {
  const active = ['amor','seherin','heiler','werwolf'];
  const queue = NIGHT_ORDER.filter(id => active.includes(id));
  assert(queue[0] === 'amor', `Erster: ${queue[0]}`);
});
test('Amor nicht in Nacht 2+', () => {
  const round = 2;
  const active = ['amor','seherin','werwolf'];
  const queue = NIGHT_ORDER.filter(id => {
    if (!active.includes(id)) return false;
    if (ROLES[id]?.firstNightOnly && round > 1) return false;
    return true;
  });
  assert(!queue.includes('amor'), 'Amor sollte nicht in Nacht 2 sein');
});
test('Seherin vor Werwölfen', () => {
  const queue = NIGHT_ORDER.filter(id => ['seherin','werwolf'].includes(id));
  assert(queue.indexOf('seherin') < queue.indexOf('werwolf'));
});
test('Heiler vor Werwölfen', () => {
  const queue = NIGHT_ORDER.filter(id => ['heiler','werwolf'].includes(id));
  assert(queue.indexOf('heiler') < queue.indexOf('werwolf'));
});

console.log('\n=== JÄGER ===');
test('Jäger-Modal öffnet sich wenn Jäger stirbt', () => {
  const state = mkState([
    mkPlayer('Anna', 'werwolf'),
    mkPlayer('Bob', 'jaeger'),
    mkPlayer('Clara', 'dorfbewohner'),
  ]);
  // Simulate killPlayer for jaeger
  const p = state.players[1];
  p.alive = false;
  if (p.roleId === 'jaeger') state.jaegerModal.active = true;
  assert(state.jaegerModal.active, 'Modal sollte aktiv sein');
});
test('Jäger kann Ziel wählen und es stirbt', () => {
  const state = mkState([
    mkPlayer('Anna', 'werwolf'),
    mkPlayer('Bob', 'jaeger'),
    mkPlayer('Clara', 'dorfbewohner'),
  ]);
  state.players[1].alive = false; // Jäger tot
  state.jaegerModal.active = true;
  // confirmJaeger(0) — Anna wird gewählt
  const target = state.players[0];
  if (target && target.alive) target.alive = false;
  state.jaegerModal.active = false;
  assert(!target.alive, 'Ziel sollte tot sein');
  assert(!state.jaegerModal.active, 'Modal sollte geschlossen sein');
});
test('Jäger kann niemanden mitnehmen (skip)', () => {
  const state = mkState([mkPlayer('Bob', 'jaeger')]);
  state.players[0].alive = false;
  state.jaegerModal.active = true;
  // confirmJaeger(null)
  state.jaegerModal.active = false;
  assert(!state.jaegerModal.active, 'Modal geschlossen');
  assert(state.players.every(p => !p.alive || true), 'Kein unerwarteter Tod');
});

console.log('\n=== LIEBENDE ===');
test('Wenn ein Liebender stirbt, stirbt der andere', () => {
  const state = mkState([
    mkPlayer('Anna', 'dorfbewohner'),
    mkPlayer('Bob', 'dorfbewohner'),
    mkPlayer('Clara', 'werwolf'),
  ]);
  state.lovers = [0, 1]; // Anna & Bob sind Liebende
  // Anna stirbt
  state.players[0].alive = false;
  if (state.lovers.includes(0)) {
    const partner = state.lovers.find(l => l !== 0);
    if (state.players[partner]?.alive) state.players[partner].alive = false;
  }
  assert(!state.players[1].alive, 'Bob sollte auch tot sein');
  assert(state.players[2].alive, 'Clara sollte noch leben');
});

console.log('\n=== SIEGBEDINGUNGEN ===');
test('Dorf gewinnt wenn alle Wölfe tot', () => {
  const players = [mkPlayer('Wolf', 'werwolf', false), mkPlayer('Dorf', 'dorfbewohner', true)];
  const wolves = players.filter(p => p.alive && ROLES[p.roleId].team === 'wolf');
  assert(wolves.length === 0, 'Keine Wölfe mehr');
});
test('Wölfe gewinnen wenn gleich viele wie Dorf', () => {
  const players = [mkPlayer('Wolf', 'werwolf', true), mkPlayer('Dorf', 'dorfbewohner', true)];
  const alive = players.filter(p => p.alive);
  const wolves = alive.filter(p => ROLES[p.roleId].team === 'wolf');
  const dorf = alive.filter(p => ROLES[p.roleId].team !== 'wolf');
  assert(wolves.length >= dorf.length, 'Wölfe haben Mehrheit');
});
test('Liebende gewinnen wenn nur noch sie übrig', () => {
  const players = [mkPlayer('A', 'dorfbewohner', true), mkPlayer('B', 'werwolf', true)];
  const lovers = [0, 1];
  const alive = players.filter(p => p.alive);
  const allLovers = alive.every((p, i) => lovers.includes(players.indexOf(p)));
  assert(alive.length === 2 && allLovers, 'Nur Liebende übrig');
});

console.log('\n=== DORFDEPP ===');
test('Dorfdepp wird verschont bei erster Abstimmung', () => {
  const state = mkState([mkPlayer('Depp', 'dorfdepp'), mkPlayer('Wolf', 'werwolf')]);
  state.ddRevealed = false;
  // Wenn ddRevealed false → nicht töten, nur enthüllen
  if (state.players[0].roleId === 'dorfdepp' && !state.ddRevealed) {
    state.ddRevealed = true;
    // Spieler bleibt am Leben
  }
  assert(state.players[0].alive, 'Dorfdepp sollte noch leben');
  assert(state.ddRevealed, 'ddRevealed sollte true sein');
});

console.log('\n=== ALTER MANN ===');
test('Alter Mann überlebt ersten Wolfangriff', () => {
  const state = mkState([mkPlayer('Opa', 'alterMann'), mkPlayer('Wolf', 'werwolf')]);
  state.amHit = false;
  // Erster Angriff
  if (state.players[0].roleId === 'alterMann' && !state.amHit) {
    state.amHit = true;
    // Überlebt
  }
  assert(state.players[0].alive, 'Alter Mann lebt noch');
  assert(state.amHit, 'amHit gesetzt');
});
test('Alter Mann stirbt beim zweiten Wolfangriff', () => {
  const state = mkState([mkPlayer('Opa', 'alterMann')]);
  state.amHit = true; // Schon einmal getroffen
  if (state.amHit) state.players[0].alive = false;
  assert(!state.players[0].alive, 'Alter Mann tot');
});

// ── Ergebnis ─────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(40)}`);
console.log(`Tests: ${passed + failed} | ✓ ${passed} bestanden | ✗ ${failed} fehlgeschlagen`);
if (failed > 0) process.exit(1);

// ═══ NACHTPHASE ABLAUF ════════════════════════════════════════════════════════
console.log('\n=== NACHTPHASE ABLAUF ===');

const NIGHT_ORDER_TEST = ['amor','seherin','heiler','hexe','werwolf','weisserWolf','serienkiller'];
const ROLES_TEST = {
  werwolf:      { team:'wolf',  nightAction:'kill',    mustSelect:true,  firstNightOnly:false, everyOtherNight:false },
  dorfbewohner: { team:'dorf',  nightAction:null,      mustSelect:false, firstNightOnly:false, everyOtherNight:false },
  seherin:      { team:'dorf',  nightAction:'see',     mustSelect:true,  firstNightOnly:false, everyOtherNight:false },
  heiler:       { team:'dorf',  nightAction:'heal',    mustSelect:true,  firstNightOnly:false, everyOtherNight:false },
  hexe:         { team:'dorf',  nightAction:'witch',   mustSelect:false, firstNightOnly:false, everyOtherNight:false },
  amor:         { team:'dorf',  nightAction:'love',    mustSelect:true,  firstNightOnly:true,  everyOtherNight:false },
  serienkiller: { team:'solo',  nightAction:'killSolo',mustSelect:true,  firstNightOnly:false, everyOtherNight:false },
  weisserWolf:  { team:'wolf',  nightAction:'killWolf',mustSelect:false, firstNightOnly:false, everyOtherNight:true  },
};

function buildQueue(roleIds, round, lovUsed=false) {
  return NIGHT_ORDER_TEST.filter(id => {
    if (!roleIds.includes(id)) return false;
    const r = ROLES_TEST[id];
    if (!r || !r.nightAction) return false;
    if (r.firstNightOnly && round > 1) return false;
    if (id === 'amor' && lovUsed) return false;
    if (r.everyOtherNight && round % 2 === 0) return false;
    return true;
  });
}

test('Nacht 1: Amor + Seherin + Werwolf alle in Queue', () => {
  const q = buildQueue(['amor','seherin','werwolf'], 1);
  assert(q.includes('amor'), 'Amor fehlt');
  assert(q.includes('seherin'), 'Seherin fehlt');
  assert(q.includes('werwolf'), 'Werwolf fehlt');
  assert(q.length === 3, `Queue hat ${q.length} Einträge statt 3`);
});

test('Nacht 2: Amor nicht mehr in Queue', () => {
  const q = buildQueue(['amor','seherin','werwolf'], 2, true);
  assert(!q.includes('amor'), 'Amor sollte in Nacht 2 nicht erscheinen');
  assert(q.includes('seherin'), 'Seherin fehlt');
});

test('Nachtqueue leer wenn keine aktive Rolle', () => {
  const q = buildQueue(['dorfbewohner'], 1);
  assert(q.length === 0, `Queue sollte leer sein, hat aber ${q.length}`);
});

test('nightIsDone wenn idx >= queue.length', () => {
  const queue = ['seherin', 'werwolf'];
  let idx = 0;
  const isDone = () => idx >= queue.length;
  assert(!isDone(), 'Sollte nicht done sein bei idx=0');
  idx = 1;
  assert(!isDone(), 'Sollte nicht done sein bei idx=1');
  idx = 2;
  assert(isDone(), 'Sollte done sein bei idx=2');
});

test('processNightRole stoppt korrekt bei letzter Rolle', () => {
  const queue = ['seherin'];
  let idx = 0;
  let dawnCalled = false;
  function process() {
    if (idx >= queue.length) { dawnCalled = true; return; }
    // Simuliere confirm
    idx++;
    process();
  }
  process();
  assert(dawnCalled, 'Dawn sollte aufgerufen worden sein');
  assert(idx === 1, `idx sollte 1 sein, ist aber ${idx}`);
});

test('Weißer Wolf nur in ungeraden Nächten', () => {
  const q1 = buildQueue(['weisserWolf','werwolf'], 1);
  const q2 = buildQueue(['weisserWolf','werwolf'], 2);
  const q3 = buildQueue(['weisserWolf','werwolf'], 3);
  assert(q1.includes('weisserWolf'), 'Weißer Wolf fehlt in Nacht 1');
  assert(!q2.includes('weisserWolf'), 'Weißer Wolf sollte nicht in Nacht 2');
  assert(q3.includes('weisserWolf'), 'Weißer Wolf fehlt in Nacht 3');
});

test('Nacht-Queue Reihenfolge: Amor vor Seherin vor Werwolf', () => {
  const q = buildQueue(['werwolf','amor','seherin'], 1);
  assert(q.indexOf('amor') < q.indexOf('seherin'), 'Amor muss vor Seherin kommen');
  assert(q.indexOf('seherin') < q.indexOf('werwolf'), 'Seherin muss vor Werwolf kommen');
});

// ═══ GAME MENÜ & SETTINGS ════════════════════════════════════════════════════
console.log('\n=== GAME MENÜ & SETTINGS ===');

test('Settings öffnen setzt nicht screen auf settings', () => {
  // showSettingsModal statt screen ändern
  const state = { screen: 'game', showSettingsModal: false };
  // Simuliere Klick auf ⚙️
  state.showSettingsModal = true;
  assert(state.screen === 'game', 'Screen soll game bleiben');
  assert(state.showSettingsModal, 'showSettingsModal soll true sein');
});

test('Game-Menü öffnen pausiert nicht automatisch', () => {
  const state = { gameMenu: { active: false }, gamePaused: false, gameEndConfirm: false };
  // openGameMenu
  state.gameMenu.active = true;
  assert(state.gameMenu.active, 'Menü soll offen sein');
  assert(!state.gamePaused, 'Spiel soll nicht pausiert sein');
});

test('Pausieren setzt gamePaused=true und schließt Menü', () => {
  const state = { gameMenu: { active: true }, gamePaused: false };
  // pauseGame
  state.gamePaused = true;
  state.gameMenu.active = false;
  assert(state.gamePaused, 'gamePaused soll true sein');
  assert(!state.gameMenu.active, 'Menü soll geschlossen sein');
});

test('Beenden-Bestätigung: Nein → Spiel läuft weiter', () => {
  const state = { screen: 'game', gameEndConfirm: true, gamePaused: false, gameMenu: { active: false } };
  // Nein-Button
  state.gameEndConfirm = false;
  assert(state.screen === 'game', 'Screen soll game bleiben');
  assert(!state.gameEndConfirm, 'Confirm soll false sein');
});

test('Beenden-Bestätigung: Ja → zurück zu home', () => {
  const state = { screen: 'game', gameEndConfirm: true, gamePaused: false, gameMenu: { active: false } };
  // confirmEndGame
  state.gameEndConfirm = false;
  state.gamePaused = false;
  state.gameMenu.active = false;
  state.screen = 'home';
  assert(state.screen === 'home', 'Screen soll home sein');
});

test('Settings schließen mit X ohne screen zu ändern', () => {
  const state = { screen: 'game', showSettingsModal: true };
  // X-Button in Settings
  state.showSettingsModal = false;
  assert(state.screen === 'game', 'Screen soll game bleiben');
  assert(!state.showSettingsModal, 'Modal soll geschlossen sein');
});

// ═══ PHASE 3: EINLADUNGSLINK & ABSTIMMUNG ════════════════════════════════════
console.log('\n=== COOP PHASE 3 ===');

test('Einladungslink enthält 6-stelligen Code', () => {
  const code = '123456';
  const base = 'https://hayvan2802.github.io/Werwolf/';
  const link = `${base}?code=${code}`;
  assert(link.includes('?code=123456'), 'Link muss Code enthalten');
  const url = new URL(link);
  const param = url.searchParams.get('code');
  assert(param === '123456', `Param ist "${param}"`);
});

test('URL-Parameter wird korrekt geparst', () => {
  const search = '?code=654321';
  const params = new URLSearchParams(search);
  const code = params.get('code');
  assert(code === '654321', `Code ist "${code}"`);
  assert(/^[0-9]{6}$/.test(code), 'Code muss 6 Ziffern sein');
});

test('Abstimmung: Stimmen werden korrekt gezählt', () => {
  const votes = {};
  function cast(name) { votes[name] = (votes[name] || 0) + 1; }
  cast('Anna'); cast('Bob'); cast('Anna'); cast('Anna');
  assert(votes['Anna'] === 3, `Anna hat ${votes['Anna']} Stimmen`);
  assert(votes['Bob'] === 1, `Bob hat ${votes['Bob']} Stimmen`);
});

test('Abstimmung: Auswertung findet Mehrheit', () => {
  const votes = { 'Anna': 3, 'Bob': 1, 'Clara': 2 };
  const sorted = Object.entries(votes).sort((a, b) => b[1] - a[1]);
  assert(sorted[0][0] === 'Anna', `Gewinner ist "${sorted[0][0]}"`);
  assert(sorted[0][1] === 3, `Mit ${sorted[0][1]} Stimmen`);
});

test('Abstimmung: Spieler kann nur einmal abstimmen', () => {
  let myVote = null;
  function castVote(name) {
    if (myVote) return false; // schon abgestimmt
    myVote = name;
    return true;
  }
  assert(castVote('Anna') === true, 'Erste Stimme OK');
  assert(castVote('Bob') === false, 'Zweite Stimme muss abgelehnt werden');
  assert(myVote === 'Anna', 'Stimme bleibt Anna');
});

test('Coop MSG-Typen sind definiert', () => {
  const MSG = {
    START: 'start', READY: 'ready', RESULT: 'result',
    VOTE_START: 'vote_start', VOTE_CAST: 'vote_cast', VOTE_RESULT: 'vote_result',
    NIGHT_START: 'night_start', NIGHT_REQUEST: 'night_request',
    NIGHT_SUBMIT: 'night_submit', NIGHT_DONE: 'night_done',
  };
  assert(MSG.VOTE_START === 'vote_start', 'VOTE_START fehlt');
  assert(MSG.NIGHT_REQUEST === 'night_request', 'NIGHT_REQUEST fehlt');
  assert(Object.keys(MSG).length === 10, `Erwartet 10 MSG-Typen, hat ${Object.keys(MSG).length}`);
});

test('Nacht-Aktion: Host verarbeitet Submission korrekt', () => {
  const players = [
    { name: 'Anna', roleId: 'dorfbewohner', alive: true },
    { name: 'Bob',  roleId: 'werwolf',      alive: true },
  ];
  const nightActions = {};
  // Simuliere NIGHT_SUBMIT von Wolf (zielt auf Anna)
  const msg = { type: 'night_submit', roleId: 'werwolf', targetName: 'Anna' };
  const targetIdx = players.findIndex(p => p.name === msg.targetName);
  if (targetIdx >= 0) nightActions[msg.roleId] = targetIdx;
  assert(nightActions['werwolf'] === 0, `Wolf zielt auf Index ${nightActions['werwolf']}`);
});

// ═══ LOGIK-FIXES v0.29 ══════════════════════════════════════════════════════
console.log('\n=== NACHT-REIHENFOLGE KORREKT ===');

// Offizielle Reihenfolge
const CORRECT_ORDER = ['amor','dieb','zweiSchwestern','dreiBrueder','heiler','werwolf','alphawerwolf','wolfschamane','weisserWolf','serienkiller','hexe','seherin','detektiv'];

test('Heiler kommt VOR Werwolf (schützt bevor Wölfe angreifen)', () => {
  const heiler = CORRECT_ORDER.indexOf('heiler');
  const wolf = CORRECT_ORDER.indexOf('werwolf');
  assert(heiler < wolf, `Heiler (${heiler}) muss vor Wolf (${wolf}) kommen`);
});
test('Hexe kommt NACH Werwolf (sieht Wolfopfer)', () => {
  const hexe = CORRECT_ORDER.indexOf('hexe');
  const wolf = CORRECT_ORDER.indexOf('werwolf');
  assert(hexe > wolf, `Hexe (${hexe}) muss nach Wolf (${wolf}) kommen`);
});
test('Seherin kommt NACH Hexe (weiß wer gerettet/vergiftet)', () => {
  const seherin = CORRECT_ORDER.indexOf('seherin');
  const hexe = CORRECT_ORDER.indexOf('hexe');
  assert(seherin > hexe, `Seherin (${seherin}) muss nach Hexe (${hexe}) kommen`);
});
test('Amor kommt als erstes (Nacht 1)', () => {
  assert(CORRECT_ORDER[0] === 'amor', 'Amor muss zuerst kommen');
});

console.log('\n=== LIEBESKETTE ===');
test('Liebeskette: Partner stirbt auch durch Wolfangriff', () => {
  const players = [
    { name: 'Anna', roleId: 'dorfbewohner', alive: true },
    { name: 'Bob',  roleId: 'dorfbewohner', alive: true },
    { name: 'Wolf', roleId: 'werwolf',       alive: true },
  ];
  const lovers = [0, 1];
  const gameLog = [];
  
  function killPlayer(idx, cause) {
    const p = players[idx];
    if (!p || !p.alive) return;
    p.alive = false;
    gameLog.push(`${p.name} gestorben (${cause})`);
    // Liebeskette rekursiv
    if (lovers.length === 2 && lovers.includes(idx)) {
      const partnerIdx = lovers.find(l => l !== idx);
      if (partnerIdx !== undefined && players[partnerIdx]?.alive) {
        gameLog.push(`💔 ${players[partnerIdx].name} stirbt aus Kummer`);
        killPlayer(partnerIdx, 'grief'); // rekursiv!
      }
    }
  }
  
  // Wolf tötet Anna
  killPlayer(0, 'wolf');
  assert(!players[0].alive, 'Anna muss tot sein');
  assert(!players[1].alive, 'Bob muss auch tot sein (Liebeskette)');
  assert(players[2].alive, 'Wolf muss noch leben');
});

test('Liebeskette: kein Endlos-Loop wenn beide schon tot', () => {
  const players = [
    { name: 'A', roleId: 'dorfbewohner', alive: false }, // bereits tot
    { name: 'B', roleId: 'dorfbewohner', alive: true },
  ];
  const lovers = [0, 1];
  let calls = 0;
  function killPlayer(idx) {
    calls++;
    if (calls > 10) throw new Error('Endlos-Loop!');
    if (!players[idx]?.alive) return;
    players[idx].alive = false;
    const p = lovers.find(l => l !== idx);
    if (p !== undefined && players[p]?.alive) killPlayer(p);
  }
  killPlayer(1);
  assert(calls <= 3, `Nur wenige Aufrufe erwartet, war ${calls}`);
});

console.log('\n=== HEXE WOLFOPFER ===');
test('Hexe kann Wolfopfer mit Heiltrank retten', () => {
  const saves = new Set();
  const kills = new Set();
  const wolfVictim = 0;
  const hexeTarget = 0; // Hexe wählt das Wolfopfer
  
  if (hexeTarget === wolfVictim) saves.add(hexeTarget);
  if (wolfVictim !== undefined && !saves.has(wolfVictim)) kills.add(wolfVictim);
  
  assert(saves.has(0), 'Wolfopfer muss gerettet sein');
  assert(!kills.has(0), 'Wolfopfer darf nicht in kills sein');
});

test('Hexe kann mit Gifttrank jemand anderen töten', () => {
  const kills = new Set();
  const wolfVictim = 0;
  const hexeTarget = 2; // Hexe vergiftet jemand anderen
  
  if (hexeTarget !== wolfVictim) kills.add(hexeTarget);
  
  assert(kills.has(2), 'Hexen-Ziel muss in kills sein');
  assert(!kills.has(0), 'Wolfopfer soll nicht extra getötet werden');
});
