// All data lives on this device, in IndexedDB. Nothing is ever sent anywhere.
import { useSyncExternalStore } from 'react';
import { today, thisMonth, addDays, addMonths, uid, monthKey } from './util.js';
import { goalSetAsideLeft } from './goals.js';

export const SCHEMA = 3;
const DB_NAME = 'finance-tracker', STORE = 'kv', KEY = 'state';
const LEGACY_KEY = 'ft_data_v2';

export const emptyState = () => ({
  schema: SCHEMA,
  created: today(),
  profile: { name: '', province: 'ON', salary: 0 },
  tx: [],            // {id, date, kind: expense|income|invest, cat, amount, note, recId?}
  recurring: [],     // {id, name, kind, cat, amount, freq: weekly|biweekly|monthly|yearly, next}
  budgets: [],       // {id, cat, limit}  monthly limit for an expense category
  goals: [],         // {id, name, emoji, target, saved, color, done?}
  accounts: [],      // {id, name, type: asset|debt, value}
  snapshots: [],     // {month, assets, debts}  one per month, kept forever
  room: { year: new Date().getFullYear(), tfsa: null, rrsp: null, fhsa: null },
  history: [],       // yearly summaries carried over from the old tracker
  settings: { lastBackup: null, onboarded: false, backupNudgeDismissed: null }
});

