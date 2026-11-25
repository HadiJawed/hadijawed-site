import { useState } from 'react';
import { useStore, safeToSpend, upcoming, categorySpend } from '../lib/store.js';
import { thisMonth, today, addDays, monthName, money, amt, dayLabel, compact, daysInMonth, clamp } from '../lib/util.js';
import { icon } from '../lib/categories.js';
import { spendingPace, dailySpend, insights } from '../lib/insights.js';
import { goalStatus } from '../lib/goals.js';
import { Num, Ring, Icon, Area } from '../ui.jsx';
import TxList from './TxList.jsx';

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

export default function Home({ go, add, edit, nudges }) {
  const s = useStore();
  const m = thisMonth();
  return (
    <div className="screen home">
      <header className="screen-head">
        <div>
          <p className="muted">{greeting()}{s.profile.name ? `, ${s.profile.name}` : ''}</p>
          <h1>{monthName(m)} at a glance</h1>
        </div>
        <button className="btn primary small desk-only" onClick={() => add('expense')}><Icon name="plus" size={18} /> Add</button>
      </header>
      {nudges}
      <div className="dash">
        <Hero s={s} add={add} />
        <Insights s={s} go={go} />
        <Pace s={s} />
        <GoalsMini s={s} go={go} />
        <Calendar s={s} go={go} />
        <Budgets s={s} go={go} />
        <NetWorth s={s} go={go} />
        <ComingUp s={s} go={go} />
        <Recent s={s} go={go} add={add} edit={edit} />
      </div>
    </div>
  );
}

