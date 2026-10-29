"""Recommendation engine.

Every candidate action is evaluated by re-running the cascade simulation with
that mitigation applied, so the reported risk reduction is measured rather than guessed.
"""
from __future__ import annotations

from typing import Dict, List

from ..algorithms.coloring import welsh_powell
from ..algorithms.discrete_math import crew_for_batch, pigeonhole_min_load, restoration_times
from ..algorithms.matching import hungarian
from ..algorithms.shortest_path import dijkstra, shortest_path
from ..algorithms.traversal import topological_sort
from ..core.config import FAIL_THRESHOLD, SAFE_MIN
from ..models.domain import Event
from .graph_store import GraphStore
from .simulation import resolve_event, simulate

CREWS = 3
BIG = 10_000.0


def _candidates(store: GraphStore, event: Event, base: dict) -> List[dict]:
    damage, _ = resolve_event(store, event)
    out: List[dict] = []
    blocked = [e for e, s in base["edges"].items() if s == "blocked"]
    for eid in blocked:
        e = store.edges[eid]
        g = store.layer_graph(e.layer)
        alt = shortest_path(g, e.source, e.target, blocked_edges=blocked)
        detour = (f"Detour exists: {' → '.join(alt[1])} (+{alt[0] - e.weight:.0f} min)" if alt
                  else "No detour exists, this road is a bridge in its layer")
        a, b = store.nodes[e.source].label, store.nodes[e.target].label
        out.append({"type": "restore_edge", "target": eid, "layer": e.layer, "cost": e.repair_minutes / 60,
                    "title": f"Clear the road {a} to {b}", "detail": detour,
                    "mitigation": {"type": "restore_edge", "edge_id": eid}, "nodes": [e.source, e.target]})
    for nid in damage:
        n = store.nodes[nid]
        out.append({"type": "restore_node", "target": nid, "layer": n.layer, "cost": n.repair_minutes / 60,
                    "title": f"Dispatch repair crew to {n.label}",
                    "detail": f"Estimated repair time {n.repair_minutes:.0f} min",
                    "mitigation": {"type": "restore_node", "node_id": nid}, "nodes": [nid]})
    power_users = {d.dependent for d in store.deps.values() if d.kind == "power"}
    service_users = {d.dependent for d in store.deps.values() if d.kind == "service"}
    for nid, st in base["nodes"].items():
        n = store.nodes[nid]
        if st["status"] in ("safe",) or nid in damage:
            continue
        if nid in power_users:
            out.append({"type": "backup_power", "target": nid, "layer": n.layer, "cost": 1.0,
                        "title": f"Switch {n.label} to backup power",
                        "detail": "Generator cuts the power dependency to about 15% of its normal strength",
                        "mitigation": {"type": "backup_power", "node_id": nid}, "nodes": [nid]})
        if nid in service_users:
            out.append({"type": "redirect", "target": nid, "layer": n.layer, "cost": 0.5,
                        "title": f"Redirect {n.label} to an alternate facility",
                        "detail": "Routes service demand away from its degraded primary destination",
                        "mitigation": {"type": "redirect", "node_id": nid}, "nodes": [nid]})
    return out


def _evaluate(store, event, base, cands):
    risk0 = base["risk"]["score"]
    affected = {n for n, s in base["nodes"].items() if s["status"] != "safe"}
    scored = []
    for c in cands:
        res = simulate(store, event, [c["mitigation"]])
        gain = round(risk0 - res["risk"]["score"], 1)
        if gain <= 0.05:
            continue
        resolved = sorted(n for n in affected if res["nodes"][n]["status"] == "safe")
        c = dict(c, risk_reduction=gain, risk_after=res["risk"]["score"], resolved_nodes=resolved,
                 score=round(gain / max(c["cost"], 0.25), 2))
        c["priority"] = "urgent" if gain >= 10 else "high" if gain >= 4 else "medium"
        scored.append(c)
    scored.sort(key=lambda c: (-c["score"], c["target"]))
    for i, c in enumerate(scored, 1):
        c["rank"] = i
    return scored


def _greedy_plan(store, event, base, ranked, max_steps=5):
    """Pick actions one by one, each time taking the largest *marginal* risk reduction."""
    chosen, steps = [], []
    current = base["risk"]["score"]
    pool = ranked[:12]
    for _ in range(max_steps):
        best = None
        for c in pool:
            if c in chosen:
                continue
            res = simulate(store, event, [x["mitigation"] for x in chosen] + [c["mitigation"]])
            gain = current - res["risk"]["score"]
            if best is None or gain > best[0]:
                best = (gain, c, res)
        if best is None or best[0] < 0.3:
            break
        gain, c, res = best
        chosen.append(c)
        current = res["risk"]["score"]
        steps.append({"step": len(steps) + 1, "title": c["title"], "type": c["type"], "target": c["target"],
                      "risk_after": current, "marginal_gain": round(gain, 1)})
    final = simulate(store, event, [x["mitigation"] for x in chosen]) if chosen else base
    resolved = sorted(n for n, s in base["nodes"].items() if s["status"] != "safe" and final["nodes"][n]["status"] == "safe")
    return {"steps": steps, "risk_before": base["risk"]["score"], "risk_after": final["risk"]["score"],
            "resolved_nodes": resolved, "mitigations": [x["mitigation"] for x in chosen]}


