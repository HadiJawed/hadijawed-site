import { useCallback, useEffect, useState } from 'react';
import { useStore, useStatus, update, runRecurring } from './lib/store.js';
import { today, parse } from './lib/util.js';
import { backupNow } from './lib/backup.js';
import { Icon, Toasts, toast, Sheet } from './ui.jsx';
import Goals from './screens/Goals.jsx';
import Home from './screens/Home.jsx';
import Activity from './screens/Activity.jsx';
import Plan from './screens/Plan.jsx';
import Wealth from './screens/Wealth.jsx';
import Settings from './screens/Settings.jsx';
import QuickAdd from './screens/QuickAdd.jsx';

const TABS = [['home', 'Home', 'home'], ['activity', 'Activity', 'list'], ['goals', 'Goals', 'target'], ['plan', 'Plan', 'plan'], ['wealth', 'Wealth', 'wealth'], ['settings', 'Settings', 'gear']];
const SUBTABS = { plan: ['budgets', 'bills'], wealth: ['networth', 'room', 'tax', 'grow'] };
const MORE = [['plan', 'budgets', '🎯', 'Budgets', 'Monthly limits'], ['plan', 'bills', '🔁', 'Bills and pay', 'Things that repeat'], ['wealth', 'networth', '📈', 'Net worth', 'Own minus owe'],
  ['wealth', 'room', '🌱', 'TFSA and RRSP', 'Contribution room'], ['wealth', 'tax', '🧾', 'Tax', 'Take-home pay'], ['wealth', 'grow', '🚀', 'Grow', 'Compound growth'], ['settings', null, '⚙️', 'Settings', 'Backups, install']];

function readHash() {
  let [tab, sub] = location.hash.replace('#', '').split('/');
  if (tab === 'plan' && sub === 'goals') tab = 'goals'; // old link
  return { tab: TABS.some(t => t[0] === tab) ? tab : 'home', sub };
}

function useInstall() {
  const [prompt, setPrompt] = useState(null);
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  useEffect(() => {
    const h = e => { e.preventDefault(); setPrompt(e); };
    window.addEventListener('beforeinstallprompt', h);
    window.addEventListener('appinstalled', () => { setPrompt(null); toast('Installed. Open it from your home screen or app list.'); });
    return () => window.removeEventListener('beforeinstallprompt', h);
  }, []);
  const run = async () => { if (!prompt) return; prompt.prompt(); await prompt.userChoice; setPrompt(null); };
  return { prompt, standalone, ios, run };
}

