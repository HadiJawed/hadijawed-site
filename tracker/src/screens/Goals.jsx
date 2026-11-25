import { useEffect, useMemo, useState } from 'react';
import { useStore, update } from '../lib/store.js';
import { goalStatus, totalMonthlyAsk, freeCash, suggestCuts, savedThisMonth } from '../lib/goals.js';
import { today, addMonths, uid, money, amt, clamp, buzz, parse, thisMonth, shiftMonth, monthName } from '../lib/util.js';
import { icon } from '../lib/categories.js';
import { Sheet, MoneyField, Field, Empty, Icon, toast, confetti, Num, Ring } from '../ui.jsx';

const GOAL_EMOJI = ['🎯', '🏠', '🚗', '✈️', '💍', '🎓', '🛟', '💻', '👶', '🏖️', '🎮', '🐶'];
const GOAL_COLORS = ['#2438F0', '#FF5A45', '#13A877', '#FFB020', '#8B5CF6', '#EC4899'];
const TONE = { on: 'good', done: 'good', behind: 'bad', late: 'bad', start: 'warn', open: '' };
const longDate = d => parse(d).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' });
const monthsLabel = m => m < 1 ? 'less than a month' : `${Math.round(m)} ${Math.round(m) === 1 ? 'month' : 'months'}`;

export default function Goals() {
  const s = useStore();
  const [edit, setEdit] = useState(null);
  const [fund, setFund] = useState(null);
  const [helper, setHelper] = useState(false);
  const saved = s.goals.reduce((x, g) => x + g.saved, 0), target = s.goals.reduce((x, g) => x + g.target, 0);
  const ask = totalMonthlyAsk(s);
  const cash = freeCash(s);
  const active = s.goals.filter(g => g.saved < g.target), done = s.goals.filter(g => g.saved >= g.target);

  return (
    <div className="screen">
      <header className="screen-head"><h1>Goals</h1>
        {s.goals.length > 0 && <button className="btn primary small" onClick={() => setEdit({})}><Icon name="plus" size={18} /> New goal</button>}
      </header>

      {s.goals.length === 0 ? (
        <section className="card">
          <Empty emoji="🫙" title="What are you saving for?"
            text="Add a goal with an amount and a date. The app works out what to save each month, tracks whether you're on pace, and helps you find the money in your budget."
            action={<button className="btn primary" onClick={() => setEdit({})}><Icon name="plus" size={18} /> Create your first goal</button>} />
          <div className="goal-ideas">
            {[['🛟', 'Emergency fund', 10000], ['✈️', 'Vacation', 3000], ['🏠', 'House down payment', 50000], ['🚗', 'New car', 15000]].map(([e, n, t]) => (
              <button key={n} className="chip" onClick={() => setEdit({ emoji: e, name: n, target: t })}><span aria-hidden="true">{e}</span>{n}</button>
            ))}
          </div>
        </section>
      ) : (
        <>
          <div className="goals-top">
            <section className="hero-card t-ok goals-hero">
              <p className="hero-label">Saved towards your goals</p>
              <p className="hero-num"><Num value={saved} /></p>
              <p className="hero-sub">of {money(target)} across {s.goals.length} {s.goals.length === 1 ? 'goal' : 'goals'}</p>
              <div className="hero-bar"><i style={{ width: `${target ? clamp(saved / target, 0, 1) * 100 : 0}%` }} /></div>
            </section>
            <MoneyPlan ask={ask} cash={cash} onHelp={() => setHelper(true)} />
          </div>

          <div className="goal-list">
            {active.map(g => <GoalCard key={g.id} g={g} onFund={() => setFund(g)} onEdit={() => setEdit(g)} />)}
          </div>
          {done.length > 0 && (
            <section className="card">
              <h2>Reached 🎉</h2>
              <ul className="done-list">{done.map(g => (
                <li key={g.id}><button onClick={() => setEdit(g)}><span aria-hidden="true">{g.emoji}</span><b>{g.name}</b><span className="muted">{money(g.target)}</span></button></li>
              ))}</ul>
            </section>
          )}
        </>
      )}

      <GoalSheet g={edit} onClose={() => setEdit(null)} />
      <FundSheet g={fund} onClose={() => setFund(null)} />
      <FindMoney open={helper} onClose={() => setHelper(false)} ask={ask} cash={cash} />
    </div>
  );
}