// ── Safe to spend ──
function Hero({ s, add }) {
  const sts = safeToSpend(s);
  const hasIncome = sts.income > 0;
  const tone = !hasIncome ? 'idle' : sts.safe < 0 ? 'neg' : sts.perDay < 15 ? 'low' : 'ok';
  const m = thisMonth(), day = +today().slice(8), days = daysInMonth(m);
  const used = hasIncome ? clamp((sts.spent + sts.invested) / sts.income, 0, 1.2) : 0;
  const monthGone = day / days;
  return (
    <section className={'hero-card dash-hero t-' + tone} style={{ '--i': 0 }} aria-label="Safe to spend this month">
      {hasIncome ? (
        <>
          <p className="hero-label">{sts.safe >= 0 ? 'Safe to spend this month' : 'Over for this month by'}</p>
          <p className="hero-num"><Num value={Math.abs(sts.safe)} /></p>
          <p className="hero-sub">
            {sts.safe >= 0
              ? <>About <b>{money(Math.max(0, sts.perDay))}</b> a day for the next {sts.daysLeft} {sts.daysLeft === 1 ? 'day' : 'days'}, after bills{sts.forGoals > 0 ? ' and goals' : ''}</>
              : <>Bills, spending{sts.forGoals > 0 ? ' and goal savings' : ''} add up to more than this month's income</>}
          </p>
          <div className="month-track" aria-label={`${Math.round(used * 100)}% of money in is used, ${Math.round(monthGone * 100)}% of the month has gone`}>
            <i style={{ width: `${Math.min(used, 1) * 100}%` }} className={used > monthGone + .1 ? 'fast' : ''} />
            <em style={{ left: `${monthGone * 100}%` }} />
          </div>
          <p className="track-label"><span>{Math.round(used * 100)}% of your money used</span><span>{Math.round(monthGone * 100)}% of the month gone</span></p>
          <div className="flow">
            <div><small>Money in</small><b>{amt(sts.income)}</b></div>
            <div><small>Spent and invested</small><b>{amt(sts.spent + sts.invested)}</b></div>
            <div><small>Bills still to come</small><b>{amt(sts.comingOut)}</b></div>
            {sts.forGoals > 0 && <div><small>Set aside for goals</small><b>{amt(sts.forGoals)}</b></div>}
          </div>
        </>
      ) : (
        <>
          <p className="hero-label">Safe to spend this month</p>
          <p className="hero-num dim">$—</p>
          <p className="hero-sub">Add this month's pay and the app works out what you can spend after bills and goals.</p>
          <div className="row"><button className="btn sun" onClick={() => add('income')}><Icon name="plus" size={18} /> Add your pay</button></div>
        </>
      )}
    </section>
  );
}

// ── Insights ──
function Insights({ s, go }) {
  const list = insights(s);
  return (
    <section className="card dash-ins" style={{ '--i': 1 }}>
      <h2>What's happening</h2>
      {list.length ? (
        <ul className="ins-list">
          {list.map((x, i) => (
            <li key={i}><button className={'ins t-' + (x.tone || 'plain')} onClick={() => go(...x.go)}>
              <span className="ins-emoji" aria-hidden="true">{x.emoji}</span><span>{x.text}</span>
            </button></li>
          ))}
        </ul>
      ) : <p className="muted">Add a few days of spending and observations about your money show up here: what's up, what's down, and what's coming.</p>}
    </section>
  );
}

// ── Spending pace: this month vs last ──
function Pace({ s }) {
  const p = spendingPace(s);
  const [hover, setHover] = useState(null);
  const W = 600, H = 190, pad = 6;
  const max = Math.max(1, p.prevTotal, p.spent) * 1.08;
  const x = d => pad + (d / (p.days - 1)) * (W - pad * 2);
  const y = v => H - pad - (v / max) * (H - pad * 2);
  const line = arr => arr.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join('');
  const diff = p.spent - p.prevSameDay;
  const hasData = p.spent > 0 || p.prevTotal > 0;
  const h = hover ?? p.day - 1;
  return (
    <section className="card dash-pace" style={{ '--i': 2 }}>
      <div className="card-head">
        <h2>Spending pace</h2>
        <span className="key"><i style={{ background: 'var(--cobalt)' }} />This month <i className="dashed" />Last month</span>
      </div>
      {hasData ? (
        <>
          <p className="pace-line"><b><Num value={p.spent} /></b> spent so far
            {p.prevSameDay > 0 && <span className={diff <= 0 ? 'pos' : 'neg'}>{diff <= 0 ? ` ${money(-diff)} less` : ` ${money(diff)} more`} than this point last month</span>}
          </p>
          <div className="pace-chart">
            <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label="Cumulative spending this month compared with last month"
              onPointerMove={e => { const b = e.currentTarget.getBoundingClientRect(); setHover(Math.round(clamp((e.clientX - b.left) / b.width, 0, 1) * (p.days - 1))); }}
              onPointerLeave={() => setHover(null)}>
              <defs><linearGradient id="pg" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="var(--cobalt)" stopOpacity=".25" /><stop offset="1" stopColor="var(--cobalt)" stopOpacity="0" /></linearGradient></defs>
              {[.25, .5, .75].map(f => <line key={f} x1="0" x2={W} y1={H * f} y2={H * f} stroke="var(--line)" strokeWidth="1" vectorEffect="non-scaling-stroke" />)}
              {p.prev.length > 1 && <path d={line(p.prev)} fill="none" stroke="var(--soft)" strokeOpacity=".55" strokeWidth="2.5" strokeDasharray="6 6" vectorEffect="non-scaling-stroke" />}
              {p.now.length > 0 && <>
                <path d={`${line(p.now)}L${x(p.now.length - 1)},${H}L${x(0)},${H}Z`} fill="url(#pg)" />
                <path d={line(p.now)} fill="none" stroke="var(--cobalt)" strokeWidth="3.5" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" className="draw" />
              </>}
              <line x1={x(h)} x2={x(h)} y1="0" y2={H} stroke="var(--ink)" strokeOpacity=".15" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
            </svg>
            {p.now.length > 0 && <span className="pace-dot" style={{ left: `${(x(p.now.length - 1) / W) * 100}%`, top: `${(y(p.spent) / H) * 100}%` }} />}
            <div className="pace-tip" style={{ left: `${(x(h) / W) * 100}%` }}>
              <b>{monthName(thisMonth(), true)} {h + 1}</b>
              {h < p.now.length && <span>This month {compact(p.now[h])}</span>}
              {p.prev[h] != null && <span>Last month {compact(p.prev[h])}</span>}
            </div>
          </div>
          <div className="pace-axis"><span>1</span><span>{Math.round(p.days / 2)}</span><span>{p.days}</span></div>
        </>
      ) : <p className="muted">Your spending this month draws a line here, next to last month's, so you can see if you're spending faster or slower.</p>}
    </section>
  );
}

// ── Goals ──
function GoalsMini({ s, go }) {
  const list = s.goals.map(g => ({ g, st: goalStatus(g) })).filter(x => x.st.state !== 'done')
    .sort((a, b) => (a.g.deadline || '9999').localeCompare(b.g.deadline || '9999')).slice(0, 3);
  const tone = { on: 'good', behind: 'bad', late: 'bad', start: 'warn', open: '' };
  return (
    <section className="card dash-goals" style={{ '--i': 3 }}>
      <div className="card-head"><h2>Goals</h2><button className="link" onClick={() => go('goals')}>{s.goals.length ? 'All goals' : 'Add a goal'}</button></div>
      {list.length ? (
        <ul className="mini-goals">
          {list.map(({ g, st }) => (
            <li key={g.id}><button onClick={() => go('goals')} style={{ '--c': g.color }}>
              <span className="mg-emoji" aria-hidden="true">{g.emoji}</span>
              <span className="mg-body">
                <span className="mg-top"><b>{g.name}</b><span className={'pill tiny ' + tone[st.state]}>{st.label}</span></span>
                <span className="mg-bar"><i style={{ width: `${st.progress * 100}%` }} /></span>
                <small className="muted">{Math.round(st.progress * 100)}% of {compact(g.target)}{st.needed > 0 ? `, save ${money(st.needed)}/mo` : ''}</small>
              </span>
            </button></li>
          ))}
        </ul>
      ) : s.goals.length
        ? <p className="muted">Every goal reached. Time for a new one? 🎉</p>
        : <p className="muted">Saving for a trip, a car or an emergency fund? Add a goal with a date and the app tells you what to put away each month.</p>}
    </section>
  );
}

// ── Spending calendar (heatmap) ──
function Calendar({ s, go }) {
  const m = thisMonth(), day = +today().slice(8);
  const spend = dailySpend(s, m);
  const max = Math.max(1, ...spend);
  const first = new Date(+m.slice(0, 4), +m.slice(5) - 1, 1).getDay();
  const noSpend = spend.slice(0, day).filter(v => v === 0).length;
  const [pick, setPick] = useState(null);
  const shown = pick ?? day - 1;
  return (
    <section className="card dash-cal" style={{ '--i': 4 }}>
      <div className="card-head"><h2>Spending days</h2><span className="pill good">{noSpend} no-spend {noSpend === 1 ? 'day' : 'days'}</span></div>
      <div className="cal" role="grid" aria-label={`Spending each day in ${monthName(m)}`}>
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => <span key={i} className="cal-h" aria-hidden="true">{d}</span>)}
        {Array.from({ length: first }, (_, i) => <span key={'b' + i} />)}
        {spend.map((v, i) => {
          const future = i + 1 > day;
          // Square-root scale so one big day (rent) doesn't wash out the rest
          const lvl = v ? 0.15 + 0.85 * Math.sqrt(v / max) : 0;
          return (
            <button key={i} className={'cal-d' + (i + 1 === day ? ' today' : '') + (future ? ' future' : '') + (shown === i ? ' on' : '') + (lvl > .6 ? ' hot' : '')}
              style={{ '--l': lvl }} disabled={future} onClick={() => setPick(i)} onDoubleClick={() => go('activity')}
              aria-label={`${monthName(m, true)} ${i + 1}: ${future ? 'not yet' : v ? money(v) + ' spent' : 'no spending'}`}>
              {i + 1}
            </button>
          );
        })}
      </div>
      <p className="cal-foot"><b>{monthName(m, true)} {shown + 1}</b> {spend[shown] ? `${amt(spend[shown])} spent` : 'No spending'}</p>
    </section>
  );
}

