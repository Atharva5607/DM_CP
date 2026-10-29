import { layerName, minutes } from './graph';

/** Plain-language findings derived from a simulation result. */
export function keyFindings(graph, sim) {
  if (!sim) return [];
  const label = (id) => graph.nodes.find((n) => n.id === id)?.label || id;
  const layerOf = (id) => graph.nodes.find((n) => n.id === id)?.layer;
  const out = [];
  const hit = sim.affected_nodes;
  const layersHit = new Set(hit.map(layerOf));
  const roots = sim.history.filter((s) => s.wave === 0 && s.via === 'event').map((s) => label(s.target));

  if (hit.length === 0) return ['The event did not degrade any component. The model absorbed it.'];

  out.push(
    `${hit.length} of ${graph.nodes.length} components were affected across ${layersHit.size} of ${graph.layers.length} layers, over ${sim.max_wave} cascade wave${sim.max_wave === 1 ? '' : 's'}.`
  );

  const crossing = hit.filter((n) => new Set(sim.nodes[n].path.map(layerOf)).size > 1);
  if (crossing.length) out.push(`${crossing.length} of them were reached through a dependency on another layer, not by the event itself.`);

  const secondary = hit.filter((n) => sim.nodes[n].wave > 0 && sim.nodes[n].arrival_min != null);
  const first = [...secondary].sort((a, b) => sim.nodes[a].arrival_min - sim.nodes[b].arrival_min)[0];
  if (first && roots.length) out.push(`The first knock-on effect is ${label(first)}, felt ${sim.nodes[first].arrival_min === 0 ? 'immediately' : `after ${minutes(sim.nodes[first].arrival_min)}`}.`);

  const worst = Object.entries(sim.nodes)
    .filter(([, n]) => n.status === 'critical' || n.status === 'failed')
    .map(([id]) => id)
    .sort((a, b) => (graph.nodes.find((n) => n.id === b)?.criticality || 0) - (graph.nodes.find((n) => n.id === a)?.criticality || 0))[0];
  if (worst) out.push(`The most critical component in trouble is ${label(worst)} (criticality ${graph.nodes.find((n) => n.id === worst).criticality} of 10), now ${sim.nodes[worst].status}.`);

  const layers = Object.entries(sim.layers).sort((a, b) => a[1].avg_health - b[1].avg_health)[0];
  if (layers && layers[1].avg_health < 0.95) out.push(`${layerName(graph.layers, layers[0])} is the weakest layer, at ${Math.round(layers[1].avg_health * 100)}% average health.`);
  return out;
}

/** Aggregate failure flow between layers from dependency steps: Map "from>to" -> total health lost. */
export function layerFlows(graph, sim) {
  if (!sim) return [];
  const layerOf = Object.fromEntries(graph.nodes.map((n) => [n.id, n.layer]));
  const acc = {};
  sim.history.forEach((s) => {
    if (s.via !== 'dependency' || !s.source) return;
    const key = `${layerOf[s.source]}>${layerOf[s.target]}`;
    acc[key] = (acc[key] || 0) + Math.max(s.health_before - s.health_after, 0);
  });
  return Object.entries(acc)
    .map(([k, value]) => ({ from: k.split('>')[0], to: k.split('>')[1], value }))
    .filter((f) => f.value > 0.001);
}

/** Dependency counts between layers (provider layer -> dependent layer), plus the loss carried in a simulation. */
export function dependencyMatrix(graph, sim) {
  const layerOf = Object.fromEntries(graph.nodes.map((n) => [n.id, n.layer]));
  const cells = {};
  graph.dependencies.forEach((d) => {
    const k = `${layerOf[d.provider]}>${layerOf[d.dependent]}`;
    cells[k] = cells[k] || { links: 0, loss: 0 };
    cells[k].links += 1;
  });
  layerFlows(graph, sim).forEach((f) => {
    const k = `${f.from}>${f.to}`;
    cells[k] = cells[k] || { links: 0, loss: 0 };
    cells[k].loss += f.value;
  });
  return cells;
}
