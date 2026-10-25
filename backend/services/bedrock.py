"""
AI-powered incident analysis and classification.
Supports AWS Bedrock and Anthropic API.
"""
import os
import json
import asyncio
import re

USE_MOCK = os.getenv("USE_MOCK", "false").lower() == "true"
USE_ANTHROPIC_API = os.getenv("USE_ANTHROPIC_API", "false").lower() == "true"

# ─── Department routing rules ───
# Canonical department names (must match SNS topic mapping)
CANONICAL_DEPARTMENTS = ["Police", "Fire Department", "Medical Emergency", "Disaster Response"]

# Signals that REQUIRE a department to be dispatched (matched against the
# transcript, incident type and casualty notes, case-insensitive)
_DEPT_RULES = [
    ("Fire Department", [
        "fire", "flame", "smoke", "burn", "gas leak", "gas cylinder", "explosion",
        "blast", "electrocut", "short circuit", "lpg", "stove", "chemical spill",
        "toxic spill", "hazardous spill", "आग", "धुआं", "आग लगी",
    ]),
    ("Medical Emergency", [
        "injur", "trapped", "unconscious", "faint", "bleed", "heart attack",
        "stroke", "chok", "casualt", "wound", "fracture", "died", "dead", "death",
        "ambulance", "hospital", "suffocat", "difficulty breathing", "collapsed man",
        "collapsed woman", "collapsed person", "pregnan",
    ]),
    ("Police", [
        "theft", "robber", "steal", "stabbing", "shooting", "assault", "violence",
        "riot", "accident", "crash", "collision", "kidnap", "murder", "suspicious",
        "weapon", "crime", "fight", "drunk driving", "hit and run", "traffic",
    ]),
    ("Disaster Response", [
        "flood", "earthquake", "cyclone", "landslide", "tsunami", "evacuat",
        "chemical spill", "chemical leak", "hazard", "biohazard", "building collapse",
        "structure collapse", "bridge collapse", "dam", "disaster", "storm surge",
        "बाढ़", "भूकंप", "gas leak into",
    ]),
]


def _normalize_department(name: str) -> str | None:
    """Map a free-form department name to a canonical one (or None)."""
    n = (name or "").lower().strip()
    if not n:
        return None
    if "fire" in n:
        return "Fire Department"
    if any(k in n for k in ("medical", "ambulance", "health", "ems", "hospital")):
        return "Medical Emergency"
    if any(k in n for k in ("police", "law enforcement", "cop")):
        return "Police"
    if any(k in n for k in ("disaster", "ndrf", "rescue", "relief", "sdrf")):
        return "Disaster Response"
    return None


def _enforce_department_rules(analysis: dict, transcript: str) -> list:
    """
    Ensure the correct force is dispatched for the correct emergency.

    Normalizes the AI's department list to canonical names and adds any
    department whose signals (keywords) appear in the transcript, incident
    type or casualty notes — so a gas leak can never dispatch without the
    Fire Department, and trapped/injured people always get Medical.
    """
    departments: list = []
    for d in analysis.get("departments") or []:
        canonical = _normalize_department(d) if isinstance(d, str) else None
        if canonical and canonical not in departments:
            departments.append(canonical)

    # Signal pool: transcript + incident type + casualties
    signals = " ".join([
        transcript or "",
        str(analysis.get("incident_type") or ""),
        str(analysis.get("casualties") or ""),
    ]).lower()

    for dept, keywords in _DEPT_RULES:
        if any(k in signals for k in keywords) and dept not in departments:
            departments.append(dept)

    # Canonical ordering, and never dispatch to nobody
    departments = [d for d in CANONICAL_DEPARTMENTS if d in departments]
    if not departments:
        departments = ["Police"]  # general emergency responder (112 equivalent)
    return departments


async def analyze_incident(transcript: str) -> dict:
    """
    Analyze an emergency transcript using AI to extract:
    - Incident type
    - Severity level (critical/high/medium/low)
    - Casualties information
    - Department classification
    - Structured summary

    Args:
        transcript: Text description of the emergency

    Returns:
        Dict with extracted fields
    """
    if USE_MOCK:
        return await _mock_analyze(transcript)

    # Try real AWS/Anthropic services; fall back to keyword rules if they fail
    try:
        if USE_ANTHROPIC_API:
            analysis = await _analyze_with_anthropic(transcript)
        else:
            analysis = await _analyze_with_bedrock(transcript)
    except Exception as e:
        print(f"[WARNING] AI analysis failed ({type(e).__name__}: {e}). "
              f"Falling back to keyword-based analysis.")
        return await _keyword_fallback(transcript)

    # Guarantee the correct force is dispatched for the correct emergency
    analysis["departments"] = _enforce_department_rules(analysis, transcript)
    return analysis


