import { useEffect, useState } from 'react';
import { useStore, update, categorySpend, advance, runRecurring } from '../lib/store.js';
import { thisMonth, shiftMonth, today, uid, amt, compact, dayLabel, clamp } from '../lib/util.js';
import { CATS, icon } from '../lib/categories.js';
import { Sheet, Segmented, MoneyField, Field, Empty, Icon, toast } from '../ui.jsx';

export default function Plan({ tab, setTab }) {
  return (
    <div className="screen">
      <header className="screen-head"><h1>Plan</h1></header>
      <Segmented label="Plan section" value={tab} onChange={setTab} options={[['budgets', 'Budgets'], ['bills', 'Bills and pay']]} />
      {tab === 'budgets' && <Budgets />}
      {tab === 'bills' && <Bills />}
    </div>
  );
}

// ── Budgets ──────────────────────────────────────────────
function Budgets() {
  const s = useStore();
  const m = thisMonth();
  const spent = Object.fromEntries(categorySpend(s, m));
  const [edit, setEdit] = useState(null);
  const total = s.budgets.reduce((x, b) => x + b.limit, 0);
  const totalSpent = s.budgets.reduce((x, b) => x + (spent[b.cat] || 0), 0);
  const daysIn = new Date(+m.slice(0, 4), +m.slice(5), 0).getDate(), dayNow = +today().slice(8);
  const pace = dayNow / daysIn;

  return (
    <>
      {s.budgets.length > 0 && (
        <section className="card">
          <div className="card-head"><h2>This month</h2><span className="muted">{amt(totalSpent)} of {amt(total)}</span></div>
          <div className="bigbar"><i style={{ width: `${clamp(totalSpent / (total || 1), 0, 1) * 100}%` }} className={totalSpent > total ? 'over' : ''} /><em style={{ left: `${pace * 100}%` }} title="Where you'd be at an even pace" /></div>
          <p className="muted small">The line shows where you'd be if you spent evenly through the month.</p>
        </section>
      )}
      <section className="card flush">
        {s.budgets.length ? (
          <ul className="budget-list">
            {s.budgets.map(b => {
              const v = spent[b.cat] || 0, p = v / b.limit, left = b.limit - v;
              return (
                <li key={b.id}>
                  <button className="budget" onClick={() => setEdit(b)}>
                    <span className="tx-ico k-expense" aria-hidden="true">{icon('expense', b.cat)}</span>
                    <span className="budget-main">
                      <span className="budget-top"><b>{b.cat}</b><span className={left < 0 ? 'neg' : 'muted'}>{left >= 0 ? `${amt(left)} left` : `${amt(-left)} over`}</span></span>
                      <span className="bar"><i className={p > 1 ? 'over' : p >= .8 ? 'warn' : ''} style={{ width: `${clamp(p, 0, 1) * 100}%` }} /></span>
                      <small className="muted">{amt(v)} of {amt(b.limit)}{p > pace + .15 && p <= 1 ? ', ahead of pace' : ''}</small>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : <Empty emoji="🎯" title="No budgets yet" text="Set a monthly limit for a category and watch it fill as you spend." />}
        <div className="pad"><button className="btn primary" onClick={() => setEdit({})}><Icon name="plus" size={18} /> Add a budget</button></div>
      </section>
      <BudgetSheet b={edit} onClose={() => setEdit(null)} />
    </>
  );
}

function BudgetSheet({ b, onClose }) {
  const s = useStore();
  const [cat, setCat] = useState('');
  const [limit, setLimit] = useState('');
  useEffect(() => { if (b) { setCat(b.cat || ''); setLimit(b.limit ?? ''); } }, [b]);
  if (!b) return null;
  const used = new Set(s.budgets.filter(x => x.id !== b.id).map(x => x.cat));
  // Suggest the average of the last 3 months
  const avg = cat ? [1, 2, 3].reduce((x, i) => x + (Object.fromEntries(categorySpend(s, shiftMonth(thisMonth(), -i)))[cat] || 0), 0) / 3 : 0;
  const save = () => {
    const l = parseFloat(limit);
    if (!cat || !(l > 0)) return;
    update(d => { if (b.id) Object.assign(d.budgets.find(x => x.id === b.id), { cat, limit: l }); else d.budgets.push({ id: uid(), cat, limit: l }); });
    toast(b.id ? 'Budget updated' : `${cat} budget set to ${amt(l)} a month`);
    onClose();
  };
  return (
    <Sheet open onClose={onClose} title={b.id ? `${b.cat} budget` : 'New budget'}>
      <div className="form">
        <div className="chips" role="radiogroup" aria-label="Category">
          {CATS.expense.filter(([c]) => !used.has(c)).map(([c, e]) => (
            <button key={c} role="radio" aria-checked={cat === c} className={'chip' + (cat === c ? ' on' : '')} onClick={() => setCat(c)}><span aria-hidden="true">{e}</span>{c}</button>
          ))}
        </div>
        <MoneyField label="Monthly limit" value={limit} onChange={setLimit} autoFocus={!!b.id}
          hint={avg > 0 ? <>You've averaged {amt(Math.round(avg))} a month here. <button className="link" onClick={() => setLimit(Math.round(avg))}>Use that</button></> : null} />
        <div className="form-actions">
          {b.id && <button className="btn ghost danger" onClick={() => { update(d => { d.budgets = d.budgets.filter(x => x.id !== b.id); }); toast('Budget removed'); onClose(); }}>Remove</button>}
          <button className="btn primary" disabled={!cat || !(parseFloat(limit) > 0)} onClick={save}>Save budget</button>
        </div>
      </div>
    </Sheet>
  );
}

// ── Bills and pay (recurring) ────────────────────────────
const FREQ = [['weekly', 'Weekly'], ['biweekly', 'Every 2 weeks'], ['monthly', 'Monthly'], ['yearly', 'Yearly']];
const PER_MONTH = { weekly: 52 / 12, biweekly: 26 / 12, monthly: 1, yearly: 1 / 12 };

function Bills() {
  const s = useStore();
  const [edit, setEdit] = useState(null);
  const list = [...s.recurring].sort((a, b) => a.next.localeCompare(b.next));
  const monthly = k => s.recurring.filter(r => k === 'income' ? r.kind === 'income' : r.kind !== 'income').reduce((x, r) => x + r.amount * PER_MONTH[r.freq], 0);
  return (
    <>
      {s.recurring.length > 0 && (
        <div className="stat-row two">
          <div className="stat k-income"><small>Regular pay, per month</small><b>{compact(monthly('income'))}</b></div>
          <div className="stat k-expense"><small>Regular bills, per month</small><b>{compact(monthly('out'))}</b></div>
        </div>
      )}
      <section className="card flush">
        {list.length ? (
          <ul className="tx-list">
            {list.map(r => (
              <li key={r.id} className="tx-wrap"><div className="tx">
                <button className="tx-main" onClick={() => setEdit(r)}>
                  <span className={'tx-ico k-' + r.kind} aria-hidden="true">{icon(r.kind, r.cat)}</span>
                  <span className="tx-text"><b>{r.name}</b><small>{FREQ.find(f => f[0] === r.freq)[1]}, next {dayLabel(r.next)}</small></span>
                  <span className={'tx-amt k-' + r.kind}>{r.kind === 'income' ? '+' : ''}{amt(r.amount)}</span>
                </button>
              </div></li>
            ))}
          </ul>
        ) : <Empty emoji="🔁" title="Nothing repeating yet" text="Add your paycheque, rent, phone and subscriptions. Each one is added for you automatically on its due date." />}
        <div className="pad row">
          <button className="btn primary" onClick={() => setEdit({ kind: 'expense' })}><Icon name="plus" size={18} /> Add a bill</button>
          <button className="btn soft" onClick={() => setEdit({ kind: 'income', cat: 'Paycheque', name: 'Paycheque', freq: 'biweekly' })}><Icon name="plus" size={18} /> Add pay</button>
        </div>
      </section>
      <BillSheet r={edit} onClose={() => setEdit(null)} />
    </>
  );
}

function BillSheet({ r, onClose }) {
  const [f, setF] = useState({});
  useEffect(() => { if (r) setF({ name: '', kind: 'expense', cat: '', amount: '', freq: 'monthly', next: today(), ...r }); }, [r]);
  if (!r) return null;
  const set = (k, v) => setF(o => ({ ...o, [k]: v }));
  const ok = f.name?.trim() && parseFloat(f.amount) > 0 && f.next;
  const save = () => {
    if (!ok) return;
    const item = { ...f, name: f.name.trim(), amount: parseFloat(f.amount), cat: f.cat || CATS[f.kind].at(-1)[0] };
    update(d => { if (r.id) Object.assign(d.recurring.find(x => x.id === r.id), item); else d.recurring.push({ ...item, id: uid() }); });
    runRecurring();
    toast(item.next <= today() ? `${item.name} added, and today's one is filled in` : `${item.name} added. It fills in on ${dayLabel(item.next)}`);
    onClose();
  };
  return (
    <Sheet open onClose={onClose} title={r.id ? r.name : f.kind === 'income' ? 'Regular pay' : 'Regular bill'}>
      <div className="form">
        <Segmented label="Type" value={f.kind} onChange={k => setF(o => ({ ...o, kind: k, cat: '' }))} options={[['expense', 'Bill'], ['income', 'Pay'], ['invest', 'Auto-invest']]} />
        <Field label="Name"><input value={f.name || ''} onChange={e => set('name', e.target.value)} placeholder={f.kind === 'income' ? 'e.g. Paycheque' : 'e.g. Rent, Netflix, Rogers'} data-autofocus /></Field>
        <MoneyField label="Amount" value={f.amount} onChange={v => set('amount', v)} />
        <Field label="How often">
          <select value={f.freq} onChange={e => set('freq', e.target.value)}>{FREQ.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
        </Field>
        <Field label="Next due date" hint="It's added to your activity automatically on this date, then repeats.">
          <input type="date" value={f.next || ''} onChange={e => set('next', e.target.value)} />
        </Field>
        <div className="chips" role="radiogroup" aria-label="Category">
          {CATS[f.kind || 'expense'].map(([c, e]) => (
            <button key={c} role="radio" aria-checked={f.cat === c} className={'chip' + (f.cat === c ? ' on' : '')} onClick={() => set('cat', c)}><span aria-hidden="true">{e}</span>{c}</button>
          ))}
        </div>
        <div className="form-actions">
          {r.id && <>
            <button className="btn ghost" onClick={() => { update(d => { const x = d.recurring.find(y => y.id === r.id); x.next = advance(x.next, x.freq); }); toast(`Skipped once. Next: ${dayLabel(advance(r.next, r.freq))}`); onClose(); }}>Skip next one</button>
            <button className="btn ghost danger" onClick={() => { update(d => { d.recurring = d.recurring.filter(x => x.id !== r.id); }); toast(`${r.name} stopped. Past entries are kept.`); onClose(); }}>Stop repeating</button>
          </>}
          <button className="btn primary" disabled={!ok} onClick={save}>Save</button>
        </div>
      </div>
    </Sheet>
  );
}

