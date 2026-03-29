"use client";

/** Lightweight placeholder blocks for chart + stat layouts (no extra deps). */
export function DashboardPageSkeleton() {
  return (
    <div className="page-shell" aria-busy="true" aria-label="Loading dashboard">
      <div className="skeleton skeleton-title" />
      <div className="skeleton skeleton-line" style={{ width: "72%", marginTop: 12 }} />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4" style={{ marginTop: 24 }}>
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="gradient-border p-4">
            <div className="skeleton skeleton-stat min-h-[120px] border-0 bg-[#1e1e2e]" />
          </div>
        ))}
      </div>
      <div className="skeleton skeleton-chart" style={{ marginTop: 28 }} />
      <div className="skeleton skeleton-chart" style={{ marginTop: 16, height: 180 }} />
    </div>
  );
}

export function AnalyticsPageSkeleton() {
  return (
    <div className="page-shell" aria-busy="true" aria-label="Loading analytics">
      <div className="skeleton skeleton-title" />
      <div className="skeleton skeleton-line" style={{ width: "65%", marginTop: 12 }} />
      <div className="stats-grid" style={{ marginTop: 24 }}>
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="skeleton skeleton-stat" />
        ))}
      </div>
      <div className="skeleton skeleton-chart" style={{ marginTop: 28 }} />
      <div className="skeleton skeleton-chart" style={{ marginTop: 16 }} />
      <div className="skeleton skeleton-panel" style={{ marginTop: 24 }} />
    </div>
  );
}
