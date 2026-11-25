import { useStore, safeToSpend, upcoming, categorySpend } from '../lib/store.js';
import { thisMonth, today, addDays, monthName, money, amt, dayLabel, compact } from '../lib/util.js';
import { icon } from '../lib/categories.js';
import { Num, Ring, Icon } from '../ui.jsx';
import TxList from './TxList.jsx';

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

export default function Home({ go, add, edit, nudges }) {
  const s = useStore();
  const m = thisMonth();
  const sts = safeToSpend(s);
  const soon = upcoming(s, today(), addDays(today(), 30)).slice(0, 8);
  const spendByCat = Object.fromEntries(categorySpend(s, m));
  const recent = [...s.tx].sort((a, b) => b.date.localeCompare(a.date) || 0).slice(0, 6);
  const hasIncome = sts.income > 0;
  const tone = !hasIncome ? 'idle' : sts.safe < 0 ? 'neg' : sts.perDay < 15 ? 'low' : 'ok';

  return (
    <div className="screen home">
      <header className="screen-head">
        <div>
          <p className="muted">{greeting()}{s.profile.name ? `, ${s.profile.name}` : ''}</p>
          <h1>{monthName(m)}</h1>
        </div>
      </header>

      {nudges}

      <section className={'hero-card t-' + tone} aria-label="Safe to spend this month">
        {hasIncome ? (
          <>
            <p className="hero-label">{sts.safe >= 0 ? 'Safe to spend this month' : 'Over for this month by'}</p>
            <p className="hero-num"><Num value={Math.abs(sts.safe)} format={v => money(v)} /></p>
            <p className="hero-sub">
              {sts.safe >= 0
                ? <>About <b>{money(Math.max(0, sts.perDay))}</b> a day for the next {sts.daysLeft} {sts.daysLeft === 1 ? 'day' : 'days'}</>
                : <>Bills and spending are more than this month's income</>}
            </p>
            <div className="flow">
              <div><small>Money in</small><b>{amt(sts.income)}</b></div>
              <div><small>Spent and invested</small><b>{amt(sts.spent + sts.invested)}</b></div>
              <div><small>Bills still to come</small><b>{amt(sts.comingOut)}</b></div>
            </div>
          </>
        ) : (
          <>
            <p className="hero-label">Safe to spend this month</p>
            <p className="hero-num dim">$—</p>
            <p className="hero-sub">Add this month's pay and the app works out what you can spend after bills.</p>
            <div className="row"><button className="btn sun" onClick={() => add('income')}><Icon name="plus" size={18} /> Add your pay</button></div>
          </>
        )}
      </section>

      <div className="stat-row">
        {[['expense', 'Spent', sts.spent], ['income', 'Earned', s.tx.filter(t => t.kind === 'income' && t.date.startsWith(m)).reduce((x, t) => x + t.amount, 0)], ['invest', 'Invested', sts.invested]].map(([k, l, v]) => (
          <button key={k} className={'stat k-' + k} onClick={() => go('activity', k)}>
            <small>{l} in {monthName(m, true)}</small>
            <b><Num value={v} format={compact} /></b>
          </button>
        ))}
      </div>

      <section className="card">
        <div className="card-head"><h2>Coming up</h2><button className="link" onClick={() => go('plan', 'bills')}>Bills and pay</button></div>
        {soon.length ? (
          <div className="hscroll">
            {soon.map((r, i) => (
              <div key={r.id + r.date + i} className={'bill k-' + r.kind}>
                <span className="bill-ico" aria-hidden="true">{icon(r.kind, r.cat)}</span>
                <b>{r.name}</b>
                <small>{dayLabel(r.date)}</small>
                <span className="bill-amt">{r.kind === 'income' ? '+' : ''}{amt(r.amount)}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="muted">Add rent, phone, subscriptions and your paycheque once. They fill themselves in every time they're due.
            <button className="link" onClick={() => go('plan', 'bills')}>Add a bill</button></p>
        )}
      </section>

      <section className="card">
        <div className="card-head"><h2>Budgets</h2><button className="link" onClick={() => go('plan', 'budgets')}>{s.budgets.length ? 'All budgets' : 'Set a budget'}</button></div>
        {s.budgets.length ? (
          <div className="ring-grid">
            {s.budgets.slice(0, 4).map(b => {
              const spent = spendByCat[b.cat] || 0, left = b.limit - spent;
              return (
                <button key={b.id} className="ring-item" onClick={() => go('plan', 'budgets')}>
                  <Ring value={spent} max={b.limit} size={76} stroke={9} label={`${b.cat}: ${money(spent)} of ${money(b.limit)}`}><span aria-hidden="true">{icon('expense', b.cat)}</span></Ring>
                  <b>{b.cat}</b>
                  <small className={left < 0 ? 'neg' : ''}>{left >= 0 ? `${compact(left)} left` : `${compact(-left)} over`}</small>
                </button>
              );
            })}
          </div>
        ) : <p className="muted">Pick a monthly limit for groceries, eating out or anything else. The ring turns amber at 80% and red when you go over.</p>}
      </section>

      <section className="card">
        <div className="card-head"><h2>Recent</h2>{s.tx.length > 0 && <button className="link" onClick={() => go('activity')}>See all</button>}</div>
        {recent.length ? <TxList items={recent} onEdit={edit} group={false} /> : (
          <div className="first-add">
            <p>Add your first expense. It takes about three seconds.</p>
            <button className="btn primary" onClick={() => add('expense')}><Icon name="plus" size={18} /> Add an expense</button>
          </div>
        )}
      </section>
    </div>
  );
}
