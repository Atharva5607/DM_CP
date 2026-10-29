import { useId, useMemo } from 'react';
import { useTween } from '../hooks/useTween';
import { arcPath, niceTicks, polar } from '../utils/geometry';
import { STATUS, STATUS_ORDER, layerColor, minutes, sortLayers } from '../utils/graph';
import { dependencyMatrix, layerFlows } from '../utils/insights';

const LEVEL_COLORS = { low: '#8fd9b0', moderate: '#efc274', high: '#ff7a59', critical: '#ec6f85' };
const SHORT = { emergency: 'Emergency', hospital: 'Healthcare', traffic: 'Traffic', comm: 'Comms', power: 'Power' };
export const shortLayer = (layers, id) => SHORT[id] || (layers.find((l) => l.id === id)?.name || id).slice(0, 10);
const uid = (raw) => raw.replace(/:/g, '');

/* ---------- risk gauge ---------- */
export function RiskGauge({ risk, size = 230 }) {
  const id = uid(useId());
  const score = risk ? risk.score : 0;
  const v = useTween(score, 1000);
  const color = risk ? LEVEL_COLORS[risk.level] : '#4f567a';
  const cx = 110;
  const cy = 110;
  const r = 84;
  const a0 = Math.PI * 0.75;
  const sweep = Math.PI * 1.5;
  const a = a0 + (sweep * v) / 100;
  const [kx, ky] = polar(cx, cy, r, a);
  return (
    <svg viewBox="0 0 220 200" width={size} className="nx-gauge" role="img" aria-label={risk ? `Risk score ${score} of 100, ${risk.level}` : 'No risk computed'}>
      <defs>
        <linearGradient id={`${id}-g`} x1="20" y1="0" x2="200" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#8fd9b0" /><stop offset="0.5" stopColor="#efc274" /><stop offset="1" stopColor="#ec6f85" />
        </linearGradient>
      </defs>
      {Array.from({ length: 31 }, (_, i) => {
        const ang = a0 + (sweep * i) / 30;
        const [x1, y1] = polar(cx, cy, r + 14, ang);
        const [x2, y2] = polar(cx, cy, r + (i % 5 === 0 ? 22 : 18), ang);
        return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} className={i % 5 === 0 ? 'nx-tick major' : 'nx-tick'} />;
      })}
      <path d={arcPath(cx, cy, r, a0, a0 + sweep)} className="nx-gauge-track" />
      {score > 0 && <path d={arcPath(cx, cy, r, a0, Math.max(a, a0 + 0.001))} className="nx-gauge-fill" stroke={`url(#${id}-g)`} style={{ filter: `drop-shadow(0 0 7px ${color}88)` }} />}
      <circle cx={kx} cy={ky} r="7" className="nx-gauge-knob" style={{ stroke: color }} />
      <text x={cx} y={cy + 6} className="nx-gauge-num" textAnchor="middle">{risk ? Math.round(v) : '--'}</text>
      <text x={cx} y={cy + 30} textAnchor="middle" className="nx-gauge-level" style={{ fill: color }}>{risk ? `${risk.level} risk` : 'no event yet'}</text>
    </svg>
  );
}

/* ---------- radar: layer health ---------- */
export function LayerRadar({ layers, summary }) {
  const t = useTween(1, 900);
  const ordered = sortLayers(layers);
  const n = ordered.length;
  const cx = 150;
  const cy = 150;
  const R = 92;
  const ang = (i) => -Math.PI / 2 + (i * 2 * Math.PI) / n;
  const pts = (f) => ordered.map((l, i) => polar(cx, cy, R * f(l), ang(i)).join(',')).join(' ');
  return (
    <svg viewBox="0 0 300 300" className="nx-radar" role="img" aria-label="Average health per layer">
      {[0.25, 0.5, 0.75, 1].map((f) => <polygon key={f} points={pts(() => f)} className="nx-grid" />)}
      {ordered.map((l, i) => {
        const [x, y] = polar(cx, cy, R, ang(i));
        const [lx, ly] = polar(cx, cy, R + 24, ang(i));
        const h = summary[l.id] ? summary[l.id].avg_health : 1;
        return (
          <g key={l.id}>
            <line x1={cx} y1={cy} x2={x} y2={y} className="nx-grid" />
            <text x={lx} y={ly} textAnchor="middle" dominantBaseline="middle" className="nx-axis-label" style={{ fill: l.color }}>{shortLayer(layers, l.id)}</text>
            <text x={lx} y={ly + 13} textAnchor="middle" dominantBaseline="middle" className="nx-axis-value">{Math.round(h * 100)}%</text>
          </g>
        );
      })}
      <polygon points={pts(() => 1)} className="nx-radar-before" />
      <polygon points={pts((l) => (summary[l.id] ? summary[l.id].avg_health : 1) * t)} className="nx-radar-after" />
      {ordered.map((l, i) => {
        const h = (summary[l.id] ? summary[l.id].avg_health : 1) * t;
        const [x, y] = polar(cx, cy, R * h, ang(i));
        return <circle key={l.id} cx={x} cy={y} r="4" fill={l.color} className="nx-dot" />;
      })}
    </svg>
  );
}

