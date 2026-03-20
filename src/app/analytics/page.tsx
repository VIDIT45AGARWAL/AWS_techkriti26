"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  BarChart3,
  TrendingUp,
  MapPin,
  Clock,
  AlertTriangle,
  Shield,
  Flame,
  Heart,
  CloudLightning,
  ArrowUp,
  ArrowDown,
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
  Area,
  AreaChart,
} from "recharts";
import styles from "./analytics.module.css";
import { AnimatedCounter, StaggerContainer, StaggerItem, TiltCard } from "@/components/AnimationHelpers";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// Color maps for chart rendering
const TYPE_COLORS: Record<string, string> = {
  "Building Fire": "#ef4444",
  "Road Accident": "#f59e0b",
  "Medical Emergency": "#10b981",
  "Theft": "#3b82f6",
  "Flooding": "#06b6d4",
  "Building Collapse": "#8b5cf6",
  "Gas Leak": "#f97316",
  "General Emergency": "#64748b",
  "Snake Bite": "#84cc16",
  "Theft in Progress": "#3b82f6",
};

const SEVERITY_COLORS: Record<string, string> = {
  critical: "#ef4444",
  high: "#f59e0b",
  medium: "#3b82f6",
  low: "#10b981",
};

const DEPT_META: Record<string, { icon: typeof Shield; color: string }> = {
  "Police": { icon: Shield, color: "#3b82f6" },
  "Fire Department": { icon: Flame, color: "#ef4444" },
  "Medical Emergency": { icon: Heart, color: "#10b981" },
  "Disaster Response": { icon: CloudLightning, color: "#f59e0b" },
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

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; name: string }>; label?: string }) => {
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

export default function AnalyticsPage() {
  const [timeRange, setTimeRange] = useState("7d");
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchAnalytics() {
      try {
        const res = await fetch(`${API_BASE}/api/analytics`);
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
  }, []);

  // Derive chart data from the API response
  const incidentsByType = analytics
    ? Object.entries(analytics.incidents_by_type).map(([name, count]) => ({
        name: name.replace("Building ", "").replace(" Emergency", ""),
        count,
        color: TYPE_COLORS[name] || "#64748b",
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

  const deptPerformance = analytics
    ? Object.entries(analytics.department_performance).map(([dept, total]) => {
        const meta = DEPT_META[dept] || { icon: Shield, color: "#64748b" };
        return { dept, icon: meta.icon, color: meta.color, total };
      })
    : [];

  const totalIncidents = analytics?.total_incidents ?? 0;
  const resolutionRate = analytics?.resolution_rate ?? 0;
  const avgResponseTime = analytics?.avg_response_time ?? 0;

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={`container ${styles.content}`}>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 16,
              padding: "120px 0",
              color: "var(--text-muted)",
            }}
          >
            <Loader2 size={40} style={{ animation: "spin 1s linear infinite" }} />
            <span style={{ fontSize: "1.1rem" }}>Loading analytics...</span>
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
              <BarChart3 size={28} /> Analytics
            </h1>
            <p className={styles.subtitle}>
              Incident hotspot analytics and department performance
            </p>
          </div>
          <div className={styles.timeSelector}>
            {["24h", "7d", "30d", "90d"].map((t) => (
              <button
                key={t}
                className={`${styles.timeBtn} ${timeRange === t ? styles.timeActive : ""}`}
                onClick={() => setTimeRange(t)}
              >
                {t}
              </button>
            ))}
          </div>
        </motion.div>

        {/* Summary Stats */}
        <StaggerContainer
          className={styles.summaryGrid}
          staggerDelay={0.1}
        >
          {[
            { label: "Total Incidents", value: String(totalIncidents), change: totalIncidents > 0 ? "Live data" : "No reports yet", changeColor: "var(--accent-blue)", up: true },
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
                  {stat.up ? <ArrowUp size={14} /> : <ArrowDown size={14} />} {stat.change}
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
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 16,
              padding: "80px 0",
              color: "var(--text-muted)",
            }}
          >
            <Inbox size={48} />
            <span style={{ fontSize: "1.2rem", fontWeight: 600 }}>No incidents to analyze</span>
            <span style={{ fontSize: "0.9rem", maxWidth: 400, textAlign: "center", lineHeight: 1.6 }}>
              Submit emergency reports from the Report page. Charts and analytics will appear here automatically once data exists.
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
              >
                <h3 className={styles.chartTitle}>Incidents by Type</h3>
                <div className={styles.chartContainer}>
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={incidentsByType} barSize={28}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                      <XAxis dataKey="name" tick={{ fill: "#64748b", fontSize: 12 }} axisLine={false} />
                      <YAxis tick={{ fill: "#64748b", fontSize: 12 }} axisLine={false} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="count" name="Incidents" radius={[6, 6, 0, 0]}>
                        {incidentsByType.map((entry, i) => (
                          <Cell key={i} fill={entry.color} fillOpacity={0.8} />
                        ))}
                      </Bar>
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

            {/* Bottom Row */}
            <div className={styles.chartsRow}>
              {/* Hotspots */}
              <motion.div
                className={`glass-card ${styles.chartCard}`}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
              >
                <h3 className={styles.chartTitle}>
                  <MapPin size={16} /> City Hotspots
                </h3>
                <div className={styles.hotspotList}>
                  {hotspots.length === 0 ? (
                    <div style={{ padding: "40px 0", textAlign: "center", color: "var(--text-muted)", fontSize: "0.9rem" }}>
                      No location data available yet
                    </div>
                  ) : (
                    hotspots.map((hs, i) => (
                      <div key={i} className={styles.hotspotItem}>
                        <span className={styles.hotspotRank}>#{i + 1}</span>
                        <span className={styles.hotspotCity}>{hs.city}</span>
                        <span className="badge badge-medium">
                          {hs.incidents}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </motion.div>

              {/* Department Performance */}
              <motion.div
                className={`glass-card ${styles.chartCard}`}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.45 }}
              >
                <h3 className={styles.chartTitle}>
                  <AlertTriangle size={16} /> Department Activity
                </h3>
                <div className={styles.deptPerfList}>
                  {deptPerformance.length === 0 ? (
                    <div style={{ padding: "40px 0", textAlign: "center", color: "var(--text-muted)", fontSize: "0.9rem" }}>
                      No department data available yet
                    </div>
                  ) : (
                    deptPerformance.map((dept, i) => {
                      const Icon = dept.icon;
                      const maxDept = Math.max(...deptPerformance.map((d) => d.total), 1);
                      const pct = Math.round((dept.total / maxDept) * 100);
                      return (
                        <div key={i} className={styles.deptPerfItem}>
                          <div className={styles.deptPerfIcon} style={{ background: `${dept.color}20`, color: dept.color }}>
                            <Icon size={18} />
                          </div>
                          <div className={styles.deptPerfInfo}>
                            <div className={styles.deptPerfName}>{dept.dept}</div>
                            <div className={styles.deptPerfMeta}>
                              {dept.total} incident{dept.total !== 1 ? "s" : ""} assigned
                            </div>
                            <div className={styles.deptPerfBar}>
                              <div
                                className={styles.deptPerfFill}
                                style={{ width: `${pct}%`, background: dept.color }}
                              />
                            </div>
                          </div>
                          <span className={styles.deptPerfPct} style={{ color: dept.color }}>
                            {dept.total}
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>
              </motion.div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
