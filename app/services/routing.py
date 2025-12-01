import math
from typing import List, Tuple, Dict, Set
from ..core.models import Location

# --- KORAMANGALA & MADIWALA DENSE GRAPH ---
# Coordinates approximated for key intersections to ensure road adherence.

NODES = {
    # --- 100ft Road / Intermediate Ring Road Axis ---
    "SONY_WORLD": (12.9360, 77.6270),
    "SONY_WORLD_NORTH": (12.9385, 77.6280), # Towards Domlur
    "OASIS_MALL": (12.9330, 77.6250),
    "KORAMANGALA_WIPRO": (12.9330, 77.6300), # Wipro Park Signal
    
    # --- 80ft Road Axis ---
    "KORAMANGALA_PS": (12.9380, 77.6200),
    "REGIONAL_PASSPORT": (12.9400, 77.6190),
    "FORUM_MALL": (12.9340, 77.6110),
    "CHRIST_COLLEGE": (12.9345, 77.6060),
    
    # --- Hosur Road Axis ---
    "ST_JOHNS_HOSPITAL": (12.9280, 77.6230),
    "MADIWALA_CHECKPOST": (12.9220, 77.6210),
    "MADIWALA_MARKET": (12.9210, 77.6180),
    "SILK_BOARD": (12.9170, 77.6200),
    
    # --- Sarjapur Road Axis ---
    "KRUPANIDHI_COLLEGE": (12.9260, 77.6350),
    "ST_JOHNS_WOOD": (12.9250, 77.6300),
    
    # --- Internal Roads (The "Mesh") ---
    "JYOTI_NIVAS": (12.9350, 77.6160),
    "BETHANY_HIGH": (12.9370, 77.6240),
    "MADIWALA_POLICE_STATION": (12.9200, 77.6180),
    "TOTAL_MALL_OLD": (12.9200, 77.6250),
    "WATER_TANK": (12.9290, 77.6200), # Near St Johns
}

# Adjacency List (Bidirectional Roads)
# Format: (Node A, Node B)
EDGES = [
    # 100ft Road
    ("SONY_WORLD_NORTH", "SONY_WORLD"),
    ("SONY_WORLD", "OASIS_MALL"),
    ("OASIS_MALL", "ST_JOHNS_HOSPITAL"),
    
    # 80ft Road
    ("REGIONAL_PASSPORT", "KORAMANGALA_PS"),
    ("KORAMANGALA_PS", "SONY_WORLD"), # 80ft meets 100ft
    ("KORAMANGALA_PS", "JYOTI_NIVAS"),
    ("JYOTI_NIVAS", "FORUM_MALL"),
    
    # Hosur Road
    ("FORUM_MALL", "ST_JOHNS_HOSPITAL"),
    ("ST_JOHNS_HOSPITAL", "MADIWALA_CHECKPOST"),
    ("MADIWALA_CHECKPOST", "SILK_BOARD"),
    ("MADIWALA_CHECKPOST", "MADIWALA_MARKET"),
    ("MADIWALA_MARKET", "MADIWALA_POLICE_STATION"),
    
    # Sarjapur Road
    ("ST_JOHNS_HOSPITAL", "ST_JOHNS_WOOD"),
    ("ST_JOHNS_WOOD", "KRUPANIDHI_COLLEGE"),
    ("ST_JOHNS_WOOD", "KORAMANGALA_WIPRO"),
    ("KORAMANGALA_WIPRO", "SONY_WORLD"), # Inner Ring Road connection
    
    # Internal Connections
    ("SONY_WORLD", "BETHANY_HIGH"),
    ("BETHANY_HIGH", "KORAMANGALA_PS"),
    ("OASIS_MALL", "TOTAL_MALL_OLD"),
    ("TOTAL_MALL_OLD", "MADIWALA_CHECKPOST"),
    ("ST_JOHNS_HOSPITAL", "WATER_TANK"),
    ("WATER_TANK", "JYOTI_NIVAS"), # 5th Block connection
    ("FORUM_MALL", "CHRIST_COLLEGE"),
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
