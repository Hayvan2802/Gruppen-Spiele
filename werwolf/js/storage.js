// storage.js — Persistenz via localStorage
import { DEFAULT_SETTINGS } from './config.js';
import { log } from './debuglog.js';

const KEYS = {
  SETTINGS:     'ww_settings',
  SEEN_VERSION: 'ww_seen_version',
  LAST_NAMES:   'ww_last_names',
  CONFIGS:      'ww_configs',
  STATS:        'ww_stats',
};

function load(key, fallback) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
  catch (e) { log('storage', `Laden von "${key}" fehlgeschlagen`, e); return fallback; }
}
function save(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); }
  catch (e) { log('storage', `Speichern von "${key}" fehlgeschlagen`, e); }
}

// ─── Einstellungen ────────────────────────────────────────────────────────────
export function loadSettings() { return { ...DEFAULT_SETTINGS, ...load(KEYS.SETTINGS, {}) }; }
export function saveSettings(s) { save(KEYS.SETTINGS, s); }

// ─── Versionscheck ────────────────────────────────────────────────────────────
export function loadSeenVersion() { return load(KEYS.SEEN_VERSION, null); }
export function saveSeenVersion(v) { save(KEYS.SEEN_VERSION, v); }

// ─── Spielernamen merken ──────────────────────────────────────────────────────
export function loadLastNames() { return load(KEYS.LAST_NAMES, []); }
export function saveLastNames(names) { save(KEYS.LAST_NAMES, names.slice(0, 40)); }

// ─── Lieblingskonfigurationen ─────────────────────────────────────────────────
// Config: { id, name, playerCount, playerNames, selectedRoles, createdAt }
export function loadConfigs() { return load(KEYS.CONFIGS, []); }
export function saveConfig(cfg) {
  const list = loadConfigs().filter(c => c.id !== cfg.id);
  list.unshift(cfg);
  save(KEYS.CONFIGS, list.slice(0, 8)); // max 8 gespeicherte Konfigurationen
}
export function deleteConfig(id) {
  save(KEYS.CONFIGS, loadConfigs().filter(c => c.id !== id));
}

// ─── Spielstatistiken ─────────────────────────────────────────────────────────
// Stats: { games: [{winner, players:[{name,roleId,survived}], date}] }
export function loadStats() { return load(KEYS.STATS, { games: [] }); }
export function saveGameResult(result) {
  const stats = loadStats();
  stats.games.unshift({ ...result, date: Date.now() });
  if (stats.games.length > 200) stats.games = stats.games.slice(0, 200);
  save(KEYS.STATS, stats);
}
