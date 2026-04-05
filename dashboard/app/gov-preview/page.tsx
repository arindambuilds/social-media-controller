/** page-enter: server page wrapped with client `PageEnterShell` (see `@/components/page-enter`). */
import Link from "next/link";
import type { ReactElement } from "react";
import { PageEnterShell } from "@/components/page-enter";

export const revalidate = 3600;
const DEFAULT_LOCAL_API_ORIGIN = "http://localhost:4000";
const DEFAULT_PRODUCTION_API_ORIGIN = "https://social-media-controller.onrender.com";

type GovMetrics = {
  msmes: number;
  leadsThisWeek: number;
  odiaPercent: number;
  updatedAt: string | null;
};

function apiGovUrl(): string {
  const raw = (
    process.env.NEXT_PUBLIC_API_BASE_URL ??
    process.env.NEXT_PUBLIC_API_URL ??
    (process.env.NODE_ENV === "production" ? DEFAULT_PRODUCTION_API_ORIGIN : DEFAULT_LOCAL_API_ORIGIN)
  ).replace(/\/$/, "");
  const withApi = raw.endsWith("/api") ? raw : `${raw}/api`;
  return `${withApi}/pulse/gov-preview`;
}

async function loadMetrics(): Promise<GovMetrics> {
  try {
    const res = await fetch(apiGovUrl(), { next: { revalidate: 3600 } });
    if (!res.ok) {
      return { msmes: 0, leadsThisWeek: 0, odiaPercent: 0, updatedAt: null };
    }
    return (await res.json()) as GovMetrics;
  } catch {
    return { msmes: 0, leadsThisWeek: 0, odiaPercent: 0, updatedAt: null };
  }
}

export default async function GovPreviewPage(): Promise<ReactElement> {
  const m = await loadMetrics();

  return (
    <PageEnterShell className="min-h-screen bg-[#050608] px-4 py-10 text-white md:px-8">
      <div className="mx-auto max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-400/90">PulseOS · Public preview</p>
        <h1 className="mt-2 font-display text-3xl font-bold tracking-tight">Odisha MSME intelligence snapshot</h1>
        <p className="mt-2 text-sm text-white/55">
          Anonymized, cached metrics aligned with transparency goals under the 5T Charter (Technology · Transparency ·
          Transformation).
        </p>

        <div className="mt-10 grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
            <p className="text-xs font-medium uppercase tracking-wide text-white/40">MSMEs on Pulse</p>
            <p className="mt-2 text-3xl font-bold text-emerald-300">{m.msmes}</p>
            <p className="mt-1 text-xs text-white/45">Clients with morning briefing enabled</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
            <p className="text-xs font-medium uppercase tracking-wide text-white/40">Leads this week</p>
            <p className="mt-2 text-3xl font-bold text-cyan-300">{m.leadsThisWeek}</p>
            <p className="mt-1 text-xs text-white/45">Captured across connected accounts</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
            <p className="text-xs font-medium uppercase tracking-wide text-white/40">Odia briefings</p>
            <p className="mt-2 text-3xl font-bold text-amber-200">{m.odiaPercent}%</p>
            <p className="mt-1 text-xs text-white/45">Share of clients using Odia locale</p>
          </div>
        </div>

        <section className="mt-12 rounded-2xl border border-white/10 bg-white/[0.03] p-6">
          <h2 className="text-lg font-semibold text-white">5T alignment</h2>
          <ul className="mt-3 list-inside list-disc space-y-2 text-sm text-white/65">
            <li>Technology: AI summaries via WhatsApp — no new app to learn.</li>
            <li>Transparency: This page updates on a fixed schedule; no login required.</li>
            <li>Transformation: Owners move from reactive chats to daily, structured follow-ups.</li>
          </ul>
        </section>

        <footer className="mt-12 border-t border-white/10 pt-6 text-center text-xs text-white/40">
          Built in Bhubaneswar for Odisha MSMEs ·{" "}
          <Link href="/" className="text-emerald-400/90 underline-offset-2 hover:underline">
            Home
          </Link>
          {m.updatedAt ? (
            <span className="mt-2 block">Last refreshed: {new Date(m.updatedAt).toLocaleString("en-IN")}</span>
          ) : (
            <span className="mt-2 block">Awaiting first cache refresh from the API worker.</span>
          )}
        </footer>
      </div>
    </PageEnterShell>
  );
}
