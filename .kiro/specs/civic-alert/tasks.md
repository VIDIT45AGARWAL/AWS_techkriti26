# Tasks: CivicAlert — AI-Powered Emergency Response System

## Implementation Plan

- [x] 1. Project scaffolding & design system
  - [x] 1.1 Initialize Next.js 14 project with TypeScript and App Router
  - [x] 1.2 Configure `next.config.ts` for static export (`output: 'export'`)
  - [x] 1.3 Define global CSS design tokens (color variables, glass-card, badge, btn utilities)
  - [x] 1.4 Create root `layout.tsx` with Navbar and portal root
  - [x] 1.5 Implement `Navbar.tsx` with brand logo and navigation links
  - [x] 1.6 Implement `AnimationHelpers.tsx` (AnimatedCounter, StaggerContainer, TiltCard, MagneticHover, TextReveal, ScrollProgress)
  - [x] 1.7 Implement `ParticleField.tsx` canvas-based particle animation

- [x] 2. Landing page
  - [x] 2.1 Build hero section with animated phone mockup and orbiting rings
  - [x] 2.2 Build stats section with AnimatedCounter cards
  - [x] 2.3 Build "How It Works" 3-step section with connection line animation
  - [x] 2.4 Build features grid (6 feature cards with TiltCard)
  - [x] 2.5 Build CTA section with animated orbs
  - [x] 2.6 Embed ReportPage at `#report` anchor
  - [x] 2.7 Build footer with brand and team credits

- [x] 3. Voice report page (`/report`)
  - [x] 3.1 Implement language selector dropdown (6 Indian languages)
  - [x] 3.2 Implement microphone button with idle/recording/processing/done states
  - [x] 3.3 Implement real-time audio waveform visualization using AnalyserNode
  - [x] 3.4 Implement WebSocket connection to `/ws/transcribe` with PCM streaming
  - [x] 3.5 Implement `simulateFallbackTranscription()` for when WebSocket is unavailable
  - [x] 3.6 Implement GPS location capture with Kanpur fallback
  - [x] 3.7 Implement `POST /api/report` call with transcript + language + coordinates
  - [x] 3.8 Implement processing steps UI (4 steps with animated progress)
  - [x] 3.9 Implement triage result display: incident classification, location, casualties, departments, AI summary
  - [x] 3.10 Implement confidence bar animation
  - [x] 3.11 Implement reset flow (tap done button → back to idle)

- [x] 4. FastAPI backend
  - [x] 4.1 Initialize FastAPI app with CORS middleware
  - [x] 4.2 Define Pydantic models: `Coordinates`, `IncidentReport`, `Incident`, `StatusUpdate`
  - [x] 4.3 Implement `POST /api/report` — full pipeline (analyze → geocode → store → dispatch)
  - [x] 4.4 Implement `GET /api/incidents` with optional department/severity/status filters
  - [x] 4.5 Implement `GET /api/incidents/:id`
  - [x] 4.6 Implement `PATCH /api/incidents/:id/status`
  - [x] 4.7 Implement `GET /api/analytics`
  - [x] 4.8 Implement `GET /api/health`
  - [x] 4.9 Implement `WS /ws/transcribe` with config → audio → transcript → done protocol

- [x] 5. AI triage service (`bedrock.py`)
  - [x] 5.1 Implement `analyze_incident()` dispatcher (mock / Anthropic API / Bedrock)
  - [x] 5.2 Implement `_analyze_with_bedrock()` with extended thinking support for Claude Sonnet 4
  - [x] 5.3 Implement `_analyze_with_anthropic()` for direct Anthropic API usage
  - [x] 5.4 Implement `_mock_analyze()` with keyword-based classification (fire, accident, flood, general)
  - [x] 5.5 Ensure all paths return the same schema: type, severity, casualties, departments, summary, confidence

- [x] 6. AWS service integrations
  - [x] 6.1 Implement `transcribe.py` — `transcribe_audio()` and `transcribe_audio_streaming()` with Amazon Transcribe
  - [x] 6.2 Implement `location.py` — `reverse_geocode()` and `geocode()` with AWS Location Service
  - [x] 6.3 Implement `sns.py` — `dispatch_alerts()` publishing to per-department SNS topics
  - [x] 6.4 Implement `dynamodb.py` — `put_incident`, `get_incidents`, `get_incident`, `update_incident_status`, `get_analytics`
  - [x] 6.5 Implement mock fallback in each service (file-based for DynamoDB, console log for SNS, passthrough for Transcribe)

