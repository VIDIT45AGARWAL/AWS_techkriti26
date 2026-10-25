"use client";

import type { ReactNode } from "react";

import { SEVERITY_LABEL, SEVERITY_TONE, TONE_BG } from "@/lib/tone";

export interface AnalyticsData {
  total_incidents: number;
  active_incidents: number;
  responding_incidents: number;
  resolved_incidents: number;
  avg_response_time: number;
  resolution_rate: number;
  incidents_by_type: Record<string, number>;
  severity_distribution: Record<string, number>;
  department_performance: Record<string, number>;
  location_hotspots: Record<string, number>;
}

function StatBlock({ value, label }: { value: ReactNode; label: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="font-display text-[2.1rem] font-normal leading-none tracking-[-0.02em] tabular-nums">
        {value}
      </span>
      <span className="text-[11px] uppercase tracking-[0.08em] text-muted">{label}</span>
    </div>
  );
}

function BarRow({
  label,
  value,
  max,
  fillClass = "bg-accent",
  suffix = "",
}: {
  label: string;
  value: number;
  max: number;
  fillClass?: string;
  suffix?: string;
}) {
  const width = max > 0 ? Math.max(2, Math.round((value / max) * 100)) : 0;
  return (
    <li className="grid grid-cols-[minmax(6rem,10rem)_minmax(0,1fr)_3rem] items-center gap-x-4 py-2.5">
      <span className="truncate text-[13px]" title={label}>
        {label}
      </span>
      <span className="h-1.5 rounded-full bg-line">
        <span
          className={`block h-1.5 rounded-full ${fillClass}`}
          style={{ width: `${width}%` }}
        />
      </span>
      <span className="text-right text-[12.5px] text-muted tabular-nums">
        {value}
        {suffix}
      </span>
    </li>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section aria-label={title} className="mt-10">
      <h2 className="text-[11px] uppercase tracking-[0.08em] text-muted">{title}</h2>
      <div className="mt-3 border-t border-line">{children}</div>
    </section>
  );
}

function Table({ children }: { children: ReactNode }) {
  return <ol className="list-none">{children}</ol>;
}

export function AnalyticsView({
  data,
  scope,
}: {
  data: AnalyticsData | null;
  scope?: string;
}) {
  if (!data) return null;

  const typeEntries = Object.entries(data.incidents_by_type).sort((a, b) => b[1] - a[1]);
  const severityEntries = Object.entries(data.severity_distribution);
  const deptEntries = Object.entries(data.department_performance);
  const hotspots = Object.entries(data.location_hotspots)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);
  const maxType = typeEntries[0]?.[1] ?? 0;
  const maxSeverity = severityEntries[0]?.[1] ?? 0;
  const maxHotspot = hotspots[0]?.[1] ?? 0;

  return (
    <>
      <div className="mt-8 grid grid-cols-2 gap-x-10 gap-y-6 border-y border-line py-6 sm:grid-cols-4">
        <StatBlock value={data.total_incidents} label={scope ? "Reports, this desk" : "Reports, all desks"} />
        <StatBlock value={data.active_incidents} label="Active now" />
        <StatBlock value={data.responding_incidents} label="Responding" />
        <StatBlock value={data.resolved_incidents} label="Resolved" />
      </div>

      {typeEntries.length > 0 ? (
        <Section title="Reports by kind">
          <Table>
            {typeEntries.map(([kind, count]) => (
              <BarRow key={kind} label={kind} value={count} max={maxType} />
            ))}
          </Table>
        </Section>
      ) : null}

      {severityEntries.length > 0 ? (
        <Section title="Severity">
          <Table>
            {severityEntries.map(([severity, count]) => (
              <BarRow
                key={severity}
                label={SEVERITY_LABEL[severity] ?? severity}
                value={count}
                max={maxSeverity}
                fillClass={TONE_BG[SEVERITY_TONE[severity] ?? "info"]}
              />
            ))}
          </Table>
        </Section>
      ) : null}

      {!scope && deptEntries.length > 0 ? (
        <Section title="Desk performance · resolution rate">
          <Table>
            {deptEntries.map(([desk, rate]) => (
              <BarRow key={desk} label={desk} value={rate} max={100} suffix="%" />
            ))}
          </Table>
        </Section>
      ) : null}

      {hotspots.length > 0 ? (
        <Section title="Hotspots">
          <Table>
            {hotspots.map(([place, count]) => (
              <BarRow key={place} label={place} value={count} max={maxHotspot} />
            ))}
          </Table>
        </Section>
      ) : null}
    </>
  );
}
