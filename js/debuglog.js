// debuglog.js — Persistentes Diagnoseprotokoll (localStorage).
// Rein lokal, enthält keine Spieldaten — nur Zeitstempel, Kategorie,
// Meldung und ggf. Fehlercode. Zweck: Verbindungsprobleme nachvollziehbar machen.

const KEY = 'ww_debuglog';
const MAX_ENTRIES = 400;
const JANK_THRESHOLD_MS = 200; // Frames die länger als 200 ms dauern

function read() {
  try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch { return []; }
}
function write(entries) {
  try { localStorage.setItem(KEY, JSON.stringify(entries)); } catch {}
}
function serializeExtra(extra) {
  if (extra instanceof Error || (extra && typeof extra === 'object' && ('code' in extra || 'message' in extra))) {
    return { code: extra.code, message: extra.message, name: extra.name };
  }
  return extra;
}

export function log(category, message, extra) {
  const entry = { ts: Date.now(), category, message };
  if (extra !== undefined) entry.extra = serializeExtra(extra);
  const entries = read();
  entries.push(entry);
  while (entries.length > MAX_ENTRIES) entries.shift();
  write(entries);
}

export function getLog() { return read(); }
export function clearLog() { write([]); }

// ── Geräte-Schnappschuss beim Start ──────────────────────────────────────────
export function logDeviceSnapshot() {
  const nav = navigator;
  log('start', 'Geräte-Snapshot', {
    ua: nav.userAgent,
    lang: nav.language,
    online: nav.onLine,
    cores: nav.hardwareConcurrency,
    mem: nav.deviceMemory,
    screen: `${screen.width}x${screen.height}@${devicePixelRatio}x`,
    viewport: `${window.innerWidth}x${window.innerHeight}`,
    storage: (() => { try { return nav.storage ? 'ok' : 'n/a'; } catch { return 'err'; } })(),
    sw: 'serviceWorker' in nav,
  });
}

// ── Unbehandelte Fehler abfangen ──────────────────────────────────────────────
export function installGlobalErrorHandlers() {
  window.addEventListener('error', (e) => {
    log('error', e.message || 'Unbekannter Fehler', {
      file: e.filename, line: e.lineno, col: e.colno,
      stack: e.error?.stack?.slice(0, 300),
    });
  });
  window.addEventListener('unhandledrejection', (e) => {
    const msg = e.reason instanceof Error ? e.reason.message : String(e.reason ?? 'Promise rejected');
    log('error', `Unhandled Promise: ${msg}`, { stack: e.reason?.stack?.slice(0, 300) });
  });
}

// ── Jank-Erkennung (Frames > JANK_THRESHOLD_MS) ──────────────────────────────
export function installJankDetector() {
  let last = 0;
  const tick = (ts) => {
    if (last && ts - last > JANK_THRESHOLD_MS) {
      log('perf', `Jank: ${Math.round(ts - last)} ms Frame-Pause`);
    }
    last = ts;
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

export async function exportLogToFile() {
  const { BUILD } = await import('./buildinfo.js');
  const entries = read();
  const lines = entries.map(e => {
    const time = new Date(e.ts).toISOString();
    const extra = e.extra !== undefined ? ' ' + JSON.stringify(e.extra) : '';
    return `[${time}] [${e.category}] ${e.message}${extra}`;
  });
  const header = `Werwolf – Diagnoseprotokoll\nVersion: ${BUILD}\nUserAgent: ${navigator.userAgent}\nExportiert: ${new Date().toISOString()}\n\n`;
  const text = header + (lines.join('\n') || '(leer)');
  const filename = `werwolf-diagnose-${Date.now()}.txt`;
  const blob = new Blob([text], { type: 'text/plain' });
  if (navigator.canShare) {
    try {
      const file = new File([blob], filename, { type: 'text/plain' });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Werwolf Diagnose' });
        return;
      }
    } catch (e) { if (e.name === 'AbortError') return; }
  }
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

