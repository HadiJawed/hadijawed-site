import { useEffect, useState } from 'react';
import { Sheet, Segmented, toast, Icon } from '../ui.jsx';
import { CATS, KINDS } from '../lib/categories.js';
import { update } from '../lib/store.js';
import { today, addDays, addMonths, uid, amt, buzz, dayLabel } from '../lib/util.js';

const touch = () => matchMedia('(pointer: coarse)').matches;

// Open with: null (closed) | { kind } for new | { tx } to edit
export default function QuickAdd({ open, onClose }) {
  const editing = open?.tx;
  const [kind, setKind] = useState('expense');
  const [raw, setRaw] = useState('');
  const [cat, setCat] = useState('');
  const [date, setDate] = useState(today());
  const [note, setNote] = useState('');
  const [repeat, setRepeat] = useState(false);
  const [err, setErr] = useState('');
  const [more, setMore] = useState(false);
  const pad = touch();
  const showMore = !pad || more;

  useEffect(() => {
    if (!open) return;
    const t = open.tx;
    setKind(t?.kind || open.kind || 'expense');
    setRaw(t ? String(t.amount) : '');
    setCat(t?.cat || '');
    setDate(t?.date || today());
    setNote(t?.note || '');
    setRepeat(false); setErr(''); setMore(!!t?.note);
  }, [open]);

  const cats = CATS[kind];
  const value = parseFloat(raw) || 0;

  function press(k) {
    buzz(6);
    setErr('');
    setRaw(r => {
      if (k === 'del') return r.slice(0, -1);
      if (k === '.') return r.includes('.') ? r : (r || '0') + '.';
      if (r.includes('.') && r.split('.')[1].length >= 2) return r;
      if (r === '0') return k;
      if (r.replace('.', '').length >= 9) return r;
      return r + k;
    });
  }

  function save() {
    if (!value) { setErr('Enter an amount above $0.'); return; }
    const c = cat || cats[cats.length - 1][0];
    if (editing) {
      update(s => { const t = s.tx.find(x => x.id === editing.id); Object.assign(t, { kind, cat: c, amount: value, date, note: note.trim() }); });
      toast('Changes saved');
    } else {
      const id = uid();
      update(s => {
        s.tx.push({ id, date, kind, cat: c, amount: value, note: note.trim() });
        if (repeat) s.recurring.push({ id: uid(), name: note.trim() || c, kind, cat: c, amount: value, freq: 'monthly', next: addMonths(date, 1) });
      });
      buzz(15);
      toast(`${KINDS[kind].verb} added: ${amt(value)} ${c}${repeat ? ', repeats monthly' : ''}`, () => update(s => { s.tx = s.tx.filter(t => t.id !== id); }));
    }
    onClose();
  }

  function remove() {
    const copy = { ...editing };
    update(s => { s.tx = s.tx.filter(t => t.id !== editing.id); });
    toast('Deleted', () => update(s => { s.tx.push(copy); }));
    onClose();
  }

  // Desktop: Enter saves
  const onKey = e => { if (e.key === 'Enter' && !e.shiftKey && e.target.tagName !== 'BUTTON') { e.preventDefault(); save(); } };

  return (
    <Sheet open={!!open} onClose={onClose} title={editing ? 'Edit entry' : 'Add money in or out'}>
      <div className="qa" onKeyDown={onKey}>
        <Segmented label="Type" value={kind} onChange={k => { setKind(k); setCat(''); }}
          options={[['expense', 'Spent'], ['income', 'Earned'], ['invest', 'Invested']]} />

        <div className={'qa-amount k-' + kind}>
          <span className="cur">$</span>
          {pad
            ? <output aria-label="Amount" className={raw ? '' : 'ph'}>{raw || '0'}</output>
            : <input aria-label="Amount" inputMode="decimal" type="number" min="0" step="0.01" placeholder="0" value={raw} data-autofocus
                onChange={e => { setRaw(e.target.value); setErr(''); }} />}
        </div>
        {err && <p className="err" role="alert">{err}</p>}

        <div className="chips" role="radiogroup" aria-label="Category">
          {cats.map(([c, e]) => (
            <button key={c} role="radio" aria-checked={cat === c} className={'chip' + (cat === c ? ' on' : '')} onClick={() => { setCat(c); buzz(5); }}>
              <span aria-hidden="true">{e}</span>{c}
            </button>
          ))}
        </div>

        <div className="qa-row">
          <div className="chips tight" role="radiogroup" aria-label="Date">
            {[today(), addDays(today(), -1)].map(d => (
              <button key={d} role="radio" aria-checked={date === d} className={'chip' + (date === d ? ' on' : '')} onClick={() => setDate(d)}>{dayLabel(d)}</button>
            ))}
            <label className={'chip date-chip' + (date !== today() && date !== addDays(today(), -1) ? ' on' : '')}>
              {date !== today() && date !== addDays(today(), -1) ? dayLabel(date) : 'Pick a date'}
              <input type="date" value={date} max="2100-12-31" onChange={e => e.target.value && setDate(e.target.value)} aria-label="Pick a date" />
            </label>
            {!showMore && <button className="chip" onClick={() => setMore(true)}>+ Note or repeat</button>}
          </div>
        </div>

        {showMore && <input className="note" placeholder="Note (optional), e.g. Tim Hortons" value={note} onChange={e => setNote(e.target.value)} maxLength={80} />}

        {showMore && !editing && (
          <label className="toggle">
            <input type="checkbox" checked={repeat} onChange={e => setRepeat(e.target.checked)} />
            <span className="sw" aria-hidden="true" /><span><Icon name="repeat" size={18} /> Repeat every month on this day</span>
          </label>
        )}

        {pad && (
          <div className="keypad">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'del'].map(k => (
              <button key={k} onClick={() => press(k)} aria-label={k === 'del' ? 'Delete digit' : k}>{k === 'del' ? '⌫' : k}</button>
            ))}
          </div>
        )}

        <div className="qa-actions">
          {editing && <button className="btn ghost danger" onClick={remove}><Icon name="trash" size={18} /> Delete</button>}
          <button className={'btn primary big k-' + kind} onClick={save}>{editing ? 'Save changes' : `Add ${value ? amt(value) : ''} ${KINDS[kind].verb.toLowerCase()}`}</button>
        </div>
      </div>
    </Sheet>
  );
}
