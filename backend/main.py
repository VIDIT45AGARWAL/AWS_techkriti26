from fastapi import FastAPI, UploadFile, File, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
import uuid
import json
import asyncio
import base64
import os
from dotenv import load_dotenv

load_dotenv()

from services.transcribe import transcribe_audio, transcribe_audio_streaming
from services.bedrock import analyze_incident
from services.sns import dispatch_alerts
from services.location import reverse_geocode, geocode
from services.dynamodb import (
    put_incident as db_put,
    get_incidents as db_get_all,
    get_incident as db_get_one,
    get_analytics as db_analytics,
    update_incident_status as db_update_status
)

app = FastAPI(
    title="CivicAlert API",
    description="AI-powered emergency incident reporting and dispatch system",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Models ───

class Coordinates(BaseModel):
    lat: float
    lng: float

class IncidentReport(BaseModel):
    transcript: Optional[str] = None
    language: str = "en-IN"
    coordinates: Optional[Coordinates] = None

class Incident(BaseModel):
    id: str
    type: str
    severity: str
    departments: List[str]
    location: str
    coordinates: Coordinates
    casualties: str
    summary: str
    transcript: str
    confidence: float
    status: str
    timestamp: str
    language: str = "en-IN"


# ─── Routes ───

@app.get("/")
def root():
    return {
        "service": "CivicAlert API",
        "version": "1.0.0",
        "status": "operational",
        "endpoints": ["/api/report", "/api/incidents", "/api/analytics"],
    }


@app.post("/api/report", response_model=Incident)
async def report_incident(report: IncidentReport):
    """
    Submit an emergency report via text transcript.
    The system will:
    1. Analyze & classify via Amazon Bedrock
    2. Extract location from transcript or use provided coordinates
    3. Reverse geocode coordinates via AWS Location Service
    4. Dispatch alerts via Amazon SNS
    5. Store incident in DynamoDB
    """
    if not report.transcript:
        raise HTTPException(status_code=400, detail="Provide transcript text")
    
    transcript = report.transcript

    # Step 1: Analyze with Bedrock
    analysis = await analyze_incident(transcript)

    # Step 2: Determine coordinates
    coords = None
    
    # Priority 1: Use location extracted from transcript
    if analysis.get("location_extracted"):
        geocoded = await geocode(analysis["location_extracted"])
        if geocoded:
            coords = Coordinates(lat=geocoded[0], lng=geocoded[1])
    
    # Priority 2: Use coordinates provided by user
    if not coords and report.coordinates:
        coords = report.coordinates
    
    # Priority 3: Fallback to Kanpur (default location)
    if not coords:
        coords = Coordinates(lat=26.4499, lng=80.3319)
    
    location = await reverse_geocode(coords.lat, coords.lng)

    # Step 3: Build incident
    incident_id = f"INC-{str(uuid.uuid4())[:8].upper()}"
    incident = Incident(
        id=incident_id,
        type=analysis["incident_type"],
        severity=analysis["severity"],
        departments=analysis["departments"],
        location=location,
        coordinates=coords,
        casualties=analysis["casualties"],
        summary=analysis["summary"],
        transcript=transcript,
        confidence=analysis["confidence"],
        status="active",
        timestamp=datetime.utcnow().isoformat(),
        language=report.language,
    )

    # Step 4: Store in DynamoDB
    await db_put(incident.model_dump())

    # Step 5: Dispatch SNS alerts
    await dispatch_alerts(incident.model_dump())
    
    # Log department reasoning if available
    if analysis.get("department_reasoning"):
        print(f"[DEPARTMENT REASONING]: {analysis['department_reasoning']}")

    return incident


@app.get("/api/incidents")
async def get_incidents(
    department: Optional[str] = None,
    severity: Optional[str] = None,
    status: Optional[str] = None,
):
    """Get all incidents with optional filters."""
    results = await db_get_all(department=department, severity=severity, status=status)
    return results


class StatusUpdate(BaseModel):
    status: str

@app.get("/api/incidents/{incident_id}")
async def get_incident(incident_id: str):
    """Get a single incident by ID."""
    incident = await db_get_one(incident_id)
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")
    return incident


@app.patch("/api/incidents/{incident_id}/status")
async def update_status(incident_id: str, update: StatusUpdate):
    """Update the status of an incident (e.g., mark as resolved)."""
    valid_statuses = ["active", "responding", "resolved"]
    if update.status not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of: {valid_statuses}")
    
    updated = await db_update_status(incident_id, update.status)
    if not updated:
        raise HTTPException(status_code=404, detail="Incident not found or update failed")
    
    return updated


@app.get("/api/analytics")
async def get_analytics(department: Optional[str] = None):
    """Get aggregated analytics data computed from stored incidents. Optionally filter by department."""
    return await db_analytics(department=department)


@app.get("/api/health")
def health_check():
    return {"status": "healthy", "timestamp": datetime.utcnow().isoformat()}


# ─── WebSocket: Real-time Voice Transcription ───

@app.websocket("/ws/transcribe")
async def websocket_transcribe(websocket: WebSocket):
    """
    WebSocket endpoint for real-time speech-to-text.
    
    Protocol:
    1. Client sends JSON: {"type": "config", "language": "en-IN", "sampleRate": 16000}
    2. Client sends binary audio chunks (PCM 16-bit or base64-encoded)
    3. Server streams back JSON: {"type": "transcript", "text": "...", "is_partial": true/false}
    4. Client sends JSON: {"type": "stop"} to end the stream
    """
    await websocket.accept()
    
    language = "en-IN"
    sample_rate = 16000
    audio_queue: asyncio.Queue = asyncio.Queue()
    is_streaming = True
    
    try:
        # Wait for config message
        config_data = await websocket.receive_text()
        config = json.loads(config_data)
        if config.get("type") == "config":
            language = config.get("language", "en-IN")
            sample_rate = config.get("sampleRate", 16000)
            await websocket.send_json({"type": "ready"})
        
        async def audio_chunk_generator():
            """Yield audio chunks from the WebSocket."""
            while is_streaming:
                try:
                    chunk = await asyncio.wait_for(audio_queue.get(), timeout=1.0)
                    if chunk is None:
                        break
                    yield chunk
                except asyncio.TimeoutError:
                    continue
        
        async def receive_audio():
            """Receive audio data from WebSocket and queue it."""
            nonlocal is_streaming
            try:
                while is_streaming:
                    message = await websocket.receive()
                    if message.get("type") == "websocket.disconnect":
                        break
                    
                    if "bytes" in message:
                        await audio_queue.put(message["bytes"])
                    elif "text" in message:
                        data = json.loads(message["text"])
                        if data.get("type") == "stop":
                            break
                        elif data.get("type") == "audio" and "data" in data:
                            audio_bytes = base64.b64decode(data["data"])
                            await audio_queue.put(audio_bytes)
            except WebSocketDisconnect:
                pass
            finally:
                is_streaming = False
                await audio_queue.put(None)
        
        # Start receiving audio in background
        receive_task = asyncio.create_task(receive_audio())
        
        # Stream transcription results back to client
        async for transcript_json in transcribe_audio_streaming(
            audio_chunk_generator(),
            language_code=language,
            sample_rate=sample_rate,
        ):
            transcript_data = json.loads(transcript_json)
            await websocket.send_json({
                "type": "transcript",
                "text": transcript_data["text"],
                "is_partial": transcript_data["is_partial"],
            })
        
        # Send completion
        await websocket.send_json({"type": "done"})
        receive_task.cancel()
        
    except WebSocketDisconnect:
        pass
    except Exception as e:
        try:
            await websocket.send_json({"type": "error", "message": str(e)})
        except:
            pass
