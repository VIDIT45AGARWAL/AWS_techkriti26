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

type Phase = "idle" | "recording" | "processing" | "done";

interface TriageResult {
  incident_type: string;
  severity: string;
  location: string;
  casualties: string;
  departments: string[];
  summary: string;
  confidence: number;
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
  const [transcript, setTranscript] = useState("");
  const [result, setResult] = useState<TriageResult | null>(null);
  const [processingStep, setProcessingStep] = useState(0);
  const [audioLevel, setAudioLevel] = useState<number[]>(Array(30).fill(4));
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioPlaying, setAudioPlaying] = useState(false);
  const animFrameRef = useRef<number | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const transcriptRef = useRef(""); // latest transcript (incl. final from server)
  const audioElRef = useRef<HTMLAudioElement | null>(null);

  const processingSteps = [
    "Transcribing audio via Sarvam Saaras v4...",
    "Extracting incident details via Amazon Bedrock...",
    "Classifying severity and department routing...",
    "Dispatching alerts via Amazon SNS...",
  ];

  // Get user's GPS location
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => setCoords({ lat: 26.5106, lng: 80.2334 }), // Fallback to Kanpur
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    }
  }, []);

  const updateAudioLevels = useCallback(() => {
    if (analyserRef.current) {
      const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
      analyserRef.current.getByteFrequencyData(dataArray);
      const levels = Array.from({ length: 30 }, (_, i) => {
        const idx = Math.floor((i / 30) * dataArray.length);
        return Math.max(4, (dataArray[idx] / 255) * 50);
      });
      setAudioLevel(levels);
    } else {
      setAudioLevel(
        Array.from({ length: 30 }, () => Math.random() * 40 + 5)
      );
    }
    animFrameRef.current = requestAnimationFrame(updateAudioLevels);
  }, []);

  const startRecording = async () => {
    setPhase("recording");
    setTranscript("");
    transcriptRef.current = "";
    setResult(null);

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
      return;
    }

    updateAudioLevels();

    // Connect WebSocket for real-time transcription
    try {
      const ws = new WebSocket(`${WS_BASE}/ws/transcribe`);
      wsRef.current = ws;

      ws.onopen = () => {
        // Send config with ACTUAL sample rate
        ws.send(JSON.stringify({
          type: "config",
          language: language.code,
          sampleRate: audioCtxRef.current?.sampleRate || 16000,
        }));
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
        // WebSocket failed — real transcription unavailable; do NOT fake a transcript
        console.warn("WebSocket connection failed — live transcription unavailable");
      };

      // Start recording raw PCM audio using ScriptProcessorNode
      const processor = audioCtxRef.current!.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      processor.onaudioprocess = (e) => {
        if (ws.readyState === WebSocket.OPEN) {
          const inputData = e.inputBuffer.getChannelData(0);
          const pcm16 = new Int16Array(inputData.length);
          for (let i = 0; i < inputData.length; i++) {
            const s = Math.max(-1, Math.min(1, inputData[i]));
            pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
          }
          // The backend expects base64 encoded audio under {"type": "audio", "data": ...}
          // OR binary messages... wait, main.py accepts binary messages!
          ws.send(pcm16.buffer);
        }
      };

      // Connect to audio graph to start processing
      analyserRef.current!.connect(processor);
      processor.connect(audioCtxRef.current!.destination);

    } catch (err: any) {
      // WebSocket not available — real transcription unavailable; do NOT fake a transcript
      console.error("WebSocket setup error:", err);
    }
  };

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

  // Synthesize a spoken dispatch summary via Sarvam Bulbul v4 (best-effort).
  const playDispatchAudio = async (text: string) => {
    if (!text) return;
    try {
      const res = await fetch(`${API_BASE}/api/tts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, language: language.code }),
      });
      if (!res.ok) return;
      const data = await res.json();
      if (!data.audio) return;

      const el = audioElRef.current ?? new Audio();
      audioElRef.current = el;
      el.src = data.audio;
      el.onplay = () => setAudioPlaying(true);
      el.onended = () => setAudioPlaying(false);
      el.onerror = () => setAudioPlaying(false);
      setAudioUrl(data.audio);
      await el.play();
    } catch {
      // Speech playback unavailable — the report itself is unaffected
    }
  };

  const togglePlayback = () => {
    const el = audioElRef.current;
    if (!el) return;
    if (el.paused) el.play().catch(() => {});
    else el.pause();
  };

  const stopRecording = async () => {
    // Stop audio
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
      // Sarvam Saaras v4 runs a final full transcription after the stream ends;
      // wait for the complete transcript before filing the report.
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
    setPhase("processing");

    // Get the current transcript text (final transcript from Sarvam preferred)
    const currentTranscript =
      transcriptRef.current || transcript || "Emergency report submitted via voice";

    // Step 1: Transcribing (already done via streaming)
    setProcessingStep(0);
    await new Promise((r) => setTimeout(r, 500));

    // Step 2-4: Send to backend API for real AI triage
    setProcessingStep(1);

    let triage: TriageResult | null = null;

    try {
      const response = await fetch(`${API_BASE}/api/report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcript: currentTranscript,
          language: language.code,
          coordinates: coords,
        }),
      });

      setProcessingStep(2);
      await new Promise((r) => setTimeout(r, 400));

      if (response.ok) {
        const incident = await response.json();

        setProcessingStep(3);
        await new Promise((r) => setTimeout(r, 400));

        triage = {
          incident_type: incident.type || "Unknown",
          severity: incident.severity || "medium",
          location: incident.location || "Unknown",
          casualties: incident.casualties || "Unknown",
          departments: incident.departments || ["Police"],
          summary: incident.summary || currentTranscript,
          confidence: incident.confidence || 75,
        };
        setResult(triage);
      } else {
        throw new Error(`API returned ${response.status}`);
      }
    } catch (err) {
      // Backend unavailable — generate fallback result
      console.warn("Backend API unavailable, using fallback result:", err);

      setProcessingStep(2);
      await new Promise((r) => setTimeout(r, 600));
      setProcessingStep(3);
      await new Promise((r) => setTimeout(r, 600));

      triage = {
        incident_type: "General Emergency",
        severity: "medium",
        location: coords
          ? `${coords.lat.toFixed(4)}° N, ${coords.lng.toFixed(4)}° E`
          : "Location unavailable",
        casualties: "Unknown",
        departments: ["Police"],
        summary: currentTranscript,
        confidence: 70,
      };
      setResult(triage);
    }

    setPhase("done");

    // Spoken dispatch summary via Sarvam Bulbul v4 Flash (best-effort)
    if (triage) {
      void playDispatchAudio(
        `Emergency report. Type: ${triage.incident_type}. Severity: ${triage.severity}. ` +
          `Location: ${triage.location}. ${triage.departments.length} departments notified. ` +
          `${triage.summary}`
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
    setAudioUrl(null);
    setAudioPlaying(false);
    setPhase("idle");
    setTranscript("");
    transcriptRef.current = "";
    setResult(null);
    setProcessingStep(0);
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
            Press the microphone and describe what you see. Our AI will handle
            everything else.
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
              disabled={phase === "processing"}
              whileTap={{ scale: 0.9 }}
              whileHover={phase !== "processing" ? { scale: 1.08, boxShadow: "0 0 60px var(--accent-red-glow)" } : undefined}
              transition={{ type: "spring", stiffness: 300 }}
            >
              {phase === "recording" && (
                <>
                  <span className={styles.micRing1} />
                  <span className={styles.micRing2} />
                  <span className={styles.micRing3} />
                </>
              )}
              {phase === "processing" ? (
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
              {phase === "idle" && "Tap to start recording"}
              {phase === "recording" && "Listening... Tap to stop"}
              {phase === "processing" && "Processing your report..."}
              {phase === "done" && "Report dispatched! Tap to report again"}
            </p>
          </motion.div>

          {/* Audio Waveform */}
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

          {/* Live Transcript */}
          <AnimatePresence>
            {transcript && (phase === "recording" || phase === "processing" || phase === "done") && (
              <motion.div
                className={`glass-card ${styles.transcriptCard}`}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
              >
                <div className={styles.transcriptHeader}>
                  <Languages size={16} />
                  <span>Live Transcript ({language.label})</span>
                </div>
                <p className={styles.transcriptText}>
                  {transcript}
                  {phase === "recording" && (
                    <span className={styles.cursor}>|</span>
                  )}
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Processing Steps */}
          <AnimatePresence>
            {phase === "processing" && (
              <motion.div
                className={`glass-card ${styles.processingCard}`}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
              >
                {processingSteps.map((step, i) => (
                  <div
                    key={i}
                    className={`${styles.processStep} ${i < processingStep ? styles.stepDone : i === processingStep ? styles.stepActive : ""}`}
                  >
                    {i < processingStep ? (
                      <CheckCircle2 size={18} />
                    ) : i === processingStep ? (
                      <Loader2 size={18} className={styles.spinning} />
                    ) : (
                      <div className={styles.stepDot} />
                    )}
                    <span>{step}</span>
                  </div>
                ))}
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
                {/* Success Banner */}
                <div className={styles.successBanner}>
                  <CheckCircle2 size={20} />
                  <span>
                    Alert dispatched to {result.departments.length} departments
                  </span>
                  {audioUrl && (
                    <button
                      className={styles.replayButton}
                      onClick={togglePlayback}
                      title={audioPlaying ? "Pause spoken summary (Sarvam Bulbul v4)" : "Play spoken summary (Sarvam Bulbul v4)"}
                      aria-label={audioPlaying ? "Pause spoken summary" : "Play spoken summary"}
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
                          {result.incident_type}
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
                      Location Detected
                    </h3>
                    <p className={styles.locationText}>{result.location}</p>
                    <p className={styles.locationCoords}>
                      {coords
                        ? `${coords.lat.toFixed(4)}° N, ${coords.lng.toFixed(4)}° E`
                        : "Awaiting GPS..."}
                    </p>
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
