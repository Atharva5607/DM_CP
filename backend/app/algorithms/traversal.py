"""BFS, DFS, cycle detection and topological sorting."""
from __future__ import annotations

from collections import deque
from typing import Dict, Iterable, List, Mapping, Optional, Sequence, Tuple

Adj = Mapping[str, Iterable[str]]


def bfs_levels(adj: Adj, starts: Sequence[str]) -> Tuple[Dict[str, int], Dict[str, Optional[str]]]:
    """Multi-source BFS. Returns (level, parent). Queue-based, O(V+E)."""
    level: Dict[str, int] = {}
    parent: Dict[str, Optional[str]] = {}
    queue = deque()
    for s in starts:
        if s not in level:
            level[s], parent[s] = 0, None
            queue.append(s)
    while queue:
        u = queue.popleft()
        for v in adj.get(u, ()):
            if v not in level:
                level[v], parent[v] = level[u] + 1, u
                queue.append(v)
    return level, parent


def reachable(adj: Adj, starts: Sequence[str]) -> set:
    return set(bfs_levels(adj, starts)[0])


def dfs_preorder(adj: Adj, start: str) -> List[str]:
    """Iterative DFS using an explicit stack, O(V+E)."""
    seen, order, stack = set(), [], [start]
    while stack:
        u = stack.pop()
        if u in seen:
            continue
        seen.add(u)
        order.append(u)
        stack.extend(reversed(list(adj.get(u, ()))))
    return order


def find_cycles(adj: Adj) -> List[List[str]]:
    """Detect directed cycles with three-colour DFS (white/grey/black).

    A back edge to a grey vertex closes a cycle; the cycle is read off the
    current DFS stack. Used to report circular cross-layer dependencies.
    """
    WHITE, GREY, BLACK = 0, 1, 2
    color: Dict[str, int] = {}
    cycles, seen_sets = [], set()
    nodes = set(adj) | {v for vs in adj.values() for v in vs}

    def visit(u: str, path: List[str]) -> None:
        color[u] = GREY
        path.append(u)
        for v in adj.get(u, ()):
            if color.get(v, WHITE) == WHITE:
                visit(v, path)
            elif color[v] == GREY:
                cyc = path[path.index(v):]
                key = frozenset(cyc)
                if key not in seen_sets:
                    seen_sets.add(key)
                    cycles.append(cyc + [v])
        path.pop()
        color[u] = BLACK

    for n in sorted(nodes):
        if color.get(n, WHITE) == WHITE:
            visit(n, [])
    return cycles


def topological_sort(nodes: Iterable[str], adj: Adj) -> Tuple[List[str], List[str]]:
    """Kahn's algorithm. Returns (order, leftover). Leftover nodes sit on cycles."""
    nodes = list(nodes)
    indeg = {n: 0 for n in nodes}
    for u in nodes:
        for v in adj.get(u, ()):
            if v in indeg:
                indeg[v] += 1
    queue = deque(n for n in nodes if indeg[n] == 0)
    order = []
    while queue:
        u = queue.popleft()
        order.append(u)
        for v in adj.get(u, ()):
            if v in indeg:
                indeg[v] -= 1
                if indeg[v] == 0:
                    queue.append(v)
    placed = set(order)
    return order, [n for n in nodes if n not in placed]
