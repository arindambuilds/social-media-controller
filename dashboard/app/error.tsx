"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="page-shell">
      <section className="panel span-12">
        <h2>Something went wrong</h2>
        <p className="text-error" style={{ marginTop: 12 }}>
          {error.message || "An unexpected error occurred."}
        </p>
        <div className="actions" style={{ marginTop: 20 }}>
          <button type="button" className="button" onClick={reset}>
            Try again
          </button>
        </div>
      </section>
    </div>
  );
}
