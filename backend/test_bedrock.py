#!/usr/bin/env python3
"""
Test Bedrock with Claude Sonnet 4 directly.
"""
import asyncio
import os
from dotenv import load_dotenv

load_dotenv()

async def test_bedrock_direct():
    import boto3
    import json
    
    print("🧪 Testing AWS Bedrock with Claude Sonnet 4\n")
    print(f"Region: {os.getenv('AWS_REGION')}")
    print(f"Model: {os.getenv('BEDROCK_MODEL_ID')}")
    print(f"USE_MOCK: {os.getenv('USE_MOCK')}\n")
    
    client = boto3.client(
        "bedrock-runtime",
        region_name=os.getenv("AWS_REGION", "ap-south-1"),
        aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID"),
        aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY"),
    )
    
    prompt = "Analyze this emergency: There is a fire in a building. Return JSON with incident_type, severity, casualties, departments, summary, confidence."
    
    try:
        response = client.invoke_model(
            modelId=os.getenv("BEDROCK_MODEL_ID", "anthropic.claude-sonnet-4-20250514-v1:0"),
            body=json.dumps({
                "anthropic_version": "bedrock-2023-05-31",
                "max_tokens": 4096,
                "thinking": {
                    "type": "enabled",
                    "budget_tokens": 2000
                },
                "messages": [{"role": "user", "content": prompt}],
            }),
            contentType="application/json",
        )
        
        result = json.loads(response["body"].read())
        print("✅ Bedrock call successful!")
        print(f"\nResponse structure: {list(result.keys())}")
        print(f"\nContent blocks:")
        for block in result.get("content", []):
            print(f"  - Type: {block.get('type')}")
            if block.get('type') == 'thinking':
                print(f"    Thinking: {block.get('thinking', '')[:100]}...")
            elif block.get('type') == 'text':
                print(f"    Text: {block.get('text', '')[:200]}...")
        
    except Exception as e:
        print(f"❌ Bedrock call failed: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_bedrock_direct())
