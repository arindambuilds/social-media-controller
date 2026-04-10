"use client";

import { ArrowLeft } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { PageTransition } from "../../components/layout/PageTransition";
import { StaggerContainer, StaggerItem } from "../../components/layout/StaggerContainer";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { EmptyState } from "../../components/ui/EmptyState";
import { ErrorState } from "../../components/ui/ErrorState";
import { Input } from "../../components/ui/input";
import { Skeleton } from "../../components/ui/skeleton";
import { useToast } from "../../context/toast-context";
import { usePageEnter } from "../../hooks/usePageEnter";
import { usePageTitle } from "../../hooks/usePageTitle";
import { useProtectedRoute } from "../../hooks/useProtectedRoute";
import { cn } from "../../lib/cn";
import { formatCompactTime, formatRelativeTime, hashColor } from "../../lib/pulse";
import { apiFetch } from "../../lib/api";
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
  const [listError, setListError] = useState<string | null>(null);
  const [threadError, setThreadError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterValue>("all");
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showThread, setShowThread] = useState(false);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const threadRef = useRef<HTMLDivElement | null>(null);
  const [message, setMessage] = useState("");
  const [suggestions, setSuggestions] = useState<Array<{text: string, tone: string}>>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

  usePageTitle("Conversations");

  useEffect(() => {
    if (!isReady || !isAuthenticated || !user?.clientId) return;
    let cancelled = false;
    setLoading(true);
    void getConversations(user.clientId)
      .then((rows) => {
        if (cancelled) return;
        setListError(null);
        setConversations(rows);
        setSelectedId((current) => current ?? rows[0]?.id ?? null);
      })
      .catch((error) => {
        if (!cancelled) {
          const detail = error instanceof Error ? error.message : "Couldn't load conversations.";
          setListError(detail);
          toast.error("Something went sideways — let's try again", detail);
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
      setThreadError(null);
      return;
    }
    let cancelled = false;
    setMessageLoading(true);
    void getConversationMessages(user.clientId, selectedId)
      .then((rows) => {
        if (!cancelled) {
          setThreadError(null);
          setMessages(rows);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          const detail = error instanceof Error ? error.message : "Couldn't load the conversation.";
          setThreadError(detail);
          toast.error("Something went sideways — let's try again", detail);
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

  async function reloadConversations() {
    if (!user?.clientId) return;
    try {
      const rows = await getConversations(user.clientId);
      setListError(null);
      setConversations(rows);
      setSelectedId((current) => current ?? rows[0]?.id ?? null);
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Couldn't load conversations.";
      setListError(detail);
      toast.error("Something went sideways — let's try again", detail);
    }
  }

  async function reloadSelectedConversation() {
    if (!user?.clientId || !selectedId) return;
    setMessageLoading(true);
    try {
      const rows = await getConversationMessages(user.clientId, selectedId);
      setThreadError(null);
      setMessages(rows);
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Couldn't load the conversation.";
      setThreadError(detail);
      toast.error("Something went sideways — let's try again", detail);
    } finally {
      setMessageLoading(false);
    }
  }

  function selectConversation(conversationId: string) {
    setSelectedId(conversationId);
    setShowThread(true);
  }

  function handleThreadBack() {
    setShowThread(false);
  }

  async function handleSuggestReply() {
    if (!selectedConversation || !user) return;
    setLoadingSuggestions(true);
    try {
      const lastInbound = messages.filter(m => m.direction === 'inbound').pop();
      const lastMessage = lastInbound?.content || '';
      const data = await apiFetch<{ suggestions: Array<{text: string, tone: string}> }>('/ai/suggest-reply', {
        method: 'POST',
        body: JSON.stringify({
          conversationId: selectedId,
          lastMessage,
          businessName: (user as any).businessName || 'Our Business',
          businessType: (user as any).businessType || 'General'
        })
      });
      setSuggestions(data.suggestions || []);
    } catch (error) {
      console.error('Failed to get suggestions', error);
      toast.error('Could not get suggestions', 'Please try again.');
    } finally {
      setLoadingSuggestions(false);
    }
  }

  return (
    <PageTransition>
      <section key={pathname} className={`page-section ${pageClassName} px-4 md:px-6 lg:px-8`}>
        <div className="conversations-layout">
          <div className={cn("conversation-list-panel", showThread && "max-md:hidden")}>
            <Card className="conversation-list-card">
              <div className="section-heading" style={{ marginBottom: 16 }}>
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
              ) : listError && !filteredConversations.length ? (
                <ErrorState message="Couldn't load conversations" detail={listError} onRetry={() => void reloadConversations()} />
              ) : filteredConversations.length ? (
                <StaggerContainer className="conversation-list">
                  {filteredConversations.map((conversation) => {
                    const active = Date.now() - new Date(conversation.lastMessageAt).getTime() < 3600000;
                    return (
                      <StaggerItem key={conversation.id}>
                        <button type="button" className={`conversation-row interactive ${selectedId === conversation.id ? "is-active" : ""}`} onClick={() => selectConversation(conversation.id)}>
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
                      </StaggerItem>
                    );
                  })}
                </StaggerContainer>
              ) : (
                <EmptyState
                  illustration="conversations"
                  heading="No conversations yet"
                  subline="When customers start messaging you on WhatsApp, their conversations will appear here, organised and ready to reply."
                />
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
                <EmptyState
                  illustration="conversations"
                  heading="Select a conversation to read"
                  subline="Pick a customer on the left and the latest messages will open here with the full thread."
                />
              ) : (
                <>
                  <div className="section-heading" style={{ marginBottom: 16 }}>
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
                          border: "1px solid rgba(139,92,246,0.25)",
                          background: "var(--bg-card)",
                          color: "var(--white)"
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
                  ) : threadError && !messages.length ? (
                    <ErrorState message="Couldn't load this thread" detail={threadError} onRetry={() => void reloadSelectedConversation()} />
                  ) : messages.length ? (
                    <div ref={threadRef} className="thread-scroll">
                      <div className="date-divider">Today</div>
                      <StaggerContainer className="grid gap-3">
                        {messages.map((msg) => (
                          <StaggerItem key={msg.id}>
                            <div className={`message-row ${msg.direction === "outbound" ? "outbound" : ""}`}>
                              <div className={`message-bubble ${msg.direction === "outbound" ? "outbound" : "inbound"}`}>
                                {msg.direction === "outbound" ? <div style={{ fontSize: "0.72rem", fontWeight: 700, marginBottom: 6, opacity: 0.8 }}>PulseOS AI</div> : null}
                                <div>{msg.content}</div>
                                <div className="message-meta">{formatCompactTime(msg.sentAt)}</div>
                              </div>
                            </div>
                          </StaggerItem>
                        ))}
                      </StaggerContainer>
                    </div>
                  ) : (
                    <EmptyState
                      illustration="conversations"
                      heading="This thread is quiet right now"
                      subline="New messages will appear here as soon as the customer replies again."
                    />
                  )}

                  <div className="ai-banner">PulseOS AI handles all replies automatically.</div>

                  <div className="message-input-section">
                    {suggestions.length > 0 && (
                      <div className="suggestions-container">
                        <span className="powered-by-ai">Powered by AI</span>
                        <div className="suggestion-chips">
                          {suggestions.map((sug, i) => (
                            <button
                              key={i}
                              type="button"
                              className="suggestion-chip"
                              onClick={() => setMessage(sug.text)}
                            >
                              {sug.text}
                              <Badge tone="soft" className="ml-2">{sug.tone}</Badge>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="message-input-row">
                      <Input
                      label="Reply"
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        placeholder="Type your reply..."
                        className="flex-1"
                      />
                      <Button
                        onClick={handleSuggestReply}
                        loading={loadingSuggestions}
                        variant="outline"
                        className="ml-2"
                      >
                        ✨ Suggest Reply
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </Card>
          </div>
        </div>
      </section>
    </PageTransition>
  );
}
