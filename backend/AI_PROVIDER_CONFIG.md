# AI Provider Configuration

CivicAlert supports three modes for AI-powered incident analysis:

## 1. Mock Mode (Development)
```env
USE_MOCK=true
```
Returns predefined responses based on keywords. No API calls made.

## 2. Anthropic API (Direct)
```env
USE_MOCK=false
USE_ANTHROPIC_API=true
ANTHROPIC_API_KEY=sk-ant-api03-your-actual-key
```

**Get API Key:** https://console.anthropic.com/

## 3. AWS Bedrock (with API Keys)
```env
USE_MOCK=false
USE_ANTHROPIC_API=false
AWS_ACCESS_KEY_ID=your-bedrock-access-key
AWS_SECRET_ACCESS_KEY=your-bedrock-secret-key
AWS_REGION=ap-south-1
BEDROCK_MODEL_ID=anthropic.claude-3-sonnet-20240229-v1:0
```

**Setup:**
1. Use IAM user credentials with Bedrock permissions
2. Required IAM policy:
```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": [
      "bedrock:InvokeModel",
      "bedrock:InvokeModelWithResponseStream"
    ],
    "Resource": "arn:aws:bedrock:*::foundation-model/*"
  }]
}
```

## Testing

```bash
# Test with mock
USE_MOCK=true uvicorn main:app --reload

# Test with Anthropic API
USE_MOCK=false USE_ANTHROPIC_API=true ANTHROPIC_API_KEY=sk-ant-... uvicorn main:app --reload

# Test with Bedrock
USE_MOCK=false USE_ANTHROPIC_API=false uvicorn main:app --reload
```
