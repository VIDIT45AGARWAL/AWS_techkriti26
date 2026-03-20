"use client";

import React from "react";
import { motion, useInView } from "framer-motion";
import { useRef } from "react";

interface AnimatedCounterProps {
  value: string;
  duration?: number;
  className?: string;
}

export function AnimatedCounter({ value, duration = 2, className }: AnimatedCounterProps) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-50px" });

  // Extract numeric part
  const numericMatch = value.match(/(\d+\.?\d*)/);
  const prefix = value.slice(0, value.indexOf(numericMatch?.[0] || ""));
  const suffix = value.slice((numericMatch?.index || 0) + (numericMatch?.[0]?.length || 0));
  const numValue = parseFloat(numericMatch?.[0] || "0");

  return (
    <span ref={ref} className={className}>
      {isInView ? (
        <motion.span
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          {prefix}
          <CountUp target={numValue} duration={duration} />
          {suffix}
        </motion.span>
      ) : (
        <span style={{ opacity: 0 }}>{value}</span>
      )}
    </span>
  );
}

function CountUp({ target, duration }: { target: number; duration: number }) {
  const [count, setCount] = React.useState(0);
  const isFloat = target % 1 !== 0;

  React.useEffect(() => {
    let start = 0;
    const startTime = Date.now();
    const endTime = startTime + duration * 1000;

    const tick = () => {
      const now = Date.now();
      const progress = Math.min((now - startTime) / (endTime - startTime), 1);
      const eased = 1 - Math.pow(1 - progress, 3); // easeOutCubic
      start = eased * target;
      setCount(start);

      if (progress < 1) {
        requestAnimationFrame(tick);
      }
    };

    requestAnimationFrame(tick);
  }, [target, duration]);

  return <>{isFloat ? count.toFixed(1) : Math.floor(count)}</>;
}

/* ─── Staggered Container ─── */
interface StaggerProps {
  children: React.ReactNode;
  delay?: number;
  staggerDelay?: number;
  className?: string;
}

export function StaggerContainer({ children, delay = 0, staggerDelay = 0.08, className }: StaggerProps) {
  return (
    <motion.div
      className={className}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-40px" }}
      transition={{ delayChildren: delay, staggerChildren: staggerDelay }}
      variants={{
        hidden: {},
        visible: {},
      }}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div
      className={className}
      variants={{
        hidden: { opacity: 0, y: 30, scale: 0.95 },
        visible: {
          opacity: 1,
          y: 0,
          scale: 1,
          transition: { duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] },
        },
      }}
    >
      {children}
    </motion.div>
  );
}

/* ─── Magnetic Hover ─── */
export function MagneticHover({ children, className, strength = 0.3 }: {
  children: React.ReactNode;
  className?: string;
  strength?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const x = (e.clientX - rect.left - rect.width / 2) * strength;
    const y = (e.clientY - rect.top - rect.height / 2) * strength;
    ref.current.style.transform = `translate(${x}px, ${y}px)`;
  };

  const handleMouseLeave = () => {
    if (!ref.current) return;
    ref.current.style.transform = "translate(0, 0)";
  };

  return (
    <div
      ref={ref}
      className={className}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{ transition: "transform 0.2s ease-out" }}
    >
      {children}
    </div>
  );
}

/* ─── Text Reveal ─── */
export function TextReveal({ text, className, delay = 0 }: {
  text: string;
  className?: string;
  delay?: number;
}) {
  const words = text.split(" ");

  return (
    <motion.span className={className}>
      {words.map((word, i) => (
        <motion.span
          key={i}
          style={{ display: "inline-block", marginRight: "0.3em" }}
          initial={{ opacity: 0, y: 20, rotateX: 90 }}
          whileInView={{ opacity: 1, y: 0, rotateX: 0 }}
          viewport={{ once: true }}
          transition={{
            duration: 0.4,
            delay: delay + i * 0.05,
            ease: [0.25, 0.46, 0.45, 0.94],
          }}
        >
          {word}
        </motion.span>
      ))}
    </motion.span>
  );
}

/* ─── Scroll Progress Bar ─── */
export function ScrollProgress() {
  const [progress, setProgress] = React.useState(0);

  React.useEffect(() => {
    const handleScroll = () => {
      const total = document.documentElement.scrollHeight - window.innerHeight;
      setProgress(total > 0 ? (window.scrollY / total) * 100 : 0);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <motion.div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        height: "3px",
        background: "linear-gradient(90deg, #ef4444, #f59e0b, #8b5cf6)",
        zIndex: 9999,
        width: `${progress}%`,
        transformOrigin: "left",
      }}
      initial={{ scaleX: 0 }}
      animate={{ scaleX: 1 }}
    />
  );
}

/* ─── Tilt Card ─── */
export function TiltCard({ children, className }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    ref.current.style.transform = `perspective(800px) rotateX(${-y * 6}deg) rotateY(${x * 6}deg) scale(1.02)`;
  };

  const handleMouseLeave = () => {
    if (!ref.current) return;
    ref.current.style.transform = "perspective(800px) rotateX(0) rotateY(0) scale(1)";
  };

  return (
    <div
      ref={ref}
      className={className}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{ transition: "transform 0.3s ease-out" }}
    >
      {children}
    </div>
  );
}
