"use client";

import { useCallback, useEffect, useState } from "react";
import { useDemoMode } from "../context/demo-mode-context";

const DISMISS_KEY = "smc_demo_banner_dismissed";

/** Full-width banner when API runs with INGESTION_MODE=mock; dismiss hides until tab/session ends (sessionStorage). */
export function DemoModeBanner() {
  const { isDemoMode, loaded } = useDemoMode();
  const [dismissRead, setDismissRead] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setDismissed(sessionStorage.getItem(DISMISS_KEY) === "1");
    setDismissRead(true);
  }, []);

  const onDismiss = useCallback(() => {
    sessionStorage.setItem(DISMISS_KEY, "1");
    setDismissed(true);
  }, []);

  if (!loaded || !isDemoMode || !dismissRead || dismissed) return null;

  return (
    <div className="demo-mode-banner" role="status">
      <p className="demo-mode-banner-text">
        Live demo — data is illustrative. Instagram connection available in production.
      </p>
      <button
        type="button"
        className="demo-mode-banner-dismiss"
        onClick={onDismiss}
        aria-label="Dismiss demo notice for this browser session"
      >
        Dismiss
      </button>
    </div>
  );
}
