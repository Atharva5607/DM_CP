"""Seed data: the 'Metro City' infrastructure model and the demo scenarios built on it."""
from __future__ import annotations

from typing import Dict, List

from ..models.domain import Dependency, Edge, Event, Layer, Node, Scenario

LAYERS = [
    Layer("traffic", "Traffic", "#e8b86d", "Road junctions and the roads between them (edge weight = minutes)."),
    Layer("hospital", "Healthcare", "#ef8f9f", "Hospitals, wings and medical supply points."),
    Layer("power", "Power", "#efd88a", "Grid intake, substations and distribution hubs."),
    Layer("comm", "Communication", "#7cc4e0", "Core network hub, cell towers and emergency radio."),
    Layer("emergency", "Emergency Response", "#b9a6ef", "Control centre and field units."),
]

# (id, layer, label, type, criticality, zone, is_source, anchor, repair_min, x, y)
_N = [
    ("T1", "traffic", "Central Junction", "junction", 7, "central", False, None, 90, 430, 70),
    ("T2", "traffic", "North Gate", "junction", 5, "north", False, None, 90, 250, 10),
    ("T3", "traffic", "Riverside Bridge", "bridge", 8, "riverside", False, None, 240, 140, 60),
    ("T4", "traffic", "Market Square", "junction", 6, "central", False, None, 90, 540, 100),
    ("T5", "traffic", "Hospital Road", "junction", 8, "riverside", False, None, 120, 40, 110),
    ("T6", "traffic", "Highway Ramp", "junction", 7, "east", False, None, 120, 700, 60),
    ("T7", "traffic", "East End", "junction", 6, "east", False, None, 90, 850, 20),
    ("T8", "traffic", "Civic Centre", "junction", 6, "central", False, None, 90, 330, 100),
    ("T9", "traffic", "Tech Park", "junction", 4, "east", False, None, 90, 920, 110),
    ("T10", "traffic", "Airport Road", "junction", 4, "east", False, None, 90, 700, 130),
    ("H1", "hospital", "St. Mary General", "hospital", 10, "riverside", False, "T5", 180, 60, 40),
    ("H2", "hospital", "Eastside Medical", "hospital", 9, "east", False, "T7", 180, 850, 50),
    ("H3", "hospital", "St. Mary ICU Wing", "department", 9, "riverside", False, "T5", 120, 170, 100),
    ("H4", "hospital", "Central Blood Bank", "supply", 7, "central", False, "T4", 90, 520, 70),
    ("H5", "hospital", "Pharmacy Depot", "supply", 5, "east", False, "T6", 90, 700, 100),
    ("P1", "power", "Grid Intake Station", "intake", 10, "north", True, None, 480, 300, 20),
    ("P2", "power", "Central Substation", "substation", 9, "riverside", False, None, 360, 140, 90),
    ("P3", "power", "North Substation", "substation", 7, "north", False, None, 300, 430, 20),
    ("P4", "power", "East Substation", "substation", 8, "east", False, None, 300, 800, 70),
    ("P5", "power", "Signal Power Hub", "hub", 5, "central", False, None, 120, 330, 120),
    ("C4", "comm", "Core Network Hub", "core", 10, "central", True, None, 300, 400, 20),
    ("C1", "comm", "North Tower", "tower", 6, "north", False, None, 150, 200, 70),
    ("C2", "comm", "Central Tower", "tower", 8, "central", False, None, 150, 480, 70),
    ("C3", "comm", "East Tower", "tower", 6, "east", False, None, 150, 800, 40),
    ("C5", "comm", "Emergency Radio Repeater", "repeater", 8, "central", False, None, 90, 620, 110),
    ("E1", "emergency", "Emergency Control Centre", "control", 10, "central", True, "T8", 240, 400, 20),
    ("E2", "emergency", "Ambulance Unit A", "ambulance", 8, "central", False, "T1", 30, 430, 100),
    ("E3", "emergency", "Ambulance Unit B", "ambulance", 8, "central", False, "T4", 30, 560, 80),
    ("E4", "emergency", "Ambulance Unit C", "ambulance", 8, "east", False, "T7", 30, 850, 90),
    ("E5", "emergency", "Fire & Rescue Station", "fire", 8, "east", False, "T6", 60, 700, 40),
    ("E6", "emergency", "Police Dispatch", "police", 6, "central", False, "T8", 60, 260, 90),
]

# (layer, a, b, weight)
_E = [
    ("traffic", "T1", "T2", 4), ("traffic", "T1", "T4", 3), ("traffic", "T1", "T8", 2),
    ("traffic", "T2", "T3", 5), ("traffic", "T3", "T5", 4), ("traffic", "T4", "T5", 6),
    ("traffic", "T4", "T6", 5), ("traffic", "T6", "T7", 4), ("traffic", "T7", "T9", 3),
    ("traffic", "T6", "T9", 6), ("traffic", "T8", "T9", 7), ("traffic", "T6", "T10", 3),
    ("hospital", "H1", "H3", 1), ("hospital", "H1", "H4", 2), ("hospital", "H2", "H4", 6),
    ("hospital", "H2", "H5", 3), ("hospital", "H1", "H2", 12), ("hospital", "H4", "H5", 4),
    ("power", "P1", "P2", 1), ("power", "P1", "P3", 1), ("power", "P2", "P4", 2),
    ("power", "P3", "P4", 2), ("power", "P2", "P5", 1),
    ("comm", "C4", "C1", 1), ("comm", "C4", "C2", 1), ("comm", "C4", "C3", 1),
    ("comm", "C1", "C2", 2), ("comm", "C2", "C3", 2), ("comm", "C2", "C5", 1), ("comm", "C3", "C5", 2),
    ("emergency", "E1", "E2", 2), ("emergency", "E1", "E3", 2), ("emergency", "E1", "E4", 3),
    ("emergency", "E1", "E5", 3), ("emergency", "E1", "E6", 2), ("emergency", "E2", "E3", 1),
    ("emergency", "E3", "E5", 3), ("emergency", "E4", "E5", 3),
]

