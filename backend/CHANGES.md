# Changes Summary

## Model Update
- **Changed model from Claude 3 Haiku to Claude 3.5 Sonnet v2 (Sonnet 4)**
- Model ID: `apac.anthropic.claude-3-5-sonnet-20241022-v2:0`
- Updated in `.env` file

## Enhanced AI Analysis

### 1. Location Extraction
The AI now extracts location information directly from the incident transcript:
- Looks for street names, landmarks, building names
- Identifies area/locality names
- Detects city/district names
- Captures any geographical references

### 2. Department Reasoning
The AI now provides explicit reasoning for department selection based on:
- Type of emergency (fire → Fire Department, medical → Medical Emergency, crime → Police)
- Severity level (critical incidents may need multiple departments)
- Specific hazards mentioned (gas leaks → Fire Department, injuries → Medical Emergency)
- Scale of incident (large-scale disasters → Disaster Response)

### 3. Extended Thinking
- Enabled extended thinking mode with 3000 token budget
- AI reasoning is logged to console for transparency
- Department reasoning is also logged separately

## Location Handling Logic

The system now uses a priority-based approach for determining incident location:

1. **Priority 1**: Location extracted from transcript by AI
   - If AI identifies a location in the user's description, it's geocoded to coordinates
   
2. **Priority 2**: User-provided coordinates
   - If user explicitly provides GPS coordinates, those are used
   
3. **Priority 3**: Default location (Kanpur)
   - Fallback to Kanpur coordinates (26.4499, 80.3319) if no location is specified

## New Functions

### `geocode(location_text: str)` in `services/location.py`
- Converts human-readable location text to GPS coordinates
- Uses AWS Location Service for forward geocoding
- Includes mock implementation for development

## API Response Changes

The Bedrock analysis now returns additional fields:
- `location_extracted`: Location mentioned in the report or null
- `department_reasoning`: Brief explanation of why departments were selected

## Testing

To test the changes:

```bash
# Test with location in transcript
curl -X POST http://localhost:8000/api/report \
  -H "Content-Type: application/json" \
  -d '{
    "transcript": "There is a fire at Sector 15, Kanpur. Multiple people are trapped.",
    "language": "en-IN"
  }'

# Test with explicit coordinates
curl -X POST http://localhost:8000/api/report \
  -H "Content-Type: application/json" \
  -d '{
    "transcript": "There is a fire. Multiple people are trapped.",
    "language": "en-IN",
    "coordinates": {"lat": 26.4499, "lng": 80.3319}
  }'

# Test with no location (uses default)
curl -X POST http://localhost:8000/api/report \
  -H "Content-Type: application/json" \
  -d '{
    "transcript": "There is a fire. Multiple people are trapped.",
    "language": "en-IN"
  }'
```

## Console Output

You'll now see additional logging:
- `[AI REASONING]`: The AI's thinking process
- `[DEPARTMENT REASONING]`: Explanation of department selection