// ── Monthly money plan: can you afford your goals? ──
function MoneyPlan({ ask, cash, onHelp }) {
  if (!ask) return (
    <section className="card plan-card">
      <h2>Your monthly plan</h2>
      <p className="muted">Give a goal a date (or a monthly amount) and this shows whether your budget can cover it.</p>
    </section>
  );
  const free = cash?.free;
  const gap = free != null ? ask - free : null;
  const ok = gap != null && gap <= 0;
  return (
    <section className={'card plan-card ' + (gap == null ? '' : ok ? 'ok' : 'short')}>
      <h2>Your monthly plan</h2>
      <div className="plan-rows">
        <div><small>Your goals need</small><b>{money(ask)}<span>/mo</span></b></div>
        <div><small>{cash ? (cash.current ? 'Left over this month' : `Left over, ${cash.months}-month average`) : 'Left over each month'}</small><b className={free != null && free < 0 ? 'neg' : ''}>{free != null ? money(free) : '—'}{free != null && <span>/mo</span>}</b></div>
      </div>
      {gap == null && <p className="muted small">Log a month of income and spending and this compares what your goals need with what you have left over.</p>}
      {gap != null && (ok
        ? <p className="plan-verdict good"><Icon name="check" size={18} /> Your budget covers your goals, with {money(-gap)} a month to spare.</p>
        : <p className="plan-verdict bad">You're {money(gap)} a month short.</p>)}
      <button className={'btn ' + (ok ? 'soft' : 'primary')} onClick={onHelp}>{ok ? 'See where you could save more' : 'Find the money'}</button>
    </section>
  );
}

// ── One goal ──
function GoalCard({ g, onFund, onEdit }) {
  const st = goalStatus(g);
  const months = Array.from({ length: 6 }, (_, i) => shiftMonth(thisMonth(), i - 5));
  const hist = months.map(m => (g.log || []).filter(l => l.date.startsWith(m)).reduce((x, l) => x + l.amount, 0));
  const hmax = Math.max(1, ...hist, st.needed || 0);
  // Where you'd be by now if saving evenly from when the goal started
  const expected = g.deadline && g.created && g.created < g.deadline
    ? clamp((parse(today()) - parse(g.created)) / (parse(g.deadline) - parse(g.created)), 0, 1) * (g.target - (g.startSaved ?? 0)) + (g.startSaved ?? 0)
    : null;

  return (
    <article className="card goal-card" style={{ '--c': g.color }}>
      <div className="goal-main">
        <button className="goal-jar" onClick={onFund} aria-label={`Add money to ${g.name}`}>
          <span className="jar-fill" style={{ height: `${st.progress * 100}%` }}><svg className="wave" viewBox="0 0 200 20" preserveAspectRatio="none" aria-hidden="true"><path d="M0 10 Q 25 0 50 10 T 100 10 T 150 10 T 200 10 V20 H0Z" /></svg></span>
          <span className="jar-emoji" aria-hidden="true">{g.emoji}</span>
        </button>
        <div className="goal-body">
          <div className="goal-title">
            <h2>{g.name}</h2>
            <span className={'pill ' + TONE[st.state]}>{st.label}</span>
          </div>
          <p className="goal-amt"><b><Num value={g.saved} /></b> <span className="muted">of {money(g.target)}</span></p>
          <div className="goal-bar">
            <i style={{ width: `${st.progress * 100}%` }} />
            {expected != null && <em style={{ left: `${clamp(expected / g.target, 0, 1) * 100}%` }} title={`Where an even pace would have you today: ${money(expected)}`} />}
          </div>
          <p className="muted small">{Math.round(st.progress * 100)}% there, {money(st.left)} to go{g.deadline ? `. Target date ${longDate(g.deadline)}${st.monthsLeft ? `, ${monthsLabel(st.monthsLeft)} away` : ''}` : ''}.</p>
        </div>
      </div>

      <div className="goal-facts">
        {g.deadline && st.state !== 'late' && <div><small>Save each month</small><b>{money(st.needed)}</b></div>}
        {st.state === 'late' && <div><small>Still needed</small><b className="neg">{money(st.left)}</b></div>}
        {!g.deadline && g.monthly > 0 && <div><small>Your monthly plan</small><b>{money(g.monthly)}</b></div>}
        <div><small>Your pace</small><b>{st.pace ? `${money(st.pace)}/mo` : '—'}</b></div>
        <div><small>At this pace</small><b>{st.projected ? shortMonth(st.projected) : '—'}</b></div>
      </div>

      {hist.some(Boolean) && (
        <div className="goal-hist" aria-label="Saved per month, last 6 months">
          {hist.map((v, i) => (
            <div key={months[i]} title={`${monthName(months[i])}: ${money(v)}`}>
              <span><i style={{ height: `${(v / hmax) * 100}%` }} /></span>
              <small>{monthName(months[i], true)}</small>
            </div>
          ))}
          {st.needed > 0 && <em style={{ bottom: `calc(18px + ${(st.needed / hmax) * 52}px)` }} title={`Needed each month: ${money(st.needed)}`} />}
        </div>
      )}

      <p className="goal-tip">{tip(g, st)}</p>
      <div className="row">
        <button className="btn primary" onClick={onFund}><Icon name="plus" size={18} /> Add money</button>
        <button className="btn ghost" onClick={onEdit}><Icon name="edit" size={18} /> Edit</button>
      </div>
    </article>
  );
}

const shortMonth = d => parse(d).toLocaleDateString('en-CA', { month: 'short', year: 'numeric' });

function tip(g, st) {
  const thisMo = savedThisMonth(g);
  if (st.state === 'late') return `The target date has passed. Pick a new date and the monthly amount updates.`;
  if (st.state === 'start') return `Put in ${money(st.needed)} this month to start on pace.`;
  if (st.state === 'behind') {
    const extra = st.needed - st.pace;
    return `Saving ${money(extra)} more a month gets you back on track${st.projected ? `. At your current pace you'd finish in ${shortMonth(st.projected)}` : ''}.`;
  }
  if (st.state === 'on') return thisMo >= st.needed ? `You've already saved this month's ${money(st.needed)}. Nice.` : `${money(Math.max(0, st.needed - thisMo))} left to save this month to stay on track.`;
  if (!st.pace && g.monthly > 0) return `Your plan is ${money(g.monthly)} a month, which gets you there around ${shortMonth(st.projected)}. Add money to start.`;
  if (st.projected) return `No date set. At ${money(st.pace)} a month you'd get there around ${shortMonth(st.projected)}. Add a date to get a monthly target.`;
  return 'Add a target date and the app tells you how much to save each month.';
}

// ── Create / edit goal ──
function GoalSheet({ g, onClose }) {
  const s = useStore();
  const [f, setF] = useState({});
  useEffect(() => { if (g) setF({ name: '', emoji: '🎯', target: '', saved: '', deadline: '', monthly: '', color: GOAL_COLORS[s.goals.length % GOAL_COLORS.length], ...g }); }, [g]); // eslint-disable-line
  if (!g) return null;
  const set = (k, v) => setF(o => ({ ...o, [k]: v }));
  const tgt = parseFloat(f.target) || 0, sv = parseFloat(f.saved) || 0;
  const preview = tgt > sv && f.deadline ? goalStatus({ target: tgt, saved: sv, deadline: f.deadline, log: [] }) : null;
  const ok = f.name?.trim() && tgt > 0;
  const save = () => {
    if (!ok) return;
    const item = { ...f, name: f.name.trim(), target: tgt, saved: sv, deadline: f.deadline || null, monthly: parseFloat(f.monthly) || 0 };
    update(d => {
      if (g.id) Object.assign(d.goals.find(x => x.id === g.id), item);
      else d.goals.push({ ...item, id: uid(), created: today(), startSaved: sv, log: [] });
    });
    toast(g.id ? 'Goal updated' : `${item.name} goal created`);
    onClose();
  };
  const quick = [[6, '6 months'], [12, '1 year'], [24, '2 years'], [60, '5 years']];
  return (
    <Sheet open onClose={onClose} title={g.id ? 'Edit goal' : 'New goal'}>
      <div className="form">
        <div className="emoji-pick" role="radiogroup" aria-label="Icon">
          {GOAL_EMOJI.map(e => <button key={e} role="radio" aria-checked={f.emoji === e} className={f.emoji === e ? 'on' : ''} onClick={() => set('emoji', e)}>{e}</button>)}
        </div>
        <Field label="What are you saving for?"><input value={f.name || ''} onChange={e => set('name', e.target.value)} placeholder="e.g. Japan trip" data-autofocus /></Field>
        <div className="grid-2 tight">
          <MoneyField label="Goal amount" value={f.target} onChange={v => set('target', v)} />
          <MoneyField label="Saved so far" value={f.saved} onChange={v => set('saved', v)} />
        </div>
        <Field label="Target date (optional)">
          <div className="chips tight wrap">
            {quick.map(([m, l]) => { const d = addMonths(today(), m); return <button key={m} className={'chip' + (f.deadline === d ? ' on' : '')} onClick={() => set('deadline', d)}>{l}</button>; })}
            <input type="date" className="date-input" value={f.deadline || ''} min={today()} onChange={e => set('deadline', e.target.value)} aria-label="Pick a target date" />
            {f.deadline && <button className="chip" onClick={() => set('deadline', '')}>No date</button>}
          </div>
        </Field>
        {!f.deadline && <MoneyField label="Or plan a monthly amount (optional)" value={f.monthly} onChange={v => set('monthly', v)} hint="Counted in your monthly plan and set aside in safe to spend." />}
        {preview && <div className="preview-box"><span aria-hidden="true">🧮</span><p>Save <b>{money(preview.needed)}</b> a month to reach {money(tgt)} by {longDate(f.deadline)}.</p></div>}
        <div className="swatches" role="radiogroup" aria-label="Colour">
          {GOAL_COLORS.map(c => <button key={c} role="radio" aria-checked={f.color === c} aria-label={c} className={f.color === c ? 'on' : ''} style={{ background: c }} onClick={() => set('color', c)} />)}
        </div>
        <div className="form-actions">
          {g.id && <button className="btn ghost danger" onClick={() => { const copy = structuredClone(s.goals.find(x => x.id === g.id)); update(d => { d.goals = d.goals.filter(x => x.id !== g.id); }); toast('Goal deleted', () => update(d => { d.goals.push(copy); })); onClose(); }}>Delete goal</button>}
          <button className="btn primary" disabled={!ok} onClick={save}>{g.id ? 'Save goal' : 'Create goal'}</button>
        </div>
      </div>
    </Sheet>
  );
}

// ── Add or take out money ──
function FundSheet({ g, onClose }) {
  const [v, setV] = useState('');
  useEffect(() => setV(''), [g]);
  if (!g) return null;
  const st = goalStatus(g);
  const suggested = Math.round(Math.max(0, st.needed - savedThisMonth(g)));
  const apply = sign => {
    const n = parseFloat(v);
    if (!(n > 0)) return;
    const before = g.saved, after = Math.max(0, before + sign * n), delta = after - before;
    const entry = { id: uid(), date: today(), amount: delta };
    update(d => { const x = d.goals.find(y => y.id === g.id); x.saved = after; (x.log ||= []).push(entry); });
    buzz(15);
    const undo = () => update(d => { const x = d.goals.find(y => y.id === g.id); x.saved = before; x.log = (x.log || []).filter(l => l.id !== entry.id); });
    if (before < g.target && after >= g.target) { confetti(); toast(`You reached your ${g.name} goal! 🎉`); }
    else toast(sign > 0 ? `Added ${amt(n)} to ${g.name}` : `Took ${amt(n)} out of ${g.name}`, undo);
    onClose();
  };
  return (
    <Sheet open onClose={onClose} title={`${g.emoji} ${g.name}`}>
      <div className="form">
        <div className="fund-head">
          <Ring value={g.saved} max={g.target} size={70} stroke={9} color={g.color} label={`${Math.round(st.progress * 100)}%`}><b className="small">{Math.round(st.progress * 100)}%</b></Ring>
          <p>{money(g.saved)} saved of {money(g.target)}<br /><span className="muted">{money(st.left)} to go</span></p>
        </div>
        <div className="chips tight wrap">
          {suggested > 0 && <button className={'chip suggest' + (+v === suggested ? ' on' : '')} onClick={() => setV(String(suggested))}>This month's amount: {money(suggested)}</button>}
          {[25, 50, 100, 250].map(n => <button key={n} className={'chip' + (+v === n ? ' on' : '')} onClick={() => setV(String(n))}>+${n}</button>)}
        </div>
        <MoneyField label="Amount" value={v} onChange={setV} autoFocus />
        <div className="form-actions">
          <button className="btn ghost" disabled={!(parseFloat(v) > 0)} onClick={() => apply(-1)}>Take money out</button>
          <button className="btn primary" disabled={!(parseFloat(v) > 0)} onClick={() => apply(1)}>Add to goal</button>
        </div>
      </div>
    </Sheet>
  );
}

// ── Find the money: interactive budget trims ──
function FindMoney({ open, onClose, ask, cash }) {
  const s = useStore();
  const gap = cash ? ask - cash.free : ask;
  const base = useMemo(() => open ? suggestCuts(s, Math.max(gap, 0) || 50) : [], [open]); // eslint-disable-line
  const [cuts, setCuts] = useState({});
  useEffect(() => { if (open) setCuts(Object.fromEntries(base.map(c => [c.cat, c.cut]))); }, [open, base]);
  if (!open) return null;
  const freed = Object.values(cuts).reduce((x, v) => x + v, 0);
  const remaining = gap - freed;
  const apply = () => {
    const chosen = base.filter(c => cuts[c.cat] > 0);
    if (!chosen.length) return;
    update(d => {
      for (const c of chosen) {
        const limit = Math.max(5, Math.round((c.avg - cuts[c.cat]) / 5) * 5);
        const b = d.budgets.find(x => x.cat === c.cat);
        if (b) b.limit = limit; else d.budgets.push({ id: uid(), cat: c.cat, limit });
      }
    });
    toast(`${chosen.length} ${chosen.length === 1 ? 'budget' : 'budgets'} set. That frees about ${money(freed)} a month for your goals.`);
    onClose();
  };
  return (
    <Sheet open onClose={onClose} title="Find the money" wide>
      <div className="form">
        {gap > 0
          ? <p>Your goals need <b>{money(ask)}</b> a month{cash ? <> and you have about <b>{money(Math.max(0, cash.free))}</b> left over</> : ''}. Drag the sliders to choose where to spend a little less.</p>
          : <p>You already cover your goals. Trimming a little more gets you there sooner.</p>}
        {base.length ? (
          <ul className="cut-list">
            {base.map(c => {
              const v = cuts[c.cat] || 0;
              return (
                <li key={c.cat}>
                  <div className="cut-top">
                    <span className="tx-ico k-expense" aria-hidden="true">{icon('expense', c.cat)}</span>
                    <span className="cut-name"><b>{c.cat}</b><small className="muted">You spend about {money(c.avg)} a month</small></span>
                    <span className={'cut-amt' + (v ? ' on' : '')}>{v ? `−${money(v)}` : '$0'}</span>
                  </div>
                  <input type="range" min="0" max={c.max} step="5" value={v} aria-label={`Spend less on ${c.cat}`}
                    style={{ '--p': `${(v / c.max) * 100}%` }} onChange={e => { setCuts(o => ({ ...o, [c.cat]: +e.target.value })); buzz(3); }} />
                  {v > 0 && <small className="muted">New budget: {money(Math.max(5, Math.round((c.avg - v) / 5) * 5))} a month</small>}
                </li>
              );
            })}
          </ul>
        ) : <Empty emoji="🔍" title="Not enough spending history yet" text="Log a few weeks of spending in categories like eating out and shopping, and suggestions appear here." />}

        <div className={'freed ' + (remaining <= 0 ? 'ok' : '')}>
          <div><small>You'd free up</small><b><Num value={freed} />/mo</b></div>
          <div><small>{remaining > 0 ? 'Still short' : 'Covered, with spare'}</small><b><Num value={Math.abs(remaining)} />/mo</b></div>
          <div className="freed-bar"><i style={{ width: `${gap > 0 ? clamp(freed / gap, 0, 1) * 100 : 100}%` }} /></div>
        </div>
        {remaining > 0 && freed > 0 && <p className="muted small">Not quite there? Push a goal's date back a little and its monthly amount drops.</p>}
        <div className="form-actions">
          <button className="btn ghost" onClick={onClose}>Not now</button>
          <button className="btn primary" disabled={!freed} onClick={apply}>Set these as budgets</button>
        </div>
      </div>
    </Sheet>
  );
}

