# CivicAlert Pipeline Configuration Guide

## Summary of Changes

### 1. Model Configuration Updated
- **Changed**: Bedrock model configuration to support Claude Sonnet 4 with extended thinking
- **File**: `backend/.env`
- **Current Setting**: `BEDROCK_MODEL_ID=anthropic.claude-3-sonnet-20240229-v1:0`

### 2. Location Handling Fixed
- **Fixed**: Backend now properly handles user location from coordinates
- **File**: `backend/main.py`
- **Change**: Uses provided coordinates or falls back to default Kanpur location (26.4499, 80.3319)

### 3. Extended Thinking Support
- **Added**: Conditional extended thinking support for Claude Sonnet 4
- **File**: `backend/services/bedrock.py`
- **Feature**: Automatically enables extended thinking for Sonnet 4 models

## How to Enable Claude Sonnet 4 with Extended Thinking

### Step 1: Fix AWS Payment Issue
The current AWS account has a payment instrument issue. To resolve:
1. Go to AWS Console → Billing Dashboard
2. Add or update payment method
3. Wait 2-5 minutes for the change to propagate

### Step 2: Update Model Configuration
Once payment is fixed, update `backend/.env`:

```bash
# For Claude Sonnet 4 with extended thinking (RECOMMENDED)
BEDROCK_MODEL_ID=apac.anthropic.claude-sonnet-4-20250514-v1:0

# Alternative: Claude 3.5 Sonnet v2 (no extended thinking)
# BEDROCK_MODEL_ID=apac.anthropic.claude-3-5-sonnet-20241022-v2:0

# Current fallback: Claude 3 Sonnet
# BEDROCK_MODEL_ID=anthropic.claude-3-sonnet-20240229-v1:0
```

### Step 3: Test the Pipeline
```bash
cd backend
source venv/bin/activate
python test_real_pipeline.py
```

## Available Models

### Claude Sonnet 4 (BEST - with Extended Thinking)
- **Model ID**: `apac.anthropic.claude-sonnet-4-20250514-v1:0`
- **Features**: Extended thinking, best reasoning
- **Type**: Inference Profile
- **Status**: ❌ Requires payment fix

### Claude 3.5 Sonnet v2
- **Model ID**: `apac.anthropic.claude-3-5-sonnet-20241022-v2:0`
- **Features**: Fast, accurate
- **Type**: Inference Profile
- **Status**: ❌ Requires payment fix

### Claude 3 Sonnet (Current Fallback)
- **Model ID**: `anthropic.claude-3-sonnet-20240229-v1:0`
- **Features**: Reliable, on-demand
- **Type**: On-Demand
- **Status**: ❌ Requires payment fix

## Location Handling

The system now properly handles location in three ways:

1. **User provides coordinates**: Uses exact GPS location from browser
2. **User denies location**: Falls back to Kanpur, India (26.4499, 80.3319)
3. **Location unavailable**: Uses default fallback location

### Frontend (report/page.tsx)
```typescript
// Gets user location on page load
useEffect(() => {
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (pos) => setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setCoords({ lat: 26.4499, lng: 80.3319 }) // Fallback
    );
  }
}, []);
```

### Backend (main.py)
```python
# Uses provided coordinates or fallback
coords = report.coordinates if report.coordinates else Coordinates(lat=26.4499, lng=80.3319)
location = await reverse_geocode(coords.lat, coords.lng)
```

## Testing

### Test Files Created
1. `backend/test_pipeline.py` - Basic pipeline test (uses mock if payment fails)
2. `backend/test_bedrock.py` - Direct Bedrock API test
3. `backend/test_real_pipeline.py` - Full real AWS services test

### Run Tests
```bash
cd backend
source venv/bin/activate

# Basic test (works with mock)
python test_pipeline.py

# Real AWS test (requires payment fix)
python test_real_pipeline.py
```

## Current Status

✅ **Fixed**:
- Location handling (uses user location or fallback)
- Extended thinking support (conditional based on model)
- Model configuration (ready for Claude Sonnet 4)

❌ **Blocked**:
- Real Bedrock API calls (payment instrument issue)
- Claude Sonnet 4 testing (requires payment fix)

⚠️ **Workaround**:
- System uses mock responses when `USE_MOCK=true`
- Mock responses simulate realistic emergency analysis
- All code is ready for real AWS services once payment is fixed

## Next Steps

1. **Fix AWS Payment**: Add valid payment method in AWS Console
2. **Update Model**: Change `BEDROCK_MODEL_ID` to Claude Sonnet 4
3. **Test Pipeline**: Run `python test_real_pipeline.py`
4. **Start Backend**: `uvicorn main:app --reload`
5. **Test Frontend**: Navigate to `/report` and test voice input

## Environment Variables

```bash
# AWS Configuration
AWS_REGION=ap-south-1
AWS_ACCESS_KEY_ID=<your-key>
AWS_SECRET_ACCESS_KEY=<your-secret>

# AI Provider
USE_MOCK=false  # Set to true for development without AWS
USE_ANTHROPIC_API=false  # Set to true to use Anthropic API directly

# Bedrock Model (choose one)
BEDROCK_MODEL_ID=apac.anthropic.claude-sonnet-4-20250514-v1:0  # Best
# BEDROCK_MODEL_ID=apac.anthropic.claude-3-5-sonnet-20241022-v2:0  # Fast
# BEDROCK_MODEL_ID=anthropic.claude-3-sonnet-20240229-v1:0  # Fallback

# Optional: Debug extended thinking
DEBUG_THINKING=false  # Set to true to see reasoning process
```

## Architecture

```
User Report (Voice/Text)
    ↓
Frontend (Next.js)
    ↓ [coordinates + transcript]
Backend API (FastAPI)
    ↓
┌─────────────────────────────────┐
│ 1. Transcribe (if voice)        │
│    → Amazon Transcribe           │
├─────────────────────────────────┤
│ 2. Analyze Incident              │
│    → AWS Bedrock (Claude)        │
│    → Extended Thinking (Sonnet 4)│
├─────────────────────────────────┤
│ 3. Geocode Location              │
│    → AWS Location Service        │
├─────────────────────────────────┤
│ 4. Dispatch Alerts               │
│    → Amazon SNS                  │
└─────────────────────────────────┘
    ↓
Response to User
```

## Support

For issues or questions:
1. Check AWS Console for payment status
2. Review CloudWatch logs for API errors
3. Test with `USE_MOCK=true` for development
4. Verify AWS credentials and permissions
