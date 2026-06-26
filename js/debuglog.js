// debuglog.js — Diagnoseprotokoll (localStorage)
const KEY = 'gs_debuglog';
const MAX = 400;

function read() { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch { return []; } }
function write(e) { try { localStorage.setItem(KEY, JSON.stringify(e)); } catch {} }

export function log(category, message, extra) {
  const entry = { ts: Date.now(), category, message };
  if (extra !== undefined) entry.extra = (extra instanceof Error) ? { message: extra.message, name: extra.name } : extra;
  const entries = read();
  entries.push(entry);
  while (entries.length > MAX) entries.shift();
  write(entries);
}
export function getLog() { return read(); }
export function clearLog() { write([]); }