// ── Budgets ──
function Budgets({ s, go }) {
  const spendByCat = Object.fromEntries(categorySpend(s, thisMonth()));
  return (
    <section className="card dash-bud" style={{ '--i': 5 }}>
      <div className="card-head"><h2>Budgets</h2><button className="link" onClick={() => go('plan', 'budgets')}>{s.budgets.length ? 'All' : 'Set one'}</button></div>
      {s.budgets.length ? (
        <div className="ring-grid">
          {s.budgets.slice(0, 4).map(b => {
            const spent = spendByCat[b.cat] || 0, left = b.limit - spent;
            return (
              <button key={b.id} className="ring-item" onClick={() => go('plan', 'budgets')}>
                <Ring value={spent} max={b.limit} size={68} stroke={8} label={`${b.cat}: ${money(spent)} of ${money(b.limit)}`}><span aria-hidden="true">{icon('expense', b.cat)}</span></Ring>
                <b>{b.cat}</b>
                <small className={left < 0 ? 'neg' : ''}>{left >= 0 ? `${compact(left)} left` : `${compact(-left)} over`}</small>
              </button>
            );
          })}
        </div>
      ) : <p className="muted">Set a monthly limit for a category. The ring turns amber at 80% and red when you go over.</p>}
    </section>
  );
}

