import React from "react";
import Link from "next/link";
import { Flame, Shield, Heart, CloudLightning } from "lucide-react";
import { getAgencyBySlug } from "@/lib/agencyConfig";
import AgencyTabs from "./AgencyTabs";
import styles from "./layout.module.css";

const ICONS: Record<string, React.ElementType> = {
  Flame, Shield, Heart, CloudLightning,
};

export default async function AgencyLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ agency: string }>;
}) {
  const { agency: agencySlug } = await params;
  const agency = getAgencyBySlug(agencySlug);

  if (!agency) {
    return (
      <div style={{ padding: "120px 24px", textAlign: "center", color: "var(--text-muted)" }}>
        <h2>Agency not found</h2>
        <Link href="/agencies" style={{ color: "var(--accent-blue)" }}>← Back to Agencies</Link>
      </div>
    );
  }

  const Icon = ICONS[agency.icon];

  return (
    <div className={styles.wrapper}>
      {/* Agency Header Bar */}
      <div className={styles.agencyBar} style={{ borderBottomColor: `rgba(${agency.colorRgb}, 0.3)` }}>
        <div className={`container ${styles.agencyBarInner}`}>
          <Link href="/agencies" className={styles.backLink}>
            ← Agencies
          </Link>

          <div className={styles.agencyMeta}>
            <div
              className={styles.agencyIcon}
              style={{ background: `rgba(${agency.colorRgb}, 0.15)`, color: agency.color }}
            >
              <Icon size={20} />
            </div>
            <div>
              <div className={styles.agencyName} style={{ color: agency.color }}>
                {agency.label}
              </div>
              <div className={styles.agencyDesc}>{agency.description}</div>
            </div>
          </div>

          {/* Tabs (Client Component for active state detection) */}
          <AgencyTabs agency={agency} />
        </div>
      </div>

      {/* Page Content */}
      <div className={styles.pageContent}>{children}</div>
    </div>
  );
}
