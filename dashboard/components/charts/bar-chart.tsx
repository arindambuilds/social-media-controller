"use client";

import { useMemo, useState } from "react";

export type BarChartItem = {
  label: string;
  value: number;
};

/**
 * CSS-only message volume chart (no canvas/SVG chart API).
 * Bars: percentage height vs max; spring stagger on mount; hover tooltip.
 */
export function BarChart({ items }: { items: BarChartItem[] }) {
  const max = useMemo(() => Math.max(...items.map((item) => item.value), 1), [items]);
  const [hovered, setHovered] = useState<number | null>(null);
  const bars = items.slice(0, 6);

  return (
    <div className="pulse-bar-chart-root">
      <h3 className="pulse-bar-chart-heading">Message Volume — Last 6 Months</h3>
      <div className="pulse-bar-chart-row" role="img" aria-label="Message volume by month">
        {bars.map((item, index) => {
          const pct = max > 0 ? (item.value / max) * 100 : 0;
          return (
            <div key={`${item.label}-${index}`} className="pulse-bar-chart-col">
              <span className="pulse-bar-chart-count">{item.value.toLocaleString("en-IN")}</span>
              <div
                className="pulse-bar-chart-track"
                onMouseEnter={() => setHovered(index)}
                onMouseLeave={() => setHovered(null)}
              >
                <div className="pulse-bar-chart-fill-outer">
                  <div
                    className="pulse-bar-chart-fill"
                    style={{ height: `${pct}%`, animationDelay: `calc(${index} * 80ms)` }}
                    role="presentation"
                  />
                </div>
                {hovered === index ? (
                  <div className="pulse-bar-chart-tooltip" role="tooltip">
                    {item.value.toLocaleString("en-IN")} messages
                  </div>
                ) : null}
              </div>
              <span className="pulse-bar-chart-month">{item.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
