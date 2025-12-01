import unittest
from datetime import datetime
from app.core.models import Asset, AssetType, AssetStatus, Location, Event, EventType, EventStatus
from app.core.utils import haversine_distance

class TestCoreModels(unittest.TestCase):
    def test_location_model(self):
        """Test Location model validation"""
        loc = Location(lat=12.9290, lng=77.6200)
        self.assertEqual(loc.lat, 12.9290)
        self.assertEqual(loc.lng, 77.6200)
        # Test type coercion
        loc_str = Location(lat="12.9290", lng="77.6200")
        self.assertEqual(loc_str.lat, 12.9290)

    def test_asset_model(self):
        """Test Asset model defaults and enums"""
        asset = Asset(
            asset_id="PCR-1",
            type=AssetType.PCR,
            location=Location(lat=12.0, lng=77.0),
            status=AssetStatus.IDLE
        )
        self.assertEqual(asset.type, "PCR")
        self.assertEqual(asset.status, "IDLE")
        self.assertIsInstance(asset.last_ping, datetime)
        self.assertEqual(asset.fatigue_level, 0.0)

    def test_event_model(self):
        """Test Event model"""
        evt = Event(
            event_id="EVT-1",
            type=EventType.THEFT,
            severity=5,
            location=Location(lat=12.0, lng=77.0),
            status=EventStatus.ACTIVE
        )
        self.assertEqual(evt.severity, 5)
        self.assertEqual(evt.type, "THEFT")

    def test_haversine(self):
        """Test Haversine distance calculation"""
        # Distance between Sony World (12.9360, 77.6270) and Forum Mall (12.9340, 77.6110)
        # Approx 1.7 km
        coord1 = (12.9360, 77.6270)
        coord2 = (12.9340, 77.6110)
        dist = haversine_distance(coord1, coord2)
        self.assertAlmostEqual(dist, 1.7, delta=0.1)

if __name__ == '__main__':
    unittest.main()
