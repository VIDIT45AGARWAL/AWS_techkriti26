# 🚨 CivicAlert API Reference Manual

> **Version:** 1.0.0  
> **Backend Framework:** Python 3.11+ / FastAPI  
> **Default Base URL:** `http://localhost:8000` (Local) / `http://<EC2_BACKEND_IP>:8000` (AWS Production)  
> **WebSocket Base URL:** `ws://localhost:8000` / `ws://<EC2_BACKEND_IP>:8000`  
> **Protocol Support:** HTTP/1.1, HTTP/2, WebSocket (RFC 6455)

---

## 📋 Table of Contents

- [Overview](#-overview)
- [Architecture & Processing Pipeline](#-architecture--processing-pipeline)
- [Global Conventions & Headers](#-global-conventions--headers)
- [Error Codes & Diagnostics](#-error-codes--diagnostics)
- [Data Models & Schema Reference](#-data-models--schema-reference)
- [Supported Languages & Voice Personas](#-supported-languages--voice-personas)
- [REST API Endpoints](#-rest-api-endpoints)
  - [1. Root Service Info (`GET /`)](#1-root-service-info-get-)
  - [2. System Health Check (`GET /api/health`)](#2-system-health-check-get-apihealth)
  - [3. Submit Emergency Report (`POST /api/report`)](#3-submit-emergency-report-post-apireport)
  - [4. List Incidents (`GET /api/incidents`)](#4-list-incidents-get-apiincidents)
  - [5. Get Single Incident (`GET /api/incidents/{incident_id}`)](#5-get-single-incident-get-apiincidentsincident_id)
  - [6. Update Incident Status (`PATCH /api/incidents/{incident_id}/status`)](#6-update-incident-status-patch-apiincidentsincident_idstatus)
  - [7. Incident Analytics & Hotspots (`GET /api/analytics`)](#7-incident-analytics--hotspots-get-apianalytics)
  - [8. Text-to-Speech Synthesis (`POST /api/tts`)](#8-text-to-speech-synthesis-post-apitts)
- [WebSocket Streaming API](#-websocket-streaming-api)
  - [Real-Time Speech-to-Text (`WS /ws/transcribe`)](#real-time-speech-to-text-ws-wstranscribe)
  - [WebSocket Client Implementation Examples](#websocket-client-implementation-examples)

---

## 🌟 Overview

**CivicAlert** is an AI-powered, voice-first emergency incident reporting and dispatch engine. It enables citizens and first responders to submit emergency information through spoken audio or transcribed text in 6 Indian languages. 

The backend orchestrates real-time speech processing via **Sarvam AI**, cognitive triage and department classification via **Amazon Bedrock (Claude 3.5 Sonnet / Amazon Nova)**, forward and reverse geocoding via **AWS Location Service**, high-throughput fan-out alerting via **Amazon SNS**, and low-latency storage in **Amazon DynamoDB**.

---

## 🏗️ Architecture & Processing Pipeline

When an emergency report is submitted to `POST /api/report`, the backend executes an automated 5-stage triage and dispatch pipeline:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        POST /api/report Pipeline                       │
└────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ 1. AI Triage & Analysis (Amazon Bedrock / Claude / Amazon Nova)        │
│    • Classifies incident type (e.g. Building Fire, Multi-Vehicle Crash)│
│    • Computes severity level (critical, high, medium, low)             │
│    • Identifies reported casualties and trapped individuals            │
│    • Resolves multi-department routing with safety-enforced rules      │
│    • Extracts landmarks and place names from unstructured transcript   │
│    • Generates a structured 2-3 sentence emergency summary             │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ 2. Location & Coordinate Resolution (AWS Location Service)             │
│    • Priority 1: Geocodes location extracted by AI (with GPS bias)     │
│    • Priority 2: Uses device-provided GPS coordinates                  │
│    • Reverse geocodes coordinates into an Indian street address        │
│    • Preserves truthfulness: reports "Unknown location" if no GPS/data │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ 3. Incident Generation & Assembly                                      │
│    • Assigns unique identifier: INC-XXXXXXXX                           │
│    • Assembles canonical incident record with UTC timestamp            │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ 4. Persistence (Amazon DynamoDB)                                       │
│    • Persists record to civic-alert-incidents table                    │
│    • Normalizes coordinates, status flags, and confidence scores       │
│    • Falls back to mock store during local offline development         │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ 5. Multi-Department Notification Dispatch (Amazon SNS)                 │
│    • Dispatches structured JSON alerts to mapped SNS topics:           │
│      - Police                                                          │
│      - Fire Department                                                 │
│      - Medical Emergency                                               │
│      - Disaster Response                                               │
│    • Attaches message attributes for targeted filter policies          │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 🌐 Global Conventions & Headers

### Request Headers

| Header | Type | Value | Required | Description |
|---|---|---|---|---|
| `Content-Type` | string | `application/json` | Yes (for POST/PATCH) | MIME type for JSON payloads |
| `Accept` | string | `application/json` | No | Expected response format |

### Response Headers

All API responses include standard CORS headers allowing multi-origin access:
```http
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: *
Access-Control-Allow-Headers: *
Content-Type: application/json
```

### Date & Time Format
All timestamps are expressed in ISO-8601 UTC format:
```
YYYY-MM-DDTHH:MM:SSZ (e.g., 2026-10-25T11:05:30.123456Z)
```

---

## ⚠️ Error Codes & Diagnostics

CivicAlert returns RFC 7807-compliant HTTP status codes. When an error occurs, the response body contains a JSON payload with a `detail` message.

### Error Code Summary

| HTTP Status | Name | Meaning & Trigger Scenarios |
|---|---|---|
| **200 OK** | Success | Request succeeded. |
| **400 Bad Request** | Client Error | Missing required fields (e.g., empty transcript) or invalid values (e.g., invalid status transition). |
| **404 Not Found** | Resource Missing | The requested incident ID does not exist in the database. |
| **422 Unprocessable Entity** | Validation Error | Request body failed Pydantic schema validation (e.g., missing mandatory types, invalid JSON structure). |
| **500 Internal Server Error** | Server Error | Unhandled server exception during database read/write or AWS pipeline failure. |
| **502 Bad Gateway** | Upstream Failure | Upstream integration failure, such as Sarvam AI TTS/STT failure or missing API subscription keys. |

### Standard Error Formats

#### 400 Bad Request
```json
{
  "detail": "Provide transcript text"
}
```

```json
{
  "detail": "Invalid status. Must be one of: ['active', 'responding', 'resolved']"
}
```

#### 404 Not Found
```json
{
  "detail": "Incident not found"
}
```

#### 422 Unprocessable Entity
```json
{
  "detail": [
    {
      "type": "missing",
      "loc": ["body", "status"],
      "msg": "Field required",
      "input": {}
    }
  ]
}
```

#### 502 Bad Gateway
```json
{
  "detail": "Speech synthesis failed (check SARVAM_API_KEY)"
}
```

---

## 📦 Data Models & Schema Reference

### 1. `Coordinates`
Geographic coordinates on the WGS 84 datum.

```python
class Coordinates(BaseModel):
    lat: float
    lng: float
```

| Field | Type | Description | Example |
|---|---|---|---|
| `lat` | `float` | Latitude coordinate in decimal degrees | `26.4499` |
| `lng` | `float` | Longitude coordinate in decimal degrees | `80.3319` |

---

### 2. `IncidentReport`
Payload submitted by clients to trigger emergency triage and dispatch.

```python
class IncidentReport(BaseModel):
    transcript: Optional[str] = None
    language: str = "en-IN"
    coordinates: Optional[Coordinates] = None
```

| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| `transcript` | `string` | **Yes** (at runtime) | `null` | The raw text of the incident report. Can be in English or Indian regional languages. |
| `language` | `string` | No | `"en-IN"` | BCP-47 language code of the reporter. |
| `coordinates` | `Coordinates` | No | `null` | Device GPS coordinates at the time of reporting. |

---

### 3. `Incident`
The primary emergency incident entity generated by the triage engine and stored in DynamoDB.

```python
class Incident(BaseModel):
    id: str
    type: str
    severity: str
    departments: List[str]
    location: str
    coordinates: Optional[Coordinates] = None
    casualties: str
    summary: str
    transcript: str
    confidence: float
    status: str
    timestamp: str
    language: str = "en-IN"
```

| Field | Type | Description |
|---|---|---|
| `id` | `string` | Unique identifier prefixed with `INC-` and 8 uppercase hex characters (e.g., `INC-A3F8120C`). |
| `type` | `string` | AI-classified emergency category (e.g., `Building Fire`, `Road Accident`, `Flooding`, `Gas Leak`). |
| `severity` | `string` | Emergency priority level: `critical`, `high`, `medium`, or `low`. |
| `departments` | `string[]` | List of public safety agencies notified: `Police`, `Fire Department`, `Medical Emergency`, `Disaster Response`. |
| `location` | `string` | Geocoded human-readable street address or landmark (e.g., `"Sector 15, Kanpur, Uttar Pradesh 208002"`). |
| `coordinates` | `Coordinates` \| `null` | Resolved GPS coordinates for map plotting. |
| `casualties` | `string` | Casualties or injuries identified from report (e.g., `"3-5 people trapped, 2 injured"`). |
| `summary` | `string` | Concise 2–3 sentence briefing tailored for dispatchers. |
| `transcript` | `string` | The original raw input transcript. |
| `confidence` | `float` | Model confidence score normalized to percentage (`0.0` to `100.0`). |
| `status` | `string` | Current lifecycle state: `active`, `responding`, or `resolved`. |
| `timestamp` | `string` | ISO-8601 UTC creation timestamp (e.g., `"2026-10-25T11:05:30.123456Z"`). |
| `language` | `string` | BCP-47 language code of the submitted report. |

---

### 4. `StatusUpdate`
Payload used to transition an incident across lifecycle stages.

```python
class StatusUpdate(BaseModel):
    status: str
```

| Field | Type | Allowed Values | Description |
|---|---|---|---|
| `status` | `string` | `"active"`, `"responding"`, `"resolved"` | New lifecycle state of the incident. |

---

### 5. `TTSRequest`
Request payload for synthesizing speech from text.

```python
class TTSRequest(BaseModel):
    text: str
    language: str = "en-IN"
```

| Field | Type | Max Length | Description |
|---|---|---|---|
| `text` | `string` | 2,500 characters | Text content to synthesize into spoken audio. |
| `language` | `string` | - | BCP-47 language code. Determines speaker persona. Default: `"en-IN"`. |

---

## 🗣️ Supported Languages & Voice Personas

CivicAlert supports 6 major Indian languages for transcription and speech synthesis:

| Language Code | Language | Native Name | STT Model | TTS Model | Dispatch Announcer Persona |
|---|---|---|---|---|---|
| `en-IN` | Indian English | English | `saaras:v4` | `bulbul:v4-flash` | `ritu_en_medical` (Calm, medical dispatch) |
| `hi-IN` | Hindi | हिन्दी | `saaras:v4` | `bulbul:v4-flash` | `ritu_hi_medical` (Clear emergency voice) |
| `ta-IN` | Tamil | தமிழ் | `saaras:v4` | `bulbul:v4-flash` | `gokul_ta_narration` (Authoritative narration) |
| `te-IN` | Telugu | తెలుగు | `saaras:v4` | `bulbul:v4-flash` | `tarun_te_narration` (Authoritative narration) |
| `bn-IN` | Bengali | বাংলা | `saaras:v4` | `bulbul:v4-flash` | `roopa_bn_conversational` (Clear dispatch) |
| `mr-IN` | Marathi | मराठी | `saaras:v4` | `bulbul:v4-flash` | `ritu_mr_narration` (Narrative announcer) |

---

## 🔌 REST API Endpoints

### 1. Root Service Info (`GET /`)

Retrieves the service identity, operational status, version, and core API entry points.

#### Request
```http
GET / HTTP/1.1
Host: localhost:8000
Accept: application/json
```

#### cURL Example
```bash
curl -X GET http://localhost:8000/ \
  -H "Accept: application/json"
```

#### Response (`200 OK`)
```json
{
  "service": "CivicAlert API",
  "version": "1.0.0",
  "status": "operational",
  "endpoints": [
    "/api/report",
    "/api/incidents",
    "/api/analytics"
  ]
}
```

---

### 2. System Health Check (`GET /api/health`)

Liveness and readiness probe for load balancers (AWS ALB), container orchestrators, and monitoring daemons.

#### Request
```http
GET /api/health HTTP/1.1
Host: localhost:8000
Accept: application/json
```

#### cURL Example
```bash
curl -X GET http://localhost:8000/api/health
```

#### Response (`200 OK`)
```json
{
  "status": "healthy",
  "timestamp": "2026-10-25T11:00:00.000000Z"
}
```

---

### 3. Submit Emergency Report (`POST /api/report`)

Submits an emergency incident report. This triggers the complete triage pipeline: Bedrock LLM analysis, AWS Location forward/reverse geocoding, DynamoDB storage, and multi-department Amazon SNS alert dispatch.

#### Request
```http
POST /api/report HTTP/1.1
Host: localhost:8000
Content-Type: application/json
Accept: application/json
```

#### Request Body
| Field | Type | Required | Description |
|---|---|---|---|
| `transcript` | `string` | **Yes** | Emergency statement describing what occurred. |
| `language` | `string` | No | Language code (default: `"en-IN"`). |
| `coordinates` | `Coordinates` | No | Optional GPS coordinates `{ "lat": float, "lng": float }`. |

#### cURL Example 1: Location Extracted from Speech with GPS Bias
```bash
curl -X POST http://localhost:8000/api/report \
  -H "Content-Type: application/json" \
  -d '{
    "transcript": "Major cylinder explosion and massive fire on the 3rd floor at Sector 15 Kanpur. Multiple people are trapped and screaming with burn injuries. Smoke is spreading rapidly.",
    "language": "en-IN",
    "coordinates": {
      "lat": 26.4499,
      "lng": 80.3319
    }
  }'
```

#### cURL Example 2: Multilingual Hindi Emergency Report
```bash
curl -X POST http://localhost:8000/api/report \
  -H "Content-Type: application/json" \
  -d '{
    "transcript": "सिविल लाइंस लखनऊ में बस और कार की भयंकर टक्कर हुई है। चार लोग गंभीर रूप से घायल हैं और खून बह रहा है। तुरंत एम्बुलेंस और पुलिस भेजिए।",
    "language": "hi-IN"
  }'
```

#### Response (`200 OK`)
```json
{
  "id": "INC-7D9A4C12",
  "type": "Building Fire",
  "severity": "critical",
  "departments": [
    "Fire Department",
    "Medical Emergency",
    "Police"
  ],
  "location": "Sector 15, Kanpur, Uttar Pradesh 208002",
  "coordinates": {
    "lat": 26.4499,
    "lng": 80.3319
  },
  "casualties": "Multiple people trapped on 3rd floor, confirmed burn injuries",
  "summary": "Major gas cylinder explosion on the 3rd floor of a residential building in Sector 15, Kanpur. Heavy smoke visible with residents trapped and multiple burn casualties reported. Immediate fire suppression, EMS triage, and police crowd control required.",
  "transcript": "Major cylinder explosion and massive fire on the 3rd floor at Sector 15 Kanpur. Multiple people are trapped and screaming with burn injuries. Smoke is spreading rapidly.",
  "confidence": 96.5,
  "status": "active",
  "timestamp": "2026-10-25T11:05:30.412891Z",
  "language": "en-IN"
}
```

#### Error Responses

##### `400 Bad Request` — Missing Transcript
Returned when `transcript` is omitted or empty.
```json
{
  "detail": "Provide transcript text"
}
```

##### `422 Unprocessable Entity` — Invalid Types
Returned when JSON formatting or data types are invalid.
```json
{
  "detail": [
    {
      "type": "float_parsing",
      "loc": ["body", "coordinates", "lat"],
      "msg": "Input should be a valid number, unable to parse string as an extractable float",
      "input": "invalid-lat"
    }
  ]
}
```

---

### 4. List Incidents (`GET /api/incidents`)

Retrieves a filtered, chronologically sorted list of all registered emergency incidents (latest first).

#### Query Parameters

| Parameter | Type | Required | Allowed Values | Description |
|---|---|---|---|---|
| `department` | `string` | No | `Police`, `Fire Department`, `Medical Emergency`, `Disaster Response` | Filters incidents routed to this department. |
| `severity` | `string` | No | `critical`, `high`, `medium`, `low` | Filters incidents by assessed severity level. |
| `status` | `string` | No | `active`, `responding`, `resolved` | Filters incidents by current response status. |

#### cURL Example
```bash
# Retrieve active, critical incidents assigned to Fire Department
curl -X GET "http://localhost:8000/api/incidents?department=Fire%20Department&severity=critical&status=active" \
  -H "Accept: application/json"
```

#### Response (`200 OK`)
```json
[
  {
    "id": "INC-7D9A4C12",
    "type": "Building Fire",
    "severity": "critical",
    "departments": [
      "Fire Department",
      "Medical Emergency",
      "Police"
    ],
    "location": "Sector 15, Kanpur, Uttar Pradesh 208002",
    "coordinates": {
      "lat": 26.4499,
      "lng": 80.3319
    },
    "casualties": "Multiple people trapped, 2 injured",
    "summary": "Major gas cylinder explosion on the 3rd floor. Heavy smoke spreading. Fire and Medical dispatch active.",
    "transcript": "Major cylinder explosion and fire at Sector 15 Kanpur...",
    "confidence": 96.5,
    "status": "active",
    "timestamp": "2026-10-25T11:05:30.412891Z",
    "language": "en-IN"
  },
  {
    "id": "INC-81B340DF",
    "type": "Chemical Leak",
    "severity": "critical",
    "departments": [
      "Fire Department",
      "Disaster Response"
    ],
    "location": "Panki Industrial Area, Kanpur",
    "coordinates": {
      "lat": 26.4721,
      "lng": 80.2458
    },
    "casualties": "Multiple factory workers experiencing respiratory distress",
    "summary": "Toxic gas leak reported from chemical storage facility. Surrounding perimeter evacuated.",
    "transcript": "Toxic gas leak from tank in Panki industrial area...",
    "confidence": 93.0,
    "status": "active",
    "timestamp": "2026-10-25T10:48:12.109284Z",
    "language": "en-IN"
  }
]
```

---

### 5. Get Single Incident (`GET /api/incidents/{incident_id}`)

Retrieves complete information for a specific emergency incident.

#### Path Parameters

| Parameter | Type | Required | Description |
|---|---|---|---|
| `incident_id` | `string` | **Yes** | The incident identifier (e.g., `INC-7D9A4C12`). |

#### cURL Example
```bash
curl -X GET http://localhost:8000/api/incidents/INC-7D9A4C12 \
  -H "Accept: application/json"
```

#### Response (`200 OK`)
```json
{
  "id": "INC-7D9A4C12",
  "type": "Building Fire",
  "severity": "critical",
  "departments": [
    "Fire Department",
    "Medical Emergency",
    "Police"
  ],
  "location": "Sector 15, Kanpur, Uttar Pradesh 208002",
  "coordinates": {
    "lat": 26.4499,
    "lng": 80.3319
  },
  "casualties": "Multiple people trapped, 2 injured",
  "summary": "Major gas cylinder explosion on the 3rd floor. Heavy smoke spreading.",
  "transcript": "Major cylinder explosion and massive fire on the 3rd floor at Sector 15 Kanpur...",
  "confidence": 96.5,
  "status": "active",
  "timestamp": "2026-10-25T11:05:30.412891Z",
  "language": "en-IN"
}
```

#### Error Response (`404 Not Found`)
```json
{
  "detail": "Incident not found"
}
```

---

### 6. Update Incident Status (`PATCH /api/incidents/{incident_id}/status`)

Updates the lifecycle status of an emergency incident as agency responders engage and resolve the situation.

#### Path Parameters

| Parameter | Type | Required | Description |
|---|---|---|---|
| `incident_id` | `string` | **Yes** | The incident identifier (e.g., `INC-7D9A4C12`). |

#### Request Body (`StatusUpdate`)

| Field | Type | Required | Allowed Values | Description |
|---|---|---|---|---|
| `status` | `string` | **Yes** | `"active"`, `"responding"`, `"resolved"` | New operational status. |

#### Allowed Lifecycle Transitions

```
┌──────────┐     Agencies Dispatched     ┌──────────────┐     All Clear / Closed     ┌────────────┐
│  active  │ ──────────────────────────▷ │  responding  │ ─────────────────────────▷ │  resolved  │
└──────────┘                             └──────────────┘                            └────────────┘
```

#### cURL Example
```bash
curl -X PATCH http://localhost:8000/api/incidents/INC-7D9A4C12/status \
  -H "Content-Type: application/json" \
  -d '{
    "status": "responding"
  }'
```

#### Response (`200 OK`)
```json
{
  "id": "INC-7D9A4C12",
  "type": "Building Fire",
  "severity": "critical",
  "departments": [
    "Fire Department",
    "Medical Emergency",
    "Police"
  ],
  "location": "Sector 15, Kanpur, Uttar Pradesh 208002",
  "coordinates": {
    "lat": 26.4499,
    "lng": 80.3319
  },
  "casualties": "Multiple people trapped, 2 injured",
  "summary": "Major gas cylinder explosion on the 3rd floor. Heavy smoke spreading.",
  "transcript": "Major cylinder explosion and massive fire on the 3rd floor at Sector 15 Kanpur...",
  "confidence": 96.5,
  "status": "responding",
  "timestamp": "2026-10-25T11:05:30.412891Z",
  "language": "en-IN"
}
```

#### Error Responses

##### `400 Bad Request` — Invalid Status Value
```json
{
  "detail": "Invalid status. Must be one of: ['active', 'responding', 'resolved']"
}
```

##### `404 Not Found` — Incident Missing
```json
{
  "detail": "Incident not found or update failed"
}
```

---

### 7. Incident Analytics & Hotspots (`GET /api/analytics`)

Computes real-time incident analytics across the entire database or scoped to a specific responding agency.

#### Query Parameters

| Parameter | Type | Required | Description |
|---|---|---|---|
| `department` | `string` | No | Scope metrics to a department (`Police`, `Fire Department`, `Medical Emergency`, `Disaster Response`). |

#### cURL Example
```bash
curl -X GET "http://localhost:8000/api/analytics?department=Medical%20Emergency" \
  -H "Accept: application/json"
```

#### Response (`200 OK`)
```json
{
  "total_incidents": 142,
  "active_incidents": 18,
  "responding_incidents": 24,
  "resolved_incidents": 100,
  "avg_response_time": 4.2,
  "resolution_rate": 70.4,
  "incidents_by_type": {
    "Building Fire": 38,
    "Road Accident": 64,
    "Medical Emergency": 22,
    "Gas Leak": 10,
    "Flooding": 8
  },
  "severity_distribution": {
    "critical": 32,
    "high": 48,
    "medium": 44,
    "low": 18
  },
  "department_performance": {
    "Police": 110,
    "Fire Department": 54,
    "Medical Emergency": 88,
    "Disaster Response": 14
  },
  "location_hotspots": {
    "Kanpur": 48,
    "Lucknow": 34,
    "Noida": 26,
    "New Delhi": 22,
    "Mumbai": 12
  }
}
```

#### Field Descriptions

| Field | Type | Description |
|---|---|---|
| `total_incidents` | `integer` | Count of all matching incidents. |
| `active_incidents` | `integer` | Count of pending incidents awaiting response. |
| `responding_incidents` | `integer` | Count of incidents with units en route or on-scene. |
| `resolved_incidents` | `integer` | Count of safely resolved incidents. |
| `avg_response_time` | `float` | Average response dispatch latency in minutes. |
| `resolution_rate` | `float` | Percentage of incidents resolved (`(resolved / total) * 100`). |
| `incidents_by_type` | `object` | Dictionary mapping incident types to occurrence counts. |
| `severity_distribution` | `object` | Counts grouped by `critical`, `high`, `medium`, `low`. |
| `department_performance`| `object` | Incident volume mapped across all 4 canonical departments. |
| `location_hotspots` | `object` | Frequency map of cities and localities extracted from incidents. |

---

### 8. Text-to-Speech Synthesis (`POST /api/tts`)

Synthesizes spoken audio from text using **Sarvam Bulbul v4 Flash**. Returns a Base64-encoded `data:audio/mpeg;base64` data URL ready for HTML5 `<audio>` playback in web dashboards or voice dispatch radios.

#### Request
```http
POST /api/tts HTTP/1.1
Host: localhost:8000
Content-Type: application/json
Accept: application/json
```

#### Request Body (`TTSRequest`)

| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| `text` | `string` | **Yes** | - | Text to synthesize (max 2,500 characters). |
| `language` | `string` | No | `"en-IN"` | Target language code. Selects regional voice persona. |

#### cURL Example
```bash
curl -X POST http://localhost:8000/api/tts \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Attention Fire and Medical units: Building fire reported at Sector 15 Kanpur. Multiple people trapped on 3rd floor. Units respond immediately on priority channel 2.",
    "language": "en-IN"
  }'
```

#### Response (`200 OK`)
```json
{
  "audio": "data:audio/mpeg;base64,//uQxAAAAANIAAAAAExBTUUzLjEwMC...",
  "model": "bulbul:v4-flash",
  "speaker": "ritu_en_medical",
  "language": "en-IN"
}
```

#### Error Response (`502 Bad Gateway`)
Returned when the Sarvam API request fails, network times out, or `SARVAM_API_KEY` is missing/invalid.
```json
{
  "detail": "Speech synthesis failed (check SARVAM_API_KEY)"
}
```

---

## ⚡ WebSocket Streaming API

### Real-Time Speech-to-Text (`WS /ws/transcribe`)

The WebSocket endpoint provides real-time, low-latency audio streaming and transcription backed by **Sarvam Saaras v4**.

- **URL:** `ws://localhost:8000/ws/transcribe`
- **Supported Audio Formats:** 
  - Raw binary PCM 16-bit signed, little-endian, mono audio @ 16,000 Hz.
  - JSON-wrapped base64 audio frames: `{"type": "audio", "data": "<base64>"}`

---

### Protocol State Machine

```
Client                                                  Server
  │                                                       │
  │── 1. {"type": "config", "language": "en-IN"} ─────────▶│
  │◀─ 2. {"type": "ready"} ───────────────────────────────│
  │                                                       │
  │── 3. [Binary PCM chunk / 16kHz mono] ─────────────────▶│ (Continuous)
  │── 3. [Binary PCM chunk / 16kHz mono] ─────────────────▶│
  │                                                       │
  │◀─ 4. {"type": "transcript", "text": "...",            │ (Emitted every ~10s
  │       "is_partial": true} ────────────────────────────│  of buffered audio)
  │                                                       │
  │── 5. {"type": "stop"} ────────────────────────────────▶│
  │                                                       │ (Final full-pass retranscription)
  │◀─ 6. {"type": "transcript", "text": "...",            │
  │       "is_partial": false} ───────────────────────────│
  │◀─ 6. {"type": "done"} ────────────────────────────────│
  │                                                       │
  ▼                                                       ▼
```

---

### Step-by-Step Message Specification

#### Step 1: Client Configuration
Immediately after WebSocket connection acceptance, the client must send a configuration message:
```json
{
  "type": "config",
  "language": "en-IN",
  "sampleRate": 16000
}
```
- `type`: Must be `"config"`
- `language`: Supported language code (`en-IN`, `hi-IN`, `ta-IN`, `te-IN`, `bn-IN`, `mr-IN`)
- `sampleRate`: Integer audio sample rate in Hz (recommended: `16000`)

#### Step 2: Server Ready Acknowledgment
The server validates the configuration and confirms readiness:
```json
{
  "type": "ready"
}
```

#### Step 3: Streaming Audio Chunks
The client streams audio in continuous chunks. Two transport formats are accepted:
1. **Raw Binary (Recommended):** Binary WebSocket frames containing raw PCM 16-bit mono bytes.
2. **JSON Wrapped:** Text WebSocket frames formatted as:
   ```json
   {
     "type": "audio",
     "data": "UklGRiQAAABXQVZFZm10IBAAAAABAAEA..."
   }
   ```

#### Step 4: Server Streaming Partial Transcripts
As audio flows in, the server buffers chunks into live segments and periodically emits partial recognition results:
```json
{
  "type": "transcript",
  "text": "there is a large fire in sector fifteen",
  "is_partial": true
}
```

#### Step 5: Client Stop Signal
When the speaker stops recording, the client sends a stop message:
```json
{
  "type": "stop"
}
```

#### Step 6: Final Transcript & Completion
The server performs a high-accuracy final transcription pass over the accumulated audio, emits the completed transcript, and sends the completion sentinel:
```json
{
  "type": "transcript",
  "text": "There is a large fire in Sector 15 Kanpur. Multiple people are trapped on the third floor.",
  "is_partial": false
}
```
followed by:
```json
{
  "type": "done"
}
```

#### Error Frame
If an unhandled exception occurs on the server:
```json
{
  "type": "error",
  "message": "Sarvam STT failed (401): Invalid API Key"
}
```

---

## 💻 WebSocket Client Implementation Examples

### 1. Browser JavaScript / TypeScript Client

```javascript
class CivicAlertAudioStreamer {
  constructor(wsUrl = "ws://localhost:8000/ws/transcribe", language = "en-IN") {
    this.wsUrl = wsUrl;
    this.language = language;
    this.ws = null;
    this.audioContext = null;
    this.mediaStream = null;
    this.processor = null;
  }

  async start(onTranscript) {
    this.ws = new WebSocket(this.wsUrl);
    this.ws.binaryType = "arraybuffer";

    this.ws.onopen = () => {
      // Step 1: Send configuration
      this.ws.send(JSON.stringify({
        type: "config",
        language: this.language,
        sampleRate: 16000
      }));
    };

    this.ws.onmessage = async (event) => {
      const msg = JSON.parse(event.data);
      
      if (msg.type === "ready") {
        console.log("Server ready, capturing microphone audio...");
        await this._startAudioRecording();
      } else if (msg.type === "transcript") {
        onTranscript(msg.text, msg.is_partial);
      } else if (msg.type === "done") {
        console.log("Transcription session completed.");
        this.cleanup();
      } else if (msg.type === "error") {
        console.error("Transcription error:", msg.message);
      }
    };
  }

  async _startAudioRecording() {
    this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
      sampleRate: 16000
    });
    this.mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: { channelCount: 1, sampleRate: 16000 }
    });

    const source = this.audioContext.createMediaStreamSource(this.mediaStream);
    // 2048 samples = ~128ms per chunk
    this.processor = this.audioContext.createScriptProcessor(2048, 1, 1);

    this.processor.onaudioprocess = (e) => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        const float32Data = e.inputBuffer.getChannelData(0);
        // Convert Float32 to Int16 PCM
        const pcm16 = new Int16Array(float32Data.length);
        for (let i = 0; i < float32Data.length; i++) {
          const s = Math.max(-1, Math.min(1, float32Data[i]));
          pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }
        // Send raw binary frame
        this.ws.send(pcm16.buffer);
      }
    };

    source.connect(this.processor);
    this.processor.connect(this.audioContext.destination);
  }

  stop() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: "stop" }));
    }
    if (this.processor) {
      this.processor.disconnect();
    }
  }

  cleanup() {
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
    }
    if (this.audioContext) {
      this.audioContext.close();
    }
    if (this.ws) {
      this.ws.close();
    }
  }
}

// Usage Example:
// const streamer = new CivicAlertAudioStreamer("ws://localhost:8000/ws/transcribe", "hi-IN");
// streamer.start((text, isPartial) => {
//   console.log(`[${isPartial ? 'LIVE' : 'FINAL'}] ${text}`);
// });
// To stop: streamer.stop();
```

---

### 2. Python Client Example

```python
import asyncio
import json
import websockets
import wave

async def stream_audio_file(file_path: str, language: str = "en-IN"):
    uri = "ws://localhost:8000/ws/transcribe"
    
    async with websockets.connect(uri) as ws:
        # Step 1: Send configuration
        await ws.send(json.dumps({
            "type": "config",
            "language": language,
            "sampleRate": 16000
        }))
        
        # Step 2: Await ready signal
        ready = json.loads(await ws.recv())
        if ready.get("type") != "ready":
            print(f"Unexpected response: {ready}")
            return
        
        print("Connected and ready. Streaming audio file...")

        async def sender():
            with wave.open(file_path, "rb") as wf:
                chunk_size = 3200  # 100ms at 16kHz 16-bit mono (3200 bytes)
                while True:
                    data = wf.readframes(1600)
                    if not data:
                        break
                    await ws.send(data)
                    await asyncio.sleep(0.1)
            # Step 5: Send stop sentinel
            await ws.send(json.dumps({"type": "stop"}))

        async def receiver():
            async for message in ws:
                data = json.loads(message)
                msg_type = data.get("type")
                if msg_type == "transcript":
                    status = "PARTIAL" if data.get("is_partial") else "FINAL"
                    print(f"[{status}] {data.get('text')}")
                elif msg_type == "done":
                    print("Transcription stream complete.")
                    break
                elif msg_type == "error":
                    print(f"Error: {data.get('message')}")
                    break

        await asyncio.gather(sender(), receiver())

# Run with: asyncio.run(stream_audio_file("sample_emergency.wav", "en-IN"))
```

---

## 🔒 Security & Deployment Notes

1. **Environment Variables:**
   - `SARVAM_API_KEY`: Required for real-time Sarvam STT and Bulbul TTS.
   - `BEDROCK_MODEL_ID`: Configurable Bedrock model identifier (e.g., `apac.amazon.nova-lite-v1:0` or `apac.anthropic.claude-3-5-sonnet-20241022-v2:0`).
   - `DYNAMODB_TABLE_NAME`: Default `civic-alert-incidents-dev` (or `civic-alert-incidents-prod`).
   - `LOCATION_INDEX_NAME`: AWS Location Place Index resource name.
   - `SNS_TOPIC_POLICE`, `SNS_TOPIC_FIRE`, `SNS_TOPIC_MEDICAL`, `SNS_TOPIC_DISASTER`: Target SNS ARNs.
   - `USE_MOCK`: Set to `true` for offline development without active AWS credentials.

2. **CORS:**
   The API is configured with permissive CORS (`allow_origins=["*"]`) for hackathon integration across Next.js local servers, S3 static sites, and mobile clients. For production hardening, restrict `allow_origins` to your verified domain list.
