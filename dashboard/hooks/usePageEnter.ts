"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

/**
 * Staggered `.page-enter` reveal. Resets when `pathname` changes so route transitions re-run the animation.
 */
export function usePageEnter(extraClassName?: string): string {
  const pathname = usePathname();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(false);
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotion) {
      setReady(true);
      return;
    }
    const frame = window.requestAnimationFrame(() => setReady(true));
    return () => window.cancelAnimationFrame(frame);
  }, [pathname]);

  return ["page-enter", ready ? "is-ready" : "", extraClassName ?? ""].filter(Boolean).join(" ");
}
