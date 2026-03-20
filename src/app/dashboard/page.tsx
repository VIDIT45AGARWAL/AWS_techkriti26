"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Shield,
  Flame,
  Heart,
  CloudLightning,
  MapPin,
  Clock,
  AlertTriangle,
  Filter,
  Activity,
  TrendingDown,
  Users,
  Radio,
  Loader2,
  Inbox,
  CheckCircle,
} from "lucide-react";
import { AnimatedCounter, StaggerContainer, StaggerItem, TiltCard } from "@/components/AnimationHelpers";
import MapView from "@/components/MapView";
import type { MapIncident } from "@/components/MapView";
import styles from "./dashboard.module.css";

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

const departments = [
  { label: "All", icon: Activity, color: "var(--text-secondary)" },
  { label: "Police", icon: Shield, color: "var(--accent-blue)" },
  { label: "Fire Department", icon: Flame, color: "var(--accent-red)" },
  { label: "Medical Emergency", icon: Heart, color: "var(--accent-green)" },
  { label: "Disaster Response", icon: CloudLightning, color: "var(--accent-amber)" },
];

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

export default function DashboardPage() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeDept, setActiveDept] = useState("All");
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);

  useEffect(() => {
    async function fetchIncidents() {
      try {
        const res = await fetch(`${API_BASE}/api/incidents`);
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
    // Poll every 15 seconds for live updates
    const interval = setInterval(fetchIncidents, 15000);
    return () => clearInterval(interval);
  }, []);

  const handleMarkResolved = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation(); // Prevent selecting the incident
    try {
      const res = await fetch(`${API_BASE}/api/incidents/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "resolved" })
      });
      if (res.ok) {
        // Optimistically update local state
        setIncidents(prev => prev.map(inc => inc.id === id ? { ...inc, status: "resolved" } : inc));
        if (selectedIncident?.id === id) {
          setSelectedIncident(prev => prev ? { ...prev, status: "resolved" } : null);
        }
      }
    } catch (err) {
      console.warn("Failed to mark resolved:", err);
    }
  };

  const filtered = incidents
    .filter((inc) => inc.status !== "resolved")
    .filter((inc) => activeDept === "All" || inc.departments?.includes(activeDept))
    .sort((a, b) => (severityOrder[a.severity] ?? 3) - (severityOrder[b.severity] ?? 3));

  const activeCount = incidents.filter((i) => i.status === "active").length;
  const respondingCount = incidents.filter((i) => i.status === "responding").length;
  const uniqueDepts = new Set(incidents.flatMap((i) => i.departments || []));

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
            <h1 className={styles.title}>Department Dashboard</h1>
            <p className={styles.subtitle}>
              Real-time incident monitoring and response tracking
            </p>
          </div>
          <div className={styles.liveIndicator}>
            <span className={styles.liveDot} />
            LIVE
          </div>
        </motion.div>

        {/* Stats Bar */}
        <motion.div
          className={styles.statsBar}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          {[
            { icon: AlertTriangle, label: "Active Incidents", value: String(activeCount), bg: "rgba(239, 68, 68, 0.1)", color: "var(--accent-red)" },
            { icon: Radio, label: "Responding", value: String(respondingCount), bg: "rgba(245, 158, 11, 0.1)", color: "var(--accent-amber)" },
            { icon: TrendingDown, label: "Avg Response", value: "4.2m", bg: "rgba(16, 185, 129, 0.1)", color: "var(--accent-green)" },
            { icon: Users, label: "Depts Active", value: String(uniqueDepts.size), bg: "rgba(59, 130, 246, 0.1)", color: "var(--accent-blue)" },
          ].map((stat, i) => {
            const Icon = stat.icon;
            return (
              <motion.div
                key={i}
                className={styles.statItem}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + i * 0.08 }}
                whileHover={{ scale: 1.03, y: -2 }}
              >
                <motion.div
                  className={styles.statIcon}
                  style={{ background: stat.bg, color: stat.color }}
                  whileHover={{ rotate: 10, scale: 1.15 }}
                  transition={{ type: "spring", stiffness: 300 }}
                >
                  <Icon size={20} />
                </motion.div>
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

        {/* Department Filters */}
        <motion.div
          className={styles.filters}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          <Filter size={16} className={styles.filterIcon} />
          {departments.map((dept) => {
            const Icon = dept.icon;
            const isActive = activeDept === dept.label;
            return (
              <button
                key={dept.label}
                className={`${styles.filterBtn} ${isActive ? styles.filterActive : ""}`}
                onClick={() => setActiveDept(dept.label)}
                style={isActive ? { borderColor: dept.color, color: dept.color } : undefined}
              >
                <Icon size={14} />
                <span>{dept.label}</span>
              </button>
            );
          })}
        </motion.div>

        {/* Main Grid */}
        <div className={styles.mainGrid}>
          {/* Incident Feed */}
          <div className={styles.feedColumn}>
            <div className={styles.feedHeader}>
              <h2 className={styles.feedTitle}>Incident Feed</h2>
              <span className={styles.feedCount}>{filtered.length} incidents</span>
            </div>
            <div className={styles.feedList}>
              {loading ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 12,
                    padding: "60px 0",
                    color: "var(--text-muted)",
                  }}
                >
                  <Loader2 size={32} style={{ animation: "spin 1s linear infinite" }} />
                  <span>Loading incidents...</span>
                </motion.div>
              ) : filtered.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 12,
                    padding: "60px 0",
                    color: "var(--text-muted)",
                  }}
                >
                  <Inbox size={40} />
                  <span style={{ fontSize: "1.1rem", fontWeight: 600 }}>No incidents reported</span>
                  <span style={{ fontSize: "0.85rem" }}>
                    Reports submitted from the Report page will appear here in real time.
                  </span>
                </motion.div>
              ) : (
                <AnimatePresence>
                  {filtered.map((inc, i) => (
                    <motion.div
                      key={inc.id}
                      className={`glass-card ${styles.incidentCard} ${selectedIncident?.id === inc.id ? styles.incidentSelected : ""}`}
                      initial={{ opacity: 0, x: -30, scale: 0.95 }}
                      animate={{ opacity: 1, x: 0, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9, height: 0, marginBottom: 0, padding: 0 }}
                      transition={{ delay: i * 0.06, type: "spring", stiffness: 200, damping: 20 }}
                      onClick={() => setSelectedIncident(inc)}
                      whileHover={{ scale: 1.02, x: 4, transition: { duration: 0.2 } }}
                      layout
                    >
                    <div className={styles.incidentHeader}>
                      <span className={`badge badge-${inc.severity}`}>
                        {inc.severity}
                      </span>
                      <span
                        className={styles.incidentStatus}
                        style={{ color: statusColors[inc.status] }}
                      >
                        ● {inc.status}
                      </span>
                    </div>
                    <h3 className={styles.incidentType}>{inc.type}</h3>
                    <p className={styles.incidentSummary}>{inc.summary}</p>
                    <div className={styles.incidentMeta}>
                      <span>
                        <MapPin size={12} /> {inc.location}
                      </span>
                      <span>
                        <Clock size={12} /> {timeAgo(inc.timestamp)}
                      </span>
                    </div>
                    {inc.casualties !== "None" && inc.casualties !== "None reported" && (
                      <div className={styles.incidentCasualties}>
                        <AlertTriangle size={12} />
                        {inc.casualties}
                      </div>
                    )}
                    {inc.status !== "resolved" && (
                      <button 
                        className={styles.resolveBtn}
                        onClick={(e) => handleMarkResolved(e, inc.id)}
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

          {/* Map / Detail Panel */}
          <div className={styles.mapColumn}>
            <div className={`glass-card ${styles.mapCard}`}>
              <div className={styles.mapHeader}>
                <h2 className={styles.feedTitle}>Live Map</h2>
                <span className={styles.feedCount}>{filtered.length} pins</span>
              </div>
              <div className={styles.mapPlaceholder}>
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

            {/* Selected Incident Detail */}
            {selectedIncident && (
              <motion.div
                className={`glass-card ${styles.detailCard}`}
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 20 }}
                transition={{ type: "spring", stiffness: 200, damping: 20 }}
                key={selectedIncident.id}
              >
                <div className={styles.detailHeader}>
                  <span className={`badge badge-${selectedIncident.severity}`}>
                    {selectedIncident.severity}
                  </span>
                  <span className={styles.detailId}>{selectedIncident.id}</span>
                </div>
                <h3 className={styles.detailType}>{selectedIncident.type}</h3>
                <div className={styles.detailFields}>
                  <div className={styles.detailField}>
                    <MapPin size={14} />
                    <span>{selectedIncident.location}</span>
                  </div>
                  <div className={styles.detailField}>
                    <Clock size={14} />
                    <span>{timeAgo(selectedIncident.timestamp)}</span>
                  </div>
                  <div className={styles.detailField}>
                    <Shield size={14} />
                    <span>{selectedIncident.departments?.join(", ") || "—"}</span>
                  </div>
                  {selectedIncident.casualties !== "None" && selectedIncident.casualties !== "None reported" && (
                    <div className={styles.detailField}>
                      <AlertTriangle size={14} />
                      <span>{selectedIncident.casualties}</span>
                    </div>
                  )}
                </div>
                <p className={styles.detailSummary}>{selectedIncident.summary}</p>
                {selectedIncident.coordinates && (
                  <div className={styles.detailCoords}>
                    {selectedIncident.coordinates.lat.toFixed(4)}° N, {selectedIncident.coordinates.lng.toFixed(4)}° E
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
