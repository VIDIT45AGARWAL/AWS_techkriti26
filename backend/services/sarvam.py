"""
Sarvam AI voice integration (replaces Amazon Transcribe for STT, adds Bulbul TTS).

- Speech-to-text: Saaras v4 (POST /speech-to-text, multipart, max 30s per call).
  Audio is buffered into segments and re-transcribed in full at stream end so the
  final transcript is accurate. >30s recordings are chunked automatically.
- Text-to-speech: Bulbul v4 Flash (POST /text-to-speech) for spoken dispatch
  summaries. Returns a base64 data URL the frontend can play directly.

Requires SARVAM_API_KEY in the environment. When missing (or USE_MOCK=true)
the module falls back to the mock transcripts used by the legacy AWS service.
"""
import io
import json
import os
import wave
from typing import AsyncGenerator, Optional

import aiohttp

from .transcribe import _mock_streaming_transcribe, _mock_transcribe

SARVAM_BASE = "https://api.sarvam.ai"

# USE_MOCK=true for local development without API calls (demo mode OFF by default)
USE_MOCK = os.getenv("USE_MOCK", "false").lower() == "true"

# ─── Voice models ───
STT_MODEL = "saaras:v4"
STT_MODE = "transcribe"
TTS_MODEL = "bulbul:v4-flash"

# Sarvam REST STT hard limit is 30 seconds per request; stay just under.
MAX_STT_SECONDS = 28
# Live partial transcripts are produced every LIVE_SEGMENT_SECONDS of audio.
LIVE_SEGMENT_SECONDS = 10

# Bulbul v4 Flash personas per language (see Sarvam "Voices" guide).
# Emergency dispatch needs a calm, formal announcer in each language.
V4_SPEAKERS = {
    "en-IN": "ritu_en_medical",
    "hi-IN": "ritu_hi_medical",
    "ta-IN": "gokul_ta_narration",
    "te-IN": "tarun_te_narration",
    "bn-IN": "roopa_bn_conversational",
    "mr-IN": "ritu_mr_narration",
}


def _api_key() -> str:
    return os.getenv("SARVAM_API_KEY", "").strip()


def speaker_for(language_code: str) -> str:
    return V4_SPEAKERS.get(language_code, V4_SPEAKERS["en-IN"])


# ─── Helpers ───

def pcm_to_wav(pcm: bytes, sample_rate: int) -> bytes:
    """Wrap raw PCM16 mono audio in a WAV container (what Sarvam expects)."""
    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(sample_rate)
        w.writeframes(pcm)
    return buf.getvalue()


async def _stt_file(
    session: aiohttp.ClientSession,
    key: str,
    wav_bytes: bytes,
    language_code: str,
) -> str:
    """Transcribe one WAV file (<30s) via Saaras v4. Returns transcript text."""
    form = aiohttp.FormData()
    form.add_field("file", wav_bytes, filename="audio.wav", content_type="audio/wav")
    form.add_field("model", STT_MODEL)
    form.add_field("mode", STT_MODE)
    if language_code and language_code != "auto":
        form.add_field("language_code", language_code)

    async with session.post(
        f"{SARVAM_BASE}/speech-to-text",
        data=form,
        headers={"api-subscription-key": key},
        timeout=aiohttp.ClientTimeout(total=60),
    ) as resp:
        if resp.status != 200:
            body = await resp.text()
            raise RuntimeError(f"Sarvam STT failed ({resp.status}): {body[:300]}")
        data = await resp.json()
        return (data.get("transcript") or "").strip()


async def _stt_pcm(
    session: aiohttp.ClientSession,
    key: str,
    pcm: bytes,
    sample_rate: int,
    language_code: str,
) -> str:
    """
    Transcribe raw PCM16 mono audio of any length by chunking into
    <=MAX_STT_SECONDS WAV segments and concatenating the transcripts.
    """
    if not pcm or len(pcm) < 320:  # <10ms of audio
        return ""

    bytes_per_chunk = MAX_STT_SECONDS * sample_rate * 2
    bytes_per_chunk -= bytes_per_chunk % 2  # keep sample-aligned

    texts = []
    for start in range(0, len(pcm), bytes_per_chunk):
        segment = pcm[start : start + bytes_per_chunk]
        wav = pcm_to_wav(segment, sample_rate)
        text = await _stt_file(session, key, wav, language_code)
        if text:
            texts.append(text)
    return " ".join(texts).strip()


# ─── Speech-to-text (replaces Amazon Transcribe) ───

