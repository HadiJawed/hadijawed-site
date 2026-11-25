// Appearance: 'dark' (default) or 'light'. Stored with the rest of the data,
// and cached in localStorage so the right theme shows before the data loads.
const CACHE = 'ft-theme';
const COLORS = { dark: '#070A1A', light: '#2438F0' };

export function applyTheme(theme) {
  let t = theme;
  if (!t) { try { t = localStorage.getItem(CACHE); } catch { /* storage blocked */ } }
  t = t === 'light' ? 'light' : 'dark';
  document.documentElement.dataset.theme = t;
  document.querySelector('meta[name=theme-color]')?.setAttribute('content', COLORS[t]);
  try { localStorage.setItem(CACHE, t); } catch { /* storage blocked */ }
  return t;
}
