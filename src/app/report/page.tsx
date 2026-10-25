"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  AudioLines,
  Check,
  ChevronDown,
  Mic,
  PhoneOff,
  Square,
} from "lucide-react";

import { SiteFooter } from "@/components/site-footer";
import { AGENCIES } from "@/lib/agencyConfig";
import { SEVERITY_LABEL, SEVERITY_TONE, TONE_BG, TONE_TEXT } from "@/lib/tone";

const languages = [
  { code: "en-IN", label: "English" },
  { code: "hi-IN", label: "हिन्दी" },
  { code: "ta-IN", label: "தமிழ்" },
  { code: "te-IN", label: "తెలుగు" },
  { code: "bn-IN", label: "বাংলা" },
  { code: "mr-IN", label: "मराठी" },
];

/*
 * Pure conversational agent — a voice call, not a chat.
 *
 *   press to call → agent listens (Sarvam Saaras streams the transcript)
 *   → silence or press ends the turn → agent thinks
 *   → agent speaks its reply aloud (Sarvam Bulbul) with a live caption
 *   → agent automatically resumes listening for the next utterance
 *   → when it has everything, it files the report and ends the call.
 */
type Phase =
  | "idle" // before the call
  | "listening" // caller is speaking
  | "thinking" // dispatcher is deciding
  | "speaking" // dispatcher's reply is being spoken
  | "done"; // call ended, report dispatched

interface Message {
  role: "user" | "assistant";
  text: string;
}

interface Incident {
  id: string;
  type: string;
  severity: string;
  departments: string[];
  location: string;
  casualties: string;
  summary: string;
  confidence: number;
  conversation: Message[];
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const WS_BASE = API_BASE.replace(/^http/, "ws");

// Voice activity detection
const VAD_THRESHOLD = 0.028; // RMS above this counts as speech
const VAD_SILENCE_MS = 1500; // silence that ends an utterance
const VAD_MIN_SPEECH_MS = 350; // ignore blips shorter than this

const DEPT_TONE = new Map(AGENCIES.map((agency) => [agency.apiName, agency.tone]));

export default function ReportPage() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [language, setLanguage] = useState(languages[0]);
  const [liveTranscript, setLiveTranscript] = useState(""); // caption while listening
  const [dispatcherCaption, setDispatcherCaption] = useState(""); // caption while speaking
  const [result, setResult] = useState<Incident | null>(null);
  const [audioLevel, setAudioLevel] = useState<number[]>(Array(30).fill(4));
  const [error, setError] = useState<string | null>(null);

  const animFrameRef = useRef<number | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const transcriptRef = useRef("");
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const historyRef = useRef<Message[]>([]); // conversation for the API
  const phaseRef = useRef<Phase>("idle");
  const callActiveRef = useRef(false); // call in progress (until finalized/ended)
  const vadSpeechStartRef = useRef<number | null>(null);
  const vadLastVoiceRef = useRef<number>(0);
  const vadHasVoiceRef = useRef(false);
  const endingUtteranceRef = useRef(false);
  const endUtteranceRef = useRef<() => void>(() => {});

  const setPhaseBoth = useCallback((p: Phase) => {
    phaseRef.current = p;
    setPhase(p);
  }, []);

  // While the dispatcher speaks, the bars wander gently with its voice.
  useEffect(() => {
    if (phase !== "speaking") return;
    const interval = setInterval(() => {
      setAudioLevel(Array.from({ length: 30 }, () => 10 + Math.random() * 30));
    }, 110);
    return () => clearInterval(interval);
  }, [phase]);

  // ─── Speech playback (dispatcher voice) ───

  const speakReply = useCallback(
    (audioDataUrl: string | null, onEnded: () => void) => {
      if (!audioDataUrl) {
        onEnded(); // TTS failed — continue silently
        return;
      }
      const el = audioElRef.current ?? new Audio();
      audioElRef.current = el;
      el.onended = () => onEnded();
      el.onerror = () => onEnded();
      el.src = audioDataUrl;
      el.play().catch(() => onEnded());
    },
    [],
  );

  // ─── Listening: mic → Sarvam Saaras ───

