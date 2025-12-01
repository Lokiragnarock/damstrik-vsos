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
    "Indiranagar100ft": (12.9600, 77.6400), # x: 90, y: 10
    "WiproPark": (12.9320, 77.6300),        # Near Sony Signal
    "Koramangala80ft": (12.9400, 77.6200),  # Connecting Sony Signal and Forum
    "JyotiNivas": (12.9330, 77.6150),       # Near 5th Block
    "CheckPost": (12.9250, 77.6250)         # Near StJohns
}

# Adjacency List (Road Connections)
# Format: (Node A, Node B)
EDGES = [
    ("SonySignal", "StJohns"),
    ("SonySignal", "Indiranagar100ft"),
    ("SonySignal", "Koramangala80ft"),
    ("SonySignal", "WiproPark"),
    ("ChristUniv", "StJohns"),
    ("ChristUniv", "DairyCircle"),
    ("ChristUniv", "BTMJunction"),
    ("MadiwalaMkt", "StJohns"),
    ("MadiwalaMkt", "BTMJunction"),
    ("MadiwalaMkt", "CheckPost"),
    ("Koramangala5th", "StJohns"),
    ("Koramangala5th", "ForumMall"),
    ("Koramangala5th", "JyotiNivas"),
    ("ForumMall", "Koramangala80ft"),
    ("DairyCircle", "ForumMall"),
    ("StJohns", "Indiranagar100ft"), # Ring Road connection
    ("StJohns", "CheckPost"),
    ("CheckPost", "WiproPark"),
    ("JyotiNivas", "Koramangala5th"),
    ("JyotiNivas", "ForumMall")
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

    def get_path(self, start_node: str, target_node: str) -> List[str]:
        """A* Pathfinding to find the shortest path between nodes."""
        if start_node == target_node:
            return [start_node]
        
        if start_node not in self.nodes or target_node not in self.nodes:
            return []

        # Priority queue for A* (f_score, current_node)
        open_set = {start_node}
        came_from = {}
        
        g_score = {node: float('inf') for node in self.nodes}
        g_score[start_node] = 0
        
        f_score = {node: float('inf') for node in self.nodes}
        f_score[start_node] = self._heuristic(start_node, target_node)
        
        while open_set:
            # Get node in open_set with lowest f_score
            current = min(open_set, key=lambda n: f_score[n])
            
            if current == target_node:
                return self._reconstruct_path(came_from, current)
            
            open_set.remove(current)
            
            for neighbor in self.adj_list.get(current, []):
                # Distance between neighbors is the edge weight (Euclidean distance)
                dist = self._heuristic(current, neighbor)
                tentative_g_score = g_score[current] + dist
                
                if tentative_g_score < g_score[neighbor]:
                    came_from[neighbor] = current
                    g_score[neighbor] = tentative_g_score
                    f_score[neighbor] = g_score[neighbor] + self._heuristic(neighbor, target_node)
                    if neighbor not in open_set:
                        open_set.add(neighbor)
                        
        return [] # No path found

    def _heuristic(self, node_a: str, node_b: str) -> float:
        """Euclidean distance heuristic."""
        coords_a = self.nodes[node_a]
        coords_b = self.nodes[node_b]
        return math.sqrt((coords_a[0] - coords_b[0])**2 + (coords_a[1] - coords_b[1])**2)

    def _reconstruct_path(self, came_from: Dict[str, str], current: str) -> List[str]:
        total_path = [current]
        while current in came_from:
            current = came_from[current]
            total_path.append(current)
        return total_path[::-1]

    def get_next_step(self, current_node: str, target_node: str) -> str:
        """Wrapper for get_path to maintain compatibility if needed, but returns next immediate node."""
        path = self.get_path(current_node, target_node)
        if len(path) > 1:
            return path[1]
        return current_node
