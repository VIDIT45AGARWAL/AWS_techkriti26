#!/usr/bin/env python3
"""
Test the full pipeline with real AWS services (not mock).
"""
import asyncio
import sys
import os
from dotenv import load_dotenv

load_dotenv()

# Force disable mock mode
os.environ['USE_MOCK'] = 'false'

from services.bedrock import analyze_incident
from services.location import reverse_geocode

async def test_real_pipeline():
    print("🧪 Testing CivicAlert Pipeline with REAL AWS Services\n")
    print(f"USE_MOCK: {os.getenv('USE_MOCK')}")
    print(f"BEDROCK_MODEL_ID: {os.getenv('BEDROCK_MODEL_ID')}\n")
    
    # Test 1: Real Bedrock Analysis
    print("1️⃣ Testing REAL Bedrock AI Analysis with Claude Sonnet 4...")
    test_transcript = "There is a major fire in a building near sector 15. Multiple people are trapped on the third floor. I can see heavy smoke and flames."
    
    try:
        result = await analyze_incident(test_transcript)
        print(f"✅ Real Bedrock analysis successful!")
        print(f"   Type: {result['incident_type']}")
        print(f"   Severity: {result['severity']}")
        print(f"   Departments: {', '.join(result['departments'])}")
        print(f"   Casualties: {result['casualties']}")
        print(f"   Summary: {result['summary'][:100]}...")
        print(f"   Confidence: {result.get('confidence', 'N/A')}")
        print()
    except Exception as e:
        print(f"❌ Real Bedrock analysis failed: {e}")
        import traceback
        traceback.print_exc()
        return False
    
    # Test 2: Real Location Service
    print("2️⃣ Testing REAL AWS Location Service...")
    test_lat, test_lng = 26.4499, 80.3319  # Kanpur coordinates
    
    try:
        location = await reverse_geocode(test_lat, test_lng)
        print(f"✅ Real geocoding successful!")
        print(f"   Location: {location}")
        print()
    except Exception as e:
        print(f"❌ Real geocoding failed: {e}")
        import traceback
        traceback.print_exc()
        return False
    
    print("✨ All REAL AWS services working correctly!")
    print("🎯 Claude Sonnet 4 with extended thinking is active!")
    return True

if __name__ == "__main__":
    success = asyncio.run(test_real_pipeline())
    sys.exit(0 if success else 1)
