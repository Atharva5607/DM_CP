import { STATUS, LAYER_COLORS } from '../utils/graph';

export function StatusBadge({ status }) {
  const s = STATUS[status] || STATUS.safe;
  return (
    <span className="nx-badge" style={{ '--c': s.color }}>
      <i />{s.label}
    </span>
  );
}

export function LayerChip({ layer, label, color }) {
  return (
    <span className="nx-chip">
      <i style={{ background: color || LAYER_COLORS[layer] || '#8b7bff' }} />
      {label || layer}
    </span>
  );
}

export function HealthBar({ value }) {
  const color = value >= 0.85 ? '#3ddc97' : value >= 0.5 ? '#ffb020' : '#ff5d73';
  return (
    <div className="nx-health" role="img" aria-label={`Health ${Math.round(value * 100)} percent`}>
      <span style={{ width: `${Math.max(value, 0.02) * 100}%`, background: color }} />
    </div>
  );
}
