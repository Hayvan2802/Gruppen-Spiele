// imposter-logic.js — Reine Imposter-Spiellogik, geteilt von LOKAL und COOP.
//
// Wichtig: Einzelgerät- (lokal) und Mehrgerät-Modus (Coop) sollen exakt gleich
// ablaufen — nur der Transport unterscheidet sich. Damit die Sieg-/Ablauflogik
// nicht in zwei Kopien auseinanderdriftet, lebt sie hier als EINE Quelle und wird
// von `calcResult` (lokal) und `calcCoopResult` (Coop) in js/app.js genutzt.

// Stimmen auszählen → { tally, eliminated, max }.
// `eliminated` sind die Namen mit den meisten Stimmen (bei Gleichstand mehrere).
export function tallyVotes(names, votes) {
  const tally = {};
  names.forEach(n => { tally[n] = 0; });
  Object.values(votes).forEach(t => { tally[t] = (tally[t] || 0) + 1; });
  const values = Object.values(tally);
  const max = values.length ? Math.max(...values) : 0;
  const eliminated = Object.keys(tally).filter(n => tally[n] === max);
  return { tally, eliminated, max };
}

// Ergebnis einer Abstimmungsrunde bestimmen.
//   players: [{ name, isImposter }]
//   votes:   { waehlerName: gewaehlterName }
// → {
//     tally, eliminated, imposters,
//     remainingImposters, remainingVillagers,
//     outcome: 'village' | 'imposter' | 'continue'
//   }
//
// Gewinnbedingungen (identisch für lokal & Coop):
//   • Dorf gewinnt     → alle Imposter eliminiert (remainingImposters === 0)
//   • Imposter gewinnen → Imposter >= Dörfler (Gleichstand ist Imposter-Sieg;
//                          z. B. 3 Sucher + 2 Imposter, ein Sucher stirbt → 2:2)
//   • sonst            → nächste Abstimmungsrunde ('continue')
export function calcVoteOutcome(players, votes) {
  const names = players.map(p => p.name);
  const { tally, eliminated } = tallyVotes(names, votes);
  const imposters = players.filter(p => p.isImposter).map(p => p.name);

  const remaining          = players.filter(p => !eliminated.includes(p.name));
  const remainingImposters = remaining.filter(p => p.isImposter).length;
  const remainingVillagers = remaining.filter(p => !p.isImposter).length;

  let outcome;
  if (remainingImposters === 0) outcome = 'village';
  else if (remainingImposters >= remainingVillagers) outcome = 'imposter';
  else outcome = 'continue';

  return { tally, eliminated, imposters, remainingImposters, remainingVillagers, outcome };
}
