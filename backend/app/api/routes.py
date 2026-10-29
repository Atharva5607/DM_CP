from fastapi import APIRouter

from ..core.state import lock, workspace as ws
from . import schemas as s

router = APIRouter(prefix="/api")


def _dump(model) -> dict:
    return model.model_dump()


def _mitigations(items) -> list:
    return [m.model_dump(exclude_none=True) for m in items]


@router.get("/health", tags=["system"])
def health():
    with lock:
        return {"status": "ok", "scenario": ws.scenario_id, "nodes": len(ws.store.nodes)}


@router.get("/scenarios", tags=["scenarios"])
def list_scenarios():
    with lock:
        return ws.list_scenarios()


@router.post("/scenarios/{scenario_id}/load", tags=["scenarios"])
def load_scenario(scenario_id: str):
    with lock:
        return ws.load_scenario(scenario_id)


@router.post("/reset", tags=["scenarios"])
def reset():
    with lock:
        return ws.reset()


@router.get("/layers", tags=["graph"])
def get_layers():
    with lock:
        return ws.layers()


@router.post("/layers", status_code=201, tags=["graph"])
def create_layer(body: s.LayerIn):
    with lock:
        return ws.create_layer(_dump(body))


@router.get("/graph", tags=["graph"])
def graph_state():
    with lock:
        return ws.graph_state()


@router.post("/nodes", status_code=201, tags=["graph"])
def add_node(body: s.NodeIn):
    with lock:
        return ws.add_node(_dump(body))


@router.delete("/nodes/{node_id}", status_code=204, tags=["graph"])
def remove_node(node_id: str):
    with lock:
        ws.remove_node(node_id)


@router.post("/edges", status_code=201, tags=["graph"])
def add_edge(body: s.EdgeIn):
    with lock:
        return ws.add_edge(_dump(body))


@router.delete("/edges/{edge_id}", status_code=204, tags=["graph"])
def remove_edge(edge_id: str):
    with lock:
        ws.remove_edge(edge_id)


@router.post("/dependencies", status_code=201, tags=["graph"])
def add_dependency(body: s.DependencyIn):
    with lock:
        return ws.add_dependency(_dump(body))


@router.delete("/dependencies/{dep_id}", status_code=204, tags=["graph"])
def remove_dependency(dep_id: str):
    with lock:
        ws.remove_dependency(dep_id)


@router.post("/events", status_code=201, tags=["simulation"])
def inject_event(body: s.EventIn):
    with lock:
        return ws.inject_event(_dump(body))


@router.post("/simulations", tags=["simulation"])
def run_simulation(body: s.SimulationIn):
    with lock:
        event = _dump(body.event) if body.event else None
        return ws.run_simulation(body.event_id, event, _mitigations(body.mitigations))


@router.get("/simulations/latest", tags=["simulation"])
def latest_simulation():
    with lock:
        return ws.latest


@router.post("/simulations/mitigate", tags=["simulation"])
def mitigate(body: s.MitigateIn):
    with lock:
        return ws.apply_mitigations(_mitigations(body.mitigations))


@router.get("/recommendations", tags=["analysis"])
def recommendations():
    with lock:
        return ws.recommendations()


@router.get("/analytics/summary", tags=["analysis"])
def analytics_summary():
    with lock:
        return ws.analytics()


@router.get("/analytics/vulnerability", tags=["analysis"])
def vulnerability():
    with lock:
        return ws.vulnerability()
