"""Static structural analysis of the multi-layer graph (no event involved)."""
from __future__ import annotations

from typing import Dict

from ..algorithms.centrality import betweenness_centrality, degree_centrality
from ..algorithms.connectivity import bridges_and_articulation_points, connected_components
from ..algorithms.discrete_math import relation_properties, transitive_closure
from ..algorithms.mst import kruskal
from ..algorithms.traversal import find_cycles
from .graph_store import GraphStore

_cache: Dict[int, dict] = {}


def analyze_structure(store: GraphStore) -> dict:
    key = (id(store), store.version)
    if key in _cache:
        return _cache[key]
    layers = {}
    for lid in store.layers:
        g = store.layer_graph(lid)
        comps = connected_components(g)
        bridges, points = bridges_and_articulation_points(g)
        mst_edges, mst_cost = kruskal(g)
        deg = degree_centrality(g)
        layers[lid] = {
            "nodes": len(g.nodes), "edges": len(g.edges), "components": len(comps),
            # cyclomatic number E - V + C = count of independent cycles (redundancy)
            "independent_cycles": len(g.edges) - len(g.nodes) + len(comps),
            "bridges": bridges, "articulation_points": points,
            "mst_edges": mst_edges, "mst_cost": round(mst_cost, 2),
            "degree": {k: round(v, 3) for k, v in deg.items()},
        }
    supra = betweenness_centrality(store.supra_graph())
    top = max(supra.values(), default=0.0) or 1.0
    dep_adj = store.dependency_adj()
    pairs = [(d.provider, d.dependent) for d in store.deps.values()]
    node_ids = list(store.nodes)
    closure = transitive_closure(node_ids, pairs)
    result = {
        "layers": layers,
        "supra_betweenness": {k: round(v, 4) for k, v in supra.items()},
        "supra_betweenness_norm": {k: v / top for k, v in supra.items()},
        "dependency_cycles": find_cycles(dep_adj),
        "blast_radius": {k: len(v) for k, v in closure.items()},
        "dependency_relation": relation_properties(node_ids, pairs),
    }
    _cache.clear()  # keep a single entry; the store changes rarely
    _cache[key] = result
    return result
