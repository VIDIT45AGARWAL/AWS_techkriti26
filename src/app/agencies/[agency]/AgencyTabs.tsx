"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { LayoutDashboard, BarChart3 } from "lucide-react";
import type { AgencyConfig } from "@/lib/agencyConfig";
import styles from "./layout.module.css";

export default function AgencyTabs({ agency }: { agency: AgencyConfig }) {
  const pathname = usePathname();

  const tabs = [
    { href: `/agencies/${agency.slug}/dashboard`, label: "Dashboard", icon: LayoutDashboard },
    { href: `/agencies/${agency.slug}/analytics`, label: "Analytics", icon: BarChart3 },
  ];

  return (
    <div className={styles.tabs}>
      {tabs.map((tab) => {
        const TabIcon = tab.icon;
        const isActive = pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`${styles.tab} ${isActive ? styles.tabActive : ""}`}
            style={isActive ? { color: agency.color, borderColor: agency.color } : undefined}
          >
            <TabIcon size={15} />
            <span>{tab.label}</span>
            {isActive && (
              <motion.div
                className={styles.tabBar}
                layoutId="agency-tab-indicator"
                style={{ background: agency.color }}
                transition={{ type: "spring", stiffness: 350, damping: 30 }}
              />
            )}
          </Link>
        );
      })}
    </div>
  );
}
