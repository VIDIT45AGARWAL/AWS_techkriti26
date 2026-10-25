"""
Amazon Transcribe integration for speech-to-text conversion.
Supports real-time streaming transcription and batch processing.
Works with multiple Indian languages.
"""
import os
import json
import asyncio
import struct
import hashlib
import hmac
import datetime
import urllib.parse
import base64
from typing import AsyncGenerator

import boto3

# Set USE_MOCK=true for local development without AWS credentials (demo mode OFF by default)
USE_MOCK = os.getenv("USE_MOCK", "false").lower() == "true"


async def transcribe_audio(audio_bytes: bytes, language_code: str = "en-IN") -> str:
    """
    Convert speech audio to text using Amazon Transcribe (batch mode).

    Args:
        audio_bytes: Raw audio bytes (WAV/WebM/OGG)
        language_code: BCP-47 language code (e.g., en-IN, hi-IN, ta-IN)

    Returns:
        Transcribed text string
    """
    if USE_MOCK:
        return await _mock_transcribe(language_code)

    import uuid
    import time

    s3_client = boto3.client("s3", region_name=os.getenv("AWS_REGION", "ap-south-1"))
    transcribe_client = boto3.client(
        "transcribe", region_name=os.getenv("AWS_REGION", "ap-south-1")
    )

    bucket = os.getenv("S3_BUCKET", "civic-alert-audio")
    job_name = f"civic-alert-{uuid.uuid4().hex[:12]}"
    s3_key = f"audio/{job_name}.webm"

    # Upload audio to S3
    s3_client.put_object(Bucket=bucket, Key=s3_key, Body=audio_bytes)

    # Start transcription job
    transcribe_client.start_transcription_job(
        TranscriptionJobName=job_name,
        LanguageCode=language_code,
        MediaFormat="webm",
        Media={"MediaFileUri": f"s3://{bucket}/{s3_key}"},
        OutputBucketName=bucket,
        OutputKey=f"transcripts/{job_name}.json",
    )

    # Poll for completion (max 60 seconds)
    for _ in range(60):
        status = transcribe_client.get_transcription_job(
            TranscriptionJobName=job_name
        )
        job_status = status["TranscriptionJob"]["TranscriptionJobStatus"]

        if job_status == "COMPLETED":
            # Fetch transcript from S3
            result_obj = s3_client.get_object(
                Bucket=bucket, Key=f"transcripts/{job_name}.json"
            )
            result = json.loads(result_obj["Body"].read())
            transcript = result["results"]["transcripts"][0]["transcript"]

            # Cleanup
            s3_client.delete_object(Bucket=bucket, Key=s3_key)
            s3_client.delete_object(
                Bucket=bucket, Key=f"transcripts/{job_name}.json"
            )
            transcribe_client.delete_transcription_job(
                TranscriptionJobName=job_name
            )

            return transcript
        elif job_status == "FAILED":
            reason = status["TranscriptionJob"].get("FailureReason", "Unknown")
            raise RuntimeError(f"Transcription failed: {reason}")

        await asyncio.sleep(1)

    raise TimeoutError("Transcription job timed out after 60 seconds")


