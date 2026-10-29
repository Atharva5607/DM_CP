// Presentation helpers. Graph algorithms run in the backend; this file only maps results to visuals.
export const LAYER_ORDER = ['emergency', 'hospital', 'traffic', 'comm', 'power'];

export const STATUS = {
  safe: { label: 'Safe', color: '#3ddc97' },
  warning: { label: 'Warning', color: '#ffb020' },
  critical: { label: 'Critical', color: '#ff6a5a' },
  failed: { label: 'Failed', color: '#ff2e63' },
  isolated: { label: 'Isolated', color: '#9aa4c7' },
  resolved: { label: 'Restored', color: '#5eead4' },
};
export const STATUS_ORDER = ['failed', 'critical', 'isolated', 'warning', 'safe'];

export const LAYER_COLORS = { traffic: '#f5a524', hospital: '#ff6b81', power: '#ffd84d', comm: '#38d6ff', emergency: '#a78bfa' };

export const EVENT_TYPES = [
  { id: 'road_block', label: 'Road blockage', target: 'edge' },
  { id: 'power_failure', label: 'Power failure', target: 'node', layer: 'power' },
  { id: 'tower_outage', label: 'Tower outage', target: 'node', layer: 'comm' },
  { id: 'flood', label: 'Flood', target: 'zone' },
  { id: 'hospital_overload', label: 'Hospital overload', target: 'node', layer: 'hospital' },
  { id: 'node_failure', label: 'Single node failure', target: 'node' },
];

export const sortLayers = (layers) =>
  [...layers].sort((a, b) => {
    const ia = LAYER_ORDER.indexOf(a.id);
    const ib = LAYER_ORDER.indexOf(b.id);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
  });

export const layerColor = (layers, id) => layers.find((l) => l.id === id)?.color || LAYER_COLORS[id] || '#8b7bff';
export const layerName = (layers, id) => layers.find((l) => l.id === id)?.name || id;

export const statusOf = (health, isolated) =>
  health <= 0.05 ? 'failed' : isolated ? 'isolated' : health >= 0.85 ? 'safe' : health >= 0.5 ? 'warning' : 'critical';

/** Rebuild node state after `wave` waves from the recorded propagation history (drives the replay). */
export function stateAtWave(sim, wave) {
  const state = {};
  Object.keys(sim.nodes).forEach((id) => (state[id] = { health: 1, isolated: false, hit: false }));
  sim.history.forEach((s) => {
    if (s.wave > wave) return;
    const prev = state[s.target];
    state[s.target] = {
      health: s.health_after,
      hit: true,
      isolated: prev.isolated || s.via === 'isolation' || s.via === 'layer-connectivity',
    };
  });
  Object.values(state).forEach((s) => (s.status = statusOf(s.health, s.isolated)));
  return state;
}

export function edgeStatusAt(sim, edge, nodeState) {
  if (sim.edges[edge.id] === 'blocked') return 'blocked';
  const a = nodeState[edge.source];
  const b = nodeState[edge.target];
  if (a.status === 'failed' || b.status === 'failed') return 'down';
  if (a.isolated || b.isolated) return 'degraded';
  if (Math.min(a.health, b.health) < 0.85) return 'stressed';
  return 'ok';
}

export const pct = (x) => `${Math.round(x * 100)}%`;
export const minutes = (m) => (m == null ? 'n/a' : m >= 60 ? `${Math.floor(m / 60)}h ${Math.round(m % 60)}m` : `${Math.round(m)} min`);
export const eventBody = (e) => ({
  type: e.type, name: e.name, target_nodes: e.target_nodes, target_edges: e.target_edges, zone: e.zone, severity: e.severity,
});
