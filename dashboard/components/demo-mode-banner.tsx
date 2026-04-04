"use client";

import { useCallback, useState } from "react";
import { useDemoMode } from "../context/demo-mode-context";

let demoBannerDismissed = false;

/** Full-width banner when API runs with INGESTION_MODE=mock; dismiss hides until reload (in-memory only). */
export function DemoModeBanner() {
  const { isDemoMode, loaded } = useDemoMode();
  const [dismissed, setDismissed] = useState(demoBannerDismissed);

  const onDismiss = useCallback(() => {
    demoBannerDismissed = true;
    setDismissed(true);
  }, []);

  if (!loaded || !isDemoMode || dismissed) return null;

  return (
    <div className="demo-mode-banner" role="status">
      <p className="demo-mode-banner-text">
        Sample workspace active - some data may be illustrative while live channels finish syncing.
      </p>
      <button
        type="button"
        className="demo-mode-banner-dismiss"
        onClick={onDismiss}
        aria-label="Dismiss sample workspace notice for this browser session"
      >
        Dismiss
      </button>
    </div>
  );
}
