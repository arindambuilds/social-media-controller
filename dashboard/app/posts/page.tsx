"use client";

import type React from "react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { apiFetch, fetchMe } from "../../lib/api";
import { CLIENT_ID_KEY, getStoredClientId, getStoredToken } from "../../lib/auth-storage";
import { PageHeader } from "../../components/ui/page-header";

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

const statusStyle: Record<OutboundStatus, React.CSSProperties> = {
  DRAFT: { background: "var(--muted)", color: "var(--foreground)", padding: "2px 8px", borderRadius: 6, fontSize: 12 },
  SCHEDULED: { background: "var(--warning)", color: "#111", padding: "2px 8px", borderRadius: 6, fontSize: 12 },
  PUBLISHED: { background: "var(--success)", color: "#111", padding: "2px 8px", borderRadius: 6, fontSize: 12 },
  FAILED: { background: "#b91c1c", color: "#fff", padding: "2px 8px", borderRadius: 6, fontSize: 12 }
};

export default function PostsPage() {
  const router = useRouter();
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

  if (loading) {
    return (
      <div className="page-shell">
        <div className="panel" style={{ display: "flex", alignItems: "center", gap: 12, padding: 32 }}>
          <div className="spinner" aria-label="Loading posts" />
          <span className="muted">Loading posts…</span>
        </div>
        <div className="skeleton" style={{ height: 120, marginTop: 16 }} />
      </div>
    );
  }

  return (
    <div className="page-shell">
      <PageHeader
        eyebrow="Publish"
        title="Posts"
        description="Compose captions, attach media URLs, schedule delivery, and track status."
      />

      {error ? <p className="text-error" style={{ marginBottom: 16 }}>{error}</p> : null}

      <form className="card-surface" onSubmit={onSubmit} style={{ marginBottom: 32, padding: 20 }}>
        <label className="field-label">Caption</label>
        <textarea
          className="input"
          rows={4}
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          placeholder="What are you posting?"
        />

        <label className="field-label" style={{ marginTop: 16 }}>
          Media URLs
        </label>
        {mediaUrls.map((u, i) => (
          <div key={i} style={{ display: "flex", gap: 8, marginBottom: 8 }}>
            <input
              className="input"
              value={u}
              onChange={(e) => setMediaUrl(i, e.target.value)}
              placeholder="https://..."
            />
            <button type="button" className="btn-secondary" onClick={() => removeMediaRow(i)}>
              Remove
            </button>
          </div>
        ))}
        <button type="button" className="btn-secondary" onClick={addMediaRow}>
          Add URL
        </button>

        <label className="field-label" style={{ marginTop: 16 }}>
          Hashtags
        </label>
        <input
          className="input"
          value={hashtags}
          onChange={(e) => setHashtags(e.target.value)}
              placeholder="#Bhubaneswar #SareeLove #EthnicWear"
        />

        <label className="field-label" style={{ marginTop: 16 }}>
          Schedule at
        </label>
        <input
          className="input"
          type="datetime-local"
          value={scheduleAt}
          onChange={(e) => setScheduleAt(e.target.value)}
        />

        <label className="field-label" style={{ marginTop: 16 }}>
          Social account
        </label>
        <select
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

        <label className="field-label" style={{ marginTop: 16 }}>
          Status
        </label>
        <select className="input" value={status} onChange={(e) => setStatus(e.target.value as "DRAFT" | "SCHEDULED")}>
          <option value="DRAFT">Draft</option>
          <option value="SCHEDULED">Scheduled (enqueue publish)</option>
        </select>

        <button type="submit" className="btn-primary" style={{ marginTop: 20 }} disabled={saving || !socialAccountId}>
          {saving ? "Saving…" : "Save post"}
        </button>
      </form>

      <h2 className="section-title">Queue</h2>
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Platform</th>
              <th>Caption</th>
              <th>Status</th>
              <th>Scheduled / published</th>
              <th>Engagement</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {posts.map((p) => {
              const stats = p.engagementStats as { likes?: number; comments?: number } | null;
              return (
                <tr key={p.id}>
                  <td>{p.socialAccount.platform}</td>
                  <td>{p.caption.slice(0, 80)}{p.caption.length > 80 ? "…" : ""}</td>
                  <td>
                    <span style={statusStyle[p.status]}>{p.status}</span>
                  </td>
                  <td>
                    {p.scheduledAt ? new Date(p.scheduledAt).toLocaleString() : "—"}
                    <br />
                    {p.publishedAt ? new Date(p.publishedAt).toLocaleString() : ""}
                  </td>
                  <td>
                    {stats?.likes != null ? `${stats.likes} likes` : "—"}
                    {stats?.comments != null ? ` · ${stats.comments} comments` : ""}
                  </td>
                  <td>
                    {(p.status === "DRAFT" || p.status === "SCHEDULED") && (
                      <button type="button" className="btn-secondary" onClick={() => onDelete(p.id)}>
                        Delete
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
