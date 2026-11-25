// Numbers and plain-language observations for the dashboard
import { today, thisMonth, shiftMonth, daysInMonth, addDays, money, monthName } from './util.js';
import { upcoming, monthTotals } from './store.js';
import { goalStatus } from './goals.js';

// Spending per day of a month (expenses only)
export function dailySpend(s, key) {
  const days = Array(daysInMonth(key)).fill(0);
  for (const t of s.tx) if (t.kind === 'expense' && t.date.startsWith(key)) days[+t.date.slice(8) - 1] += t.amount;
  return days;
}
const cumulative = arr => { let x = 0; return arr.map(v => (x += v)); };

// This month vs last month, cumulative by day
export function spendingPace(s) {
  const m = thisMonth(), last = shiftMonth(m, -1), day = +today().slice(8);
  const now = cumulative(dailySpend(s, m)).slice(0, day);
  const prev = cumulative(dailySpend(s, last));
  const prevSameDay = prev[Math.min(day, prev.length) - 1] || 0;
  return { now, prev, day, days: daysInMonth(m), spent: now[now.length - 1] || 0, prevSameDay, prevTotal: prev[prev.length - 1] || 0 };
}

function categoryToDate(s, key, uptoDay) {
  const map = {};
  for (const t of s.tx) if (t.kind === 'expense' && t.date.startsWith(key) && +t.date.slice(8) <= uptoDay) map[t.cat] = (map[t.cat] || 0) + t.amount;
  return map;
}

export function insights(s) {
  const out = [];
  const m = thisMonth(), last = shiftMonth(m, -1), day = +today().slice(8);

  // Category moves vs the same point last month
  const a = categoryToDate(s, m, day), b = categoryToDate(s, last, day);
  const moves = Object.keys({ ...a, ...b }).map(c => ({ c, d: (a[c] || 0) - (b[c] || 0), p: b[c] ? ((a[c] || 0) - b[c]) / b[c] : null })).filter(x => Math.abs(x.d) >= 30);
  const up = moves.filter(x => x.d > 0).sort((x, y) => y.d - x.d)[0];
  const down = moves.filter(x => x.d < 0).sort((x, y) => x.d - y.d)[0];
  if (up) out.push({ emoji: '📈', tone: 'warn', text: `${up.c} is up ${money(up.d)}${up.p != null ? ` (${Math.round(up.p * 100)}%)` : ''} on this point last month.`, go: ['activity'] });
  if (down) out.push({ emoji: '👏', tone: 'good', text: `You've spent ${money(-down.d)} less on ${down.c} than this point last month.`, go: ['activity'] });

  // Budget likely to run over at the current pace
  const pace = day / daysInMonth(m);
  const risky = s.budgets.map(bg => ({ bg, spent: a[bg.cat] || 0 })).filter(x => x.spent < x.bg.limit && x.spent / pace > x.bg.limit * 1.1 && day >= 5)
    .sort((x, y) => y.spent / y.bg.limit - x.spent / x.bg.limit)[0];
  if (risky) out.push({ emoji: '⚠️', tone: 'warn', text: `At this pace ${risky.bg.cat} will go over its ${money(risky.bg.limit)} budget around ${monthName(m, true)} ${Math.max(day + 1, Math.round(risky.bg.limit / (risky.spent / day)))}.`, go: ['plan', 'budgets'] });

  // Bills in the next 7 days
  const week = upcoming(s, addDays(today(), 1), addDays(today(), 7)).filter(r => r.kind !== 'income');
  if (week.length) out.push({ emoji: '🗓️', tone: '', text: `${week.length} ${week.length === 1 ? 'bill' : 'bills'} coming in the next 7 days, ${money(week.reduce((x, r) => x + r.amount, 0))} in total.`, go: ['plan', 'bills'] });

  // Goals
  const goals = s.goals.map(g => ({ g, st: goalStatus(g) }));
  const behind = goals.filter(x => x.st.state === 'behind' || x.st.state === 'start').sort((x, y) => (x.g.deadline || '9').localeCompare(y.g.deadline || '9'))[0];
  if (behind && behind.g.deadline) out.push({ emoji: behind.g.emoji, tone: 'warn', text: `${behind.g.name} needs ${money(behind.st.needed)} a month to make its date. You're saving ${money(behind.st.pace)}.`, go: ['goals'] });
  const close = goals.filter(x => x.st.state !== 'done' && x.st.progress >= .75).sort((x, y) => y.st.progress - x.st.progress)[0];
  if (close) out.push({ emoji: '🏁', tone: 'good', text: `${close.g.name} is ${Math.round(close.st.progress * 100)}% there. ${money(close.st.left)} to go.`, go: ['goals'] });

  // Savings rate and no-spend days
  const t = monthTotals(s, m);
  if (t.income > 0) {
    const rate = Math.round((t.income - t.expense) / t.income * 100);
    out.push({ emoji: rate >= 20 ? '💪' : '💡', tone: rate >= 20 ? 'good' : '', text: rate >= 0 ? `You've kept ${rate}% of what you earned this month.${rate < 20 ? ' 20% is a good target.' : ''}` : `You've spent more than you earned so far this month.`, go: ['activity'] });
  }
  const spentDays = new Set(s.tx.filter(x => x.kind === 'expense' && x.date.startsWith(m)).map(x => x.date)).size;
  const noSpend = day - spentDays;
  if (s.tx.length > 5 && noSpend >= 3) out.push({ emoji: '🧘', tone: 'good', text: `${noSpend} no-spend days so far this month.`, go: ['activity'] });

  return out.slice(0, 6);
}
