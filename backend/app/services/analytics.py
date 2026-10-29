"""Analytics for the dashboard: summary metrics and N-1 vulnerability screening."""
from __future__ import annotations

from typing import Dict, Optional

from ..algorithms.discrete_math import count_paths_dag, n_choose_k
from ..algorithms.traversal import topological_sort
from ..core.config import SAFE_MIN
from ..models.domain import Event
from .graph_store import GraphStore
from .simulation import simulate
from .structure import analyze_structure


def structure_summary(store: GraphStore) -> dict:
    s = analyze_structure(store)
    top = sorted(s["supra_betweenness"].items(), key=lambda kv: -kv[1])[:5]
    radius = sorted(s["blast_radius"].items(), key=lambda kv: -kv[1])[:5]
    n = len(store.nodes)
    return {
        "layers": {k: {kk: vv for kk, vv in v.items() if kk != "degree"} for k, v in s["layers"].items()},
        "top_bottlenecks": [{"node": k, "label": store.nodes[k].label, "betweenness": v} for k, v in top],
        "largest_blast_radius": [{"node": k, "label": store.nodes[k].label, "dependents": v} for k, v in radius],
        "node_metrics": {k: {"betweenness": s["supra_betweenness"][k], "blast_radius": s["blast_radius"][k],
                             "degree": s["layers"][n.layer]["degree"].get(k, 0.0),
                             "articulation": k in s["layers"][n.layer]["articulation_points"]}
                         for k, n in store.nodes.items()},
        "dependency_cycles": s["dependency_cycles"],
        "dependency_relation": s["dependency_relation"],
        "counting": {"nodes": n, "single_failure_cases": n_choose_k(n, 1), "double_failure_cases": n_choose_k(n, 2),
                     "triple_failure_cases": n_choose_k(n, 3)},
    }


def cascade_summary(store: GraphStore, result: dict) -> dict:
    steps = [s for s in result["history"] if s["source"]]
    edges = sorted({(s["source"], s["target"]) for s in steps})
    adj: Dict[str, list] = {}
    for a, b in edges:
        adj.setdefault(a, []).append(b)
    nodes = sorted({n for e in edges for n in e} | {s["target"] for s in result["history"]})
    order, cyclic = topological_sort(nodes, adj)
    roots = [s["target"] for s in result["history"] if s["wave"] == 0]
    paths = count_paths_dag(order, edges, roots)
    most = max(paths.items(), key=lambda kv: kv[1], default=(None, 0))
    affected = result["affected_nodes"]
    crossing = [n for n in affected if len({store.nodes[p].layer for p in result["nodes"][n]["path"]}) > 1]
    slowest = max(affected, key=lambda n: (result["nodes"][n]["arrival_min"] or 0, result["nodes"][n]["wave"] or 0), default=None)
    layer_sets = {lid: sorted(n for n in affected if store.nodes[n].layer == lid) for lid in store.layers}
    return {
        "affected_total": len(affected), "cross_layer_nodes": len(crossing),
        "propagation_paths": {"total": sum(paths[n] for n in paths if n not in adj), "most_reached_node": most[0],
                              "most_reached_count": most[1], "cyclic_nodes": cyclic},
        "longest_cascade": {"node": slowest, "minutes": result["nodes"][slowest]["arrival_min"] if slowest else 0,
                            "path": result["nodes"][slowest]["path"] if slowest else []},
        "affected_by_layer": layer_sets,
    }


def vulnerability_screening(store: GraphStore, top: int = 10) -> dict:
    """N-1 contingency analysis: fail each node alone and rank by resulting system risk."""
    rows = []
    for nid, n in store.nodes.items():
        r = simulate(store, Event("screen", "node_failure", target_nodes=[nid], severity=1.0))
        rows.append({"node": nid, "label": n.label, "layer": n.layer, "risk": r["risk"]["score"],
                     "level": r["risk"]["level"], "affected": len(r["affected_nodes"]), "waves": r["max_wave"],
                     "layers_hit": sum(1 for v in r["layers"].values() if v["avg_health"] < SAFE_MIN)})
    rows.sort(key=lambda r: (-r["risk"], r["node"]))
    return {"cases_evaluated": len(rows), "worst": rows[:top],
            "mean_risk": round(sum(r["risk"] for r in rows) / len(rows), 1) if rows else 0.0}
