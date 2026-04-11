"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { GitBranch, Plus, Save, Trash2 } from "lucide-react";
import { DashboardPageSkeleton } from "../../components/page-skeleton";
import {
  PulseCard,
  PulseButton,
  PulseTabs,
  PulseTabPanel,
  CelebrationBurst,
  usePulseToast,
} from "../../components/pulse";
import { usePageEnter } from "../../hooks/usePageEnter";
import { useProtectedRoute } from "../../hooks/useProtectedRoute";
import { getCampaigns, createCampaign, deleteCampaign, type Campaign } from "../../lib/workspace";

function statusLabel(c: Campaign): "Scheduled" | "Live" | "Ended" | "Draft" {
  const now = Date.now();
  if (!c.startsAt) return "Draft";
  const start = new Date(c.startsAt).getTime();
  const end = c.endsAt ? new Date(c.endsAt).getTime() : null;
  if (now < start) return "Scheduled";
  if (end && now > end) return "Ended";
  return "Live";
}

function statusClass(s: ReturnType<typeof statusLabel>) {
  switch (s) {
    case "Draft":      return "bg-white/10 text-muted";
    case "Scheduled":  return "bg-mango-500/15 text-mango-400";
    case "Live":       return "bg-mint-500/15 text-mint-400";
    case "Ended":      return "bg-coral-500/10 text-coral-400";
  }
}

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export default function CampaignsPage() {
  const pathname = usePathname();
  const { user, isReady, isAuthenticated } = useProtectedRoute();
  const pageClassName = usePageEnter();
  const { toast } = usePulseToast();

  const [tab, setTab] = useState("overview");
  const [celebrate, setCelebrate] = useState(false);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  // New campaign form state
  const [newName, setNewName] = useState("");
  const [newBudget, setNewBudget] = useState("");
  const [newStartsAt, setNewStartsAt] = useState("");
  const [newEndsAt, setNewEndsAt] = useState("");

  useEffect(() => {
    if (!isReady || !isAuthenticated || !user?.clientId) return;
    getCampaigns(user.clientId)
      .then(setCampaigns)
      .catch(() => toast({ message: "Couldn't load campaigns", tone: "info" }))
      .finally(() => setLoading(false));
  }, [isReady, isAuthenticated, user?.clientId, toast]);

  if (!isReady || !isAuthenticated) {
    return (
      <div key={pathname} className={pageClassName}>
        <DashboardPageSkeleton />
      </div>
    );
  }

  async function handleCreate() {
    if (!newName.trim() || !user?.clientId) return;
    setSaving(true);
    try {
      const created = await createCampaign({
        clientId: user.clientId,
        name: newName.trim(),
        budget: newBudget ? Number(newBudget) : undefined,
        startsAt: newStartsAt || undefined,
        endsAt: newEndsAt || undefined,
      });
      setCampaigns((prev) => [created, ...prev]);
      setNewName("");
      setNewBudget("");
      setNewStartsAt("");
      setNewEndsAt("");
      setCelebrate(true);
      toast({ message: "Campaign created!", tone: "success" });
      setTab("overview");
    } catch {
      toast({ message: "Couldn't create campaign — try again", tone: "info" });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    setDeleting(id);
    try {
      await deleteCampaign(id);
      setCampaigns((prev) => prev.filter((c) => c.id !== id));
      toast({ message: "Campaign removed", tone: "success" });
    } catch {
      toast({ message: "Couldn't delete campaign", tone: "info" });
    } finally {
      setDeleting(null);
    }
  }

  return (
    <div key={pathname} className={`space-y-8 ${pageClassName}`}>
      <div className="relative">
        <CelebrationBurst show={celebrate} onDone={() => setCelebrate(false)} />
        <PulseTabs
          tabs={[
            { id: "overview", label: "Overview" },
            { id: "builder", label: "New campaign" },
          ]}
          active={tab}
          onChange={setTab}
        />
      </div>

      {/* ── Overview ── */}
      <PulseTabPanel id="overview" active={tab}>
        {loading ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-40 animate-pulse rounded-2xl bg-surface/60" />
            ))}
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {campaigns.map((c) => {
              const status = statusLabel(c);
              return (
                <PulseCard key={c.id} className="p-5" variant="default">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-display text-base font-bold text-ink">{c.name}</p>
                      <p className="mt-1 text-xs text-muted">
                        {formatDate(c.startsAt)} → {formatDate(c.endsAt)}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className={`rounded-full px-2.5 py-1 text-[0.65rem] font-bold uppercase tracking-wide ${statusClass(status)}`}>
                        {status}
                      </span>
                      <button
                        type="button"
                        aria-label={`Delete ${c.name}`}
                        disabled={deleting === c.id}
                        onClick={() => handleDelete(c.id)}
                        className="rounded-lg p-1 text-muted transition-colors hover:text-coral-400 disabled:opacity-40"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                  <dl className="mt-4 grid grid-cols-2 gap-2 text-center text-xs">
                    <div className="rounded-xl bg-canvas/60 py-2">
                      <dt className="text-muted">Budget</dt>
                      <dd className="mt-1 font-display text-lg font-bold text-ink">
                        {c.budget ? `₹${Number(c.budget).toLocaleString("en-IN")}` : "—"}
                      </dd>
                    </div>
                    <div className="rounded-xl bg-canvas/60 py-2">
                      <dt className="text-muted">Status</dt>
                      <dd className="mt-1 font-display text-lg font-bold text-ink">{status}</dd>
                    </div>
                  </dl>
                </PulseCard>
              );
            })}

            {/* New campaign CTA */}
            <button
              type="button"
              className="flex min-h-[160px] flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-mango-500/35 bg-mango-500/5 p-6 text-mango-400 transition-colors hover:border-mango-500/55 hover:bg-mango-500/10"
              onClick={() => setTab("builder")}
            >
              <Plus size={28} strokeWidth={2} aria-hidden />
              <span className="text-sm font-bold">New campaign</span>
            </button>
          </div>
        )}

        {!loading && campaigns.length === 0 && (
          <p className="mt-4 text-center text-sm text-muted">
            No campaigns yet — create your first one above.
          </p>
        )}
      </PulseTabPanel>

      {/* ── Builder ── */}
      <PulseTabPanel id="builder" active={tab}>
        <PulseCard className="p-6" variant="accent">
          <div className="flex items-center gap-2 mb-6">
            <GitBranch className="text-[#C8A951]" size={22} aria-hidden />
            <div>
              <p className="font-display text-lg font-bold text-ink">Create campaign</p>
              <p className="text-sm text-muted">Set a name, budget, and schedule.</p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-muted">
                Campaign name *
              </label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Festive saree broadcast"
                className="w-full rounded-xl border border-subtle bg-canvas px-4 py-2.5 text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-mango-500/40"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-muted">
                Budget (₹)
              </label>
              <input
                type="number"
                min="0"
                value={newBudget}
                onChange={(e) => setNewBudget(e.target.value)}
                placeholder="e.g. 5000"
                className="w-full rounded-xl border border-subtle bg-canvas px-4 py-2.5 text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-mango-500/40"
              />
            </div>

            <div>
              {/* spacer */}
            </div>

            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-muted">
                Start date
              </label>
              <input
                type="datetime-local"
                value={newStartsAt}
                onChange={(e) => setNewStartsAt(e.target.value ? new Date(e.target.value).toISOString() : "")}
                className="w-full rounded-xl border border-subtle bg-canvas px-4 py-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-mango-500/40"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-muted">
                End date
              </label>
              <input
                type="datetime-local"
                value={newEndsAt}
                onChange={(e) => setNewEndsAt(e.target.value ? new Date(e.target.value).toISOString() : "")}
                className="w-full rounded-xl border border-subtle bg-canvas px-4 py-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-mango-500/40"
              />
            </div>
          </div>

          <div className="mt-6 flex justify-end gap-3">
            <PulseButton type="button" variant="ghost" onClick={() => setTab("overview")}>
              Cancel
            </PulseButton>
            <PulseButton
              type="button"
              disabled={!newName.trim() || saving}
              onClick={handleCreate}
            >
              <Save size={16} />
              {saving ? "Saving…" : "Save campaign"}
            </PulseButton>
          </div>
        </PulseCard>
      </PulseTabPanel>
    </div>
  );
}
