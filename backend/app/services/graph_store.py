"""In-memory multi-layer graph. Owns validation and builds algorithm-ready views."""
from __future__ import annotations

import copy
from typing import Dict, List

from ..algorithms.graph import Graph
from ..core.errors import NotFoundError, ValidationError
from ..models.domain import Dependency, Edge, Layer, Node


class GraphStore:
    def __init__(self) -> None:
        self.layers: Dict[str, Layer] = {}
        self.nodes: Dict[str, Node] = {}
        self.edges: Dict[str, Edge] = {}
        self.deps: Dict[str, Dependency] = {}
        self.version = 0  # bumped on every mutation; keys the structure cache

    # ---- mutation -------------------------------------------------------
    def _touch(self) -> None:
        self.version += 1

    def add_layer(self, layer: Layer) -> Layer:
        if layer.id in self.layers:
            raise ValidationError(f"Layer '{layer.id}' already exists")
        self.layers[layer.id] = layer
        self._touch()
        return layer

    def add_node(self, node: Node) -> Node:
        if node.layer not in self.layers:
            raise NotFoundError(f"Layer '{node.layer}' not found")
        if node.id in self.nodes:
            raise ValidationError(f"Node '{node.id}' already exists")
        if not 1 <= node.criticality <= 10:
            raise ValidationError("criticality must be between 1 and 10")
        self.nodes[node.id] = node
        self._touch()
        return node

    def remove_node(self, node_id: str) -> None:
        if node_id not in self.nodes:
            raise NotFoundError(f"Node '{node_id}' not found")
        del self.nodes[node_id]
        self.edges = {k: e for k, e in self.edges.items() if node_id not in (e.source, e.target)}
        self.deps = {k: d for k, d in self.deps.items() if node_id not in (d.provider, d.dependent)}
        self._touch()

    def add_edge(self, edge: Edge) -> Edge:
        a, b = self.nodes.get(edge.source), self.nodes.get(edge.target)
        if a is None or b is None:
            raise NotFoundError("Both edge endpoints must exist")
        if a.layer != b.layer:
            raise ValidationError("Edges connect nodes inside one layer; use a dependency across layers")
        if edge.source == edge.target:
            raise ValidationError("Self loops are not allowed")
        if edge.weight <= 0:
            raise ValidationError("Edge weight must be positive")
        if edge.id in self.edges:
            raise ValidationError(f"Edge '{edge.id}' already exists")
        edge.layer = a.layer
        self.edges[edge.id] = edge
        self._touch()
        return edge

    def remove_edge(self, edge_id: str) -> None:
        if edge_id not in self.edges:
            raise NotFoundError(f"Edge '{edge_id}' not found")
        del self.edges[edge_id]
        self._touch()

    def add_dependency(self, dep: Dependency) -> Dependency:
        if dep.provider not in self.nodes or dep.dependent not in self.nodes:
            raise NotFoundError("Provider and dependent nodes must exist")
        if dep.provider == dep.dependent:
            raise ValidationError("A node cannot depend on itself")
        if not 0 < dep.strength <= 1:
            raise ValidationError("strength must be in (0, 1]")
        if dep.id in self.deps:
            raise ValidationError(f"Dependency '{dep.id}' already exists")
        self.deps[dep.id] = dep
        self._touch()
        return dep

    def remove_dependency(self, dep_id: str) -> None:
        if dep_id not in self.deps:
            raise NotFoundError(f"Dependency '{dep_id}' not found")
        del self.deps[dep_id]
        self._touch()

    # ---- algorithm views --------------------------------------------------
    def layer_graph(self, layer_id: str) -> Graph:
        g = Graph(n.id for n in self.nodes.values() if n.layer == layer_id)
        for e in self.edges.values():
            if e.layer == layer_id:
                g.add_edge(e.id, e.source, e.target, e.weight)
        return g

    def supra_graph(self) -> Graph:
        """All layers plus dependency links as undirected edges (cross-layer importance)."""
        g = Graph(self.nodes)
        for e in self.edges.values():
            g.add_edge(e.id, e.source, e.target, e.weight)
        for d in self.deps.values():
            g.add_edge("dep:" + d.id, d.provider, d.dependent, 1.0)
        return g

    def dependency_adj(self) -> Dict[str, List[str]]:
        """Directed provider -> dependent adjacency."""
        adj: Dict[str, List[str]] = {n: [] for n in self.nodes}
        for d in self.deps.values():
            adj[d.provider].append(d.dependent)
        return adj

    def clone(self) -> "GraphStore":
        return copy.deepcopy(self)

    def to_dict(self) -> dict:
        return {
            "layers": [vars(l) for l in self.layers.values()],
            "nodes": [n.to_dict() for n in self.nodes.values()],
            "edges": [e.to_dict() for e in self.edges.values()],
            "dependencies": [d.to_dict() for d in self.deps.values()],
        }
