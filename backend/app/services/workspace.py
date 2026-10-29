"""Application service: holds the active graph, events and simulations. The API layer only calls this."""
from __future__ import annotations

from typing import Dict, List, Optional

from ..core.errors import NotFoundError, ValidationError
from ..data.seed import build_scenarios
from ..models.domain import Dependency, Edge, Event, Layer, Node
from ..utils.ids import new_id
from . import analytics
from .graph_store import GraphStore
from .recommendations import build_recommendations
from .simulation import simulate


class Workspace:
    def __init__(self, default_scenario: str = "road-blockage") -> None:
        self.scenarios = {s.id: s for s in build_scenarios()}
        self.store = GraphStore()
        self.events: Dict[str, Event] = {}
        self.latest: Optional[dict] = None
        self._recs: Optional[dict] = None
        self._counter = 0
        self.scenario_id = ""
        self.load_scenario(default_scenario)

    # ---- scenarios -----------------------------------------------------
    def list_scenarios(self) -> List[dict]:
        return [{"id": s.id, "name": s.name, "description": s.description, "nodes": len(s.nodes),
                 "edges": len(s.edges), "dependencies": len(s.dependencies), "events": [e.to_dict() for e in s.events]}
                for s in self.scenarios.values()]

    def load_scenario(self, scenario_id: str) -> dict:
        s = self.scenarios.get(scenario_id)
        if s is None:
            raise NotFoundError(f"Scenario '{scenario_id}' not found")
        store = GraphStore()
        for l in s.layers:
            store.add_layer(Layer(**vars(l)))
        for n in s.nodes:
            store.add_node(Node(**n.to_dict()))
        for e in s.edges:
            store.add_edge(Edge(**e.to_dict()))
        for d in s.dependencies:
            store.add_dependency(Dependency(**d.to_dict()))
        self.store, self.scenario_id = store, scenario_id
        self.events = {e.id: Event(**e.to_dict()) for e in s.events}
        self.latest = self._recs = None
        return self.graph_state()

    # ---- structure editing ----------------------------------------------
    def _changed(self) -> None:
        self.latest = self._recs = None

    def layers(self) -> List[dict]:
        return [vars(l) for l in self.store.layers.values()]

    def create_layer(self, data: dict) -> dict:
        layer = self.store.add_layer(Layer(**data))
        self._changed()
        return vars(layer)

    def add_node(self, data: dict) -> dict:
        data = {**data, "id": data.get("id") or new_id(data["layer"] + "-n")}
        node = self.store.add_node(Node(**data))
        self._changed()
        return node.to_dict()

    def remove_node(self, node_id: str) -> None:
        self.store.remove_node(node_id)
        self._changed()

    def add_edge(self, data: dict) -> dict:
        data = {**data, "id": data.get("id") or f"{data['source']}-{data['target']}", "layer": ""}
        edge = self.store.add_edge(Edge(**data))
        self._changed()
        return edge.to_dict()

    def remove_edge(self, edge_id: str) -> None:
        self.store.remove_edge(edge_id)
        self._changed()

    def add_dependency(self, data: dict) -> dict:
        data = {**data, "id": data.get("id") or f"d-{data['provider']}-{data['dependent']}-{data.get('kind', 'service')}"}
        dep = self.store.add_dependency(Dependency(**data))
        self._changed()
        return dep.to_dict()

    def remove_dependency(self, dep_id: str) -> None:
        self.store.remove_dependency(dep_id)
        self._changed()

    # ---- events and simulation -------------------------------------------
    def inject_event(self, data: dict) -> dict:
        ev = Event(**{**data, "id": data.get("id") or new_id("ev")})
        from .simulation import resolve_event
        resolve_event(self.store, ev)  # validate immediately
        self.events[ev.id] = ev
        return ev.to_dict()

    def run_simulation(self, event_id: Optional[str] = None, event: Optional[dict] = None,
                       mitigations: Optional[List[dict]] = None) -> dict:
        if event is not None:
            ev = Event(**{**event, "id": event.get("id") or new_id("ev")})
        elif event_id:
            ev = self.events.get(event_id)
            if ev is None:
                raise NotFoundError(f"Event '{event_id}' not found")
        else:
            raise ValidationError("Provide event_id or an inline event")
        self._counter += 1
        result = simulate(self.store, ev, mitigations or [])
        result["id"] = f"sim-{self._counter}"
        self.events[ev.id] = ev
        self.latest, self._recs = result, None
        return result

    def _require_latest(self) -> dict:
        if self.latest is None:
            raise ValidationError("Run a simulation first")
        return self.latest

    def recommendations(self) -> dict:
        latest = self._require_latest()
        if self._recs is None:
            base_event = Event(**latest["event"])
            baseline = simulate(self.store, base_event) if latest["mitigations"] else latest
            self._recs = build_recommendations(self.store, base_event, baseline)
        return self._recs

    def apply_mitigations(self, mitigations: List[dict]) -> dict:
        latest = self._require_latest()
        ev = Event(**latest["event"])
        before = simulate(self.store, ev)
        after = self.run_simulation(event=latest["event"], mitigations=mitigations)
        resolved = [n for n, s in before["nodes"].items() if s["status"] != "safe" and after["nodes"][n]["status"] == "safe"]
        return {"before_risk": before["risk"]["score"], "after_risk": after["risk"]["score"],
                "resolved_nodes": resolved, "simulation": after}

    # ---- views --------------------------------------------------------------
    def graph_state(self) -> dict:
        return {"scenario": self.scenario_id, **self.store.to_dict(),
                "events": [e.to_dict() for e in self.events.values()],
                "structure": analytics.structure_summary(self.store)}

    def analytics(self) -> dict:
        out = {"structure": analytics.structure_summary(self.store), "simulation": None}
        if self.latest is not None:
            out["simulation"] = {"id": self.latest["id"], "risk": self.latest["risk"], "counts": self.latest["counts"],
                                 "layers": self.latest["layers"], "waves": self.latest["waves"],
                                 "cascade": analytics.cascade_summary(self.store, self.latest)}
        return out

    def vulnerability(self) -> dict:
        return analytics.vulnerability_screening(self.store)

    def reset(self) -> dict:
        return self.load_scenario(self.scenario_id)
