"use client";

import type { ReactNode } from "react";

export type PulseTab = { id: string; label: string };

type PulseTabsProps = {
  tabs: PulseTab[];
  active: string;
  onChange: (id: string) => void;
  className?: string;
};

export function PulseTabs({ tabs, active, onChange, className = "" }: PulseTabsProps) {
  return (
    <div
      role="tablist"
      aria-label="Section"
      className={`flex flex-wrap gap-1 rounded-2xl border border-subtle bg-depth/80 p-1 ${className}`}
    >
      {tabs.map((t) => {
        const isOn = t.id === active;
        return (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={isOn}
            className={`rounded-xl px-3 py-2 text-xs font-bold transition-colors ${
              isOn ? "bg-mango-500/20 text-mango-400 shadow-inner" : "text-muted hover:text-ink"
            }`}
            onClick={() => onChange(t.id)}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

export function PulseTabPanel({
  id,
  active,
  children,
  className = ""
}: {
  id: string;
  active: string;
  children: ReactNode;
  className?: string;
}) {
  if (id !== active) return null;
  return (
    <div role="tabpanel" className={className}>
      {children}
    </div>
  );
}
