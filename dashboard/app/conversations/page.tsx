"use client";

import { ArrowLeft } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { EmptyState } from "../../components/empty/empty-state";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Skeleton } from "../../components/ui/skeleton";
import { useToast } from "../../context/toast-context";
import { usePageEnter } from "../../hooks/usePageEnter";
import { usePageTitle } from "../../hooks/usePageTitle";
import { useProtectedRoute } from "../../hooks/useProtectedRoute";
import { cn } from "../../lib/cn";
import { formatCompactTime, formatRelativeTime, hashColor } from "../../lib/pulse";
import { ConversationMessage, ConversationSummary, getConversationMessages, getConversations } from "../../lib/workspace";

const FILTERS = ["all", "active", "today", "this-week"] as const;
type FilterValue = (typeof FILTERS)[number];

export default function ConversationsPage() {
  const pathname = usePathname();
  const { user, isReady, isAuthenticated } = useProtectedRoute();
  const toast = useToast();
  const pageClassName = usePageEnter();
  const [loading, setLoading] = useState(true);
  const [messageLoading, setMessageLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterValue>("all");
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showThread, setShowThread] = useState(false);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const threadRef = useRef<HTMLDivElement | null>(null);

  usePageTitle("Conversations");

  useEffect(() => {
    if (!isReady || !isAuthenticated || !user?.clientId) return;
    let cancelled = false;
    setLoading(true);
    void getConversations(user.clientId)
      .then((rows) => {
        if (cancelled) return;
        setConversations(rows);
        setSelectedId((current) => current ?? rows[0]?.id ?? null);
      })
      .catch((error) => {
        if (!cancelled) {
          toast.error("Something went sideways — let’s try again", error instanceof Error ? error.message : "Couldn’t load conversations.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, isReady, toast, user?.clientId]);

  useEffect(() => {
    if (!user?.clientId || !selectedId) {
      setMessages([]);
      return;
    }
    let cancelled = false;
    setMessageLoading(true);
    void getConversationMessages(user.clientId, selectedId)
      .then((rows) => {
        if (!cancelled) setMessages(rows);
      })
      .catch((error) => {
        if (!cancelled) {
          toast.error("Something went sideways — let’s try again", error instanceof Error ? error.message : "Couldn’t load the conversation.");
        }
      })
      .finally(() => {
        if (!cancelled) setMessageLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedId, toast, user?.clientId]);

  useEffect(() => {
    if (!threadRef.current) return;
    threadRef.current.scrollTop = threadRef.current.scrollHeight;
  }, [messages]);

  const filteredConversations = useMemo(() => {
    const now = Date.now();
    return conversations.filter((conversation) => {
      const text = `${conversation.contactName ?? ""} ${conversation.instagramUserId} ${conversation.lastMessage}`.toLowerCase();
      if (search && !text.includes(search.toLowerCase())) return false;
      const age = now - new Date(conversation.lastMessageAt).getTime();
      if (filter === "active") return age < 86400000;
      if (filter === "today") return age < 86400000;
      if (filter === "this-week") return age < 7 * 86400000;
      return true;
    });
  }, [conversations, filter, search]);

  const selectedConversation = filteredConversations.find((conversation) => conversation.id === selectedId) ?? conversations.find((conversation) => conversation.id === selectedId) ?? null;

  function selectConversation(conversationId: string) {
    setSelectedId(conversationId);
    setShowThread(true);
  }

  function handleThreadBack() {
    setShowThread(false);
  }

  return (
    <section key={pathname} className={`page-section ${pageClassName}`}>
      <div className="conversations-layout">
        <div className={cn("conversation-list-panel", showThread && "max-md:hidden")}>
          <Card className="conversation-list-card">
            <div className="section-heading" style={{ marginBottom: 12 }}>
              <div>
                <h2>Conversations</h2>
                <p>Clean, warm, and easy to scan.</p>
              </div>
            </div>

            <div className="conversation-search">
              <Input label="Search conversations" value={search} onChange={(event) => setSearch(event.target.value)} hint="Search by customer or message" />
            </div>

            <div className="filter-pills">
              {FILTERS.map((item) => (
                <button key={item} type="button" className={`filter-pill ${filter === item ? "active" : ""}`} onClick={() => setFilter(item)}>
                  {item === "all" ? "All" : item === "active" ? "Active" : item === "today" ? "Today" : "This Week"}
                </button>
              ))}
            </div>

            {loading ? (
              <div style={{ display: "grid", gap: 12 }}>
                {Array.from({ length: 6 }).map((_, index) => (
                  <Skeleton key={index} className="h-[70px]" />
                ))}
              </div>
            ) : filteredConversations.length ? (
              <div className="conversation-list">
                {filteredConversations.map((conversation) => {
                  const active = Date.now() - new Date(conversation.lastMessageAt).getTime() < 3600000;
                  return (
                    <button key={conversation.id} type="button" className={`conversation-row interactive ${selectedId === conversation.id ? "is-active" : ""}`} onClick={() => selectConversation(conversation.id)}>
                      <div className="avatar-circle" style={{ backgroundColor: hashColor(conversation.instagramUserId) }}>
                        {(conversation.contactName || conversation.instagramUserId).slice(0, 2).toUpperCase()}
                      </div>
                      <div style={{ minWidth: 0, textAlign: "left" }}>
                        <strong>{conversation.contactName || conversation.instagramUserId}</strong>
                        <p style={{ margin: "4px 0 0", color: "var(--text-secondary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {conversation.lastMessage || "A customer conversation will appear here."}
                        </p>
                      </div>
                      <div style={{ textAlign: "right", color: "var(--text-secondary)", fontSize: "0.85rem" }}>
                        <div>{formatRelativeTime(conversation.lastMessageAt)}</div>
                        {!conversation.resolved && active ? <span className="unread-pulse" style={{ display: "inline-block", marginTop: 10 }} /> : null}
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <EmptyState illustration="conversations" title="No conversations yet!" description="When customers message you on WhatsApp, they’ll show up here — organized and ready to reply." />
            )}
          </Card>
        </div>

        <div
          className={cn(
            "conversation-thread-panel",
            "max-md:absolute max-md:inset-0 max-md:z-10 max-md:transition-transform max-md:duration-[300ms] max-md:[transition-timing-function:var(--ease-smooth)]",
            showThread ? "max-md:translate-x-0" : "max-md:translate-x-full",
            "md:relative md:translate-x-0"
          )}
        >
          <Card className="conversation-thread-card">
          {!selectedConversation ? (
            <EmptyState illustration="conversations" title="Select a conversation to start reading" description="Pick a customer on the left and their latest messages will open here." />
          ) : (
            <>
              <div className="section-heading" style={{ marginBottom: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, flex: 1 }}>
                  <button
                    type="button"
                    className="interactive md:hidden"
                    onClick={handleThreadBack}
                    aria-label="Back to conversations"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: 40,
                      height: 40,
                      borderRadius: 12,
                      border: "1px solid rgba(13,27,62,0.12)",
                      background: "var(--surface-2)",
                      color: "var(--navy)"
                    }}
                  >
                    <ArrowLeft size={20} aria-hidden />
                  </button>
                  <div style={{ minWidth: 0 }}>
                    <h2>{selectedConversation.contactName || selectedConversation.instagramUserId}</h2>
                    <p>{selectedConversation.messageCount} messages in this thread</p>
                  </div>
                </div>
                {selectedConversation.resolved ? <Badge tone="green">Resolved</Badge> : <Badge tone="amber">Active</Badge>}
              </div>

              {messageLoading ? (
                <div style={{ display: "grid", gap: 12 }}>
                  {Array.from({ length: 5 }).map((_, index) => (
                    <Skeleton key={index} className="h-[64px]" />
                  ))}
                </div>
              ) : messages.length ? (
                <div ref={threadRef} className="thread-scroll">
                  <div className="date-divider">Today</div>
                  {messages.map((message) => (
                    <div key={message.id} className={`message-row ${message.direction === "outbound" ? "outbound" : ""}`}>
                      <div className={`message-bubble ${message.direction === "outbound" ? "outbound" : "inbound"}`}>
                        {message.direction === "outbound" ? <div style={{ fontSize: "0.72rem", fontWeight: 700, marginBottom: 6, opacity: 0.8 }}>PulseOS AI</div> : null}
                        <div>{message.content}</div>
                        <div className="message-meta">{formatCompactTime(message.sentAt)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState illustration="conversations" title="This thread is quiet right now" description="New messages will appear here as soon as your customer writes in." />
              )}

              <div className="ai-banner">PulseOS AI handles all replies automatically.</div>
            </>
          )}
          </Card>
        </div>
      </div>
    </section>
  );
}
