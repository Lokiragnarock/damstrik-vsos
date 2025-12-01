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