/* ---------- waves: stacked bars by final status ---------- */
export function WaveBars({ sim }) {
  const waves = useMemo(() => {
    const out = {};
    Object.values(sim.nodes).forEach((n) => {
      if (!n.affected) return;
      out[n.wave] = out[n.wave] || {};
      out[n.wave][n.status] = (out[n.wave][n.status] || 0) + 1;
    });
    return Object.keys(out).map(Number).sort((a, b) => a - b).map((w) => ({ w, counts: out[w], total: Object.values(out[w]).reduce((s, v) => s + v, 0) }));
  }, [sim]);
  const t = useTween(1, 700);
  if (!waves.length) return <p className="nx-muted">No components were affected.</p>;
  const max = Math.max(...waves.map((x) => x.total));
  const ticks = niceTicks(max, 3);
  const H = 150;
  const top = ticks[ticks.length - 1];
  const bw = Math.min(64, 420 / waves.length - 18);
  const W = 46 + waves.length * (bw + 22);
  return (
    <>
    <svg viewBox={`0 0 ${W} ${H + 40}`} className="nx-chart" role="img" aria-label="Components affected per cascade wave" style={{ maxWidth: 520 }}>
      {ticks.map((v) => (
        <g key={v}>
          <line x1="34" x2={W} y1={H - (v / top) * H + 6} y2={H - (v / top) * H + 6} className="nx-grid" />
          <text x="26" y={H - (v / top) * H + 10} textAnchor="end" className="nx-axis-value">{v}</text>
        </g>
      ))}
      {waves.map((x, i) => {
        const bx = 46 + i * (bw + 22);
        let y = H + 6;
        return (
          <g key={x.w}>
            {STATUS_ORDER.slice().reverse().map((s) => {
              const c = x.counts[s];
              if (!c) return null;
              const h = (c / top) * H * t;
              y -= h;
              return <rect key={s} x={bx} y={y} width={bw} height={h} rx="3" fill={STATUS[s].color}><title>{`${c} ${STATUS[s].label.toLowerCase()}`}</title></rect>;
            })}
            <text x={bx + bw / 2} y={H + 24} textAnchor="middle" className="nx-axis-label">{x.w === 0 ? 'Impact' : `Wave ${x.w}`}</text>
            <text x={bx + bw / 2} y={H - (x.total / top) * H * t + 0} textAnchor="middle" className="nx-bar-value">{x.total}</text>
          </g>
        );
      })}
    </svg>
    <ul className="nx-legend">
      {STATUS_ORDER.map((s) => <li key={s}><i style={{ background: STATUS[s].color }} />{STATUS[s].label}</li>)}
    </ul>
    </>
  );
}

