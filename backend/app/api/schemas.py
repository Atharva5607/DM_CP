"""Pydantic request models. Validation lives here; business rules live in the services."""
from typing import List, Literal, Optional

from pydantic import BaseModel, Field

EventType = Literal["road_block", "power_failure", "tower_outage", "flood", "hospital_overload", "node_failure"]
MitigationType = Literal["backup_power", "restore_edge", "restore_node", "redirect"]


class LayerIn(BaseModel):
    id: str = Field(min_length=1, max_length=40)
    name: str = Field(min_length=1, max_length=80)
    color: str = "#7c8cff"
    description: str = ""


class NodeIn(BaseModel):
    id: Optional[str] = None
    layer: str
    label: str = Field(min_length=1, max_length=80)
    type: str = "generic"
    criticality: float = Field(5, ge=1, le=10)
    capacity: Optional[float] = Field(None, ge=0)
    zone: Optional[str] = None
    is_source: bool = False
    anchor: Optional[str] = None
    repair_minutes: float = Field(60, ge=0)
    x: float = 0
    y: float = 0


class EdgeIn(BaseModel):
    id: Optional[str] = None
    source: str
    target: str
    weight: float = Field(1, gt=0)
    label: str = ""
    repair_minutes: float = Field(90, ge=0)


class DependencyIn(BaseModel):
    id: Optional[str] = None
    provider: str
    dependent: str
    kind: str = "service"
    strength: float = Field(0.5, gt=0, le=1)
    delay_min: float = Field(0, ge=0)
    group: str = ""


class EventIn(BaseModel):
    id: Optional[str] = None
    type: EventType
    name: str = ""
    target_nodes: List[str] = Field(default_factory=list)
    target_edges: List[str] = Field(default_factory=list)
    zone: Optional[str] = None
    severity: float = Field(1.0, gt=0, le=1)


class MitigationIn(BaseModel):
    type: MitigationType
    node_id: Optional[str] = None
    edge_id: Optional[str] = None


class SimulationIn(BaseModel):
    event_id: Optional[str] = None
    event: Optional[EventIn] = None
    mitigations: List[MitigationIn] = Field(default_factory=list)


class MitigateIn(BaseModel):
    mitigations: List[MitigationIn]
