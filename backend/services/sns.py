"""
Amazon SNS integration for multi-department emergency alert dispatch.
Sends structured, pre-filled reports to all relevant departments simultaneously.
"""
import os
import json
import asyncio
from typing import List

USE_MOCK = os.getenv("USE_MOCK", "true").lower() == "true"

# SNS Topic ARNs (set via environment variables or Terraform outputs)
TOPIC_ARNS = {
    "Police": os.getenv("SNS_TOPIC_POLICE", "arn:aws:sns:ap-south-1:000000000000:police-alerts"),
    "Fire Department": os.getenv("SNS_TOPIC_FIRE", "arn:aws:sns:ap-south-1:000000000000:fire-alerts"),
    "Medical Emergency": os.getenv("SNS_TOPIC_MEDICAL", "arn:aws:sns:ap-south-1:000000000000:medical-alerts"),
    "Disaster Response": os.getenv("SNS_TOPIC_DISASTER", "arn:aws:sns:ap-south-1:000000000000:disaster-alerts"),
}


async def dispatch_alerts(incident: dict) -> List[dict]:
    """
    Dispatch structured emergency alerts to all relevant departments via Amazon SNS.

    Args:
        incident: Full incident data dict

    Returns:
        List of dispatch results per department
    """
    departments = incident.get("departments", [])
    results = []

    for dept in departments:
        result = await _send_department_alert(dept, incident)
        results.append(result)

    return results


async def _send_department_alert(department: str, incident: dict) -> dict:
    """Send alert to a specific department."""
    if USE_MOCK:
        return await _mock_dispatch(department, incident)

    # Real AWS SNS implementation
    try:
        import boto3

        client = boto3.client("sns", region_name=os.getenv("AWS_REGION", "ap-south-1"))

        topic_arn = TOPIC_ARNS.get(department)
        if not topic_arn or "000000000000" in topic_arn:
            return await _mock_dispatch(department, incident)

        # Build structured message
        message = _build_alert_message(department, incident)

        response = client.publish(
            TopicArn=topic_arn,
            Subject=f"🚨 {incident.get('severity', 'UNKNOWN').upper()} - {incident.get('type', 'Emergency')} [{incident.get('id')}]",
            Message=json.dumps(message),
            MessageAttributes={
                "severity": {"DataType": "String", "StringValue": incident.get("severity", "medium")},
                "incident_type": {"DataType": "String", "StringValue": incident.get("type", "Unknown")},
                "department": {"DataType": "String", "StringValue": department},
            },
        )

        return {
            "department": department,
            "status": "sent",
            "message_id": response.get("MessageId"),
        }
    except Exception as e:
        print(f"[WARNING] SNS dispatch failed for {department} ({type(e).__name__}: {e}). Using mock.")
        return await _mock_dispatch(department, incident)


def _build_alert_message(department: str, incident: dict) -> dict:
    """Build a structured alert payload for a department."""
    return {
        "alert_type": "EMERGENCY_DISPATCH",
        "incident_id": incident.get("id"),
        "department": department,
        "incident": {
            "type": incident.get("type"),
            "severity": incident.get("severity"),
            "location": incident.get("location"),
            "coordinates": incident.get("coordinates"),
            "casualties": incident.get("casualties"),
            "summary": incident.get("summary"),
        },
        "dispatch_time": incident.get("timestamp"),
        "source": "CivicAlert AI Triage Engine",
    }


async def _mock_dispatch(department: str, incident: dict) -> dict:
    """Mock dispatch for development — logs to console."""
    await asyncio.sleep(0.3)  # Simulate network latency

    print(f"  📢 [MOCK SNS] Dispatching to {department}")
    print(f"     Incident: {incident.get('id')} - {incident.get('type')}")
    print(f"     Severity: {incident.get('severity')}")
    print(f"     Location: {incident.get('location')}")
    print(f"     ─────────────────────────────")

    return {
        "department": department,
        "status": "sent (mock)",
        "message_id": f"mock-{department.lower().replace(' ', '-')}-001",
    }
