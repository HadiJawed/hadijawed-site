import { useEffect, useMemo, useState } from 'react';
import { useStore, monthTotals, categorySpend } from '../lib/store.js';
import { thisMonth, shiftMonth, monthLabel, monthName, amt, compact, money } from '../lib/util.js';
import { PALETTE, icon } from '../lib/categories.js';
import { Donut, Bars, Icon, Empty, Num } from '../ui.jsx';
import TxList from './TxList.jsx';

export default function Activity({ edit, add, initialKind }) {
  const s = useStore();
  const [month, setMonth] = useState(thisMonth());
  const [kind, setKind] = useState(initialKind || 'all');
  const [cat, setCat] = useState(null);
  const [q, setQ] = useState('');
  useEffect(() => { if (initialKind) setKind(initialKind); }, [initialKind]);

  const totals = monthTotals(s, month);
  const cats = categorySpend(s, month);
  const six = useMemo(() => Array.from({ length: 6 }, (_, i) => {
    const key = shiftMonth(month, i - 5), t = monthTotals(s, key);
    return { key, label: monthName(key, true), earned: t.income, spent: t.expense };
  }), [s, month]);

  const query = q.trim().toLowerCase();
  const list = s.tx.filter(t =>
    (query ? (t.note + ' ' + t.cat).toLowerCase().includes(query) || String(t.amount).includes(query) : t.date.startsWith(month)) &&
    (kind === 'all' || t.kind === kind) && (!cat || (t.cat === cat && t.kind === 'expense')));

  const year = month.slice(0, 4);
  const yr = s.tx.filter(t => t.date.startsWith(year)).reduce((o, t) => (o[t.kind] += t.amount, o), { income: 0, expense: 0, invest: 0 });
  const saveRate = yr.income ? Math.round((yr.income - yr.expense) / yr.income * 100) : null;
  const pastYears = useMemo(() => {
    const ys = {};
    for (const t of s.tx) { const y = t.date.slice(0, 4); if (y === year) continue; (ys[y] ||= { income: 0, expense: 0, invest: 0 })[t.kind] += t.amount; }
    for (const h of s.history) if (!ys[h.year]) ys[h.year] = { income: h.income, expense: h.expenses, invest: h.invested, legacy: true };
    return Object.entries(ys).sort((a, b) => b[0] - a[0]);
  }, [s, year]);

  return (
    <div className="screen">
      <header className="screen-head">
        <h1>Activity</h1>
        <div className="month-nav">
          <button className="icon-btn" onClick={() => { setMonth(shiftMonth(month, -1)); setCat(null); }} aria-label="Previous month"><Icon name="left" /></button>
          <button className="month-btn" onClick={() => { setMonth(thisMonth()); setCat(null); }} title="Back to this month">{monthLabel(month)}</button>
          <button className="icon-btn" onClick={() => { setMonth(shiftMonth(month, 1)); setCat(null); }} aria-label="Next month"><Icon name="right" /></button>
        </div>
      </header>

      <div className="search">
        <Icon name="search" size={18} />
        <input type="search" placeholder="Search every entry, e.g. Uber" value={q} onChange={e => setQ(e.target.value)} aria-label="Search all entries" />
      </div>

      {!query && (
        <div className="grid-2">
          <section className="card">
            <div className="card-head"><h2>Where it went</h2><span className="muted">{amt(totals.expense)}</span></div>
            {cats.length ? (
              <div className="donut-wrap">
                <Donut data={cats} colors={PALETTE} size={190} active={cat} onActive={setCat}
                  center={cat ? <><small>{cat}</small><b>{compact(cats.find(c => c[0] === cat)?.[1] || 0)}</b></> : <><small>Spent</small><b>{compact(totals.expense)}</b></>} />
                <ul className="legend">
                  {cats.slice(0, 7).map(([c, v], i) => (
                    <li key={c}><button className={cat === c ? 'on' : ''} onClick={() => setCat(cat === c ? null : c)}>
                      <i style={{ background: PALETTE[i % PALETTE.length] }} /> <span aria-hidden="true">{icon('expense', c)}</span> {c}<b>{amt(v)}</b>
                    </button></li>
                  ))}
                </ul>
              </div>
            ) : <p className="muted">No spending in {monthName(month)} yet.</p>}
          </section>

          <section className="card">
            <div className="card-head"><h2>Earned vs spent</h2>
              <span className="key"><i style={{ background: 'var(--green)' }} />Earned <i style={{ background: 'var(--coral)' }} />Spent</span></div>
            <Bars data={six} picked={month} onPick={k => { setMonth(k); setCat(null); }}
              series={[{ key: 'earned', label: 'Earned', color: 'var(--green)' }, { key: 'spent', label: 'Spent', color: 'var(--coral)' }]} />
            <div className="mini-stats">
              <div><small>Earned</small><b><Num value={totals.income} format={compact} /></b></div>
              <div><small>Spent</small><b><Num value={totals.expense} format={compact} /></b></div>
              <div><small>Invested</small><b><Num value={totals.invest} format={compact} /></b></div>
              <div><small>Kept</small><b className={totals.income - totals.expense - totals.invest < 0 ? 'neg' : ''}><Num value={totals.income - totals.expense - totals.invest} format={compact} /></b></div>
            </div>
          </section>
        </div>
      )}

      <div className="filter-row">
        <div className="chips tight" role="radiogroup" aria-label="Show">
          {[['all', 'Everything'], ['expense', 'Spent'], ['income', 'Earned'], ['invest', 'Invested']].map(([k, l]) => (
            <button key={k} role="radio" aria-checked={kind === k} className={'chip' + (kind === k ? ' on' : '')} onClick={() => setKind(k)}>{l}</button>
          ))}
          {cat && <button className="chip on" onClick={() => setCat(null)}>{cat} <Icon name="x" size={14} /></button>}
        </div>
      </div>

      <section className="card flush">
        {list.length ? <TxList items={list} onEdit={edit} /> : (
          query
            ? <Empty emoji="🔍" title={`Nothing matches "${q}"`} text="Search looks through notes, categories and amounts from every month." />
            : <Empty emoji="🗓️" title={`Nothing in ${monthLabel(month)}`} text="Entries you add show up here, grouped by day."
                action={<button className="btn primary" onClick={() => add('expense')}><Icon name="plus" size={18} /> Add an entry</button>} />
        )}
      </section>

      {!query && (
        <section className="card">
          <div className="card-head"><h2>{year} so far</h2>{saveRate !== null && <span className={'pill ' + (saveRate >= 20 ? 'good' : saveRate < 0 ? 'bad' : '')}>You kept {saveRate}% of what you earned</span>}</div>
          <div className="mini-stats">
            <div><small>Earned</small><b>{compact(yr.income)}</b></div>
            <div><small>Spent</small><b>{compact(yr.expense)}</b></div>
            <div><small>Invested</small><b>{compact(yr.invest)}</b></div>
          </div>
          {pastYears.length > 0 && (
            <table className="years">
              <caption className="sr">Past years</caption>
              <thead><tr><th>Year</th><th>Earned</th><th>Spent</th><th>Invested</th></tr></thead>
              <tbody>{pastYears.map(([y, v]) => <tr key={y}><td>{y}</td><td>{money(v.income)}</td><td>{money(v.expense)}</td><td>{money(v.invest)}</td></tr>)}</tbody>
            </table>
          )}
        </section>
      )}
    </div>
  );
}
