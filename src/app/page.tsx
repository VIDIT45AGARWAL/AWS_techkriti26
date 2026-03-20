"use client";

import React from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import {
  Mic,
  Brain,
  Bell,
  MapPin,
  Languages,
  Clock,
  Shield,
  ArrowRight,
  Zap,
  Users,
  Radio,
} from "lucide-react";
import ParticleField from "@/components/ParticleField";
import {
  AnimatedCounter,
  StaggerContainer,
  StaggerItem,
  TextReveal,
  ScrollProgress,
  TiltCard,
  MagneticHover,
} from "@/components/AnimationHelpers";
import ReportPage from "@/app/report/page";
import styles from "./page.module.css";

const features = [
  {
    icon: Mic,
    title: "One-Button Voice Input",
    description:
      "Press once, speak naturally in any Indian language. No forms, no menus, no decisions.",
    color: "red",
  },
  {
    icon: Brain,
    title: "AI Triage Engine",
    description:
      "Amazon Bedrock extracts location, severity, hazard type, and casualties in real-time.",
    color: "purple",
  },
  {
    icon: Bell,
    title: "Multi-Department Dispatch",
    description:
      "SNS dispatches structured alerts to Police, Fire, Medical & Disaster simultaneously.",
    color: "amber",
  },
  {
    icon: MapPin,
    title: "Automatic GPS Tagging",
    description:
      "Precise location via GPS and AWS Location Service reverse geocoding — no address needed.",
    color: "green",
  },
  {
    icon: Languages,
    title: "Multilingual Support",
    description:
      "Native support for Hindi, Tamil, Telugu, Bengali, Marathi and English via Amazon Transcribe.",
    color: "blue",
  },
  {
    icon: Clock,
    title: "Under 10 Seconds",
    description:
      "From voice input to department notification — 10x faster than traditional 112 dispatching.",
    color: "cyan",
  },
];

const stats = [
  { value: "<10s", label: "Dispatch Time", icon: Zap, numericValue: "10" },
  { value: "6+", label: "Languages", icon: Languages, numericValue: "6" },
  { value: "4", label: "Departments", icon: Users, numericValue: "4" },
  { value: "24/7", label: "Always Active", icon: Radio, numericValue: "24" },
];

