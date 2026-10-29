"""Connected components, bridges and articulation points (Tarjan low-link)."""
from __future__ import annotations

import sys
from collections import deque
from typing import List, Set, Tuple

from .graph import Graph

sys.setrecursionlimit(10000)


def connected_components(g: Graph) -> List[List[str]]:
    """BFS component labelling, O(V+E)."""
    seen: Set[str] = set()
    comps = []
    for s in g.nodes:
        if s in seen:
            continue
        seen.add(s)
        comp, queue = [], deque([s])
        while queue:
            u = queue.popleft()
            comp.append(u)
            for v, _, _ in g.neighbors(u):
                if v not in seen:
                    seen.add(v)
                    queue.append(v)
        comps.append(comp)
    return comps


def bridges_and_articulation_points(g: Graph) -> Tuple[List[str], List[str]]:
    """Single DFS computing discovery/low-link times, O(V+E).

    A tree edge (u,v) is a bridge when low[v] > disc[u]. A non-root vertex u is
    an articulation point when some child has low[v] >= disc[u]; the root is
    one when it has two or more DFS children. Edge ids (not endpoints) are
    used to skip the parent edge, so parallel edges are handled correctly.
    """
    disc, low = {}, {}
    timer = [0]
    bridges: List[str] = []
    points: Set[str] = set()

    def dfs(u: str, parent_edge):
        disc[u] = low[u] = timer[0]
        timer[0] += 1
        children = 0
        for v, _, eid in g.neighbors(u):
            if eid == parent_edge:
                continue
            if v in disc:
                low[u] = min(low[u], disc[v])
            else:
                children += 1
                dfs(v, eid)
                low[u] = min(low[u], low[v])
                if low[v] > disc[u]:
                    bridges.append(eid)
                if parent_edge is None:
                    if children > 1:
                        points.add(u)
                elif low[v] >= disc[u]:
                    points.add(u)

    for s in g.nodes:
        if s not in disc:
            dfs(s, None)
    return bridges, sorted(points)
