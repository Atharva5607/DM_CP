"""Minimum-cost assignment (Hungarian algorithm, O(n^2 m))."""
from __future__ import annotations

from typing import List, Sequence, Tuple


def hungarian(cost: Sequence[Sequence[float]]) -> Tuple[List[int], float]:
    """Solve rectangular assignment (rows <= cols). Returns (col index per row, total cost)."""
    n = len(cost)
    if n == 0:
        return [], 0.0
    m = len(cost[0])
    if n > m:
        raise ValueError("hungarian requires rows <= columns")
    INF = float("inf")
    u, v = [0.0] * (n + 1), [0.0] * (m + 1)
    p, way = [0] * (m + 1), [0] * (m + 1)
    for i in range(1, n + 1):
        p[0], j0 = i, 0
        minv, used = [INF] * (m + 1), [False] * (m + 1)
        while True:
            used[j0] = True
            i0, delta, j1 = p[j0], INF, 0
            for j in range(1, m + 1):
                if not used[j]:
                    cur = cost[i0 - 1][j - 1] - u[i0] - v[j]
                    if cur < minv[j]:
                        minv[j], way[j] = cur, j0
                    if minv[j] < delta:
                        delta, j1 = minv[j], j
            for j in range(m + 1):
                if used[j]:
                    u[p[j]] += delta
                    v[j] -= delta
                else:
                    minv[j] -= delta
            j0 = j1
            if p[j0] == 0:
                break
        while True:
            j1 = way[j0]
            p[j0] = p[j1]
            j0 = j1
            if j0 == 0:
                break
    assign = [-1] * n
    for j in range(1, m + 1):
        if p[j]:
            assign[p[j] - 1] = j - 1
    return assign, sum(cost[i][assign[i]] for i in range(n))
