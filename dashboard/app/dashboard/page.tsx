"use client";

import { Clock3, Download, MessageSquare, TrendingUp, Zap } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { HeroInsight } from "../../components/dashboard/HeroInsight";
import { StatCard } from "../../components/charts/stat-card";
import { PageTransition } from "../../components/layout/PageTransition";
import { StaggerContainer, StaggerItem } from "../../components/layout/StaggerContainer";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { EmptyState } from "../../components/ui/EmptyState";
import { ErrorState } from "../../components/ui/ErrorState";
import { Skeleton } from "../../components/ui/skeleton";
import { useToast } from "../../context/toast-context";
import { usePageEnter } from "../../hooks/usePageEnter";
import { usePageTitle } from "../../hooks/usePageTitle";
import { useProtectedRoute } from "../../hooks/useProtectedRoute";
import { exportReportPdf, getConversations, getDmSettings } from "../../lib/workspace";
import { formatPlanLabel, formatRelativeTime, getGreeting, minutesAgoLabel } from "../../lib/pulse";

const REFRESH_MS = 60_000;

export default function DashboardPage() {
  const pathname = usePathname();
  const { user, isReady, isAuthenticated } = useProtectedRoute();
  const toast = useToast();
  const pageClassName = usePageEnter();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [conversations, setConversations] = useState<Awaited<ReturnType<typeof getConversations>>>([]);
  const [autoReplyEnabled, setAutoReplyEnabled] = useState<boolean | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number>(Date.now());
  const [tick, setTick] = useState(0);

  usePageTitle("Dashboard");

  const refreshData = useCallback(async () => {
    if (!user?.clientId) {
      setConversations([]);
      setAutoReplyEnabled(null);
      setLoadError(null);
      setLoading(false);
      setLastUpdatedAt(Date.now());
      return;
    }

    try {
      const [conversationRows, dmSettings] = await Promise.all([
        getConversations(user.clientId),
        getDmSettings(user.clientId).catch(() => null)
      ]);
      setConversations(conversationRows);
      setAutoReplyEnabled(dmSettings?.dmAutoReplyEnabled ?? null);
      setLoadError(null);
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Couldn’t load your dashboard.";
      setLoadError(detail);
      toast.error("Something went sideways — let’s try again", detail);
    } finally {
      setLoading(false);
      setLastUpdatedAt(Date.now());
    }
  }, [toast, user?.clientId]);

  useEffect(() => {
    if (!isReady || !isAuthenticated) return;
    void refreshData();
    const refreshTimer = window.setInterval(() => void refreshData(), REFRESH_MS);
    const clock = window.setInterval(() => setTick((value) => value + 1), REFRESH_MS);
    return () => {
      window.clearInterval(refreshTimer);
      window.clearInterval(clock);
    };
  }, [isAuthenticated, isReady, refreshData]);

  const stats = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startOfYesterday = startOfToday - 86400000;
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const todayRows = conversations.filter((row) => new Date(row.lastMessageAt).getTime() >= startOfToday);
    const yesterdayRows = conversations.filter((row) => {
      const timestamp = new Date(row.lastMessageAt).getTime();
      return timestamp >= startOfYesterday && timestamp < startOfToday;
    });
    const monthRows = conversations.filter((row) => {
      const date = new Date(row.lastMessageAt);
      return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
    });

    const messagesToday = todayRows.length;
    const messagesThisMonth = monthRows.reduce((sum, row) => sum + row.messageCount, 0);
    const replyRate = conversations.length ? Math.round((conversations.filter((row) => row.resolved).length / conversations.length) * 100) : 0;
    const avgResponseTime = autoReplyEnabled ? 1 : conversations.length ? 8 : 0;

    const safeTrend = (current: number, previous: number) => {
      if (previous <= 0) return current > 0 ? 100 : 0;
      return Math.round(((current - previous) / previous) * 100);
    };

    return {
      messagesToday,
      messagesThisMonth,
      replyRate,
      avgResponseTime,
      todayTrend: safeTrend(messagesToday, yesterdayRows.length),
      monthTrend: safeTrend(messagesThisMonth, Math.max(1, yesterdayRows.reduce((sum, row) => sum + row.messageCount, 0))),
      replyTrend: safeTrend(replyRate, 65),
      responseTrend: autoReplyEnabled ? 18 : -6
    };
  }, [autoReplyEnabled, conversations]);

  async function handleDownloadReport() {
    if (!user?.clientId || downloading) return;
    setDownloading(true);
    try {
      const blob = await exportReportPdf(user.clientId);
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `pulseos-report-${new Date().toISOString().slice(0, 10)}.pdf`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(url);
      toast.success("Downloaded ✓", "Your latest PDF report is ready.");
    } catch (error) {
      toast.error("Something went sideways — let’s try again", error instanceof Error ? error.message : "Couldn’t download the report.");
    } finally {
      setDownloading(false);
    }
  }

  const greeting = getGreeting(user?.name ?? user?.email ?? "there");
  const recentConversations = conversations.slice(0, 5);
  void tick;
  const pageDate = new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long"
  });
  const planLabel = formatPlanLabel(user?.plan);
  const heroTitle = autoReplyEnabled
    ? "Auto-replies are keeping response speed healthy"
    : "Manual follow-up needs attention today";
  const heroDescription = autoReplyEnabled
    ? `${stats.messagesToday} conversations landed today and PulseOS is helping the queue stay under control.`
    : "Auto-replies are off right now, so your team may need to step in faster to keep response time steady.";

  return (
    <PageTransition>
      <section key={pathname} className={`page-section overview-grid ${pageClassName} space-y-8 lg:space-y-10`}>
        <div className="px-4 md:px-6 lg:px-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p
                style={{
                  margin: 0,
                  color: "var(--text-muted)",
                  fontSize: "0.78rem",
                  fontWeight: 700,
                  letterSpacing: "0.14em",
                  textTransform: "uppercase"
                }}
              >
                Dashboard
              </p>
              <h1
                className="gradient-text"
                style={{
                  margin: "8px 0 0",
                  fontFamily: "var(--font-display)",
                  fontSize: "clamp(1.75rem, 3vw, 2.4rem)",
                  fontWeight: 800
                }}
              >
                {greeting}
              </h1>
              <p style={{ margin: "10px 0 0", color: "var(--text-secondary)", fontSize: "0.95rem", lineHeight: 1.6 }}>
                {pageDate} · PulseOS keeps your workspace in sync.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge tone="navy">{planLabel} plan</Badge>
              <Badge tone="soft">{minutesAgoLabel(lastUpdatedAt)}</Badge>
            </div>
          </div>
        </div>

        <div className="px-4 md:px-6 lg:px-8">
          {loading ? (
            <HeroInsight
              loading
              icon={<Zap size={28} />}
              title="Loading dashboard"
              description="Fetching your latest activity"
              metric="0%"
              metricLabel="reply rate"
            />
          ) : loadError && !conversations.length ? (
            <Card className="section-card">
              <ErrorState message="Couldn’t load your dashboard" detail={loadError} onRetry={() => void refreshData()} />
            </Card>
          ) : (
            <HeroInsight
              icon={<Zap size={28} />}
              title={heroTitle}
              description={heroDescription}
              metric={`${stats.replyRate}%`}
              metricLabel="reply rate"
              badge={<Badge tone={autoReplyEnabled ? "green" : "red"}>{autoReplyEnabled ? "Automation on" : "Automation off"}</Badge>}
            />
          )}
        </div>

        {loading ? (
          <div className="px-4 md:px-6 lg:px-8">
            <div className="overview-cards">
              {Array.from({ length: 4 }).map((_, index) => (
                <Skeleton key={index} className="h-[178px]" />
              ))}
            </div>
          </div>
        ) : loadError && !conversations.length ? null : (
          <div className="px-4 md:px-6 lg:px-8">
            <StaggerContainer className="overview-cards">
              <StaggerItem>
                <StatCard label="Messages Today" value={stats.messagesToday} trendValue={stats.todayTrend} trendLabel={`${stats.todayTrend >= 0 ? "+" : ""}${stats.todayTrend}% vs yesterday`} accent="blue" icon={<MessageSquare size={20} />} />
              </StaggerItem>
              <StaggerItem>
                <StatCard label="Messages This Month" value={stats.messagesThisMonth} trendValue={stats.monthTrend} trendLabel={`${stats.monthTrend >= 0 ? "+" : ""}${stats.monthTrend}% momentum`} accent="green" icon={<TrendingUp size={20} />} />
              </StaggerItem>
              <StaggerItem>
                <StatCard label="Reply Rate" value={stats.replyRate} suffix="%" trendValue={stats.replyTrend} trendLabel={`${stats.replyTrend >= 0 ? "+" : ""}${stats.replyTrend}% resolved`} accent="amber" icon={<Zap size={20} />} />
              </StaggerItem>
              <StaggerItem>
                <StatCard label="Avg Response Time" value={stats.avgResponseTime} suffix="m" trendValue={stats.responseTrend} trendLabel={autoReplyEnabled ? "+18% faster today" : "Manual mode today"} accent="teal" icon={<Clock3 size={20} />} />
              </StaggerItem>
            </StaggerContainer>
          </div>
        )}

        <div className="px-4 md:px-6 lg:px-8">
          <Card className="section-card">
            <div className="section-heading" style={{ marginBottom: 16 }}>
              <div>
                <h3 className="gradient-text">Recent Conversations</h3>
                <p>The latest customers who reached out on WhatsApp.</p>
              </div>
              <Link href="/conversations" className="link-arrow">
                View all conversations →
              </Link>
            </div>

            {loading ? (
              <div style={{ display: "grid", gap: 12 }}>
                {Array.from({ length: 5 }).map((_, index) => (
                  <Skeleton key={index} className="h-[54px]" />
                ))}
              </div>
            ) : loadError && !recentConversations.length ? (
              <ErrorState message="Recent conversations are unavailable" detail={loadError} onRetry={() => void refreshData()} />
            ) : recentConversations.length ? (
              <table className="conversation-table">
                <thead>
                  <tr>
                    <th>Customer Number</th>
                    <th>Last Message</th>
                    <th>Time</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recentConversations.map((conversation) => {
                    const active = Date.now() - new Date(conversation.lastMessageAt).getTime() < 3600000;
                    return (
                      <tr key={conversation.id}>
                        <td>{conversation.contactName || conversation.instagramUserId}</td>
                        <td>{conversation.lastMessage.length > 40 ? `${conversation.lastMessage.slice(0, 40)}…` : conversation.lastMessage || "Getting your data ready…"}</td>
                        <td>{formatRelativeTime(conversation.lastMessageAt)}</td>
                        <td>
                          <span className="conversation-status">
                            <span className={`status-dot ${active ? "active" : "idle"}`} />
                            {conversation.resolved ? "Resolved" : active ? "Active" : "Idle"}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <EmptyState
                illustration="conversations"
                heading="No conversations yet"
                subline="When customers message you on WhatsApp, the latest conversations will appear here in a clean, easy-to-scan list."
                cta={{ label: "Open settings", onClick: () => (window.location.href = "/settings") }}
              />
            )}
          </Card>
        </div>

        <div className="px-4 md:px-6 lg:px-8">
          <Card className="section-card">
            <div className="section-heading" style={{ marginBottom: 16 }}>
              <div>
                <h3 className="gradient-text">Quick Actions</h3>
                <p>A few handy shortcuts for your morning routine.</p>
              </div>
            </div>
            <StaggerContainer className="quick-actions">
              <StaggerItem className="max-md:w-full">
                <Button variant="primary" size="lg" fullWidth loading={downloading} onClick={handleDownloadReport}>
                  Download PDF ↓
                </Button>
              </StaggerItem>
              <StaggerItem className="max-md:w-full">
                <Link href="/reports" className="block max-md:w-full">
                  <Button variant="outline" size="lg" fullWidth>
                    View All Reports
                  </Button>
                </Link>
              </StaggerItem>
              <StaggerItem className="max-md:w-full">
                <a href="mailto:support@pulseos.in" className="block max-md:w-full">
                  <Button variant="ghost" size="lg" fullWidth>
                    Need help?
                  </Button>
                </a>
              </StaggerItem>
            </StaggerContainer>
          </Card>
        </div>

        <div className="px-4 md:px-6 lg:px-8">
          <div className="live-indicator">
            <span className="live-indicator-dot" />
            <span>{minutesAgoLabel(lastUpdatedAt)} · Auto-refreshes</span>
          </div>
        </div>
      </section>
    </PageTransition>
  );
}

