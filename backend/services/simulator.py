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

# Bangalore (Koramangala/Madiwala) Sector Bounds
LAT_MIN, LAT_MAX = 12.9100, 12.9600
LNG_MIN, LNG_MAX = 77.6000, 77.6500

class Simulator:
    def __init__(self):
        self.road_network = RoadNetwork()
        self.assets: Dict[str, Asset] = self._init_assets()
        self.events: Dict[str, Event] = {}
        self.ingestion_log: List[Dict] = []
        self.running = True

    def _init_assets(self) -> Dict[str, Asset]:
        assets = {}
        node_names = list(self.road_network.nodes.keys())
        for i in range(4):
            start_node = random.choice(node_names)
            coords = self.road_network.nodes[start_node]
            
            assets[f"DRONE-{i+1}"] = Asset(
                asset_id=f"DRONE-{i+1}",
                type=AssetType.DRONE,
                location=Location(lat=coords[0], lng=coords[1]),
                status=AssetStatus.IDLE
            )
            assets[f"DRONE-{i+1}"].current_node = start_node
            assets[f"DRONE-{i+1}"].target_node = None
        return assets

    def _generate_event(self):
        if random.random() < 0.15:
            event_id = f"EVT-{int(datetime.now().timestamp())}-{random.randint(100,999)}"
            evt_type = random.choice(list(EventType))
            
            lat = random.uniform(LAT_MIN, LAT_MAX)
            lng = random.uniform(LNG_MIN, LNG_MAX)
            
            self.events[event_id] = Event(
                event_id=event_id,
                type=evt_type,
                severity=random.randint(1, 10),
                location=Location(lat=lat, lng=lng),
                status=EventStatus.ACTIVE
            )
            
            self.ingestion_log.append({
                "id": event_id,
                "timestamp": datetime.now().isoformat(),
                "source": "SAT-UPLINK",
                "raw_data": f"Anomaly: {evt_type} detected at {lat:.4f}, {lng:.4f}"
            })
            if len(self.ingestion_log) > 50:
                self.ingestion_log.pop(0)

            print(f"Generated Event: {event_id} ({evt_type})")

    def _move_assets(self):
        for asset_id, asset in self.assets.items():
            if asset.status == AssetStatus.IDLE:
                if not getattr(asset, 'target_node', None) or asset.current_node == asset.target_node:
                    neighbors = self.road_network.adj_list.get(asset.current_node, [])
                    if neighbors:
                        asset.target_node = random.choice(neighbors)
            
            if asset.target_node and asset.current_node != asset.target_node:
                target_coords = self.road_network.nodes[asset.target_node]
                current_coords = (asset.location.lat, asset.location.lng)
                
                speed = 0.2 # Drones are faster
                new_lat = current_coords[0] + (target_coords[0] - current_coords[0]) * speed
                new_lng = current_coords[1] + (target_coords[1] - current_coords[1]) * speed
                
                asset.location.lat = new_lat
                asset.location.lng = new_lng
                
                dist = math.sqrt((new_lat - target_coords[0])**2 + (new_lng - target_coords[1])**2)
                if dist < 0.0005:
                    asset.current_node = asset.target_node
                    asset.location.lat = target_coords[0]
                    asset.location.lng = target_coords[1]
            
            asset.time_worked_minutes += 1.0
            if asset.status != AssetStatus.OFF_DUTY:
                asset.fatigue_level = max(0.0, asset.fatigue_level - 0.001) # Battery drain? logic reversed for fatigue

    async def run_loop(self, manager):
        print("Simulation Loop Started")
        while self.running:
            self._generate_event()
            self._move_assets()
            
            heatmap_data = []
            for evt in self.events.values():
                heatmap_data.append([evt.location.lat, evt.location.lng, evt.severity / 10.0])
            
            hotspot = self.road_network.nodes["StJohns"]
            heatmap_data.append([hotspot[0], hotspot[1], 0.8])

            state = {
                "timestamp": datetime.now().isoformat(),
                "assets": jsonable_encoder([a for a in self.assets.values()]),
                "events": jsonable_encoder([e for e in self.events.values()]),
                "logs": self.ingestion_log,
                "heatmap": heatmap_data,
                "road_network": {
                    "nodes": self.road_network.nodes,
                    "edges": self.road_network.adj_list
                }
            }
            
            await manager.broadcast(json.dumps(state))
            await asyncio.sleep(1) 

