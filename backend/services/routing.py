import math
from typing import List, Tuple, Dict, Set
from ..core.models import Location

# --- BANGALORE (KORAMANGALA/MADIWALA) SECTOR GRAPH ---
# Coordinates mapped to major intersections.
# These match the visual "metro lines" from the frontend map.

NODES = {
    "SonySignal": (12.9450, 77.6250),       # x: 70, y: 20
    "ChristUniv": (12.9360, 77.6050),       # x: 48, y: 62
    "MadiwalaMkt": (12.9220, 77.6180),      # x: 80, y: 80
    "Koramangala5th": (12.9340, 77.6200),   # x: 25, y: 35
    "ForumMall": (12.9350, 77.6100),        # x: 10, y: 10
    "StJohns": (12.9300, 77.6200),          # x: 60, y: 50 (Central Hub)
    "DairyCircle": (12.9380, 77.6000),      # x: 10, y: 60
    "BTMJunction": (12.9150, 77.6100),      # x: 50, y: 90
    "Indiranagar100ft": (12.9600, 77.6400)  # x: 90, y: 10
}

# Adjacency List (Road Connections)
# Format: (Node A, Node B)
EDGES = [
    ("SonySignal", "StJohns"),
    ("SonySignal", "Indiranagar100ft"),
    ("ChristUniv", "StJohns"),
    ("ChristUniv", "DairyCircle"),
    ("ChristUniv", "BTMJunction"),
    ("MadiwalaMkt", "StJohns"),
    ("MadiwalaMkt", "BTMJunction"),
    ("Koramangala5th", "StJohns"),
    ("Koramangala5th", "ForumMall"),
    ("DairyCircle", "ForumMall"),
    ("StJohns", "Indiranagar100ft") # Ring Road connection
]

class RoadNetwork:
    def __init__(self):
        self.nodes = NODES
        self.adj_list = self._build_adj_list()

    def _build_adj_list(self) -> Dict[str, List[str]]:
        adj = {node: [] for node in self.nodes}
        for u, v in EDGES:
            if u in adj and v in adj:
                adj[u].append(v)
                adj[v].append(u)
        return adj

    def get_nearest_node(self, location: Location) -> str:
        """Find the nearest graph node to a given coordinate."""
        min_dist = float('inf')
        nearest = None
        for name, coords in self.nodes.items():
            dist = math.sqrt((location.lat - coords[0])**2 + (location.lng - coords[1])**2)
            if dist < min_dist:
                min_dist = dist
                nearest = name
        return nearest

    def get_next_step(self, current_node: str, target_node: str) -> str:
        """BFS to find the next node to move to towards target."""
        if current_node == target_node:
            return current_node
        
        if current_node not in self.adj_list or target_node not in self.adj_list:
            return current_node # Safety fallback

        queue = [(current_node, [current_node])]
        visited = set()
        
        while queue:
            node, path = queue.pop(0)
            if node == target_node:
                return path[1] if len(path) > 1 else path[0]
            
            if node not in visited:
                visited.add(node)
                for neighbor in self.adj_list[node]:
                    queue.append((neighbor, path + [neighbor]))
        
        return current_node # No path found
