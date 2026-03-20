# Design: CivicAlert — AI-Powered Emergency Response System

## 1. System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT (Browser)                          │
│  Next.js 14 App Router — Static Export (S3 + CloudFront)        │
│                                                                   │
│  /                  Landing page + embedded report widget        │
│  /report            Voice recording + triage result              │
│  /dashboard         Global incident feed + live map              │
│  /analytics         Aggregated charts + hotspots                 │
│  /agencies          Agency listing                               │
│  /agencies/[agency] Per-agency dashboard + analytics             │
└────────────────────────┬────────────────────────────────────────┘
                         │ HTTP / WebSocket
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                    BACKEND (FastAPI on EC2)                       │
│                                                                   │
│  POST /api/report          Submit transcript → full pipeline     │
│  GET  /api/incidents       List incidents (filterable)           │
│  GET  /api/incidents/:id   Single incident                       │
│  PATCH /api/incidents/:id/status  Update status                  │
│  GET  /api/analytics       Aggregated stats                      │
│  WS   /ws/transcribe       Real-time audio → text stream         │
└──────┬──────────┬──────────┬──────────┬──────────┬──────────────┘
       │          │          │          │          │
       ▼          ▼          ▼          ▼          ▼
  Bedrock    Transcribe   Location    SNS      DynamoDB
  (Claude)   (Speech→Text) (Geocode) (Alerts) (Storage)
