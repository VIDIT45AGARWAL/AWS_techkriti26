"use client";

import { timeAgo } from "@/lib/agencyConfig";
import {
  SEVERITY_LABEL,
  SEVERITY_TONE,
  STATUS_LABEL,
  STATUS_TONE,
  TONE_BG,
  TONE_TEXT,
} from "@/lib/tone";

export interface Incident {
  id: string;
  type: string;
  severity: "critical" | "high" | "medium" | "low";
  departments: string[];
  location: string;
  coordinates: { lat: number; lng: number };
  timestamp: string;
  casualties: string;
  summary: string;
  status: "active" | "responding" | "resolved";
  conversation?: { role: string; text: string }[];
}

// Tailwind works on literal class names, so tone tokens are mapped explicitly.

/**
 * A ruled-paper entry in the dispatch log. Collapsed like the rest of the
 * log; opens in place for casualties, coordinates, and the resolve action.
 */
export function IncidentRow({
  incident,
  expanded = false,
  onToggle,
  onResolve,
  id,
}: {
  incident: Incident;
  expanded?: boolean;
  onToggle?: () => void;
  onResolve?: (event: React.MouseEvent) => void;
  id?: string;
}) {
  const severityTone = SEVERITY_TONE[incident.severity] ?? "info";
  const statusLabel = STATUS_LABEL[incident.status] ?? incident.status;
  const hasCasualties =
    incident.casualties &&
    incident.casualties !== "None" &&
    incident.casualties !== "None reported";

  return (
    <li id={id} className="border-b border-line py-7 first:pt-1 scroll-mt-8" data-expanded={expanded || undefined}>
      <article>
        <div className="flex items-start justify-between gap-x-6 gap-y-2">
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={expanded}
            className="min-w-0 flex-1 cursor-pointer text-left"
          >
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] uppercase tracking-[0.08em] text-muted">
              <span
                className={`inline-block size-[7px] rounded-full ${
                  TONE_BG[STATUS_TONE[incident.status] ?? "ok"]
                }`}
              />
              <span>{timeAgo(incident.timestamp)}</span>
              <span aria-hidden="true">·</span>
              <span>{statusLabel}</span>
              <span aria-hidden="true">·</span>
              <span className={TONE_TEXT[severityTone]}>{SEVERITY_LABEL[incident.severity]}</span>
            </p>
            <h2 className="mt-2 max-w-[42rem] text-pretty font-display text-[1.45rem] font-normal leading-[1.2] tracking-[-0.015em]">
              {incident.type}
            </h2>
          </button>

          {incident.status !== "resolved" && onResolve ? (
            <button
              type="button"
              onClick={onResolve}
              className="shrink-0 text-[11px] text-accent underline decoration-accent/40 underline-offset-4 transition-colors hover:decoration-accent"
            >
              Mark resolved
            </button>
          ) : null}
        </div>

        <p
          className={`mt-3 max-w-[70ch] text-pretty text-[13px] leading-6 text-muted ${
            expanded ? "" : "line-clamp-2"
          }`}
        >
          {incident.summary}
        </p>

        <div
          hidden={!expanded}
          className="mt-4 max-w-[70ch] border-l border-line pl-4 text-[13px] leading-6"
        >
          <div className="grid grid-cols-[8.5rem_minmax(0,1fr)] gap-x-4 gap-y-1.5">
            <span className="text-[11px] uppercase tracking-[0.08em] text-muted">Casualties</span>
            <span>{hasCasualties ? incident.casualties : "None"}</span>
            <span className="text-[11px] uppercase tracking-[0.08em] text-muted">Filed</span>
            <span className="tabular-nums">
              {new Date(incident.timestamp).toLocaleString(undefined, {
                dateStyle: "medium",
                timeStyle: "short",
              })}
            </span>
            <span className="text-[11px] uppercase tracking-[0.08em] text-muted">Location</span>
            <span>
              {incident.location}
              {typeof incident.coordinates?.lat === "number" &&
              typeof incident.coordinates?.lng === "number" ? (
                <span className="text-muted tabular-nums">
                  {" "}
                  ({incident.coordinates.lat.toFixed(4)}°, {incident.coordinates.lng.toFixed(4)}°)
                </span>
              ) : null}
            </span>
          </div>
        </div>

        {expanded && incident.conversation && incident.conversation.length > 0 ? (
          <div className="mt-4 max-w-[70ch] border-l border-line pl-4">
            <p className="text-[11px] uppercase tracking-[0.08em] text-muted">Voice conversation</p>
            <ol className="mt-2.5 list-none">
              {incident.conversation.map((turn, i) => (
                <li
                  key={i}
                  className="grid grid-cols-[5.25rem_minmax(0,1fr)] gap-x-4 py-1.5 text-[13px] leading-6 last:pb-0"
                >
                  <span className="text-[11px] uppercase tracking-[0.08em] text-muted">
                    {turn.role === "user" ? "Caller" : "Dispatcher"}
                  </span>
                  <span
                    className={
                      turn.role === "user" ? "text-ink/90" : "heard text-[14.5px] text-ink"
                    }
                  >
                    {turn.text}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        ) : null}

        <ul className="mt-4 flex flex-wrap items-center gap-2">
          {incident.departments?.map((department) => (
            <li
              key={department}
              className="inline-flex rounded-[4px] border border-line px-2 py-1 text-[11px] text-muted"
            >
              <span className="font-medium text-ink">{department}</span>
            </li>
          ))}
          <li className="inline-flex px-1.5 py-1 text-[11px] text-muted">
            #{incident.id.slice(0, 8)}
          </li>
        </ul>
      </article>
    </li>
  );
}
