"""
Conversational emergency intake engine.

Turns CivicAlert into a voice dispatcher agent: the caller describes the
emergency in their own words, the AI asks short follow-up questions (spoken
back via Sarvam Bulbul v4), and files the incident once it has type,
location and casualty details.

AI: AWS Bedrock Converse API (default apac.amazon.nova-lite-v1:0).
Falls back to a scripted question flow + keyword triage if the AI is down —
never invents facts the caller did not say.
"""
import asyncio
import json
import os
import re

from .bedrock import (
    _enforce_department_rules,
    _has_signal,
    _normalize_confidence,
)

USE_MOCK = os.getenv("USE_MOCK", "false").lower() == "true"

MAX_USER_TURNS = 10  # hard stop: file the incident after this many exchanges

# Scripted fallback questions (used only when the AI service is down)
_FALLBACK_QUESTIONS = [
    "What is the emergency?",
    "Where is it happening? Please tell me the area or landmark.",
    "Is anyone injured or trapped?",
]


def _dialogue_text(history: list) -> str:
    lines = []
    for turn in history:
        role = "Dispatcher" if turn.get("role") == "assistant" else "Caller"
        lines.append(f"{role}: {turn.get('text', '')}")
    return "\n".join(lines)


def _parse_json_reply(text: str) -> dict:
    """Strip markdown fences / preamble and parse the JSON the model returns."""
    cleaned = re.sub(r"^```(?:json)?\s*|\s*```$", "", (text or "").strip(), flags=re.MULTILINE)
    start, end = cleaned.find("{"), cleaned.rfind("}")
    if start >= 0 and end > start:
        cleaned = cleaned[start : end + 1]
    return json.loads(cleaned)


async def _engine_with_bedrock(history: list, language: str) -> dict:
    """One conversational turn via the Bedrock Converse API."""
    import boto3

    client_kwargs = {"region_name": os.getenv("AWS_REGION", "ap-south-1")}
    if os.getenv("BEDROCK_AWS_ACCESS_KEY_ID"):
        client_kwargs["aws_access_key_id"] = os.getenv("BEDROCK_AWS_ACCESS_KEY_ID")
        client_kwargs["aws_secret_access_key"] = os.getenv("BEDROCK_AWS_SECRET_ACCESS_KEY")
    client = boto3.client("bedrock-runtime", **client_kwargs)

    model_id = os.getenv("BEDROCK_MODEL_ID", "apac.amazon.nova-lite-v1:0")
    language_name = {
        "en-IN": "English (India)", "hi-IN": "Hindi", "ta-IN": "Tamil",
        "te-IN": "Telugu", "bn-IN": "Bengali", "mr-IN": "Marathi",
    }.get(language, "English (India)")

    system_prompt = f"""You are CivicAlert's emergency dispatcher on a live voice call with a person reporting an emergency in India.

Your job: quickly collect (1) the nature of the emergency, (2) the location, (3) casualties/injuries — then file the report. You are the dispatcher, not the caller.

HARD RULES:
1. ALWAYS reply in {language_name}. Keep replies SHORT (1-2 sentences) — they are spoken aloud.
2. Ask exactly ONE question per reply, only about emergency-relevant details.
3. FORBIDDEN questions: the caller's name, phone number, age, gender, address proof, or any identification. NEVER ask these.
4. NEVER invent facts the caller did not say.
5. If the caller's message ALREADY contains the emergency type, the location AND the casualty situation (even "no injuries"), you MUST return action "file" IMMEDIATELY. Also file immediately when the caller says that is all they know or there is nothing more to add.
6. Prefer filing one question too early over asking unnecessary questions — lives depend on speed.

Return ONLY valid JSON, no other text:
{{"action": "ask", "reply": "your spoken question or brief acknowledgement"}}
or
{{"action": "file", "reply": "short spoken closing confirmation that help is being dispatched", "analysis": {{"incident_type": "...", "severity": "critical|high|medium|low", "casualties": "...", "departments": ["Police", "Fire Department", "Medical Emergency", "Disaster Response"], "location_extracted": "the location exactly as the caller described it, or null", "summary": "2-3 sentence structured summary for dispatchers", "confidence": 0.0}}}}"""

    user_prompt = f"Conversation so far:\n{_dialogue_text(history)}\n\nProduce your next dispatcher reply as JSON."

    def _invoke() -> str:
        response = client.converse(
            modelId=model_id,
            system=[{"text": system_prompt}],
            messages=[{"role": "user", "content": [{"text": user_prompt}]}],
            inferenceConfig={"maxTokens": 1024, "temperature": 0.2},
        )
        blocks = response["output"]["message"]["content"]
        return "".join(b.get("text", "") for b in blocks if b.get("text"))

    loop = asyncio.get_event_loop()
    reply_text = await loop.run_in_executor(None, _invoke)
    parsed = _parse_json_reply(reply_text)

    if parsed.get("action") not in ("ask", "file"):
        raise ValueError(f"unexpected action: {parsed.get('action')!r}")
    return parsed


