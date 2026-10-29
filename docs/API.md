# API reference

Base URL `http://127.0.0.1:8000`. Interactive documentation: `/docs`. All bodies are JSON. Errors have the shape `{"detail": "message"}`: 404 not found, 400 rule violation, 422 malformed input.

## Scenarios

| Method and path | Description |
|---|---|
| `GET /api/scenarios` | List presets with counts and their events |
| `POST /api/scenarios/{id}/load` | Replace the workspace with a preset (`road-blockage`, `power-outage`, `flood`, `comm-failure`, `blank`). Returns the graph state |
| `POST /api/reset` | Reload the current scenario |
| `GET /api/health` | Liveness and current scenario |

## Graph

| Method and path | Body | Description |
|---|---|---|
| `GET /api/layers` | | List layers |
| `POST /api/layers` | `{id, name, color?, description?}` | Create a layer (201) |
| `GET /api/graph` | | Layers, nodes, edges, dependencies, events and the structural summary |
| `POST /api/nodes` | `{layer, label, id?, type?, criticality?, capacity?, zone?, is_source?, anchor?, repair_minutes?}` | Add a node (201) |
| `DELETE /api/nodes/{id}` | | Remove a node with its edges and dependencies (204) |
| `POST /api/edges` | `{source, target, weight?, id?}` | Add an in-layer edge (201). Rejected across layers |
| `DELETE /api/edges/{id}` | | Remove an edge (204) |
| `POST /api/dependencies` | `{provider, dependent, kind?, strength?, delay_min?, group?}` | Add a dependency (201) |
| `DELETE /api/dependencies/{id}` | | Remove a dependency (204) |

## Events and simulation

| Method and path | Body | Description |
|---|---|---|
| `POST /api/events` | `{type, target_nodes?, target_edges?, zone?, severity?, name?}` | Validate and register an event (201) |
| `POST /api/simulations` | `{event_id}` or `{event: {...}}`, optional `mitigations` | Run the cascade |
| `GET /api/simulations/latest` | | Last result, or null |
| `POST /api/simulations/mitigate` | `{mitigations: [...]}` | Re-run the last event with mitigations. Returns `before_risk`, `after_risk`, `resolved_nodes`, `simulation` |

Event types: `road_block`, `power_failure`, `tower_outage`, `flood`, `hospital_overload`, `node_failure`.
Mitigation types: `backup_power {node_id}`, `redirect {node_id}`, `restore_node {node_id}`, `restore_edge {edge_id}`.

### Simulation result (abridged)

```json
{
  "id": "sim-1",
  "event": {"type": "power_failure", "target_nodes": ["P2"], "severity": 1.0},
  "risk": {"score": 55.1, "level": "high", "components": {"loss": 0.428, "spread": 1.0, "depth": 0.6, "structural": 0.25}},
  "nodes": {"H1": {"health": 0.073, "status": "critical", "wave": 1, "arrival_min": 10.0, "path": ["P2", "H1"]}},
  "edges": {"P2-P5": "down"},
  "history": [{"wave": 1, "source": "P2", "target": "H1", "via": "dependency", "kind": "power", "health_before": 1.0, "health_after": 0.1}],
  "waves": [{"wave": 0, "nodes": 2, "failed": 1}],
  "layers": {"hospital": {"total": 5, "affected": 3, "failed": 1, "avg_health": 0.448}},
  "counts": {"safe": 15, "warning": 6, "critical": 7, "isolated": 1, "failed": 2}
}
```

Statuses: `safe` (health at least 0.85), `warning` (at least 0.5), `critical`, `isolated` (cut off from its layer), `failed` (health at most 0.05). Edge statuses: `blocked`, `down`, `degraded`, `stressed`.

## Analysis

| Method and path | Description |
|---|---|
| `GET /api/recommendations` | `ranked`, `plan`, `restoration_order`, `repair_schedule`, `dispatch`. Needs a prior simulation (400 otherwise) |
| `GET /api/analytics/summary` | Structural summary plus, after a simulation, risk, counts, per-layer impact, waves and cascade statistics |
| `GET /api/analytics/vulnerability` | N-1 screening: fails every component alone and returns the ranked worst cases |
