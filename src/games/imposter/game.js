/* ============================================
   IMPOSTER – Spiellogik
   Version: 1.0.0
   Reine Logik, kein UI-Code hier.
   ============================================ */

function shuffleArray(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function createRoles(namen, imposterAnzahl) {
  const wort        = getRandomWord();
  const gemischt    = shuffleArray(namen);
  const imposterIdx = new Set(
    shuffleArray([...Array(gemischt.length).keys()]).slice(0, imposterAnzahl)
  );

  return gemischt.map((name, i) => ({
    name,
    istImposter: imposterIdx.has(i),
    wort,
  }));
}

function zaehleStimmen(rollen, stimmen) {
  const zaehlung = {};
  rollen.forEach(r => { zaehlung[r.name] = 0; });
  Object.values(stimmen).forEach(ziel => {
    zaehlung[ziel] = (zaehlung[ziel] || 0) + 1;
  });
  return zaehlung;
}

function berechneErgebnis(rollen, stimmen) {
  const zaehlung      = zaehleStimmen(rollen, stimmen);
  const maxStimmen    = Math.max(...Object.values(zaehlung));
  const rausgeworfen  = Object.keys(zaehlung).filter(n => zaehlung[n] === maxStimmen);
  const imposterNamen = rollen.filter(r => r.istImposter).map(r => r.name);
  const imposterErwischt = rausgeworfen.some(n => imposterNamen.includes(n));

  return { zaehlung, rausgeworfen, imposterNamen, imposterErwischt };
}
