'use client';

import { useEffect, useState } from "react";
import { apiFetch } from "../../lib/api";

interface HourSlot {
  hour: number;
  avgEngagementRate: number;
  postCount: number;
}

const HOUR_LABELS = Array.from({ length: 24 }, (_, i) =>
  i === 0 ? "12am" : i < 12 ? `${i}am` : i === 12 ? "12pm" : `${i - 12}pm`
);

function toColor(intensity: number): string {
  if (intensity <= 0) return "rgba(255,255,255,0.05)";
  const alpha = 0.12 + intensity * 0.78;
  const hue = Math.round(190 - intensity * 120); // 190 cyan → 70 yellow
  return `hsla(${hue},85%,60%,${alpha})`;
}

export function EngagementHeatStrip({ clientId }: { clientId: string | null }) {
  const [slots, setSlots] = useState<HourSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [hovered, setHovered] = useState<HourSlot | null>(null);

  useEffect(() => {
    if (!clientId) return;
    void (async () => {
      try {
        const d = await apiFetch<{ hours: HourSlot[] }>(
          `/analytics/${encodeURIComponent(clientId)}/insights/hourly`
        );
        setSlots(d.hours ?? []);
      } catch {
        setSlots([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [clientId]);

  if (!clientId) return null;

  if (loading) {
    return (
      <div className="flex h-12 items-center gap-0.5">
        {Array.from({ length: 24 }).map((_, i) => (
          <div key={i} className="h-8 flex-1 animate-pulse rounded bg-white/5" />
        ))}
      </div>
    );
  }

  const maxRate = Math.max(...slots.map((s) => s.avgEngagementRate ?? 0), 0.01);
  const filled: HourSlot[] = Array.from({ length: 24 }, (_, h) =>
    slots.find((s) => s.hour === h) ?? { hour: h, avgEngagementRate: 0, postCount: 0 }
  );

  return (
    <div className="space-y-2">
      <p className="text-xs uppercase tracking-widest text-white/50">
        Find your best posting hours
      </p>

      <div className="flex h-10 items-end gap-0.5">
        {filled.map((slot) => {
          const intensity = slot.avgEngagementRate / maxRate;
          const barH = Math.max(intensity * 100, 8);
          return (
            <div
              key={slot.hour}
              className="flex-1 cursor-pointer rounded-sm transition-all hover:scale-110"
              style={{ height: `${barH}%`, backgroundColor: toColor(intensity), minHeight: "4px" }}
              onMouseEnter={() => setHovered(slot)}
              onMouseLeave={() => setHovered(null)}
            />
          );
        })}
      </div>

      <div className="flex">
        {filled.map((_, i) => (
          <div key={i} className="flex-1 text-center">
            {i % 3 === 0 ? (
              <span className="text-[9px] text-white/25">{HOUR_LABELS[i]}</span>
            ) : null}
          </div>
        ))}
      </div>

      {hovered ? (
        <p className="h-4 text-xs text-white/60">
          <strong className="text-white">{HOUR_LABELS[hovered.hour]}</strong>
          {" — "}avg engagement rate{" "}
          <strong className="text-cyan-300">
            {(hovered.avgEngagementRate * 100).toFixed(2)}%
          </strong>
          {hovered.postCount > 0 && ` · ${hovered.postCount} posts`}
        </p>
      ) : (
        <p className="h-4 text-xs text-white/25">Hover a bar to see engagement rate by hour</p>
      )}

      {slots.length > 0 && (() => {
        const best = [...filled].sort((a, b) => b.avgEngagementRate - a.avgEngagementRate)[0];
        if (!best.avgEngagementRate) return null;
        return (
          <div className="rounded-xl border border-cyan-400/20 bg-cyan-400/10 px-3 py-2 text-xs text-cyan-300">
            🔥 Your best time to post:{" "}
            <strong>{HOUR_LABELS[best.hour]}</strong> (avg{" "}
            {(best.avgEngagementRate * 100).toFixed(2)}% engagement)
          </div>
        );
      })()}
    </div>
  );
}

