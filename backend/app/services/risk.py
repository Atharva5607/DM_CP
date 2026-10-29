"""Risk scoring: combines weighted service loss, layer spread, cascade depth and structural damage."""
from __future__ import annotations

from typing import Dict

from ..core.config import FAIL_THRESHOLD, SAFE_MIN
from .graph_store import GraphStore


def risk_level(score: float) -> str:
    return "low" if score < 20 else "moderate" if score < 45 else "high" if score < 70 else "critical"


def compute_risk(store: GraphStore, structure: dict, health: Dict[str, float], max_wave: int) -> dict:
    """risk = 100 * (0.55*loss + 0.20*spread + 0.15*depth + 0.10*structural)

    loss        weighted mean of (1 - health); weight = criticality * (1 + supra betweenness)
    spread      layers hit / total layers
    depth       cascade waves / 5 (capped at 1)
    structural  failed bridges + articulation points / all of them
    """
    bet = structure["supra_betweenness_norm"]
    num = den = 0.0
    for nid, n in store.nodes.items():
        w = n.criticality * (1.0 + bet.get(nid, 0.0))
        num += w * (1.0 - health[nid])
        den += w
    loss = num / den if den else 0.0

    hit = {store.nodes[n].layer for n, h in health.items() if h < SAFE_MIN}
    spread = len(hit) / len(store.layers) if store.layers else 0.0
    depth = min(max_wave / 5.0, 1.0)

    critical_nodes = {p for lay in structure["layers"].values() for p in lay["articulation_points"]}
    structural = 0.0
    if critical_nodes:
        structural = sum(1 for p in critical_nodes if health.get(p, 1.0) <= FAIL_THRESHOLD) / len(critical_nodes)

    score = 100.0 * (0.55 * loss + 0.20 * spread + 0.15 * depth + 0.10 * structural)
    score = round(min(score, 100.0), 1)
    return {
        "score": score, "level": risk_level(score),
        "components": {"loss": round(loss, 3), "spread": round(spread, 3),
                       "depth": round(depth, 3), "structural": round(structural, 3)},
    }
