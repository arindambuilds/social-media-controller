"use client";

import { useEffect } from "react";
import { Button } from "../components/ui/button";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="app-background pulse-loader-screen" style={{ padding: 24 }}>
      <div className="panel" style={{ maxWidth: 560, padding: 28 }}>
        <p style={{ margin: 0, color: "var(--amber)", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>
          Something went sideways
        </p>
        <h1 style={{ marginBottom: 12, fontFamily: "var(--font-display)", fontSize: "2rem" }}>
          Let’s get you back on track.
        </h1>
        <p style={{ color: "var(--text-secondary)", lineHeight: 1.6 }}>
          {error.message || "An unexpected error showed up. Please try again."}
        </p>
        <div style={{ marginTop: 20, display: "flex", gap: 12, justifyContent: "center" }}>
          <Button variant="primary" onClick={reset}>Try again</Button>
        </div>
      </div>
    </div>
  );
}
