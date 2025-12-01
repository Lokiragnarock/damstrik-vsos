import math
from typing import List, Tuple, Dict
from ..core.models import Location

# Koramangala & Madiwala Nodes
NODES = {
    "SONY_WORLD": (12.9360, 77.6270),
    "FORUM_MALL": (12.9340, 77.6110),
    "MADIWALA_CHECKPOST": (12.9220, 77.6210),
    "ST_JOHNS_HOSPITAL": (12.9280, 77.6230),
    "KORAMANGALA_PS": (12.9380, 77.6200),
    "MADIWALA_PS": (12.9200, 77.6180),
    "WIPRO_PARK": (12.9330, 77.6300)
}

# Simplified Connectivity
EDGES = [
    ("SONY_WORLD", "WIPRO_PARK"),
    ("SONY_WORLD", "KORAMANGALA_PS"),
    ("SONY_WORLD", "ST_JOHNS_HOSPITAL"),
    ("FORUM_MALL", "ST_JOHNS_HOSPITAL"),
    ("ST_JOHNS_HOSPITAL", "MADIWALA_CHECKPOST"),
    ("MADIWALA_CHECKPOST", "MADIWALA_PS"),
    ("KORAMANGALA_PS", "FORUM_MALL") # Via intermediate roads approx
]

class RoadNetwork:
    def __init__(self):
        self.nodes = NODES
        self.adj_list = self._build_adj_list()

    def _build_adj_list(self):
        adj = {node: [] for node in self.nodes}
        for u, v in EDGES:
            adj[u].append(v)
            adj[v].append(u)
        return adj

    def get_nearest_node(self, location: Location) -> str:
        """Find the nearest graph node to a given coordinate."""
        min_dist = float('inf')
        nearest = None
        for name, coords in self.nodes.items():
            # Simple Euclidean approx is fine for small scale
            dist = math.sqrt((location.lat - coords[0])**2 + (location.lng - coords[1])**2)
            if dist < min_dist:
                min_dist = dist
                nearest = name
        return nearest

    def get_next_step(self, current_node: str, target_node: str) -> str:
        """Simple BFS to find the next node to move to towards target."""
        if current_node == target_node:
            return current_node
        
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
        
        return current_node # Should not happen if graph is connected
