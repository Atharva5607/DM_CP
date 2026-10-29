"""Greedy graph colouring with the Welsh-Powell vertex ordering."""
from __future__ import annotations

from typing import Dict, Iterable, Mapping


def welsh_powell(adj: Mapping[str, Iterable[str]]) -> Dict[str, int]:
    """Colour vertices in descending degree order. Uses at most max_degree+1 colours. O(V^2) worst case."""
    nbrs = {u: set(vs) for u, vs in adj.items()}
    for u, vs in list(nbrs.items()):
        for v in vs:
            nbrs.setdefault(v, set()).add(u)
    order = sorted(nbrs, key=lambda n: (-len(nbrs[n]), n))
    color: Dict[str, int] = {}
    for u in order:
        used = {color[v] for v in nbrs[u] if v in color}
        c = 0
        while c in used:
            c += 1
        color[u] = c
    return color


def is_proper(adj: Mapping[str, Iterable[str]], color: Mapping[str, int]) -> bool:
    return all(color[u] != color[v] for u, vs in adj.items() for v in vs if u != v)
