"""
DynamoDB integration for persistent incident storage.
Supports both real DynamoDB (for AWS deployment) and in-memory fallback (for local dev).
"""
import os
import json
import asyncio
from typing import List, Optional, Dict, Any
from datetime import datetime

USE_MOCK = os.getenv("USE_MOCK", "false").lower() == "true"
TABLE_NAME = os.getenv("DYNAMODB_TABLE_NAME", "civic-alert-incidents-dev")

MOCK_DB_FILE = os.path.join(os.path.dirname(__file__), "..", "mock_db.json")
_MOCK_FORCED = False  # Set to True if real AWS fails to keep storage consistent

def _load_mock_db() -> Dict[str, dict]:
    if not os.path.exists(MOCK_DB_FILE):
        return {}
    try:
        with open(MOCK_DB_FILE, "r") as f:
            return json.load(f)
    except:
        return {}

def _save_mock_db(data: Dict[str, dict]) -> None:
    with open(MOCK_DB_FILE, "w") as f:
        json.dump(data, f, indent=2)


async def put_incident(incident: dict) -> None:
    """Store an incident."""
    global _MOCK_FORCED
    if USE_MOCK or _MOCK_FORCED:
        store = _load_mock_db()
        store[incident["id"]] = incident
        _save_mock_db(store)
        return

    try:
        import boto3
        from boto3.dynamodb.types import TypeSerializer

        dynamodb = boto3.resource("dynamodb", region_name=os.getenv("AWS_REGION", "ap-south-1"))
        table = dynamodb.Table(TABLE_NAME)

        import copy
        # Create a deep copy to avoid mutating the original incident
        item = copy.deepcopy(incident)
        
        if "coordinates" in item and isinstance(item["coordinates"], dict):
            item["coord_lat"] = str(item["coordinates"]["lat"])
            item["coord_lng"] = str(item["coordinates"]["lng"])

        # DynamoDB expects 'incident_id' as the partition key
        item["incident_id"] = item.pop("id", item.get("incident_id"))

        # Convert lists to DynamoDB-compatible format
        if "departments" in item and isinstance(item["departments"], list):
            item["departments"] = item["departments"]

        # Ensure all numeric values are strings or Decimal for DynamoDB
        if "confidence" in item:
            item["confidence"] = str(item["confidence"])

        table.put_item(Item=item)
    except Exception as e:
        print(f"[WARNING] DynamoDB put failed ({type(e).__name__}: {e}). Forcing mock store.")
        _MOCK_FORCED = True
        store = _load_mock_db()
        store[incident.get("id", "unknown")] = incident
        _save_mock_db(store)


async def get_incidents(
    department: Optional[str] = None,
    severity: Optional[str] = None,
    status: Optional[str] = None,
) -> List[dict]:
    """Get all incidents with optional filters."""
    global _MOCK_FORCED
    if USE_MOCK or _MOCK_FORCED:
        return _get_from_memory(department, severity, status)

    try:
        import boto3

        dynamodb = boto3.resource("dynamodb", region_name=os.getenv("AWS_REGION", "ap-south-1"))
        table = dynamodb.Table(TABLE_NAME)

        # Full scan (fine for moderate data volumes)
        response = table.scan()
        items = response.get("Items", [])

        # Handle pagination
        while "LastEvaluatedKey" in response:
            response = table.scan(ExclusiveStartKey=response["LastEvaluatedKey"])
            items.extend(response.get("Items", []))

        # Normalize items back to API format
        results = []
        for item in items:
            normalized = _normalize_dynamo_item(item)
            results.append(normalized)

        # Apply filters
        if department:
            results = [i for i in results if department in i.get("departments", [])]
        if severity:
            results = [i for i in results if i.get("severity") == severity]
        if status:
            results = [i for i in results if i.get("status") == status]

        # Sort by timestamp descending
        results.sort(key=lambda x: x.get("timestamp", ""), reverse=True)
        return results

    except Exception as e:
        print(f"[WARNING] DynamoDB scan failed ({type(e).__name__}: {e}). Forcing mock store.")
        _MOCK_FORCED = True
        return _get_from_memory(department, severity, status)


async def get_incident(incident_id: str) -> Optional[dict]:
    """Get a single incident by ID."""
    global _MOCK_FORCED
    if USE_MOCK or _MOCK_FORCED:
        return _load_mock_db().get(incident_id)

    try:
        import boto3

        dynamodb = boto3.resource("dynamodb", region_name=os.getenv("AWS_REGION", "ap-south-1"))
        table = dynamodb.Table(TABLE_NAME)

        # We need to scan since we don't know the sort key (timestamp)
        response = table.scan(
            FilterExpression="incident_id = :id",
            ExpressionAttributeValues={":id": incident_id},
        )
        items = response.get("Items", [])
        if items:
            return _normalize_dynamo_item(items[0])
        return None

    except Exception as e:
        print(f"[WARNING] DynamoDB get failed ({type(e).__name__}: {e}). Forcing mock store.")
        _MOCK_FORCED = True
        return _load_mock_db().get(incident_id)


