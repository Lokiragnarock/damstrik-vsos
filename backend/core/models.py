from enum import Enum
from typing import Optional
from datetime import datetime
from pydantic import BaseModel

class AssetType(str, Enum):
    PCR = "PCR"
    DRONE = "DRONE"
    AMBULANCE = "AMBULANCE"
    FIRE_TRUCK = "FIRE_TRUCK"

class AssetStatus(str, Enum):
    IDLE = "IDLE"
    BUSY = "BUSY"
    OFF_DUTY = "OFF_DUTY"

class EventType(str, Enum):
    THEFT = "THEFT"
    ACCIDENT = "ACCIDENT"
    FIRE = "FIRE"
    RIOT = "RIOT"
    MEDICAL = "MEDICAL"

class EventStatus(str, Enum):
    ACTIVE = "ACTIVE"
    RESOLVED = "RESOLVED"
    PENDING = "PENDING"

class Location(BaseModel):
    lat: float
    lng: float

class Asset(BaseModel):
    asset_id: str
    type: AssetType
    location: Location
    status: AssetStatus
    fatigue_level: float = 0.0
    last_ping: datetime = datetime.now()
    # Audit Fields
    shift_start: datetime = datetime.now()
    time_worked_minutes: float = 0.0
    current_node: Optional[str] = None # For Graph Movement
    target_node: Optional[str] = None
    current_path: Optional[list[str]] = [] # Path to follow (list of Nodes)
    current_segment_waypoints: Optional[list[Location]] = [] # Waypoints to next node

class Event(BaseModel):
    event_id: str
    type: EventType
    severity: int
    location: Location
    status: EventStatus
    created_at: datetime = datetime.now()

class HexGrid(BaseModel):
    hex_id: str
    center: Location
    risk_score: float
    active_events: int = 0
