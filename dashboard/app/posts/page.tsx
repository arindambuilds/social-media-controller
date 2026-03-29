"use client";

import { ImageIcon, Plus, X } from "lucide-react";
import type React from "react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useState } from "react";
import { apiFetch, fetchMe } from "../../lib/api";
import { VoicePostButton } from "../../components/VoicePostButton";
import { PageHeader } from "../../components/ui/page-header";
import { CLIENT_ID_KEY, getStoredClientId, getStoredToken } from "../../lib/auth-storage";

type OutboundStatus = "DRAFT" | "SCHEDULED" | "PUBLISHED" | "FAILED";

type SocialAcc = { id: string; platform: string; platformUsername: string | null };

type ScheduledRow = {
  id: string;
  caption: string;
  status: OutboundStatus;
  scheduledAt: string | null;
  publishedAt: string | null;
  engagementStats: unknown;
  socialAccount: { platform: string; platformUsername: string | null };
};

const CAPTION_MAX = 2200;

const HASHTAG_SUGGESTIONS = ["#Bhubaneswar", "#SareeLove", "#EthnicWear", "#OdishaHandloom", "#SmallBusinessIndia"];

function statusBadgeClass(status: OutboundStatus): string {
  const map: Record<OutboundStatus, string> = {
    DRAFT: "border-subtle bg-surface text-muted",
    SCHEDULED: "border-accent-purple/45 bg-accent-purple/15 text-accent-purple",
    PUBLISHED: "border-accent-teal/45 bg-accent-teal/15 text-accent-teal",
    FAILED: "border-danger/45 bg-danger/15 text-danger"
  };
  return map[status];
}

function formatScheduleLine(p: ScheduledRow): string {
  if (p.status === "PUBLISHED" && p.publishedAt) {
    return `Published ${new Date(p.publishedAt).toLocaleString()}`;
  }
  if (p.scheduledAt) {
    return `Scheduled ${new Date(p.scheduledAt).toLocaleString()}`;
  }
  if (p.publishedAt) {
    return `Published ${new Date(p.publishedAt).toLocaleString()}`;
  }
  return "Not scheduled";
}

