"""Dijkstra's single-source shortest paths with failure masks."""
from __future__ import annotations

import heapq
from typing import Dict, Iterable, List, Optional, Tuple

from .graph import Graph

INF = float("inf")


def dijkstra(g: Graph, source: str, blocked_nodes: Iterable[str] = (), blocked_edges: Iterable[str] = ()):
    """Binary-heap Dijkstra, O((V+E) log V). Returns (dist, prev) where prev[v]=(u, edge_id)."""
    bn, be = set(blocked_nodes), set(blocked_edges)
    if source in bn or source not in g.adj:
        return {}, {}
    dist: Dict[str, float] = {source: 0.0}
    prev: Dict[str, Tuple[str, str]] = {}
    heap = [(0.0, 0, source)]
    tie, done = 1, set()
    while heap:
        d, _, u = heapq.heappop(heap)
        if u in done:
            continue
        done.add(u)
        for v, w, eid in g.neighbors(u):
            if eid in be or v in bn:
                continue
            nd = d + w
            if nd < dist.get(v, INF):
                dist[v], prev[v] = nd, (u, eid)
                heapq.heappush(heap, (nd, tie, v))
                tie += 1
    return dist, prev


def shortest_path(g: Graph, source: str, target: str, blocked_nodes=(), blocked_edges=()
                  ) -> Optional[Tuple[float, List[str], List[str]]]:
    """Return (cost, node_path, edge_path) or None if the target is unreachable."""
    dist, prev = dijkstra(g, source, blocked_nodes, blocked_edges)
    if target not in dist:
        return None
    nodes, edges, cur = [target], [], target
    while cur != source:
        cur, eid = prev[cur]
        nodes.append(cur)
        edges.append(eid)
    return dist[target], nodes[::-1], edges[::-1]
