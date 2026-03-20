# Requirements: CivicAlert — AI-Powered Emergency Response System

## Overview

CivicAlert is a voice-first emergency reporting platform for India. A civilian presses one button, speaks about the emergency in any supported Indian language, and the system automatically transcribes, triages, classifies, and dispatches structured alerts to the relevant government departments — all in under 10 seconds.

---

## User Stories

### 1. Voice-Based Emergency Reporting

**As a** civilian witnessing an emergency,  
**I want to** press a single button and speak about what I see in my native language,  
**So that** I can report an emergency quickly without filling forms or navigating menus.

#### Acceptance Criteria

- 1.1 The report page presents a single prominent microphone button in an idle state.
- 1.2 Pressing the button requests microphone permission and begins recording immediately.
- 1.3 A real-time audio waveform visualizes that the system is actively listening.
- 1.4 A live transcript appears on screen as the user speaks, streamed via WebSocket.
- 1.5 Pressing the button again stops recording and triggers the processing pipeline.
- 1.6 The user can select from at least 6 Indian languages (English, Hindi, Tamil, Telugu, Bengali, Marathi) before recording.
- 1.7 If microphone access is denied or the WebSocket fails, the system falls back gracefully without crashing.

---

### 2. AI Incident Triage

**As a** dispatch system,  
**I want to** automatically extract structured incident data from a free-form voice transcript,  
**So that** responders receive actionable, pre-classified reports without manual operator intervention.

#### Acceptance Criteria

- 2.1 The backend sends the transcript to an AI model (Amazon Bedrock / Anthropic Claude) for analysis.
- 2.2 The AI returns: `incident_type`, `severity` (critical/high/medium/low), `casualties`, `departments[]`, `summary`, and `confidence` score.
- 2.3 The system supports at least 4 incident types: Building Fire, Road Accident, Flooding, Medical Emergency.
- 2.4 The AI selects one or more departments from: Police, Fire Department, Medical Emergency, Disaster Response.
- 2.5 If the AI service is unavailable, the system falls back to keyword-based classification and returns a valid response.
- 2.6 The confidence score is surfaced to the user in the result UI.

---

### 3. Automatic GPS Location Tagging

**As a** dispatcher,  
**I want to** know the precise location of every incident,  
**So that** responders can be routed without needing the caller to describe their address.

#### Acceptance Criteria

- 3.1 The frontend requests the user's GPS coordinates on page load.
- 3.2 If the user grants location permission, the exact coordinates are sent with the report.
- 3.3 If the user denies location, the system falls back to a default location (Kanpur: 26.4499°N, 80.3319°E).
- 3.4 The backend uses AWS Location Service to reverse-geocode coordinates into a human-readable address.
- 3.5 If a location is mentioned in the transcript, the backend attempts to geocode it and prefers it over GPS coordinates.
- 3.6 The resolved location string and raw coordinates are both stored with the incident.

---

### 4. Multi-Department Alert Dispatch

**As a** government department (Police / Fire / Medical / Disaster),  
**I want to** receive a structured, pre-filled alert the moment an incident is classified,  
**So that** my team can respond immediately without waiting for a human operator.

#### Acceptance Criteria

- 4.1 The backend dispatches alerts via Amazon SNS to all departments identified by the AI.
- 4.2 Each SNS message contains: incident ID, type, severity, location, casualties, summary, and timestamp.
- 4.3 Alerts are dispatched in parallel to all relevant departments simultaneously.
- 4.4 The frontend shows which departments were notified and confirms dispatch with a checkmark.
- 4.5 If SNS dispatch fails, the incident is still stored and the user is not shown an error.

---

### 5. Real-Time Department Dashboard

**As a** department operator,  
**I want to** see all active incidents in a live feed with map visualization,  
**So that** I can monitor the situation and coordinate responses in real time.

#### Acceptance Criteria

