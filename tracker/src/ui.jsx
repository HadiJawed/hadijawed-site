import { useEffect, useRef, useState, useSyncExternalStore, useId } from 'react';
import { money, compact, clamp } from './lib/util.js';

const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

// ── Animated number that rolls to its new value ──
export function Num({ value, format = money, className, duration = 450 }) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    if (reduceMotion()) { setShown(value); from.current = value; return; }
    const a = from.current, t0 = performance.now();
    let raf;
    const step = t => {
      const k = Math.min(1, (t - t0) / duration), e = 1 - Math.pow(1 - k, 3);
      const v = a + (value - a) * e;
      setShown(v); from.current = v;
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);
  return <span className={className} style={{ fontVariantNumeric: 'tabular-nums' }}>{format(shown)}</span>;
}

// ── Bottom sheet on phones, centred dialog on desktop ──
export function Sheet({ open, onClose, title, children, wide }) {
  const ref = useRef(null);
  const titleId = useId();
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement;
    const onKey = e => { if (e.key === 'Escape') closeRef.current(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    setTimeout(() => ref.current?.querySelector('[data-autofocus]')?.focus() || ref.current?.focus(), 30);
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; prev?.focus?.(); };
  }, [open]);
  if (!open) return null;
  return (
    <div className="scrim" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={'sheet' + (wide ? ' wide' : '')} role="dialog" aria-modal="true" aria-labelledby={titleId} ref={ref} tabIndex={-1}>
        <div className="grab" aria-hidden="true" />
        <div className="sheet-head">
          <h2 id={titleId}>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close"><Icon name="x" /></button>
        </div>
        <div className="sheet-body">{children}</div>
      </div>
    </div>
  );
}

// ── Toasts (with optional Undo) ──
let toasts = [], tl = new Set();
const temit = () => tl.forEach(f => f());
export function toast(text, undo) {
  const id = Math.random();
  toasts = [...toasts.slice(-2), { id, text, undo }];
  temit();
  setTimeout(() => { toasts = toasts.filter(t => t.id !== id); temit(); }, undo ? 6000 : 3200);
}
export function Toasts() {
  const list = useSyncExternalStore(f => { tl.add(f); return () => tl.delete(f); }, () => toasts);
  return (
    <div className="toasts" role="status" aria-live="polite">
      {list.map(t => (
        <div className="toast" key={t.id}>
          <span>{t.text}</span>
          {t.undo && <button onClick={() => { t.undo(); toasts = toasts.filter(x => x.id !== t.id); temit(); }}>Undo</button>}
        </div>
      ))}
    </div>
  );
}

// ── Confetti burst for finished goals ──
export function confetti() {
  if (reduceMotion()) return;
  const colors = ['#2438F0', '#FFD23F', '#FF5A45', '#13A877', '#8B5CF6'];
  const box = document.createElement('div');
  box.className = 'confetti';
  for (let i = 0; i < 90; i++) {
    const p = document.createElement('i');
    p.style.background = colors[i % colors.length];
    p.style.left = 50 + (Math.random() - .5) * 20 + '%';
    p.style.setProperty('--x', (Math.random() - .5) * 120 + 'vw');
    p.style.setProperty('--y', -(40 + Math.random() * 60) + 'vh');
    p.style.setProperty('--r', Math.random() * 720 + 'deg');
    p.style.animationDelay = Math.random() * 120 + 'ms';
    box.appendChild(p);
  }
  document.body.appendChild(box);
  setTimeout(() => box.remove(), 2200);
}

// ── Progress ring ──
export function Ring({ value, max, size = 64, stroke = 8, color = 'var(--cobalt)', children, label }) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r;
  const p = max > 0 ? clamp(value / max, 0, 1) : 0;
  const over = max > 0 && value > max;
  const col = over ? 'var(--coral)' : p >= .8 ? 'var(--amber)' : color;
  return (
    <div className="ring" style={{ width: size, height: size }} role="img" aria-label={label}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--track)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={col} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - p)} transform={`rotate(-90 ${size / 2} ${size / 2})`} className="ring-arc" />
      </svg>
      <div className="ring-in">{children}</div>
    </div>
  );
}

// ── Donut chart with tappable slices ──
export function Donut({ data, colors, size = 200, active, onActive, center }) {
  const total = data.reduce((s, d) => s + d[1], 0);
  const r = size / 2 - 14, c = 2 * Math.PI * r;
  let acc = 0;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="donut" role="img" aria-label="Spending by category">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--track)" strokeWidth="22" />
      {total > 0 && data.map(([name, v], i) => {
        const len = (v / total) * c, gap = data.length > 1 ? Math.min(4, len / 3) : 0;
        const el = (
          <circle key={name} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={colors[i % colors.length]}
            strokeWidth={active === name ? 30 : 22} strokeDasharray={`${Math.max(0, len - gap)} ${c}`} strokeDashoffset={-acc}
            transform={`rotate(-90 ${size / 2} ${size / 2})`} style={{ cursor: 'pointer', transition: 'stroke-width .2s', opacity: active && active !== name ? .35 : 1 }}
            onClick={() => onActive?.(active === name ? null : name)} />
        );
        acc += len;
        return el;
      })}
      <foreignObject x={size * .2} y={size * .2} width={size * .6} height={size * .6}>
        <div className="donut-center">{center}</div>
      </foreignObject>
    </svg>
  );
}