  const openTranscriptionSocket = useCallback((): WebSocket | null => {
    try {
      const ws = new WebSocket(`${WS_BASE}/ws/transcribe`);
      wsRef.current = ws;
      ws.onopen = () => {
        ws.send(
          JSON.stringify({
            type: "config",
            language: language.code,
            sampleRate: audioCtxRef.current?.sampleRate || 16000,
          }),
        );
      };
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === "transcript" && data.text) {
            transcriptRef.current = data.text;
            setLiveTranscript(data.text);
          }
        } catch {
          // Ignore malformed messages
        }
      };
      ws.onerror = () => {
        console.warn("Transcription socket error");
      };
      return ws;
    } catch (err) {
      console.error("WebSocket setup error:", err);
      return null;
    }
  }, [language.code]);

  // ─── Voice activity detection loop ───

  const listenLoop = useCallback(() => {
    const analyser = analyserRef.current;
    if (analyser) {
      const buf = new Uint8Array(analyser.fftSize);
      analyser.getByteTimeDomainData(buf);

      // RMS of the signal (128 = silence)
      let sum = 0;
      for (let i = 0; i < buf.length; i++) {
        const v = (buf[i] - 128) / 128;
        sum += v * v;
      }
      const rms = Math.sqrt(sum / buf.length);

      // Waveform visualizer
      const freq = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteFrequencyData(freq);
      setAudioLevel(
        Array.from({ length: 30 }, (_, i) => {
          const idx = Math.floor((i / 30) * freq.length);
          return Math.max(4, (freq[idx] / 255) * 50);
        }),
      );

      const now = performance.now();

      if (rms > VAD_THRESHOLD) {
        if (vadSpeechStartRef.current === null) {
          vadSpeechStartRef.current = now;
        }
        vadLastVoiceRef.current = now;
        vadHasVoiceRef.current = true;
      }

      // Utterance ended: spoke long enough, then went silent
      const spokeEnough =
        vadHasVoiceRef.current && now - vadSpeechStartRef.current! >= VAD_MIN_SPEECH_MS;
      const wentSilent = now - vadLastVoiceRef.current >= VAD_SILENCE_MS;

      if (
        phaseRef.current === "listening" &&
        callActiveRef.current &&
        !endingUtteranceRef.current &&
        spokeEnough &&
        wentSilent
      ) {
        endingUtteranceRef.current = true;
        endUtteranceRef.current(); // auto turn-taking — no tap needed
      }
    }
    animFrameRef.current = requestAnimationFrame(listenLoop);
  }, []);

  // ─── Call lifecycle ───

  const startCall = async () => {
    setError(null);
    setResult(null);
    historyRef.current = [];
    setLiveTranscript("");
    setDispatcherCaption("");
    transcriptRef.current = "";
    callActiveRef.current = true;
    endingUtteranceRef.current = false;

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { sampleRate: 16000, channelCount: 1 },
      });
      streamRef.current = stream;

      const AudioContextClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const audioCtx = new AudioContextClass({ sampleRate: 16000 });
      audioCtxRef.current = audioCtx;
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 1024;
      source.connect(analyser);
      analyserRef.current = analyser;

      const processor = audioCtx.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;
      processor.onaudioprocess = (e) => {
        const ws = wsRef.current;
        // Only stream audio while the agent is listening (no echo of its own voice)
        if (ws && ws.readyState === WebSocket.OPEN && phaseRef.current === "listening") {
          const inputData = e.inputBuffer.getChannelData(0);
          const pcm16 = new Int16Array(inputData.length);
          for (let i = 0; i < inputData.length; i++) {
            const s = Math.max(-1, Math.min(1, inputData[i]));
            pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
          }
          ws.send(pcm16.buffer);
        }
      };
      analyser.connect(processor);
      processor.connect(audioCtx.destination);
    } catch {
      setError("Microphone access is required for the voice call.");
      callActiveRef.current = false;
      return;
    }

    openTranscriptionSocket();
    vadSpeechStartRef.current = null;
    vadHasVoiceRef.current = false;
    vadLastVoiceRef.current = performance.now();
    animFrameRef.current = requestAnimationFrame(listenLoop);
    setPhaseBoth("listening");
  };

  // Finish the caller's utterance: close the socket, wait for the final
  // transcript, then hand the turn to the dispatcher.
  const endUtterance = async () => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "stop" }));
      await waitForTranscriptDone(ws, 45000);
      try {
        ws.close();
      } catch {
        /* already closed */
      }
    }
    wsRef.current = null;

    const finalTranscript = transcriptRef.current.trim();
    setLiveTranscript("");
    transcriptRef.current = "";
    vadSpeechStartRef.current = null;
    vadHasVoiceRef.current = false;
    endingUtteranceRef.current = false;

    if (!finalTranscript) {
      // Nothing said — keep listening (don't end the call over silence)
      if (callActiveRef.current) {
        openTranscriptionSocket();
        setPhaseBoth("listening");
      }
      return;
    }

    historyRef.current.push({ role: "user", text: finalTranscript });
    setPhaseBoth("thinking");

    try {
      const response = await fetch(`${API_BASE}/api/converse`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcript: finalTranscript,
          language: language.code,
          history: historyRef.current
            .slice(0, -1)
            .map((m) => ({ role: m.role, text: m.text })),
        }),
      });
      if (!response.ok) throw new Error(`API returned ${response.status}`);

      const data = await response.json();
      historyRef.current.push({ role: "assistant", text: data.reply });
      setDispatcherCaption(data.reply);
      setPhaseBoth("speaking");

      speakReply(data.audio, () => {
        if (data.status === "finalized" && data.incident) {
          setResult(data.incident);
          callActiveRef.current = false;
          setPhaseBoth("done");
        } else if (callActiveRef.current) {
          // Dispatcher finished speaking — automatically listen again
          setDispatcherCaption("");
          openTranscriptionSocket();
          vadLastVoiceRef.current = performance.now();
          setPhaseBoth("listening");
        }
      });
    } catch (err) {
      console.warn("Converse API unavailable:", err);
      setError("Could not reach the emergency dispatcher. Please try again.");
      endCall();
    }
  };
  endUtteranceRef.current = endUtterance; // keep the ref fresh for the VAD loop

  // Manually end the whole call (discards unless already filed)
  const endCall = useCallback(() => {
    callActiveRef.current = false;
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch {
        /* ignore */
      }
      wsRef.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    if (audioElRef.current) {
      audioElRef.current.pause();
      audioElRef.current = null;
    }
    analyserRef.current = null;
    setPhaseBoth("idle");
    setAudioLevel(Array(30).fill(4));
    setDispatcherCaption("");
    setLiveTranscript("");
  }, [setPhaseBoth]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (processorRef.current) processorRef.current.disconnect();
      if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.close();
      }
      if (audioCtxRef.current) audioCtxRef.current.close();
      if (audioElRef.current) audioElRef.current.pause();
    };
  }, []);

  // Resolves when the server sends {type:"done"} or {type:"error"}, or on timeout.
  const waitForTranscriptDone = (ws: WebSocket, timeoutMs: number) =>
    new Promise<void>((resolve) => {
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        ws.removeEventListener("message", onMsg);
        resolve();
      };
      const onMsg = (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === "done" || data.type === "error") finish();
        } catch {
          // Ignore malformed messages
        }
      };
      ws.addEventListener("message", onMsg);
      setTimeout(finish, timeoutMs);
    });

  const inCall = ["listening", "thinking", "speaking"].includes(phase);

  const statusLabel = (() => {
    switch (phase) {
      case "idle":
        return "Press to call the emergency dispatcher.";
      case "listening":
        return liveTranscript ? "Listening — press to send now." : "Listening — speak now.";
      case "thinking":
        return "Dispatcher is thinking…";
      case "speaking":
        return "Dispatcher is speaking…";
      case "done":
        return "Report dispatched — press to start a new call.";
    }
  })();

  const resetReport = () => {
    historyRef.current = [];
    setResult(null);
    setError(null);
    setPhaseBoth("idle");
  };

  const micState =
    phase === "listening"
      ? "recording"
      : phase === "thinking"
        ? "thinking"
        : phase === "speaking"
          ? "speaking"
          : phase === "done"
            ? "done"
            : "ready";

  const severityTone = result ? (SEVERITY_TONE[result.severity] ?? "info") : "info";

  return (
    <div className="flex w-full flex-1 flex-col">
      <main className="mx-auto flex w-full max-w-[42rem] flex-1 flex-col px-4 pb-20 pt-2 sm:px-6">
        <header className="flex flex-col items-center text-center">
          <h1 className="text-pretty font-display text-[2.4rem] font-normal leading-[1.15] tracking-[-0.03em]">
            File a report
          </h1>
          <p className="mt-3 max-w-[30rem] text-pretty text-[14px] leading-6 text-muted">
            A live call with the dispatcher. Speak naturally — it listens for
            what happened, where, and who needs help, then files and dispatches
            the report.
          </p>
        </header>

        {/* Mic zone */}
        <div className="mt-9 flex flex-col items-center gap-3.5">
          <button
            type="button"
            data-state={micState}
            onClick={
              phase === "idle"
                ? startCall
                : phase === "listening"
                  ? endUtterance // manual send
                  : phase === "done"
                    ? resetReport
                    : undefined
            }
            className="mic-btn size-[6.25rem]"
            aria-label={statusLabel || undefined}
          >
            {inCall ? (
              <>
                <span className="mic-ring" />
                <span className="mic-ring mic-ring-2" />
              </>
            ) : null}

            {phase === "idle" ? (
              <Mic className="size-7" strokeWidth={1.75} />
            ) : phase === "listening" ? (
              <Square className="size-6" strokeWidth={1.75} />
            ) : phase === "thinking" ? (
              <span className="mic-spinner" />
            ) : phase === "speaking" ? (
              <AudioLines className="size-7 animate-pulse" strokeWidth={1.75} />
            ) : (
              <Check className="size-7" strokeWidth={1.75} />
            )}
          </button>

          <p className="text-[13px] text-muted" aria-live="polite">
            {statusLabel}
          </p>

          {inCall ? (
            <button
              type="button"
              onClick={endCall}
              className="inline-flex items-center gap-1.5 text-[12px] text-muted underline decoration-line-strong decoration-1 underline-offset-4 transition-colors hover:text-critical hover:decoration-critical"
            >
              <PhoneOff className="size-3.5" aria-hidden="true" />
              End call
            </button>
          ) : null}

          {error ? (
            <p className="flex items-center gap-2 text-[13px] text-critical">
              <span className="size-[7px] shrink-0 rounded-full bg-critical" />
              {error}
            </p>
          ) : null}
        </div>

        {/* Voice control */}
        <div className="mt-8 flex items-center justify-between">
          <label className="inline-flex h-10 items-center gap-2 rounded-[9px] border border-line bg-panel pl-3 pr-2.5 text-[13px]">
            <span className="text-muted">Voice in</span>
            <select
              aria-label="Speaking language"
              value={language.code}
              onChange={(e) =>
                setLanguage(languages.find((item) => item.code === e.target.value) ?? languages[0])
              }
              disabled={inCall}
              className="cursor-pointer appearance-none bg-transparent pr-1 text-ink outline-none disabled:cursor-default disabled:text-muted"
            >
              {languages.map((item) => (
                <option key={item.code} value={item.code}>
                  {item.label}
                </option>
              ))}
            </select>
            <ChevronDown className="size-3.5 shrink-0 text-muted" aria-hidden="true" />
          </label>

          <p
            className={`inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.08em] text-muted`}
          >
            {inCall ? <span className="live-dot" aria-hidden="true" /> : null}
            {phase === "listening"
              ? "Live call · listening"
              : phase === "thinking"
                ? "Live call · thinking"
                : phase === "speaking"
                  ? "Live call · speaking"
                  : phase === "done"
                    ? "Call filed"
                    : "Ready"}
          </p>
        </div>

        {/* Live waveform */}
        {phase === "listening" || phase === "speaking" ? (
          <div className="mt-6 flex h-12 items-center justify-center gap-[3px]" aria-hidden="true">
            {audioLevel.map((level, i) => (
              <span key={i} className="wave-bar" style={{ height: `${level}px` }} />
            ))}
          </div>
        ) : null}

        {/* Live caption — the single line of conversation */}
        <section aria-label="Live call" className="mt-6">
          {phase === "idle" && !error ? (
            <p className="heard mx-auto max-w-[34rem] text-center text-[15.5px] italic leading-7 text-muted">
              The call appears here while you speak — your words, then its reply.
            </p>
          ) : phase === "listening" ? (
            <div className="grid grid-cols-[5.25rem_minmax(0,1fr)] gap-x-4 border-y border-line py-4">
              <span className="pt-[3px] text-[11px] uppercase tracking-[0.08em] text-muted">
                Caller
              </span>
              <p className="text-pretty text-[14.5px] leading-6 text-ink/90">
                {liveTranscript || <span className="text-muted">…</span>}
                <span aria-hidden="true">|</span>
              </p>
            </div>
          ) : phase === "thinking" ? (
            <div className="grid grid-cols-[5.25rem_minmax(0,1fr)] gap-x-4 border-y border-line py-4">
              <span className="pt-[3px] text-[11px] uppercase tracking-[0.08em] text-muted">
                Dispatcher
              </span>
              <span className="flex items-center gap-1.5" aria-hidden="true">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="size-[5px] animate-pulse rounded-full bg-accent"
                    style={{ animationDelay: `${i * 220}ms` }}
                  />
                ))}
              </span>
            </div>
          ) : phase === "speaking" && dispatcherCaption ? (
            <div className="grid grid-cols-[5.25rem_minmax(0,1fr)] gap-x-4 border-y border-line py-4">
              <span className="pt-[3px] text-[11px] uppercase tracking-[0.08em] text-muted">
                Dispatcher
              </span>
              <p className="heard text-pretty text-[16px] leading-[1.65]">
                {dispatcherCaption}
              </p>
            </div>
          ) : null}
        </section>

        {/* Dispatch result */}
        {phase === "done" && result ? (
          <section aria-label="Dispatch result" className="mt-10">
            <div className="flex items-baseline justify-between gap-4 border-b border-line pb-3">
              <h2 className="font-display text-[1.6rem] font-normal leading-none tracking-[-0.015em]">
                Dispatched
              </h2>
              <p className="text-[11px] uppercase tracking-[0.08em] text-muted">
                {result.departments.length} desks notified
              </p>
            </div>

            <dl className="text-[13.5px]">
              <div className="grid grid-cols-[7.5rem_minmax(0,1fr)] items-baseline gap-x-4 border-b border-line py-3">
                <dt className="text-[11px] uppercase tracking-[0.08em] text-muted">Type</dt>
                <dd>{result.type}</dd>
              </div>
              <div className="grid grid-cols-[7.5rem_minmax(0,1fr)] items-baseline gap-x-4 border-b border-line py-3">
                <dt className="text-[11px] uppercase tracking-[0.08em] text-muted">Severity</dt>
                <dd className={`font-medium ${TONE_TEXT[severityTone]}`}>
                  {SEVERITY_LABEL[result.severity] ?? result.severity}
                  <span className="ml-3 font-normal text-muted tabular-nums">
                    confidence {result.confidence}%
                  </span>
                </dd>
              </div>
              <div className="grid grid-cols-[7.5rem_minmax(0,1fr)] items-baseline gap-x-4 border-b border-line py-3">
                <dt className="text-[11px] uppercase tracking-[0.08em] text-muted">Location</dt>
                <dd>{result.location}</dd>
              </div>
              <div className="grid grid-cols-[7.5rem_minmax(0,1fr)] items-baseline gap-x-4 border-b border-line py-3">
                <dt className="text-[11px] uppercase tracking-[0.08em] text-muted">Casualties</dt>
                <dd>{result.casualties}</dd>
              </div>
              <div className="grid grid-cols-[7.5rem_minmax(0,1fr)] items-baseline gap-x-4 py-3">
                <dt className="text-[11px] uppercase tracking-[0.08em] text-muted">Notified</dt>
                <dd className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                  {result.departments.map((department) => {
                    const tone = DEPT_TONE.get(department) ?? "info";
                    return (
                      <span key={department} className="inline-flex items-center gap-1.5">
                        <span className={`size-[7px] rounded-full ${TONE_BG[tone]}`} />
                        {department}
                      </span>
                    );
                  })}
                </dd>
              </div>
            </dl>

            <p className="heard mt-4 max-w-[64ch] text-pretty text-[16px] leading-7">
              {result.summary}
            </p>
          </section>
        ) : null}
      </main>

      <SiteFooter apiNote="Transcription by Sarvam Saaras. Triage and replies by Amazon Bedrock." />
    </div>
  );
}
