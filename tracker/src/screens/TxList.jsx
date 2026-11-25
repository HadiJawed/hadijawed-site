import { useRef, useState } from 'react';
import { icon } from '../lib/categories.js';
import { amt, dayLabel, buzz } from '../lib/util.js';
import { update } from '../lib/store.js';
import { toast, Icon } from '../ui.jsx';

// Grouped by day. Tap to edit; swipe left to delete (phones) or use the delete button (desktop hover).
export default function TxList({ items, onEdit, group = true }) {
  if (!items.length) return null;
  const sorted = [...items].sort((a, b) => b.date.localeCompare(a.date));
  if (!group) return <ul className="tx-list">{sorted.map(t => <TxRow key={t.id} t={t} onEdit={onEdit} />)}</ul>;
  const days = [];
  for (const t of sorted) {
    if (!days.length || days[days.length - 1].date !== t.date) days.push({ date: t.date, items: [] });
    days[days.length - 1].items.push(t);
  }
  return (
    <div className="tx-days">
      {days.map(d => {
        const net = d.items.reduce((s, t) => s + (t.kind === 'income' ? t.amount : -t.amount), 0);
        return (
          <section key={d.date}>
            <h4 className="day-head"><span>{dayLabel(d.date)}</span><span className={net >= 0 ? 'pos' : ''}>{net >= 0 ? '+' : ''}{amt(net)}</span></h4>
            <ul className="tx-list">{d.items.map(t => <TxRow key={t.id} t={t} onEdit={onEdit} />)}</ul>
          </section>
        );
      })}
    </div>
  );
}

export function deleteTx(t) {
  update(s => { s.tx = s.tx.filter(x => x.id !== t.id); });
  toast(`Deleted ${amt(t.amount)} ${t.cat}`, () => update(s => { s.tx.push(t); }));
}

function TxRow({ t, onEdit }) {
  const [dx, setDx] = useState(0);
  const start = useRef(null);
  const moved = useRef(false);

  const down = e => { if (e.pointerType !== 'touch') return; start.current = { x: e.clientX, y: e.clientY }; moved.current = false; };
  const move = e => {
    if (!start.current) return;
    const x = e.clientX - start.current.x, y = e.clientY - start.current.y;
    if (!moved.current && Math.abs(y) > Math.abs(x)) { start.current = null; return; }
    if (Math.abs(x) > 6) moved.current = true;
    setDx(Math.min(0, Math.max(-140, x)));
  };
  const up = () => {
    if (!start.current) return;
    start.current = null;
    if (dx < -90) { buzz(20); setDx(-500); setTimeout(() => deleteTx(t), 160); }
    else setDx(0);
  };

  const sign = t.kind === 'income' ? '+' : t.kind === 'invest' ? '' : '−';
  return (
    <li className="tx-wrap">
      <div className="tx-del" aria-hidden="true" style={{ opacity: Math.min(1, -dx / 90) }}><Icon name="trash" /> Delete</div>
      <div className="tx" style={{ transform: `translateX(${dx}px)`, transition: start.current ? 'none' : 'transform .2s' }}
        onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
        <button className="tx-main" onClick={() => { if (!moved.current) onEdit?.(t); }}>
          <span className={'tx-ico k-' + t.kind} aria-hidden="true">{icon(t.kind, t.cat)}</span>
          <span className="tx-text">
            <b>{t.note || t.cat}</b>
            <small>{t.note ? t.cat : t.kind === 'income' ? 'Earned' : t.kind === 'invest' ? 'Invested' : 'Spent'}{t.recId ? ', repeats' : ''}</small>
          </span>
          <span className={'tx-amt k-' + t.kind}>{sign}{amt(t.amount)}</span>
        </button>
        <button className="tx-x" onClick={() => deleteTx(t)} aria-label={`Delete ${t.note || t.cat} ${amt(t.amount)}`}><Icon name="trash" size={18} /></button>
      </div>
    </li>
  );
}
