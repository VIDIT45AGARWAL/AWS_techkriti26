# 🚨 CivicAlert — AI-Powered Emergency Response

> **Team Segionpex** | AWS Builder Center — Techkriti 2026
> [@jabhaskript](https://github.com/jabhaskript) · [@geng4r](https://github.com/geng4r) · [@blackadder45](https://github.com/blackadder45)

**CivicAlert** is a voice-first, AI-powered emergency reporting system for India. A civilian presses one button, speaks about what they see in any of 6 Indian languages, and the system transcribes, triages, classifies, and dispatches structured alerts to the relevant government departments — all in **under 10 seconds**.

---

## ✨ Key Features

| Feature | Technology |
|---------|------------|
| 🎙️ One-button voice input (6 Indian languages) | Web Audio API + Sarvam AI Saaras v4 |
| 🤖 AI incident triage & classification | Amazon Bedrock (Claude / Nova Lite) |
| 📍 Automatic GPS location tagging | Browser Geolocation + AWS Location Service (Esri) |
| 🚒 Multi-department dispatch | Amazon SNS (4 department topics) |
| 📊 Real-time dashboard with live map | Next.js + DynamoDB + Leaflet |
| 📈 Analytics & hotspot visualization | Recharts + DynamoDB aggregation |
| 🔊 Text-to-speech dispatch summaries | Sarvam AI Bulbul v4 Flash |
| 🏢 Per-agency dedicated dashboards | Fire, Police, Medical, Disaster |
| 🏗️ Infrastructure as Code | Terraform (EC2, S3, CloudFront, DynamoDB, SNS) |
| 🛡️ Graceful degradation | Full mock mode for development without AWS |

### Supported Languages
`English (en-IN)` · `Hindi (hi-IN)` · `Tamil (ta-IN)` · `Telugu (te-IN)` · `Bengali (bn-IN)` · `Marathi (mr-IN)`

---

## 🏗️ Architecture

```
┌────────────────────────────────────────────────────────────────────┐
│                     CLIENT  (Browser)                               │
│          Next.js 16 — Static Export (S3 + CloudFront)               │
│                                                                      │
│  /             Landing page + embedded report                       │
│  /report       Voice recording + live transcript + triage result    │
│  /dashboard    Global incident feed + Leaflet map                   │
│  /analytics    Charts & hotspot visualisation                       │
│  /agencies     Agency listing + per-agency dashboards               │
└──────────────────────────┬─────────────────────────────────────────┘
                           │ HTTPS (CloudFront proxy)
                           ▼
┌────────────────────────────────────────────────────────────────────┐
│                 BACKEND  (FastAPI on EC2)                            │
│                                                                      │
│  POST /api/report          Submit transcript → full pipeline        │
│  GET  /api/incidents       List incidents (filterable)              │
│  GET  /api/incidents/:id   Single incident detail                   │
│  PATCH /api/incidents/:id/status   Update status                    │
│  GET  /api/analytics       Aggregated stats & charts                │
│  POST /api/tts             Text-to-speech (Sarvam Bulbul v4)        │
│  WS   /ws/transcribe       Real-time speech → text stream           │
└──────┬──────────┬──────────┬──────────┬──────────┬─────────────────┘
       │          │          │          │          │
       ▼          ▼          ▼          ▼          ▼
   Bedrock    Sarvam AI   Location    SNS      DynamoDB
   (Claude/   (Saaras v4  (Esri     (Alerts)  (Incidents
    Nova)     STT + TTS)  Geocode)             Storage)
```

---

## 🔄 System Flow

```
 ┌──────────┐
 │ Civilian │──── Opens /report page
 └────┬─────┘
      │
      ▼
 ┌──────────────────────────────────────┐
 │ 1. Browser requests mic + GPS        │
 │ 2. User selects language & taps mic  │
 │ 3. Audio streams via WebSocket       │
 │    → Sarvam Saaras v4 (STT)         │
 │ 4. Live transcript shown on screen   │
 └──────────────┬───────────────────────┘
                │  User taps Stop
                ▼
 ┌──────────────────────────────────────┐
 │ POST /api/report                     │
 │  { transcript, language, coords }    │
 └──────────────┬───────────────────────┘
                │
    ┌───────────┼───────────────┐
    ▼           ▼               ▼
 ┌────────┐ ┌────────────┐ ┌─────────┐
 │Bedrock │ │ Location   │ │ Build   │
 │AI      │ │ Service    │ │Incident │
 │Triage  │ │ Geocode    │ │ Object  │
 └───┬────┘ └─────┬──────┘ └────┬────┘
     │            │              │
     └────────────┼──────────────┘
                  │
        ┌─────────┴──────────┐
        ▼                    ▼
   ┌──────────┐        ┌─────────┐
   │ DynamoDB │        │ SNS     │
   │ Store    │        │ Dispatch│
   └──────────┘        └────┬────┘
                            │
              ┌─────────────┼─────────────┐─────────────┐
              ▼             ▼             ▼             ▼
          🚔 Police    🚒 Fire     🚑 Medical    ⚡ Disaster
```

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** 18+ and npm
- **Python** 3.11+
- **AWS CLI** v2 (configured)
- **Terraform** >= 1.5.0

### Frontend (Next.js)

```bash
npm install
npm run dev              # → http://localhost:3000 (public portal)
npm run dev:agencies     # → http://localhost:3001 (agencies portal)
npm run dev:all          # Both portals simultaneously
```

### Backend (Python FastAPI)

```bash
cd backend
python3.11 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env     # Edit with your config (or set USE_MOCK=true)
uvicorn main:app --reload --port 8000
```

> 💡 **Mock Mode:** Set `USE_MOCK=true` in `backend/.env` to run the entire system locally without any AWS services. Perfect for development and demos.

### Deploy to AWS

```bash
# 1. Provision infrastructure
cd terraform
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars with your values
terraform init && terraform apply

# 2. Build & deploy frontend to S3/CloudFront
cd ..
npm run deploy
```

The `npm run deploy` command automatically:
1. Reads the CloudFront domain from Terraform outputs
2. Writes `.env.local` with `NEXT_PUBLIC_API_URL` pointing to CloudFront proxy
3. Builds the Next.js static export
4. Syncs to S3 and invalidates the CloudFront cache

---

## 📂 Project Structure

```
civic-alert/
├── src/                            # Next.js 16 frontend
│   ├── app/
│   │   ├── page.tsx                # Landing page (hero + embedded report)
│   │   ├── globals.css             # Design tokens + global styles
│   │   ├── report/page.tsx         # Voice report + live transcript
│   │   ├── dashboard/page.tsx      # Real-time feed + Leaflet map
│   │   ├── analytics/page.tsx      # Charts & hotspot analysis
│   │   ├── agencies/page.tsx       # Agency listing
│   │   └── agencies/[agency]/      # Per-agency dashboard + analytics
│   ├── components/
│   │   ├── Navbar.tsx              # Global navigation
│   │   ├── MapView.tsx             # Leaflet map (dynamic import)
│   │   ├── MapViewInner.tsx        # Leaflet map implementation
│   │   ├── ParticleField.tsx       # Animated particle background
│   │   ├── AnimationHelpers.tsx    # Framer Motion utilities
│   │   └── PortalRedirect.tsx      # Portal mode redirector
│   └── lib/
│       └── agencyConfig.ts         # Agency definitions (slug, color, icon)
│
├── backend/                        # Python FastAPI backend
│   ├── main.py                     # API routes + WebSocket endpoint
│   ├── services/
│   │   ├── sarvam.py               # Sarvam AI STT/TTS (primary voice engine)
│   │   ├── bedrock.py              # Amazon Bedrock AI triage
│   │   ├── dynamodb.py             # DynamoDB CRUD + analytics
│   │   ├── sns.py                  # SNS alert dispatch
│   │   ├── location.py             # AWS Location geocoding
│   │   └── transcribe.py           # Legacy Amazon Transcribe + mocks
│   ├── mock_db.json                # Mock incident data (dev/fallback)
│   ├── test_pipeline.py            # Pipeline integration test
│   ├── test_bedrock.py             # Bedrock unit test
│   └── test_real_pipeline.py       # Full AWS integration test
│
├── terraform/                      # Infrastructure as Code
│   ├── main.tf                     # Provider + tags
│   ├── ec2.tf                      # Backend EC2 + EIP + security group
│   ├── dynamodb.tf                 # Incidents table + GSIs
│   ├── sns.tf                      # 4 department alert topics
│   ├── iam.tf                      # EC2 role + least-privilege policies
│   ├── s3_cloudfront.tf            # Frontend hosting + CDN + API proxy
│   ├── location.tf                 # Geospatial place index (Esri)
│   ├── variables.tf                # Input variables
│   ├── outputs.tf                  # Output values
│   └── user_data.sh                # EC2 bootstrap (Python, Nginx, systemd)
│
├── docs/                           # Documentation
│   ├── ARCHITECTURE.md             # System architecture deep-dive
│   ├── API_REFERENCE.md            # Complete API documentation
│   └── DEVELOPMENT.md              # Developer setup guide
│
├── deploy.js                       # Automated frontend deploy to S3
├── package.json                    # Frontend dependencies + scripts
└── next.config.ts                  # Next.js config (static export)
```

---

## 🌐 AWS Services Used

| Service | Purpose |
|---------|---------|
| **Amazon Bedrock** | AI incident triage via Claude / Amazon Nova Lite |
| **Amazon DynamoDB** | Incident storage with GSIs for department & severity queries |
| **Amazon SNS** | Multi-department alert dispatch (4 topics + email subscriptions) |
| **Amazon S3** | Static frontend hosting (OAC protected) |
| **Amazon CloudFront** | CDN + HTTPS + reverse proxy for API/WebSocket traffic |
| **AWS Location Service** | Forward/reverse geocoding via Esri place index |
| **Amazon EC2** | Backend compute (FastAPI + Nginx + systemd) |
| **AWS IAM** | Least-privilege EC2 instance profile |

### Third-Party Services

| Service | Purpose |
|---------|---------|
| **Sarvam AI Saaras v4** | Speech-to-text for Indian languages |
| **Sarvam AI Bulbul v4 Flash** | Text-to-speech for dispatch summaries |

---

## 📖 Documentation

| Document | Description |
|----------|-------------|
| [Architecture](docs/ARCHITECTURE.md) | System architecture, data flow, and design decisions |
| [API Reference](docs/API_REFERENCE.md) | Complete REST & WebSocket API documentation |
| [Development Guide](docs/DEVELOPMENT.md) | Local setup, environment variables, testing |
| [AWS Deployment Guide](AWS_DEPLOYMENT_GUIDE_MULTI_ACCOUNT.md) | Multi-account AWS deployment walkthrough |
| [Configuration Guide](CONFIGURATION_GUIDE.md) | Model configuration & pipeline setup |

---

## 🏢 Departments & Agencies

| Agency | Slug | Incident Types |
|--------|------|----------------|
| 🚒 Fire Department | `/agencies/fire` | Building Fire, Gas Leak, Wildfire, Explosion |
| 🚔 Police | `/agencies/police` | Theft, Assault, Road Accident |
| 🚑 Medical Emergency | `/agencies/medical` | Medical Emergency, Snake Bite, Cardiac Arrest |
| ⚡ Disaster Response | `/agencies/disaster` | Flooding, Building Collapse, Earthquake, Landslide |

---

## 📝 License

Built for **Techkriti 2026** AWS Builder Center Track.