export default function HomePage() {
  const { scrollYProgress } = useScroll();
  const heroOpacity = useTransform(scrollYProgress, [0, 0.15], [1, 0]);
  const heroScale = useTransform(scrollYProgress, [0, 0.15], [1, 0.95]);

  return (
    <div className={styles.page}>
      <ScrollProgress />
      <ParticleField count={60} speed={0.2} connectionDistance={100} />

      {/* ─── HERO ─── */}
      <motion.section
        className={styles.hero}
        style={{ opacity: heroOpacity, scale: heroScale }}
      >
        <div className={styles.heroBg}>
          <div className={styles.heroGlow1} />
          <div className={styles.heroGlow2} />
          <div className={styles.heroGlow3} />
          <div className={styles.heroGrid} />
          <div className={styles.heroScanLine} />
        </div>

        <div className={`container ${styles.heroContent}`}>
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, ease: [0.25, 0.46, 0.45, 0.94] }}
            className={styles.heroText}
          >
            <motion.div
              className={styles.heroBadge}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3, type: "spring", stiffness: 200 }}
              whileHover={{ scale: 1.05 }}
            >
              <motion.div
                animate={{ rotate: [0, 10, -10, 0] }}
                transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
              >
                <Shield size={14} />
              </motion.div>
              <span>AI-Powered Emergency Response</span>
            </motion.div>

            <h1 className={styles.heroTitle}>
              <TextReveal text="Speak What You See." delay={0.4} />
              <br />
              <span className={styles.heroGradient}>
                <TextReveal text="We Handle the Rest." delay={0.7} />
              </span>
            </h1>

            <motion.p
              className={styles.heroSubtitle}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.2, duration: 0.6 }}
            >
              CivicAlert is India&apos;s first voice-first emergency reporting system.
              Press one button, describe the emergency in any language — our AI
              triages, classifies, and dispatches to the right departments in
              under 10 seconds.
            </motion.p>

            <motion.div
              className={styles.heroCtas}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.5, duration: 0.6 }}
            >
              <MagneticHover strength={0.2}>
                <a href="#report" className="btn-primary">
                  <motion.span
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ repeat: Infinity, duration: 2 }}
                    style={{ display: "flex" }}
                  >
                    <Mic size={18} />
                  </motion.span>
                  Report Emergency
                  <motion.span
                    animate={{ x: [0, 5, 0] }}
                    transition={{ repeat: Infinity, duration: 1.5 }}
                    style={{ display: "flex" }}
                  >
                    <ArrowRight size={16} />
                  </motion.span>
                </a>
              </MagneticHover>

            </motion.div>
          </motion.div>

          <motion.div
            className={styles.heroVisual}
            initial={{ opacity: 0, scale: 0.7, rotateY: 15 }}
            animate={{ opacity: 1, scale: 1, rotateY: 0 }}
            transition={{ duration: 1, delay: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
          >
            {/* Orbiting rings around phone */}
            <div className={styles.orbitContainer}>
              <motion.div
                className={styles.orbitRing}
                animate={{ rotate: 360 }}
                transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
              >
                <div className={styles.orbitDot} style={{ background: "var(--accent-red)" }} />
              </motion.div>
              <motion.div
                className={`${styles.orbitRing} ${styles.orbitRing2}`}
                animate={{ rotate: -360 }}
                transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
              >
                <div className={styles.orbitDot} style={{ background: "var(--accent-blue)" }} />
              </motion.div>
            </div>

            <div className={styles.phoneFrame}>
              <div className={styles.phoneScreen}>
                <div className={styles.phoneHeader}>
                  <div className={styles.phoneStatusBar}>
                    <span>CivicAlert</span>
                    <span>●●●●</span>
                  </div>
                </div>
                <div className={styles.phoneMicArea}>
                  <motion.div
                    className={styles.phoneMicBtn}
                    animate={{ scale: [1, 1.05, 1] }}
                    transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
                  >
                    <div className={styles.phoneMicRing} />
                    <div className={styles.phoneMicRing2} />
                    <Mic size={32} />
                  </motion.div>
                  <p className={styles.phoneMicText}>Tap to Report</p>
                </div>
                <div className={styles.phoneWave}>
                  {[...Array(20)].map((_, i) => (
                    <motion.div
                      key={i}
                      className={styles.waveBar}
                      animate={{
                        height: [8, Math.random() * 30 + 10, 8],
                        opacity: [0.3, 0.8, 0.3],
                      }}
                      transition={{
                        repeat: Infinity,
                        duration: 1 + Math.random(),
                        delay: i * 0.05,
                        ease: "easeInOut",
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Scroll indicator */}
        <motion.div
          className={styles.scrollIndicator}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 2 }}
        >
          <motion.div
            animate={{ y: [0, 8, 0] }}
            transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
            className={styles.scrollDot}
          />
        </motion.div>
      </motion.section>

      {/* ─── STATS ─── */}
      <section className={styles.statsSection}>
        <div className="container">
          <StaggerContainer className={styles.statsGrid} staggerDelay={0.1}>
            {stats.map((stat, i) => {
              const Icon = stat.icon;
              return (
                <StaggerItem key={i}>
                  <TiltCard className={`glass-card ${styles.statCard}`}>
                    <motion.div
                      whileHover={{ scale: 1.2, rotate: 10 }}
                      transition={{ type: "spring", stiffness: 300 }}
                    >
                      <Icon size={24} className={styles.statIcon} />
                    </motion.div>
                    <div className={styles.statValue}>
                      <AnimatedCounter value={stat.value} duration={2} />
                    </div>
                    <div className={styles.statLabel}>{stat.label}</div>
                  </TiltCard>
                </StaggerItem>
              );
            })}
          </StaggerContainer>
        </div>
      </section>

      {/* ─── HOW IT WORKS ─── */}
      <section className={`section ${styles.howSection}`}>
        <div className="container">
          <motion.div
            className={styles.sectionHeader}
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <motion.span
              className={styles.sectionTag}
              whileHover={{ scale: 1.05 }}
            >
              How It Works
            </motion.span>
            <h2 className={styles.sectionTitle}>
              <TextReveal text="Three Steps. Zero Confusion." />
            </h2>
            <p className={styles.sectionDesc}>
              From panic to dispatch in seconds — no forms, no call routing, no
              delays.
            </p>
          </motion.div>

          {/* Connection line between steps */}
          <div className={styles.stepsContainer}>
            <div className={styles.connectionLine}>
              <motion.div
                className={styles.connectionProgress}
                initial={{ scaleX: 0 }}
                whileInView={{ scaleX: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 1.5, delay: 0.5, ease: "easeOut" }}
              />
            </div>
            <div className={styles.stepsGrid}>
              {[
                {
                  step: "01",
                  title: "Press & Speak",
                  desc: "Hit the mic button and describe what you see — in Hindi, English, Tamil, or any supported language.",
                  icon: Mic,
                  color: "var(--accent-red)",
                },
                {
                  step: "02",
                  title: "AI Analyzes",
                  desc: "Amazon Bedrock extracts critical details: location, severity, incident type, casualties — instantly.",
                  icon: Brain,
                  color: "var(--accent-purple)",
                },
                {
                  step: "03",
                  title: "Departments Notified",
                  desc: "Structured, pre-filled reports dispatched simultaneously to all relevant departments via SNS.",
                  icon: Bell,
                  color: "var(--accent-amber)",
                },
              ].map((item, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 50, scale: 0.9 }}
                  whileInView={{ opacity: 1, y: 0, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{
                    duration: 0.6,
                    delay: i * 0.2,
                    ease: [0.25, 0.46, 0.45, 0.94],
                  }}
                >
                  <TiltCard className={`glass-card ${styles.stepCard}`}>
                    <motion.div
                      className={styles.stepNum}
                      style={{ color: item.color }}
                      initial={{ opacity: 0, scale: 0 }}
                      whileInView={{ opacity: 0.3, scale: 1 }}
                      viewport={{ once: true }}
                      transition={{ delay: 0.3 + i * 0.2, type: "spring" }}
                    >
                      {item.step}
                    </motion.div>
                    <motion.div
                      className={styles.stepIcon}
                      style={{
                        background: `${item.color}20`,
                        color: item.color,
                      }}
                      whileHover={{
                        scale: 1.15,
                        rotate: [0, -5, 5, 0],
                        transition: { duration: 0.4 },
                      }}
                    >
                      <item.icon size={28} />
                    </motion.div>
                    <h3 className={styles.stepTitle}>{item.title}</h3>
                    <p className={styles.stepDesc}>{item.desc}</p>
                  </TiltCard>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ─── FEATURES ─── */}
      <section className={`section ${styles.featuresSection}`}>
        <div className="container">
          <motion.div
            className={styles.sectionHeader}
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <span className={styles.sectionTag}>Key Features</span>
            <h2 className={styles.sectionTitle}>
              <TextReveal text="Built for Speed. Designed for Chaos." />
            </h2>
            <p className={styles.sectionDesc}>
              Every feature is optimized for the worst-case scenario — when
              seconds matter most.
            </p>
          </motion.div>

          <StaggerContainer className={styles.featuresGrid} staggerDelay={0.08}>
            {features.map((feature, i) => {
              const Icon = feature.icon;
              return (
                <StaggerItem key={i}>
                  <TiltCard className={`glass-card ${styles.featureCard}`}>
                    <motion.div
                      className={styles.featureIcon}
                      style={{
                        background: `var(--accent-${feature.color})20`,
                        color: `var(--accent-${feature.color})`,
                      }}
                      whileHover={{
                        scale: 1.2,
                        rotate: 10,
                        boxShadow: `0 0 30px var(--accent-${feature.color}-glow, rgba(255,255,255,0.1))`,
                      }}
                      transition={{ type: "spring", stiffness: 300 }}
                    >
                      <Icon size={24} />
                    </motion.div>
                    <h3 className={styles.featureTitle}>{feature.title}</h3>
                    <p className={styles.featureDesc}>{feature.description}</p>
                  </TiltCard>
                </StaggerItem>
              );
            })}
          </StaggerContainer>
        </div>
      </section>

      {/* ─── CTA ─── */}
      <section className={styles.ctaSection}>
        <div className="container">
          <motion.div
            className={styles.ctaCard}
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, ease: [0.25, 0.46, 0.45, 0.94] }}
          >
            <div className={styles.ctaGlow} />
            <motion.div
              className={styles.ctaOrb1}
              animate={{
                x: [0, 30, -20, 0],
                y: [0, -20, 30, 0],
                scale: [1, 1.2, 0.9, 1],
              }}
              transition={{ duration: 8, repeat: Infinity }}
            />
            <motion.div
              className={styles.ctaOrb2}
              animate={{
                x: [0, -30, 20, 0],
                y: [0, 20, -30, 0],
                scale: [1, 0.9, 1.2, 1],
              }}
              transition={{ duration: 10, repeat: Infinity }}
            />
            <h2 className={styles.ctaTitle}>
              Every Second Counts.
              <br />
              <span className={styles.heroGradient}>Start Reporting Now.</span>
            </h2>
            <p className={styles.ctaDesc}>
              Join the movement to make emergency response faster, smarter, and
              more accessible across India.
            </p>
            <MagneticHover strength={0.2}>
              <a href="#report" className="btn-primary">
                <Mic size={18} />
                Report Emergency
                <ArrowRight size={16} />
              </a>
            </MagneticHover>
          </motion.div>
        </div>
      </section>

      {/* ─── REPORT (embedded) ─── */}
      <section id="report" style={{ scrollMarginTop: "80px" }}>
        <ReportPage />
      </section>

      {/* ─── FOOTER ─── */}
      <footer className={styles.footer}>
        <div className="container">
          <motion.div
            className={styles.footerContent}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <div className={styles.footerBrand}>
              <div className={styles.footerLogo}>
                <motion.div
                  className={styles.footerLogoIcon}
                  whileHover={{ rotate: 360 }}
                  transition={{ duration: 0.5 }}
                >
                  <Shield size={18} />
                </motion.div>
                <span>
                  Civic<span style={{ color: "var(--accent-red)" }}>Alert</span>
                </span>
              </div>
              <p className={styles.footerDesc}>
                AI-powered emergency response for India. Built by Team
                Segionpex.
              </p>
            </div>
            <div className={styles.footerMeta}>
              <p>AWS Builder Center • Techkriti 2026</p>
              <p>@jabhaskript · @geng4r · @blackadder45</p>
            </div>
          </motion.div>
        </div>
      </footer>
    </div>
  );
}