// ── Paired bar chart (e.g. earned vs spent per month) ──
export function Bars({ data, series, height = 170, onPick, picked }) {
  const max = Math.max(1, ...data.flatMap(d => series.map(s => d[s.key])));
  return (
    <div className="bars" style={{ height }}>
      {data.map(d => (
        <button key={d.key} className={'bar-col' + (picked === d.key ? ' on' : '')} onClick={() => onPick?.(d.key)}
          aria-label={`${d.label}: ${series.map(s => `${s.label} ${money(d[s.key])}`).join(', ')}`}>
          <span className="bar-pair">
            {series.map(s => <i key={s.key} style={{ height: `${(d[s.key] / max) * 100}%`, background: s.color }} />)}
          </span>
          <span className="bar-lab">{d.label}</span>
        </button>
      ))}
    </div>
  );
}

// ── Line/area chart for net worth ──
export function Area({ points, height = 160 }) {
  const [hover, setHover] = useState(null);
  if (points.length < 2) return null;
  const W = 600, H = height, pad = 8;
  const vals = points.map(p => p.v), min = Math.min(0, ...vals), max = Math.max(...vals, 1);
  const x = i => pad + (i / (points.length - 1)) * (W - pad * 2);
  const y = v => H - pad - ((v - min) / (max - min || 1)) * (H - pad * 2);
  const line = points.map((p, i) => `${i ? 'L' : 'M'}${x(i)},${y(p.v)}`).join('');
  const h = hover ?? points.length - 1;
  return (
    <div className="area">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ height }}
        onPointerMove={e => { const b = e.currentTarget.getBoundingClientRect(); setHover(Math.round(clamp((e.clientX - b.left) / b.width, 0, 1) * (points.length - 1))); }}
        onPointerLeave={() => setHover(null)} role="img" aria-label="Net worth over time">
        <defs><linearGradient id="ag" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="var(--cobalt)" stopOpacity=".28" /><stop offset="1" stopColor="var(--cobalt)" stopOpacity="0" /></linearGradient></defs>
        <path d={`${line}L${x(points.length - 1)},${H}L${x(0)},${H}Z`} fill="url(#ag)" />
        <path d={line} fill="none" stroke="var(--cobalt)" strokeWidth="3" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
        <line x1={x(h)} x2={x(h)} y1="0" y2={H} stroke="var(--line)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="area-tip" style={{ left: `${(h / (points.length - 1)) * 100}%` }}><b>{compact(points[h].v)}</b> {points[h].label}</div>
    </div>
  );
}

// ── Segmented control ──
export function Segmented({ value, onChange, options, label }) {
  return (
    <div className="seg" role="radiogroup" aria-label={label}>
      {options.map(([v, l]) => (
        <button key={v} role="radio" aria-checked={value === v} className={value === v ? 'on' : ''} onClick={() => onChange(v)}>{l}</button>
      ))}
    </div>
  );
}

// ── Money input field ──
export function MoneyField({ label, value, onChange, placeholder = '0', autoFocus, hint }) {
  const id = useId();
  return (
    <label className="field" htmlFor={id}>
      <span>{label}</span>
      <div className="money-in">
        <b>$</b>
        <input id={id} inputMode="decimal" type="number" min="0" step="0.01" value={value ?? ''} placeholder={placeholder}
          data-autofocus={autoFocus ? '' : undefined} onChange={e => onChange(e.target.value === '' ? '' : e.target.value)} />
      </div>
      {hint && <small>{hint}</small>}
    </label>
  );
}

export function Field({ label, children, hint }) {
  return <label className="field"><span>{label}</span>{children}{hint && <small>{hint}</small>}</label>;
}

export function Empty({ emoji, title, text, action }) {
  return (
    <div className="empty">
      <div className="empty-emoji" aria-hidden="true">{emoji}</div>
      <h3>{title}</h3>
      {text && <p>{text}</p>}
      {action}
    </div>
  );
}

// ── Icons (simple strokes) ──
const P = {
  home: 'M4 11l8-7 8 7v8a1 1 0 01-1 1h-4v-6h-6v6H5a1 1 0 01-1-1z',
  list: 'M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01',
  plan: 'M12 3a9 9 0 109 9h-9z M15 3.5A9 9 0 0120.5 9H15z',
  wealth: 'M3 17l6-6 4 4 8-8M15 7h6v6',
  gear: 'M12 15a3 3 0 100-6 3 3 0 000 6z M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z',
  plus: 'M12 5v14M5 12h14',
  x: 'M6 6l12 12M18 6L6 18',
  left: 'M15 6l-6 6 6 6',
  right: 'M9 6l6 6-6 6',
  search: 'M11 18a7 7 0 100-14 7 7 0 000 14zM21 21l-4.3-4.3',
  trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
  repeat: 'M17 2l4 4-4 4M3 11V9a3 3 0 013-3h15M7 22l-4-4 4-4M21 13v2a3 3 0 01-3 3H3',
  download: 'M12 3v12M7 10l5 5 5-5M5 21h14',
  upload: 'M12 21V9M7 14l5-5 5 5M5 3h14',
  shield: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z',
  check: 'M5 12l5 5 9-10',
  edit: 'M4 20h4L19 9l-4-4L4 16zM14 6l4 4',
  phone: 'M8 2h8a2 2 0 012 2v16a2 2 0 01-2 2H8a2 2 0 01-2-2V4a2 2 0 012-2zM11 18h2',
  share: 'M12 3v13M7 8l5-5 5 5M5 13v6a2 2 0 002 2h10a2 2 0 002-2v-6'
};
export function Icon({ name, size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={P[name]} />
    </svg>
  );
}
