"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { apiFetch, fetchMe } from "../../../lib/api";
import { CLIENT_ID_KEY, getStoredClientId, getStoredToken } from "../../../lib/auth-storage";
import { PageHeader } from "../../../components/ui/page-header";
import { trackEvent } from "../../../lib/trackEvent";

type ConversationRow = {
  id: string;
  contactName: string | null;
  instagramUserId: string;
  lastMessage: string;
  lastMessageAt: string;
  messageCount: number;
  resolved: boolean;
};

type MessageRow = {
  id: string;
  direction: "inbound" | "outbound";
  content: string;
  sentAt: string;
  isAutoReply: boolean;
  confidenceScore: number | null;
};

function formatRelative(iso: string): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "—";
  const sec = Math.floor((Date.now() - t) / 1000);
  if (sec < 45) return "just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} minute${min === 1 ? "" : "s"} ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} hour${hr === 1 ? "" : "s"} ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day} day${day === 1 ? "" : "s"} ago`;
  return new Date(iso).toLocaleDateString();
}

function previewText(s: string, max = 60): string {
  const t = s.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t || "—";
  return `${t.slice(0, max)}…`;
}

function DmInboxListSkeleton() {
  return (
    <div className="flex flex-col gap-2 p-3">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="rounded-xl border border-subtle p-4">
          <div className="skeleton mb-2 h-4 w-3/5 rounded" />
          <div className="skeleton h-3 w-full rounded" />
        </div>
      ))}
    </div>
  );
}

