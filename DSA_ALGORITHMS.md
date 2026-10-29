# Algorithms and Discrete Mathematics in NexusGraph

Every algorithm here is implemented in `backend/app/algorithms/` with no external graph library, tested in `backend/tests/test_algorithms.py`, and called by a service in `backend/app/services/`. Notation: **V** vertices, **E** edges, **n** and **m** matrix dimensions. All numbers in the examples come from the shipped Metro City model (31 components, 38 edges, 42 dependencies).

## Index

1. [Graph representation](#1-graph-representation)
2. [Breadth-first search](#2-breadth-first-search-bfs)
3. [Depth-first search and cycle detection](#3-depth-first-search-dfs-and-cycle-detection)
4. [Dijkstra's shortest path](#4-dijkstras-shortest-path)
5. [Connected components](#5-connected-components)
6. [Bridges and articulation points](#6-bridges-and-articulation-points)
7. [Minimum spanning tree (Kruskal)](#7-minimum-spanning-tree-kruskal-with-union-find)
8. [Topological sort](#8-topological-sort-kahn)
9. [Graph colouring (Welsh-Powell)](#9-graph-colouring-welsh-powell)
10. [Betweenness centrality (Brandes)](#10-betweenness-centrality-brandes)
11. [Hungarian assignment](#11-hungarian-assignment)
12. [Transitive closure (Warshall) and relations](#12-transitive-closure-warshall-and-relations)
13. [Counting, recurrences, modular arithmetic, pigeonhole](#13-counting-recurrences-modular-arithmetic-and-pigeonhole)
14. [The cascade engine as a whole](#14-the-cascade-engine-as-a-whole)
15. [Discrete mathematics map](#15-discrete-mathematics-map)

---

## 1. Graph representation

- **File:** `algorithms/graph.py`, `services/graph_store.py`
- **What it is:** an undirected weighted multigraph stored as adjacency lists. Each edge has an id, so parallel edges stay distinct. Dependencies are a separate directed relation (provider to dependent).
- **Where used:** each layer yields its own `Graph` (`GraphStore.layer_graph`). `GraphStore.supra_graph` merges all layers and turns each dependency into an extra undirected edge so cross-layer paths can be analysed.
- **Why:** adjacency lists give O(V+E) traversal, which fits sparse infrastructure networks. Edge ids make bridge detection correct when two roads join the same junctions.
- **Space:** O(V+E).

## 2. Breadth-first search (BFS)

- **Idea:** visit vertices in order of distance (in hops) from the start using a queue.
- **Code:** `traversal.bfs_levels`, `traversal.reachable`; the same pattern drives the cascade in `simulation.simulate`.
- **Where used in NexusGraph:**
  1. **Cascade waves.** Wave 0 is the damaged set. Wave k+1 is formed by re-evaluating dependents of wave k nodes. This is BFS over the dependency graph, with a frontier queue per wave.
  2. **Reachability from a feed.** A power node is isolated if no living path joins it to a living source; `reachable(adj, live_sources)` is a multi-source BFS.
- **Problem solved:** orders effects by when they occur and finds components cut off from their supply.
- **Time:** O(V+E). **Space:** O(V).
- **Example:** Power outage. Wave 0: P2 failed, P5 stranded. Wave 1: H1, H3, H4, C2, C5, E1, T1, T4, T8. Wave 2: E2 to E6, which depend on the control centre, the tower and the hospital. A final re-evaluation in wave 3 lowers some of them further, so the deepest recorded wave is 3.
- **Why chosen:** BFS levels are exactly the "how many hops from the cause" the user needs, and the shortest causal chain to each node falls out for free.

## 3. Depth-first search (DFS) and cycle detection

- **Idea:** follow a path as deep as possible, then backtrack. Three colours (white unseen, grey on the stack, black finished) reveal cycles: an edge to a grey vertex closes one.
- **Code:** `traversal.dfs_preorder` (iterative, explicit stack), `traversal.find_cycles` (recursive, colouring), and DFS inside `connectivity.bridges_and_articulation_points`.
- **Where used:** `services/structure.py` runs `find_cycles` on the dependency graph. The API reports circular dependencies, and the engine is built to converge anyway because each propagation step must lower health.
- **Problem solved:** finds mutual dependencies such as "tower needs power from the substation, substation needs the tower for remote control".
- **Time:** O(V+E). **Space:** O(V) for the stack.
- **Example:** Metro City reports one cycle, `C1 -> P3 -> C1`.
- **Why chosen:** it is the standard linear-time cycle test, and it gives the actual cycle, not just a yes or no.

## 4. Dijkstra's shortest path

- **Idea:** repeatedly settle the unsettled vertex with the smallest known distance, using a binary heap, relaxing its edges.
- **Code:** `shortest_path.dijkstra`, `shortest_path.shortest_path`. Accepts blocked nodes and blocked edges so failures can be masked without copying the graph.
- **Where used:**
  - `recommendations._candidates`: for each blocked road, find the detour and report the extra minutes, or report that none exists.
  - `recommendations._dispatch`: travel time from each ambulance's junction to each hospital's junction, as the cost matrix for assignment.
- **Problem solved:** reroute advice and realistic dispatch under road closures.
- **Time:** O((V+E) log V). **Space:** O(V+E).
- **Example:** Traffic layer, T1 to Hospital Road T5. Normal: 9 minutes via T4. With both T3-T5 and T4-T5 blocked: unreachable (this is why Hospital Road becomes isolated). After clearing T3-T5: 13 minutes via T2, T3.
- **Why chosen:** edge weights are non-negative travel times, so Dijkstra is correct and fast. Cross-checked against networkx in tests.

## 5. Connected components

- **Idea:** group vertices that can reach each other.
- **Code:** `connectivity.connected_components` (BFS labelling).
- **Where used:**
  - In layers without feed nodes (traffic, healthcare) the **largest surviving component** is the "main" network, and survivors outside it are isolated (`simulation._layer_connected`).
  - `structure.py` reports component counts per layer and the **independent cycle count** E - V + C.
- **Problem solved:** detects stranded areas after roads or links fail.
- **Time:** O(V+E). **Space:** O(V).
- **Example:** Blocking T3-T5 and T4-T5 splits traffic into a main component of nine junctions and a singleton {T5}. T5 becomes isolated and Hospital Road's access to the rest of the city is lost.
- **Why chosen:** simplest correct method for undirected connectivity.

## 6. Bridges and articulation points

- **Idea:** one DFS records discovery time `disc[v]` and the lowest discovery time reachable from v's subtree `low[v]`. Tree edge (u,v) is a bridge if `low[v] > disc[u]`. A non-root u is an articulation point if some child has `low[v] >= disc[u]`. The root is one if it has two or more DFS children.
- **Code:** `connectivity.bridges_and_articulation_points`.
- **Where used:** `structure.py` per layer. The share of failed articulation points is the **structural** term of the risk score. The dashboard lists them. The recommender flags a blocked road with no detour as a bridge.
- **Problem solved:** exposes single points of failure before anything breaks.
- **Time:** O(V+E). **Space:** O(V).
- **Example:** Traffic: bridge `T6-T10`, articulation point `T6`. Power: bridge `P2-P5`, articulation point `P2`. Communication: none, the tower ring is 2-connected. Emergency: `E1` is an articulation point.
- **Why chosen:** linear time and exact. Cross-checked with networkx on 40 random graphs.

## 7. Minimum spanning tree (Kruskal with union-find)

- **Idea:** sort edges by weight and add each edge that does not close a cycle. Union-find with path halving and union by rank answers "same tree?" in near-constant time.
- **Code:** `mst.kruskal`, `mst.UnionFind`.
- **Where used:** `structure.py` computes the minimum-cost backbone of each layer. Edges outside the MST are the redundant links that provide detours. Together with E - V + C it measures how much redundancy a layer has.
- **Problem solved:** identifies the cheapest connected skeleton and quantifies redundancy.
- **Time:** O(E log E). **Space:** O(V+E).
- **Example:** Traffic MST cost 33 minutes over 9 edges, leaving 3 redundant roads (independent cycles = 3). Communication: MST cost 4, three independent cycles.
- **Why chosen:** the graphs are sparse, and union-find also demonstrates a core data structure.

## 8. Topological sort (Kahn)

- **Idea:** repeatedly remove a vertex with no incoming edges. Vertices that can never be removed lie on or behind a cycle.
- **Code:** `traversal.topological_sort`.
- **Where used:**
  - `recommendations._restoration`: orders damaged components so a provider is restored before everything that depends on it. Leftover vertices are reported as circular.
  - `analytics.cascade_summary`: orders the propagation DAG to count causal paths.
- **Problem solved:** a repair plan that never restores a component before what it needs.
- **Time:** O(V+E). **Space:** O(V).
- **Example:** Power outage restoration order starts with P2 (360 min), then P5 (120 min), H4, C2 and so on.
- **Why chosen:** also detects cycles for free, which the dependency graph can contain.

## 9. Graph colouring (Welsh-Powell)

- **Idea:** order vertices by degree, highest first, and give each the smallest colour not used by a neighbour. Uses at most max-degree + 1 colours.
- **Code:** `coloring.welsh_powell`, `coloring.is_proper`.
- **Where used:** `recommendations._schedule`. Vertices are repair actions. Two actions conflict if they touch the same or neighbouring components in one layer (for example two adjacent junctions). The colour is the **batch** in which they can run in parallel.
- **Problem solved:** a conflict-free parallel repair schedule with few batches.
- **Time:** O(V^2) worst case. **Space:** O(V+E).
- **Example:** Flood scenario: seven candidate repair actions fit into two batches. Tests verify that every colouring is proper and that an odd cycle needs three colours.
- **Why chosen:** exact colouring is NP-hard, and greedy gives a bound that is easy to explain.

## 10. Betweenness centrality (Brandes)

- **Idea:** the share of all shortest paths between other pairs that pass through a vertex. Brandes counts shortest paths with BFS and accumulates dependencies backwards.
- **Code:** `centrality.betweenness_centrality`, `centrality.degree_centrality`.
- **Where used:** `structure.py` runs it on the **supra-graph** (all layers plus dependency links), so components that bridge layers score high. The score weights a component's loss in the risk formula: `weight = criticality * (1 + betweenness)`.
- **Problem solved:** a failure of a well-connected bridging component should count for more than a leaf's.
- **Time:** O(VE). **Space:** O(V+E).
- **Example:** Top bottlenecks: P2 Central Substation 0.157, C2 Central Tower 0.145, H1 St. Mary 0.135, T6 Highway Ramp 0.116, E1 Control Centre 0.100. Values match networkx to 9 decimals in tests.
- **Why chosen:** it ranks importance using structure alone, no tuning needed.

## 11. Hungarian assignment

- **Idea:** solve minimum-cost perfect matching in a weighted bipartite graph using potentials and augmenting paths.
- **Code:** `matching.hungarian` (rectangular, rows <= columns).
- **Where used:** `recommendations._dispatch`. Rows are ambulance units. Columns are hospital slots; the k-th unit sent to a hospital pays a growing queue penalty, so the marginal cost is convex and load spreads. Costs are Dijkstra travel times from the surviving road network plus a penalty for degraded hospitals. Unreachable hospitals cost a large constant and are reported as unreachable.
- **Problem solved:** where each ambulance should go now that roads and hospitals have changed, and which units are redirected relative to the healthy network.
- **Time:** O(n^2 m). **Space:** O(nm).
- **Example:** Road blockage: St. Mary is unreachable, so all three units are assigned to Eastside Medical, and two are flagged "redirected". Tests compare the result to brute-force permutations on 60 random matrices.
- **Why chosen:** exact optimum in polynomial time, and a clean example of matching.

## 12. Transitive closure (Warshall) and relations

- **Idea:** if A depends on B and B depends on C, then A depends on C. Warshall's algorithm adds those indirect pairs. Rows are stored as Python integers used as bitsets.
- **Code:** `discrete_math.transitive_closure`, `discrete_math.relation_properties`.
- **Where used:** `structure.py`. The closure size is the **blast radius** of each component. `relation_properties` classifies the dependency relation.
- **Problem solved:** shows the full set that could ever be hit by a component, before any event.
- **Time:** O(V^3 / w) with machine word size w. **Space:** O(V^2) bits.
- **Example:** Blast radius: P2 reaches 11 components, C2 reaches 8, P5 reaches 7. The dependency relation is irreflexive and neither symmetric, antisymmetric nor transitive in the seed data (the C1/P3 cycle breaks antisymmetry). Its closure is transitive by construction.
- **Why chosen:** the textbook way to connect relations to graphs, and cheap at this size.

## 13. Counting, recurrences, modular arithmetic and pigeonhole

All in `algorithms/discrete_math.py`.

| Topic | Function | Use in the product |
|---|---|---|
| Binomial counting | `n_choose_k` | The number of distinct k-component failure cases: 31, 465 and 4495 for k = 1, 2, 3. N-1 screening evaluates all 31. |
| Recurrence, path counting | `count_paths_dag` | P(v) = [v is a root] + sum of P(u) over predecessors, in topological order. Counts distinct causal paths in the propagation DAG (17 for the power outage). |
| Recurrence, restoration time | `restoration_times` | T(v) = repair(v) + max over damaged providers of T(p), so a component is ready only after all its providers are. |
| Recurrence, health | `simulation.simulate` | h(v) = min(event damage, dependency health, isolation cap), iterated to a fixed point. |
| Modular arithmetic | `crew_for_batch` | Crew = (batch + layer index) mod crews, rotating work evenly. |
| Pigeonhole | `pigeonhole_min_load` | With a units and h usable hospitals, some hospital gets at least ceil(a/h). With r repair actions and c crews, some crew gets at least ceil(r/c). Both are shown in the Actions tab. |

## 14. The cascade engine as a whole

`services/simulation.py` combines the pieces above.

```
h(v)             = min( damage(v), dep_health(v), isolation_cap(v) )
dep_health(v)    = product over groups g of  1 - strength(g) * (1 - max health of providers in g)
```

1. Resolve the event to initial damage and disabled edges.
2. Compute which nodes are isolated (BFS from feeds, or largest component).
3. Put every changed node in wave 0.
4. For each wave: for every node in the frontier, re-evaluate its dependents; any that dropped by more than a small epsilon are recorded as a step and queued for the next wave. When a node fails, re-check its layer for newly stranded survivors.
5. Stop when the frontier is empty. Because health only decreases and is bounded below, the process terminates, even with circular dependencies.
6. Trace each node's cause chain to build its path, sum buffers along the path for arrival time, then score the result.

**Termination argument.** Each recorded step lowers one health value by at least epsilon (1e-6), health is bounded in [0, 1], and the wave count is capped at 25, so the loop is finite. **Correctness test.** `test_result_is_a_fixed_point_of_the_health_equation` re-evaluates the equation for every node of every scenario and checks it holds.

## 15. Discrete mathematics map

| Concept | Where |
|---|---|
| Graphs | Layers, supra-graph, dependency digraph |
| Trees | BFS parent tree (causal paths), Kruskal spanning forest |
| Sets | Affected sets per layer, redundancy groups, isolated-set union, cross-layer subset |
| Relations | Dependency relation, closure, property classification |
| Combinatorics and counting | `n_choose_k`, path counting, failure case counts |
| Graph colouring | Repair batches |
| Recurrence relations | Health fixed point, path counts, restoration time |
| Modular arithmetic | Crew rotation |
| Pigeonhole principle | Minimum units per hospital, minimum actions per crew |
| Connectivity, components | Isolation, E - V + C |
| Paths and cycles | Dijkstra, dependency cycles, bridges and articulation points |
| Spanning trees | Kruskal backbone |
| Matching and assignment | Hungarian dispatch |
