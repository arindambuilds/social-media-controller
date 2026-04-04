"use client";

import { useEffect, useState } from "react";

const COLORS = ["#FBBF24", "#F59E0B", "#2DD4BF", "#6C63FF", "#FB7185"];

type CelebrationBurstProps = {
  show: boolean;
  onDone?: () => void;
};

/**
 * Short, tasteful confetti burst (CSS-only). Disabled when reduced motion is on.
 */
export function CelebrationBurst({ show, onDone }: CelebrationBurstProps) {
  const [active, setActive] = useState(false);

  useEffect(() => {
    if (!show) return;
    setActive(true);
    const t = window.setTimeout(() => {
      setActive(false);
      onDone?.();
    }, 900);
    return () => window.clearTimeout(t);
  }, [show, onDone]);

  if (!active) return null;

  return (
    <div className="pulse-celebration" aria-hidden>
      {Array.from({ length: 14 }).map((_, i) => (
        <span
          key={i}
          style={{
            left: `${8 + (i % 7) * 12}%`,
            top: "12%",
            background: COLORS[i % COLORS.length]!,
            animationDelay: `${i * 35}ms`
          }}
        />
      ))}
    </div>
  );
}
