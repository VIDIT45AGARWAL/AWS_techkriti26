"use client";

import React, { useState, useEffect, use } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  MapPin,
  Clock,
  AlertTriangle,
  Activity,
  TrendingDown,
  Users,
  Radio,
  Loader2,
  Inbox,
  CheckCircle,
} from "lucide-react";
import { AnimatedCounter, StaggerContainer, StaggerItem } from "@/components/AnimationHelpers";
import MapView from "@/components/MapView";
import { getAgencyBySlug } from "@/lib/agencyConfig";
import styles from "./agencyDashboard.module.css";
import mainStyles from "@/app/dashboard/dashboard.module.css";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface Incident {
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
}

const severityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
const statusColors: Record<string, string> = {
  active: "var(--accent-red)",
  responding: "var(--accent-amber)",
  resolved: "var(--accent-green)",
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function AgencyDashboardPage({
  params,
}: {
  params: Promise<{ agency: string }>;
}) {
  const { agency: agencySlug } = use(params);
  const agency = getAgencyBySlug(agencySlug);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);

  useEffect(() => {
    if (!agency) return;

    async function fetchIncidents() {
      try {
        const encoded = encodeURIComponent(agency!.apiName);
        const res = await fetch(`${API_BASE}/api/incidents?department=${encoded}`);
        if (res.ok) {
          const data = await res.json();
          setIncidents(data);
        }
      } catch (err) {
        console.warn("Failed to fetch incidents:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchIncidents();
    const interval = setInterval(fetchIncidents, 15000);
    return () => clearInterval(interval);
  }, [agency]);

  const handleMarkResolved = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      const res = await fetch(`${API_BASE}/api/incidents/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "resolved" }),
      });
      if (res.ok) {
        setIncidents((prev) =>
          prev.map((inc) => (inc.id === id ? { ...inc, status: "resolved" } : inc))
        );
        if (selectedIncident?.id === id) {
          setSelectedIncident((prev) => (prev ? { ...prev, status: "resolved" } : null));
        }
      }
    } catch (err) {
      console.warn("Failed to mark resolved:", err);
    }
  };

  if (!agency) {
    return (
      <div style={{ padding: "80px 24px", textAlign: "center", color: "var(--text-muted)" }}>
        Agency not found.
      </div>
    );
  }

  const filtered = incidents
    .filter((inc) => inc.status !== "resolved")
    .sort((a, b) => (severityOrder[a.severity] ?? 3) - (severityOrder[b.severity] ?? 3));

  const activeCount = incidents.filter((i) => i.status === "active").length;
  const respondingCount = incidents.filter((i) => i.status === "responding").length;
  const resolvedCount = incidents.filter((i) => i.status === "resolved").length;

  return (
    <div className={styles.page}>
      <div className={`container ${styles.content}`}>
        {/* Header */}
        <motion.div
          className={styles.header}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div>
            <h1 className={styles.title}>
              <span style={{ color: agency.color }}>{agency.label}</span>
              {" "}— Incident Dashboard
            </h1>
            <p className={styles.subtitle}>
              Live incidents assigned to {agency.label} · Auto-refreshes every 15 seconds
            </p>
          </div>
          <div className={mainStyles.liveIndicator} style={{ borderColor: `rgba(${agency.colorRgb}, 0.4)` }}>
            <span className={mainStyles.liveDot} style={{ background: agency.color }} />
            <span style={{ color: agency.color }}>LIVE</span>
          </div>
        </motion.div>

        {/* Stats */}
        <motion.div
          className={styles.statsBar}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          {[
            { icon: AlertTriangle, label: "Active", value: String(activeCount), color: "var(--accent-red)", bg: "rgba(239,68,68,0.1)" },
            { icon: Radio, label: "Responding", value: String(respondingCount), color: "var(--accent-amber)", bg: "rgba(245,158,11,0.1)" },
            { icon: CheckCircle, label: "Resolved", value: String(resolvedCount), color: "var(--accent-green)", bg: "rgba(16,185,129,0.1)" },
            { icon: Activity, label: "Total", value: String(incidents.length), color: agency.color, bg: `rgba(${agency.colorRgb},0.1)` },
          ].map((stat, i) => {
            const Icon = stat.icon;
            return (
              <motion.div
                key={i}
                className={styles.statItem}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + i * 0.07 }}
                whileHover={{ scale: 1.04, y: -2 }}
              >
                <div className={styles.statIcon} style={{ background: stat.bg, color: stat.color }}>
                  <Icon size={20} />
                </div>
                <div>
                  <div className={styles.statNum}>
                    <AnimatedCounter value={stat.value} duration={1.5} />
                  </div>
                  <div className={styles.statLabel}>{stat.label}</div>
                </div>
              </motion.div>
            );
          })}
        </motion.div>

        {/* Main Grid */}
        <div className={mainStyles.mainGrid}>
          {/* Feed */}
          <div className={mainStyles.feedColumn}>
            <div className={mainStyles.feedHeader}>
              <h2 className={mainStyles.feedTitle}>Incident Feed</h2>
              <span className={mainStyles.feedCount}>{filtered.length} open incidents</span>
            </div>
            <div className={mainStyles.feedList}>
              {loading ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: "60px 0", color: "var(--text-muted)" }}
                >
                  <Loader2 size={32} style={{ animation: "spin 1s linear infinite" }} />
                  <span>Loading {agency.label} incidents...</span>
                </motion.div>
              ) : filtered.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: "60px 0", color: "var(--text-muted)" }}
                >
                  <Inbox size={40} />
                  <span style={{ fontSize: "1.1rem", fontWeight: 600 }}>No open incidents</span>
                  <span style={{ fontSize: "0.85rem" }}>
                    All {agency.label} incidents have been resolved, or none have been reported.
                  </span>
                </motion.div>
              ) : (
                <AnimatePresence>
                  {filtered.map((inc, i) => (
                    <motion.div
                      key={inc.id}
                      className={`glass-card ${mainStyles.incidentCard} ${selectedIncident?.id === inc.id ? mainStyles.incidentSelected : ""}`}
                      initial={{ opacity: 0, x: -30, scale: 0.95 }}
                      animate={{ opacity: 1, x: 0, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9, height: 0, marginBottom: 0, padding: 0 }}
                      transition={{ delay: i * 0.06, type: "spring", stiffness: 200, damping: 20 }}
                      onClick={() => setSelectedIncident(inc)}
                      whileHover={{ scale: 1.02, x: 4 }}
                      layout
                      style={{ borderLeft: `3px solid ${agency.color}` }}
                    >
                      <div className={mainStyles.incidentHeader}>
                        <span className={`badge badge-${inc.severity}`}>{inc.severity}</span>
                        <span className={mainStyles.incidentStatus} style={{ color: statusColors[inc.status] }}>
                          ● {inc.status}
                        </span>
                      </div>
                      <h3 className={mainStyles.incidentType}>{inc.type}</h3>
                      <p className={mainStyles.incidentSummary}>{inc.summary}</p>
                      <div className={mainStyles.incidentMeta}>
                        <span><MapPin size={12} /> {inc.location}</span>
                        <span><Clock size={12} /> {timeAgo(inc.timestamp)}</span>
                      </div>
                      {inc.casualties !== "None" && inc.casualties !== "None reported" && (
                        <div className={mainStyles.incidentCasualties}>
                          <AlertTriangle size={12} />
                          {inc.casualties}
                        </div>
                      )}
                      {inc.status !== "resolved" && (
                        <button
                          className={mainStyles.resolveBtn}
                          onClick={(e) => handleMarkResolved(e, inc.id)}
                          style={{ borderColor: `rgba(${agency.colorRgb}, 0.3)` }}
                        >
                          <CheckCircle size={14} /> Mark as Resolved
                        </button>
                      )}
                    </motion.div>
                  ))}
                </AnimatePresence>
              )}
            </div>
          </div>

          {/* Map / Detail */}
          <div className={mainStyles.mapColumn}>
            <div className={`glass-card ${mainStyles.mapCard}`}>
              <div className={mainStyles.mapHeader}>
                <h2 className={mainStyles.feedTitle}>Live Map</h2>
                <span className={mainStyles.feedCount}>{filtered.length} pins</span>
              </div>
              <div className={mainStyles.mapPlaceholder}>
                <MapView
                  incidents={filtered
                    .filter((inc) => inc.coordinates)
                    .map((inc) => ({
                      id: inc.id,
                      type: inc.type,
                      severity: inc.severity,
                      location: inc.location,
                      coords: [inc.coordinates.lat, inc.coordinates.lng] as [number, number],
                      status: inc.status,
                      summary: inc.summary,
                      casualties: inc.casualties,
                    }))}
                  selectedId={selectedIncident?.id || null}
                  onSelectIncident={(mapInc) => {
                    const found = incidents.find((i) => i.id === mapInc.id);
                    if (found) setSelectedIncident(found);
                  }}
                />
              </div>
            </div>

            {selectedIncident && (
              <motion.div
                className={`glass-card ${mainStyles.detailCard}`}
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 20 }}
                transition={{ type: "spring", stiffness: 200, damping: 20 }}
                key={selectedIncident.id}
                style={{ borderTop: `3px solid ${agency.color}` }}
              >
                <div className={mainStyles.detailHeader}>
                  <span className={`badge badge-${selectedIncident.severity}`}>{selectedIncident.severity}</span>
                  <span className={mainStyles.detailId}>{selectedIncident.id}</span>
                </div>
                <h3 className={mainStyles.detailType}>{selectedIncident.type}</h3>
                <div className={mainStyles.detailFields}>
                  <div className={mainStyles.detailField}><MapPin size={14} /><span>{selectedIncident.location}</span></div>
                  <div className={mainStyles.detailField}><Clock size={14} /><span>{timeAgo(selectedIncident.timestamp)}</span></div>
                  {selectedIncident.casualties !== "None" && selectedIncident.casualties !== "None reported" && (
                    <div className={mainStyles.detailField}><AlertTriangle size={14} /><span>{selectedIncident.casualties}</span></div>
                  )}
                </div>
                <p className={mainStyles.detailSummary}>{selectedIncident.summary}</p>
                {selectedIncident.coordinates && (
                  <div className={mainStyles.detailCoords}>
                    {selectedIncident.coordinates.lat.toFixed(4)}° N,{" "}
                    {selectedIncident.coordinates.lng.toFixed(4)}° E
                  </div>
                )}
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