export default function PostsPage() {
  const router = useRouter();
  const modalTitleId = useId();
  const [clientId, setClientId] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<SocialAcc[]>([]);
  const [posts, setPosts] = useState<ScheduledRow[]>([]);
  const [caption, setCaption] = useState("");
  const [mediaUrls, setMediaUrls] = useState<string[]>([""]);
  const [hashtags, setHashtags] = useState("");
  const [scheduleAt, setScheduleAt] = useState("");
  const [socialAccountId, setSocialAccountId] = useState("");
  const [status, setStatus] = useState<"DRAFT" | "SCHEDULED">("DRAFT");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  const load = useCallback(async (_token: string, cid: string) => {
    const [aJson, pJson] = await Promise.all([
      apiFetch<{ accounts: SocialAcc[] }>(`/social-accounts?clientId=${encodeURIComponent(cid)}`),
      apiFetch<{ posts: ScheduledRow[] }>(`/posts?clientId=${encodeURIComponent(cid)}`)
    ]);
    const accs = aJson.accounts ?? [];
    setAccounts(accs);
    setPosts(pJson.posts ?? []);
    setSocialAccountId((sid) => sid || accs[0]?.id || "");
  }, []);

  useEffect(() => {
    const token = getStoredToken();
    if (!token) {
      router.replace("/login");
      return;
    }
    (async () => {
      try {
        const me = await fetchMe();
        let cid = getStoredClientId() ?? me.user.clientId;
        if (me.user.role === "CLIENT_USER" && !cid) {
          setError("No client assigned.");
          setLoading(false);
          return;
        }
        if (me.user.role === "AGENCY_ADMIN" && !cid) {
          cid = "demo-client";
          localStorage.setItem(CLIENT_ID_KEY, cid);
        }
        if (cid) {
          setClientId(cid);
          localStorage.setItem(CLIENT_ID_KEY, cid);
          await load(token, cid);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    })();
  }, [router, load]);

  useEffect(() => {
    if (!createOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setCreateOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [createOpen]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!clientId) return;
    const token = getStoredToken();
    if (!token) return;
    setSaving(true);
    setError("");
    try {
      const tagList = hashtags
        .split(/[\s,#]+/)
        .map((t) => t.trim())
        .filter(Boolean);
      const urls = mediaUrls.map((u) => u.trim()).filter(Boolean);
      const body: Record<string, unknown> = {
        clientId,
        socialAccountId,
        caption,
        mediaUrls: urls,
        hashtags: tagList,
        status
      };
      if (scheduleAt) body.scheduledAt = new Date(scheduleAt).toISOString();
      await apiFetch("/posts", {
        method: "POST",
        body: JSON.stringify(body)
      });
      setCaption("");
      setMediaUrls([""]);
      setHashtags("");
      setScheduleAt("");
      setCreateOpen(false);
      await load(token, clientId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function onDelete(id: string) {
    if (!clientId) return;
    const token = getStoredToken();
    if (!token) return;
    if (!confirm("Delete this post?")) return;
    try {
      await apiFetch(`/posts/${encodeURIComponent(id)}`, { method: "DELETE" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
      return;
    }
    await load(token, clientId);
  }

  function setMediaUrl(i: number, v: string) {
    setMediaUrls((prev) => {
      const next = [...prev];
      next[i] = v;
      return next;
    });
  }

  function addMediaRow() {
    setMediaUrls((prev) => [...prev, ""]);
  }

  function removeMediaRow(i: number) {
    setMediaUrls((prev) => prev.filter((_, j) => j !== i));
  }

  function appendHashtag(tag: string) {
    setHashtags((prev) => (prev.trim() ? `${prev.trim()} ${tag}` : tag));
  }

  const captionLen = caption.length;
  const captionWarn = captionLen > CAPTION_MAX;

  const refreshPosts = useCallback(() => {
    const t = getStoredToken();
    if (t && clientId) void load(t, clientId);
  }, [clientId, load]);

  if (loading) {
    return (
      <div className="page-shell">
        <div className="gradient-border flex items-center gap-3 p-6">
          <div className="spinner" aria-label="Loading posts" />
          <span className="text-muted text-sm">Loading posts…</span>
        </div>
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton aspect-[4/5] w-full rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="page-shell">
      <PageHeader
        eyebrow="Publish"
        title="Posts"
        description="Compose captions, attach media URLs, schedule delivery, and track status."
        actions={
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-accent-purple to-accent-teal px-5 py-3 text-sm font-bold text-ink shadow-glow transition-transform duration-200 hover:scale-[1.02] hover:shadow-teal active:scale-[0.98]"
          >
            <Plus size={20} strokeWidth={2.5} aria-hidden />
            Create post
          </button>
        }
      />

      {error ? <p className="text-error mt-4">{error}</p> : null}

      {clientId ? (
        <VoicePostButton clientId={clientId} disabled={accounts.length === 0} onScheduled={refreshPosts} />
      ) : null}

      <h2 className="text-ink font-display mt-8 text-xl font-bold tracking-tight">Queue</h2>
      <p className="text-muted mt-1 text-sm">Drafts, scheduled, and published outbound posts for this client.</p>

      {posts.length === 0 ? (
        <div className="border-subtle text-muted mt-6 rounded-xl border border-dashed bg-surface/50 px-6 py-12 text-center text-sm">
          No posts in the queue yet. Use <strong className="text-ink">Create post</strong> to add one.
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {posts.map((p) => {
            const stats = p.engagementStats as { likes?: number; comments?: number } | null;
            const preview = p.caption.slice(0, 120) + (p.caption.length > 120 ? "…" : "");
            return (
              <article
                key={p.id}
                className="flex flex-col overflow-hidden rounded-xl border border-subtle bg-surface transition-all duration-200 hover:-translate-y-0.5 hover:shadow-glow"
              >
                <div className="relative flex aspect-[4/3] items-center justify-center bg-[linear-gradient(145deg,#16161f,#0f0f16)]">
                  <ImageIcon className="text-muted h-12 w-12 opacity-5" strokeWidth={1} aria-hidden />
                  <span className="text-muted absolute bottom-2 left-2 rounded-md bg-canvas/80 px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide">
                    {p.socialAccount.platform}
                  </span>
                </div>
                <div className="flex flex-1 flex-col gap-2 p-4">
                  <p className="text-ink line-clamp-3 min-h-[3.5rem] text-sm leading-relaxed">{preview || "—"}</p>
                  <p className="text-muted text-xs tabular-nums">{formatScheduleLine(p)}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <span
                      className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold ${statusBadgeClass(p.status)}`}
                    >
                      {p.status}
                    </span>
                  </div>
                  <div className="text-muted mt-auto pt-3 text-xs">
                    {stats?.likes != null ? `${stats.likes} likes` : "—"}
                    {stats?.comments != null ? ` · ${stats.comments} comments` : ""}
                  </div>
                  {(p.status === "DRAFT" || p.status === "SCHEDULED") && (
                    <button
                      type="button"
                      className="button secondary mt-2 w-full text-xs"
                      onClick={() => onDelete(p.id)}
                    >
                      Delete
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {createOpen ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby={modalTitleId}
        >
          <button
            type="button"
            className="absolute inset-0 bg-canvas/75 backdrop-blur-xl"
            aria-label="Close create post"
            onClick={() => setCreateOpen(false)}
          />
          <div className="relative z-[1] max-h-[min(92vh,720px)] w-full max-w-lg overflow-y-auto rounded-2xl border border-ink/15 bg-ink/[0.06] p-6 shadow-glow backdrop-blur-xl">
            <div className="mb-4 flex items-start justify-between gap-4">
              <h2 id={modalTitleId} className="text-ink font-display text-xl font-bold tracking-tight">
                Create post
              </h2>
              <button
                type="button"
                className="text-muted hover:text-ink flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-subtle bg-surface transition-colors"
                onClick={() => setCreateOpen(false)}
                aria-label="Close"
              >
                <X size={20} strokeWidth={2} />
              </button>
            </div>

            <form onSubmit={onSubmit} className="flex flex-col gap-4">
              <div>
                <div className="mb-1 flex items-center justify-between gap-2">
                  <label className="text-muted text-xs font-bold uppercase tracking-wide" htmlFor="post-caption">
                    Caption
                  </label>
                  <span
                    className={`text-xs font-semibold tabular-nums ${captionWarn ? "text-danger" : "text-muted"}`}
                  >
                    {captionLen} / {CAPTION_MAX}
                  </span>
                </div>
                <textarea
                  id="post-caption"
                  className="input min-h-[120px] resize-y"
                  rows={4}
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  placeholder="What are you posting?"
                  maxLength={CAPTION_MAX + 200}
                />
              </div>

              <div>
                <label className="text-muted mb-1 block text-xs font-bold uppercase tracking-wide">Media URLs</label>
                {mediaUrls.map((u, i) => (
                  <div key={i} className="mb-2 flex gap-2">
                    <input
                      className="input min-w-0 flex-1"
                      value={u}
                      onChange={(e) => setMediaUrl(i, e.target.value)}
                      placeholder="https://..."
                    />
                    <button type="button" className="button secondary shrink-0 px-3 text-xs" onClick={() => removeMediaRow(i)}>
                      Remove
                    </button>
                  </div>
                ))}
                <button type="button" className="button secondary text-xs" onClick={addMediaRow}>
                  Add URL
                </button>
              </div>

              <div>
                <label className="text-muted mb-1 block text-xs font-bold uppercase tracking-wide" htmlFor="post-tags">
                  Hashtags
                </label>
                <input
                  id="post-tags"
                  className="input"
                  value={hashtags}
                  onChange={(e) => setHashtags(e.target.value)}
                  placeholder="#Bhubaneswar #SareeLove #EthnicWear"
                />
                <div className="mt-2 flex flex-wrap gap-2">
                  {HASHTAG_SUGGESTIONS.map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      className="text-accent-teal hover:bg-accent-teal/15 rounded-full border border-accent-teal/35 bg-transparent px-2.5 py-1 text-xs font-semibold transition-colors"
                      onClick={() => appendHashtag(tag)}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-muted mb-1 block text-xs font-bold uppercase tracking-wide" htmlFor="post-schedule">
                  Schedule at
                </label>
                <input
                  id="post-schedule"
                  className="input"
                  type="datetime-local"
                  value={scheduleAt}
                  onChange={(e) => setScheduleAt(e.target.value)}
                />
              </div>

              <div>
                <label className="text-muted mb-1 block text-xs font-bold uppercase tracking-wide" htmlFor="post-account">
                  Social account
                </label>
                <select
                  id="post-account"
                  className="input"
                  value={socialAccountId}
                  onChange={(e) => setSocialAccountId(e.target.value)}
                >
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.platform} — {a.platformUsername ?? a.id.slice(0, 8)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-muted mb-1 block text-xs font-bold uppercase tracking-wide" htmlFor="post-status">
                  Status
                </label>
                <select
                  id="post-status"
                  className="input"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as "DRAFT" | "SCHEDULED")}
                >
                  <option value="DRAFT">Draft</option>
                  <option value="SCHEDULED">Scheduled (enqueue publish)</option>
                </select>
              </div>

              <div className="flex flex-wrap gap-3 pt-2">
                <button type="submit" className="button flex-1" disabled={saving || !socialAccountId}>
                  {saving ? "Saving…" : "Save post"}
                </button>
                <button type="button" className="button secondary" onClick={() => setCreateOpen(false)}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
