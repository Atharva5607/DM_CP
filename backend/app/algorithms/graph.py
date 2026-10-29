"""Lightweight undirected weighted multigraph shared by every algorithm module.

Edges carry an explicit id so parallel edges stay distinguishable (needed for
correct bridge detection) and so results can be mapped back to the UI.
"""
from __future__ import annotations

from collections import defaultdict
from typing import Dict, Iterable, List, Tuple

Neighbor = Tuple[str, float, str]  # (neighbour, weight, edge_id)


class Graph:
    def __init__(self, nodes: Iterable[str] = (), edges: Iterable[Tuple[str, str, str, float]] = ()):
        self._nodes: Dict[str, None] = {}  # insertion-ordered set
        self.adj: Dict[str, List[Neighbor]] = defaultdict(list)
        self.edges: Dict[str, Tuple[str, str, float]] = {}
        for n in nodes:
            self.add_node(n)
        for eid, u, v, w in edges:
            self.add_edge(eid, u, v, w)

    @property
    def nodes(self) -> List[str]:
        return list(self._nodes)

    def add_node(self, n: str) -> None:
        self._nodes.setdefault(n, None)
        self.adj[n]  # touch so isolated nodes exist in adjacency

    def add_edge(self, eid: str, u: str, v: str, w: float = 1.0) -> None:
        self.add_node(u)
        self.add_node(v)
        self.edges[eid] = (u, v, w)
        self.adj[u].append((v, w, eid))
        if u != v:
            self.adj[v].append((u, w, eid))

    def neighbors(self, u: str) -> List[Neighbor]:
        return self.adj.get(u, [])

    def degree(self, u: str) -> int:
        return len(self.neighbors(u))

    def plain_adj(self) -> Dict[str, List[str]]:
        return {n: [v for v, _, _ in self.neighbors(n)] for n in self._nodes}

    def without(self, nodes: Iterable[str] = (), edges: Iterable[str] = ()) -> "Graph":
        """Return a copy with the given nodes/edges removed (failure modelling)."""
        bad_n, bad_e = set(nodes), set(edges)
        g = Graph(n for n in self._nodes if n not in bad_n)
        for eid, (u, v, w) in self.edges.items():
            if eid not in bad_e and u not in bad_n and v not in bad_n:
                g.add_edge(eid, u, v, w)
        return g