- 5.1 The dashboard displays all non-resolved incidents sorted by severity (critical first).
- 5.2 Each incident card shows: type, severity badge, status, location, time ago, casualties, and summary.
- 5.3 The dashboard polls the backend every 15 seconds for new incidents.
- 5.4 A department filter allows operators to view incidents relevant to their department only.
- 5.5 An interactive map (Leaflet) shows incident pins color-coded by severity.
- 5.6 Clicking an incident card or map pin opens a detail panel with full incident information.
- 5.7 Operators can mark an incident as "Resolved", which removes it from the active feed.
- 5.8 The dashboard shows live stats: active count, responding count, average response time, departments active.

---

### 6. Per-Agency Dashboard

**As a** agency-specific operator (e.g., Fire Department),  
**I want to** access a dedicated dashboard filtered to my agency's incidents,  
**So that** I only see what's relevant to my department without noise from others.

#### Acceptance Criteria

- 6.1 Each agency has a dedicated URL: `/agencies/[fire|police|medical|disaster]`.
- 6.2 The agency dashboard shows only incidents assigned to that agency.
- 6.3 The agency layout includes tabs for Dashboard and Analytics views.
- 6.4 Agency branding (color, icon, gradient) is applied consistently across the agency pages.
- 6.5 The agencies listing page (`/agencies`) shows all four agencies with their descriptions and incident type coverage.

---

### 7. Analytics & Hotspot Visualization

**As a** city administrator,  
**I want to** view aggregated incident analytics over time,  
**So that** I can identify hotspots, resource gaps, and response performance trends.

#### Acceptance Criteria

- 7.1 The analytics page shows: total incidents, active incidents, resolved incidents, and resolution rate.
- 7.2 A bar chart displays incident counts by type.
- 7.3 A pie/donut chart shows severity distribution (critical/high/medium/low).
- 7.4 A bar chart shows department workload (incidents per department).
- 7.5 A location hotspot chart shows the top cities/areas by incident count.
- 7.6 Analytics can be filtered by department.
- 7.7 Analytics data is computed server-side from all stored incidents.

---

### 8. Infrastructure & Deployment

**As a** developer,  
**I want to** deploy the full stack to AWS with a single command,  
**So that** the system is production-ready without manual configuration.

#### Acceptance Criteria

- 8.1 Terraform provisions: EC2 (backend), DynamoDB (storage), SNS (alerts), S3 + CloudFront (frontend), IAM roles.
- 8.2 `npm run deploy` reads the EC2 IP from Terraform outputs, builds the Next.js static export, and syncs to S3.
- 8.3 The backend runs on EC2 with `uvicorn` and is accessible over HTTP on port 8000.
- 8.4 The frontend is served via CloudFront with cache invalidation on each deploy.
- 8.5 All AWS credentials and configuration are managed via environment variables (`.env`).
- 8.6 A `USE_MOCK=true` mode allows full local development without any AWS services.

---

## Correctness Properties

### P1 — Incident Pipeline Completeness
Every submitted transcript must produce a stored incident with all required fields populated: `id`, `type`, `severity`, `departments`, `location`, `coordinates`, `casualties`, `summary`, `confidence`, `status`, `timestamp`.

### P2 — Severity Constraint
The `severity` field must always be one of: `critical`, `high`, `medium`, `low`. No other value is valid.

### P3 — Department Constraint
The `departments` array must be non-empty and contain only values from: `["Police", "Fire Department", "Medical Emergency", "Disaster Response"]`.

### P4 — Location Fallback Guarantee
If GPS coordinates are unavailable and no location is extractable from the transcript, the system must still produce a valid location string (not null/empty) using the default fallback coordinates.

### P5 — Graceful Degradation
If any AWS service (Bedrock, Transcribe, SNS, DynamoDB, Location) is unavailable, the system must not return a 5xx error to the user. It must fall back to mock/local equivalents and return a valid incident response.

### P6 — Status Transition Validity
An incident's `status` field may only transition through: `active → responding → resolved`. Direct transitions from `active → resolved` are permitted. Reverse transitions (e.g., `resolved → active`) must be rejected.

### P7 — Confidence Bounds
The `confidence` value must be a number in the range [0, 100].

### P8 — Dispatch Atomicity
If SNS dispatch fails for one department, it must not prevent dispatch to other departments or storage of the incident.