# (provider, dependent, kind, strength, delay_min)
_D = [
    ("P2", "H1", "power", 0.9, 10), ("P2", "H3", "power", 0.95, 20), ("P2", "H4", "power", 0.8, 30),
    ("P4", "H2", "power", 0.9, 10), ("P4", "H5", "power", 0.5, 30),
    ("P3", "C1", "power", 0.9, 5), ("P2", "C2", "power", 0.9, 15), ("P4", "C3", "power", 0.9, 15),
    ("P1", "C4", "power", 0.7, 30), ("P2", "C5", "power", 0.5, 45),
    ("P5", "T1", "power", 0.5, 5), ("P5", "T4", "power", 0.5, 5), ("P5", "T8", "power", 0.4, 5),
    ("P2", "E1", "power", 0.8, 20),
    ("C1", "P3", "control", 0.3, 0),
    ("C2", "E1", "comm", 0.7, 0), ("C5", "E1", "comm", 0.7, 0),
    ("C2", "E2", "comm", 0.5, 0), ("C2", "E3", "comm", 0.5, 0), ("C3", "E4", "comm", 0.5, 0),
    ("C3", "E5", "comm", 0.5, 0), ("C2", "E6", "comm", 0.4, 0),
    ("C2", "H1", "comm", 0.3, 0), ("C3", "H2", "comm", 0.3, 0),
    ("T5", "H1", "access", 0.85, 0), ("T7", "H2", "access", 0.7, 0),
    ("T4", "H4", "access", 0.6, 0), ("T6", "H5", "access", 0.5, 0),
    ("T1", "E2", "access", 0.8, 0), ("T4", "E3", "access", 0.8, 0), ("T7", "E4", "access", 0.8, 0),
    ("T6", "E5", "access", 0.8, 0), ("T8", "E6", "access", 0.6, 0),
    ("H1", "E2", "service", 0.35, 0), ("H1", "E3", "service", 0.35, 0), ("H2", "E4", "service", 0.35, 0),
    ("H1", "H3", "facility", 0.8, 0),
    ("E1", "E2", "command", 0.5, 0), ("E1", "E3", "command", 0.5, 0), ("E1", "E4", "command", 0.5, 0),
    ("E1", "E5", "command", 0.5, 0), ("E1", "E6", "command", 0.5, 0),
]


def _metro_parts():
    nodes = [Node(id=i, layer=l, label=lab, type=t, criticality=c, zone=z, is_source=s, anchor=a,
                  repair_minutes=r, x=x, y=y) for i, l, lab, t, c, z, s, a, r, x, y in _N]
    capacity = {"H1": 120, "H2": 80, "H3": 24, "H4": 40, "H5": 60}
    for n in nodes:
        n.capacity = capacity.get(n.id)
    edges = [Edge(id=f"{a}-{b}", layer=l, source=a, target=b, weight=w) for l, a, b, w in _E]
    deps = [Dependency(id=f"d-{p}-{d}-{k}", provider=p, dependent=d, kind=k, strength=s, delay_min=dl)
            for p, d, k, s, dl in _D]
    return nodes, edges, deps


_EVENTS: Dict[str, Event] = {
    "road-blockage": Event("ev-road", "road_block", "Riverside access cut-off",
                           target_edges=["T3-T5", "T4-T5"], severity=1.0),
    "power-outage": Event("ev-power", "power_failure", "Central Substation failure",
                          target_nodes=["P2"], severity=1.0),
    "flood": Event("ev-flood", "flood", "Riverside flood", zone="riverside", severity=0.9),
    "comm-failure": Event("ev-comm", "tower_outage", "Central tower and radio repeater outage",
                          target_nodes=["C2", "C5"], severity=1.0),
}

_META = {
    "road-blockage": ("Road blockage", "Two roads into Hospital Road are blocked. Watch the hospital lose access and the ambulances lose their primary destination."),
    "power-outage": ("Power outage", "The Central Substation fails. Hospitals, towers, traffic signals and the control centre degrade in waves."),
    "flood": ("Riverside flood", "A flood takes out the bridge, hospital road, St. Mary hospital and the central substation at once."),
    "comm-failure": ("Communication failure", "Central tower and radio repeater go down, so the control centre loses coordination of every field unit."),
}


def build_scenarios() -> List[Scenario]:
    out = []
    for sid, (name, desc) in _META.items():
        nodes, edges, deps = _metro_parts()
        out.append(Scenario(sid, name, desc, list(LAYERS), nodes, edges, deps, [_EVENTS[sid]]))
    out.append(Scenario("blank", "Blank canvas",
                        "Five empty layers. Add your own nodes, edges and dependencies in the scenario builder.",
                        list(LAYERS), [], [], [], []))
    return out
