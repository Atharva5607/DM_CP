// Lazy-loaded so the snapshot (about 110 KB) is only downloaded when it is needed.
export const loadDemo = () => import('./demo.json').then((m) => m.default);

export function demoGraph(demo, scenarioId) {
  return { ...demo.graph, scenario: scenarioId, events: demo.byScenario[scenarioId].events };
}