/* ---------- sankey: failure flow between layers ---------- */
export function ImpactFlow({ graph, sim }) {
  const id = uid(useId());
  const layers = sortLayers(graph.layers);
  const flows = useMemo(() => layerFlows(graph, sim), [graph, sim]);
  if (!flows.length) return <p className="nx-muted">No failure crossed a dependency link.</p>;
  const W = 640;
  const H = 300;
  const colL = 150;
  const colR = W - 150;
  const gap = 12;
  const outTotals = {};
  const inTotals = {};
  flows.forEach((f) => { outTotals[f.from] = (outTotals[f.from] || 0) + f.value; inTotals[f.to] = (inTotals[f.to] || 0) + f.value; });
  const layout = (totals) => {
    const items = layers.filter((l) => totals[l.id]);
    const avail = H - 20 - gap * (items.length - 1);
    const sum = items.reduce((s, l) => s + totals[l.id], 0);
    const k = avail / Math.max(sum, 1e-6);
    let y = 10;
    const out = {};
    items.forEach((l) => { const h = Math.max(totals[l.id] * k, 14); out[l.id] = { y, h, k, off: 0 }; y += h + gap; });
    return out;
  };
  const L = layout(outTotals);
  const Rr = layout(inTotals);
  const order = (a, b) => layers.findIndex((l) => l.id === a) - layers.findIndex((l) => l.id === b);
  const sorted = [...flows].sort((a, b) => order(a.from, b.from) || order(a.to, b.to));
  const links = sorted.map((f, i) => {
    const s = L[f.from];
    const d = Rr[f.to];
    const hs = f.value * s.k;
    const hd = f.value * d.k;
    const y0 = s.y + s.off; s.off += hs;
    const y1 = d.y + d.off; d.off += hd;
    const xm = (colL + colR) / 2;
    return { f, i, path: `M${colL + 10} ${y0} C${xm} ${y0} ${xm} ${y1} ${colR} ${y1} L${colR} ${y1 + hd} C${xm} ${y1 + hd} ${xm} ${y0 + hs} ${colL + 10} ${y0 + hs} Z` };
  });
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="nx-chart" role="img" aria-label="Failure flow between layers">
      <defs>
        {links.map(({ f, i }) => (
          <linearGradient key={i} id={`${id}-l${i}`} x1={colL} x2={colR} y1="0" y2="0" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor={layerColor(layers, f.from)} /><stop offset="1" stopColor={layerColor(layers, f.to)} />
          </linearGradient>
        ))}
      </defs>
      {links.map(({ f, i, path }) => (
        <path key={i} d={path} fill={`url(#${id}-l${i})`} className="nx-flow"><title>{`${shortLayer(layers, f.from)} to ${shortLayer(layers, f.to)}: ${Math.round(f.value * 100)} health points lost`}</title></path>
      ))}
      {Object.entries(L).map(([lid, b]) => (
        <g key={`l${lid}`}>
          <rect x={colL} y={b.y} width="10" height={b.h} rx="3" fill={layerColor(layers, lid)} />
          <text x={colL - 10} y={b.y + b.h / 2} textAnchor="end" dominantBaseline="middle" className="nx-axis-label" style={{ fill: layerColor(layers, lid) }}>{shortLayer(layers, lid)}</text>
        </g>
      ))}
      {Object.entries(Rr).map(([lid, b]) => (
        <g key={`r${lid}`}>
          <rect x={colR} y={b.y} width="10" height={b.h} rx="3" fill={layerColor(layers, lid)} />
          <text x={colR + 20} y={b.y + b.h / 2} dominantBaseline="middle" className="nx-axis-label" style={{ fill: layerColor(layers, lid) }}>{shortLayer(layers, lid)}</text>
        </g>
      ))}
      <text x={colL + 5} y={H - 2} textAnchor="middle" className="nx-axis-value">provider fails</text>
      <text x={colR + 5} y={H - 2} textAnchor="middle" className="nx-axis-value">dependent degrades</text>
    </svg>
  );
}