// ── Net worth ──
function NetWorth({ s, go }) {
  const A = s.accounts.filter(a => a.type === 'asset').reduce((x, a) => x + a.value, 0);
  const D = s.accounts.filter(a => a.type === 'debt').reduce((x, a) => x + a.value, 0);
  const pts = s.snapshots.map(sn => ({ v: sn.assets - sn.debts, label: `${monthName(sn.month, true)} ${sn.month.slice(0, 4)}` }));
  const prev = s.snapshots.length > 1 ? s.snapshots[s.snapshots.length - 2] : null;
  const change = prev ? (A - D) - (prev.assets - prev.debts) : null;
  return (
    <section className="card dash-nw" style={{ '--i': 6 }}>
      <div className="card-head"><h2>Net worth</h2><button className="link" onClick={() => go('wealth', 'networth')}>{s.accounts.length ? 'Update' : 'Set up'}</button></div>
      {s.accounts.length ? (
        <>
          <p className="nw-num"><Num value={A - D} /></p>
          {change !== null ? <p className={change >= 0 ? 'pos small' : 'neg small'}>{change >= 0 ? '▲' : '▼'} {money(Math.abs(change))} since last month</p> : <p className="muted small">{money(A)} owned, {money(D)} owed</p>}
          {pts.length > 1 && <Area points={pts} height={70} />}
        </>
      ) : <p className="muted">Add what you own and owe once. Update it monthly and watch it grow.</p>}
    </section>
  );
}

// ── Coming up ──
function ComingUp({ s, go }) {
  const soon = upcoming(s, today(), addDays(today(), 30)).slice(0, 10);
  return (
    <section className="card dash-soon" style={{ '--i': 7 }}>
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
      ) : <p className="muted">Add rent, phone, subscriptions and your pay once. They fill themselves in when they're due. <button className="link" onClick={() => go('plan', 'bills')}>Add a bill</button></p>}
    </section>
  );
}

// ── Recent ──
function Recent({ s, go, add, edit }) {
  const recent = [...s.tx].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6);
  return (
    <section className="card dash-recent flush-x" style={{ '--i': 8 }}>
      <div className="card-head pad-x"><h2>Recent</h2>{s.tx.length > 0 && <button className="link" onClick={() => go('activity')}>See all</button>}</div>
      {recent.length ? <TxList items={recent} onEdit={edit} group={false} /> : (
        <div className="first-add pad-x">
          <p>Add your first expense. It takes about three seconds.</p>
          <button className="btn primary" onClick={() => add('expense')}><Icon name="plus" size={18} /> Add an expense</button>
        </div>
      )}
    </section>
  );
}
