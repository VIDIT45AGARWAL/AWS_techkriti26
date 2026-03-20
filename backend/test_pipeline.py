#!/usr/bin/env python3
"""
Test script to verify the CivicAlert pipeline works end-to-end.
"""
import asyncio
import sys
from services.bedrock import analyze_incident
from services.location import reverse_geocode

async def test_pipeline():
    print("🧪 Testing CivicAlert Pipeline\n")
    
    # Test 1: Bedrock Analysis
    print("1️⃣ Testing Bedrock AI Analysis...")
    test_transcript = "There is a major fire in a building near sector 15. Multiple people are trapped on the third floor. I can see heavy smoke."
    
    try:
        result = await analyze_incident(test_transcript)
        print(f"✅ Analysis successful!")
        print(f"   Type: {result['incident_type']}")
        print(f"   Severity: {result['severity']}")
        print(f"   Departments: {', '.join(result['departments'])}")
        print(f"   Confidence: {result.get('confidence', 'N/A')}")
        print()
    except Exception as e:
        print(f"❌ Analysis failed: {e}")
        print()
        return False
    
    # Test 2: Location Service
    print("2️⃣ Testing AWS Location Service...")
    test_lat, test_lng = 26.4499, 80.3319  # Kanpur coordinates
    
    try:
        location = await reverse_geocode(test_lat, test_lng)
        print(f"✅ Geocoding successful!")
        print(f"   Location: {location}")
        print()
    except Exception as e:
        print(f"❌ Geocoding failed: {e}")
        print()
        return False
    
    print("✨ All tests passed! Pipeline is working correctly.")
    return True

if __name__ == "__main__":
    success = asyncio.run(test_pipeline())
    sys.exit(0 if success else 1)
