import math
from typing import Tuple

def haversine_distance(coord1: Tuple[float, float], coord2: Tuple[float, float]) -> float:
    """
    Calculate the great circle distance between two points 
    on the earth (specified in decimal degrees)
    """
    lat1, lon1 = coord1
    lat2, lon2 = coord2

    R = 6371  # Radius of earth in km
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2) * math.sin(dlat / 2) + \
        math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * \
        math.sin(dlon / 2) * math.sin(dlon / 2)
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    d = R * c
    return d

def calculate_eta(distance_km: float, speed_kmh: float = 40.0) -> float:
    """Calculate ETA in minutes based on distance and average speed."""
    if speed_kmh <= 0:
        return float('inf')
    return (distance_km / speed_kmh) * 60