async def _analyze_with_anthropic(transcript: str) -> dict:
    """Use Anthropic API directly."""
    import aiohttp
    
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        raise ValueError("ANTHROPIC_API_KEY not set in environment")

    prompt = f"""You are an emergency triage AI. Analyze this emergency report and extract structured data.

Emergency Report: "{transcript}"

Return a JSON object with these exact fields:
{{
    "incident_type": "The type of incident (e.g., Building Fire, Road Accident, Flooding, Medical Emergency, Gas Leak, Building Collapse, Theft)",
    "severity": "One of: critical, high, medium, low",
    "casualties": "Description of casualties or 'None reported'",
    "departments": ["List of departments to notify: Police, Fire Department, Medical Emergency, Disaster Response"],
    "summary": "A concise, structured summary for dispatchers (2-3 sentences)",
    "confidence": 0.0
}}

Return ONLY valid JSON, no other text."""

    async with aiohttp.ClientSession() as session:
        async with session.post(
            "https://api.anthropic.com/v1/messages",
            headers={
                "x-api-key": api_key,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
            },
            json={
                "model": "claude-3-sonnet-20240229",
                "max_tokens": 1024,
                "messages": [{"role": "user", "content": prompt}],
            },
        ) as response:
            result = await response.json()
            content = result["content"][0]["text"]
            return json.loads(content)


async def _analyze_with_bedrock(transcript: str) -> dict:
    """Use AWS Bedrock with Claude models."""
    import boto3

    # Only pass explicit credentials if set; otherwise use EC2 instance profile
    client_kwargs = {
        "region_name": os.getenv("AWS_REGION", "ap-south-1"),
    }
    if os.getenv("BEDROCK_AWS_ACCESS_KEY_ID"):
        client_kwargs["aws_access_key_id"] = os.getenv("BEDROCK_AWS_ACCESS_KEY_ID")
        client_kwargs["aws_secret_access_key"] = os.getenv("BEDROCK_AWS_SECRET_ACCESS_KEY")

    client = boto3.client("bedrock-runtime", **client_kwargs)

    prompt = f"""You are an emergency triage AI. Analyze this emergency report and extract structured data.

Emergency Report: "{transcript}"

IMPORTANT: Extract location information from the report if mentioned. Look for:
- Street names, landmarks, building names
- Area/locality names
- City/district names
- Any geographical references

DEPARTMENT DISPATCH MATRIX (MANDATORY — choose every department that applies):
- Fire, smoke, burns, gas leak, LPG cylinder, explosion, electrocution, short circuit → Fire Department
- ANY injury, trapped people, unconsciousness, bleeding, fainting, difficulty breathing, pregnancy, death → Medical Emergency
- Crime (theft, robbery, assault, stabbing, shooting, violence, kidnapping), road accidents, hit-and-run, traffic hazards, suspicious activity → Police
- Flood, earthquake, cyclone, landslide, building/bridge collapse, chemical spill, biohazard, large-scale evacuation → Disaster Response
- Large-scale or multi-hazard incidents often need MULTIPLE departments — include all that apply.
- NEVER leave "departments" empty.

Return a JSON object with these exact fields:
{{
    "incident_type": "The type of incident (e.g., Building Fire, Road Accident, Flooding, Medical Emergency, Gas Leak, Building Collapse, Theft)",
    "severity": "One of: critical, high, medium, low",
    "casualties": "Description of casualties or 'None reported'",
    "departments": ["List of departments to notify: Police, Fire Department, Medical Emergency, Disaster Response"],
    "location_extracted": "Location mentioned in the report or null if not specified",
    "department_reasoning": "Brief explanation of why these departments were selected",
    "summary": "A concise, structured summary for dispatchers (2-3 sentences)",
    "confidence": 0.0
}}

Return ONLY valid JSON, no other text."""

    model_id = os.getenv("BEDROCK_MODEL_ID", "anthropic.claude-3-sonnet-20240229-v1:0")
    
    # Note: extended thinking is only supported on claude-3-7 and newer
    # Use standard request body for claude-3-sonnet
    request_body = {
        "anthropic_version": "bedrock-2023-05-31",
        "max_tokens": 1024,
        "messages": [{"role": "user", "content": prompt}],
    }

    response = client.invoke_model(
        modelId=model_id,
        body=json.dumps(request_body),
        contentType="application/json",
    )

    result = json.loads(response["body"].read())
    
    # claude-3-sonnet returns a single text block
    response_text = ""
    for block in result.get("content", []):
        if block.get("type") == "text":
            response_text = block.get("text", "")
            break

    parsed = json.loads(response_text)
    return parsed


