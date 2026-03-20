"use client";

import React, { useState, useEffect, use } from "react";
import { motion } from "framer-motion";
import {
  BarChart3,
  MapPin,
  AlertTriangle,
  ArrowUp,
  Loader2,
  Inbox,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { AnimatedCounter, StaggerContainer, StaggerItem, TiltCard } from "@/components/AnimationHelpers";
import { getAgencyBySlug } from "@/lib/agencyConfig";
import styles from "@/app/analytics/analytics.module.css";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const SEVERITY_COLORS: Record<string, string> = {
  critical: "#ef4444",
  high: "#f59e0b",
  medium: "#3b82f6",
  low: "#10b981",
};

interface AnalyticsData {
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

const CustomTooltip = ({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value: number; name: string }>;
  label?: string;
}) => {
  if (active && payload?.length) {
    return (
      <div className={styles.tooltip}>
        <p className={styles.tooltipLabel}>{label}</p>
        {payload.map((p, i) => (
          <p key={i} className={styles.tooltipVal}>
            {p.name}: <strong>{p.value}</strong>
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export default function AgencyAnalyticsPage({
  params,
}: {
  params: Promise<{ agency: string }>;
}) {
  const { agency: agencySlug } = use(params);
  const agency = getAgencyBySlug(agencySlug);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!agency) return;
    async function fetchAnalytics() {
      try {
        const encoded = encodeURIComponent(agency!.apiName);
        const res = await fetch(`${API_BASE}/api/analytics?department=${encoded}`);
        if (res.ok) {
          setAnalytics(await res.json());
        }
      } catch (err) {
        console.warn("Failed to fetch analytics:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchAnalytics();
  }, [agency]);

  if (!agency) {
    return (
      <div style={{ padding: "80px 24px", textAlign: "center", color: "var(--text-muted)" }}>
        Agency not found.
      </div>
    );
  }

  const totalIncidents = analytics?.total_incidents ?? 0;
  const resolutionRate = analytics?.resolution_rate ?? 0;
  const avgResponseTime = analytics?.avg_response_time ?? 0;

  const incidentsByType = analytics
    ? Object.entries(analytics.incidents_by_type).map(([name, count]) => ({
        name: name.replace("Building ", "").replace(" Emergency", ""),
        count,
        color: agency.color,
      }))
    : [];

  const severityDist = analytics
    ? Object.entries(analytics.severity_distribution)
        .filter(([, value]) => value > 0)
        .map(([name, value]) => ({
          name: name.charAt(0).toUpperCase() + name.slice(1),
          value,
          color: SEVERITY_COLORS[name] || "#64748b",
        }))
    : [];

  const hotspots = analytics
    ? Object.entries(analytics.location_hotspots)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 8)
        .map(([city, incidents]) => ({ city, incidents }))
    : [];

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={`container ${styles.content}`}>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, padding: "120px 0", color: "var(--text-muted)" }}
          >
            <Loader2 size={40} style={{ animation: "spin 1s linear infinite" }} />
            <span style={{ fontSize: "1.1rem" }}>Loading {agency.label} analytics...</span>
          </motion.div>
        </div>
      </div>
    );
  }

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
              <BarChart3 size={28} style={{ color: agency.color }} />
              <span style={{ color: agency.color }}>{agency.label}</span> Analytics
            </h1>
            <p className={styles.subtitle}>
              Incident statistics scoped to {agency.label} only
            </p>
          </div>
        </motion.div>

        {/* Summary stats */}
        <StaggerContainer className={styles.summaryGrid} staggerDelay={0.1}>
          {[
            { label: "Total Incidents", value: String(totalIncidents), change: "From this department", changeColor: agency.color, up: true },
            { label: "Avg Response Time", value: `${avgResponseTime}m`, change: "Estimated", changeColor: "var(--accent-green)", up: false },
            { label: "Resolution Rate", value: `${resolutionRate}%`, change: totalIncidents > 0 ? "From stored data" : "No data", changeColor: "var(--accent-green)", up: true },
            { label: "Active Hotspots", value: String(hotspots.length), change: hotspots.length > 0 ? `${hotspots.length} cities` : "No hotspots", changeColor: "var(--accent-amber)", up: true },
          ].map((stat, i) => (
            <StaggerItem key={i}>
              <TiltCard className={`glass-card ${styles.summaryCard}`}>
                <div className={styles.summaryLabel}>{stat.label}</div>
                <div className={styles.summaryValue}>
                  <AnimatedCounter value={stat.value} duration={2} />
                </div>
                <div className={styles.summaryChange} style={{ color: stat.changeColor }}>
                  <ArrowUp size={14} /> {stat.change}
                </div>
              </TiltCard>
            </StaggerItem>
          ))}
        </StaggerContainer>

        {totalIncidents === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, padding: "80px 0", color: "var(--text-muted)" }}
          >
            <Inbox size={48} />
            <span style={{ fontSize: "1.2rem", fontWeight: 600 }}>No data for {agency.label}</span>
            <span style={{ fontSize: "0.9rem", maxWidth: 400, textAlign: "center", lineHeight: 1.6 }}>
              Submit emergency reports from the Report page. Charts will appear here once {agency.label} incidents exist.
            </span>
          </motion.div>
        ) : (
          <>
            {/* Charts Row 1 */}
            <div className={styles.chartsRow}>
              {/* Incidents by Type */}
              <motion.div
                className={`glass-card ${styles.chartCard}`}
                initial={{ opacity: 0, y: 30, scale: 0.95 }}
                whileInView={{ opacity: 1, y: 0, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 0.1, duration: 0.5 }}
                style={{ borderTop: `2px solid ${agency.color}` }}
              >
                <h3 className={styles.chartTitle}>Incidents by Type</h3>
                <div className={styles.chartContainer}>
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={incidentsByType} barSize={28}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                      <XAxis dataKey="name" tick={{ fill: "#64748b", fontSize: 12 }} axisLine={false} />
                      <YAxis tick={{ fill: "#64748b", fontSize: 12 }} axisLine={false} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="count" name="Incidents" fill={agency.color} fillOpacity={0.85} radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </motion.div>

              {/* Severity Distribution */}
              <motion.div
                className={`glass-card ${styles.chartCard}`}
                initial={{ opacity: 0, y: 30, scale: 0.95 }}
                whileInView={{ opacity: 1, y: 0, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 0.2, duration: 0.5 }}
                style={{ borderTop: `2px solid ${agency.color}` }}
              >
                <h3 className={styles.chartTitle}>Severity Distribution</h3>
                <div className={styles.chartContainer} style={{ display: "flex", alignItems: "center" }}>
                  <ResponsiveContainer width="50%" height={260}>
                    <PieChart>
                      <Pie
                        data={severityDist}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={90}
                        paddingAngle={4}
                        dataKey="value"
                      >
                        {severityDist.map((entry, i) => (
                          <Cell key={i} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className={styles.pieLegend}>
                    {severityDist.map((item, i) => (
                      <div key={i} className={styles.legendItem}>
                        <span className={styles.legendDot} style={{ background: item.color }} />
                        <span className={styles.legendLabel}>{item.name}</span>
                        <span className={styles.legendVal}>{item.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            </div>

            {/* Hotspots */}
            <motion.div
              className={`glass-card ${styles.chartCard}`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 }}
              style={{ borderTop: `2px solid ${agency.color}` }}
            >
              <h3 className={styles.chartTitle}>
                <MapPin size={16} style={{ color: agency.color }} /> City Hotspots for {agency.label}
              </h3>
              <div className={styles.hotspotList}>
                {hotspots.length === 0 ? (
                  <div style={{ padding: "40px 0", textAlign: "center", color: "var(--text-muted)", fontSize: "0.9rem" }}>
                    No location data available yet
                  </div>
                ) : (
                  hotspots.map((hs, i) => (
                    <div key={i} className={styles.hotspotItem}>
                      <span className={styles.hotspotRank} style={{ color: agency.color }}>#{i + 1}</span>
                      <span className={styles.hotspotCity}>{hs.city}</span>
                      <span
                        style={{
                          padding: "2px 10px",
                          borderRadius: 99,
                          fontSize: "0.8rem",
                          fontWeight: 700,
                          background: `rgba(${agency.colorRgb}, 0.15)`,
                          color: agency.color,
                        }}
                      >
                        {hs.incidents}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </>
        )}
      </div>
    </div>
  );
}
