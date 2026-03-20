"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  Mic,
  BarChart3,
  Menu,
  X,
  Siren,
  Flame,
  Shield,
  Heart,
  CloudLightning,
  Building2,
} from "lucide-react";
import styles from "./Navbar.module.css";

const isAgenciesPortal = process.env.NEXT_PUBLIC_PORTAL_MODE === "agencies";

// Icon component map
const AGENCY_ICONS: Record<string, React.ElementType> = {
  fire: Flame,
  police: Shield,
  medical: Heart,
  disaster: CloudLightning,
};

const AGENCY_COLORS: Record<string, string> = {
  fire: "#ef4444",
  police: "#3b82f6",
  medical: "#10b981",
  disaster: "#f59e0b",
};

const AGENCY_LABELS: Record<string, string> = {
  fire: "Fire Dept",
  police: "Police",
  medical: "Medical",
  disaster: "Disaster",
};

// Main app nav links
const mainNavLinks = [
  { href: "/", label: "Home & Report", icon: Mic },
];

// Agencies portal nav links
const agencyNavLinks = [
  { href: "/agencies/fire/dashboard", label: "Fire Dept", icon: Flame, color: "#ef4444" },
  { href: "/agencies/police/dashboard", label: "Police", icon: Shield, color: "#3b82f6" },
  { href: "/agencies/medical/dashboard", label: "Medical", icon: Heart, color: "#10b981" },
  { href: "/agencies/disaster/dashboard", label: "Disaster", icon: CloudLightning, color: "#f59e0b" },
];

export default function Navbar() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  if (isAgenciesPortal) {
    // ── AGENCIES PORTAL NAVBAR ──────────────────────────────────────────
    return (
      <motion.nav
        className={`${styles.navbar} ${scrolled ? styles.scrolled : ""} ${styles.agenciesNav}`}
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
      >
        <div className={styles.inner}>
          {/* Logo */}
          <Link href="/" className={styles.logo}>
            <div className={styles.logoIcon}>
              <Siren size={22} />
            </div>
            <span className={styles.logoText}>
              Agency<span className={styles.logoAccent}>Portal</span>
            </span>
          </Link>

          {/* Agency Links */}
          <div className={styles.agencyLinks}>
            {agencyNavLinks.map((link) => {
              const Icon = link.icon;
              const isActive = pathname.includes(`/agencies/${link.href.split("/")[2]}`);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`${styles.agencyNavLink} ${isActive ? styles.agencyNavActive : ""}`}
                  style={isActive ? { color: link.color, borderColor: link.color } : undefined}
                >
                  <div
                    className={styles.agencyNavIcon}
                    style={{
                      background: `${link.color}18`,
                      color: isActive ? link.color : undefined,
                    }}
                  >
                    <Icon size={16} />
                  </div>
                  <span>{link.label}</span>
                  {isActive && (
                    <motion.div
                      className={styles.activeBar}
                      layoutId="navbar-indicator"
                      style={{ background: link.color }}
                      transition={{ type: "spring", stiffness: 350, damping: 30 }}
                    />
                  )}
                </Link>
              );
            })}
          </div>

          {/* Mobile toggle */}
          <button
            className={styles.mobileToggle}
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {/* Mobile Menu */}
        <AnimatePresence>
          {mobileOpen && (
            <motion.div
              className={styles.mobileMenu}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3 }}
            >
              {agencyNavLinks.map((link) => {
                const Icon = link.icon;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={styles.mobileLink}
                    onClick={() => setMobileOpen(false)}
                    style={{ color: link.color }}
                  >
                    <Icon size={18} />
                    <span>{link.label}</span>
                  </Link>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.nav>
    );
  }

  // ── MAIN APP NAVBAR ────────────────────────────────────────────────────
  return (
    <motion.nav
      className={`${styles.navbar} ${scrolled ? styles.scrolled : ""}`}
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
    >
      <div className={styles.inner}>
        <Link href="/" className={styles.logo}>
          <div className={styles.logoIcon}>
            <Siren size={22} />
          </div>
          <span className={styles.logoText}>
            Civic<span className={styles.logoAccent}>Alert</span>
          </span>
        </Link>

        {/* Desktop Nav */}
        <div className={styles.desktopLinks}>
          {mainNavLinks.map((link) => {
            const isActive = link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
            const Icon = link.icon;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`${styles.navLink} ${isActive ? styles.active : ""}`}
              >
                <Icon size={16} />
                <span>{link.label}</span>
                {isActive && (
                  <motion.div
                    className={styles.activeBar}
                    layoutId="navbar-indicator"
                    transition={{ type: "spring", stiffness: 350, damping: 30 }}
                  />
                )}
              </Link>
            );
          })}
        </div>

        {/* Emergency CTA */}
        <Link href="/#report" className={styles.emergencyCta}>
          <span className={styles.ctaPulse} />
          <Mic size={16} />
          <span>Report Emergency</span>
        </Link>

        {/* Mobile toggle */}
        <button
          className={styles.mobileToggle}
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Toggle menu"
        >
          {mobileOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            className={styles.mobileMenu}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
          >
            {mainNavLinks.map((link) => {
              const Icon = link.icon;
              const isActive = link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`${styles.mobileLink} ${isActive ? styles.active : ""}`}
                  onClick={() => setMobileOpen(false)}
                >
                  <Icon size={18} />
                  <span>{link.label}</span>
                </Link>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.nav>
  );
}