async def update_incident_status(incident_id: str, status: str) -> Optional[dict]:
    """Update the status of an incident."""
    global _MOCK_FORCED
    if USE_MOCK or _MOCK_FORCED:
        store = _load_mock_db()
        if incident_id in store:
            store[incident_id]["status"] = status
            _save_mock_db(store)
            return store[incident_id]
        return None

    try:
        import boto3

        dynamodb = boto3.resource("dynamodb", region_name=os.getenv("AWS_REGION", "ap-south-1"))
        table = dynamodb.Table(TABLE_NAME)

        # We first need to get the item to know its timestamp (range key)
        incident = await get_incident(incident_id)
        if not incident:
            return None

        # Update item in DynamoDB
        response = table.update_item(
            Key={
                "incident_id": incident_id,
                "timestamp": incident["timestamp"]
            },
            UpdateExpression="SET #s = :status",
            ExpressionAttributeNames={"#s": "status"},
            ExpressionAttributeValues={":status": status},
            ReturnValues="ALL_NEW"
        )
        
        attributes = response.get("Attributes", {})
        if attributes:
            return _normalize_dynamo_item(attributes)
        
        # Fallback to returning the updated fetched item
        incident["status"] = status
        return incident

    except Exception as e:
        print(f"[WARNING] DynamoDB update failed ({type(e).__name__}: {e}). Forcing mock store.")
        _MOCK_FORCED = True
        store = _load_mock_db()
        if incident_id in store:
            store[incident_id]["status"] = status
            _save_mock_db(store)
            return store[incident_id]
        return None


async def get_analytics(department: Optional[str] = None) -> dict:
    """Compute analytics from all stored incidents, optionally filtered by department."""
    incidents = await get_incidents(department=department)
    total = len(incidents)

    type_counts: Dict[str, int] = {}
    severity_counts = {"critical": 0, "high": 0, "medium": 0, "low": 0}
    dept_counts: Dict[str, int] = {}
    status_counts = {"active": 0, "responding": 0, "resolved": 0}
    location_counts: Dict[str, int] = {}

    for inc in incidents:
        # Type counts
        t = inc.get("type", "Unknown")
        type_counts[t] = type_counts.get(t, 0) + 1

        # Severity counts
        s = inc.get("severity", "medium")
        if s in severity_counts:
            severity_counts[s] += 1

        # Department counts
        for d in inc.get("departments", []):
            dept_counts[d] = dept_counts.get(d, 0) + 1

        # Status counts
        st = inc.get("status", "active")
        if st in status_counts:
            status_counts[st] += 1

        # Location counts (extract city from location string)
        loc = inc.get("location", "")
        city = _extract_city(loc)
        if city:
            location_counts[city] = location_counts.get(city, 0) + 1

    return {
        "total_incidents": total,
        "active_incidents": status_counts.get("active", 0),
        "responding_incidents": status_counts.get("responding", 0),
        "resolved_incidents": status_counts.get("resolved", 0),
        "avg_response_time": 4.2,  # Would need timestamps to compute properly
        "resolution_rate": round(
            (status_counts.get("resolved", 0) / total * 100) if total > 0 else 0, 1
        ),
        "incidents_by_type": type_counts,
        "severity_distribution": severity_counts,
        "department_performance": dept_counts,
        "location_hotspots": location_counts,
    }


def _extract_city(location: str) -> str:
    """Extract city name from an address string."""
    if not location:
        return ""
    # Try common Indian city names
    cities = [
        "Delhi", "Mumbai", "Bangalore", "Bengaluru", "Chennai", "Kolkata",
        "Hyderabad", "Kanpur", "Lucknow", "Noida", "Agra", "Jaipur",
        "Pune", "Ahmedabad", "Surat", "Patna",
    ]
    for city in cities:
        if city.lower() in location.lower():
            return city
    # Fallback: use last meaningful part
    parts = [p.strip() for p in location.split(",")]
    if len(parts) >= 2:
        return parts[-2].strip()
    return location


def _normalize_dynamo_item(item: dict) -> dict:
    """Convert DynamoDB item back to API format."""
    result = {**item}

    # Restore id from incident_id
    if "incident_id" in result:
        result["id"] = result.pop("incident_id")

    # Restore coordinates
    if "coord_lat" in result and "coord_lng" in result:
        result["coordinates"] = {
            "lat": float(result.pop("coord_lat")),
            "lng": float(result.pop("coord_lng")),
        }

    # Convert confidence back to number
    if "confidence" in result:
        try:
            result["confidence"] = float(result["confidence"])
        except (ValueError, TypeError):
            result["confidence"] = 0

    return result


def _get_from_memory(
    department: Optional[str] = None,
    severity: Optional[str] = None,
    status: Optional[str] = None,
) -> List[dict]:
    """Get incidents from in-memory store with filters."""
    store = _load_mock_db()
    results = list(store.values())

    if department:
        results = [i for i in results if department in i.get("departments", [])]
    if severity:
        results = [i for i in results if i.get("severity") == severity]
    if status:
        results = [i for i in results if i.get("status") == status]

    results.sort(key=lambda x: x.get("timestamp", ""), reverse=True)
    return results
