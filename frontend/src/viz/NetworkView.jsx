import { memo, useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { LuMaximize, LuMinus, LuPlus } from 'react-icons/lu';
import { useElementSize } from '../hooks/useElementSize';
import { prefersReducedMotion } from '../hooks/useTween';
import { arcCurve, clamp, easeInOut, lerp, verticalCurve } from '../utils/geometry';
import { STATUS, edgeStatusAt, layerColor, layerName, minutes, sortLayers, stateAtWave } from '../utils/graph';
import { computeLayout } from '../utils/layouts';
import { iconFor } from './nodeIcons';
import { HealthBar } from '../components/Badges';
import { StatusBadge } from '../components/Badges';

const R = 17;
const RING = R + 4;
const CIRC = 2 * Math.PI * RING;

/* ---------- viewport (pan, zoom, animated fit) ---------- */
function useViewport(size, bounds, fitKey, interactive, svgRef) {
  const [vp, setVp] = useState({ x: 0, y: 0, k: 1 });
  const ref = useRef(vp);
  ref.current = vp;
  const raf = useRef(0);
  const first = useRef(true);
  const touched = useRef(false); // true once the user pans or zooms; stops automatic re-fitting on resize
  const lastFit = useRef({ bounds: null, fitKey: null });
  const ready = size.w > 0 && size.h > 0;

  const animateTo = useCallback((to, ms = 550) => {
    cancelAnimationFrame(raf.current);
    const from = ref.current;
    if (ms === 0 || prefersReducedMotion()) {
      setVp(to);
      return;
    }
    const t0 = performance.now();
    const step = (now) => {
      const t = Math.min(Math.max((now - t0) / ms, 0), 1);
      const e = easeInOut(t);
      setVp({ x: lerp(from.x, to.x, e), y: lerp(from.y, to.y, e), k: lerp(from.k, to.k, e) });
      if (t < 1) raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
  }, []);

  const fitTarget = useCallback(() => {
    const pad = 28;
    const k = clamp(Math.min((size.w - 2 * pad) / bounds.w, (size.h - 2 * pad) / bounds.h), 0.2, 1.6);
    return { k, x: (size.w - bounds.w * k) / 2 - bounds.x * k, y: (size.h - bounds.h * k) / 2 - bounds.y * k };
  }, [size.w, size.h, bounds]);

  useEffect(() => {
    if (!ready) return;
    const changed = lastFit.current.bounds !== bounds || lastFit.current.fitKey !== fitKey;
    if (changed) touched.current = false;
    lastFit.current = { bounds, fitKey };
    if (!changed && touched.current) return;
    animateTo(fitTarget(), first.current ? 0 : changed ? 600 : 300);
    first.current = false;
  }, [ready, bounds, fitKey, size.w, size.h]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  useEffect(() => {
    const el = svgRef.current;
    if (!el || !interactive) return undefined;
    const onWheel = (e) => {
      e.preventDefault();
      touched.current = true;
      cancelAnimationFrame(raf.current);
      const rect = el.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const cur = ref.current;
      const k = clamp(cur.k * Math.exp(-e.deltaY * 0.0016), 0.2, 3);
      const r = k / cur.k;
      setVp({ k, x: mx - (mx - cur.x) * r, y: my - (my - cur.y) * r });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [interactive, svgRef]);

  const zoomBy = useCallback((f) => {
    touched.current = true;
    const cur = ref.current;
    const k = clamp(cur.k * f, 0.2, 3);
    const r = k / cur.k;
    const cx = size.w / 2;
    const cy = size.h / 2;
    animateTo({ k, x: cx - (cx - cur.x) * r, y: cy - (cy - cur.y) * r }, 250);
  }, [animateTo, size.w, size.h]);

  const focusOn = useCallback((p) => {
    touched.current = true;
    const k = Math.max(ref.current.k, 1.15);
    animateTo({ k, x: size.w / 2 - p.x * k, y: size.h / 2 - p.y * k }, 600);
  }, [animateTo, size.w, size.h]);

  return { vp, setVp, ref, raf, touched, fit: () => { touched.current = false; animateTo(fitTarget(), 600); }, zoomBy, focusOn };
}

/* ---------- node ---------- */
const Node = memo(function Node({ node, p, st, color, selected, hovered, dim, resolved, newlyHit, labelOn, onSelect, onHover }) {
  const status = resolved ? 'resolved' : st ? st.status : 'safe';
  const health = st ? st.health : 1;
  const Icon = iconFor(node.type);
  const hurt = st && health < 0.999;
  return (
    <g
      className={`nx-node${dim ? ' is-dim' : ''}${selected ? ' is-selected' : ''}${hovered ? ' is-hovered' : ''}`}
      data-node={node.id}
      data-status={status}
      transform={`translate(${p.x} ${p.y})`}
      onClick={(e) => { e.stopPropagation(); onSelect(node.id); }}
      onPointerEnter={() => onHover(node.id)}
      onPointerLeave={() => onHover(null)}
    >
      <g className="nx-node-inner">
        {status !== 'safe' && <circle className="nx-halo" r={R + 13} fill={STATUS[status].color} />}
        {status === 'failed' && <circle className="nx-pulse" r={RING} />}
        {newlyHit && <circle key={`ripple-${node.id}`} className="nx-ripple" r={RING} />}
        <circle className="nx-ring-bg" r={RING} />
        <circle
          className="nx-ring" r={RING} transform="rotate(-90)"
          style={{ stroke: STATUS[status].color, strokeDasharray: `${CIRC * (resolved ? 1 : health)} ${CIRC}` }}
        />
        {selected && <circle className="nx-select-ring" r={RING + 7} />}
        <circle className="nx-body" r={R} style={{ stroke: color }} />
        <Icon x={-8.5} y={-8.5} size={17} color={status === 'failed' ? '#ff8aa6' : color} />
        {labelOn && (
          <>
            <text className="nx-nlabel" y={R + 20}>{node.label}</text>
            {(hurt || resolved) && <text className="nx-hp" y={R + 32} style={{ fill: STATUS[status].color }}>{resolved ? 'restored' : `${Math.round(health * 100)}%`}</text>}
          </>
        )}
      </g>
    </g>
  );
});

/* ---------- decorations ---------- */
function Decor({ item, layers, sim, graph, idp, hidden }) {
  const color = layerColor(layers, item.layer);
  const name = layerName(layers, item.layer);
  const stat = sim && sim.layers[item.layer];
  const off = hidden.has(item.layer);
  const sub = stat ? `${stat.affected} of ${stat.total} affected` : null;
  if (item.kind === 'band') {
    return (
      <g className={`nx-decor${off ? ' is-off' : ''}`}>
        <rect x={item.x} y={item.y} width={item.w} height={item.h} rx="22" fill={`url(#${idp}-band-${item.layer})`} stroke={color} strokeOpacity="0.16" />
        <rect x={item.x + 18} y={item.y + 22} width="4" height="18" rx="2" fill={color} />
        <text className="nx-decor-title" x={item.x + 30} y={item.y + 36} fill={color}>{name}</text>
        {sub && <text className="nx-decor-sub" x={item.x + 30} y={item.y + 54}>{sub}</text>}
      </g>
    );
  }
  if (item.kind === 'plane') {
    const [top, right, bottom, left] = item.points;
    return (
      <g className={`nx-decor${off ? ' is-off' : ''}`}>
        <polygon points={item.points.map((q) => q.join(',')).join(' ')} fill={`url(#${idp}-plane-${item.layer})`} stroke={color} strokeOpacity="0.5" strokeWidth="1.2" />
        <polygon points={`${left[0]},${left[1]} ${bottom[0]},${bottom[1]} ${bottom[0]},${bottom[1] + 9} ${left[0]},${left[1] + 9}`} fill={color} opacity="0.16" />
        <polygon points={`${bottom[0]},${bottom[1]} ${right[0]},${right[1]} ${right[0]},${right[1] + 9} ${bottom[0]},${bottom[1] + 9}`} fill={color} opacity="0.1" />
        <text className="nx-decor-title" x={left[0] - 14} y={left[1] + 2} textAnchor="end" fill={color}>{name}</text>
        {sub && <text className="nx-decor-sub" x={left[0] - 14} y={left[1] + 20} textAnchor="end">{sub}</text>}
        <circle cx={top[0]} cy={top[1]} r="0" />
      </g>
    );
  }
  if (!item.r) return null;
  return (
    <g className={`nx-decor${off ? ' is-off' : ''}`}>
      <circle cx={item.x} cy={item.y} r={item.r} fill={`url(#${idp}-hull-${item.layer})`} stroke={color} strokeOpacity="0.28" strokeDasharray="3 6" />
      <text className="nx-decor-title" x={item.x} y={item.y - item.r - 10} textAnchor="middle" fill={color}>{name}</text>
    </g>
  );
}

/* ---------- main view ---------- */
export default function NetworkView({
  graph, simulation = null, wave = null, layout = 'layers', hiddenLayers = [], showDeps = true,
  selectedId = null, resolved = [], onSelect = () => {}, focus = null, interactive = true, fitKey = '', showControls = true,
}) {
  const wrapRef = useRef(null);
  const svgRef = useRef(null);
  const size = useElementSize(wrapRef);
  const idp = useId().replace(/:/g, '');
  const [hover, setHover] = useState(null);
  const reduced = prefersReducedMotion();

  const layers = useMemo(() => sortLayers(graph.layers), [graph.layers]);
  const { pos, decor, bounds } = useMemo(() => computeLayout(graph, layers, layout), [graph, layers, layout]);
  const { vp, setVp, ref: vpRef, raf, touched, fit, zoomBy, focusOn } = useViewport(size, bounds, `${layout}|${graph.scenario}|${graph.nodes.length}|${fitKey}`, interactive, svgRef);

  const maxWave = simulation ? simulation.max_wave : 0;
  const w = wave == null ? maxWave : wave;
  const state = useMemo(() => (simulation ? stateAtWave(simulation, w) : null), [simulation, w]);
  const hidden = useMemo(() => new Set(hiddenLayers), [hiddenLayers]);
  const resolvedSet = useMemo(() => new Set(wave == null || wave >= maxWave ? resolved : []), [resolved, wave, maxWave]);
  const layerOf = useMemo(() => Object.fromEntries(graph.nodes.map((n) => [n.id, n.layer])), [graph.nodes]);

  useEffect(() => {
    if (focus && pos[focus.id]) focusOn(pos[focus.id]);
  }, [focus]); // eslint-disable-line react-hooks/exhaustive-deps

  const spot = selectedId || hover;
  const focusSet = useMemo(() => {
    if (!spot) return null;
    const s = new Set([spot]);
    graph.edges.forEach((e) => { if (e.source === spot) s.add(e.target); if (e.target === spot) s.add(e.source); });
    graph.dependencies.forEach((d) => { if (d.provider === spot) s.add(d.dependent); if (d.dependent === spot) s.add(d.provider); });
    return s;
  }, [spot, graph.edges, graph.dependencies]);

  const activeDeps = useMemo(() => {
    const a = new Map();
    if (simulation) simulation.history.forEach((s) => { if (s.dependency && s.wave <= w) a.set(s.dependency, s.wave); });
    return a;
  }, [simulation, w]);

  /* edges */
  const intra = graph.edges.filter((e) => !hidden.has(e.layer) && pos[e.source] && pos[e.target]);
  const deps = showDeps ? graph.dependencies.filter((d) => !hidden.has(layerOf[d.provider]) && !hidden.has(layerOf[d.dependent]) && pos[d.provider] && pos[d.dependent]) : [];
  const depPath = (d) => {
    const a = pos[d.provider];
    const b = pos[d.dependent];
    if (layout === 'network') return arcCurve(a.x, a.y, b.x, b.y, 0.12);
    const dy = b.y - a.y;
    if (Math.abs(dy) < 40) {
      return `M${a.x} ${a.y + R + 2} C${a.x} ${a.y + 70} ${b.x} ${b.y + 70} ${b.x} ${b.y + R + 4}`;
    }
    const s = Math.sign(dy);
    return verticalCurve(a.x, a.y + s * (R + 3), b.x, b.y - s * (R + 7));
  };

  const nodesToDraw = graph.nodes.filter((n) => !hidden.has(n.layer) && pos[n.id]);
  const ordered = [...nodesToDraw].sort((a, b) => (a.id === spot) - (b.id === spot));
  const hoverNode = hover ? graph.nodes.find((n) => n.id === hover) : null;
  const hoverPos = hoverNode ? pos[hover] : null;
  const sx = hoverPos ? hoverPos.x * vp.k + vp.x : 0;
  const sy = hoverPos ? hoverPos.y * vp.k + vp.y : 0;

  /* pan */
  const drag = useRef(null);
  const onPointerDown = (e) => {
    if (!interactive || e.button !== 0 || e.target.closest('[data-node]')) return;
    cancelAnimationFrame(raf.current);
    drag.current = { sx: e.clientX, sy: e.clientY, ox: vpRef.current.x, oy: vpRef.current.y, moved: false };
    svgRef.current.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.sx;
    const dy = e.clientY - d.sy;
    if (Math.abs(dx) + Math.abs(dy) > 3) d.moved = true;
    if (d.moved) { touched.current = true; setVp({ k: vpRef.current.k, x: d.ox + dx, y: d.oy + dy }); }
  };
  const onPointerUp = (e) => {
    const d = drag.current;
    drag.current = null;
    if (d && !d.moved) onSelect(null);
    if (svgRef.current.hasPointerCapture?.(e.pointerId)) svgRef.current.releasePointerCapture(e.pointerId);
  };

  const hoverState = hoverNode && state ? state[hoverNode.id] : null;
  const hoverSim = hoverNode && simulation ? simulation.nodes[hoverNode.id] : null;
  const below = sy < 170;

  return (
    <div ref={wrapRef} className={`nx-view${interactive ? ' is-interactive' : ''}`} data-layout={layout}>
      <svg
        ref={svgRef} className="nx-svg" width="100%" height="100%" role="img"
        aria-label="Multi-layer infrastructure graph"
        onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}
      >
        <defs>
          {layers.map((l) => (
            <g key={l.id}>
              <linearGradient id={`${idp}-band-${l.id}`} x1="0" x2="1" y1="0" y2="0">
                <stop offset="0" stopColor={l.color} stopOpacity="0.12" /><stop offset="0.7" stopColor={l.color} stopOpacity="0.02" /><stop offset="1" stopColor={l.color} stopOpacity="0" />
              </linearGradient>
              <linearGradient id={`${idp}-plane-${l.id}`} x1="0" x2="1" y1="0" y2="1">
                <stop offset="0" stopColor={l.color} stopOpacity="0.17" /><stop offset="1" stopColor={l.color} stopOpacity="0.04" />
              </linearGradient>
              <radialGradient id={`${idp}-hull-${l.id}`}>
                <stop offset="0" stopColor={l.color} stopOpacity="0.14" /><stop offset="1" stopColor={l.color} stopOpacity="0.02" />
              </radialGradient>
            </g>
          ))}
          {[['idle', '#8b7bff'], ['active', '#ff5d73']].map(([k, c]) => (
            <marker key={k} id={`${idp}-arrow-${k}`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6.5" markerHeight="6.5" orient="auto">
              <path d="M0 1 L9 5 L0 9 Z" fill={c} />
            </marker>
          ))}
          <filter id={`${idp}-glow`} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        <g className="nx-world" style={{ transform: `translate(${vp.x}px, ${vp.y}px) scale(${vp.k})` }}>
          {decor.map((d) => <Decor key={d.layer} item={d} layers={layers} sim={simulation} graph={graph} idp={idp} hidden={hidden} />)}

          <g className="nx-edges">
            {intra.map((e) => {
              const a = pos[e.source];
              const b = pos[e.target];
              const st = state ? edgeStatusAt(simulation, e, state) : 'ok';
              const dim = focusSet && !(focusSet.has(e.source) && focusSet.has(e.target));
              return (
                <g key={e.id} className={`nx-edge is-${st}${dim ? ' is-dim' : ''}`}>
                  <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} style={{ stroke: st === 'ok' ? layerColor(graph.layers, e.layer) : undefined, strokeWidth: 1.3 + Math.min(e.weight, 8) * 0.12 }} />
                  {st === 'blocked' && (
                    <g transform={`translate(${(a.x + b.x) / 2} ${(a.y + b.y) / 2})`}>
                      <rect x="-27" y="-10" width="54" height="20" rx="10" className="nx-tag" />
                      <text className="nx-tag-text" y="4">blocked</text>
                    </g>
                  )}
                </g>
              );
            })}
          </g>

          <g className="nx-deps">
            {deps.map((d) => {
              const path = depPath(d);
              const waveHit = activeDeps.get(d.id);
              const on = waveHit !== undefined;
              const hot = !!spot && (d.provider === spot || d.dependent === spot);
              const dim = focusSet && !hot;
              return (
                <g key={d.id} className={`nx-dep${on ? ' is-active' : ''}${hot ? ' is-hot' : ''}${on && waveHit === w && w > 0 ? ' is-new' : ''}${dim ? ' is-dim' : ''}`}>
                  <path d={path} className="nx-dep-line" style={{ strokeWidth: on ? 1.6 + d.strength * 2 : hot ? 1.6 : 0.7 + d.strength * 0.9 }} markerEnd={on || hot ? `url(#${idp}-arrow-${on ? 'active' : 'idle'})` : undefined} filter={on ? `url(#${idp}-glow)` : undefined} />
                  {on && !reduced && !dim && [0, 1].map((i) => (
                    <circle key={i} r="2.7" className="nx-particle">
                      <animateMotion dur={`${1.5 + (d.id.length % 5) * 0.12}s`} begin={`${i * 0.75}s`} repeatCount="indefinite" path={path} />
                    </circle>
                  ))}
                </g>
              );
            })}
          </g>

          <g className="nx-nodes">
            {ordered.map((n) => {
              const st = state ? state[n.id] : null;
              const affected = st && st.hit;
              const labelOn = layout !== 'network' ? vp.k > 0.42 : (vp.k > 0.95 || affected || n.id === spot || (focusSet && focusSet.has(n.id)));
              return (
                <Node
                  key={n.id} node={n} p={pos[n.id]} st={st} color={layerColor(graph.layers, n.layer)}
                  selected={n.id === selectedId} hovered={n.id === hover}
                  dim={!!focusSet && !focusSet.has(n.id)} resolved={resolvedSet.has(n.id)}
                  newlyHit={!!simulation && simulation.nodes[n.id]?.wave === w && simulation.nodes[n.id]?.affected && !reduced}
                  labelOn={labelOn} onSelect={onSelect} onHover={setHover}
                />
              );
            })}
          </g>
        </g>
      </svg>

      {hoverNode && (
        <div className={`nx-tip${below ? ' is-below' : ''}`} style={{ left: clamp(sx, 130, Math.max(size.w - 130, 130)), top: below ? sy + (R + 16) * vp.k : sy - (R + 16) * vp.k }}>
          <div className="nx-tip-head">
            <strong>{hoverNode.label}</strong>
            {hoverState && <StatusBadge status={resolvedSet.has(hoverNode.id) ? 'resolved' : hoverState.status} />}
          </div>
          <div className="nx-tip-meta">{layerName(graph.layers, hoverNode.layer)} · {hoverNode.type} · criticality {hoverNode.criticality}</div>
          {hoverState && <HealthBar value={hoverState.health} />}
          {hoverSim?.affected && (
            <div className="nx-tip-meta">
              {hoverSim.wave === 0 ? 'Hit directly by the event' : `Hit in wave ${hoverSim.wave}, after ${minutes(hoverSim.arrival_min)}`}
            </div>
          )}
        </div>
      )}

      {showControls && interactive && (
        <div className="nx-zoom" role="group" aria-label="Zoom controls">
          <button onClick={() => zoomBy(1.3)} aria-label="Zoom in"><LuPlus /></button>
          <button onClick={() => zoomBy(1 / 1.3)} aria-label="Zoom out"><LuMinus /></button>
          <button onClick={fit} aria-label="Fit to screen"><LuMaximize /></button>
        </div>
      )}
    </div>
  );
}
