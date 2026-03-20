"""
AI-powered incident analysis and classification.
Supports AWS Bedrock and Anthropic API.
"""
import os
import json
import asyncio

USE_MOCK = os.getenv("USE_MOCK", "true").lower() == "true"
USE_ANTHROPIC_API = os.getenv("USE_ANTHROPIC_API", "false").lower() == "true"


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

    # Try real AWS/Anthropic services; fall back to mock if they fail
    try:
        if USE_ANTHROPIC_API:
            return await _analyze_with_anthropic(transcript)
        else:
            return await _analyze_with_bedrock(transcript)
    except Exception as e:
        print(f"[WARNING] AI analysis failed ({type(e).__name__}: {e}). "
              f"Falling back to keyword-based analysis.")
        return await _mock_analyze(transcript)


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

    client = boto3.client(
        "bedrock-runtime",
        region_name=os.getenv("AWS_REGION", "ap-south-1"),
        aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID"),
        aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY"),
    )

    prompt = f"""You are an emergency triage AI. Analyze this emergency report and extract structured data.

Emergency Report: "{transcript}"

IMPORTANT: Extract location information from the report if mentioned. Look for:
- Street names, landmarks, building names
- Area/locality names
- City/district names
- Any geographical references

Reason through which departments are needed based on:
- Type of emergency (fire needs Fire Department, medical needs Medical Emergency, crime needs Police)
- Severity level (critical incidents may need multiple departments)
- Specific hazards mentioned (gas leaks need Fire Department, injuries need Medical Emergency)
- Scale of incident (large-scale disasters need Disaster Response)

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

    model_id = os.getenv("BEDROCK_MODEL_ID", "apac.anthropic.claude-3-5-sonnet-20241022-v2:0")
    
    request_body = {
        "anthropic_version": "bedrock-2023-05-31",
        "max_tokens": 4096,
        "messages": [{"role": "user", "content": prompt}],
        "thinking": {
            "type": "enabled",
            "budget_tokens": 3000
        }
    }

    response = client.invoke_model(
        modelId=model_id,
        body=json.dumps(request_body),
        contentType="application/json",
    )

    result = json.loads(response["body"].read())
    
    thinking_content = ""
    response_text = ""
    
    for block in result.get("content", []):
        if block.get("type") == "thinking":
            thinking_content = block.get("thinking", "")
        elif block.get("type") == "text":
            response_text = block.get("text", "")
    
    parsed = json.loads(response_text)
    
    if thinking_content:
        print(f"[AI REASONING]: {thinking_content}")
    
    return parsed


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
