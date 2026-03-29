"use client";

import { useEffect } from "react";
import { PageHeader } from "../components/ui/page-header";

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
      <PageHeader
        eyebrow="Error"
        title="Something went wrong"
        description="This part of the app hit an unexpected error. Try again or reload the page."
      />
      <div className="gradient-border mt-6 p-8">
        <p className="text-error m-0 text-sm leading-relaxed">{error.message || "An unexpected error occurred."}</p>
        <button type="button" className="button mt-6" onClick={reset}>
          Try again
        </button>
      </div>
    </div>
  );
}
