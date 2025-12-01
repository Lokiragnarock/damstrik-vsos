import math
from typing import List, Tuple, Dict, Set
from ..core.models import Location

# --- DHUBRI SECTOR GRAPH ---
# Coordinates approximated for key surveillance points.

NODES = {
    "DHUBRI_GHAT": (26.0207, 89.9743),
    "GAURIPUR_JUNCTION": (26.0500, 89.9800),
    "RIVER_BANK_NORTH": (26.0300, 89.9600),
    "RIVER_BANK_SOUTH": (26.0100, 89.9600),
    "BORDER_POST_1": (26.0800, 89.9200),
    "BORDER_POST_2": (26.0600, 89.9300),
    "BASE_STATION": (26.0400, 89.9700),
}

# Adjacency List (Flight Paths / Roads)
# Format: (Node A, Node B)
EDGES = [
    ("BASE_STATION", "DHUBRI_GHAT"),
    ("BASE_STATION", "GAURIPUR_JUNCTION"),
    ("BASE_STATION", "RIVER_BANK_NORTH"),
    ("RIVER_BANK_NORTH", "RIVER_BANK_SOUTH"),
    ("RIVER_BANK_NORTH", "BORDER_POST_2"),
    ("BORDER_POST_2", "BORDER_POST_1"),
    ("GAURIPUR_JUNCTION", "BORDER_POST_1"),
    ("DHUBRI_GHAT", "RIVER_BANK_SOUTH"),
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
