import { useEffect, useState } from 'react';
import { useStore, update, yearContrib, snapshotNetWorth } from '../lib/store.js';
import { uid, money, amt, compact, monthName, clamp } from '../lib/util.js';
import { estimateTax, PROVINCES, TAX_YEAR, LIMITS } from '../lib/tax.js';
import { Sheet, Segmented, MoneyField, Field, Empty, Icon, toast, Num, Area } from '../ui.jsx';

export default function Wealth({ tab, setTab }) {
  return (
    <div className="screen">
      <header className="screen-head"><h1>Wealth</h1></header>
      <Segmented label="Wealth section" value={tab} onChange={setTab} options={[['networth', 'Net worth'], ['room', 'TFSA and RRSP'], ['tax', 'Tax'], ['grow', 'Grow']]} />
      {tab === 'networth' && <NetWorth />}
      {tab === 'room' && <Room />}
      {tab === 'tax' && <Tax />}
      {tab === 'grow' && <Grow />}
    </div>
  );
}

// ── Net worth ────────────────────────────────────────────
function NetWorth() {
  const s = useStore();
  const [edit, setEdit] = useState(null);
  const assets = s.accounts.filter(a => a.type === 'asset'), debts = s.accounts.filter(a => a.type === 'debt');
  const A = assets.reduce((x, a) => x + a.value, 0), D = debts.reduce((x, a) => x + a.value, 0);
  const pts = s.snapshots.map(sn => ({ v: sn.assets - sn.debts, label: `${monthName(sn.month, true)} ${sn.month.slice(0, 4)}` }));
  const prev = s.snapshots.length > 1 ? s.snapshots[s.snapshots.length - 2] : null;
  const change = prev ? (A - D) - (prev.assets - prev.debts) : null;

  const group = (title, list, type) => (
    <section className="card flush">
      <div className="card-head pad"><h2>{title}</h2><span className="muted">{amt(list.reduce((x, a) => x + a.value, 0))}</span></div>
      {list.length ? (
        <ul className="tx-list">{list.map(a => (
          <li key={a.id} className="tx-wrap"><div className="tx"><button className="tx-main" onClick={() => setEdit(a)}>
            <span className={'tx-ico ' + (type === 'asset' ? 'k-income' : 'k-expense')} aria-hidden="true">{type === 'asset' ? '🏦' : '💳'}</span>
            <span className="tx-text"><b>{a.name}</b><small>Tap to update the balance</small></span>
            <span className="tx-amt">{amt(a.value)}</span>
          </button></div></li>
        ))}</ul>
      ) : <p className="muted pad">{type === 'asset' ? 'Bank accounts, TFSA, RRSP, investments, car, home.' : 'Credit cards, car loan, student loan, mortgage.'}</p>}
      <div className="pad"><button className="btn soft" onClick={() => setEdit({ type })}><Icon name="plus" size={18} /> Add {type === 'asset' ? 'something you own' : 'something you owe'}</button></div>
    </section>
  );

  return (
    <>
      <section className="hero-card t-ok slim">
        <p className="hero-label">Net worth</p>
        <p className="hero-num"><Num value={A - D} /></p>
        {change !== null && <p className="hero-sub">{change >= 0 ? '▲' : '▼'} {money(Math.abs(change))} since last month</p>}
        {pts.length > 1 ? <Area points={pts} /> : <p className="hero-sub">Update your balances once a month. A chart of your net worth builds up here over the years.</p>}
      </section>
      <div className="grid-2">{group('What you own', assets, 'asset')}{group('What you owe', debts, 'debt')}</div>
      <AccountSheet a={edit} onClose={() => setEdit(null)} />
    </>
  );
}

