"use client";

import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { cn } from "../../lib/cn";
import { Card } from "../ui/card";

type Props = {
  label: string;
  /** Animated count from `useCountUp` in the parent (dashboard). */
  value: number;
  suffix?: string;
  trendLabel: string;
  trendValue: number;
  accent: "blue" | "green" | "amber" | "teal";
  icon: React.ReactNode;
};

export function StatCard({ label, value, suffix, trendLabel, trendValue, accent, icon }: Props) {
  const positive = trendValue >= 0;

  return (
    <Card accent={accent} className="stat-card">
      <div className="stat-card-head">
        <span className={cn("stat-icon-wrap", `stat-icon-${accent}`)}>{icon}</span>
      </div>
      <div className="stat-card-value">
        {value.toLocaleString("en-IN")}
        {suffix ? <span>{suffix}</span> : null}
      </div>
      <p className="stat-card-label">{label}</p>
      <div className={cn("trend-chip", positive ? "trend-up" : "trend-down")}>
        {positive ? <ArrowUpRight size={14} aria-hidden /> : <ArrowDownRight size={14} aria-hidden />}
        <span>{trendLabel}</span>
      </div>
    </Card>
  );
}
