// game-logic.test.mjs — Spiellogik & Singleplayer↔Multiplayer-Parität.
//
// Ziel (laut Wunsch): Prüfen, dass Einzelgerät- (lokal) und Mehrgerät-Modus (Coop)
// GLEICH ablaufen — nur der Transport unterscheidet sich — und dass die Spiel-
// logik jedes Spiels Sinn ergibt (inkl. Grenzfällen wie „2 gegen 2 → Imposter
// gewinnen automatisch").
//
// Vorgehen je Spiel:
//   • Imposter  → echte, jetzt GETEILTE Logik (js/games/imposter-logic.js); zusätzlich
//                 Quell-Check, dass lokal UND Coop dieselbe Funktion nutzen.
//   • Codenames → echte, geteilte Zug-/Sieglogik (cnRevealCard/cnProcessReveal).
//   • Wer bin ich → echte, geteilte Ergebnis-/Punktelogik (wbiMarkGuessed/…).
//   • Werwolf   → Sieglogik als quell-verankerte Replik + Regex-Check gegen das
//                 echte checkWin (nicht exportiert, in Standalone-App gekoppelt).
//
// Start:  node --import ./test/logic/register-hook.mjs --test test/logic/game-logic.test.mjs
//         (oder: npm run test:logic)

import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = new URL('../../', import.meta.url);
const readSrc = (rel) => readFileSync(fileURLToPath(new URL(rel, ROOT)), 'utf8');

// ════════════════════════════════════════════════════════════════════════════
// IMPOSTER — geteilte Sieglogik (garantiert lokal == Coop)
// ════════════════════════════════════════════════════════════════════════════
describe('Imposter — Sieglogik (lokal & Coop geteilt)', async () => {
  const { calcVoteOutcome, tallyVotes } = await import('../../js/games/imposter-logic.js');
  const P = (defs) => defs.map(([name, isImposter]) => ({ name, isImposter }));
  // Alle stimmen für `target`
  const allVote = (players, target) => Object.fromEntries(players.map(p => [p.name, target]));

  test('Einzelner Imposter rausgewählt → Dorf gewinnt', () => {
    const players = P([['A', true], ['B', false], ['C', false]]);
    assert.equal(calcVoteOutcome(players, allVote(players, 'A')).outcome, 'village');
  });

  test('Falscher rausgewählt (nur 1 Imposter) → Imposter gewinnt', () => {
    // 3 Spieler, 1 Imposter; ein Dörfler raus → 1 Imposter vs 1 Dörfler → Imposter
    const players = P([['A', true], ['B', false], ['C', false]]);
    assert.equal(calcVoteOutcome(players, allVote(players, 'B')).outcome, 'imposter');
  });

  test('GRENZFALL 2 gegen 2: 3 Sucher + 2 Imposter, ein Sucher stirbt → Imposter gewinnen automatisch', () => {
    const players = P([['S1', false], ['S2', false], ['S3', false], ['I1', true], ['I2', true]]);
    const res = calcVoteOutcome(players, allVote(players, 'S1')); // ein Sucher raus
    assert.equal(res.remainingImposters, 2);
    assert.equal(res.remainingVillagers, 2);
    assert.equal(res.outcome, 'imposter'); // Gleichstand ist Imposter-Sieg
  });

  test('Mehrere Imposter: einer raus, aber noch Überzahl Dorf → Runde geht weiter', () => {
    // 6 Spieler: 4 Dorf, 2 Imposter; ein Imposter raus → 4 Dorf vs 1 Imposter
    const players = P([['S1', false], ['S2', false], ['S3', false], ['S4', false], ['I1', true], ['I2', true]]);
    const res = calcVoteOutcome(players, allVote(players, 'I1'));
    assert.equal(res.remainingImposters, 1);
    assert.equal(res.remainingVillagers, 4);
    assert.equal(res.outcome, 'continue');
  });

  test('Letzter Imposter danach rausgewählt → Dorf gewinnt', () => {
    // Zustand nach obiger Runde: I1 entfernt
    const players = P([['S1', false], ['S2', false], ['S3', false], ['S4', false], ['I2', true]]);
    assert.equal(calcVoteOutcome(players, allVote(players, 'I2')).outcome, 'village');
  });

  test('tallyVotes: Stimmen korrekt gezählt, Höchststimmen als eliminated', () => {
    const { tally, eliminated } = tallyVotes(['A', 'B', 'C'], { A: 'B', C: 'B', B: 'A' });
    assert.equal(tally.B, 2);
    assert.equal(tally.A, 1);
    assert.deepEqual(eliminated, ['B']);
  });

  test('Gleichstand → mehrere eliminated; ist der Imposter dabei, gewinnt das Dorf', () => {
    const players = P([['A', true], ['B', false], ['C', false], ['D', false]]);
    // 2:2 zwischen A (Imposter) und B → beide raus → keine Imposter mehr → Dorf
    const res = calcVoteOutcome(players, { A: 'B', C: 'B', B: 'A', D: 'A' });
    assert.ok(res.eliminated.includes('A') && res.eliminated.includes('B'));
    assert.equal(res.outcome, 'village');
  });

  test('Extremfall: totaler Gleichstand (jeder 1 Stimme) → alle raus, Imposter dabei → Dorf', () => {
    const players = P([['A', true], ['B', false], ['C', false]]);
    // Kreis-Voting: jeder bekommt genau 1 Stimme → alle eliminiert
    const res = calcVoteOutcome(players, { A: 'B', B: 'C', C: 'A' });
    assert.equal(res.eliminated.length, 3);
    assert.equal(res.outcome, 'village'); // alle Imposter sind raus
  });

  test('Imposter-Mehrheit direkt nach Abstimmung: 5 Spieler, 2 Imposter, Imposter überstimmen → Imposter-Sieg', () => {
    // 3 Sucher, 2 Imposter — Imposter + 1 Sucher wählen einen Sucher raus → 2 Imposter vs 2 Sucher → vorbei
    const players = P([['S1', false], ['S2', false], ['S3', false], ['I1', true], ['I2', true]]);
    const res = calcVoteOutcome(players, { I1: 'S1', I2: 'S1', S3: 'S1', S1: 'I1', S2: 'I1' });
    assert.deepEqual(res.eliminated, ['S1']);
    assert.equal(res.outcome, 'imposter');
  });
});

