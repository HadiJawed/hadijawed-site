// Goal maths: progress, what's needed per month to hit a deadline, your real pace,
// what you can afford, and where the money could come from.
import { today, parse, toISO, addDays, thisMonth, shiftMonth, monthKey } from './util.js';
import { monthTotals } from './store.js';

const DAY = 864e5, MONTH_DAYS = 30.44;
const daysBetween = (a, b) => Math.round((parse(b) - parse(a)) / DAY);

// Saved in the last 90 days, per month
export function goalPace(g) {
  const since = addDays(today(), -90);
  const recent = (g.log || []).filter(l => l.date >= since).reduce((s, l) => s + l.amount, 0);
  if (!recent) return 0;
  // Don't divide a brand-new goal's first deposit by three months
  const start = g.created && g.created > since ? g.created : since;
  const months = Math.max(1, daysBetween(start, today()) / MONTH_DAYS);
  return recent / months;
}

export function savedThisMonth(g) {
  const m = thisMonth();
  return (g.log || []).filter(l => monthKey(l.date) === m).reduce((s, l) => s + l.amount, 0);
}

export function goalStatus(g) {
  const left = Math.max(0, g.target - g.saved);
  const progress = g.target > 0 ? Math.min(1, g.saved / g.target) : 0;
  const pace = goalPace(g);
  if (left === 0) return { state: 'done', label: 'Reached', left, progress, pace, needed: 0 };

  const projected = pace > 0 ? toISO(new Date(Date.now() + (left / pace) * MONTH_DAYS * DAY)) : null;
  if (!g.deadline) {
    const needed = g.monthly || 0;
    // No date: estimate from your real pace, or from your monthly plan if you haven't started yet
    const rate = pace || needed;
    const eta = rate > 0 ? toISO(new Date(Date.now() + (left / rate) * MONTH_DAYS * DAY)) : null;
    return { state: 'open', label: pace ? 'No date' : needed ? 'Planned' : 'Not started', left, progress, pace, needed, projected: eta };
  }
  const days = daysBetween(today(), g.deadline);
  if (days <= 0) return { state: 'late', label: 'Past the date', left, progress, pace, needed: left, projected, monthsLeft: 0 };
  const monthsLeft = Math.max(days / MONTH_DAYS, 0.5);
  const needed = left / monthsLeft;
  const state = pace >= needed * 0.95 ? 'on' : pace > 0 ? 'behind' : 'start';
  const label = { on: 'On track', behind: 'Behind', start: 'Not started' }[state];
  return { state, label, left, progress, pace, needed, projected, monthsLeft };
}

// What each goal asks of you every month
export const monthlyAsk = g => { const st = goalStatus(g); return st.state === 'done' ? 0 : st.needed; };
export const totalMonthlyAsk = s => s.goals.reduce((x, g) => x + monthlyAsk(g), 0);

// Money still to set aside for goals this month (used in "safe to spend")
export function goalSetAsideLeft(s) {
  const m = thisMonth(), t = today();
  const days = new Date(+m.slice(0, 4), +m.slice(5), 0).getDate();
  return Math.round(s.goals.reduce((x, g) => {
    let ask = monthlyAsk(g);
    // A goal started partway through the month only claims the days that are left
    if (g.created && g.created.startsWith(m)) ask *= (days - +g.created.slice(8) + 1) / days;
    return x + Math.max(0, ask - savedThisMonth(g));
  }, 0));
}

// Average monthly money left after spending and investing, from recent full months.
// Falls back to this month if there's no history yet.
export function freeCash(s) {
  const months = [1, 2, 3].map(i => shiftMonth(thisMonth(), -i)).filter(m => s.tx.some(t => t.date.startsWith(m) && t.kind === 'income'));
  const use = months.length ? months : (s.tx.some(t => t.date.startsWith(thisMonth()) && t.kind === 'income') ? [thisMonth()] : []);
  if (!use.length) return null;
  let income = 0, out = 0;
  for (const m of use) { const t = monthTotals(s, m); income += t.income; out += t.expense + t.invest; }
  return { income: income / use.length, out: out / use.length, free: (income - out) / use.length, months: use.length, current: !months.length };
}

// Spending categories people can usually trim
export const FLEX = ['Eating out', 'Shopping', 'Fun', 'Subscriptions', 'Travel', 'Personal care', 'Gifts', 'Other', 'Groceries'];

export function categoryAverages(s, n = 3) {
  const months = Array.from({ length: n }, (_, i) => shiftMonth(thisMonth(), -(i + 1)));
  const has = months.filter(m => s.tx.some(t => t.date.startsWith(m)));
  const use = has.length ? has : [thisMonth()];
  const map = {};
  for (const t of s.tx) if (t.kind === 'expense' && use.includes(monthKey(t.date))) map[t.cat] = (map[t.cat] || 0) + t.amount;
  return Object.entries(map).map(([cat, v]) => [cat, v / use.length]).sort((a, b) => b[1] - a[1]);
}

// Suggest trims to close a monthly gap: biggest flexible categories first, at most 30% each
export function suggestCuts(s, gap) {
  const round5 = v => Math.round(v / 5) * 5;
  let need = Math.max(0, gap);
  return categoryAverages(s).filter(([c, v]) => FLEX.includes(c) && v >= 20).map(([cat, avg]) => {
    const max = round5(avg * (cat === 'Groceries' ? .15 : .5));
    const cut = need > 0 ? Math.min(round5(avg * (cat === 'Groceries' ? .1 : .3)), round5(need) || 5) : 0;
    need -= cut;
    return { cat, avg, cut: Math.max(0, cut), max: Math.max(max, 5) };
  });
}
