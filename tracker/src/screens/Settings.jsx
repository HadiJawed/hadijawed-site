import { useEffect, useRef, useState } from 'react';
import { useStore, update, replaceAll, emptyState } from '../lib/store.js';
import { backupNow, restoreFromFile, exportCSV, autoBackupSupported, setupAutoBackup, autoBackupStatus, resumeAutoBackup, stopAutoBackup } from '../lib/backup.js';
import { dayLabel, today } from '../lib/util.js';
import { PROVINCES } from '../lib/tax.js';
import { Field, Icon, toast, Sheet } from '../ui.jsx';

export default function Settings({ install }) {
  const s = useStore();
  const [auto, setAuto] = useState({ state: 'off' });
  const [confirmWipe, setConfirmWipe] = useState(false);
  const [restore, setRestore] = useState(null);
  const fileRef = useRef(null);
  const refresh = () => autoBackupStatus().then(setAuto).catch(() => {});
  useEffect(() => { refresh(); }, []);

  const last = s.settings.lastBackup;
  return (
    <div className="screen">
      <header className="screen-head"><h1>Settings</h1></header>

      <section className="card">
        <h2>You</h2>
        <div className="grid-2 tight">
          <Field label="First name (optional)"><input value={s.profile.name} onChange={e => update(d => { d.profile.name = e.target.value; })} placeholder="Used to say hello" /></Field>
          <Field label="Province or territory">
            <select value={s.profile.province} onChange={e => update(d => { d.profile.province = e.target.value; })}>
              {Object.entries(PROVINCES).sort((a, b) => a[1].name.localeCompare(b[1].name)).map(([k, p]) => <option key={k} value={k}>{p.name}</option>)}
            </select>
          </Field>
        </div>
      </section>

      <section className="card" id="backup">
        <div className="card-head"><h2><Icon name="shield" /> Backups</h2>{last && <span className="pill good">Last backup: {dayLabel(last)}</span>}</div>
        <p className="muted">Your data is stored only on this device. If you clear your browser, lose your phone or switch devices, a backup file is how you get it back.</p>
        <div className="row">
          <button className="btn primary" onClick={async () => { const r = await backupNow(); if (r !== 'cancelled') toast('Backup saved'); }}><Icon name="download" size={18} /> Back up now</button>
          <button className="btn soft" onClick={() => fileRef.current.click()}><Icon name="upload" size={18} /> Restore from a backup</button>
          <input ref={fileRef} type="file" accept=".json,application/json" hidden onChange={e => { const f = e.target.files[0]; e.target.value = ''; if (f) setRestore(f); }} />
        </div>

        {autoBackupSupported() && (
          <div className="sub-card">
            <h3>Automatic backup to a file</h3>
            {auto.state === 'on' && <p className="muted">On. Every change is saved to <b>{auto.name}</b>. Put that file in OneDrive, Google Drive or Dropbox and it's backed up off this computer too.</p>}
            {auto.state === 'needs-permission' && <p className="muted">Paused. Your browser needs permission again to write to <b>{auto.name}</b>.</p>}
            {auto.state === 'off' && <p className="muted">Pick a file once, for example in your OneDrive folder, and every change is saved there automatically.</p>}
            <div className="row">
              {auto.state === 'off' && <button className="btn soft" onClick={async () => { try { const n = await setupAutoBackup(); toast(`Saving automatically to ${n}`); refresh(); } catch { /* cancelled */ } }}>Choose a backup file</button>}
              {auto.state === 'needs-permission' && <button className="btn primary" onClick={async () => { if (await resumeAutoBackup()) { toast('Automatic backup resumed'); refresh(); } }}>Resume automatic backup</button>}
              {auto.state !== 'off' && <button className="btn ghost" onClick={async () => { await stopAutoBackup(); toast('Automatic backup turned off'); refresh(); }}>Turn off</button>}
            </div>
          </div>
        )}
        <div className="row">
          <button className="btn ghost" onClick={() => { exportCSV(); toast('Spreadsheet downloaded'); }}>Download as a spreadsheet (CSV)</button>
        </div>
      </section>

      <section className="card">
        <h2><Icon name="phone" /> Install the app</h2>
        {install.standalone
          ? <p className="muted">You're using the installed app. It works offline and opens from your home screen.</p>
          : install.prompt
            ? <><p className="muted">Install it like a regular app. It opens from your home screen or dock and works offline.</p><button className="btn primary" onClick={install.run}>Install Finance Tracker</button></>
            : install.ios
              ? <ol className="steps"><li>Tap the <b>Share</b> button <Icon name="share" size={16} /> in Safari.</li><li>Tap <b>Add to Home Screen</b>.</li><li>Tap <b>Add</b>. It opens like a regular app, works offline, and Safari won't clear its data.</li></ol>
              : <p className="muted">Open this page in Chrome, Edge or Safari and use <b>Install app</b> or <b>Add to Home Screen</b> from the browser menu.</p>}
      </section>

      <section className="card">
        <h2>Privacy</h2>
        <p className="muted">No account, no sign-up, no ads, no tracking. Nothing you enter is sent to a server: it stays in this browser on this device. That's also why backups matter.</p>
        {s.settings.migratedFromV2 && <p className="muted small">Your data from the old Finance Tracker was brought over on {dayLabel(s.settings.migratedFromV2)}. The original copy is still kept in this browser.</p>}
      </section>

      <section className="card danger-zone">
        <h2>Start over</h2>
        <p className="muted">Delete every entry, bill, budget, goal and balance on this device.</p>
        <button className="btn ghost danger" onClick={() => setConfirmWipe(true)}><Icon name="trash" size={18} /> Delete all my data</button>
      </section>

      <p className="muted small center">Finance Tracker by <a href="/">Hadi Jawed</a>. Not financial advice.</p>

      <WipeSheet open={confirmWipe} onClose={() => setConfirmWipe(false)} />
      <Sheet open={!!restore} onClose={() => setRestore(null)} title="Restore this backup?">
        <div className="form">
          <p>Everything on this device will be replaced with the contents of <b>{restore?.name}</b>. Back up first if you want to keep what's here now.</p>
          <div className="form-actions">
            <button className="btn ghost" onClick={async () => { await backupNow(); }}>Back up current data first</button>
            <button className="btn primary" onClick={async () => {
              try { const n = await restoreFromFile(restore); toast(`Restored ${n} entries`); } catch (e) { toast(e.message); }
              setRestore(null);
            }}>Replace with backup</button>
          </div>
        </div>
      </Sheet>
    </div>
  );
}

function WipeSheet({ open, onClose }) {
  const [text, setText] = useState('');
  useEffect(() => setText(''), [open]);
  return (
    <Sheet open={open} onClose={onClose} title="Delete all data?">
      <div className="form">
        <p>This permanently deletes everything in the app on this device. It can't be undone unless you have a backup file.</p>
        <Field label='Type "delete" to confirm'><input value={text} onChange={e => setText(e.target.value)} data-autofocus autoCapitalize="off" /></Field>
        <div className="form-actions">
          <button className="btn ghost" onClick={onClose}>Keep my data</button>
          <button className="btn danger-solid" disabled={text.trim().toLowerCase() !== 'delete'} onClick={() => {
            const fresh = emptyState(); fresh.settings.onboarded = true; fresh.created = today();
            replaceAll(fresh); toast('All data deleted'); onClose();
          }}>Delete everything</button>
        </div>
      </div>
    </Sheet>
  );
}
