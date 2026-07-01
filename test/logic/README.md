# Spiellogik- & Paritätstests

Prüft für **jedes Spiel**, dass die Spiellogik Sinn ergibt und dass der
**Singleplayer- (Einzelgerät) und Multiplayer- (Coop) Modus gleich ablaufen** —
der einzige Unterschied soll der Transport sein (ein Gerät vs. eigene Geräte).

```bash
npm run test:logic
```

Läuft offline gegen die **echten** Spielmodule (per Loader-Hook werden nur
Browser-Abhängigkeiten gestubbt: Vue → `vue-shim.mjs`, Firebase →
`../coop/fake-firebase.mjs`). In CI im Job „Unit Tests" verdrahtet.

## Was geprüft wird

| Spiel | Wie | Kernpunkte |
|-------|-----|-----------|
| **Imposter** | echte, jetzt **geteilte** Logik `js/games/imposter-logic.js` | Sieg-/Fortsetzungsbedingungen inkl. Grenzfall **2 gegen 2 → Imposter gewinnen automatisch**; Quell-Check, dass lokal (`calcResult`) und Coop (`calcCoopResult`) **dieselbe** Funktion nutzen → Parität garantiert |
| **Codenames** | echte, geteilte `cnRevealCard`/`cnProcessReveal` | Schwarze Karte → sofort verloren; letzte eigene Karte → Sieg; neutrale Karte → Zugwechsel; Coop-Sends nur an `coop.phase` gekoppelt |
| **Wer bin ich** | echte `wbiMarkGuessed`/`wbiMarkNotGuessed` | Erraten → Punkt; übersprungen → kein Punkt; alle erledigt → Ergebnisphase |
| **Werwolf** | quell-verankerte Replik von `checkWin` + Regex-Check gegen echten Code | Wölfe ≥ Dorf+Solo → Wolfsieg (analog 2 gegen 2); keine Wölfe → Dorf; Solo; Verliebte |

## Hintergrund: Parität

Codenames, Wer bin ich und Werwolf teilen ihre Sieg-/Ablauflogik ohnehin schon
zwischen beiden Modi (dieselben Funktionen, nur zusätzliche `Coop.send`-Aufrufe
hinter `coop.phase === 'playing'`). **Imposter** hatte die Sieglogik früher
**doppelt** (lokal *und* Coop) — jetzt in `js/games/imposter-logic.js`
zentralisiert, sodass beide Modi nicht mehr auseinanderdriften können.

Dateien: `vue-shim.mjs`, `hook.mjs`, `register-hook.mjs`, `game-logic.test.mjs`.
