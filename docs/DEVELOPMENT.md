# 🛠️ CivicAlert — Developer Guide & Setup

> **CivicAlert** is a voice-first, AI-powered emergency incident reporting and automated multi-department dispatch platform. This document contains everything a developer needs to configure, run, test, and contribute to both the frontend and backend services.

---

## 📋 Table of Contents
1. [Prerequisites](#-prerequisites)
2. [Project Architecture](#-project-architecture)
3. [Project Structure](#-project-structure)
4. [Local Development Setup](#-local-development-setup)
   - [Frontend Setup](#frontend-nextjs)
   - [Backend Setup](#backend-fastapi)
5. [Environment Variables Reference](#-environment-variables-reference)
   - [Backend (.env)](#backend-env)
   - [Frontend (.env.local)](#frontend-envlocal)
6. [Mock Mode (Zero-AWS Local Development)](#-mock-mode-zero-aws-local-development)
7. [Testing](#-testing)
8. [API & WebSocket Specifications](#-api--websocket-specifications)
9. [Deployment Workflow](#-deployment-workflow)
10. [Troubleshooting & Common Issues](#-troubleshooting--common-issues)

---

## 🧰 Prerequisites

Before setting up CivicAlert, ensure you have the following installed on your machine:

| Tool | Minimum Version | Purpose | Verification Command |
|---|---|---|---|
| **Node.js** | `v18.x` or later (Node 20+ recommended) | Frontend runtime environment | `node -v` |
| **npm** | `v9.x` or later | JavaScript package management | `npm -v` |
| **Python** | `3.11+` | Backend FastAPI service & scripts | `python3.11 --version` |
| **AWS CLI** | `v2.x` configured with valid credentials | AWS services management & testing | `aws --version` |
| **Terraform** | `>= 1.5.0` | Infrastructure as Code provisioning | `terraform -version` |
| **Git** | `2.x` | Source code version control | `git --version` |

> [!NOTE]
> For audio streaming via WebSocket in local development, modern web browsers (Chrome, Edge, Firefox, or Safari) with microphone permissions enabled are required.

---

## 🏗️ Project Architecture

CivicAlert processes emergency calls from audio/transcript input to multi-agency alert dispatch in under 10 seconds:

```
                                  ┌───────────────────────────────┐
                                  │      User Voice / Text        │
                                  └───────────────┬───────────────┘
                                                  │
                                                  ▼
                                   ┌─────────────────────────────┐
                                   │     Next.js Web Portal      │
                                   │  (Public / Agency Portals)  │
                                   └──────────────┬──────────────┘
                                                  │ HTTP / WebSocket (/ws/transcribe)
                                                  ▼
                                   ┌─────────────────────────────┐
                                   │       FastAPI Backend       │
                                   └───────┬───────┬───────┬─────┘
                                           │       │       │
                ┌──────────────────────────┘       │       └─────────────────────────┐
                ▼                                  ▼                                 ▼
   ┌─────────────────────────┐        ┌─────────────────────────┐       ┌─────────────────────────┐
   │    Sarvam AI Saaras     │        │      Amazon Bedrock     │       │   AWS Location Service  │
   │ (Speech-to-Text & TTS)  │        │  (Claude / Nova Triage) │       │   (Reverse Geocoding)   │
   └─────────────────────────┘        └────────────┬────────────┘       └─────────────────────────┘
                                                   │
                                                   ├─────────────────────────┐
                                                   ▼                         ▼
                                      ┌─────────────────────────┐ ┌─────────────────────────┐
                                      │      Amazon SNS         │ │      DynamoDB           │
                                      │  (Multi-Agency Dispatch)│ │  (Incident Database)    │
                                      └─────────────────────────┘ └─────────────────────────┘
```

---

## 📂 Project Structure

```
civic-alert/
├── src/                        # Next.js frontend (App Router)
│   ├── app/
│   │   ├── page.tsx            # Landing page (hero + embedded report)
│   │   ├── report/page.tsx     # Voice report page
│   │   ├── dashboard/page.tsx  # Real-time incident dashboard + map
│   │   ├── analytics/page.tsx  # Analytics & charts
│   │   ├── agencies/page.tsx   # Agency listing
│   │   └── agencies/[agency]/  # Per-agency dashboard + analytics
│   ├── components/
│   │   ├── Navbar.tsx          # Global navigation
│   │   ├── MapView.tsx         # Leaflet map wrapper (dynamic import)
│   │   ├── MapViewInner.tsx    # Leaflet map implementation
│   │   ├── ParticleField.tsx   # Animated particle background
│   │   ├── AnimationHelpers.tsx # Framer Motion utilities
│   │   └── PortalRedirect.tsx  # Portal mode redirector
│   └── lib/
│       └── agencyConfig.ts     # Agency definitions (slug, color, gradient, icon)
├── backend/
│   ├── main.py                 # FastAPI routes + WebSocket
│   ├── services/
│   │   ├── sarvam.py           # Sarvam AI STT/TTS (Saaras v4 + Bulbul v4)
│   │   ├── bedrock.py          # Amazon Bedrock AI triage
│   │   ├── dynamodb.py         # DynamoDB CRUD + analytics
│   │   ├── sns.py              # SNS alert dispatch
│   │   ├── location.py         # AWS Location geocoding
│   │   └── transcribe.py       # Legacy Transcribe + mock functions
│   ├── mock_db.json            # Mock incident data for development
│   ├── test_pipeline.py        # Pipeline integration test
│   ├── test_bedrock.py         # Bedrock unit test
│   └── test_real_pipeline.py   # Full AWS integration test
├── terraform/                  # Infrastructure as Code
│   ├── main.tf                 # Provider + backend config
│   ├── ec2.tf                  # Backend server + EIP + SG
│   ├── dynamodb.tf             # Incidents table + GSIs
│   ├── sns.tf                  # 4 department alert topics
│   ├── iam.tf                  # EC2 role + policies
│   ├── s3_cloudfront.tf        # Frontend hosting + CDN + API proxy
│   ├── location.tf             # Geospatial place index
│   ├── variables.tf            # Input variables
│   ├── outputs.tf              # Output values
│   └── user_data.sh            # EC2 bootstrap script
├── deploy.js                   # Automated frontend deploy to S3
├── package.json                # Frontend dependencies + scripts
└── next.config.ts              # Next.js config (static export)
```

---

## 💻 Local Development Setup

### Frontend (Next.js)

The frontend is a Next.js (App Router) application supporting two distinct modes:
1. **Public Citizen Portal** (`/`, `/report`)
2. **Agency First-Responder Portal** (`/agencies`, `/agencies/[agency]/dashboard`)

#### 1. Install Dependencies
```bash
# In the root repository directory
npm install
```

#### 2. Configure Local Environment
Create or edit `.env.local` in the project root:
```bash
# Defaults to local FastAPI backend
NEXT_PUBLIC_API_URL=http://localhost:8000
```

> [!TIP]
> For production deployments via S3 & CloudFront, `deploy.js` sets `NEXT_PUBLIC_API_URL` to the CloudFront distribution domain to route requests through the CloudFront API reverse proxy.

#### 3. Run Development Servers

You can run each portal individually or both concurrently:

```bash
# Public portal only (port 3000)
npm run dev
# → http://localhost:3000

# Agency portal only (port 3001, separate portal context)
npm run dev:agencies
# → http://localhost:3001

# Run both portals simultaneously via concurrently
npm run dev:all
# → Public: http://localhost:3000 | Agencies: http://localhost:3001
```

---

### Backend (FastAPI)

The backend is built with Python 3.11 and FastAPI, featuring asynchronous routes, WebSocket streaming, and AWS / Sarvam AI service clients.

#### 1. Setup Virtual Environment
```bash
cd backend
python3.11 -m venv venv
source venv/bin/activate
```

*(On Windows PowerShell, use `venv\Scripts\Activate.ps1`)*

#### 2. Install Python Dependencies
```bash
pip install -r requirements.txt
```

Core libraries in `requirements.txt`:
- `fastapi` — High-performance async API framework
- `uvicorn[standard]` — ASGI web server with WebSocket support
- `boto3` — AWS SDK for Python (Bedrock, DynamoDB, SNS, Location)
- `aiohttp` — Asynchronous HTTP requests (Sarvam AI & Anthropic API)
- `python-dotenv` — Environment variable loader
- `pydantic` — Data validation and schema parsing
- `python-multipart` — Multipart file upload support
- `websockets` — Direct WebSocket client/server utilities
- `amazon-transcribe` — AWS Transcribe streaming client

#### 3. Configure Environment Variables
Copy the template or create `.env` inside the `backend/` directory:
```bash
cp .env.example .env   # Or create .env manually
```
Edit `backend/.env` with your desired configuration (see [Environment Variables Reference](#-environment-variables-reference)).

#### 4. Start the Backend Server
```bash
uvicorn main:app --reload --port 8000
```
- API root: `http://localhost:8000`
- Interactive OpenAPI Docs: `http://localhost:8000/docs`
- Health check: `http://localhost:8000/api/health`

---

## ⚙️ Environment Variables Reference

### Backend (`backend/.env`)

| Variable | Required | Default | Description |
|---|---|---|---|
| `AWS_REGION` | Yes | `ap-south-1` | Target AWS region for DynamoDB, SNS, Bedrock, and Location. |
| `AWS_ACCESS_KEY_ID` | Local only | *None* | AWS Access Key (leave empty on EC2 to use Instance Profile). |
| `AWS_SECRET_ACCESS_KEY` | Local only | *None* | AWS Secret Key (leave empty on EC2 to use Instance Profile). |
| `USE_MOCK` | No | `false` | When `true`, runs the backend without connecting to AWS or Sarvam. |
| `USE_ANTHROPIC_API` | No | `false` | When `true`, routes AI analysis directly to Anthropic rather than Bedrock. |
| `ANTHROPIC_API_KEY` | If Anthropic API | *None* | API key for direct Anthropic API access (`sk-ant-...`). |
| `BEDROCK_MODEL_ID` | No | `apac.amazon.nova-lite-v1:0` | Amazon Bedrock model ID or inference profile ARN. |
| `BEDROCK_AWS_ACCESS_KEY_ID` | Multi-Account | *None* | Dedicated Bedrock account Access Key (for multi-account setup). |
| `BEDROCK_AWS_SECRET_ACCESS_KEY` | Multi-Account | *None* | Dedicated Bedrock account Secret Key (for multi-account setup). |
| `SARVAM_API_KEY` | Recommended | *None* | Sarvam AI API subscription key for Saaras v4 STT & Bulbul v4 TTS. |
| `DYNAMODB_TABLE_NAME` / `DYNAMODB_TABLE` | No | `civic-alert-incidents-dev` | DynamoDB incidents table name. |
| `SNS_TOPIC_POLICE` | No | `arn:aws:sns:...:police-alerts` | Amazon SNS Topic ARN for Police alerts. |
| `SNS_TOPIC_FIRE` | No | `arn:aws:sns:...:fire-alerts` | Amazon SNS Topic ARN for Fire Department alerts. |
| `SNS_TOPIC_MEDICAL` | No | `arn:aws:sns:...:medical-alerts` | Amazon SNS Topic ARN for Medical Emergency alerts. |
| `SNS_TOPIC_DISASTER` | No | `arn:aws:sns:...:disaster-alerts` | Amazon SNS Topic ARN for Disaster Response alerts. |
| `LOCATION_INDEX_NAME` | No | `civic-alert-places-prod` | AWS Location Service Place Index resource name. |
| `DEBUG_THINKING` | No | `false` | Logs extended reasoning/thinking traces for supported Claude models. |

#### Supported Bedrock Models
- `apac.amazon.nova-lite-v1:0` (Default on-demand inference profile for APAC, accessible without model approval grants)
- `anthropic.claude-3-sonnet-20240229-v1:0` (Reliable Claude 3 Sonnet model)
- `apac.anthropic.claude-3-5-sonnet-20241022-v2:0` (Claude 3.5 Sonnet v2)
- `apac.anthropic.claude-sonnet-4-20250514-v1:0` (Claude Sonnet 4 with Extended Thinking)

---

### Frontend (`.env.local`)

| Variable | Required | Default | Description |
|---|---|---|---|
| `NEXT_PUBLIC_API_URL` | Yes | `http://localhost:8000` | Backend API base URL (`http://localhost:8000` for local, CloudFront URL for prod). |
| `NEXT_PUBLIC_PORTAL_MODE` | No | `public` | Controls portal mode redirect (`agencies` when running `npm run dev:agencies`). |

---

## 🧪 Mock Mode (Zero-AWS Local Development)

CivicAlert features a built-in mock mode enabling full offline local development without AWS credentials, cloud resources, or external API quotas.

To activate mock mode, set in `backend/.env`:
```env
USE_MOCK=true
```

### Mock Behavior Matrix

| Subsystem | Mock Behavior |
|---|---|
| **AI Incident Triage** (`bedrock.py`) | Keyword-based classification matching emergency keywords in English, Hindi, and Tamil, producing structured severities, casualties, and department mappings. |
| **Database Operations** (`dynamodb.py`) | Reads, creates, queries, and updates incidents stored locally in `backend/mock_db.json`. |
| **Alert Dispatch** (`sns.py`) | Simulates network latency, prints structured dispatch payloads to console logs with mock message IDs. |
| **Geocoding & Location** (`location.py`) | Maps known Indian cities (Kanpur, Lucknow, Delhi, Mumbai, Bengaluru, etc.) to realistic coordinates and addresses without calling AWS Location Service. |
| **Speech-to-Text** (`sarvam.py` / `transcribe.py`) | Streams simulated emergency voice transcripts word-by-word with realistic partial and final events across multiple Indian languages (English, Hindi, Tamil, Telugu). |

> [!NOTE]
> Even when running with `USE_MOCK=false`, the backend gracefully catches AWS connection exceptions and automatically falls back to keyword analysis and `mock_db.json` persistence to guarantee uptime.

---

## 🔬 Testing

Three dedicated test suites are located in `backend/` to validate individual components and end-to-end flows:

```bash
cd backend
source venv/bin/activate
```

### 1. Basic Pipeline Test (`test_pipeline.py`)
Validates incident analysis and reverse geocoding. Automatically succeeds in either mock mode or real mode.
```bash
python test_pipeline.py
```
**Expected Output:**
```
🧪 Testing CivicAlert Pipeline
1️⃣ Testing Bedrock AI Analysis...
✅ Analysis successful!
   Type: Building Fire
   Severity: critical
   Departments: Fire Department, Medical Emergency, Police
2️⃣ Testing AWS Location Service...
✅ Geocoding successful!
   Location: Sector 15, Kanpur, Uttar Pradesh 208002
✨ All tests passed! Pipeline is working correctly.
```

### 2. Direct Bedrock Test (`test_bedrock.py`)
Directly verifies connectivity to AWS Bedrock and checks inference with Claude / Nova models:
```bash
python test_bedrock.py
```

### 3. Full Real AWS Services Pipeline Test (`test_real_pipeline.py`)
Overrides `USE_MOCK` to `false` and executes real Bedrock analysis and AWS Location Service reverse geocoding:
```bash
python test_real_pipeline.py
```

---

## 📡 API & WebSocket Specifications

### REST Endpoints

| Method | Endpoint | Description | Request Body / Params |
|---|---|---|---|
| `GET` | `/` | API Health & operational status | None |
| `POST` | `/api/report` | Submit emergency incident report | `{"transcript": "...", "language": "en-IN", "coordinates": {"lat": 26.44, "lng": 80.33}}` |
| `GET` | `/api/incidents` | Query incidents with optional filters | Query params: `?department=Police&severity=critical&status=active` |
| `GET` | `/api/incidents/{id}` | Retrieve incident details by ID | Path param: `incident_id` (e.g. `INC-A1B2C3D4`) |
| `PATCH` | `/api/incidents/{id}/status` | Update incident status | `{"status": "responding" \| "resolved" \| "active"}` |
| `GET` | `/api/analytics` | Fetch aggregated incident analytics | Optional query param: `?department=Fire+Department` |
| `POST` | `/api/tts` | Sarvam Bulbul v4 Flash speech synthesis | `{"text": "Dispatching fire unit", "language": "en-IN"}` |
| `GET` | `/api/health` | Service health status | None |

---

### Real-Time Voice WebSocket (`/ws/transcribe`)

The WebSocket endpoint connects browser audio streams directly to Sarvam Saaras v4:

```
Browser Client                                    FastAPI Server (/ws/transcribe)
     │                                                         │
     │ ──── 1. {"type": "config", "language": "en-IN"} ──────> │
     │ <─── 2. {"type": "ready"} ───────────────────────────── │
     │                                                         │
     │ ──── 3. Binary PCM chunks (16kHz, 16-bit mono) ───────> │
     │ <─── 4. {"type": "transcript", "text": "...",           │
     │          "is_partial": true} ────────────────────────── │
     │                                                         │
     │ ──── 5. {"type": "stop"} ─────────────────────────────> │
     │ <─── 6. {"type": "transcript", "text": "Full text...",  │
     │          "is_partial": false} ───────────────────────── │
     │ <─── 7. {"type": "done"} ────────────────────────────── │
```

---

## 🚀 Deployment Workflow

CivicAlert provisions AWS infrastructure with Terraform and hosts the Next.js static export on Amazon S3 distributed via Amazon CloudFront.

### 1. Provision Infrastructure via Terraform
```bash
cd terraform
cp terraform.tfvars.example terraform.tfvars
# Update terraform.tfvars with desired AWS region and tags
terraform init
terraform plan
terraform apply
```

Key outputs created by Terraform:
- `ec2_public_ip` — Elastic IP of the backend server
- `cloudfront_domain` — High-performance HTTPS CDN domain
- `s3_bucket_name` — Static frontend hosting bucket
- `dynamodb_table_name` — Persistent incidents storage
- `sns_topic_arns` — Alert topics for Police, Fire, Medical, and Disaster

### 2. Deploy Frontend to S3 & CloudFront
The automated script `deploy.js` handles building and syncing the frontend:
```bash
# In the root repository directory
npm run deploy
```

What `deploy.js` automates:
1. Queries Terraform outputs for CloudFront domain and S3 bucket name.
2. Generates `.env.local` configured with the CloudFront API proxy URL:
   `NEXT_PUBLIC_API_URL=https://<cloudfront-domain>`
3. Executes `next build` to produce the static export in `out/`.
4. Syncs `out/` to the S3 bucket using AWS CLI (`aws s3 sync out/ s3://<bucket> --delete`).
5. Invalidates the CloudFront cache (`/*`) so new code goes live instantly.

> [!NOTE]
> CloudFront is configured with custom cache behaviors to proxy `/api/*` and `/ws/*` traffic directly to the EC2 backend instance. This eliminates browser "Mixed Content" security restrictions when calling an HTTP backend from an HTTPS web application.

---

## ❓ Troubleshooting & Common Issues

### 1. Browser "Mixed Content" Blocked Errors
- **Symptom**: Calling `http://<ec2-ip>:8000` from an `https://<cloudfront-domain>` frontend triggers a browser security exception.
- **Solution**: Set `NEXT_PUBLIC_API_URL=https://<cloudfront-domain>` so requests route through the CloudFront API proxy behavior configured in `terraform/s3_cloudfront.tf`.

### 2. AWS Bedrock `AccessDeniedException` or `ResourceNotFoundException`
- **Symptom**: Bedrock calls fail with model access or payment instrument errors.
- **Solution**:
  1. Default model is set to `apac.amazon.nova-lite-v1:0` which does not require approval.
  2. If using Claude models, verify model access is granted in the AWS Bedrock Console under **Model access**.
  3. Alternatively, switch to `USE_MOCK=true` or use direct Anthropic API with `USE_ANTHROPIC_API=true`.

### 3. Audio Streaming Not Working on Localhost
- **Symptom**: Microphone does not stream voice or WebSocket disconnects immediately.
- **Solution**:
  1. Ensure browser permissions allow microphone access on `http://localhost:3000`.
  2. Confirm backend is listening on port 8000 with WebSocket support (`uvicorn main:app --reload --port 8000`).
  3. If testing without a Sarvam API key, set `USE_MOCK=true` to enable simulated transcripts.

### 4. DynamoDB Serialization or Access Errors
- **Symptom**: Local runs report `AccessDeniedException` on DynamoDB PutItem.
- **Solution**: The backend automatically falls back to `backend/mock_db.json` when DynamoDB is unreachable, so local development continues uninterrupted.
