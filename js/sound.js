// sound.js — dezente, synthetisierte Sound-Effekte (WebAudio, keine Audio-Dateien).
// Standardmäßig AUS; wird über die Einstellungen aktiviert (setSoundEnabled).
// Alles in try/catch: Sound darf das Spiel nie stören (z.B. Autoplay-Sperren).

let enabled = false;
let ctx = null;

export function setSoundEnabled(on) { enabled = !!on; }
export function isSoundEnabled() { return enabled; }

function ensureCtx() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

// Einzelner weicher Ton
function tone(freq, duration, { type = 'sine', gain = 0.05, delay = 0 } = {}) {
  const c = ensureCtx();
  const t0 = c.currentTime + delay;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(gain, t0 + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  osc.connect(g).connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.05);
}

// Ereignis-Sounds: kurz, leise, unaufdringlich
export function playSound(kind) {
  if (!enabled) return;
  try {
    switch (kind) {
      case 'reveal':  // Karte aufgedeckt
        tone(520, 0.10); tone(780, 0.14, { delay: 0.08 });
        break;
      case 'vote':    // Stimme abgegeben
        tone(440, 0.08, { type: 'triangle', gain: 0.04 });
        break;
      case 'win':     // Sieg (kleine aufsteigende Fanfare)
        tone(523, 0.12); tone(659, 0.12, { delay: 0.11 }); tone(784, 0.22, { delay: 0.22 });
        break;
      case 'lose':    // Niederlage (absteigend)
        tone(392, 0.14); tone(311, 0.2, { delay: 0.13 });
        break;
    }
  } catch (e) { /* Sound ist optional — niemals werfen */ }
}
