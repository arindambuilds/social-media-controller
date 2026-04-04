"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { GitBranch, Plus, Save } from "lucide-react";
import { DashboardPageSkeleton } from "../../components/page-skeleton";
import {
  PulseCard,
  PulseButton,
  PulseTabs,
  PulseTabPanel,
  CelebrationBurst,
  usePulseToast
} from "../../components/pulse";
import { useAuth } from "../../context/auth-context";
import { usePageEnter } from "../../hooks/usePageEnter";

type Campaign = {
  id: string;
  name: string;
  status: "Draft" | "Scheduled" | "Live" | "Paused";
  reach: number;
  responses: number;
  clicks: number;
};

const DEMO: Campaign[] = [
  { id: "c1", name: "Festive saree broadcast", status: "Live", reach: 1280, responses: 96, clicks: 42 },
  { id: "c2", name: "Appointment reminders", status: "Scheduled", reach: 0, responses: 0, clicks: 0 },
  { id: "c3", name: "Re-engagement journey", status: "Paused", reach: 6400, responses: 210, clicks: 88 }
];

function statusClass(s: Campaign["status"]) {
  switch (s) {
    case "Draft":
      return "bg-white/10 text-muted";
    case "Scheduled":
      return "bg-mango-500/15 text-mango-400";
    case "Live":
      return "bg-mint-500/15 text-mint-400";
    case "Paused":
      return "bg-coral-500/10 text-coral-400";
    default:
      return "bg-white/10 text-muted";
  }
}

export default function CampaignsPage() {
  const pathname = usePathname();
  const router = useRouter();
  const { token, isReady } = useAuth();
  const pageClassName = usePageEnter();
  const { toast } = usePulseToast();
  const [tab, setTab] = useState("overview");
  const [celebrate, setCelebrate] = useState(false);

  useEffect(() => {
    if (!isReady) return;
    if (!token) router.replace("/login");
  }, [isReady, token, router]);

  if (!isReady || !token) {
    return (
      <div key={pathname} className={pageClassName}>
        <DashboardPageSkeleton />
      </div>
    );
  }

  function saveJourney() {
    // TODO: wire to POST /api/... journeys
    setCelebrate(true);
    toast({ message: "Campaign saved — nice work!", tone: "success" });
  }

  return (
    <div key={pathname} className={`space-y-8 ${pageClassName}`}>
      <div className="relative">
        <CelebrationBurst show={celebrate} onDone={() => setCelebrate(false)} />
        <PulseTabs
          tabs={[
            { id: "overview", label: "Overview" },
            { id: "builder", label: "Jolly flow builder" }
          ]}
          active={tab}
          onChange={setTab}
        />
      </div>

      <PulseTabPanel id="overview" active={tab}>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {DEMO.map((c) => (
            <PulseCard key={c.id} className="p-5" variant="default">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-display text-base font-bold text-ink">{c.name}</p>
                  <p className="mt-1 text-xs text-muted">ID: {c.id}</p>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-[0.65rem] font-bold uppercase tracking-wide ${statusClass(c.status)}`}>
                  {c.status}
                </span>
              </div>
              <dl className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
                <div className="rounded-xl bg-canvas/60 py-2">
                  <dt className="text-muted">Reach</dt>
                  <dd className="mt-1 font-display text-lg font-bold text-ink">{c.reach || "—"}</dd>
                </div>
                <div className="rounded-xl bg-canvas/60 py-2">
                  <dt className="text-muted">Replies</dt>
                  <dd className="mt-1 font-display text-lg font-bold text-ink">{c.responses || "—"}</dd>
                </div>
                <div className="rounded-xl bg-canvas/60 py-2">
                  <dt className="text-muted">Clicks</dt>
                  <dd className="mt-1 font-display text-lg font-bold text-ink">{c.clicks || "—"}</dd>
                </div>
              </dl>
            </PulseCard>
          ))}
          <button
            type="button"
            className="flex min-h-[160px] flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-mango-500/35 bg-mango-500/5 p-6 text-mango-400 transition-colors hover:border-mango-500/55 hover:bg-mango-500/10"
            onClick={() => setTab("builder")}
          >
            <Plus size={28} strokeWidth={2} aria-hidden />
            <span className="text-sm font-bold">New campaign</span>
            <span className="text-xs text-muted">Start from a template (soon)</span>
          </button>
        </div>
      </PulseTabPanel>

      <PulseTabPanel id="builder" active={tab}>
        <PulseCard className="p-6" variant="accent">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <GitBranch className="text-[#C8A951]" size={22} aria-hidden />
              <div>
                <p className="font-display text-lg font-bold text-ink">Stacked journey (MVP)</p>
                <p className="text-sm text-muted">Trigger → conditions → actions. Node canvas comes next.</p>
              </div>
            </div>
            <PulseButton type="button" onClick={saveJourney}>
              <Save size={18} />
              Save journey
            </PulseButton>
          </div>

          <ol className="mt-6 space-y-4">
            {(
              [
                ["Trigger", "New inbound WhatsApp message contains keyword “price”"],
                ["Condition", "Customer segment = “returning” AND time between 9am–9pm IST"],
                ["Action", "Send message with catalog + tag “warm lead”"]
              ] as const
            ).map(([title, body], i) => (
              <li
                key={title}
                className="relative rounded-2xl border border-subtle bg-canvas/80 p-4 pl-12 shadow-sm"
              >
                <span className="absolute left-4 top-4 flex h-7 w-7 items-center justify-center rounded-full bg-mango-500/20 text-xs font-bold text-mango-400">
                  {i + 1}
                </span>
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted">{title}</p>
                <p className="mt-1 text-sm text-ink">{body}</p>
              </li>
            ))}
          </ol>
          <p className="mt-4 text-xs text-muted">
            {/* TODO: wire builder to POST /api/... automations */}
            Saving is simulated for now — hook your automation engine when ready.
          </p>
        </PulseCard>
      </PulseTabPanel>
    </div>
  );
}
