// avatar.js — deterministischer Spieler-Avatar (Emoji + Farbe) aus einem
// Schlüssel (Spielername oder uid). Gleicher Name → immer gleicher Avatar,
// damit alle Geräte in einem Coop-Raum denselben Avatar sehen (rein lokal
// berechnet, kein Transport nötig).

const EMOJIS = [
  '🦊', '🐼', '🐧', '🦁', '🐸', '🦉', '🐙', '🦄', '🐝', '🐬',
  '🦋', '🐺', '🦖', '🐢', '🦝', '🐨', '🦜', '🐳', '🦔', '🐰',
];
const COLORS = [
  '#ef4444', '#f97316', '#f59e0b', '#84cc16', '#22c55e', '#14b8a6',
  '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6', '#d946ef', '#ec4899',
];

// Stabiler djb2-Hash (vorzeichenlos).
function hash(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) >>> 0;
  return h;
}

// { emoji, color } für den übergebenen Schlüssel — deterministisch.
export function avatarFor(key) {
  const h = hash(String(key ?? '?'));
  return {
    emoji: EMOJIS[h % EMOJIS.length],
    color: COLORS[(h >>> 8) % COLORS.length],
  };
}