async def transcribe_audio_streaming(
    audio_chunks: AsyncGenerator[bytes, None],
    language_code: str = "en-IN",
    sample_rate: int = 12000,
) -> AsyncGenerator[str, None]:
    """
    Real-time streaming transcription using Amazon Transcribe Streaming.
    Uses the amazon-transcribe library for proper event streaming.

    Args:
        audio_chunks: Async generator yielding audio bytes (PCM 16-bit)
        language_code: BCP-47 language code
        sample_rate: Audio sample rate in Hz

    Yields:
        Partial and final transcription text strings
    """
    if USE_MOCK:
        async for text in _mock_streaming_transcribe(language_code):
            yield text
        return

    from amazon_transcribe.client import TranscribeStreamingClient
    from amazon_transcribe.handlers import TranscriptResultStreamHandler
    from amazon_transcribe.model import TranscriptEvent

    region = os.getenv("AWS_REGION", "ap-south-1")
    client = TranscribeStreamingClient(region=region)

    stream = await client.start_stream_transcription(
        language_code=language_code,
        media_sample_rate_hz=sample_rate,
        media_encoding="pcm",
    )

    transcript_queue = asyncio.Queue()

    accumulated_text = ""
    
    class EventHandler(TranscriptResultStreamHandler):
        async def handle_transcript_event(self, transcript_event: TranscriptEvent):
            nonlocal accumulated_text
            results = transcript_event.transcript.results
            for result in results:
                for alt in result.alternatives:
                    if alt.transcript:
                        if not result.is_partial:
                            accumulated_text += (" " if accumulated_text else "") + alt.transcript
                            await transcript_queue.put(
                                {
                                    "text": accumulated_text,
                                    "is_partial": False,
                                }
                            )
                        else:
                            temp_text = accumulated_text + (" " if accumulated_text else "") + alt.transcript
                            await transcript_queue.put(
                                {
                                    "text": temp_text,
                                    "is_partial": True,
                                }
                            )

    handler = EventHandler(stream.output_stream)

    # Send audio in background
    async def send_audio():
        try:
            async for chunk in audio_chunks:
                await stream.input_stream.send_audio_event(audio_chunk=chunk)
            await stream.input_stream.end_stream()
        except Exception as e:
            print(f"Error sending audio: {e}")
            await transcript_queue.put(None)

    # Start sending and handling concurrently
    send_task = asyncio.create_task(send_audio())
    handler_task = asyncio.create_task(handler.handle_events())

    try:
        while True:
            try:
                item = await asyncio.wait_for(transcript_queue.get(), timeout=0.5)
                if item is None:
                    break
                yield json.dumps(item)
            except asyncio.TimeoutError:
                if send_task.done() and handler_task.done():
                    break
    finally:
        send_task.cancel()
        handler_task.cancel()


async def _mock_streaming_transcribe(language_code: str) -> AsyncGenerator[str, None]:
    """Mock streaming transcription for development."""
    mock_transcripts = {
        "en-IN": "There is a large fire in a building near sector 15 Kanpur. "
                 "People are trapped on the third floor. I can see heavy smoke. "
                 "Two people are injured with burn wounds. Please send help immediately.",
        "hi-IN": "सेक्टर 15 कानपुर में एक बड़ी इमारत में आग लगी है। "
                 "तीसरी मंज़िल पर लोग फंसे हैं। भारी धुआं दिख रहा है। "
                 "दो लोग जले हुए हैं। कृपया तुरंत मदद भेजें।",
        "ta-IN": "கான்பூர் செக்டர் 15 அருகில் ஒரு கட்டிடத்தில் பெரிய தீ விபத்து. "
                 "மூன்றாவது மாடியில் மக்கள் சிக்கியுள்ளனர்.",
        "te-IN": "కాన్పూర్ సెక్టార్ 15 లో ఒక భవనంలో పెద్ద అగ్నిప్రమాదం జరిగింది. "
                 "మూడో అంతస్తులో వ్యక్తులు చిక్కుకున్నారు.",
    }

    text = mock_transcripts.get(language_code, mock_transcripts["en-IN"])
    words = text.split(" ")
    accumulated = ""

    for i, word in enumerate(words):
        accumulated += (" " if i > 0 else "") + word
        # Simulate partial results
        yield json.dumps({"text": accumulated, "is_partial": True})
        await asyncio.sleep(0.15 + 0.05 * (hash(word) % 3))

    # Final result
    yield json.dumps({"text": accumulated, "is_partial": False})


async def _mock_transcribe(language_code: str) -> str:
    """Return mock transcription for development (batch mode)."""
    await asyncio.sleep(0.5)

    mock_transcripts = {
        "en-IN": "There is a large fire in a building near sector 15 Kanpur. "
                 "People are trapped on the third floor. I can see heavy smoke. "
                 "Two people are injured with burn wounds. Please send help immediately.",
        "hi-IN": "सेक्टर 15 कानपुर में एक बड़ी इमारत में आग लगी है। "
                 "तीसरी मंज़िल पर लोग फंसे हैं। भारी धुआं दिख रहा है। "
                 "दो लोग जले हुए हैं। कृपया तुरंत मदद भेजें।",
        "ta-IN": "கான்பூர் செக்டர் 15 அருகில் ஒரு கட்டிடத்தில் பெரிய தீ விபத்து. "
                 "மூன்றாவது மாடியில் மக்கள் சிக்கியுள்ளனர்.",
        "te-IN": "కాన్పూర్ సెక్టార్ 15 లో ఒక భవనంలో పెద్ద అగ్నిప్రమాదం జరిగింది. "
                 "మూడో అంతస్తులో వ్యక్తులు చిక్కుకున్నారు.",
    }

    return mock_transcripts.get(language_code, mock_transcripts["en-IN"])
