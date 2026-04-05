"use client";

import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { cn } from "../../lib/cn";
import { useCountUp } from "../../hooks/useCountUp";
import { Card } from "../ui/card";

type Props = {
  label: string;
  value: number;
  suffix?: string;
  trendLabel: string;
  trendValue: number;
  accent: "blue" | "green" | "amber" | "teal";
  icon: ReactNode;
};

export function StatCard({ label, value, suffix, trendLabel, trendValue, accent, icon }: Props) {
  const positive = trendValue >= 0;
  const animatedValue = useCountUp(value);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -3 }}
      transition={{ type: "spring", stiffness: 300, damping: 26 }}
    >
      <Card accent={accent} className="stat-card card-glow">
        <div className="stat-card-head">
          <span className={cn("stat-icon-wrap", `stat-icon-${accent}`)}>{icon}</span>
        </div>
        <div className="stat-card-value" style={positive ? { color: "var(--accent-cyan)" } : undefined}>
          {animatedValue.toLocaleString("en-IN")}
          {suffix ? <span>{suffix}</span> : null}
        </div>
        <p className="stat-card-label">{label}</p>
        <div
          className={cn("trend-chip", positive ? "trend-up" : "trend-down")}
          style={{ color: positive ? "var(--accent-cyan)" : "var(--accent-pink)" }}
        >
          {positive ? <ArrowUpRight size={14} aria-hidden /> : <ArrowDownRight size={14} aria-hidden />}
          <span>{trendLabel}</span>
        </div>
      </Card>
    </motion.div>
  );
}