- [x] 7. Department dashboard (`/dashboard`)
  - [x] 7.1 Implement incident feed with severity-sorted cards and AnimatePresence transitions
  - [x] 7.2 Implement department filter tabs (All / Police / Fire / Medical / Disaster)
  - [x] 7.3 Implement stats bar (active, responding, avg response, depts active)
  - [x] 7.4 Implement 15-second polling for live updates
  - [x] 7.5 Implement "Mark as Resolved" button with optimistic UI update
  - [x] 7.6 Implement `MapView.tsx` + `MapViewInner.tsx` with Leaflet (dynamic import, SSR disabled)
  - [x] 7.7 Implement incident detail panel (shown on card/pin click)
  - [x] 7.8 Implement empty state and loading state

- [x] 8. Analytics page (`/analytics`)
  - [x] 8.1 Implement summary stat cards (total, active, resolved, resolution rate)
  - [x] 8.2 Implement incidents-by-type bar chart (Recharts)
  - [x] 8.3 Implement severity distribution pie/donut chart
  - [x] 8.4 Implement department workload bar chart
  - [x] 8.5 Implement location hotspots bar chart
  - [x] 8.6 Implement department filter dropdown

- [x] 9. Agency pages (`/agencies`, `/agencies/[agency]`)
  - [x] 9.1 Define `agencyConfig.ts` with 4 agencies (fire, police, medical, disaster)
  - [x] 9.2 Implement `/agencies` listing page with agency cards
  - [x] 9.3 Implement `/agencies/[agency]/layout.tsx` with agency header and tab navigation
  - [x] 9.4 Implement `/agencies/[agency]/dashboard/page.tsx` (filtered incident feed + map)
  - [x] 9.5 Implement `/agencies/[agency]/analytics/page.tsx` (agency-scoped analytics)
  - [x] 9.6 Implement `AgencyTabs.tsx` client component for tab switching

- [x] 10. Infrastructure (Terraform)
  - [x] 10.1 Write `main.tf` — provider config, region, backend
  - [x] 10.2 Write `ec2.tf` — EC2 instance, security group, key pair
  - [x] 10.3 Write `user_data.sh` — bootstrap script (install deps, clone repo, start uvicorn)
  - [x] 10.4 Write `dynamodb.tf` — incidents table with GSI on status
  - [x] 10.5 Write `sns.tf` — 4 SNS topics (one per department)
  - [x] 10.6 Write `iam.tf` — EC2 instance role with least-privilege policies
  - [x] 10.7 Write `s3_cloudfront.tf` — S3 bucket + CloudFront distribution
  - [x] 10.8 Write `variables.tf` and `terraform.tfvars.example`
  - [x] 10.9 Write `outputs.tf` — expose EC2 IP, CloudFront URL, S3 bucket name

- [x] 11. Deployment automation
  - [x] 11.1 Write `deploy.js` — reads Terraform outputs, writes `.env.local`, builds Next.js, syncs to S3, invalidates CloudFront
  - [x] 11.2 Add `deploy` script to `package.json`
  - [x] 11.3 Write `backend/.env.example` with all required environment variables

- [x] 12. Property-based tests
  - [x] 12.1 Write `backend/test_pipeline.py` — basic pipeline test with mock fallback
  - [x] 12.2 Write `backend/test_bedrock.py` — direct Bedrock API connectivity test
  - [x] 12.3 Write `backend/test_real_pipeline.py` — full real AWS services integration test
  - [x]* 12.4 Write Hypothesis-based PBT for P2 (severity constraint) and P3 (department constraint)
  - [x]* 12.5 Write Hypothesis-based PBT for P4 (location fallback guarantee)
  - [x]* 12.6 Write Hypothesis-based PBT for P6 (status transition validity)
  - [x]* 12.7 Write Hypothesis-based PBT for P7 (confidence bounds)
