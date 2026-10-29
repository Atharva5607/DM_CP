import { seeded } from './geometry';

export const LAYOUTS = [
  { id: 'layers', label: 'Layers' },
  { id: 'stack', label: '3D stack' },
  { id: 'network', label: 'Network' },
];

const BAND = 176;
const ISO_W = 330;
const ISO_H = 66;
const ISO_STEP = 228;

/** Local plane coordinates (u across, v down), both 0..1. Seeded nodes use their stored x,y; new ones get a tidy grid. */
function localCoords(graph) {
  const counts = {};
  const out = {};
  graph.nodes.forEach((n) => {
    if (n.x === 0 && n.y === 0) {
      const i = (counts[n.layer] = (counts[n.layer] || 0) + 1) - 1;
      out[n.id] = { u: 0.08 + (i % 7) * 0.13, v: Math.min(0.2 + Math.floor(i / 7) * 0.3, 0.9) };
    } else {
      out[n.id] = { u: Math.min(Math.max(n.x / 1000, 0.03), 0.97), v: Math.min(Math.max(n.y / 140, 0.06), 0.94) };
    }
  });
  return out;
}

/** Push apart nodes of the same layer whose icons or labels would overlap. Deterministic, works in screen space. */
function declutter(pos, graph, { w, h, limit, clampY }) {
  const byLayer = {};
  graph.nodes.forEach((n) => (byLayer[n.layer] = byLayer[n.layer] || []).push(n.id));
  const origin = Object.fromEntries(Object.entries(pos).map(([k, v]) => [k, { ...v }]));
  for (let it = 0; it < 120; it++) {
    let moved = false;
    Object.values(byLayer).forEach((ids) => {
      for (let i = 0; i < ids.length; i++) {
        for (let j = i + 1; j < ids.length; j++) {
          const a = pos[ids[i]];
          const b = pos[ids[j]];
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const ox = w - Math.abs(dx);
          const oy = h - Math.abs(dy);
          if (ox > 0 && oy > 0) {
            moved = true;
            if (oy < ox * 0.55) {
              const s = (dy >= 0 ? 1 : -1) * (oy / 2 + 0.5);
              a.y -= s; b.y += s;
            } else {
              const s = (dx >= 0 ? 1 : -1) * (ox / 2 + 0.5);
              a.x -= s; b.x += s;
            }
          }
        }
      }
    });
    Object.keys(pos).forEach((id) => {
      const o = origin[id];
      const p = pos[id];
      p.x = Math.min(Math.max(p.x, o.x - limit.x), o.x + limit.x);
      p.y = Math.min(Math.max(p.y, o.y - limit.y), o.y + limit.y);
      if (clampY) p.y = Math.min(Math.max(p.y, clampY[id][0]), clampY[id][1]);
    });
    if (!moved) break;
  }
}

function layersLayout(graph, layers) {
  const local = localCoords(graph);
  const band = Object.fromEntries(layers.map((l, i) => [l.id, i]));
  const pos = {};
  const clampY = {};
  graph.nodes.forEach((n) => {
    const { u, v } = local[n.id];
    const top = band[n.layer] * BAND + 44;
    pos[n.id] = { x: 130 + u * 800, y: top + v * (BAND - 112) };
    clampY[n.id] = [top, top + BAND - 112];
  });
  declutter(pos, graph, { w: 132, h: 56, limit: { x: 130, y: 60 }, clampY });
  const decor = layers.map((l, i) => ({ kind: 'band', layer: l.id, x: 0, y: i * BAND, w: 1040, h: BAND - 14 }));
  return { pos, decor, bounds: { x: 0, y: 0, w: 1040, h: layers.length * BAND - 14 } };
}

