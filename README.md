# 🚨 CivicAlert — AI-Powered Emergency Response

> **Team Segionpex** | AWS Builder Center — Techkriti 2026
> @jabhaskript · @geng4r · @blackadder45

**CivicAlert** is a voice-first, AI-powered emergency reporting system where civilians speak what they see and the system handles everything else. From voice input to multi-department dispatch in **under 10 seconds**.

---

## 🏗️ Architecture

```
┌─────────────┐     ┌──────────────┐     ┌──────────────────┐
│  Next.js UI │────▷│  FastAPI API  │────▷│  Amazon Bedrock   │
│  (Frontend) │     │  (Backend)    │     │  (AI Triage)      │
└─────────────┘     └──────┬───────┘     └──────────────────┘
                           │
              ┌────────────┼────────────┐
              ▼            ▼            ▼
     ┌──────────────┐ ┌─────────┐ ┌──────────────┐
     │ Amazon       │ │ Amazon  │ │ AWS Location │
     │ Transcribe   │ │ SNS     │ │ Service      │
     │ (Speech→Text)│ │(Dispatch)│ │ (Geocoding)  │
     └──────────────┘ └─────────┘ └──────────────┘
                           │
                    ┌──────┴───────┐
                    │  DynamoDB    │
                    │  (Storage)   │
                    └──────────────┘
```

## 🚀 Quick Start

### Frontend (Next.js)
```bash
cd civic-alert
npm install
npm run dev        # → http://localhost:3000
```

### Backend (Python FastAPI)
```bash
cd civic-alert/backend
pip install -r requirements.txt
cp .env.example .env
uvicorn main:app --reload   # → http://localhost:8000
```

### Deploy to AWS (Terraform + S3)

**Step 1 — Provision infrastructure:**
```bash
cd civic-alert/terraform
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars with your values
terraform init
terraform plan
terraform apply
```

**Step 2 — Build & deploy the frontend to S3:**
```bash
cd civic-alert
npm run deploy
```
This single command:
- Reads the EC2 backend IP from Terraform outputs
- Writes `.env.local` with `NEXT_PUBLIC_API_URL` pointing to your backend
- Builds the Next.js static export
- Uploads to S3 and invalidates CloudFront cache

> **💡 Tip:** If you only changed frontend code (no infra changes), just run `npm run deploy` — no need to re-run Terraform.

**Manual alternative (if `npm run deploy` doesn't work on your shell):**
```bash
# Set your backend IP
echo "NEXT_PUBLIC_API_URL=http://<EC2_IP>:8000" > .env.local
npm run build
aws s3 sync out/ s3://<YOUR_BUCKET_NAME> --delete
aws cloudfront create-invalidation --distribution-id <YOUR_DIST_ID> --paths "/*"
```
You can find all values from `terraform output` inside the `terraform/` directory.

## 📂 Project Structure

```
civic-alert/
├── src/                    # Next.js frontend
│   ├── app/
│   │   ├── page.tsx        # Landing page
│   │   ├── report/         # Voice report page
│   │   ├── dashboard/      # Department dashboard
│   │   └── analytics/      # Analytics & hotspots
│   └── components/         # Shared components
├── backend/                # Python FastAPI
│   ├── main.py             # API routes
│   └── services/           # AWS integrations
│       ├── transcribe.py   # Amazon Transcribe
│       ├── bedrock.py      # Amazon Bedrock
│       ├── sns.py          # Amazon SNS
│       └── location.py     # AWS Location Service
└── terraform/              # Infrastructure as Code
    ├── main.tf             # Provider config
    ├── ec2.tf              # Backend server
    ├── dynamodb.tf         # Incidents table
    ├── sns.tf              # Alert topics
    ├── iam.tf              # Roles & policies
    └── s3_cloudfront.tf    # Frontend hosting
```

## 🌐 Key Features

| Feature | Technology |
|---------|-----------|
| One-button voice input | Web Audio API + Amazon Transcribe |
| AI incident triage | Amazon Bedrock (Claude) |
| Multi-department dispatch | Amazon SNS |
| Real-time dashboard | Next.js + DynamoDB |
| GPS reverse geocoding | AWS Location Service |
| Analytics & hotspots | Recharts + DynamoDB |
| Infrastructure | Terraform + EC2 + CloudFront |

## 📝 License

Built for Techkriti 2026 AWS Builder Center Track.
