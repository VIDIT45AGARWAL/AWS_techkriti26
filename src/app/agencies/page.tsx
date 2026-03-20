"use client";

import React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Flame, Shield, Heart, CloudLightning, ArrowRight, Siren } from "lucide-react";
import { AGENCIES } from "@/lib/agencyConfig";
import styles from "./agencies.module.css";

const ICONS: Record<string, React.ElementType> = {
  Flame,
  Shield,
  Heart,
  CloudLightning,
};

export default function AgenciesPage() {
  return (
    <div className={styles.page}>
      <div className={`container ${styles.content}`}>
        {/* Header */}
        <motion.div
          className={styles.header}
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className={styles.headerIcon}>
            <Siren size={32} />
          </div>
          <h1 className={styles.title}>Agency Portals</h1>
          <p className={styles.subtitle}>
            Select your emergency agency to access your dedicated dashboard and analytics,
            filtered to show only incidents assigned to your department.
          </p>
        </motion.div>

        {/* Agency Cards Grid */}
        <div className={styles.grid}>
          {AGENCIES.map((agency, i) => {
            const Icon = ICONS[agency.icon];
            return (
              <motion.div
                key={agency.slug}
                initial={{ opacity: 0, y: 30, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ delay: i * 0.1, duration: 0.5, type: "spring", stiffness: 180, damping: 18 }}
                whileHover={{ y: -6, scale: 1.02 }}
              >
                <Link href={`/agencies/${agency.slug}/dashboard`} className={styles.card}>
                  <div
                    className={styles.cardGlow}
                    style={{ background: agency.gradient, opacity: 0.15 }}
                  />
                  <div
                    className={styles.cardIcon}
                    style={{ background: `rgba(${agency.colorRgb}, 0.15)`, color: agency.color }}
                  >
                    <Icon size={36} />
                  </div>
                  <div className={styles.cardBody}>
                    <h2 className={styles.cardTitle} style={{ color: agency.color }}>
                      {agency.label}
                    </h2>
                    <p className={styles.cardDesc}>{agency.description}</p>
                    <div className={styles.cardTags}>
                      {agency.incidentTypes.slice(0, 3).map((t) => (
                        <span
                          key={t}
                          className={styles.tag}
                          style={{
                            background: `rgba(${agency.colorRgb}, 0.12)`,
                            color: agency.color,
                            borderColor: `rgba(${agency.colorRgb}, 0.25)`,
                          }}
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className={styles.cardArrow} style={{ color: agency.color }}>
                    <ArrowRight size={20} />
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
