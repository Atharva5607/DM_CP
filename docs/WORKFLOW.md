# Workflow

## End-to-end flow

1. **Load.** The UI calls `GET /api/scenarios` and `GET /api/graph`. The graph response includes the structural analysis (bridges, articulation points, bottlenecks, blast radius, dependency cycles).
2. **Choose or craft an event.** A preset from the scenario, or a custom event built in the event panel (type, targets, severity).
3. **Simulate.** `POST /api/simulations` runs `simulation.simulate`. The UI then fetches `GET /api/recommendations` and `GET /api/analytics/summary` in parallel.
4. **Explore.** The graph autoplays the cascade once, then shows the final state. The replay bar scrubs waves, the layout switch changes between layers, 3D stack and network, and clicking a node shows health, how the failure reached it, what it depends on and what it supports. Ctrl K searches components and commands.
5. **Act.** "Apply" on one action, or "Apply plan", calls `POST /api/simulations/mitigate`. The engine re-runs the same event with the mitigations, returns the new state, the risk before and after, and the components now restored.

## Inside one simulation

```
event --> resolve_event --> initial damage + disabled edges
      --> isolation check per layer (BFS from feeds or largest component)
      --> wave 0 frontier
      --> repeat: for each frontier node, re-evaluate dependents
                  record steps, enqueue those that dropped
                  re-check the layer of any newly failed node
      --> frontier empty
      --> trace causal paths, arrival times, per-layer summary
      --> risk score
```

## Inside the recommendation step

```
candidates  = clear blocked roads  + repair damaged nodes
            + backup power for degraded power users
            + redirect for degraded service users
evaluate    = simulate each candidate alone -> risk reduction, restored set
rank        = reduction / max(cost, 0.25)
plan        = greedy: add the candidate with the best marginal gain, up to 5
extras      = restoration order (topological sort + recurrence)
              repair batches (graph colouring + modular crew rotation)
              dispatch (Dijkstra + Hungarian)
```

## Editing a scenario

Builder actions call the CRUD endpoints. After any edit the context clears the previous simulation, since results no longer match the graph, and refetches `/api/graph`.

## Demo script (about three minutes)

1. Home page: point out the animated stack. Providers sit at the bottom.
2. Open **Power outage**. Explain the risk meter and the five status counts.
3. Press **Replay**. Wave 0 shows the substation and the signal hub. Waves 1 and 2 show the spread across layers.
4. Click **St. Mary General**: the causal path starts at the substation.
5. **Propagation** tab: each dependency link with before and after health and the buffer time.
6. **Actions** tab: ranked actions, restoration order, repair batches, ambulance dispatch. Press **Apply plan**.
7. **Single-failure screening** tab: the worst single points of failure in the whole city.
8. **Scenario builder**: add a node and a dependency, inject an event, and show the cascade in the dashboard.
