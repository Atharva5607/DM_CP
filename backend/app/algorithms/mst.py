"""Minimum spanning forest with Kruskal's algorithm and a union-find structure."""
from __future__ import annotations

from typing import Dict, List, Tuple

from .graph import Graph


class UnionFind:
    def __init__(self, items):
        self.parent: Dict[str, str] = {i: i for i in items}
        self.rank: Dict[str, int] = {i: 0 for i in items}

    def find(self, x: str) -> str:
        while self.parent[x] != x:
            self.parent[x] = self.parent[self.parent[x]]  # path halving
            x = self.parent[x]
        return x

    def union(self, a: str, b: str) -> bool:
        ra, rb = self.find(a), self.find(b)
        if ra == rb:
            return False
        if self.rank[ra] < self.rank[rb]:
            ra, rb = rb, ra
        self.parent[rb] = ra
        if self.rank[ra] == self.rank[rb]:
            self.rank[ra] += 1
        return True


def kruskal(g: Graph) -> Tuple[List[str], float]:
    """Return (edge ids in the minimum spanning forest, total weight). O(E log E)."""
    uf = UnionFind(g.nodes)
    chosen, total = [], 0.0
    for eid, (u, v, w) in sorted(g.edges.items(), key=lambda kv: (kv[1][2], kv[0])):
        if uf.union(u, v):
            chosen.append(eid)
            total += w
    return chosen, total
