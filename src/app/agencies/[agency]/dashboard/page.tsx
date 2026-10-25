"use client";

import React, { useState, useEffect, use } from "react";

import { IncidentRow, type Incident } from "@/components/incident-rows";
import MapView from "@/components/MapView";
import type { MapIncident } from "@/components/MapView";
import { getAgencyBySlug } from "@/lib/agencyConfig";
import { SEVERITY_LABEL, SEVERITY_TONE, TONE_BG } from "@/lib/tone";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const severityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };

export default function AgencyDashboardPage({
  params,
}: {
  params: Promise<{ agency: string }>;
}) {
  const { agency: agencySlug } = use(params);
  const agency = getAgencyBySlug(agencySlug);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    if (!agency) return;

    let alive = true;

    async function fetchIncidents() {
      try {
        const encoded = encodeURIComponent(agency!.apiName);
        const res = await fetch(`${API_BASE}/api/incidents?department=${encoded}`);
        if (res.ok && alive) {
          setIncidents(await res.json());
        }
      } catch (err) {
        console.warn("Failed to fetch incidents:", err);
      } finally {
        if (alive) setLoading(false);
      }
    }

    fetchIncidents();
    const interval = setInterval(fetchIncidents, 15000);
    return () => {
      alive = false;
      clearInterval(interval);
    };
  }, [agency]);

  const handleMarkResolved = async (event: React.MouseEvent, id: string) => {
    event.stopPropagation();
    try {
      const res = await fetch(`${API_BASE}/api/incidents/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "resolved" }),
      });
      if (res.ok) {
        setIncidents((prev) =>
          prev.map((inc) => (inc.id === id ? { ...inc, status: "resolved" } : inc)),
        );
        setExpandedId((prev) => (prev === id ? null : prev));
      }
    } catch (err) {
      console.warn("Failed to mark resolved:", err);
    }
  };

  if (!agency) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center px-6 py-24 text-center">
        <h1 className="font-display text-2xl tracking-[-0.01em]">Desk not found</h1>
        <p className="mt-3 text-[13px] text-muted">
          This desk does not exist. Pick one from the agency list.
        </p>
      </main>
    );
  }

  const filtered = incidents
    .filter((inc) => inc.status !== "resolved")
    .sort((a, b) => (severityOrder[a.severity] ?? 3) - (severityOrder[b.severity] ?? 3));

  const activeCount = incidents.filter((i) => i.status === "active").length;
  const respondingCount = incidents.filter((i) => i.status === "responding").length;
  const resolvedCount = incidents.filter((i) => i.status === "resolved").length;

  const pins: MapIncident[] = filtered.map((inc) => ({
    id: inc.id,
    type: inc.type,
    severity: inc.severity,
    location: inc.location,
    coords: [inc.coordinates?.lat ?? 22.5, inc.coordinates?.lng ?? 78.9] as [number, number],
    status: inc.status,
    summary: inc.summary,
    casualties: inc.casualties,
  }));

  const selectFromMap = (incident: MapIncident) => {
    setExpandedId(incident.id);
    requestAnimationFrame(() => {
      document
        .getElementById(`incident-${incident.id}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  };

  return (
    <main className="w-full flex-1 px-4 pb-14 pt-2 sm:px-6 lg:px-10 xl:px-14">
      <p className="text-[13px] text-muted">
        <span className="text-ink">{agency.label}</span> · open reports on this desk
      </p>

      {loading ? (
        <p className="mt-10 text-[13px] text-muted">Loading the log…</p>
      ) : (
        <div className="mt-4 grid gap-12 lg:grid-cols-[minmax(0,1fr)_380px]">
          <section aria-label="Open reports">
            <p className="flex flex-wrap items-baseline gap-3 text-[12.5px] text-muted">
              <span>
                <span className="font-medium text-ink">{filtered.length}</span>{" "}
                {filtered.length === 1 ? "report" : "reports"} open
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="size-[7px] rounded-full bg-critical" />
                {activeCount} active
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="size-[7px] rounded-full bg-warn" />
                {respondingCount} responding
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="size-[7px] rounded-full bg-ok" />
                {resolvedCount} resolved
              </span>
            </p>

            {filtered.length > 0 ? (
              <ol className="mt-4 list-none">
                {filtered.map((incident) => (
                  <IncidentRow
                    key={incident.id}
                    id={`incident-${incident.id}`}
                    incident={incident}
                    expanded={expandedId === incident.id}
                    onToggle={() =>
                      setExpandedId((prev) => (prev === incident.id ? null : incident.id))
                    }
                    onResolve={(event) => handleMarkResolved(event, incident.id)}
                  />
                ))}
              </ol>
            ) : (
              <div className="py-16">
                <h2 className="font-display text-2xl tracking-[-0.01em]">
                  Nothing open on this desk
                </h2>
                <p className="mt-3 max-w-md text-[13px] leading-6 text-muted">
                  New voice reports for {agency.label.toLowerCase()} work appear here
                  the moment they are filed.
                </p>
              </div>
            )}
          </section>

          <aside className="hidden lg:block" aria-label="Field view">
            <div className="sticky top-6">
              <div className="flex items-baseline justify-between">
                <p className="text-[11px] uppercase tracking-[0.08em] text-muted">Field view</p>
                <p className="text-[11px] text-muted">{pins.length} pins</p>
              </div>
              <div className="mt-3 h-[460px] overflow-hidden rounded-lg border border-line bg-panel">
                <MapView incidents={pins} onSelectIncident={selectFromMap} />
              </div>
              <div className="mt-3 flex items-center gap-4 text-[11px] text-muted">
                {(["critical", "high", "medium", "low"] as const).map((severity) => (
                  <span key={severity} className="inline-flex items-center gap-1.5">
                    <span className={`size-[7px] rounded-full ${TONE_BG[SEVERITY_TONE[severity]]}`} />
                    {SEVERITY_LABEL[severity]}
                  </span>
                ))}
              </div>
            </div>
          </aside>
        </div>
      )}
    </main>
  );
}
