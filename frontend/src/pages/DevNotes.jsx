const API = [
  ['GET', '/api/scenarios', 'List demo scenarios'],
  ['POST', '/api/scenarios/{id}/load', 'Load a scenario into the workspace'],
  ['GET', '/api/layers', 'List layers'],
  ['POST', '/api/layers', 'Create a layer'],
  ['GET', '/api/graph', 'Full graph state with structural analysis'],
  ['POST', '/api/nodes', 'Add a node'],
  ['POST', '/api/edges', 'Add an edge inside a layer'],
  ['POST', '/api/dependencies', 'Add a cross-layer dependency'],
  ['POST', '/api/events', 'Register an event'],
  ['POST', '/api/simulations', 'Run the cascade for an event'],
  ['POST', '/api/simulations/mitigate', 'Re-run with mitigations applied'],
  ['GET', '/api/recommendations', 'Ranked actions, plan, schedule, dispatch'],
  ['GET', '/api/analytics/summary', 'Risk, layers, waves, cascade stats'],
  ['GET', '/api/analytics/vulnerability', 'N-1 screening of every component'],
];
const ALGOS = [
  ['BFS (queue)', 'Cascade waves, reachability from a layer feed', 'O(V+E)'],
  ['DFS (stack, recursion)', 'Cycle detection in dependencies, bridges', 'O(V+E)'],
  ['Dijkstra', 'Detours around blocked roads, ambulance travel time', 'O((V+E) log V)'],
  ['Connected components', 'Isolation of stranded components', 'O(V+E)'],
  ['Bridges and articulation points', 'Single points of failure per layer', 'O(V+E)'],
  ['Kruskal and union-find', 'Minimum spanning backbone of each layer', 'O(E log E)'],
  ['Topological sort (Kahn)', 'Restoration order, propagation DAG', 'O(V+E)'],
  ['Welsh-Powell colouring', 'Conflict-free repair batches', 'O(V^2)'],
  ['Brandes betweenness', 'Bottleneck score for risk weights', 'O(VE)'],
  ['Hungarian algorithm', 'Ambulance to hospital assignment', 'O(n^2 m)'],
  ['Warshall closure', 'Blast radius of each component', 'O(V^3 / w)'],
];
const FRONT = [
  ['viz/NetworkView.jsx', 'SVG graph renderer: three layouts, pan and zoom, health rings, particles, tooltips'],
  ['viz/charts.jsx', 'Risk gauge, layer radar, wave bars, failure-flow Sankey, dependency matrix, arrival timeline'],
  ['utils/layouts.js', 'Layered bands, isometric stack projection, seeded force layout'],
  ['store/NexusContext.jsx', 'Backend state, with a demo-snapshot fallback when the API is down'],
  ['store/PaletteContext.jsx', 'Ctrl K command palette; pages register their own commands'],
];

const Table = ({ head, rows }) => (
  <div className="nx-table-wrap">
    <table className="nx-table mono-first">
      <thead><tr>{head.map((h) => <th key={h}>{h}</th>)}</tr></thead>
      <tbody>{rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>)}</tbody>
    </table>
  </div>
);

export default function DevNotes() {
  return (
    <div className="nx-wrap narrow nx-prose">
      <h1>Developer notes</h1>
      <p className="lead">Where things live, how to run them and how to extend them. Full write-ups are in the repository: README.md, DSA_ALGORITHMS.md and docs/.</p>

      <h2>Run it</h2>
      <pre className="nx-code">{`# backend
cd backend && python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python run.py                       # http://127.0.0.1:8000/docs

# frontend
cd frontend && npm install && npm run dev   # http://localhost:5173`}</pre>

      <h2>Architecture in one screen</h2>
      <pre className="nx-code">{`React pages and components     presentation only
  viz/                         custom SVG graph view and charts
  store/NexusContext           mirrors backend responses (or the demo snapshot)
  services/api.js              the only place that builds URLs
------------------------------ HTTP / JSON
FastAPI routes + schemas       validation and status codes
services/workspace.py          application service, no framework code
  simulation, risk,            cascade engine and scoring
  recommendations, analytics
algorithms/*                   pure functions, no domain knowledge
models/domain.py               dataclasses`}</pre>

      <h2>Frontend map</h2>
      <Table head={['File', 'Role']} rows={FRONT} />

      <h2>API</h2>
      <Table head={['Endpoint', 'Purpose']} rows={API.map(([m, p, d]) => [`${m} ${p}`, d])} />

      <h2>Algorithms in use</h2>
      <Table head={['Algorithm', 'Used for', 'Time']} rows={ALGOS} />

      <h2>Adding a new layer</h2>
      <p>POST a layer, add its nodes and edges, then add dependencies to and from existing layers. The engine has no layer-specific code. Mark feed nodes with is_source and set a zone so floods can reach them.</p>
    </div>
  );
}
