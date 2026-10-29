import { useEffect, useMemo, useRef, useState } from 'react';
import { LuSearch } from 'react-icons/lu';

/** Keyboard-first launcher. `items`: [{id, label, hint, group, icon, run}] */
export default function CommandPalette({ open, onClose, items }) {
  const [q, setQ] = useState('');
  const [idx, setIdx] = useState(0);
  const input = useRef(null);
  const list = useRef(null);

  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return items.filter((i) => !s || `${i.label} ${i.hint || ''} ${i.group}`.toLowerCase().includes(s)).slice(0, 40);
  }, [items, q]);

  useEffect(() => {
    if (open) { setQ(''); setIdx(0); setTimeout(() => input.current && input.current.focus(), 10); }
  }, [open]);
  useEffect(() => { setIdx(0); }, [q]);
  useEffect(() => {
    const el = list.current && list.current.querySelector('[aria-selected="true"]');
    if (el && el.scrollIntoView) el.scrollIntoView({ block: 'nearest' });
  }, [idx]);

  if (!open) return null;
  const run = (it) => { onClose(); it.run(); };
  const onKey = (e) => {
    if (e.key === 'Escape') onClose();
    else if (e.key === 'ArrowDown') { e.preventDefault(); setIdx((i) => Math.min(i + 1, shown.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setIdx((i) => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter' && shown[idx]) run(shown[idx]);
  };
  let lastGroup = null;
  return (
    <div className="nx-scrim" onMouseDown={onClose}>
      <div className="nx-palette" role="dialog" aria-modal="true" aria-label="Command palette" onMouseDown={(e) => e.stopPropagation()} onKeyDown={onKey}>
        <div className="nx-palette-input"><LuSearch /><input ref={input} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Run a scenario, focus a component, change the view" aria-label="Search commands" /></div>
        <ul ref={list} role="listbox">
          {shown.length === 0 && <li className="nx-palette-empty">Nothing matches "{q}"</li>}
          {shown.map((it, i) => {
            const head = it.group !== lastGroup ? <li className="nx-palette-group" key={`g-${it.group}`}>{it.group}</li> : null;
            lastGroup = it.group;
            return [head, (
              <li key={it.id} role="option" aria-selected={i === idx} className={i === idx ? 'is-on' : ''} onMouseEnter={() => setIdx(i)} onClick={() => run(it)}>
                <span className="nx-palette-icon">{it.icon}</span>
                <span className="nx-palette-label">{it.label}</span>
                {it.hint && <span className="nx-palette-hint">{it.hint}</span>}
              </li>
            )];
          })}
        </ul>
      </div>
    </div>
  );
}
