// storage.js — Persistenz via localStorage
import { DEFAULT_SETTINGS } from './config.js';
import { log } from './debuglog.js';

const K = {
  SETTINGS:     'gs_settings',
  SEEN_VERSION: 'gs_seen_version',
  LAST_NAMES:   'gs_last_names',
  CONFIGS:      'gs_configs',
  USERNAME:     'gs_username',
};

function load(key, fb) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fb; }
  catch (e) { log('storage', `Laden "${key}" fehlgeschlagen`, e); return fb; }
}
function save(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); }
  catch (e) { log('storage', `Speichern "${key}" fehlgeschlagen`, e); }
}

export function loadSettings()      { return { ...DEFAULT_SETTINGS, ...load(K.SETTINGS, {}) }; }
export function saveSettings(s)     { save(K.SETTINGS, s); }
export function loadSeenVersion()   { return load(K.SEEN_VERSION, null); }
export function saveSeenVersion(v)  { save(K.SEEN_VERSION, v); }
export function loadLastNames()     { return load(K.LAST_NAMES, []); }
export function saveLastNames(n)    { save(K.LAST_NAMES, n.slice(0, 40)); }
export function loadConfigs()       { return load(K.CONFIGS, []); }
export function saveConfig(cfg) {
  const list = loadConfigs().filter(c => c.id !== cfg.id);
  list.unshift(cfg);
  save(K.CONFIGS, list.slice(0, 8));
}
export function deleteConfig(id)    { save(K.CONFIGS, loadConfigs().filter(c => c.id !== id)); }
// Geräteweiter Benutzername — vorbelegt in allen Coop-Namensfeldern, in den
// Einstellungen änderbar. Geteilt mit Werwolf (dort via 'gs_username').
export function loadUserName()      { return load(K.USERNAME, ''); }
export function saveUserName(n)     { save(K.USERNAME, (n || '').slice(0, 20)); }