```

---

## 2. Frontend Architecture

### 2.1 Tech Stack
- **Framework**: Next.js 14 with App Router, TypeScript
- **Styling**: CSS Modules + global design tokens (CSS variables)
- **Animation**: Framer Motion
- **Map**: Leaflet (dynamic import, SSR-disabled)
- **Charts**: Recharts
- **Icons**: Lucide React

### 2.2 Design System

CSS variables defined in `globals.css`:
```css
--accent-red, --accent-blue, --accent-green, --accent-amber, --accent-purple, --accent-cyan
--bg-primary, --bg-secondary, --bg-card
--text-primary, --text-secondary, --text-muted
--border-subtle
```

Shared utility classes: `.glass-card`, `.btn-primary`, `.btn-secondary`, `.badge`, `.badge-critical`, `.badge-high`, `.badge-medium`, `.badge-low`, `.container`, `.section`

### 2.3 Component Tree

```
layout.tsx (root — Navbar + portal root)
├── page.tsx (landing)
│   ├── ParticleField
│   ├── AnimationHelpers (ScrollProgress, TiltCard, StaggerContainer, etc.)
│   └── ReportPage (embedded at #report anchor)
├── report/page.tsx
│   └── Voice recording + WebSocket + triage result UI
├── dashboard/page.tsx
│   ├── MapView → MapViewInner (Leaflet, dynamic)
│   └── Incident feed + detail panel
├── analytics/page.tsx
│   └── Recharts (BarChart, PieChart, AreaChart)
├── agencies/page.tsx
│   └── Agency cards grid
└── agencies/[agency]/layout.tsx
    ├── AgencyTabs (Dashboard | Analytics)
    ├── agencies/[agency]/dashboard/page.tsx
    └── agencies/[agency]/analytics/page.tsx
```

### 2.4 Voice Recording Flow

```
User taps mic button
        │
        ▼
navigator.mediaDevices.getUserMedia({ audio: { sampleRate: 16000 } })
        │
        ├─ Success ──▶ AudioContext + AnalyserNode (waveform visualization)
        │              ScriptProcessorNode (PCM capture)
        │              WebSocket → /ws/transcribe
        │              Send config: { type, language, sampleRate }
        │              Stream PCM binary chunks
        │              Receive { type: "transcript", text, is_partial }
        │
        └─ Failure ──▶ simulateFallbackTranscription() (word-by-word mock)

User taps stop
        │
        ▼
Close WebSocket + AudioContext + MediaStream
POST /api/report { transcript, language, coordinates }
        │
        ▼
Display processing steps → Show triage result
```

### 2.5 Environment Configuration

```
NEXT_PUBLIC_API_URL=http://<EC2_IP>:8000   # Set by npm run deploy
```

---

## 3. Backend Architecture

### 3.1 Tech Stack
- **Framework**: FastAPI (Python 3.11+)
- **Server**: Uvicorn (ASGI)
- **AWS SDK**: boto3
- **HTTP Client**: aiohttp (for Anthropic API)
- **Config**: python-dotenv

### 3.2 Incident Processing Pipeline

```
POST /api/report
        │
        ▼
1. analyze_incident(transcript)          ← bedrock.py
   Returns: type, severity, casualties,
            departments, summary, confidence,
            location_extracted (optional)
        │
        ▼
2. Location resolution (priority order):
   a. geocode(location_extracted)        ← location.py
   b. report.coordinates (GPS from user)
   c. Default: Kanpur (26.4499, 80.3319)
        │
        ▼
3. reverse_geocode(lat, lng)             ← location.py
   Returns: human-readable address string
        │
        ▼
4. Build Incident object (Pydantic model)
   id = "INC-{uuid[:8].upper()}"
   status = "active"
   timestamp = UTC ISO string
        │
        ├──▶ db_put(incident)            ← dynamodb.py
        └──▶ dispatch_alerts(incident)   ← sns.py (parallel per dept)
        │
        ▼
Return Incident JSON to client
```

### 3.3 Service Layer

| Module | Responsibility | Mock fallback |
|---|---|---|
| `bedrock.py` | AI triage via Claude (Bedrock or Anthropic API) | Keyword-based classifier |
| `transcribe.py` | Speech-to-text streaming via Amazon Transcribe | Echo/passthrough |
| `location.py` | Geocoding + reverse geocoding via AWS Location | Hardcoded Kanpur coords |
| `sns.py` | SNS alert dispatch per department | Console log |
| `dynamodb.py` | Incident CRUD + analytics aggregation | `mock_db.json` file |

### 3.4 AI Provider Configuration

```
USE_MOCK=true           → keyword-based mock (no AWS needed)
USE_MOCK=false + USE_ANTHROPIC_API=false → AWS Bedrock (Claude via inference profile)
USE_MOCK=false + USE_ANTHROPIC_API=true  → Anthropic API directly
```

Supported Bedrock models (in order of preference):
1. `apac.anthropic.claude-sonnet-4-20250514-v1:0` (extended thinking)
2. `apac.anthropic.claude-3-5-sonnet-20241022-v2:0`
3. `anthropic.claude-3-sonnet-20240229-v1:0` (on-demand fallback)

### 3.5 DynamoDB Schema

Table: `civic-alert-incidents-{env}`  
Partition key: `incident_id` (String)  
Sort key: `timestamp` (String, ISO 8601)

| Attribute | Type | Notes |
|---|---|---|
| `incident_id` | S | `INC-XXXXXXXX` |
| `timestamp` | S | UTC ISO string |
| `type` | S | Incident type |
| `severity` | S | critical/high/medium/low |
| `departments` | L | List of department strings |
| `location` | S | Human-readable address |
| `coord_lat` | S | Stored as string (DynamoDB Decimal compat) |
| `coord_lng` | S | Stored as string |
| `casualties` | S | Description or "None reported" |
| `summary` | S | AI-generated dispatcher summary |
| `transcript` | S | Original voice transcript |
| `confidence` | S | Stored as string, parsed to float on read |
| `status` | S | active/responding/resolved |
| `language` | S | BCP-47 language code |

### 3.6 WebSocket Protocol

```
Client → Server: { "type": "config", "language": "hi-IN", "sampleRate": 16000 }
Server → Client: { "type": "ready" }
Client → Server: <binary PCM 16-bit chunks>
Server → Client: { "type": "transcript", "text": "...", "is_partial": true }
Client → Server: { "type": "stop" }
Server → Client: { "type": "done" }
```

---

## 4. Infrastructure (Terraform)

### 4.1 Resources

| Resource | Purpose |
|---|---|
| `aws_instance` (EC2) | FastAPI backend, t3.micro, Ubuntu 22.04 |
| `aws_dynamodb_table` | Incident storage, PAY_PER_REQUEST billing |
| `aws_sns_topic` × 4 | One per department (Police, Fire, Medical, Disaster) |
| `aws_s3_bucket` | Next.js static export hosting |
| `aws_cloudfront_distribution` | CDN + HTTPS for frontend |
| `aws_iam_role` + policies | EC2 instance role with Bedrock, Transcribe, SNS, DynamoDB, Location permissions |

### 4.2 Deployment Flow

```
terraform apply
      │
      ▼
EC2 user_data.sh runs:
  - apt install python3, pip, git
  - Clone repo, pip install -r requirements.txt
  - Write .env from Terraform variables
  - Start uvicorn as systemd service

npm run deploy (deploy.js):
  1. Read EC2 IP from `terraform output -json`
  2. Write NEXT_PUBLIC_API_URL to .env.local
  3. next build (static export → out/)
  4. aws s3 sync out/ s3://<bucket> --delete
  5. aws cloudfront create-invalidation --paths "/*"
```

---

## 5. Agency Configuration

Defined in `src/lib/agencyConfig.ts` as a static array of `AgencyConfig` objects:

```typescript
interface AgencyConfig {
  slug: string;        // URL segment: fire | police | medical | disaster
  label: string;       // Display name
  apiName: string;     // Exact value in DynamoDB departments[]
  icon: string;        // Lucide icon name
  color: string;       // Hex color
  colorRgb: string;    // RGB for rgba() usage
  gradient: string;    // CSS gradient for hero areas
  description: string; // Short description
  incidentTypes: string[]; // Incident types this agency handles
}
```

---

## 6. Data Flow Diagram

```
[Browser Mic] ──PCM──▶ [WS /ws/transcribe] ──▶ [Amazon Transcribe]
                                                        │
                                              partial transcripts
                                                        │
                                                        ▼
                                              [Client displays live text]

[User taps Stop] ──▶ POST /api/report { transcript, language, coords }
                              │
                    ┌─────────┴──────────┐
                    ▼                    ▼
             [Bedrock/Claude]    [Location Service]
             type, severity,     reverse geocode
             departments,        → address string
             summary, confidence
                    │
                    ▼
             [Build Incident]
                    │
              ┌─────┴──────┐
              ▼            ▼
         [DynamoDB]     [SNS × N depts]
              │
              ▼
         [Return to client → show result cards]
```

---

## 7. Property-Based Testing Strategy

### Test Framework
- **Python**: `hypothesis` library for backend PBT
- **TypeScript**: `fast-check` for frontend logic

### Properties to Test

| Property | Test Approach |
|---|---|
| P1 — Pipeline completeness | Generate random transcripts → assert all fields present in response |
| P2 — Severity constraint | Generate transcripts → assert severity ∈ {critical, high, medium, low} |
| P3 — Department constraint | Generate transcripts → assert departments ⊆ valid set, len > 0 |
| P4 — Location fallback | Send reports with null coordinates → assert location is non-empty string |
| P5 — Graceful degradation | Mock AWS failures → assert 200 response with valid incident |
| P6 — Status transitions | Generate status sequences → assert invalid transitions rejected (400) |
| P7 — Confidence bounds | Generate transcripts → assert 0 ≤ confidence ≤ 100 |
| P8 — Dispatch atomicity | Mock partial SNS failures → assert incident stored despite dispatch errors |

### Example Hypothesis Test (P2 + P3)

```python
from hypothesis import given, strategies as st
from hypothesis.strategies import text

@given(transcript=text(min_size=10, max_size=500))
async def test_severity_and_department_constraints(transcript):
    result = await analyze_incident(transcript)
    assert result["severity"] in {"critical", "high", "medium", "low"}
    assert len(result["departments"]) > 0
    valid_depts = {"Police", "Fire Department", "Medical Emergency", "Disaster Response"}
    assert all(d in valid_depts for d in result["departments"])
```
