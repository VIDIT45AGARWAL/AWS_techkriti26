"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Mic,
  MicOff,
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
  Volume2,
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

type Phase = "idle" | "recording" | "thinking" | "done";

interface Message {
  role: "user" | "assistant";
  text: string;
  audio?: string | null;
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
  const [messages, setMessages] = useState<Message[]>([]);
  const [transcript, setTranscript] = useState(""); // live partial during recording
  const [result, setResult] = useState<Incident | null>(null);
  const [audioLevel, setAudioLevel] = useState<number[]>(Array(30).fill(4));
  const [error, setError] = useState<string | null>(null);
  const [playingIdx, setPlayingIdx] = useState<number | null>(null);

  const animFrameRef = useRef<number | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const transcriptRef = useRef("");
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  // Scroll the chat to the latest message
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, transcript, phase]);

  const updateAudioLevels = useCallback(() => {
    if (analyserRef.current) {
      const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
      analyserRef.current.getByteFrequencyData(dataArray);
      const levels = Array.from({ length: 30 }, (_, i) => {
        const idx = Math.floor((i / 30) * dataArray.length);
        return Math.max(4, (dataArray[idx] / 255) * 50);
      });
      setAudioLevel(levels);
    }
    animFrameRef.current = requestAnimationFrame(updateAudioLevels);
  }, []);

  // Play a message's Bulbul v4 audio (auto-play on arrival, tap to replay)
  const playAudio = useCallback((audio: string | null | undefined, idx: number) => {
    if (!audio) return;
    const el = audioElRef.current ?? new Audio();
    audioElRef.current = el;
    el.onplay = () => setPlayingIdx(idx);
    el.onended = () => setPlayingIdx(null);
    el.onpause = () => setPlayingIdx(null);
    el.onerror = () => setPlayingIdx(null);
    el.src = audio;
    el.play().catch(() => setPlayingIdx(null));
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

  const startRecording = async () => {
    if (phase === "thinking") return;
    if (phase === "done") {
      resetReport();
      return;
    }

    setPhase("recording");
    setTranscript("");
    transcriptRef.current = "";
    setError(null);

    // Get microphone access
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { sampleRate: 16000, channelCount: 1 },
      });
      streamRef.current = stream;

      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      // 16 kHz matches Sarvam Saaras' recommended sample rate for PCM input
      const audioCtx = new AudioContextClass({ sampleRate: 16000 });
      audioCtxRef.current = audioCtx;
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 128;
      source.connect(analyser);
      analyserRef.current = analyser;
    } catch (err: any) {
      // Mic access denied or Audio API error
      setPhase("idle");
      setError("Microphone access is required for voice reporting.");
      return;
    }

    updateAudioLevels();

    // Connect WebSocket for real-time transcription (Sarvam Saaras v4)
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
            setTranscript(data.text);
          }
        } catch {
          // Ignore malformed messages
        }
      };

      ws.onerror = () => {
        console.warn("WebSocket connection failed — live transcription unavailable");
      };

      // Stream raw PCM audio
      const processor = audioCtxRef.current!.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      processor.onaudioprocess = (e) => {
        if (ws.readyState === WebSocket.OPEN) {
          const inputData = e.inputBuffer.getChannelData(0);
          const pcm16 = new Int16Array(inputData.length);
          for (let i = 0; i < inputData.length; i++) {
            const s = Math.max(-1, Math.min(1, inputData[i]));
            pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
          }
          ws.send(pcm16.buffer);
        }
      };

      analyserRef.current!.connect(processor);
      processor.connect(audioCtxRef.current!.destination);
    } catch (err: any) {
      console.error("WebSocket setup error:", err);
      setError("Voice connection failed. Please try again.");
      setPhase("idle");
    }
  };

  const stopRecording = async () => {
    // Stop audio capture
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
    }
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      const ws = wsRef.current;
      ws.send(JSON.stringify({ type: "stop" }));
      // Wait for Sarvam's final transcript
      await waitForTranscriptDone(ws, 45000);
      try {
        ws.close();
      } catch {
        // Already closed
      }
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close();
    }

    setAudioLevel(Array(30).fill(4));

    const finalTranscript = transcriptRef.current.trim();
    setTranscript("");

    if (!finalTranscript) {
      setPhase("idle");
      setError("No speech detected. Tap the mic and try again.");
      return;
    }

    // Add the caller's message to the chat
    const userMsg: Message = { role: "user", text: finalTranscript };
    const history = [...messages, userMsg];
    setMessages(history);
    setPhase("thinking");
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/api/converse`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcript: finalTranscript,
          language: language.code,
          history: messages.map((m) => ({ role: m.role, text: m.text })),
        }),
      });

      if (!response.ok) {
        throw new Error(`API returned ${response.status}`);
      }

      const data = await response.json();
      const assistantMsg: Message = {
        role: "assistant",
        text: data.reply,
        audio: data.audio,
      };
      const updated = [...history, assistantMsg];
      setMessages(updated);

      // Speak the dispatcher's reply (Sarvam Bulbul v4 Flash)
      playAudio(data.audio, updated.length - 1);

      if (data.status === "finalized" && data.incident) {
        const inc: Incident = data.incident;
        setResult(inc);
        setPhase("done");
      } else {
        setPhase("idle"); // ready for the caller's next utterance
      }
    } catch (err) {
      console.warn("Converse API unavailable:", err);
      setPhase("idle");
      setError(
        "Could not reach the emergency dispatcher. Please try again."
      );
    }
  };

  useEffect(() => {
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (processorRef.current) {
        processorRef.current.disconnect();
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.close();
      }
      if (audioCtxRef.current) {
        audioCtxRef.current.close();
      }
      if (audioElRef.current) {
        audioElRef.current.pause();
      }
    };
  }, []);

  const resetReport = () => {
    if (audioElRef.current) audioElRef.current.pause();
    setMessages([]);
    setTranscript("");
    transcriptRef.current = "";
    setResult(null);
    setError(null);
    setPhase("idle");
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
            Talk to our AI dispatcher like a phone call. It will ask what
            happened, where, and who needs help — then dispatch the right
            force.
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
          {/* Conversation */}
          <div className={styles.chatContainer}>
            {messages.length === 0 && !transcript && phase === "idle" && (
              <div className={styles.chatIntro}>
                <Bot size={32} />
                <p>Tap the microphone and describe the emergency in your own words.</p>
              </div>
            )}

            <AnimatePresence>
              {messages.map((msg, i) => (
                <motion.div
                  key={i}
                  className={`${styles.bubble} ${msg.role === "user" ? styles.bubbleUser : styles.bubbleAssistant}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25 }}
                >
                  <div className={styles.bubbleMeta}>
                    {msg.role === "assistant" ? (
                      <Bot size={14} />
                    ) : (
                      <Mic size={14} />
                    )}
                    <span>{msg.role === "assistant" ? "Dispatcher" : "You"}</span>
                    {msg.role === "assistant" && msg.audio && (
                      <button
                        className={styles.speakerBtn}
                        onClick={() => playAudio(msg.audio, i)}
                        title="Replay (Sarvam Bulbul v4)"
                        aria-label="Replay audio"
                      >
                        <Volume2 size={14} className={playingIdx === i ? styles.spinning : undefined} />
                      </button>
                    )}
                  </div>
                  <p className={styles.bubbleText}>{msg.text}</p>
                </motion.div>
              ))}
            </AnimatePresence>

            {/* Live transcript while recording */}
            <AnimatePresence>
              {phase === "recording" && (
                <motion.div
                  className={`${styles.bubble} ${styles.bubbleUser}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                >
                  <div className={styles.bubbleMeta}>
                    <Mic size={14} />
                    <span>You</span>
                    <span className={styles.liveBadge}>listening</span>
                  </div>
                  <p className={styles.bubbleText}>
                    {transcript || "…"}
                    <span className={styles.cursor}>|</span>
                  </p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Thinking indicator */}
            <AnimatePresence>
              {phase === "thinking" && (
                <motion.div
                  className={`${styles.bubble} ${styles.bubbleAssistant}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                >
                  <div className={styles.bubbleMeta}>
                    <Bot size={14} />
                    <span>Dispatcher is thinking</span>
                  </div>
                  <div className={styles.thinkingDots}>
                    <span />
                    <span />
                    <span />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div ref={chatEndRef} />
          </div>

          {/* Waveform */}
          <AnimatePresence>
            {phase === "recording" && (
              <motion.div
                className={styles.waveform}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                {audioLevel.map((h, i) => (
                  <motion.div
                    key={i}
                    className={styles.waveBar}
                    animate={{ height: `${h}px` }}
                    transition={{ duration: 0.1 }}
                  />
                ))}
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

          {/* Microphone Button */}
          <motion.div
            className={styles.micContainer}
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3, type: "spring", stiffness: 200, damping: 15 }}
          >
            <motion.button
              className={`${styles.micButton} ${phase === "recording" ? styles.recording : ""}`}
              onClick={
                phase === "idle"
                  ? startRecording
                  : phase === "recording"
                    ? stopRecording
                    : phase === "done"
                      ? resetReport
                      : undefined
              }
              disabled={phase === "thinking"}
              whileTap={{ scale: 0.9 }}
              whileHover={phase !== "thinking" ? { scale: 1.08, boxShadow: "0 0 60px var(--accent-red-glow)" } : undefined}
              transition={{ type: "spring", stiffness: 300 }}
            >
              {phase === "recording" && (
                <>
                  <span className={styles.micRing1} />
                  <span className={styles.micRing2} />
                  <span className={styles.micRing3} />
                </>
              )}
              {phase === "thinking" ? (
                <Loader2 size={36} className={styles.spinning} />
              ) : phase === "done" ? (
                <motion.div
                  initial={{ scale: 0, rotate: -180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: "spring", stiffness: 200 }}
                >
                  <CheckCircle2 size={36} />
                </motion.div>
              ) : phase === "recording" ? (
                <motion.div
                  animate={{ scale: [1, 1.15, 1] }}
                  transition={{ repeat: Infinity, duration: 1 }}
                >
                  <MicOff size={36} />
                </motion.div>
              ) : (
                <Mic size={36} />
              )}
            </motion.button>

            <p className={styles.micLabel}>
              {phase === "idle" &&
                (messages.length === 0
                  ? "Tap to start the call"
                  : "Tap to speak your answer")}
              {phase === "recording" && "Listening... Tap to send"}
              {phase === "thinking" && "Dispatcher is responding..."}
              {phase === "done" && "Report dispatched! Tap to start a new call"}
            </p>
          </motion.div>

          {/* Result */}
          <AnimatePresence>
            {phase === "done" && result && (
              <motion.div
                className={styles.resultArea}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
              >
                {/* Success Banner */}
                <div className={styles.successBanner}>
                  <CheckCircle2 size={20} />
                  <span>
                    Alert dispatched to {result.departments.length} departments
                  </span>
                  {messages.filter((m) => m.audio).length > 0 && (
                    <button
                      className={styles.replayButton}
                      onClick={() => {
                        const lastAudio = [...messages].reverse().find((m) => m.audio);
                        if (lastAudio) playAudio(lastAudio.audio, -1);
                      }}
                      title="Replay spoken summary (Sarvam Bulbul v4)"
                      aria-label="Replay spoken summary"
                    >
                      <Volume2 size={16} />
                    </button>
                  )}
                </div>

                {/* Result Cards Grid */}
                <div className={styles.resultGrid}>
                  {/* Incident Summary */}
                  <motion.div className={`glass-card ${styles.resultCard}`}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1, duration: 0.4 }}
                  >
                    <h3 className={styles.resultCardTitle}>
                      <AlertTriangle
                        size={18}
                        style={{ color: "var(--accent-amber)" }}
                      />
                      Incident Classification
                    </h3>
                    <div className={styles.resultFields}>
                      <div className={styles.field}>
                        <span className={styles.fieldLabel}>Type</span>
                        <span className={styles.fieldValue}>
                          {result.type}
                        </span>
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
                      <MapPin
                        size={18}
                        style={{ color: "var(--accent-green)" }}
                      />
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
                      <Users
                        size={18}
                        style={{ color: "var(--accent-red)" }}
                      />
                      Casualties
                    </h3>
                    <p className={styles.casualtyText}>{result.casualties}</p>
                  </motion.div>

                  {/* Departments */}
                  <div className={`glass-card ${styles.resultCard} ${styles.deptCard}`}>
                    <h3 className={styles.resultCardTitle}>
                      <Send
                        size={18}
                        style={{ color: "var(--accent-blue)" }}
                      />
                      Departments Notified
                    </h3>
                    <div className={styles.deptList}>
                      {result.departments.map((dept, i) => {
                        const Icon =
                          departmentIcons[dept] || Shield;
                        const color =
                          departmentColors[dept] || "var(--accent-blue)";
                        return (
                          <motion.div
                            key={i}
                            className={styles.deptItem}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.3 + i * 0.15 }}
                          >
                            <div
                              className={styles.deptIcon}
                              style={{ background: `${color}20`, color }}
                            >
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