/* ---------- dependency matrix ---------- */
export function DependencyMatrix({ graph, sim }) {
  const layers = sortLayers(graph.layers);
  const cells = useMemo(() => dependencyMatrix(graph, sim), [graph, sim]);
  const vals = Object.values(cells);
  const maxLinks = Math.max(1, ...vals.map((c) => c.links));
  const maxLoss = Math.max(0.0001, ...vals.map((c) => c.loss));
  const cell = 78;
  const x0 = 100;
  const y0 = 50;
  const n = layers.length;
  return (
    <svg viewBox={`0 0 ${x0 + n * cell + 8} ${y0 + n * cell + 8}`} className="nx-chart" role="img" aria-label="Dependency links between layers">
      <text x={x0 + (n * cell) / 2} y="12" textAnchor="middle" className="nx-axis-value">dependent layer (relies on)</text>
      {layers.map((l, j) => <text key={l.id} x={x0 + j * cell + cell / 2} y="34" textAnchor="middle" className="nx-axis-label" style={{ fill: l.color }}>{shortLayer(layers, l.id)}</text>)}
      {layers.map((p, i) => (
        <g key={p.id}>
          <text x={x0 - 10} y={y0 + i * cell + cell / 2 + 4} textAnchor="end" className="nx-axis-label" style={{ fill: p.color }}>{shortLayer(layers, p.id)}</text>
          {layers.map((d, j) => {
            const c = cells[`${p.id}>${d.id}`];
            const links = c ? c.links : 0;
            const loss = c ? c.loss : 0;
            return (
              <g key={d.id} transform={`translate(${x0 + j * cell} ${y0 + i * cell})`}>
                <rect width={cell - 4} height={cell - 4} rx="9" className="nx-cell" style={{ fill: links || loss ? `rgba(159,211,180,${0.12 + (links / maxLinks) * 0.5})` : 'rgba(255,255,255,0.03)' }} />
                {loss > 0 && <rect width={cell - 4} height={cell - 4} rx="9" style={{ fill: `rgba(236,111,133,${0.25 + (loss / maxLoss) * 0.65})` }} />}
                {(links > 0 || loss > 0) && <text x={(cell - 4) / 2} y={loss > 0 ? 32 : 42} textAnchor="middle" className="nx-cell-num">{links}</text>}
                {loss > 0 && <text x={(cell - 4) / 2} y="48" textAnchor="middle" className="nx-cell-sub">{Math.round(loss * 100) >= 1 ? `-${Math.round(loss * 100)}` : '<1'}</text>}
                <title>{`${links} dependency links${loss > 0 ? `, ${Math.round(loss * 100)} health points of failure carried` : ''}`}</title>
              </g>
            );
          })}
        </g>
      ))}
      <text x="12" y={y0 + (n * cell) / 2} className="nx-axis-value" transform={`rotate(-90 12 ${y0 + (n * cell) / 2})`} textAnchor="middle">provider layer (supplies)</text>
    </svg>
  );
}

/* ---------- arrival timeline ---------- */
export function ArrivalTimeline({ graph, sim, onSelect, selectedId, limit = 14 }) {
  const rows = useMemo(() => {
    const label = (id) => graph.nodes.find((n) => n.id === id);
    return sim.affected_nodes
      .map((id) => ({ id, node: label(id), s: sim.nodes[id] }))
      .sort((a, b) => (a.s.arrival_min ?? 0) - (b.s.arrival_min ?? 0) || a.s.wave - b.s.wave || a.id.localeCompare(b.id));
  }, [graph, sim]);
  const shown = rows.slice(0, limit);
  const maxT = Math.max(1, ...rows.map((r) => r.s.arrival_min ?? 0));
  const ticks = niceTicks(maxT, 4);
  const top = ticks[ticks.length - 1];
  const L = 196;
  const W = 680;
  const rh = 25;
  const x = (m) => L + (m / top) * (W - L - 70);
  const H = shown.length * rh + 34;
  if (!rows.length) return <p className="nx-muted">Nothing was affected.</p>;
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="nx-chart" role="img" aria-label="When each component is affected">
        {ticks.map((m) => (
          <g key={m}>
            <line x1={x(m)} x2={x(m)} y1="0" y2={H - 26} className="nx-grid" />
            <text x={x(m)} y={H - 8} textAnchor="middle" className="nx-axis-value">{m === 0 ? '0' : minutes(m)}</text>
          </g>
        ))}
        {shown.map((r, i) => {
          const y = i * rh + 14;
          const t = r.s.arrival_min ?? 0;
          const color = STATUS[r.s.status].color;
          return (
            <g key={r.id} className={`nx-trow${selectedId === r.id ? ' is-selected' : ''}`} onClick={() => onSelect && onSelect(r.id)}>
              <rect x="0" y={y - 12} width={W} height={rh} fill="transparent" />
              <rect x="0" y={y - 6} width="3" height="12" rx="1.5" fill={layerColor(graph.layers, r.node.layer)} />
              <text x="12" y={y + 4} className="nx-trow-label">{r.node.label.length > 24 ? `${r.node.label.slice(0, 23)}…` : r.node.label}</text>
              <line x1={x(0)} x2={x(t)} y1={y} y2={y} stroke={color} strokeOpacity="0.4" strokeWidth="2" />
              <circle cx={x(t)} cy={y} r="5.5" fill={color} className="nx-dot" />
              <text x={x(t) + 11} y={y + 4} className="nx-axis-value">{Math.round(r.s.health * 100)}%</text>
            </g>
          );
        })}
      </svg>
      {rows.length > limit && <p className="nx-muted">+ {rows.length - limit} more components affected later or at the same times.</p>}
    </div>
  );
}