def _extract_location_fallback(transcript: str) -> str | None:
    """
    Best-effort location extraction via regex when the AI service is down.
    Looks for 'at/in/near <Place>' patterns; returns None when nothing matches.
    """
    if not transcript:
        return None
    match = re.search(
        r"\b(?:at|in|near|outside)\s+((?:[A-Z][\w’'-]*\s*(?:,|of|near|road|street|nagar|colony|sector|market)?\s*){1,5})",
        transcript,
    )
    if not match:
        return None
    location = match.group(1).strip().rstrip(",.")
    # Require at least one properly capitalized word to avoid grabbing noise
    words = [w for w in location.split() if w and not w.islower()]
    return " ".join(words) if words else None


async def _keyword_fallback(transcript: str) -> dict:
    """
    Honest keyword-based classification used when the AI service fails.
    Only derives information actually present in the transcript — no
    invented casualties, locations or summaries.
    """
    text = (transcript or "").lower()

    if any(k in text for k in ("fire", "smoke", "burn", "gas leak", "explosion", "आग", "धुआं")):
        incident_type = "Fire Emergency"
    elif any(k in text for k in ("flood", "earthquake", "cyclone", "landslide", "बाढ़", "भूकंप")):
        incident_type = "Natural Disaster"
    elif any(k in text for k in ("accident", "crash", "collision")):
        incident_type = "Road Accident"
    elif any(k in text for k in ("theft", "robber", "assault", "stabbing", "shooting")):
        incident_type = "Crime Report"
    elif any(k in text for k in ("injur", "unconscious", "bleed", "faint", "heart attack")):
        incident_type = "Medical Emergency"
    else:
        incident_type = "General Emergency"

    analysis = {
        "incident_type": incident_type,
        "severity": "medium",
        "casualties": "Unknown",
        "departments": [],
        "location_extracted": _extract_location_fallback(transcript),
        "summary": transcript[:500],
        "confidence": 40,
    }
    analysis["departments"] = _enforce_department_rules(analysis, transcript)
    return analysis


async def _mock_analyze(transcript: str) -> dict:
    """Return mock analysis for development."""
    await asyncio.sleep(1.0)  # Simulate AI processing time

    # Simple keyword-based mock classification
    text = transcript.lower()

    if any(w in text for w in ["fire", "smoke", "burn", "आग", "धुआं", "தீ"]):
        return {
            "incident_type": "Building Fire",
            "severity": "critical",
            "casualties": "3-5 people trapped, 2 injured",
            "departments": ["Fire Department", "Medical Emergency", "Police"],
            "summary": "Major structural fire in a residential building. Multiple residents "
                       "reported trapped on upper floors. Smoke visible from distance. "
                       "Two confirmed injuries — burn wounds.",
            "confidence": 94,
        }
    elif any(w in text for w in ["accident", "crash", "collision", "vehicle"]):
        return {
            "incident_type": "Road Accident",
            "severity": "high",
            "casualties": "4 injured",
            "departments": ["Police", "Medical Emergency"],
            "summary": "Multi-vehicle collision reported. Traffic blocked. Multiple injuries "
                       "requiring immediate medical attention.",
            "confidence": 91,
        }
    elif any(w in text for w in ["flood", "water", "rain", "बाढ़"]):
        return {
            "incident_type": "Flooding",
            "severity": "critical",
            "casualties": "12 displaced families",
            "departments": ["Disaster Response", "Police", "Medical Emergency"],
            "summary": "Flash flooding in residential area. Water level rising rapidly. "
                       "Multiple families need immediate evacuation.",
            "confidence": 88,
        }
    else:
        return {
            "incident_type": "General Emergency",
            "severity": "medium",
            "casualties": "Unknown",
            "departments": ["Police"],
            "summary": f"Emergency report received: {transcript[:200]}",
            "confidence": 72,
        }
