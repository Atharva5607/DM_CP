"""Small discrete-mathematics toolkit: counting, relations, recurrences, modular arithmetic."""
from __future__ import annotations

from math import ceil, comb
from typing import Dict, Iterable, List, Mapping, Sequence, Set, Tuple


def n_choose_k(n: int, k: int) -> int:
    """Binomial coefficient: number of k-element failure combinations out of n components."""
    return comb(n, k) if 0 <= k <= n else 0


def pigeonhole_min_load(items: int, bins: int) -> int:
    """Pigeonhole principle: some bin must hold at least ceil(items/bins) items."""
    return ceil(items / bins) if bins > 0 else items


def count_paths_dag(order: Sequence[str], edges: Iterable[Tuple[str, str]], source_nodes: Iterable[str]) -> Dict[str, int]:
    """Count distinct directed paths from the sources using the recurrence
    P(v) = [v is a source] + sum of P(u) over predecessors u of v, in topological ``order``."""
    preds: Dict[str, List[str]] = {}
    for a, b in edges:
        preds.setdefault(b, []).append(a)
    sources = set(source_nodes)
    paths: Dict[str, int] = {}
    for v in order:
        paths[v] = (1 if v in sources else 0) + sum(paths.get(u, 0) for u in preds.get(v, ()))
    return paths


def transitive_closure(nodes: Sequence[str], pairs: Iterable[Tuple[str, str]]) -> Dict[str, Set[str]]:
    """Warshall's algorithm on bitsets. R+ = all direct and indirect dependencies."""
    idx = {n: i for i, n in enumerate(nodes)}
    reach = [0] * len(nodes)
    for a, b in pairs:
        if a in idx and b in idx:
            reach[idx[a]] |= 1 << idx[b]
    for k in range(len(nodes)):
        bit = 1 << k
        for i in range(len(nodes)):
            if reach[i] & bit:
                reach[i] |= reach[k]
    return {nodes[i]: {nodes[j] for j in range(len(nodes)) if (reach[i] >> j) & 1} for i in range(len(nodes))}


def relation_properties(universe: Sequence[str], pairs: Iterable[Tuple[str, str]]) -> Dict[str, bool]:
    """Classify a binary relation: reflexive, symmetric, antisymmetric, transitive."""
    rel = set(pairs)
    closure = transitive_closure(universe, rel)
    return {
        "reflexive": all((x, x) in rel for x in universe),
        "irreflexive": all((x, x) not in rel for x in universe),
        "symmetric": all((b, a) in rel for a, b in rel),
        "antisymmetric": all(not ((b, a) in rel and a != b) for a, b in rel),
        "transitive": all((a, c) in rel for a in universe for c in closure[a]),
    }


def crew_for_batch(batch_index: int, layer_index: int, crews: int) -> int:
    """Modular arithmetic: rotate repair crews across batches and layers."""
    return (batch_index + layer_index) % crews if crews > 0 else 0


def restoration_times(order: Sequence[str], providers: Mapping[str, Iterable[str]], repair: Mapping[str, float]) -> Dict[str, float]:
    """Recurrence T(v) = repair(v) + max(T(p) for failed providers p) over a topological order."""
    t: Dict[str, float] = {}
    for v in order:
        t[v] = repair.get(v, 0.0) + max((t[p] for p in providers.get(v, ()) if p in t), default=0.0)
    return t
