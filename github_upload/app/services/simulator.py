import asyncio
import random
import json
import math
from datetime import datetime
from typing import List, Dict
from fastapi.encoders import jsonable_encoder

from ..core.models import Asset, AssetType, AssetStatus, Event, EventType, EventStatus, Location
from ..core.utils import haversine_distance
from .routing import RoadNetwork

# Bangalore (Koramangala/Madiwala) approximate bounds
LAT_MIN, LAT_MAX = 12.9150, 12.9450
LNG_MIN, LNG_MAX = 77.6050, 77.6350

class Simulator:
    def __init__(self):
        self.road_network = RoadNetwork()
        self.assets: Dict[str, Asset] = self._init_assets()
        self.events: Dict[str, Event] = {}
        self.ingestion_log: List[Dict] = [] # [NEW] Log for "Truth Stream"
        self.running = True

    def _init_assets(self) -> Dict[str, Asset]:
        assets = {}
        node_names = list(self.road_network.nodes.keys())
        for i in range(5):
            # Spawn at random intersections
            start_node = random.choice(node_names)
            coords = self.road_network.nodes[start_node]
            
            assets[f"PCR-{i+1}"] = Asset(
                asset_id=f"PCR-{i+1}",
                type=AssetType.PCR,
                location=Location(lat=coords[0], lng=coords[1]),
                status=AssetStatus.IDLE
            )
            # Monkey-patching a "current_node" attribute for graph traversal
            assets[f"PCR-{i+1}"].current_node = start_node
            assets[f"PCR-{i+1}"].target_node = None
        return assets

    def _generate_event(self):
        if random.random() < 0.1:
            event_id = f"EVT-{int(datetime.now().timestamp())}-{random.randint(100,999)}"
            evt_type = random.choice(list(EventType))
            
            # Events also snap to nearest node for now (or stay random, but let's snap for clean movement)
            # Actually, let's keep events random, but assets move to nearest node of event
            lat = random.uniform(LAT_MIN, LAT_MAX)
            lng = random.uniform(LNG_MIN, LNG_MAX)
            
            self.events[event_id] = Event(
                event_id=event_id,
                type=evt_type,
                severity=random.randint(1, 10),
                location=Location(lat=lat, lng=lng),
                status=EventStatus.ACTIVE
            )
            
            # Log ingestion
            self.ingestion_log.append({
                "id": event_id,
                "timestamp": datetime.now().isoformat(),
                "source": "100-DIAL",
                "raw_data": f"Caller reported {evt_type} near {lat:.4f}, {lng:.4f}"
            })
            # Keep log size manageable
            if len(self.ingestion_log) > 50:
                self.ingestion_log.pop(0)

            print(f"Generated Event: {event_id} ({evt_type})")

    def _move_assets(self):
        for asset_id, asset in self.assets.items():
            # 1. Determine Target
            if asset.status == AssetStatus.IDLE:
                # Random patrol: Pick a random neighbor
                if not getattr(asset, 'target_node', None) or asset.current_node == asset.target_node:
                    neighbors = self.road_network.adj_list[asset.current_node]
                    asset.target_node = random.choice(neighbors)
            
            # 2. Move along graph
            if asset.target_node and asset.current_node != asset.target_node:
                # In a real physics engine, we'd interpolate. 
                # Here, we just "jump" to the next node or interpolate slowly?
                # Let's jump for now to prove graph logic, or interpolate 10%
                
                target_coords = self.road_network.nodes[asset.target_node]
                current_coords = (asset.location.lat, asset.location.lng)
                
                # Simple Linear Interpolation (Lerp)
                speed = 0.1 # 10% per tick
                new_lat = current_coords[0] + (target_coords[0] - current_coords[0]) * speed
                new_lng = current_coords[1] + (target_coords[1] - current_coords[1]) * speed
                
                asset.location.lat = new_lat
                asset.location.lng = new_lng
                
                # Check if arrived (close enough)
                dist = math.sqrt((new_lat - target_coords[0])**2 + (new_lng - target_coords[1])**2)
                if dist < 0.0005: # Approx 50m
                    asset.current_node = asset.target_node
                    # Snap exactly
                    asset.location.lat = target_coords[0]
                    asset.location.lng = target_coords[1]
            
            # 3. Update Stats (1 tick = 1 minute sim time for demo speed)
            asset.time_worked_minutes += 1.0
            if asset.status != AssetStatus.OFF_DUTY:
                asset.fatigue_level = min(1.0, asset.fatigue_level + 0.001)

    async def run_loop(self, manager):
        print("Simulation Loop Started")
        while self.running:
            self._generate_event()
            self._move_assets()
            
            # Prepare state update
            from fastapi.encoders import jsonable_encoder
            
            # Heatmap Data: List of [lat, lng, intensity]
            # For now, just use active events as high intensity points
            heatmap_data = []
            for evt in self.events.values():
                heatmap_data.append([evt.location.lat, evt.location.lng, evt.severity / 10.0]) # Normalize severity
            
            # Also add some static "historical" hotspots for demo effect
            # e.g., Sony World Signal is always busy
            hotspot = self.road_network.nodes["SONY_WORLD"]
            heatmap_data.append([hotspot[0], hotspot[1], 0.5])

            state = {
                "timestamp": datetime.now().isoformat(),
                "assets": jsonable_encoder([a for a in self.assets.values()]),
                "events": jsonable_encoder([e for e in self.events.values()]),
                "logs": self.ingestion_log,
                "heatmap": heatmap_data,
                "road_network": { # Send graph once (or every time, it's small) for drawing
                    "nodes": self.road_network.nodes,
                    "edges": self.road_network.adj_list # Simplified adjacency
                }
            }
            
            await manager.broadcast(json.dumps(state))
            await asyncio.sleep(1) 

