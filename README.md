# Awaaz

Voice-first emergency reporting. Speak what you see — Awaaz transcribes, triages, and dispatches the report to every relevant emergency desk.

## Run

```bash
npm install
npm run dev            # frontend → localhost:3000

cd backend
pip install -r requirements.txt
uvicorn main:app --reload   # API → localhost:8000
```

## Deploy

Provision with Terraform, then ship the static build:

```bash
cd terraform && terraform apply
npm run build && npm run deploy
```

Agency portal build: `NEXT_PUBLIC_PORTAL_MODE=agencies`.

Built at Techkriti 2026, AWS Builder Center track.
