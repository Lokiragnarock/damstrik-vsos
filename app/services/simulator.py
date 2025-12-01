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
        self.ingestion_log: List[Dict] = []
        self.running = True

    def _init_assets(self) -> Dict[str, Asset]:
        assets = {}
        node_names = list(self.road_network.nodes.keys())
        # Increased to 15 assets
        for i in range(15):
            start_node = random.choice(node_names)
            coords = self.road_network.nodes[start_node]
            
            assets[f"PCR-{i+1}"] = Asset(
                asset_id=f"PCR-{i+1}",
                type=AssetType.PCR,
                location=Location(lat=coords[0], lng=coords[1]),
                status=AssetStatus.IDLE
            )
            assets[f"PCR-{i+1}"].current_node = start_node
            assets[f"PCR-{i+1}"].target_node = None
            assets[f"PCR-{i+1}"].path = [] # List of nodes to follow
        return assets

    def _generate_event(self):
        if random.random() < 0.05: # Slightly reduced frequency
            event_id = f"EVT-{int(datetime.now().timestamp())}-{random.randint(100,999)}"
            evt_type = random.choice(list(EventType))
            
            # Snap event to a random node for reachable dispatch
            node_names = list(self.road_network.nodes.keys())
            event_node = random.choice(node_names)
            coords = self.road_network.nodes[event_node]
            
            self.events[event_id] = Event(
                event_id=event_id,
                type=evt_type,
                severity=random.randint(1, 10),
                location=Location(lat=coords[0], lng=coords[1]),
                status=EventStatus.ACTIVE
            )
            self.events[event_id].node_id = event_node # Store node ID for routing
            
            self.ingestion_log.append({
                "id": event_id,
                "timestamp": datetime.now().isoformat(),
                "source": "100-DIAL",
                "raw_data": f"Caller reported {evt_type} at {event_node}"
            })
            if len(self.ingestion_log) > 50:
                self.ingestion_log.pop(0)

            print(f"Generated Event: {event_id} ({evt_type}) at {event_node}")

    def _assign_tasks(self):
        # Assign IDLE assets to ACTIVE unassigned events
        active_events = [e for e in self.events.values() if e.status == EventStatus.ACTIVE]
        idle_assets = [a for a in self.assets.values() if a.status == AssetStatus.IDLE]
        
        for event in active_events:
            # Check if already assigned (simple check: is any asset targeting this event?)
            is_assigned = any(a.target_event_id == event.event_id for a in self.assets.values() if hasattr(a, 'target_event_id'))
            if is_assigned:
                continue
                
            if not idle_assets:
                break
                
            # Find nearest asset
            best_asset = None
            min_dist = float('inf')
            
            for asset in idle_assets:
                dist = haversine_distance(asset.location, event.location)
                if dist < min_dist:
                    min_dist = dist
                    best_asset = asset
            
            if best_asset:
                best_asset.status = AssetStatus.DISPATCHED
                best_asset.target_event_id = event.event_id
                best_asset.target_node = event.node_id
                # Calculate path
                best_asset.path = self._calculate_path(best_asset.current_node, event.node_id)
                idle_assets.remove(best_asset)
                print(f"Dispatched {best_asset.asset_id} to {event.event_id}")

    def _calculate_path(self, start_node, end_node):
        # Simple BFS for pathfinding
        queue = [(start_node, [start_node])]
        visited = set()
        while queue:
            node, path = queue.pop(0)
            if node == end_node:
                return path[1:] # Return path excluding start
            if node not in visited:
                visited.add(node)
                for neighbor in self.road_network.adj_list.get(node, []):
                    queue.append((neighbor, path + [neighbor]))
        return []

    def _move_assets(self):
        SPEED = 0.00015 # Approx speed in degrees per tick
        
        for asset in self.assets.values():
            # Logic for IDLE patrolling
            if asset.status == AssetStatus.IDLE:
                if not asset.path:
                    # Pick random neighbor
                    neighbors = self.road_network.adj_list.get(asset.current_node, [])
                    if neighbors:
                        next_node = random.choice(neighbors)
                        asset.path = [next_node]
            
            # Logic for moving along path
            if asset.path:
                target_node = asset.path[0]
                target_coords = self.road_network.nodes[target_node]
                current_coords = (asset.location.lat, asset.location.lng)
                
                # Calculate distance to next node
                dist_to_node = math.sqrt((target_coords[0] - current_coords[0])**2 + (target_coords[1] - current_coords[1])**2)
                
                if dist_to_node < SPEED:
                    # Arrived at node
                    asset.location.lat = target_coords[0]
                    asset.location.lng = target_coords[1]
                    asset.current_node = target_node
                    asset.path.pop(0)
                    
                    # If arrived at event
                    if asset.status == AssetStatus.DISPATCHED and not asset.path:
                        asset.status = AssetStatus.BUSY
                        # Auto-resolve event after some time (simulated by just clearing status later)
                        # For now, just stay busy
                else:
                    # Move towards node
                    ratio = SPEED / dist_to_node
                    new_lat = current_coords[0] + (target_coords[0] - current_coords[0]) * ratio
                    new_lng = current_coords[1] + (target_coords[1] - current_coords[1]) * ratio
                    asset.location.lat = new_lat
                    asset.location.lng = new_lng

            # Fatigue
            asset.time_worked_minutes += 1.0
            if asset.status != AssetStatus.OFF_DUTY:
                asset.fatigue_level = min(1.0, asset.fatigue_level + 0.0005)

    async def run_loop(self, manager):
        print("Simulation Loop Started")
        while self.running:
            self._generate_event()
            self._assign_tasks()
            self._move_assets()
            
            # Heatmap Data
            heatmap_data = []
            for evt in self.events.values():
                heatmap_data.append([evt.location.lat, evt.location.lng, evt.severity / 10.0])
            
            hotspot = self.road_network.nodes["SONY_WORLD"]
            heatmap_data.append([hotspot[0], hotspot[1], 0.5])

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
            await asyncio.sleep(0.5) # Faster ticks for smoother movement 

