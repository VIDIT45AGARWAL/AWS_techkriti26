"""
AWS Location Service integration for geocoding.
Converts GPS coordinates to addresses and vice versa.
"""
import os
import asyncio
from typing import Optional, Tuple

USE_MOCK = os.getenv("USE_MOCK", "false").lower() == "true"


# Generic phrases that must never be geocoded ("a man collapsed at the bus stop"
# must not resolve to a random "Bus Stop" place — better to report unknown)
_GENERIC_LOCATIONS = {
    "bus stop", "the bus stop", "bus stand", "the bus stand", "the mall", "mall",
    "home", "my home", "here", "there", "the road", "the street", "the park",
    "the hospital", "hospital", "the market", "market", "the school", "school",
    "the station", "railway station", "the railway station", "the building",
    "the office", "the shop", "nearby", "the area", "the highway", "highway",
    "the mall near", "a bus stop",
}


def _is_generic_location(location_text: str) -> bool:
    return (location_text or "").strip().lower().rstrip(".,") in _GENERIC_LOCATIONS


# Words that carry no place meaning when scoring geocode candidates
_TOKEN_STOPWORDS = {
    "the", "a", "an", "of", "in", "at", "near", "on", "by", "to", "from",
    "and", "road", "street", "lane", "market", "area", "colony", "sector",
    "block", "building", "depot", "station", "place", "house", "shop",
}


def _score_result(label: str, query_tokens: list) -> float:
    """
    Score a geocode candidate by how many query tokens its label contains.
    Later tokens weigh more: in spoken descriptions the city usually comes
    last ("the market lane of Chunniganj in Kanpur"), so 'kanpur' matters
    more than 'market'.
    """
    label_lower = (label or "").lower()
    score = 0.0
    for weight, token in enumerate(query_tokens, start=1):
        if token in label_lower:
            score += weight
    return score


def _tokenize_query(location_text: str) -> list:
    import re as _re
    tokens = _re.findall(r"[a-z\u0900-\u097F]{3,}", (location_text or "").lower())
    return [t for t in tokens if t not in _TOKEN_STOPWORDS]


async def geocode(
    location_text: str,
    bias_near: Optional[Tuple[float, float]] = None,
) -> Optional[Tuple[float, float]]:
    """
    Convert location text to GPS coordinates.

    Args:
        location_text: Human-readable location (e.g., "Sector 15, Kanpur")
        bias_near: Optional (lat, lng) of the reporter, used to bias the
            search toward the area the user is actually in (improves
            accuracy for ambiguous local names like "Sector 15").

    Returns:
        Tuple of (lat, lng) or None if not found
    """
    if USE_MOCK:
        return await _mock_forward_geocode(location_text)

    clean = (location_text or "").strip()
    if not clean or _is_generic_location(clean):
        return None

    client_kwargs = {"region_name": os.getenv("AWS_REGION", "ap-south-1")}
    index_name = os.getenv("LOCATION_INDEX_NAME", "civic-alert-places-prod")

    def _search(text: str, max_results: int = 5) -> list:
        """Return scored (score, lat, lng) candidates for a query text."""
        import boto3

        client = boto3.client("location", **client_kwargs)
        kwargs = {
            "IndexName": index_name,
            "Text": text,
            "MaxResults": max_results,
            "FilterCountries": ["IND"],  # CivicAlert is an India-wide service
        }
        if bias_near:
            # Bias toward the reporter's area: ~100km box around them
            kwargs["BiasPosition"] = [bias_near[1], bias_near[0]]  # [lng, lat]
        response = client.search_place_index_for_text(**kwargs)
        candidates = []
        for r in response.get("Results", []):
            place = r.get("Place", {})
            point = place.get("Geometry", {}).get("Point", [])
            if len(point) == 2:
                label = place.get("Label", "")
                candidates.append(
                    (_score_result(label, query_tokens), point[1], point[0], label)
                )
        # Best score first; ties keep Esri's relevance order
        candidates.sort(key=lambda c: -c[0])
        return candidates

    query_tokens = _tokenize_query(clean)
    try:
        # 1st attempt: as spoken / typed (restricted to India)
        candidates = _search(clean)
        if candidates and candidates[0][0] > 0:
            _, lat, lng, label = candidates[0]
            print(f"[GEOCODE] '{clean}' -> {label} ({lat:.4f}, {lng:.4f})")
            return (lat, lng)
        # 2nd attempt: anchor explicitly to India for ambiguous local names
        if "india" not in clean.lower():
            candidates = _search(f"{clean}, India")
            if candidates and candidates[0][0] > 0:
                _, lat, lng, label = candidates[0]
                print(f"[GEOCODE] '{clean}, India' -> {label} ({lat:.4f}, {lng:.4f})")
                return (lat, lng)
        # 3rd attempt: fall back to the final spoken token (usually the city)
        if query_tokens:
            city = query_tokens[-1]
            candidates = _search(city)
            if candidates:
                _, lat, lng, label = candidates[0]
                print(f"[GEOCODE] fallback '{city}' -> {label} ({lat:.4f}, {lng:.4f})")
                return (lat, lng)
        return None
    except Exception as e:
        print(f"AWS Location Geocoding Error: {e}")
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
            IndexName=os.getenv("LOCATION_INDEX_NAME", "civic-alert-places-prod"),
            Position=[lng, lat],  # Note: AWS uses [lng, lat] order
            MaxResults=1,
        )

        results = response.get("Results", [])
        if results:
            place = results[0].get("Place", {})
            label = place.get("Label")
            if label:
                return label
    except Exception as e:
        print(f"AWS Location reverse geocoding error: {e}")

    # Honest fallback — raw coordinates, never a fabricated address
    return f"{lat:.5f}, {lng:.5f}"


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
