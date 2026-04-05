"use client";

import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { Card } from "../ui/card";
import { CircuitBg } from "../ui/circuit-bg";
import { Skeleton } from "../ui/skeleton";

type HeroInsightProps = {
  icon: ReactNode;
  title: string;
  description: string;
  metric: string;
  metricLabel: string;
  badge?: ReactNode;
  loading?: boolean;
};

export function HeroInsight({ icon, title, description, metric, metricLabel, badge, loading = false }: HeroInsightProps) {
  if (loading) {
    return (
      <Card className="section-card">
        <div className="grid gap-4 md:grid-cols-[72px_minmax(0,1fr)_auto] md:items-center">
          <Skeleton className="h-[72px] w-[72px] rounded-[20px]" />
          <div className="space-y-3">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-8 w-full max-w-xl" />
            <Skeleton className="h-4 w-full max-w-md" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-10 w-24" />
            <Skeleton className="h-4 w-20" />
          </div>
        </div>
      </Card>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: [0, 0, 0.2, 1] }}
    >
      <Card className="section-card relative overflow-hidden">
        <CircuitBg className="opacity-40" />
        <div className="relative grid gap-5 md:grid-cols-[72px_minmax(0,1fr)_auto] md:items-center">
          {/* The icon gets its own glow circle so the hero reads as the page's single focal point. */}
          <div
            aria-hidden
            style={{
              display: "grid",
              placeItems: "center",
              width: 72,
              height: 72,
              borderRadius: 20,
              background: "radial-gradient(circle at 30% 30%, rgba(0,229,255,0.24), rgba(139,92,246,0.18) 60%, rgba(13,11,31,0.9) 100%)",
              border: "1px solid rgba(0,229,255,0.2)",
              boxShadow: "0 0 24px rgba(0,229,255,0.16)"
            }}
          >
            <div style={{ color: "var(--accent-cyan)" }}>{icon}</div>
          </div>
          <div style={{ minWidth: 0 }}>
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="gradient-text" style={{ margin: 0, fontSize: "clamp(1.35rem, 2.6vw, 2rem)", fontWeight: 700 }}>
                {title}
              </h2>
              {badge}
            </div>
            <p
              style={{
                margin: "10px 0 0",
                color: "var(--text-secondary)",
                fontSize: "0.95rem",
                lineHeight: 1.7,
                maxWidth: "56ch"
              }}
            >
              {description}
            </p>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ color: "var(--accent-cyan)", fontFamily: "var(--font-display)", fontSize: "2rem", fontWeight: 800, lineHeight: 1 }}>
              {metric}
            </div>
            <div style={{ marginTop: 8, color: "var(--text-muted)", fontSize: "0.78rem", letterSpacing: "0.08em", textTransform: "uppercase" }}>
              {metricLabel}
            </div>
          </div>
        </div>
        <div
          aria-hidden
          style={{
            height: 2,
            marginTop: 20,
            borderRadius: 999,
            background: "linear-gradient(90deg, var(--accent-cyan), var(--accent-purple))"
          }}
        />
      </Card>
    </motion.div>
  );
}
