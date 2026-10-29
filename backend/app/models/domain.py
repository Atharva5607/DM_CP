"""Plain dataclasses describing the multi-layer graph. No framework imports."""
from __future__ import annotations

from dataclasses import asdict, dataclass, field
from typing import Any, Dict, List, Optional

EVENT_TYPES = {
    "road_block": "Road blockage",
    "power_failure": "Power failure",
    "tower_outage": "Tower outage",
    "flood": "Flood",
    "hospital_overload": "Hospital overload",
    "node_failure": "Generic node failure",
}


@dataclass
class Layer:
    id: str
    name: str
    color: str = "#7c8cff"
    description: str = ""


@dataclass
class Node:
    id: str
    layer: str
    label: str
    type: str = "generic"
    criticality: float = 5.0          # 1 (minor) .. 10 (life-critical)
    capacity: Optional[float] = None
    zone: Optional[str] = None        # geographic zone used by flood events
    is_source: bool = False           # feeds its layer (grid intake, core hub, control centre)
    anchor: Optional[str] = None      # id of the traffic node where this entity physically sits
    repair_minutes: float = 60.0
    x: float = 0.0
    y: float = 0.0

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class Edge:
    id: str
    layer: str
    source: str
    target: str
    weight: float = 1.0
    label: str = ""
    repair_minutes: float = 90.0

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class Dependency:
    """`dependent` relies on `provider`. Providers sharing a `group` are redundant alternatives."""
    id: str
    provider: str
    dependent: str
    kind: str = "service"      # power | access | comm | service | command | control ...
    strength: float = 0.5      # fraction of the dependent's function lost if the group fails completely
    delay_min: float = 0.0     # minutes before the loss is felt (batteries, buffers)
    group: str = ""            # redundancy group; defaults to `kind`

    def __post_init__(self) -> None:
        if not self.group:
            self.group = self.kind

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class Event:
    id: str
    type: str
    name: str = ""
    target_nodes: List[str] = field(default_factory=list)
    target_edges: List[str] = field(default_factory=list)
    zone: Optional[str] = None
    severity: float = 1.0

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class Scenario:
    id: str
    name: str
    description: str
    layers: List[Layer]
    nodes: List[Node]
    edges: List[Edge]
    dependencies: List[Dependency]
    events: List[Event]