function stackLayout(graph, layers) {
  const local = localCoords(graph);
  const index = Object.fromEntries(layers.map((l, i) => [l.id, i]));
  const cx = 720;
  const pos = {};
  graph.nodes.forEach((n) => {
    const { u, v } = local[n.id];
    const a = (u * 2 - 1) * 0.9;
    const b = (v * 2 - 1) * 0.74;
    const cy = 150 + index[n.layer] * ISO_STEP;
    pos[n.id] = { x: cx + (a - b) * ISO_W, y: cy + (a + b) * ISO_H };
  });
  declutter(pos, graph, { w: 120, h: 54, limit: { x: 150, y: 60 } });
  const decor = layers.map((l, i) => {
    const cy = 150 + i * ISO_STEP;
    return {
      kind: 'plane', layer: l.id, cx, cy,
      points: [[cx, cy - 2 * ISO_H], [cx + 2 * ISO_W, cy], [cx, cy + 2 * ISO_H], [cx - 2 * ISO_W, cy]],
    };
  });
  return { pos, decor, bounds: { x: cx - 2 * ISO_W - 200, y: 150 - 2 * ISO_H - 30, w: 4 * ISO_W + 240, h: (layers.length - 1) * ISO_STEP + 4 * ISO_H + 60 } };
}

function networkLayout(graph, layers) {
  const rand = seeded(11);
  const cx = 700;
  const cy = 470;
  const centers = {};
  layers.forEach((l, i) => {
    const ang = -Math.PI / 2 + (i * 2 * Math.PI) / layers.length;
    centers[l.id] = { x: cx + Math.cos(ang) * 560, y: cy + Math.sin(ang) * 420 };
  });
  const nodes = graph.nodes.map((n) => ({
    id: n.id, layer: n.layer, x: centers[n.layer].x + (rand() - 0.5) * 260, y: centers[n.layer].y + (rand() - 0.5) * 260, vx: 0, vy: 0,
  }));
  const byId = Object.fromEntries(nodes.map((n) => [n.id, n]));
  const links = [
    ...graph.edges.map((e) => ({ a: byId[e.source], b: byId[e.target], len: 92 + Math.min(e.weight, 8) * 9, k: 0.07 })),
    ...graph.dependencies.map((d) => ({ a: byId[d.provider], b: byId[d.dependent], len: 300, k: 0.008 })),
  ];
  let alpha = 1;
  for (let it = 0; it < 360; it++) {
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i];
        const b = nodes[j];
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        const d2 = Math.max(dx * dx + dy * dy, 36);
        const d = Math.sqrt(d2);
        const f = (22000 / d2) * alpha;
        dx /= d; dy /= d;
        a.vx -= dx * f; a.vy -= dy * f; b.vx += dx * f; b.vy += dy * f;
      }
    }
    links.forEach(({ a, b, len, k }) => {
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = Math.max(Math.hypot(dx, dy), 1);
      const f = (d - len) * k * alpha;
      a.vx += (dx / d) * f; a.vy += (dy / d) * f; b.vx -= (dx / d) * f; b.vy -= (dy / d) * f;
    });
    nodes.forEach((n) => {
      const c = centers[n.layer];
      n.vx += (c.x - n.x) * 0.006 * alpha;
      n.vy += (c.y - n.y) * 0.006 * alpha;
      n.x += n.vx; n.y += n.vy;
      n.vx *= 0.78; n.vy *= 0.78;
    });
    alpha *= 0.985;
  }
  const pos = Object.fromEntries(nodes.map((n) => [n.id, { x: n.x, y: n.y }]));
  const decor = layers.map((l) => {
    const mine = nodes.filter((n) => n.layer === l.id);
    if (!mine.length) return { kind: 'hull', layer: l.id, x: 0, y: 0, r: 0 };
    const x = mine.reduce((s, n) => s + n.x, 0) / mine.length;
    const y = mine.reduce((s, n) => s + n.y, 0) / mine.length;
    const r = Math.max(...mine.map((n) => Math.hypot(n.x - x, n.y - y))) + 62;
    return { kind: 'hull', layer: l.id, x, y, r };
  });
  const xs = nodes.map((n) => n.x);
  const ys = nodes.map((n) => n.y);
  const minX = Math.min(...xs) - 130;
  const minY = Math.min(...ys) - 120;
  return { pos, decor, bounds: { x: minX, y: minY, w: Math.max(...xs) + 130 - minX, h: Math.max(...ys) + 120 - minY } };
}

export function computeLayout(graph, layers, kind) {
  if (kind === 'stack') return stackLayout(graph, layers);
  if (kind === 'network') return networkLayout(graph, layers);
  return layersLayout(graph, layers);
}