def _scripted_reply(history: list) -> str | None:
    """Next scripted question based on how many user turns have happened."""
    user_turns = sum(1 for t in history if t.get("role") == "user")
    if user_turns <= len(_FALLBACK_QUESTIONS):
        return _FALLBACK_QUESTIONS[user_turns - 1]
    return None


def _keyword_triage(history: list) -> dict:
    """Honest keyword-based analysis of everything the caller said."""
    text = " ".join(t.get("text", "") for t in history if t.get("role") == "user").lower()

    if _has_signal(["fire", "smoke", "burn*", "gas leak*", "explosion", "आग", "धुआं"], text):
        incident_type = "Fire Emergency"
    elif _has_signal(["flood*", "earthquake*", "cyclone*", "landslide*", "बाढ़", "भूकंप"], text):
        incident_type = "Natural Disaster"
    elif _has_signal(["accident*", "crash*", "collision*"], text):
        incident_type = "Road Accident"
    elif _has_signal(["theft", "robber*", "assault*", "stabbing*", "shooting*"], text):
        incident_type = "Crime Report"
    elif _has_signal(["injur*", "unconscious*", "bleed*", "faint*", "heart attack*"], text):
        incident_type = "Medical Emergency"
    else:
        incident_type = "General Emergency"

    analysis = {
        "incident_type": incident_type,
        "severity": "medium",
        "casualties": "Unknown",
        "departments": [],
        "location_extracted": None,
        "summary": text[:500],
        "confidence": 40,
    }
    analysis["departments"] = _enforce_department_rules(analysis, text)
    return analysis


async def converse(history: list, language: str = "en-IN") -> dict:
    """
    One conversational turn.

    Args:
        history: full conversation, latest caller message included.
                 Each item: {"role": "user"|"assistant", "text": str}
        language: BCP-47 code the dispatcher must reply in

    Returns:
        {
            "status": "ask" | "finalized",
            "reply": spoken reply text,
            "analysis": {...}   # only when finalized
        }
    """
    if USE_MOCK:
        return await _mock_converse(history, language)

    user_turns = sum(1 for t in history if t.get("role") == "user")

    try:
        result = await _engine_with_bedrock(history, language)
    except Exception as e:
        print(f"[CONVERSATION] AI turn failed ({type(e).__name__}: {e}). Using scripted flow.")
        scripted = _scripted_reply(history)
        if scripted:
            return {"status": "ask", "reply": scripted}
        return {
            "status": "finalized",
            "reply": "Thank you. Help is being dispatched right now.",
            "analysis": _keyword_triage(history),
        }

    # Force finalization when the caller has said enough
    if result["action"] == "ask" and user_turns >= MAX_USER_TURNS:
        analysis = result.get("analysis") or _keyword_triage(history)
        return {
            "status": "finalized",
            "reply": "Thank you. Help is being dispatched right now.",
            "analysis": analysis,
        }

    if result["action"] == "file":
        analysis = result.get("analysis") or _keyword_triage(history)
        analysis["departments"] = _enforce_department_rules(
            analysis,
            " ".join(t.get("text", "") for t in history if t.get("role") == "user"),
        )
        analysis = _normalize_confidence(analysis)
        return {"status": "finalized", "reply": result.get("reply") or "Help is being dispatched.", "analysis": analysis}

    return {"status": "ask", "reply": result.get("reply") or "Could you tell me more?"}


async def _mock_converse(history: list, language: str) -> dict:
    """Scripted flow for local development without any API calls."""
    user_turns = sum(1 for t in history if t.get("role") == "user")
    scripted = _scripted_reply(history)
    if scripted and user_turns <= len(_FALLBACK_QUESTIONS):
        return {"status": "ask", "reply": scripted}
    return {
        "status": "finalized",
        "reply": "Thank you. Help is being dispatched right now.",
        "analysis": _keyword_triage(history),
    }
