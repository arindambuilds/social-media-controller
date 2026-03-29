"use client";

/** Lightweight placeholder blocks for chart + stat layouts (no extra deps). */
export function DashboardPageSkeleton() {
  return (
    <div className="page-shell" aria-busy="true" aria-label="Loading dashboard">
      <div className="skeleton skeleton-title" />
      <div className="skeleton skeleton-line mt-3 w-[72%] max-w-md" />
      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="gradient-border p-4">
            <div className="skeleton skeleton-stat min-h-[120px]" />
          </div>
        ))}
      </div>
      <div className="skeleton skeleton-chart mt-7" />
      <div className="skeleton mt-4 h-[180px] w-full rounded-[14px]" />
    </div>
  );
}

export function AnalyticsPageSkeleton() {
  return (
    <div className="page-shell" aria-busy="true" aria-label="Loading analytics">
      <div className="skeleton skeleton-title" />
      <div className="skeleton skeleton-line mt-3 w-[65%] max-w-lg" />
      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="gradient-border p-4">
            <div className="skeleton skeleton-stat min-h-[92px]" />
          </div>
        ))}
      </div>
      <div className="skeleton skeleton-chart mt-7" />
      <div className="skeleton skeleton-chart mt-4" />
      <div className="skeleton skeleton-panel mt-6" />
    </div>
  );
}

/** Next.js `app/loading.tsx` — full-width shell with header strip + blocks. */
export function RouteLoadingSkeleton() {
  return (
    <div className="page-shell animate-fade-in" aria-busy="true" aria-label="Loading page">
      <div className="gradient-border mb-6 flex items-center gap-4 p-5 sm:p-6">
        <div className="spinner spinner--sm shrink-0" aria-hidden />
        <div className="min-w-0 flex-1 space-y-3">
          <div className="skeleton skeleton-title max-w-[260px]" />
          <div className="skeleton skeleton-line w-[55%] max-w-sm" />
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="skeleton h-[148px] w-full rounded-[14px]" />
        <div className="skeleton h-[148px] w-full rounded-[14px]" />
      </div>
      <div className="skeleton mt-6 h-[200px] w-full rounded-[14px]" />
    </div>
  );
}

/** List / table pages (accounts, audit, onboarding initial load). */
export function ListPageSkeleton({ label }: { label: string }) {
  return (
    <div className="page-shell" aria-busy="true" aria-label={label}>
      <div className="gradient-border mb-6 flex items-center gap-3 p-5">
        <div className="spinner spinner--sm shrink-0" aria-hidden />
        <span className="text-muted text-sm">{label}</span>
      </div>
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="skeleton h-[52px] w-full rounded-xl" />
        ))}
      </div>
    </div>
  );
}

/** Compact placeholder for Suspense boundaries (e.g. accounts shell). */
export function TableFallbackSkeleton() {
  return (
    <div className="page-shell" aria-busy="true" aria-label="Loading">
      <div className="skeleton skeleton-title" />
      <div className="skeleton skeleton-line mt-3 w-2/3 max-w-md" />
      <div className="mt-8 space-y-2">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="skeleton h-12 w-full rounded-lg" />
        ))}
      </div>
    </div>
  );
}
