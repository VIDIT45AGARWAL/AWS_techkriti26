/** Tone tokens: one quiet palette entry per severity, status, and agency.
 *  Tailwind classes for JSX, var() references for leaflet's plain HTML. */

export type Tone = "critical" | "warn" | "info" | "ok";

export const SEVERITY_TONE: Record<string, Tone> = {
  critical: "critical",
  high: "warn",
  medium: "info",
  low: "ok",
};

export const SEVERITY_LABEL: Record<string, string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
};

export const STATUS_TONE: Record<string, Tone> = {
  active: "critical",
  responding: "warn",
  resolved: "ok",
};

export const STATUS_LABEL: Record<string, string> = {
  active: "Active",
  responding: "Responding",
  resolved: "Resolved",
};

export const TONE_BG: Record<Tone, string> = {
  critical: "bg-critical",
  warn: "bg-warn",
  info: "bg-info",
  ok: "bg-ok",
};

export const TONE_TEXT: Record<Tone, string> = {
  critical: "text-critical",
  warn: "text-warn",
  info: "text-info",
  ok: "text-ok",
};

export const TONE_VAR: Record<Tone, string> = {
  critical: "--tone-critical",
  warn: "--tone-warn",
  info: "--tone-info",
  ok: "--tone-ok",
};
