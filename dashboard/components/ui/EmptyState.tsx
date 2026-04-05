import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

type IllustrationKey = "conversations" | "reports" | "notifications" | "search" | "generic";

interface EmptyStateProps {
  illustration?: IllustrationKey;
  heading: string;
  subline: string;
  cta?: { label: string; onClick: () => void };
  className?: string;
}

// Keep illustrations inline so empty states stay dependency-free and consistent across routes.
const illustrations: Record<IllustrationKey, ReactNode> = {
  conversations: (
    <svg width="64" height="64" viewBox="0 0 64 64" fill="none" aria-hidden>
      <rect x="8" y="16" width="40" height="28" rx="8" stroke="#00E5FF" strokeWidth="1.5" fill="rgba(0,229,255,0.05)" />
      <rect x="16" y="24" width="48" height="28" rx="8" stroke="#8B5CF6" strokeWidth="1.5" fill="rgba(139,92,246,0.05)" />
      <circle cx="52" cy="12" r="8" fill="rgba(255,107,157,0.15)" stroke="#FF6B9D" strokeWidth="1.5" />
      <path d="M49 12h6M52 9v6" stroke="#FF6B9D" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
  reports: (
    <svg width="64" height="64" viewBox="0 0 64 64" fill="none" aria-hidden>
      <rect x="12" y="8" width="40" height="48" rx="6" stroke="#8B5CF6" strokeWidth="1.5" fill="rgba(139,92,246,0.05)" />
      <path d="M20 24h24M20 32h18M20 40h12" stroke="#00E5FF" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M36 44l6-8 5 4 5-10" stroke="#C8A951" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  notifications: (
    <svg width="64" height="64" viewBox="0 0 64 64" fill="none" aria-hidden>
      <path d="M32 12c-11 0-18 7-18 16v8l-4 6h44l-4-6v-8c0-9-7-16-18-16z" stroke="#00E5FF" strokeWidth="1.5" fill="rgba(0,229,255,0.05)" />
      <path d="M28 48a4 4 0 0 0 8 0" stroke="#8B5CF6" strokeWidth="1.5" />
    </svg>
  ),
  search: (
    <svg width="64" height="64" viewBox="0 0 64 64" fill="none" aria-hidden>
      <circle cx="28" cy="28" r="16" stroke="#00E5FF" strokeWidth="1.5" fill="rgba(0,229,255,0.05)" />
      <path d="M40 40l12 12" stroke="#FF6B9D" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M22 28h12M28 22v12" stroke="#8B5CF6" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
  generic: (
    <svg width="64" height="64" viewBox="0 0 64 64" fill="none" aria-hidden>
      <rect x="12" y="12" width="40" height="40" rx="10" stroke="#8B5CF6" strokeWidth="1.5" fill="rgba(139,92,246,0.05)" />
      <circle cx="32" cy="28" r="6" stroke="#00E5FF" strokeWidth="1.5" />
      <path d="M20 44c0-6.627 5.373-10 12-10s12 3.373 12 10" stroke="#FF6B9D" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
};

export function EmptyState({ illustration = "generic", heading, subline, cta, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center px-6 py-16 text-center", className)}>
      <div className="mb-6 opacity-80">{illustrations[illustration]}</div>
      <h3 style={{ color: "var(--white)", fontSize: "1rem", fontWeight: 600, marginBottom: "8px" }}>{heading}</h3>
      <p
        style={{
          color: "var(--text-secondary)",
          fontSize: "0.875rem",
          lineHeight: 1.6,
          maxWidth: "280px",
          marginBottom: cta ? "20px" : 0
        }}
      >
        {subline}
      </p>
      {cta ? (
        <button
          type="button"
          onClick={cta.onClick}
          style={{
            background: "var(--accent-amber, var(--amber))",
            color: "#0D0B1F",
            border: "none",
            borderRadius: "8px",
            padding: "10px 20px",
            fontSize: "0.875rem",
            fontWeight: 600,
            cursor: "pointer"
          }}
        >
          {cta.label}
        </button>
      ) : null}
    </div>
  );
}
