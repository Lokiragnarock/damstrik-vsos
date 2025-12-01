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
            
            # Pick a random node from the road network for the event location
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
            
            # Dispatch logic: Find nearest idle asset
            nearest_asset = None
            min_dist = float('inf')
            
            for asset in self.assets.values():
                if asset.status == AssetStatus.IDLE:
                    dist = haversine_distance((asset.location.lat, asset.location.lng), coords)
                    if dist < min_dist:
                        min_dist = dist
                        nearest_asset = asset
            
            if nearest_asset:
                nearest_asset.status = AssetStatus.BUSY
                nearest_asset.target_node = event_node
                # Calculate path immediately
                nearest_asset.current_path = self.road_network.get_path(nearest_asset.current_node, event_node)
                # Remove start node from path as we are already there (or close enough)
                if nearest_asset.current_path and nearest_asset.current_path[0] == nearest_asset.current_node:
                    nearest_asset.current_path.pop(0)
                print(f"Dispatched {nearest_asset.asset_id} to {event_id} at {event_node}")

            self.ingestion_log.append({
                "id": event_id,
                "timestamp": datetime.now().isoformat(),
                "source": "SAT-UPLINK",
                "raw_data": f"Anomaly: {evt_type} detected at {event_node}"
            })
            if len(self.ingestion_log) > 50:
                self.ingestion_log.pop(0)

            print(f"Generated Event: {event_id} ({evt_type}) at {event_node}")

    def _move_assets(self):
        for asset_id, asset in self.assets.items():
            # If idle and no target, wander randomly
            if asset.status == AssetStatus.IDLE:
                if not asset.target_node or asset.current_node == asset.target_node:
                    neighbors = self.road_network.adj_list.get(asset.current_node, [])
                    if neighbors:
                        asset.target_node = random.choice(neighbors)
                        asset.current_path = [asset.target_node] # Direct neighbor, path is just the node

            # Move along path
            if asset.current_path:
                # Check if we have waypoints to traverse first
                if not asset.current_segment_waypoints:
                    # We are at a node, looking at the next node in path
                    next_node = asset.current_path[0]
                    # Load waypoints between current_node and next_node
                    waypoints = self.road_network.get_edge_waypoints(asset.current_node, next_node)
                    if waypoints:
                        # Convert tuples to Location objects or just use tuples
                        # Let's use simple dicts or objects for consistency, but tuples are fine for internal logic
                        # We need to append the final destination (next_node) to the waypoints list
                        # so we visit waypoints -> next_node
                        asset.current_segment_waypoints = [Location(lat=wp[0], lng=wp[1]) for wp in waypoints]
                    
                    # Always append the actual node as the final "waypoint" of this segment
                    node_coords = self.road_network.nodes[next_node]
                    if not asset.current_segment_waypoints:
                         asset.current_segment_waypoints = []
                    asset.current_segment_waypoints.append(Location(lat=node_coords[0], lng=node_coords[1]))

                # Now move towards the first target in current_segment_waypoints
                if asset.current_segment_waypoints:
                    target = asset.current_segment_waypoints[0]
                    target_coords = (target.lat, target.lng)
                    current_coords = (asset.location.lat, asset.location.lng)
                    
                    # Constant speed movement (degrees per step)
                    speed = 0.0002 
                    
                    # Calculate direction vector
                    dx = target_coords[0] - current_coords[0]
                    dy = target_coords[1] - current_coords[1]
                    distance = math.sqrt(dx**2 + dy**2)
                    
                    if distance > 0:
                        # Normalize and scale by speed
                        move_x = (dx / distance) * speed
                        move_y = (dy / distance) * speed
                        
                        # Check if we overshoot
                        if distance <= speed:
                            # Reached the waypoint/node
                            asset.location.lat = target_coords[0]
                            asset.location.lng = target_coords[1]
                            asset.current_segment_waypoints.pop(0)
                            
                            # If we emptied the waypoints, it means we reached the next_node
                            if not asset.current_segment_waypoints:
                                asset.current_node = asset.current_path[0]
                                asset.current_path.pop(0)
                        else:
                            asset.location.lat += move_x
                            asset.location.lng += move_y
            
            asset.time_worked_minutes += 1.0
            if asset.status != AssetStatus.OFF_DUTY:
                asset.fatigue_level = max(0.0, asset.fatigue_level - 0.001)

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