function AccountSheet({ a, onClose }) {
  const [f, setF] = useState({});
  useEffect(() => { if (a) setF({ name: '', value: '', ...a }); }, [a]);
  if (!a) return null;
  const ok = f.name?.trim() && f.value !== '' && parseFloat(f.value) >= 0;
  const save = () => {
    if (!ok) return;
    const item = { ...f, name: f.name.trim(), value: parseFloat(f.value) };
    update(d => { if (a.id) Object.assign(d.accounts.find(x => x.id === a.id), item); else d.accounts.push({ ...item, id: uid() }); snapshotNetWorth(d); });
    toast('Net worth updated');
    onClose();
  };
  return (
    <Sheet open onClose={onClose} title={a.id ? a.name : a.type === 'asset' ? 'Something you own' : 'Something you owe'}>
      <div className="form">
        <Field label="Name"><input value={f.name || ''} onChange={e => setF(o => ({ ...o, name: e.target.value }))} placeholder={a.type === 'asset' ? 'e.g. TFSA at Wealthsimple' : 'e.g. Visa card'} data-autofocus={!a.id ? '' : undefined} /></Field>
        <MoneyField label={a.type === 'asset' ? 'Current value' : 'Amount owed'} value={f.value} onChange={v => setF(o => ({ ...o, value: v }))} autoFocus={!!a.id} />
        <div className="form-actions">
          {a.id && <button className="btn ghost danger" onClick={() => { update(d => { d.accounts = d.accounts.filter(x => x.id !== a.id); snapshotNetWorth(d); }); toast('Removed'); onClose(); }}>Remove</button>}
          <button className="btn primary" disabled={!ok} onClick={save}>Save</button>
        </div>
      </div>
    </Sheet>
  );
}

// ── Registered account room ──────────────────────────────
function Room() {
  const s = useStore();
  const yr = s.room.year;
  const items = [
    { key: 'tfsa', name: 'TFSA', emoji: '🌱', hint: `The ${yr} limit is ${money(LIMITS.tfsaAnnual)} plus any unused room from past years.` },
    { key: 'rrsp', name: 'RRSP', emoji: '🏦', hint: `Your room is on last year's Notice of Assessment. The ${LIMITS.rrspYear} maximum is ${money(LIMITS.rrspMax)}.` },
    { key: 'fhsa', name: 'FHSA', emoji: '🔑', hint: `Up to ${money(LIMITS.fhsaAnnual)} a year, ${money(LIMITS.fhsaLifetime)} lifetime, for a first home.` }
  ];
  return (
    <>
      <p className="muted">Enter the room you had on January 1, {yr}. Find it in CRA My Account. Contributions you log as <b>Invested</b> in that category count against it automatically.</p>
      <div className="room-grid">
        {items.map(it => {
          const room = s.room[it.key], used = yearContrib(s, it.name, yr), left = room != null ? room - used : null;
          return (
            <section className="card room" key={it.key}>
              <div className="card-head"><h2><span aria-hidden="true">{it.emoji}</span> {it.name}</h2>{left != null && <span className={'pill ' + (left < 0 ? 'bad' : 'good')}>{left < 0 ? `${money(-left)} over` : `${money(left)} left`}</span>}</div>
              <MoneyField label={`Room on Jan 1, ${yr}`} value={room ?? ''} onChange={v => update(d => { d.room[it.key] = v === '' ? null : Math.max(0, parseFloat(v) || 0); })} hint={it.hint} />
              <div className="bar"><i className={left != null && left < 0 ? 'over' : ''} style={{ width: `${room ? clamp(used / room, 0, 1) * 100 : 0}%` }} /></div>
              <p className="muted small">{amt(used)} contributed in {yr}</p>
              {left != null && left < 0 && <p className="err small">Over-contributions are charged 1% a month by the CRA. Check your room before adding more.</p>}
            </section>
          );
        })}
      </div>
    </>
  );
}

