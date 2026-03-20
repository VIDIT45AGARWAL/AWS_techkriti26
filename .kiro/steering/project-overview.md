---
inclusion: always
---

# CivicAlert — Project Overview

CivicAlert is a voice-first, AI-powered emergency reporting system built for India. Civilians press one button, speak about an emergency in any supported Indian language, and the system transcribes, triages, classifies, and dispatches structured alerts to the relevant government departments in under 10 seconds.

## Stack

- **Frontend**: Next.js 14 (App Router, TypeScript, static export), Framer Motion, Leaflet, Recharts
- **Backend**: Python FastAPI (uvicorn), boto3, aiohttp
- **AI**: Amazon Bedrock (Claude Sonnet 4 / 3.5 / 3), Anthropic API (fallback)
- **AWS Services**: Amazon Transcribe, AWS Location Service, Amazon SNS, DynamoDB
- **Infrastructure**: Terraform (EC2, S3, CloudFront, DynamoDB, SNS, IAM)

## Key Directories

```
src/app/           Next.js pages (report, dashboard, analytics, agencies)
src/components/    Shared UI components (Navbar, MapView, ParticleField, AnimationHelpers)
src/lib/           Shared config (agencyConfig.ts)
backend/           FastAPI app + AWS service integrations
backend/services/  bedrock.py, transcribe.py, location.py, sns.py, dynamodb.py
terraform/         Infrastructure as Code
```

## Environment Modes

- `USE_MOCK=true` — full local dev, no AWS required (default)
- `USE_MOCK=false` — real AWS services
- `USE_ANTHROPIC_API=true` — use Anthropic API directly instead of Bedrock

## Running Locally

```bash
# Frontend
npm install && npm run dev

# Backend
cd backend && pip install -r requirements.txt
cp .env.example .env   # set USE_MOCK=true for local dev
uvicorn main:app --reload
```

## Agencies

Four departments are supported: `fire`, `police`, `medical`, `disaster`. Each has a dedicated slug, color, and API name defined in `src/lib/agencyConfig.ts`.
