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
// Wortpaar für den Undercover-Modus wählen (geteilt lokal/Coop).
// pool: [{ word, category }] → { word, undercoverWord, category }
// Der Imposter bekommt ein ÄHNLICHES Wort — bevorzugt aus derselben Kategorie.
export function pickWordPair(pool) {
  if (!pool || !pool.length) return { word: '', undercoverWord: '', category: '' };
  const main = pool[Math.floor(Math.random() * pool.length)];
  let candidates = pool.filter(e => e.category === main.category && e.word !== main.word);
  if (!candidates.length) candidates = pool.filter(e => e.word !== main.word);
  const second = candidates.length
    ? candidates[Math.floor(Math.random() * candidates.length)]
    : main; // Extremfall: nur 1 Wort im Pool → identisch (Modus greift dann nicht)
  return { word: main.word, undercoverWord: second.word, category: main.category };
}

// Imposter-Rollen um die optionalen Setup-Infos anreichern (geteilt lokal/Coop):
//   knowCategory   → Imposter sehen die Kategorie des Rundenworts
//   knowPartners   → bei 2+ Impostern sehen sie die Namen der Mit-Imposter
//   undercoverWord → UNDERCOVER-MODUS: Imposter bekommen ein ähnliches Wort und
//                    wissen NICHT, dass sie Imposter sind (Kategorie/Partner-
//                    Hinweise entfallen dann bewusst — sie würden alles verraten).
// Mutiert nichts — liefert neue Rollen-Objekte.
export function decorateImposters(roles, { knowCategory = false, knowPartners = false, category = '', undercoverWord = '' } = {}) {
  const imposterNames = roles.filter(r => r.isImposter).map(r => r.name);
  return roles.map(r => {
    if (!r.isImposter) return { ...r };
    if (undercoverWord) return { ...r, word: undercoverWord, undercover: true };
    const extra = {};
    if (knowCategory && category) extra.category = category;
    if (knowPartners && imposterNames.length > 1) {
      extra.partners = imposterNames.filter(n => n !== r.name);
    }
    return { ...r, ...extra };
  });
}

// Zufälligen Startspieler für die Hinweis-Runde wählen (geteilt lokal/Coop).
export function pickStartPlayer(names) {
  if (!names || !names.length) return '';
  return names[Math.floor(Math.random() * names.length)];
}

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
