"use client";

import { motion, useReducedMotion } from "motion/react";

const STAGGER = 0.05;

export function DashboardStagger({ children, className }) {
  const reduceMotion = useReducedMotion();

  if (reduceMotion) {
    return className ? <div className={className}>{children}</div> : children;
  }

  return (
    <motion.div
      className={className}
      initial="hidden"
      animate="visible"
      variants={{
        hidden: {},
        visible: {
          transition: { staggerChildren: STAGGER },
        },
      }}
    >
      {children}
    </motion.div>
  );
}

export function DashboardStaggerItem({ children, className }) {
  const reduceMotion = useReducedMotion();

  if (reduceMotion) {
    return className ? <div className={className}>{children}</div> : children;
  }

  return (
    <motion.div
      className={className}
      variants={{
        hidden: { opacity: 0, y: 10 },
        visible: {
          opacity: 1,
          y: 0,
          transition: { duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] },
        },
      }}
    >
      {children}
    </motion.div>
  );
}

export function DashboardChartMotion({ children, className }) {
  const reduceMotion = useReducedMotion();

  if (reduceMotion) {
    return className ? <div className={className}>{children}</div> : children;
  }

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}

export const CHART_ANIMATION = {
  isAnimationActive: true,
  animationDuration: 800,
  animationEasing: "ease-out",
};

export const GRID_STROKE = "var(--border, #dce8c8)";

export const CHART_TOOLTIP_STYLE = {
  contentStyle: {
    borderRadius: "0.5rem",
    border: "1px solid var(--border, #dce8c8)",
    background: "var(--card, #ffffff)",
    color: "var(--foreground, #1f2937)",
    fontSize: "12px",
    boxShadow: "0 4px 12px rgba(0, 65, 26, 0.08)",
  },
  labelStyle: { color: "var(--muted-foreground, #475569)", fontWeight: 600 },
};
