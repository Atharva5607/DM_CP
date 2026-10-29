export function Segmented({ value, onChange, options, label, size = 'md' }) {
  return (
    <div className={`nx-seg is-${size}`} role="tablist" aria-label={label}>
      {options.map((o) => (
        <button key={o.id} role="tab" aria-selected={value === o.id} className={value === o.id ? 'is-on' : ''} onClick={() => onChange(o.id)} title={o.title}>
          {o.icon}{o.label && <span>{o.label}</span>}
        </button>
      ))}
    </div>
  );
}

export function Switch({ checked, onChange, children }) {
  return (
    <label className="nx-switch">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="nx-switch-track" aria-hidden="true"><span /></span>
      <span>{children}</span>
    </label>
  );
}

export function Panel({ title, icon, actions, children, className = '', pad = true }) {
  return (
    <section className={`nx-panel ${className}`}>
      {(title || actions) && (
        <header className="nx-panel-head">
          <h2>{icon}{title}</h2>
          {actions && <div className="nx-panel-actions">{actions}</div>}
        </header>
      )}
      <div className={pad ? 'nx-panel-body' : ''}>{children}</div>
    </section>
  );
}

export function Stat({ label, value, hint, tone }) {
  return (
    <div className={`nx-stat${tone ? ` tone-${tone}` : ''}`}>
      <span className="nx-stat-label">{label}</span>
      <span className="nx-stat-value">{value}</span>
      {hint && <span className="nx-stat-hint">{hint}</span>}
    </div>
  );
}
