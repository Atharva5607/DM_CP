"""Degree and betweenness centrality (Brandes' algorithm)."""
from __future__ import annotations

from collections import deque
from typing import Dict

from .graph import Graph


def degree_centrality(g: Graph) -> Dict[str, float]:
    n = len(g.nodes)
    return {v: (g.degree(v) / (n - 1) if n > 1 else 0.0) for v in g.nodes}


def betweenness_centrality(g: Graph) -> Dict[str, float]:
    """Normalised unweighted betweenness for undirected graphs. O(V*E).

    Counts, for every vertex, the share of shortest paths between all other
    pairs that pass through it. High values mark bottlenecks.
    """
    nodes = g.nodes
    cb = {v: 0.0 for v in nodes}
    for s in nodes:
        stack, pred = [], {v: [] for v in nodes}
        sigma = dict.fromkeys(nodes, 0.0)
        dist = dict.fromkeys(nodes, -1)
        sigma[s], dist[s] = 1.0, 0
        queue = deque([s])
        while queue:
            v = queue.popleft()
            stack.append(v)
            for w, _, _ in g.neighbors(v):
                if dist[w] < 0:
                    dist[w] = dist[v] + 1
                    queue.append(w)
                if dist[w] == dist[v] + 1:
                    sigma[w] += sigma[v]
                    pred[w].append(v)
        delta = dict.fromkeys(nodes, 0.0)
        while stack:
            w = stack.pop()
            for v in pred[w]:
                delta[v] += sigma[v] / sigma[w] * (1.0 + delta[w])
            if w != s:
                cb[w] += delta[w]
    n = len(nodes)
    scale = 1.0 / ((n - 1) * (n - 2)) if n > 2 else 1.0
    return {v: c * scale for v, c in cb.items()}