describe('Imposter — Parität lokal↔Coop (Quell-Check)', () => {
  const app = readSrc('js/app.js');
  test('Lokal UND Coop nutzen dieselbe geteilte calcVoteOutcome', () => {
    const calls = (app.match(/calcVoteOutcome\(/g) || []).length;
    assert.equal(calls, 2, 'Erwartet genau 2 Aufrufe: calcResult (lokal) + calcCoopResult (Coop)');
    assert.ok(/import \{ calcVoteOutcome \} from '\.\/games\/imposter-logic\.js'/.test(app));
  });
  test('Keine zweite, inline duplizierte Sieglogik mehr im lokalen calcResult', () => {
    // Die Gewinnbedingung darf nur EINMAL (im Coop-Zweig, über destrukturierte Werte) vorkommen
    const occurrences = (app.match(/remainingImposters >= remainingVillagers/g) || []).length;
    assert.ok(occurrences <= 1, `Sieglogik ${occurrences}× inline — sollte in imposter-logic.js zentralisiert sein`);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// CODENAMES — geteilte Zug-/Sieglogik (lokal & Coop identisch)
// ════════════════════════════════════════════════════════════════════════════
describe('Codenames — Sieglogik (echte, geteilte Funktionen)', async () => {
  const cn = await import('../../js/games/codenames.js');
  const { cnState, cnStartLocal, cnRevealCard, CN_TYPE } = cn;

  // Kontrolliertes Brett aufsetzen (statt zufälligem Grid)
  function setupBoard(types, currentTeam = 'red') {
    cnStartLocal();
    cnState.words       = types.map((t, i) => ({ word: `W${i}`, type: t, revealed: false }));
    cnState.secretTypes = [...types];
    cnState.redLeft     = types.filter(t => t === CN_TYPE.RED).length;
    cnState.blueLeft    = types.filter(t => t === CN_TYPE.BLUE).length;
    cnState.currentTeam = currentTeam;
    cnState.phase2      = 'guess';
    cnState.guessesLeft = 5;
    cnState.winner      = null;
    cnState.coop.phase  = 'idle'; // lokal → keine Coop-Sends
  }

  test('Schwarze Karte (Attentäter) → sofort verloren, anderes Team gewinnt', () => {
    setupBoard([CN_TYPE.BLACK, CN_TYPE.RED, CN_TYPE.BLUE], 'red');
    cnRevealCard(0);
    assert.equal(cnState.winner, 'blue');
    assert.equal(cnState.winReason, 'black-card');
    assert.equal(cnState.phase, 'gameover');
  });

  test('Letzte eigene Karte aufgedeckt → eigenes Team gewinnt (all-found)', () => {
    setupBoard([CN_TYPE.RED, CN_TYPE.BLUE, CN_TYPE.NEUTRAL], 'red'); // nur 1 rote Karte
    cnRevealCard(0);
    assert.equal(cnState.winner, 'red');
    assert.equal(cnState.winReason, 'all-found');
  });

  test('Neutrale Karte → Zug wechselt zum anderen Team, kein Sieg', () => {
    setupBoard([CN_TYPE.NEUTRAL, CN_TYPE.RED, CN_TYPE.RED, CN_TYPE.BLUE], 'red');
    cnRevealCard(0);
    assert.equal(cnState.winner, null);
    assert.equal(cnState.currentTeam, 'blue');
    assert.equal(cnState.phase2, 'hint');
  });

  test('Parität: Coop-Sends sind nur an coop.phase===playing gekoppelt (Quell-Check)', () => {
    const src = readSrc('js/games/codenames.js');
    // Jeder Coop.send im Spielzug steht hinter der Bedingung — Logik selbst ist modusneutral
    assert.ok(/if \(cnState\.coop\.phase === 'playing'\)\s*\{\s*Coop\.send/.test(src));
  });

  test('Hinweis „2" → 3 Rateversuche (Bonus); nach Verbrauch wechselt der Zug', () => {
    setupBoard([CN_TYPE.RED, CN_TYPE.RED, CN_TYPE.RED, CN_TYPE.RED, CN_TYPE.BLUE, CN_TYPE.BLUE], 'red');
    cnState.phase2 = 'hint';
    cnState.hintDraft = 'Tiere';
    cnState.hintCountDraft = 2;
    cn.cnGiveHint();
    assert.equal(cnState.guessesLeft, 3, 'Anzahl + 1 Bonus');
    assert.equal(cnState.phase2, 'guess');
    cnRevealCard(0); // richtig → 2 übrig
    cnRevealCard(1); // richtig → 1 übrig
    assert.equal(cnState.guessesLeft, 1);
    cnRevealCard(2); // richtig → Versuche aufgebraucht → Zugwechsel
    assert.equal(cnState.currentTeam, 'blue');
    assert.equal(cnState.phase2, 'hint');
    assert.equal(cnState.winner, null);
  });

  test('Gegnerische Karte aufgedeckt → deren letzte → GEGNER gewinnt sofort', () => {
    setupBoard([CN_TYPE.BLUE, CN_TYPE.RED, CN_TYPE.RED], 'red'); // blau hat nur 1 Karte
    cnRevealCard(0); // rot deckt die letzte blaue Karte auf
    assert.equal(cnState.winner, 'blue', 'die aufgedeckte Farbe gewinnt — egal wer aufdeckt');
    assert.equal(cnState.winReason, 'all-found');
  });
});

// ════════════════════════════════════════════════════════════════════════════
// WER BIN ICH — geteilte Ergebnis-/Punktelogik
// ════════════════════════════════════════════════════════════════════════════
describe('Wer bin ich — Ergebnis & Punkte (echte Funktionen)', async () => {
  const wbi = await import('../../js/games/werbinich.js');
  const { wbiState, wbiStartLocal, wbiMarkGuessed, wbiMarkNotGuessed } = wbi;

  beforeEach(() => {
    wbiState.playerNames = ['Alice', 'Bob', 'Clara'];
    wbiState.playerCount = 3;
    wbiStartLocal();
    wbiState.localPhase = 'resolve'; // direkt in die Auflösung
  });

  test('Erraten → Punkt für den Spieler, Karte als guessed markiert', () => {
    wbiMarkGuessed(0);
    const name = wbiState.localCards[0].playerName;
    assert.equal(wbiState.localCards[0].guessed, true);
    assert.equal(wbiState.scores[name], 1);
  });

  test('Nicht erraten → skipped, kein Punkt', () => {
    wbiMarkNotGuessed(1);
    const name = wbiState.localCards[1].playerName;
    assert.equal(wbiState.localCards[1].skipped, true);
    assert.ok(!wbiState.scores[name]);
  });

  test('Alle abgehandelt → Ergebnisphase, results gefüllt', () => {
    wbiMarkGuessed(0);
    wbiMarkNotGuessed(1);
    wbiMarkGuessed(2);
    assert.equal(wbiState.phase, 'result');
    assert.equal(wbiState.results.length, 3);
    assert.equal(wbiState.results.filter(r => r.guessed).length, 2);
  });

  test('Jeder Spieler bekommt eine Karte — auch mehr Spieler als Kartenpool', () => {
    // localCards deckt immer alle Spieler ab (Pool wird modulo wiederverwendet)
    assert.equal(wbiState.localCards.length, 3);
    wbiState.localCards.forEach(c => {
      assert.ok(c.word && c.word !== '', `${c.playerName} hat eine Karte`);
      assert.equal(c.guessed, false);
      assert.equal(c.skipped, false);
    });
  });

  test('Nicht fertig, solange eine Karte offen ist', () => {
    wbiMarkGuessed(0);
    wbiMarkNotGuessed(1);
    // Karte 2 noch offen → keine Ergebnisphase
    assert.notEqual(wbiState.phase, 'result');
  });
});

// ════════════════════════════════════════════════════════════════════════════
// WERWOLF — Sieglogik (quell-verankerte Replik von checkWin)
// ════════════════════════════════════════════════════════════════════════════
describe('Werwolf — Sieglogik', () => {
  // Replik von js/games/werwolf/js/app.js:checkWin (dort nicht exportiert & an die
  // Standalone-App gekoppelt). Der Quell-Check unten stellt sicher, dass diese
  // Replik nicht vom echten Code abweicht.
  function werwolfWinner(players, lovers = []) {
    const alive  = players.filter(p => p.alive);
    const wolves = alive.filter(p => p.team === 'wolf');
    const dorf   = alive.filter(p => p.team === 'dorf');
    const solo   = alive.filter(p => p.team === 'solo');
    if (lovers.length === 2) {
      const la = lovers.filter(i => players[i]?.alive);
      if (la.length === 2 && alive.length === 2) return 'lovers';
    }
    if (alive.length === 1 && solo.length === 1) return 'solo';
    if (wolves.length > 0 && wolves.length >= dorf.length + solo.length) return 'wolf';
    if (wolves.length === 0) return 'dorf';
    return null;
  }
  const mk = (defs) => defs.map(([team, alive]) => ({ team, alive }));

  test('Alle Wölfe tot → Dorf gewinnt', () => {
    assert.equal(werwolfWinner(mk([['dorf', true], ['dorf', true], ['wolf', false]])), 'dorf');
  });

  test('GRENZFALL 2 gegen 2 (wie Imposter): Wölfe >= Dorf → Wölfe gewinnen', () => {
    // 3 Dorf + 2 Wolf, ein Dorf stirbt → 2 Dorf vs 2 Wolf
    assert.equal(werwolfWinner(mk([['dorf', true], ['dorf', true], ['dorf', false], ['wolf', true], ['wolf', true]])), 'wolf');
  });

  test('Noch Dorf-Überzahl → kein Sieger, Spiel läuft weiter', () => {
    assert.equal(werwolfWinner(mk([['dorf', true], ['dorf', true], ['dorf', true], ['wolf', true]])), null);
  });

  test('Nur Solo-Rolle übrig → Solo gewinnt', () => {
    assert.equal(werwolfWinner(mk([['solo', true], ['dorf', false], ['wolf', false]])), 'solo');
  });

  test('Verliebte als letzte Zwei → Liebespaar gewinnt', () => {
    const players = mk([['dorf', true], ['wolf', true], ['dorf', false]]);
    assert.equal(werwolfWinner(players, [0, 1]), 'lovers');
  });

  test('Quell-Check: echtes checkWin enthält exakt diese Bedingungen (kein Drift)', () => {
    const src = readSrc('js/games/werwolf/js/app.js');
    assert.equal((src.match(/function checkWin\(/g) || []).length, 1, 'checkWin genau 1× definiert (einzige Sieg-Instanz)');
    assert.ok(/wolves\.length >= dorf\.length \+ solo\.length/.test(src), 'Wolf-Siegbedingung');
    assert.ok(/wolves\.length === 0/.test(src), 'Dorf-Siegbedingung');
    assert.ok(/alive\.length === 1 && solo\.length === 1/.test(src), 'Solo-Siegbedingung');
    assert.ok(/state\.lovers\.length === 2/.test(src), 'Verliebten-Siegbedingung');
  });
});

// ════════════════════════════════════════════════════════════════════════════
// WERWOLF — Hexe: Trank-Entscheidung und -Auflösung müssen übereinstimmen
// ════════════════════════════════════════════════════════════════════════════
describe('Werwolf — Hexe (Heil-/Gifttrank)', () => {
  // Replik der korrigierten Logik: confirmNight entscheidet (hexeAction),
  // resolveNight wirkt NUR über diese Entscheidung.
  function hexeDecide(selection, wolfVictim, flags) {
    if (selection === wolfVictim && !flags.healUsed) { flags.healUsed = true; return 'heal'; }
    if (!flags.poisonUsed) { flags.poisonUsed = true; return 'poison'; }
    return null;
  }
  function hexeResolve(action, target, wolfVictim) {
    const saves = new Set(); const kills = new Set();
    if (action === 'heal') saves.add(target);
    else if (action === 'poison') kills.add(target);
    if (wolfVictim !== undefined && !saves.has(wolfVictim)) kills.add(wolfVictim);
    return { saved: [...saves], dead: [...kills] };
  }

  test('Heiltrank rettet das Wolfsopfer', () => {
    const flags = { healUsed: false, poisonUsed: false };
    const action = hexeDecide(3, 3, flags);
    assert.equal(action, 'heal');
    assert.deepEqual(hexeResolve(action, 3, 3).dead, []);
  });

  test('Gifttrank tötet ein anderes Ziel (Wolfsopfer stirbt zusätzlich)', () => {
    const flags = { healUsed: false, poisonUsed: false };
    const action = hexeDecide(5, 3, flags);
    assert.equal(action, 'poison');
    assert.deepEqual(hexeResolve(action, 5, 3).dead.sort(), [3, 5]);
  });

  test('KORRIGIERTER BUG: Heiltrank verbraucht + Ziel = Wolfsopfer → Gift wirkt (Opfer stirbt)', () => {
    const flags = { healUsed: true, poisonUsed: false };
    const action = hexeDecide(3, 3, flags);
    assert.equal(action, 'poison', 'ohne Heiltrank ist die Wahl des Opfers ein Gifttrank');
    assert.ok(hexeResolve(action, 3, 3).dead.includes(3), 'das Opfer darf NICHT fälschlich gerettet werden');
  });

  test('Beide Tränke verbraucht → keine Wirkung (nur Wolfsopfer stirbt)', () => {
    const flags = { healUsed: true, poisonUsed: true };
    const action = hexeDecide(5, 3, flags);
    assert.equal(action, null);
    assert.deepEqual(hexeResolve(action, 5, 3).dead, [3]);
  });

  test('Quell-Check: resolveNight nutzt state.hexeAction (nicht den Ziel-Vergleich)', () => {
    const src = readSrc('js/games/werwolf/js/app.js');
    assert.ok(/state\.hexeAction === 'heal'\) saves\.add/.test(src), 'Heilung über hexeAction');
    assert.ok(/state\.hexeAction === 'poison'\) kills\.add/.test(src), 'Gift über hexeAction');
    assert.ok(/state\.hexeAction = 'heal'/.test(src) && /state\.hexeAction = 'poison'/.test(src),
      'confirmNight setzt die Entscheidung');
  });
});

// ════════════════════════════════════════════════════════════════════════════
// WERWOLF — Jäger: Rache-Schuss, Liebeskette, Ablauf-Reihenfolge
// ════════════════════════════════════════════════════════════════════════════
describe('Werwolf — Jäger (Rache-Schuss)', () => {
  const src = readSrc('js/games/werwolf/js/app.js');

  test('Verliebter Jäger stirbt → Liebeskette läuft trotzdem (kein früher return)', () => {
    // Der Jäger-Zweig in killPlayer darf die Funktion nicht mehr verlassen,
    // sonst überlebt der Partner des verliebten Jägers.
    assert.ok(!/state\.jaegerModal = \{ active: true, cause \};\s*return;/.test(src),
      'kein return direkt nach dem Öffnen des Jäger-Modals');
    // Liebeskette existiert weiterhin rekursiv
    assert.ok(/killPlayer\(partnerIdx, 'grief'\)/.test(src));
  });

  test('Jäger-Ziel stirbt über killPlayer (löst dessen Rollen-Mechanik aus)', () => {
    assert.ok(/function confirmJaeger[\s\S]{0,400}killPlayer\(targetIdx, 'jaeger'\)/.test(src),
      'confirmJaeger nutzt killPlayer statt rohem alive=false');
  });

  test('Sieg wird erst NACH aufgelöstem Jäger-Schuss gewertet', () => {
    assert.ok(/function checkWin\(\) \{[\s\S]{0,200}if \(state\.jaegerModal\.active\) return false;/.test(src),
      'checkWin wartet auf den Schuss');
  });

  test('Tages-Hinrichtung des Jägers schiebt den Nachtstart auf', () => {
    assert.ok(/if \(state\.jaegerModal\.active\) \{ state\.afterJaeger = 'endDay'; return; \}/.test(src),
      'confirmDay wartet auf den Schuss, bevor die Nacht beginnt');
    assert.ok(/state\.afterJaeger === 'endDay'/.test(src), 'confirmJaeger setzt den Tag fort');
  });

  test('Jäger-Modal hat die Aufplopp-Animation (UI)', () => {
    assert.ok(/jaeger-modal/.test(src), 'Template nutzt die Animations-Klasse');
    for (const cssFile of ['js/games/werwolf/css/styles.css', 'js/games/werwolf/css/styles.shadow.css']) {
      const css = readSrc(cssFile);
      assert.ok(/@keyframes jaegerPop/.test(css), `${cssFile}: Pop-Animation definiert`);
      assert.ok(/\.jaeger-modal\{animation:jaegerPop/.test(css), `${cssFile}: Modal animiert`);
    }
  });
});