export default function DmInboxPage() {
  const router = useRouter();
  const threadEndRef = useRef<HTMLDivElement>(null);
  const [clientId, setClientId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState("");
  const [listLoading, setListLoading] = useState(true);
  const [conversations, setConversations] = useState<ConversationRow[]>([]);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [rewardMessage, setRewardMessage] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter((c) => {
      const name = (c.contactName ?? "").toLowerCase();
      const ig = c.instagramUserId.toLowerCase();
      return name.includes(q) || ig.includes(q);
    });
  }, [conversations, search]);

  const selected = useMemo(
    () => conversations.find((c) => c.id === selectedId) ?? null,
    [conversations, selectedId]
  );

  const loadList = useCallback(async (cid: string) => {
    const data = await apiFetch<ConversationRow[]>(
      `/clients/${encodeURIComponent(cid)}/dm-conversations`
    );
    setConversations(Array.isArray(data) ? data : []);
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
          setLoadError("No client assigned.");
          setListLoading(false);
          return;
        }
        if (me.user.role === "AGENCY_ADMIN" && !cid) {
          cid = "demo-client";
          localStorage.setItem(CLIENT_ID_KEY, cid);
        }
        if (!cid) {
          setLoadError("No client context.");
          setListLoading(false);
          return;
        }
        setClientId(cid);
        localStorage.setItem(CLIENT_ID_KEY, cid);
        await loadList(cid);
      } catch (e) {
        setLoadError(e instanceof Error ? e.message : "Failed to load conversations");
      } finally {
        setListLoading(false);
      }
    })();
  }, [router, loadList]);

  useEffect(() => {
    if (!clientId || !selectedId) {
      setMessages([]);
      return;
    }
    let cancelled = false;
    (async () => {
      setMessagesLoading(true);
      try {
        const data = await apiFetch<MessageRow[]>(
          `/clients/${encodeURIComponent(clientId)}/dm-conversations/${encodeURIComponent(selectedId)}/messages`
        );
        if (!cancelled) setMessages(Array.isArray(data) ? data : []);
      } catch {
        if (!cancelled) setMessages([]);
      } finally {
        if (!cancelled) setMessagesLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [clientId, selectedId]);

  useLayoutEffect(() => {
    if (!messagesLoading && messages.length) {
      threadEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [messages, messagesLoading, selectedId]);

  const displayName = (c: ConversationRow) => c.contactName?.trim() || "Instagram user";

  function showReplyReward() {
    setRewardMessage("Replied! You just improved your engagement. 💬");
    trackEvent("dm_replied");
    window.setTimeout(() => setRewardMessage(null), 3000);
  }

  return (
    <div className="page-shell">
      <PageHeader
        eyebrow="Instagram"
        title="DM inbox"
        description="Read-only view of Instagram DM threads handled by auto-reply (v1)."
      />

      {loadError ? <p className="text-error mb-4">{loadError}</p> : null}

      <div className="mt-6 grid min-h-[min(70vh,640px)] grid-cols-1 gap-4 lg:grid-cols-[minmax(280px,340px)_1fr]">
        <div className="gradient-border flex min-h-0 flex-col overflow-hidden p-0">
          <div className="border-subtle border-b p-3">
            <input
              type="search"
              className="input w-full text-sm"
              placeholder="Search by name or Instagram ID…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Filter conversations"
            />
          </div>
          <div className="min-h-[280px] flex-1 overflow-y-auto lg:min-h-[400px]">
            {listLoading ? (
              <DmInboxListSkeleton />
            ) : filtered.length === 0 ? (
              <p className="text-muted p-6 text-center text-sm leading-relaxed">
                No DM conversations yet. Once Instagram DMs are received, they will appear here.
              </p>
            ) : (
              <ul className="flex flex-col gap-0 p-2">
                {filtered.map((c) => {
                  const active = c.id === selectedId;
                  return (
                    <li key={c.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedId(c.id)}
                        className={`w-full rounded-xl border px-3 py-3 text-left transition-colors ${
                          active
                            ? "border-accent-purple/50 bg-accent-purple/12"
                            : "border-transparent hover:border-subtle hover:bg-surface/60"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-ink line-clamp-1 font-semibold">{displayName(c)}</span>
                          <span
                            className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${
                              c.resolved ? "bg-accent-teal" : "bg-warning"
                            }`}
                            title={c.resolved ? "Resolved" : "Open"}
                            aria-hidden
                          />
                        </div>
                        <p className="text-muted mt-1 line-clamp-2 text-xs">{previewText(c.lastMessage)}</p>
                        <div className="text-muted mt-2 flex items-center justify-between text-[0.65rem] font-medium uppercase tracking-wide">
                          <span>{formatRelative(c.lastMessageAt)}</span>
                          <span className="rounded-md bg-surface px-2 py-0.5 font-bold tabular-nums text-ink">
                            {c.messageCount}
                          </span>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        <div className="gradient-border flex min-h-[320px] min-w-0 flex-col overflow-hidden p-0 lg:min-h-0">
          {!selectedId ? (
            <div className="text-muted flex flex-1 items-center justify-center p-8 text-center text-sm">
              Select a conversation to view messages
            </div>
          ) : (
            <>
              <div className="border-subtle bg-surface/40 border-b px-4 py-3">
                <div className="text-ink font-display text-lg font-bold">{displayName(selected!)}</div>
                <div className="text-muted mt-0.5 font-mono text-xs">{selected!.instagramUserId}</div>
              </div>
              <div className="flex flex-1 flex-col overflow-hidden">
                {messagesLoading ? (
                  <div className="flex flex-1 items-center justify-center">
                    <div className="spinner" aria-label="Loading messages" />
                  </div>
                ) : (
                  <div className="flex-1 space-y-4 overflow-y-auto p-4">
                    {messages.map((m) => {
                      const inbound = m.direction === "inbound";
                      const pct =
                        m.confidenceScore != null
                          ? Math.round(Math.min(1, Math.max(0, m.confidenceScore)) * 100)
                          : null;
                      const confOk = pct != null && pct >= 70;
                      return (
                        <div
                          key={m.id}
                          className={`flex flex-col ${inbound ? "items-start" : "items-end"}`}
                        >
                          <div
                            className={`max-w-[min(100%,420px)] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                              inbound
                                ? "rounded-tl-sm bg-[#1e1e2e] text-ink"
                                : "rounded-tr-sm bg-accent-purple/25 text-ink"
                            }`}
                          >
                            {m.content}
                          </div>
                          <div
                            className={`text-muted mt-1 flex flex-wrap items-center gap-2 text-[0.7rem] ${inbound ? "justify-start" : "justify-end"}`}
                          >
                            <span>{new Date(m.sentAt).toLocaleString()}</span>
                            {!inbound && m.isAutoReply ? (
                              <span className="text-accent-purple font-semibold">Claude</span>
                            ) : null}
                            {pct != null ? (
                              <span
                                className={`rounded px-1.5 py-0.5 font-bold tabular-nums ${
                                  confOk ? "bg-accent-teal/20 text-accent-teal" : "bg-warning/20 text-warning"
                                }`}
                              >
                                {pct}% confidence
                              </span>
                            ) : null}
                          </div>
                        </div>
                      );
                    })}
                    <div ref={threadEndRef} />
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
      {rewardMessage ? (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl border border-accent-teal/30 bg-[#111118] px-5 py-3 text-sm font-medium text-accent-teal shadow-lg">
          {rewardMessage}
        </div>
      ) : null}
    </div>
  );
}
