"use client";

import React, { useEffect, useState } from "react";

import { SiteFooter } from "@/components/site-footer";
import { AnalyticsView, type AnalyticsData } from "@/components/analytics-view";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function AnalyticsPage() {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    async function fetchAnalytics() {
      try {
        const res = await fetch(`${API_BASE}/api/analytics`);
        if (!res.ok) throw new Error(`API returned ${res.status}`);
        const data = await res.json();
        if (alive) {
          setAnalytics(data);
          setError(null);
        }
      } catch (err) {
        console.warn("Failed to fetch analytics:", err);
        if (alive) setError("Analytics are unreachable right now.");
      } finally {
        if (alive) setLoading(false);
      }
    }

    fetchAnalytics();
    const interval = setInterval(fetchAnalytics, 30000);
    return () => {
      alive = false;
      clearInterval(interval);
    };
  }, []);

  return (
    <div className="flex w-full flex-1 flex-col">
      <main className="mx-auto flex w-full max-w-[44rem] flex-1 flex-col px-4 pb-16 pt-2 sm:px-6 lg:px-10 xl:px-14">
        <header>
          <h1 className="text-pretty font-display text-[2.4rem] font-normal leading-[1.15] tracking-[-0.03em]">
            Analytics
          </h1>
          <p className="mt-3 max-w-[32rem] text-pretty text-[14px] leading-6 text-muted">
            Every filed report, aggregated by kind, severity, desk, and area.
          </p>
        </header>

        {loading ? (
          <p className="mt-10 text-[13px] text-muted">Crunching the log…</p>
        ) : error ? (
          <p className="mt-10 flex items-center gap-2 text-[13px] text-critical">
            <span className="size-[7px] shrink-0 rounded-full bg-critical" />
            {error}
          </p>
        ) : analytics ? (
          <AnalyticsView data={analytics} />
        ) : null}
      </main>

      <SiteFooter apiNote="Aggregated live from the incidents table." />
    </div>
  );
}