async def transcribe_audio(audio_bytes: bytes, language_code: str = "en-IN") -> str:
    """
    Convert speech audio to text using Sarvam Saaras v4 (batch mode).

    Args:
        audio_bytes: WAV bytes, or raw PCM16 mono @16kHz
        language_code: BCP-47 language code (e.g., en-IN, hi-IN, ta-IN)

    Returns:
        Transcribed text string
    """
    if USE_MOCK or not _api_key():
        return await _mock_transcribe(language_code)

    key = _api_key()
    if not audio_bytes.startswith(b"RIFF"):
        audio_bytes = pcm_to_wav(audio_bytes, 16000)

    async with aiohttp.ClientSession() as session:
        return await _stt_file(session, key, audio_bytes, language_code)


async def transcribe_audio_streaming(
    audio_chunks: AsyncGenerator[bytes, None],
    language_code: str = "en-IN",
    sample_rate: int = 16000,
) -> AsyncGenerator[str, None]:
    """
    Streaming-style transcription via Sarvam Saaras v4.

    Sarvam's REST endpoint is file-based (no true websocket partials needed for
    this pipeline), so this generator:
      1. Buffers incoming PCM16 chunks and transcribes every
         LIVE_SEGMENT_SECONDS to emit real partial transcripts while recording.
      2. On stream end, re-transcribes the full recording in <=28s chunks for an
         accurate final transcript.

    Args:
        audio_chunks: Async generator yielding audio bytes (PCM 16-bit mono)
        language_code: BCP-47 language code
        sample_rate: Audio sample rate in Hz (16000 recommended)

    Yields:
        JSON strings: {"text": str, "is_partial": bool}
    """
    if USE_MOCK or not _api_key():
        async for text in _mock_streaming_transcribe(language_code):
            yield text
        return

    key = _api_key()
    segment_bytes = LIVE_SEGMENT_SECONDS * sample_rate * 2
    segment_bytes -= segment_bytes % 2

    live = bytearray()   # audio not yet in a live segment
    full = bytearray()   # entire recording, for the final pass
    accumulated = ""

    async with aiohttp.ClientSession() as session:
        async for chunk in audio_chunks:
            if not chunk:
                continue
            live.extend(chunk)
            full.extend(chunk)

            # Flush a full live segment → emit a real partial transcript
            if len(live) >= segment_bytes:
                segment = bytes(live)
                live.clear()
                try:
                    text = await _stt_pcm(session, key, segment, sample_rate, language_code)
                except Exception as e:
                    print(f"[SARVAM STT] live segment failed: {e}")
                    text = ""
                if text:
                    accumulated = f"{accumulated} {text}".strip()
                    yield json.dumps({"text": accumulated, "is_partial": True})

        # Stream ended → accurate final pass over the whole recording
        final_text = ""
        if full:
            try:
                final_text = await _stt_pcm(
                    session, key, bytes(full), sample_rate, language_code
                )
            except Exception as e:
                print(f"[SARVAM STT] final pass failed, using partials: {e}")

        result = final_text or accumulated
        yield json.dumps({"text": result, "is_partial": False})


# ─── Text-to-speech (Bulbul v4 Flash) ───

async def synthesize_speech(text: str, language_code: str = "en-IN") -> Optional[str]:
    """
    Convert text to spoken audio via Sarvam Bulbul v4 Flash.

    Returns:
        A base64 data URL ("data:audio/mpeg;base64,...") ready for <audio>,
        or None when the call fails (missing key, quota, network).
    """
    key = _api_key()
    clean = (text or "").strip()[:2500]  # Bulbul v4 hard limit
    if not clean or not key or USE_MOCK:
        return None

    payload = {
        "text": clean,
        "language_code": language_code if language_code in V4_SPEAKERS else "en-IN",
        "speaker": speaker_for(language_code),
        "model": TTS_MODEL,
        "output_audio_codec": "mp3",
        "pace": 1.0,
    }

    try:
        async with aiohttp.ClientSession() as session:
            async with session.post(
                f"{SARVAM_BASE}/text-to-speech",
                json=payload,
                headers={"api-subscription-key": key},
                timeout=aiohttp.ClientTimeout(total=30),
            ) as resp:
                if resp.status != 200:
                    body = await resp.text()
                    print(f"[SARVAM TTS] failed ({resp.status}): {body[:300]}")
                    return None
                data = await resp.json()
                audios = data.get("audios") or []
                b64 = audios[0] if audios else ""
                if not b64:
                    return None
                if b64.startswith("data:audio"):
                    return b64
                return f"data:audio/mpeg;base64,{b64}"
    except Exception as e:
        print(f"[SARVAM TTS] error: {e}")
        return None
