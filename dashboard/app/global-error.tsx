"use client";

import { useEffect } from "react";

// Global error boundary — catches errors in the root layout itself
export default function GlobalError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[GlobalError]", error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100vh",
          background: "#0d1117",
          color: "#e6edf3",
          fontFamily: "system-ui, sans-serif",
          gap: "1rem",
          padding: "2rem",
          textAlign: "center"
        }}
      >
        <h1 style={{ fontSize: "1.5rem", fontWeight: 700, margin: 0 }}>Something went wrong</h1>
        <p style={{ color: "#8b949e", maxWidth: 400, margin: 0 }}>
          An unexpected error occurred. Our team has been notified.
        </p>
        {error.digest ? (
          <p style={{ fontSize: "0.75rem", color: "#484f58", margin: 0 }}>Error ID: {error.digest}</p>
        ) : null}
        <button
          onClick={reset}
          style={{
            marginTop: "0.5rem",
            padding: "0.5rem 1.5rem",
            background: "#238636",
            color: "#fff",
            border: "none",
            borderRadius: "6px",
            cursor: "pointer",
            fontWeight: 600
          }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
