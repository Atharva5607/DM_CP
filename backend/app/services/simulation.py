"""Cascading-failure engine.

Health model (all values in [0, 1], 1 = fully functional):

    health(v) = min( event_damage(v), dependency_health(v), isolation_cap(v) )

    dependency_health(v) = prod over dependency groups g of  1 - strength_g * (1 - supply_g)
    supply_g             = max health among the providers in g        (redundant providers)

Because health can only decrease, the recurrence reaches a fixed point. It is
evaluated with a breadth-first worklist: wave k holds the nodes whose health
dropped during wave k, and only their dependents are re-evaluated in wave k+1.
"""
from __future__ import annotations

from collections import defaultdict, deque
from typing import Dict, List, Optional, Sequence, Set, Tuple

from ..algorithms.connectivity import connected_components
from ..algorithms.traversal import reachable
from ..core.config import (BACKUP_POWER_FACTOR, EPSILON, FAIL_THRESHOLD, ISOLATED_CAP, MAX_WAVES,
                           REDIRECT_FACTOR, SAFE_MIN, WARNING_MIN)
from ..core.errors import NotFoundError, ValidationError
from ..models.domain import EVENT_TYPES, Event
from .graph_store import GraphStore
from .risk import compute_risk
from .structure import analyze_structure

MITIGATION_TYPES = {"backup_power", "restore_edge", "restore_node", "redirect"}


def status_of(health: float, isolated: bool) -> str:
    if health <= FAIL_THRESHOLD:
        return "failed"
    if isolated:
        return "isolated"
    return "safe" if health >= SAFE_MIN else "warning" if health >= WARNING_MIN else "critical"


def resolve_event(store: GraphStore, ev: Event) -> Tuple[Dict[str, float], Set[str]]:
    """Translate an event into (initial node damage, disabled edge ids)."""
    if ev.type not in EVENT_TYPES:
        raise ValidationError(f"Unknown event type '{ev.type}'")
    if not 0 < ev.severity <= 1:
        raise ValidationError("severity must be in (0, 1]")
    for nid in ev.target_nodes:
        if nid not in store.nodes:
            raise NotFoundError(f"Node '{nid}' not found")
    for eid in ev.target_edges:
        if eid not in store.edges:
            raise NotFoundError(f"Edge '{eid}' not found")
    damage: Dict[str, float] = {}
    disabled: Set[str] = set(ev.target_edges)
    targets = list(ev.target_nodes)
    if ev.zone:
        zoned = [n.id for n in store.nodes.values() if n.zone == ev.zone]
        if not zoned and not (ev.target_nodes or ev.target_edges):
            raise ValidationError(f"No nodes found in zone '{ev.zone}'")
        targets += zoned
    if not targets and not disabled:
        raise ValidationError("An event needs at least one target node, edge or zone")
    factor = 0.7 if ev.type == "hospital_overload" else 1.0  # overload strains, it does not kill
    for nid in targets:
        damage[nid] = min(damage.get(nid, 1.0), 1.0 - ev.severity * factor)
    if ev.type == "road_block":
        for nid in ev.target_nodes:  # a blocked junction closes all its roads
            disabled.update(e.id for e in store.edges.values() if nid in (e.source, e.target))
    return damage, disabled


def _layer_connected(store: GraphStore, layer_id: str, health: Dict[str, float], disabled: Set[str]) -> Tuple[Set[str], Set[str]]:
    """Return (alive nodes, alive nodes still connected to the layer's feed).

    Layers with source nodes (grid intake, core hub, control centre): connected means
    reachable from a living source. Other layers: connected means inside the largest
    surviving component.
    """
    members = [n for n in store.nodes.values() if n.layer == layer_id]
    alive = {n.id for n in members if health[n.id] > FAIL_THRESHOLD}
    if not alive:
        return set(), set()
    g = store.layer_graph(layer_id).without(
        nodes=[n.id for n in members if n.id not in alive], edges=disabled)
    sources = [n.id for n in members if n.is_source]
    if sources:
        return alive, reachable(g.plain_adj(), [s for s in sources if s in alive])
    comps = connected_components(g)
    return alive, (set(max(comps, key=len)) if comps else set())