// ── Tax estimate ─────────────────────────────────────────
function Tax() {
  const s = useStore();
  const salary = s.profile.salary || '';
  const prov = s.profile.province || 'ON';
  const t = estimateTax(salary, prov);
  const setP = (k, v) => update(d => { d.profile[k] = v; });
  const rows = [['Federal tax', t.federal], [`${t.province} tax`, t.provincial], [prov === 'QC' ? 'QPP' : 'CPP', t.cpp], [prov === 'QC' ? 'EI and QPIP' : 'EI', t.ei]];
  return (
    <>
      <section className="card">
        <div className="grid-2 tight">
          <MoneyField label="Yearly salary before tax" value={salary} onChange={v => setP('salary', parseFloat(v) || 0)} />
          <Field label="Province or territory">
            <select value={prov} onChange={e => setP('province', e.target.value)}>
              {Object.entries(PROVINCES).sort((a, b) => a[1].name.localeCompare(b[1].name)).map(([k, p]) => <option key={k} value={k}>{p.name}</option>)}
            </select>
          </Field>
        </div>
      </section>
      {t.gross > 0 ? (
        <>
          <section className="hero-card t-ok slim">
            <p className="hero-label">Take-home pay</p>
            <p className="hero-num"><Num value={t.takeHome / 12} /><small> a month</small></p>
            <p className="hero-sub">{money(t.takeHome)} a year, about {money(t.takeHome / 26)} every two weeks</p>
          </section>
          <section className="card">
            <div className="taxbar" role="img" aria-label="Where your salary goes">
              {[['var(--green)', t.takeHome], ['var(--cobalt)', t.federal], ['var(--violet)', t.provincial], ['var(--amber)', t.cpp + t.ei]].map(([c, v], i) => <i key={i} style={{ flex: Math.max(v, 0), background: c }} />)}
            </div>
            <ul className="legend plain">
              <li><i style={{ background: 'var(--green)' }} />You keep<b>{money(t.takeHome)}</b></li>
              {rows.map(([l, v], i) => <li key={l}><i style={{ background: ['var(--cobalt)', 'var(--violet)', 'var(--amber)', 'var(--amber)'][i] }} />{l}<b>{money(v)}</b></li>)}
            </ul>
            <div className="mini-stats">
              <div><small>Average income tax rate</small><b>{(t.avgRate * 100).toFixed(1)}%</b></div>
              <div><small>Tax on your next dollar</small><b>{(t.marginal * 100).toFixed(1)}%</b></div>
            </div>
            <p className="muted small">An estimate using {TAX_YEAR} tax brackets for employment income, with basic credits only. Each dollar you put in an RRSP saves you about {(t.marginal * 100).toFixed(0)}¢ in tax.</p>
          </section>
        </>
      ) : <Empty emoji="🧾" title="See your take-home pay" text="Enter your salary to see federal and provincial tax, CPP and EI, and what lands in your account." />}
    </>
  );
}

// ── Growth calculator ────────────────────────────────────
function Grow() {
  const [monthly, setMonthly] = useState(300);
  const [years, setYears] = useState(20);
  const [rate, setRate] = useState(6);
  const r = rate / 100 / 12, n = years * 12;
  const fv = r ? monthly * ((Math.pow(1 + r, n) - 1) / r) : monthly * n;
  const put = monthly * n;
  const pts = Array.from({ length: years + 1 }, (_, y) => ({ v: r ? monthly * ((Math.pow(1 + r, y * 12) - 1) / r) : monthly * y * 12, label: `year ${y}` }));
  return (
    <section className="card grow">
      <div className="slider">
        <label htmlFor="gm"><span>Invest every month</span><b>{money(monthly)}</b></label>
        <input id="gm" type="range" min="25" max="3000" step="25" value={monthly} onChange={e => setMonthly(+e.target.value)} style={{ '--p': `${(monthly - 25) / 2975 * 100}%` }} />
      </div>
      <div className="slider">
        <label htmlFor="gy"><span>For</span><b>{years} years</b></label>
        <input id="gy" type="range" min="1" max="45" value={years} onChange={e => setYears(+e.target.value)} style={{ '--p': `${(years - 1) / 44 * 100}%` }} />
      </div>
      <div className="slider">
        <label htmlFor="gr"><span>Yearly return</span><b>{rate}%</b></label>
        <input id="gr" type="range" min="0" max="12" step="0.5" value={rate} onChange={e => setRate(+e.target.value)} style={{ '--p': `${rate / 12 * 100}%` }} />
      </div>
      <div className="grow-result">
        <p className="muted">You could have</p>
        <p className="hero-num ink"><Num value={fv} /></p>
        <p className="muted">{money(put)} you put in, {money(fv - put)} from growth</p>
      </div>
      <Area points={pts} height={140} />
      <p className="muted small">Returns are never guaranteed and go up and down year to year. Not financial advice.</p>
    </section>
  );
}
