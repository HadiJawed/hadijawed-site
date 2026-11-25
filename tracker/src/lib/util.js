// Dates are stored as local 'YYYY-MM-DD' strings so they never shift with time zones.
export const pad = n => String(n).padStart(2, '0');
export const toISO = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const today = () => toISO(new Date());
export const parse = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
export const monthKey = s => s.slice(0, 7);
export const thisMonth = () => today().slice(0, 7);
export const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return toISO(d); };
export const addMonths = (s, n) => {
  const d = parse(s), day = d.getDate();
  d.setDate(1); d.setMonth(d.getMonth() + n);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, last));
  return toISO(d);
};
export const shiftMonth = (key, n) => addMonths(key + '-01', n).slice(0, 7);
export const daysInMonth = key => { const [y, m] = key.split('-').map(Number); return new Date(y, m, 0).getDate(); };

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const monthName = (key, short) => { const m = MONTHS[+key.slice(5, 7) - 1]; return short ? m.slice(0, 3) : m; };
export const monthLabel = key => `${monthName(key)} ${key.slice(0, 4)}`;

export function dayLabel(s) {
  const t = today();
  if (s === t) return 'Today';
  if (s === addDays(t, -1)) return 'Yesterday';
  if (s === addDays(t, 1)) return 'Tomorrow';
  const d = parse(s);
  const opts = { weekday: 'short', month: 'short', day: 'numeric' };
  if (d.getFullYear() !== new Date().getFullYear()) opts.year = 'numeric';
  return d.toLocaleDateString('en-CA', opts);
}
export const shortDate = s => parse(s).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' });

export const money = (n, cents) => {
  const v = Math.abs(n);
  const s = v.toLocaleString('en-CA', { minimumFractionDigits: cents ? 2 : 0, maximumFractionDigits: cents ? 2 : 0 });
  return (n < 0 ? '−$' : '$') + s;
};
// Show cents only when there are any
export const amt = n => money(n, Math.round(Math.abs(n) * 100) % 100 !== 0);
export const compact = n => {
  const v = Math.abs(n), sign = n < 0 ? '−' : '';
  if (v >= 1e6) return `${sign}$${(v / 1e6).toFixed(1).replace(/\.0$/, '')}M`;
  if (v >= 1e4) return `${sign}$${Math.round(v / 1e3)}k`;
  if (v >= 1e3) return `${sign}$${(v / 1e3).toFixed(1).replace(/\.0$/, '')}k`;
  return `${sign}$${Math.round(v)}`;
};

export const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
export const sum = (arr, f = x => x) => arr.reduce((s, x) => s + (Number(f(x)) || 0), 0);
export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const buzz = (ms = 8) => { try { navigator.vibrate && navigator.vibrate(ms); } catch { /* not supported */ } };