/* ---------- simple HTML bar list ---------- */
export function BarList({ items, max = 100, onPick, selectedId }) {
  return (
    <ul className="nx-barlist">
      {items.map((it) => (
        <li key={it.id}>
          <button className={selectedId === it.id ? 'is-selected' : ''} onClick={() => onPick && onPick(it.id)} disabled={!onPick}>
            <span className="nx-barlist-label">{it.label}<small>{it.sub}</small></span>
            <span className="nx-barlist-track"><span style={{ width: `${(it.value / max) * 100}%`, background: it.color }} /></span>
            <span className="nx-barlist-value">{it.value}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

/* ---------- plan risk curve ---------- */
export function RiskCurve({ plan }) {
  const id = uid(useId());
  const pts = [{ label: 'Now', v: plan.risk_before }, ...plan.steps.map((s) => ({ label: `Step ${s.step}`, v: s.risk_after }))];
  const W = 420;
  const H = 150;
  const L = 36;
  const R = 18;
  const top = Math.max(10, Math.ceil(plan.risk_before / 10) * 10);
  const xs = (i) => (pts.length === 1 ? L : L + (i * (W - L - R)) / (pts.length - 1));
  const ys = (v) => 14 + (1 - v / top) * (H - 40);
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${xs(i)} ${ys(p.v)}`).join(' ');
  const area = `${line} L${xs(pts.length - 1)} ${H - 26} L${xs(0)} ${H - 26} Z`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="nx-chart" role="img" aria-label="Risk after each recommended step">
      <defs><linearGradient id={`${id}-a`} x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#8ad9cc" stopOpacity="0.35" /><stop offset="1" stopColor="#8ad9cc" stopOpacity="0" /></linearGradient></defs>
      {niceTicks(top, 2).map((v) => (
        <g key={v}><line x1={L} x2={W - R} y1={ys(v)} y2={ys(v)} className="nx-grid" /><text x={L - 8} y={ys(v) + 4} textAnchor="end" className="nx-axis-value">{v}</text></g>
      ))}
      <path d={area} fill={`url(#${id}-a)`} />
      <path d={line} className="nx-curve" />
      {pts.map((p, i) => (
        <g key={p.label}>
          <circle cx={xs(i)} cy={ys(p.v)} r="5" className="nx-dot-mint" />
          <text x={xs(i)} y={ys(p.v) - 11} textAnchor="middle" className="nx-bar-value">{p.v}</text>
          <text x={xs(i)} y={H - 8} textAnchor="middle" className="nx-axis-value">{p.label}</text>
        </g>
      ))}
    </svg>
  );
}

/* ---------- status distribution bar ---------- */
export function StatusBar({ counts }) {
  const total = Object.values(counts).reduce((s, v) => s + v, 0) || 1;
  return (
    <div>
      <div className="nx-statusbar" role="img" aria-label="Components by status">
        {STATUS_ORDER.map((s) => counts[s] > 0 && <span key={s} style={{ width: `${(counts[s] / total) * 100}%`, background: STATUS[s].color }} title={`${counts[s]} ${STATUS[s].label}`} />)}
      </div>
      <ul className="nx-legend">
        {STATUS_ORDER.map((s) => <li key={s}><i style={{ background: STATUS[s].color }} />{STATUS[s].label} <b>{counts[s] || 0}</b></li>)}
      </ul>
    </div>
  );
}
