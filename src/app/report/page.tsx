"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Mic,
  Languages,
  MapPin,
  AlertTriangle,
  Users,
  Shield,
  Flame,
  Heart,
  CloudLightning,
  CheckCircle2,
  Loader2,
  ChevronDown,
  Send,
  PhoneOff,
  Ear,
  Bot,
} from "lucide-react";
import styles from "./report.module.css";

const languages = [
  { code: "en-IN", label: "English", flag: "🇬🇧" },
  { code: "hi-IN", label: "हिन्दी", flag: "🇮🇳" },
  { code: "ta-IN", label: "தமிழ்", flag: "🇮🇳" },
  { code: "te-IN", label: "తెలుగు", flag: "🇮🇳" },
  { code: "bn-IN", label: "বাংলা", flag: "🇮🇳" },
  { code: "mr-IN", label: "मराठी", flag: "🇮🇳" },
];

/*
 * Pure conversational agent — a voice call, not a chat.
 *
 *   tap to call → agent listens (Sarvam Saaras v4 streams the transcript)
 *   → you stop speaking (auto-detected silence or tap) → agent thinks
 *   → agent speaks its reply aloud (Sarvam Bulbul v4) with a live caption
 *   → agent automatically resumes listening for your next utterance
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

const departmentIcons: Record<string, React.ElementType> = {
  Police: Shield,
  "Fire Department": Flame,
  "Medical Emergency": Heart,
  "Disaster Response": CloudLightning,
};

const departmentColors: Record<string, string> = {
  Police: "var(--accent-blue)",
  "Fire Department": "var(--accent-red)",
  "Medical Emergency": "var(--accent-green)",
  "Disaster Response": "var(--accent-amber)",
};

export default function ReportPage() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [language, setLanguage] = useState(languages[0]);
  const [langOpen, setLangOpen] = useState(false);
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
    []
  );

  // ─── Listening: mic → Sarvam Saaras v4 ───

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
          })
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
        })
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
        vadHasVoiceRef.current &&
        now - vadSpeechStartRef.current! >= VAD_MIN_SPEECH_MS;
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        window.AudioContext || (window as any).webkitAudioContext;
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
    if (!phaseRef.current || phaseRef.current === "done") {
      setPhaseBoth("idle");
    } else {
      setPhaseBoth("idle");
    }
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
        return "Tap to call the emergency dispatcher";
      case "listening":
        return liveTranscript ? "Listening…" : "Listening… speak now";
      case "thinking":
        return "Dispatcher is thinking…";
      case "speaking":
        return "Dispatcher is speaking…";
      case "done":
        return "Report dispatched. Tap to start a new call";
    }
  })();

  const resetReport = () => {
    historyRef.current = [];
    setResult(null);
    setError(null);
    setPhaseBoth("idle");
  };

  return (
    <div className={styles.page}>
      <div className={styles.bgGlow} />

      <div className={`container ${styles.content}`}>
        {/* Header */}
        <motion.div
          className={styles.header}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h1 className={styles.title}>Report Emergency</h1>
          <p className={styles.subtitle}>
            A live voice call with our AI dispatcher. Just speak naturally —
            it will ask what happened, where, and who needs help, then
            dispatch the right force.
          </p>
        </motion.div>

        {/* Language Selector */}
        <motion.div
          className={styles.langSelector}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          <button
            className={styles.langButton}
            onClick={() => setLangOpen(!langOpen)}
          >
            <Languages size={16} />
            <span>
              {language.flag} {language.label}
            </span>
            <ChevronDown
              size={14}
              style={{
                transform: langOpen ? "rotate(180deg)" : "none",
                transition: "0.2s",
              }}
            />
          </button>
          <AnimatePresence>
            {langOpen && (
              <motion.div
                className={styles.langDropdown}
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
              >
                {languages.map((lang) => (
                  <button
                    key={lang.code}
                    className={`${styles.langOption} ${language.code === lang.code ? styles.langActive : ""}`}
                    onClick={() => {
                      setLanguage(lang);
                      setLangOpen(false);
                    }}
                  >
                    <span>{lang.flag}</span>
                    <span>{lang.label}</span>
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Main Area */}
        <div className={styles.mainArea}>
          {/* The Agent Orb */}
          <motion.div
            className={styles.micContainer}
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3, type: "spring", stiffness: 200, damping: 15 }}
          >
            <motion.button
              className={`${styles.micButton} ${phase === "listening" ? styles.recording : ""} ${phase === "speaking" ? styles.agentSpeaking : ""}`}
              onClick={() => {
                if (phase === "idle") startCall();
                else if (phase === "listening") endUtterance(); // manual send
                else if (phase === "done") resetReport();
              }}
              whileTap={{ scale: 0.9 }}
              whileHover={{ scale: 1.08, boxShadow: "0 0 60px var(--accent-red-glow)" }}
              transition={{ type: "spring", stiffness: 300 }}
              aria-label={statusLabel || undefined}
            >
              {(phase === "listening" || phase === "thinking" || phase === "speaking") && (
                <>
                  <span className={styles.micRing1} />
                  <span className={styles.micRing2} />
                  <span className={styles.micRing3} />
                </>
              )}
              {phase === "idle" ? (
                <Mic size={36} />
              ) : phase === "done" ? (
                <motion.div
                  initial={{ scale: 0, rotate: -180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: "spring", stiffness: 200 }}
                >
                  <CheckCircle2 size={36} />
                </motion.div>
              ) : phase === "listening" ? (
                <motion.div
                  animate={{ scale: [1, 1.15, 1] }}
                  transition={{ repeat: Infinity, duration: 1 }}
                >
                  <Ear size={36} />
                </motion.div>
              ) : phase === "speaking" ? (
                <motion.div
                  animate={{ scale: [1, 1.12, 1] }}
                  transition={{ repeat: Infinity, duration: 0.8 }}
                >
                  <Bot size={36} />
                </motion.div>
              ) : (
                <Loader2 size={36} className={styles.spinning} />
              )}
            </motion.button>

            <p className={styles.micLabel}>{statusLabel}</p>

            {/* End call button */}
            <AnimatePresence>
              {inCall && (
                <motion.button
                  className={styles.endCallBtn}
                  onClick={endCall}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                >
                  <PhoneOff size={14} />
                  <span>End call</span>
                </motion.button>
              )}
            </AnimatePresence>
          </motion.div>

          {/* Voice waveform (listening + speaking) */}
          <AnimatePresence>
            {(phase === "listening" || phase === "speaking") && (
              <motion.div
                className={styles.waveform}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                {audioLevel.map((h, i) => (
                  <motion.div
                    key={i}
                    className={`${styles.waveBar} ${phase === "speaking" ? styles.waveSpeaking : ""}`}
                    animate={{
                      height:
                        phase === "speaking"
                          ? `${12 + Math.random() * 26}px`
                          : `${h}px`,
                    }}
                    transition={{ duration: 0.12 }}
                  />
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Caption — the single live line of conversation */}
          <AnimatePresence mode="wait">
            {(phase === "listening" || phase === "speaking") && (
              <motion.div
                key={phase === "listening" ? "listen" : "speak"}
                className={`glass-card ${styles.captionCard}`}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
              >
                <div className={styles.captionHeader}>
                  {phase === "listening" ? (
                    <>
                      <Mic size={14} />
                      <span>You — live transcript</span>
                    </>
                  ) : (
                    <>
                      <Bot size={14} />
                      <span>Dispatcher — speaking</span>
                    </>
                  )}
                </div>
                <p className={styles.captionText}>
                  {phase === "listening"
                    ? liveTranscript || "…"
                    : dispatcherCaption}
                  {(phase === "listening" || phase === "speaking") && (
                    <span className={styles.cursor}>|</span>
                  )}
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Error Banner */}
          <AnimatePresence>
            {error && (
              <motion.div
                className={`glass-card ${styles.errorBanner}`}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
              >
                <AlertTriangle size={20} />
                <span>{error}</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Result */}
          <AnimatePresence>
            {phase === "done" && result && (
              <motion.div
                className={styles.resultArea}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
              >
                <div className={styles.successBanner}>
                  <CheckCircle2 size={20} />
                  <span>
                    Alert dispatched to {result.departments.length} departments
                  </span>
                </div>

                <div className={styles.resultGrid}>
                  {/* Incident Summary */}
                  <motion.div className={`glass-card ${styles.resultCard}`}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1, duration: 0.4 }}
                  >
                    <h3 className={styles.resultCardTitle}>
                      <AlertTriangle size={18} style={{ color: "var(--accent-amber)" }} />
                      Incident Classification
                    </h3>
                    <div className={styles.resultFields}>
                      <div className={styles.field}>
                        <span className={styles.fieldLabel}>Type</span>
                        <span className={styles.fieldValue}>{result.type}</span>
                      </div>
                      <div className={styles.field}>
                        <span className={styles.fieldLabel}>Severity</span>
                        <motion.span
                          className={`badge badge-critical`}
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ delay: 0.4, type: "spring" }}
                        >
                          {result.severity}
                        </motion.span>
                      </div>
                      <div className={styles.field}>
                        <span className={styles.fieldLabel}>Confidence</span>
                        <div className={styles.confidenceBar}>
                          <motion.div
                            className={styles.confidenceFill}
                            initial={{ width: 0 }}
                            animate={{ width: `${result.confidence}%` }}
                            transition={{ delay: 0.5, duration: 1.2, ease: "easeOut" }}
                          />
                          <span>{result.confidence}%</span>
                        </div>
                      </div>
                    </div>
                  </motion.div>

                  {/* Location */}
                  <motion.div className={`glass-card ${styles.resultCard}`}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2, duration: 0.4 }}
                  >
                    <h3 className={styles.resultCardTitle}>
                      <MapPin size={18} style={{ color: "var(--accent-green)" }} />
                      Location Reported
                    </h3>
                    <p className={styles.locationText}>{result.location}</p>
                  </motion.div>

                  {/* Casualties */}
                  <motion.div className={`glass-card ${styles.resultCard}`}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3, duration: 0.4 }}
                  >
                    <h3 className={styles.resultCardTitle}>
                      <Users size={18} style={{ color: "var(--accent-red)" }} />
                      Casualties
                    </h3>
                    <p className={styles.casualtyText}>{result.casualties}</p>
                  </motion.div>

                  {/* Departments */}
                  <div className={`glass-card ${styles.resultCard} ${styles.deptCard}`}>
                    <h3 className={styles.resultCardTitle}>
                      <Send size={18} style={{ color: "var(--accent-blue)" }} />
                      Departments Notified
                    </h3>
                    <div className={styles.deptList}>
                      {result.departments.map((dept, i) => {
                        const Icon = departmentIcons[dept] || Shield;
                        const color = departmentColors[dept] || "var(--accent-blue)";
                        return (
                          <motion.div
                            key={i}
                            className={styles.deptItem}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.3 + i * 0.15 }}
                          >
                            <div className={styles.deptIcon} style={{ background: `${color}20`, color }}>
                              <Icon size={18} />
                            </div>
                            <span>{dept}</span>
                            <CheckCircle2
                              size={16}
                              style={{ color: "var(--accent-green)", marginLeft: "auto" }}
                            />
                          </motion.div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* AI Summary */}
                <div className={`glass-card ${styles.summaryCard}`}>
                  <h3 className={styles.resultCardTitle}>
                    AI-Generated Report Summary
                  </h3>
                  <p className={styles.summaryText}>{result.summary}</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
