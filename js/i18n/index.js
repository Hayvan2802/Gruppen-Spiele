// i18n/index.js — Sprachauswahl und t()-Funktion
import de from './de.js';
import en from './en.js';
import tr from './tr.js';
import fr from './fr.js';
import es from './es.js';
import it from './it.js';
import pl from './pl.js';
import ru from './ru.js';
import ar from './ar.js';

export const SUPPORTED_LOCALES = [
  { id: 'de', label: '🇩🇪 Deutsch', rtl: false },
  { id: 'en', label: '🇬🇧 English', rtl: false },
  { id: 'tr', label: '🇹🇷 Türkçe',  rtl: false },
  { id: 'fr', label: '🇫🇷 Français', rtl: false },
  { id: 'es', label: '🇪🇸 Español', rtl: false },
  { id: 'it', label: '🇮🇹 Italiano', rtl: false },
  { id: 'pl', label: '🇵🇱 Polski',  rtl: false },
  { id: 'ru', label: '🇷🇺 Русский', rtl: false },
  { id: 'ar', label: '🇸🇦 العربية', rtl: true  },
];

const STRINGS = { de, en, tr, fr, es, it, pl, ru, ar };

export const i18nState = { locale: 'de', rtl: false };

export function setLocale(id) {
  if (!STRINGS[id]) return;
  i18nState.locale = id;
  i18nState.rtl = SUPPORTED_LOCALES.find(l => l.id === id)?.rtl ?? false;
  document.documentElement.dir = i18nState.rtl ? 'rtl' : 'ltr';
  document.documentElement.lang = id;
}

export function detectLocale(saved) {
  if (saved && STRINGS[saved]) return saved;
  const lang = navigator.language?.slice(0, 2);
  return STRINGS[lang] ? lang : 'de';
}

export function t(key) {
  const parts = key.split('.');
  let obj = STRINGS[i18nState.locale] ?? STRINGS.de;
  for (const p of parts) {
    obj = obj?.[p];
    if (obj === undefined) break;
  }
  if (obj === undefined) {
    // Fallback zu Deutsch
    obj = STRINGS.de;
    for (const p of parts) { obj = obj?.[p]; }
  }
  return typeof obj === 'string' ? obj : key;
}

