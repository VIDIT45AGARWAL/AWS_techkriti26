"""
AWS Location Service integration for geocoding.
Converts GPS coordinates to addresses and vice versa.
"""
import os
import asyncio
from typing import Optional, Tuple

USE_MOCK = os.getenv("USE_MOCK", "false").lower() == "true"


async def geocode(location_text: str) -> Optional[Tuple[float, float]]:
    """
    Convert location text to GPS coordinates.

    Args:
        location_text: Human-readable location (e.g., "Sector 15, Kanpur")

    Returns:
        Tuple of (lat, lng) or None if not found
    """
    if USE_MOCK:
        return await _mock_forward_geocode(location_text)

    try:
        import boto3

        client = boto3.client("location", region_name=os.getenv("AWS_REGION", "ap-south-1"))

        response = client.search_place_index_for_text(
            IndexName=os.getenv("LOCATION_INDEX_NAME", "civic-alert-places"),
            Text=location_text,
            MaxResults=1,
        )

        results = response.get("Results", [])
        if results:
            place = results[0].get("Place", {})
            geometry = place.get("Geometry", {})
            point = geometry.get("Point", [])
            if len(point) == 2:
                return (point[1], point[0])  # Convert [lng, lat] to (lat, lng)
    except Exception as e:
        print(f"AWS Location Geocoding Error: {e}")
        return None

    return None


async def reverse_geocode(lat: float, lng: float) -> str:
    """
    Convert GPS coordinates to a human-readable address.

    Args:
        lat: Latitude
        lng: Longitude

    Returns:
        Human-readable address string
    """
    if USE_MOCK:
        return await _mock_geocode(lat, lng)

    # Real AWS Location Service implementation
    try:
        import boto3

        client = boto3.client("location", region_name=os.getenv("AWS_REGION", "ap-south-1"))

        response = client.search_place_index_for_position(
            IndexName=os.getenv("LOCATION_INDEX_NAME", "civic-alert-places"),
            Position=[lng, lat],  # Note: AWS uses [lng, lat] order
            MaxResults=1,
        )

        results = response.get("Results", [])
        if results:
            place = results[0].get("Place", {})
            return place.get("Label", f"{lat}, {lng}")
    except Exception as e:
        print(f"AWS Location Error: {e}. Falling back to mock geocoding.")
        return await _mock_geocode(lat, lng)

    return f"{lat}, {lng}"


async def _mock_forward_geocode(location_text: str) -> Optional[Tuple[float, float]]:
    """Return mock coordinates for development."""
    await asyncio.sleep(0.2)

    text_lower = location_text.lower()
    
    # Simple keyword matching for common locations
    if "kanpur" in text_lower:
        return (26.4499, 80.3319)
    elif "lucknow" in text_lower:
        return (26.8467, 80.9462)
    elif "delhi" in text_lower or "new delhi" in text_lower:
        return (28.6139, 77.2090)
    elif "noida" in text_lower:
        return (28.5355, 77.3910)
    elif "mumbai" in text_lower:
        return (19.0760, 72.8777)
    elif "bangalore" in text_lower or "bengaluru" in text_lower:
        return (12.9716, 77.5946)
    elif "hyderabad" in text_lower:
        return (17.3850, 78.4867)
    elif "chennai" in text_lower:
        return (13.0827, 80.2707)
    
    return None


async def _mock_geocode(lat: float, lng: float) -> str:
    """Return mock address for development."""
    await asyncio.sleep(0.2)

    # Return realistic Indian addresses based on rough coordinates
    mock_addresses = [
        (26.44, 80.33, "Sector 15, Kanpur, Uttar Pradesh 208002"),
        (26.84, 80.94, "Civil Lines, Lucknow, Uttar Pradesh 226001"),
        (28.61, 77.20, "Connaught Place, New Delhi 110001"),
        (28.53, 77.39, "Sector 62, Noida, Uttar Pradesh 201309"),
        (19.07, 72.87, "Andheri West, Mumbai, Maharashtra 400053"),
        (12.97, 77.59, "MG Road, Bangalore, Karnataka 560001"),
        (17.38, 78.48, "Secunderabad, Hyderabad, Telangana 500003"),
        (13.08, 80.27, "T Nagar, Chennai, Tamil Nadu 600017"),
    ]

    # Find closest mock address
    closest = min(mock_addresses, key=lambda a: abs(a[0] - lat) + abs(a[1] - lng))
    return closest[2]