export default function App() {
  const s = useStore();
  const status = useStatus();
  const [{ tab, sub }, setRoute] = useState(readHash);
  const [qa, setQa] = useState(null);
  const [actKind, setActKind] = useState(null);
  const [more, setMore] = useState(false);
  const install = useInstall();

  const go = useCallback((t, subtab) => {
    if (t === 'activity') setActKind(subtab || 'all');
    const h = '#' + t + (subtab && SUBTABS[t] ? '/' + subtab : '');
    if (location.hash !== h) history.pushState(null, '', h);
    setRoute({ tab: t, sub: subtab });
    window.scrollTo({ top: 0 });
  }, []);
  useEffect(() => {
    const h = () => { setRoute(readHash()); setMore(false); };
    window.addEventListener('popstate', h);
    return () => window.removeEventListener('popstate', h);
  }, []);

  // New day while the app stays open: fill in bills that came due
  useEffect(() => {
    const h = () => { if (document.visibilityState === 'visible') runRecurring(); };
    document.addEventListener('visibilitychange', h);
    return () => document.removeEventListener('visibilitychange', h);
  }, []);

  // Keyboard: "n" adds an entry
  useEffect(() => {
    const h = e => {
      if (e.key === 'n' && !e.metaKey && !e.ctrlKey && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName) && !document.querySelector('.scrim')) { e.preventDefault(); setQa({ kind: 'expense' }); }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);

  useEffect(() => { if (status.migrated) toast('Your data from the old tracker was brought over'); }, [status.migrated]);

  const add = kind => setQa({ kind });
  const edit = t => setQa({ tx: t });
  const subOf = t => SUBTABS[t]?.includes(sub) ? sub : SUBTABS[t]?.[0];

  const nudges = <Nudges s={s} install={install} go={go} add={add} />;

  return (
    <div className="app">
      <a className="skip" href="#main">Skip to content</a>
      <nav className="side" aria-label="Main">
        <a className="brand" href="/" aria-label="Back to hadijawedd.netlify.app"><i aria-hidden="true" /> Finance</a>
        <button className="btn primary add-side" onClick={() => add('expense')}><Icon name="plus" size={20} /> Add <kbd>N</kbd></button>
        {TABS.map(([k, l, ic]) => (
          <button key={k} className={'side-btn' + (tab === k ? ' on' : '')} aria-current={tab === k ? 'page' : undefined} onClick={() => go(k)}><Icon name={ic} /> {l}</button>
        ))}
        <p className="side-foot">{status.saved ? <><Icon name="check" size={14} /> Saved on this device</> : 'Saving…'}</p>
      </nav>

      <main id="main" className="main">
        {status.error && <div className="banner bad" role="alert">{status.error}</div>}
        {tab === 'home' && <Home go={go} add={add} edit={edit} nudges={nudges} />}
        {tab === 'activity' && <Activity edit={edit} add={add} initialKind={actKind} />}
        {tab === 'goals' && <Goals />}
        {tab === 'plan' && <Plan tab={subOf('plan')} setTab={t => go('plan', t)} />}
        {tab === 'wealth' && <Wealth tab={subOf('wealth')} setTab={t => go('wealth', t)} />}
        {tab === 'settings' && <Settings install={install} />}
      </main>

      <nav className="bottom" aria-label="Main">
        {[TABS[0], TABS[1]].map(([k, l, ic]) => (
          <button key={k} className={tab === k ? 'on' : ''} aria-current={tab === k ? 'page' : undefined} onClick={() => go(k)}><Icon name={ic} /><span>{l}</span></button>
        ))}
        <button className="fab" onClick={() => add('expense')} aria-label="Add an entry"><Icon name="plus" size={30} /></button>
        <button className={tab === 'goals' ? 'on' : ''} aria-current={tab === 'goals' ? 'page' : undefined} onClick={() => go('goals')}><Icon name="target" /><span>Goals</span></button>
        <button className={['plan', 'wealth', 'settings'].includes(tab) ? 'on' : ''} onClick={() => setMore(true)} aria-haspopup="dialog"><Icon name="grid" /><span>More</span></button>
      </nav>

      <Sheet open={more} onClose={() => setMore(false)} title="More">
        <div className="more-grid">
          {MORE.map(([t, st, e, l, d]) => (
            <button key={l} onClick={() => { setMore(false); go(t, st); }}><span aria-hidden="true">{e}</span>{l}<small>{d}</small></button>
          ))}
        </div>
      </Sheet>

      <QuickAdd open={qa} onClose={() => setQa(null)} />
      <Toasts />
    </div>
  );
}

function Nudges({ s, install, go, add }) {
  const t = today();
  const daysSince = d => d ? Math.round((parse(t) - parse(d)) / 864e5) : Infinity;
  const dismissed = s.settings.backupNudgeDismissed === t;
  const needsBackup = s.tx.length >= 10 && daysSince(s.settings.lastBackup) > 30 && !dismissed;

  const steps = [
    { done: s.tx.some(x => x.kind === 'income') || s.recurring.some(r => r.kind === 'income'), label: 'Add your pay', act: () => go('plan', 'bills') },
    { done: s.recurring.some(r => r.kind !== 'income'), label: 'Add a bill like rent or your phone', act: () => go('plan', 'bills') },
    { done: s.tx.some(x => x.kind === 'expense'), label: 'Add something you spent today', act: () => add('expense') },
    { done: install.standalone, label: 'Put the app on your home screen', act: () => go('settings') }
  ];
  const showWelcome = !s.settings.welcomeDone && steps.some(x => !x.done) && !s.settings.migratedFromV2;

  return (
    <>
      {showWelcome && (
        <section className="card welcome">
          <div className="card-head"><h2>Welcome! Four quick steps</h2>
            <button className="link" onClick={() => update(d => { d.settings.welcomeDone = true; })}>Hide</button></div>
          <ol className="checklist">
            {steps.map(x => (
              <li key={x.label} className={x.done ? 'done' : ''}>
                <button onClick={x.act} disabled={x.done}><span className="tick" aria-hidden="true">{x.done ? <Icon name="check" size={16} /> : null}</span>{x.label}{x.done && <span className="sr"> (done)</span>}</button>
              </li>
            ))}
          </ol>
        </section>
      )}
      {needsBackup && (
        <div className="banner">
          <Icon name="shield" />
          <span>{s.settings.lastBackup ? `Last backup was ${daysSince(s.settings.lastBackup)} days ago.` : 'You haven\'t backed up yet.'} Your data lives only on this device.</span>
          <button className="btn small primary" onClick={async () => { const r = await backupNow(); if (r !== 'cancelled') toast('Backup saved'); }}>Back up</button>
          <button className="icon-btn" aria-label="Remind me tomorrow" onClick={() => update(d => { d.settings.backupNudgeDismissed = t; })}><Icon name="x" size={18} /></button>
        </div>
      )}
    </>
  );
}