// ── IndexedDB ────────────────────────────────────────────
function openDB() {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB_NAME, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
async function idbGet(key) {
  const db = await openDB();
  return new Promise((res, rej) => {
    const r = db.transaction(STORE).objectStore(STORE).get(key);
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
}
async function idbSet(key, val) {
  const db = await openDB();
  return new Promise((res, rej) => {
    const t = db.transaction(STORE, 'readwrite');
    t.objectStore(STORE).put(val, key);
    t.oncomplete = () => res(); t.onerror = () => rej(t.error);
  });
}
export const getMeta = k => idbGet('meta:' + k).catch(() => null);
export const setMeta = (k, v) => idbSet('meta:' + k, v).catch(() => {});

// ── Store ────────────────────────────────────────────────
let state = null;
let status = { ready: false, migrated: false, error: null, saved: true };
const listeners = new Set();
const emit = () => listeners.forEach(l => l());
let saveTimer, autoBackup = null;

export function subscribe(l) { listeners.add(l); return () => listeners.delete(l); }
export const useStore = (sel = s => s) => useSyncExternalStore(subscribe, () => sel(state));
export const useStatus = () => useSyncExternalStore(subscribe, () => status);
export const getState = () => state;

// update(draft => { ...mutate... })
export function update(fn) {
  const next = structuredClone(state);
  fn(next);
  state = next;
  status = { ...status, saved: false };
  emit();
  clearTimeout(saveTimer);
  saveTimer = setTimeout(persist, 250);
}

async function persist() {
  try {
    await idbSet(KEY, state);
    status = { ...status, saved: true };
    emit();
    if (autoBackup) autoBackup(state);
  } catch (e) {
    status = { ...status, error: 'Saving failed. Your browser storage may be full. Download a backup from Settings.' };
    emit();
  }
}
// Save immediately if the page is being hidden or closed
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden' && !status.saved) { clearTimeout(saveTimer); persist(); } });
}

export function setAutoBackupWriter(fn) { autoBackup = fn; }

export async function load() {
  try {
    let s = await idbGet(KEY);
    let migrated = false;
    if (!s) {
      s = emptyState();
      const legacy = readLegacy();
      if (legacy) { migrateLegacy(legacy, s); migrated = true; }
    }
    s = upgrade(s);
    applyRecurring(s);
    snapshotNetWorth(s);
    state = s;
    status = { ready: true, migrated, error: null, saved: true };
    await idbSet(KEY, state);
    requestPersistence();
  } catch (e) {
    state = emptyState();
    status = { ready: true, migrated: false, error: 'This browser blocked storage (private browsing?). Changes won\'t be kept.', saved: true };
  }
  emit();
}

export function replaceAll(s) {
  s = upgrade(s);
  applyRecurring(s);
  state = s;
  status = { ...status, saved: false };
  emit();
  persist();
}

// Ask the browser not to clear our data when space runs low
export async function requestPersistence() {
  try { if (navigator.storage?.persist && !(await navigator.storage.persisted())) await navigator.storage.persist(); } catch { /* ignore */ }
}

function upgrade(s) {
  const base = emptyState();
  const out = { ...base, ...s, profile: { ...base.profile, ...s.profile }, room: { ...base.room, ...s.room }, settings: { ...base.settings, ...s.settings } };
  for (const k of ['tx', 'recurring', 'budgets', 'goals', 'accounts', 'snapshots', 'history']) if (!Array.isArray(out[k])) out[k] = [];
  // New year: registered-account room the user entered was for last year
  const yr = new Date().getFullYear();
  if (out.room.year !== yr) out.room = { year: yr, tfsa: null, rrsp: null, fhsa: null };
  out.schema = SCHEMA;
  return out;
}

// ── Migration from the old one-page tracker (localStorage 'ft_data_v2') ──
function readLegacy() {
  try { const raw = localStorage.getItem(LEGACY_KEY); return raw ? JSON.parse(raw) : null; } catch { return null; }
}

const EXP_MAP = { Housing: 'Housing', Food: 'Groceries', Transport: 'Transport', Health: 'Health', Subscriptions: 'Subscriptions', Entertainment: 'Fun', Shopping: 'Shopping', Education: 'Education', Travel: 'Travel', Clothing: 'Shopping', Insurance: 'Bills', Other: 'Other' };
const INC_MAP = { Salary: 'Paycheque', Freelance: 'Freelance', Rental: 'Rental', Bonus: 'Bonus', 'Side hustle': 'Side hustle', Other: 'Other' };
const INV_MAP = { RRSP: 'RRSP', TFSA: 'TFSA', 'Emergency fund': 'Emergency fund', 'Stocks / ETFs': 'Stocks / ETFs', Crypto: 'Crypto', Other: 'Other' };
const FREQ_MAP = { weekly: 'weekly', biweekly: 'biweekly', monthly: 'monthly', quarterly: 'monthly', annually: 'yearly' };
const GOAL_COLORS = ['#2438F0', '#FF5A45', '#13A877', '#FFB020'];

export function migrateLegacy(L, s) {
  const first = thisMonth() + '-01';
  const num = v => Math.max(0, Number(v) || 0);
  // The old tracker held "a typical month". Bring those rows in as this month's entries.
  for (const r of L.inc || []) if (num(r.a)) s.tx.push({ id: uid(), date: first, kind: 'income', cat: INC_MAP[r.c] || 'Other', amount: num(r.a), note: r.d || '' });
  for (const r of L.exp || []) if (num(r.a)) s.tx.push({ id: uid(), date: first, kind: 'expense', cat: EXP_MAP[r.c] || 'Other', amount: num(r.a), note: r.d || '' });
  for (const r of L.inv || []) if (num(r.a)) s.tx.push({ id: uid(), date: first, kind: 'invest', cat: INV_MAP[r.c] || 'Other', amount: num(r.a), note: r.d || '' });
  // Recurring bills start next month so they don't double up with the rows above
  for (const r of L.rec || []) if (num(r.a)) {
    const kind = r.c === 'Investment' ? 'invest' : 'expense';
    const freq = FREQ_MAP[r.f] || 'monthly';
    const amount = r.f === 'quarterly' ? num(r.a) / 3 : num(r.a);
    s.recurring.push({ id: uid(), name: r.n || r.c || 'Bill', kind, cat: kind === 'invest' ? 'Other' : (EXP_MAP[r.c] || 'Bills'), amount, freq, next: addMonths(first, 1) });
  }
  for (const b of L.budgets || []) if (num(b.limit)) s.budgets.push({ id: uid(), cat: EXP_MAP[b.cat] || b.cat || 'Other', limit: num(b.limit) });
  (L.goals || []).forEach((g, i) => s.goals.push({ id: uid(), name: g.n || 'Goal', emoji: '🎯', target: num(g.t) || 1000, saved: num(g.s), color: GOAL_COLORS[i % 4] }));
  for (const a of L.nw?.assets || []) s.accounts.push({ id: uid(), name: a.l || 'Asset', type: 'asset', value: num(a.v) });
  for (const a of L.nw?.liabs || []) s.accounts.push({ id: uid(), name: a.l || 'Debt', type: 'debt', value: num(a.v) });
  for (const y of L.yoy || []) s.history.push({ year: y.y, income: num(y.i), expenses: num(y.e), invested: num(y.inv), saved: Number(y.s) || 0 });
  if (L.profile) s.profile = { name: L.profile.name || '', province: L.profile.province || 'ON', salary: num(L.profile.salary) || num(L.tax?.gross) };
  s.settings.migratedFromV2 = today();
  s.settings.onboarded = true;
  // The old data in localStorage is left untouched as a safety net.
}

// ── Recurring bills and paycheques ───────────────────────
export function advance(date, freq) {
  if (freq === 'weekly') return addDays(date, 7);
  if (freq === 'biweekly') return addDays(date, 14);
  if (freq === 'yearly') return addMonths(date, 12);
  return addMonths(date, 1);
}

// Adds every recurring item that has come due to the draft, and moves its next date forward
export function applyRecurring(s) {
  const t = today();
  let added = 0;
  for (const r of s.recurring) {
    let guard = 0;
    while (r.next && r.next <= t && guard++ < 520) {
      s.tx.push({ id: uid(), date: r.next, kind: r.kind, cat: r.cat, amount: r.amount, note: r.name, recId: r.id });
      r.next = advance(r.next, r.freq);
      added++;
    }
  }
  return added;
}
export function runRecurring() {
  const s = structuredClone(state);
  if (applyRecurring(s)) { state = s; emit(); persist(); }
}

// Record net worth once per month so the chart grows over the years
export function snapshotNetWorth(s) {
  if (!s.accounts.length) return;
  const m = thisMonth();
  const assets = s.accounts.filter(a => a.type === 'asset').reduce((x, a) => x + a.value, 0);
  const debts = s.accounts.filter(a => a.type === 'debt').reduce((x, a) => x + a.value, 0);
  const snap = { month: m, assets, debts };
  const i = s.snapshots.findIndex(sn => sn.month === m);
  if (i >= 0) s.snapshots[i] = snap; else s.snapshots.push(snap);
  s.snapshots.sort((a, b) => a.month.localeCompare(b.month));
}

// ── Derived numbers ──────────────────────────────────────
export function monthTotals(s, key) {
  const out = { income: 0, expense: 0, invest: 0 };
  for (const t of s.tx) if (monthKey(t.date) === key) out[t.kind] += t.amount;
  return out;
}

// Upcoming occurrences of recurring items between two dates (inclusive)
export function upcoming(s, from, to) {
  const list = [];
  for (const r of s.recurring) {
    let d = r.next, guard = 0;
    while (d && d <= to && guard++ < 60) {
      if (d >= from) list.push({ ...r, date: d });
      d = advance(d, r.freq);
    }
  }
  return list.sort((a, b) => a.date.localeCompare(b.date));
}

// "Safe to spend": money in this month (so far + still coming) minus everything out (so far + bills still coming)
export function safeToSpend(s) {
  const m = thisMonth(), t = today();
  const tot = monthTotals(s, m);
  const end = m + '-' + String(new Date(+m.slice(0, 4), +m.slice(5, 7), 0).getDate()).padStart(2, '0');
  const rest = upcoming(s, addDays(t, 1), end);
  const comingIn = rest.filter(r => r.kind === 'income').reduce((x, r) => x + r.amount, 0);
  const comingOut = rest.filter(r => r.kind !== 'income').reduce((x, r) => x + r.amount, 0);
  const income = tot.income + comingIn;
  // Money your goals still need this month is set aside before it counts as spendable
  const forGoals = goalSetAsideLeft(s);
  const out = tot.expense + tot.invest + comingOut + forGoals;
  const daysLeft = +end.slice(8) - +t.slice(8) + 1;
  return { income, out, comingIn, comingOut, forGoals, spent: tot.expense, invested: tot.invest, safe: income - out, daysLeft, perDay: (income - out) / daysLeft };
}

export function categorySpend(s, key, kind = 'expense') {
  const map = {};
  for (const t of s.tx) if (t.kind === kind && monthKey(t.date) === key) map[t.cat] = (map[t.cat] || 0) + t.amount;
  return Object.entries(map).sort((a, b) => b[1] - a[1]);
}

export function yearContrib(s, cat, year = new Date().getFullYear()) {
  return s.tx.filter(t => t.kind === 'invest' && t.cat === cat && t.date.startsWith(String(year))).reduce((x, t) => x + t.amount, 0);
}
