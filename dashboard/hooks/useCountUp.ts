"use client";

import { useEffect, useMemo, useState } from "react";

export function useCountUp(target: number, duration = 800): number {
  const safeTarget = useMemo(() => (Number.isFinite(target) ? target : 0), [target]);
  const [value, setValue] = useState(0);

  useEffect(() => {
    const reducedMotion = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotion) {
      setValue(safeTarget);
      return;
    }

    let frame = 0;
    let start = 0;

    const tick = (time: number) => {
      if (!start) start = time;
      const progress = Math.min(1, (time - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(safeTarget * eased));
      if (progress < 1) {
        frame = window.requestAnimationFrame(tick);
      }
    };

    setValue(0);
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [duration, safeTarget]);

  return value;
}