def _restoration(store, base):
    hurt = {n for n, s in base["nodes"].items() if s["status"] in ("failed", "critical", "isolated")}
    adj = {n: [] for n in hurt}
    providers: Dict[str, List[str]] = {n: [] for n in hurt}
    for d in store.deps.values():
        if d.provider in hurt and d.dependent in hurt:
            adj[d.provider].append(d.dependent)
            providers[d.dependent].append(d.provider)
    order, cyclic = topological_sort(sorted(hurt), adj)
    repair = {n: store.nodes[n].repair_minutes for n in hurt}
    eta = restoration_times(order, providers, repair)
    items = [{"node": n, "label": store.nodes[n].label, "order": i + 1, "eta_min": round(eta[n])} for i, n in enumerate(order)]
    items += [{"node": n, "label": store.nodes[n].label, "order": len(order) + i + 1, "eta_min": None, "circular": True}
              for i, n in enumerate(cyclic)]
    return items


def _schedule(store, ranked):
    """Colour a conflict graph: actions touching adjacent elements of one layer cannot run together."""
    acts = [c for c in ranked if c["type"] in ("restore_edge", "restore_node", "backup_power")][:8]
    adj = {c["target"] + "|" + c["type"]: [] for c in acts}
    key = lambda c: c["target"] + "|" + c["type"]
    for i, a in enumerate(acts):
        for b in acts[i + 1:]:
            if a["layer"] != b["layer"]:
                continue
            g = store.layer_graph(a["layer"])
            near = any(y in (x, *[v for v, _, _ in g.neighbors(x)]) for x in a["nodes"] for y in b["nodes"])
            if near:
                adj[key(a)].append(key(b))
    colors = welsh_powell(adj)
    layer_idx = {l: i for i, l in enumerate(store.layers)}
    batches: Dict[int, List[dict]] = {}
    for c in acts:
        k = colors[key(c)]
        batches.setdefault(k, []).append({"title": c["title"], "type": c["type"], "layer": c["layer"],
                                          "crew": crew_for_batch(k, layer_idx[c["layer"]], CREWS) + 1})
    return {"batches": [{"batch": k + 1, "actions": v} for k, v in sorted(batches.items())],
            "colors_used": len(batches), "crews": CREWS, "actions": len(acts),
            "min_actions_per_crew": pigeonhole_min_load(len(acts), CREWS)}


def _dispatch(store, base):
    """Optimal ambulance-to-hospital assignment with Hungarian matching on Dijkstra travel times."""
    units = [n for n in store.nodes.values() if n.type == "ambulance" and n.anchor]
    hosp = [n for n in store.nodes.values() if n.type == "hospital" and n.anchor]
    if not units or not hosp:
        return {"assignments": [], "changed": 0, "min_units_per_hospital": 0}
    traffic = store.layer_graph(store.nodes[units[0].anchor].layer)
    blocked_e = [e for e, s in base["edges"].items() if s == "blocked"]
    down = [n for n, s in base["nodes"].items() if s["status"] == "failed"]

    def solve(blocked_edges, blocked_nodes, healthy):
        """Each hospital offers one column per unit; the k-th unit sent there pays a growing queue penalty,
        so marginal costs are convex and Hungarian matching spreads load fairly."""
        usable = [h for h in hosp if healthy or base["nodes"][h.id]["health"] > FAIL_THRESHOLD]
        dists = {u.id: dijkstra(traffic, u.anchor, blocked_nodes, blocked_edges)[0] for u in units}
        cols = [(h, k) for h in usable for k in range(len(units))]
        cost = []
        for u in units:
            row = []
            for h, k in cols:
                hh = 1.0 if healthy else base["nodes"][h.id]["health"]
                queue = k * 600.0 / max((h.capacity or 40) * hh, 1.0)
                row.append(dists[u.id].get(h.anchor, BIG) + (1 - hh) * 30 + queue)
            cost.append(row)
        while len(cols) < len(units):  # no usable hospital at all
            cols.append((None, 0))
            for row in cost:
                row.append(BIG * 2)
        pick, _ = hungarian(cost)
        return [(units[i], cols[j][0], cost[i][j], dists[units[i].id].get(cols[j][0].anchor, BIG) if cols[j][0] else BIG)
                for i, j in enumerate(pick)]

    normal = {u.id: (h.id if h else None) for u, h, _, _ in solve([], [], True)}
    out, changed = [], 0
    for u, h, _, travel in solve(blocked_e, down, False):
        reachable = h is not None and travel < BIG
        h = h if reachable else None
        moved = normal[u.id] != (h.id if h else None)
        changed += moved
        out.append({"unit": u.id, "unit_label": u.label, "hospital": h.id if h else None,
                    "hospital_label": h.label if h else "No reachable hospital",
                    "travel_min": round(travel, 1) if reachable else None, "changed": moved})
    alive = [h for h in hosp if base["nodes"][h.id]["health"] > FAIL_THRESHOLD]
    return {"assignments": out, "changed": changed,
            "min_units_per_hospital": pigeonhole_min_load(len(units), len(alive))}


def build_recommendations(store: GraphStore, event: Event, base: dict) -> dict:
    ranked = _evaluate(store, event, base, _candidates(store, event, base))
    return {
        "ranked": ranked,
        "plan": _greedy_plan(store, event, base, ranked),
        "restoration_order": _restoration(store, base),
        "repair_schedule": _schedule(store, ranked),
        "dispatch": _dispatch(store, base),
    }