def _layer_isolation(store: GraphStore, layer_id: str, health: Dict[str, float], disabled: Set[str],
                     baseline: Set[str]) -> Set[str]:
    """Alive nodes that were connected in the intact layer but are cut off now.

    Comparing against the intact graph keeps nodes the user never wired up from being
    reported as 'isolated' before anything has failed.
    """
    alive, connected = _layer_connected(store, layer_id, health, disabled)
    return (alive & baseline) - connected


def simulate(store: GraphStore, event: Event, mitigations: Sequence[dict] = ()) -> dict:
    damage, disabled = resolve_event(store, event)
    backup, redirected = set(), set()
    for m in mitigations:
        kind = m.get("type")
        if kind not in MITIGATION_TYPES:
            raise ValidationError(f"Unknown mitigation '{kind}'")
        key = "edge_id" if kind == "restore_edge" else "node_id"
        target = m.get(key)
        if not target:
            raise ValidationError(f"Mitigation '{kind}' needs '{key}'")
        if target not in (store.edges if key == "edge_id" else store.nodes):
            raise NotFoundError(f"Mitigation target '{target}' not found")
        if kind == "backup_power":
            backup.add(target)
        elif kind == "redirect":
            redirected.add(target)
        elif kind == "restore_edge":
            disabled.discard(target)
        elif kind == "restore_node":
            damage.pop(target, None)

    deps_in = defaultdict(list)    # dependent -> dependencies it relies on
    deps_out = defaultdict(list)   # provider  -> dependencies that rely on it
    for d in store.deps.values():
        deps_in[d.dependent].append(d)
        deps_out[d.provider].append(d)

    health = {nid: 1.0 for nid in store.nodes}
    for nid, h in damage.items():
        health[nid] = h
    intact = {nid: 1.0 for nid in store.nodes}
    baseline = {lid: _layer_connected(store, lid, intact, set())[1] for lid in store.layers}
    isolated: Set[str] = set()
    for lid in store.layers:
        isolated |= _layer_isolation(store, lid, health, disabled, baseline[lid])

    def cap(nid: str) -> float:
        return ISOLATED_CAP if nid in isolated else 1.0

    def dependency_health(nid: str) -> float:
        groups = defaultdict(list)
        for d in deps_in[nid]:
            groups[d.group].append(d)
        h = 1.0
        for ds in groups.values():
            supply = max(health[d.provider] for d in ds)
            strength = max(d.strength for d in ds)
            if ds[0].kind == "power" and nid in backup:
                strength *= BACKUP_POWER_FACTOR
            if ds[0].kind == "service" and nid in redirected:
                strength *= REDIRECT_FACTOR
            h *= 1.0 - strength * (1.0 - supply)
        return h

    wave_of: Dict[str, int] = {}
    arrival: Dict[str, float] = {}
    cause: Dict[str, Optional[str]] = {}
    steps: List[dict] = []
    frontier: deque = deque()
    for nid in store.nodes:
        h = min(health[nid], cap(nid))
        if h < 1.0 - EPSILON:
            health[nid] = h
            wave_of[nid], arrival[nid], cause[nid] = 0, 0.0, None
            frontier.append(nid)
            steps.append({"wave": 0, "source": None, "target": nid, "via": "event" if nid in damage else "isolation",
                          "kind": None, "dependency": None, "health_before": 1.0,
                          "health_after": round(h, 3), "time_min": 0.0})

    failed_seen: Set[str] = set()
    wave = 0
    while frontier and wave < MAX_WAVES:
        wave += 1
        current, frontier = list(frontier), deque()
        queued: Set[str] = set()
        dirty_layers: Set[str] = set()
        for u in current:
            if health[u] <= FAIL_THRESHOLD and u not in failed_seen:
                failed_seen.add(u)
                dirty_layers.add(store.nodes[u].layer)
            for d in deps_out[u]:
                v = d.dependent
                new = min(damage.get(v, 1.0), dependency_health(v), cap(v))
                if new < health[v] - EPSILON:
                    steps.append({"wave": wave, "source": u, "target": v, "via": "dependency", "kind": d.kind,
                                  "dependency": d.id, "health_before": round(health[v], 3),
                                  "health_after": round(new, 3), "time_min": arrival[u] + d.delay_min})
                    if v not in wave_of:
                        wave_of[v], cause[v] = wave, u
                        arrival[v] = arrival[u] + d.delay_min
                    else:
                        arrival[v] = min(arrival[v], arrival[u] + d.delay_min)
                    health[v] = new
                    if v not in queued:
                        queued.add(v)
                        frontier.append(v)
        for lid in dirty_layers:  # intra-layer propagation: new failures can strand survivors
            for v in _layer_isolation(store, lid, health, disabled, baseline[lid]) - isolated:
                isolated.add(v)
                src = next((n for n in current if store.nodes[n].layer == lid and health[n] <= FAIL_THRESHOLD), None)
                new = min(health[v], ISOLATED_CAP)
                if new < health[v] - EPSILON:
                    steps.append({"wave": wave, "source": src, "target": v, "via": "layer-connectivity",
                                  "kind": "connectivity", "dependency": None, "health_before": round(health[v], 3),
                                  "health_after": round(new, 3), "time_min": arrival.get(src, 0.0)})
                    health[v] = new
                    if v not in wave_of:
                        wave_of[v], cause[v], arrival[v] = wave, src, arrival.get(src, 0.0)
                    if v not in queued:
                        queued.add(v)
                        frontier.append(v)

    def trace(nid: str) -> List[str]:
        path, cur, guard = [nid], cause.get(nid), 0
        while cur is not None and guard < 100:
            path.append(cur)
            cur, guard = cause.get(cur), guard + 1
        return path[::-1]

    nodes_out = {}
    for nid, n in store.nodes.items():
        h = round(health[nid], 3)
        nodes_out[nid] = {
            "health": h, "status": status_of(h, nid in isolated), "isolated": nid in isolated,
            "affected": nid in wave_of, "wave": wave_of.get(nid), "arrival_min": arrival.get(nid),
            "path": trace(nid) if nid in wave_of else [],
        }

    edges_out = {}
    for eid, e in store.edges.items():
        a, b = health[e.source], health[e.target]
        if eid in disabled:
            edges_out[eid] = "blocked"
        elif min(a, b) <= FAIL_THRESHOLD:
            edges_out[eid] = "down"
        elif e.source in isolated or e.target in isolated:
            edges_out[eid] = "degraded"
        elif min(a, b) < SAFE_MIN:
            edges_out[eid] = "stressed"

    max_wave = max((s["wave"] for s in steps), default=0)
    structure = analyze_structure(store)
    risk = compute_risk(store, structure, health, max_wave)

    by_layer = {}
    for lid in store.layers:
        ids = [n for n in store.nodes if store.nodes[n].layer == lid]
        affected = [n for n in ids if nodes_out[n]["health"] < SAFE_MIN or nodes_out[n]["isolated"]]
        by_layer[lid] = {"total": len(ids), "affected": len(affected),
                         "failed": sum(1 for n in ids if nodes_out[n]["status"] == "failed"),
                         "avg_health": round(sum(nodes_out[n]["health"] for n in ids) / len(ids), 3) if ids else 1.0}
    waves = defaultdict(lambda: {"nodes": 0, "failed": 0})
    for nid, w in wave_of.items():
        waves[w]["nodes"] += 1
        waves[w]["failed"] += 1 if nodes_out[nid]["status"] == "failed" else 0

    return {
        "event": event.to_dict(), "mitigations": list(mitigations), "nodes": nodes_out, "edges": edges_out,
        "affected_nodes": sorted(wave_of, key=lambda n: (wave_of[n], n)),
        "propagation_links": sorted({s["dependency"] for s in steps if s["dependency"]}),
        "history": steps, "max_wave": max_wave, "risk": risk, "layers": by_layer,
        "waves": [{"wave": w, **waves[w]} for w in sorted(waves)],
        "counts": {s: sum(1 for v in nodes_out.values() if v["status"] == s)
                   for s in ("safe", "warning", "critical", "isolated", "failed")},
    }
