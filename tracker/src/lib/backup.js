import { getState, update, replaceAll, getMeta, setMeta, setAutoBackupWriter, SCHEMA } from './store.js';
import { today } from './util.js';

const fileName = () => `finance-tracker-backup-${today()}.json`;
const payload = s => JSON.stringify({ app: 'finance-tracker', schema: SCHEMA, exported: new Date().toISOString(), data: s }, null, 1);

function download(name, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

const markBackedUp = () => update(s => { s.settings.lastBackup = today(); });

// One tap: share sheet on phones (save to Files, Drive, email…), download on desktop
export async function backupNow() {
  const text = payload(getState());
  const file = new File([text], fileName(), { type: 'application/json' });
  if (navigator.canShare?.({ files: [file] }) && matchMedia('(pointer: coarse)').matches) {
    try { await navigator.share({ files: [file], title: 'Finance Tracker backup' }); markBackedUp(); return 'shared'; }
    catch (e) { if (e.name === 'AbortError') return 'cancelled'; }
  }
  download(fileName(), text, 'application/json');
  markBackedUp();
  return 'downloaded';
}

export async function restoreFromFile(file) {
  const text = await file.text();
  let parsed;
  try { parsed = JSON.parse(text); } catch { throw new Error('That file isn\'t a Finance Tracker backup. Choose a .json backup file.'); }
  const data = parsed?.app === 'finance-tracker' ? parsed.data : null;
  if (!data || !Array.isArray(data.tx)) throw new Error('That file isn\'t a Finance Tracker backup. Choose a .json backup file.');
  replaceAll(data);
  return data.tx.length;
}

export function exportCSV() {
  const s = getState();
  const esc = v => { const t = String(v ?? ''); return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t; };
  const rows = [['Date', 'Type', 'Category', 'Amount', 'Note']];
  const label = { expense: 'Expense', income: 'Income', invest: 'Invested' };
  [...s.tx].sort((a, b) => a.date.localeCompare(b.date)).forEach(t => rows.push([t.date, label[t.kind], t.cat, t.amount.toFixed(2), t.note]));
  download(`finance-tracker-${today()}.csv`, rows.map(r => r.map(esc).join(',')).join('\n'), 'text/csv');
}

// ── Automatic backup to a file the person picks (Chrome / Edge on desktop) ──
export const autoBackupSupported = () => 'showSaveFilePicker' in window;
let handle = null;

async function writeTo(h, s) {
  const w = await h.createWritable();
  await w.write(payload(s));
  await w.close();
}

let writing = false, pending = null;
async function writer(s) {
  if (!handle) return;
  if (writing) { pending = s; return; }
  writing = true;
  try {
    if ((await handle.queryPermission({ mode: 'readwrite' })) === 'granted') {
      await writeTo(handle, s);
      await setMeta('autoBackupAt', new Date().toISOString());
    }
  } catch { /* file moved or permission lost; the settings screen shows this */ }
  writing = false;
  if (pending) { const p = pending; pending = null; writer(p); }
}

export async function setupAutoBackup() {
  const h = await window.showSaveFilePicker({ suggestedName: 'finance-tracker-autobackup.json', types: [{ description: 'Backup file', accept: { 'application/json': ['.json'] } }] });
  handle = h;
  await setMeta('autoBackupHandle', h);
  setAutoBackupWriter(writer);
  await writeTo(h, getState());
  await setMeta('autoBackupAt', new Date().toISOString());
  markBackedUp();
  return h.name;
}

// Returns 'off' | 'on' | 'needs-permission'
export async function autoBackupStatus() {
  if (!autoBackupSupported()) return { state: 'unsupported' };
  const h = handle || await getMeta('autoBackupHandle');
  if (!h) return { state: 'off' };
  handle = h;
  setAutoBackupWriter(writer);
  const perm = await h.queryPermission({ mode: 'readwrite' }).catch(() => 'denied');
  return { state: perm === 'granted' ? 'on' : 'needs-permission', name: h.name, at: await getMeta('autoBackupAt') };
}

export async function resumeAutoBackup() {
  if (!handle) return false;
  const p = await handle.requestPermission({ mode: 'readwrite' });
  if (p === 'granted') { await writer(getState()); markBackedUp(); return true; }
  return false;
}

export async function stopAutoBackup() {
  handle = null;
  setAutoBackupWriter(null);
  await setMeta('autoBackupHandle', null);
}
