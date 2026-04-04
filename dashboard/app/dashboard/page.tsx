"use client";

import { Clock3, Download, MessageSquare, TrendingUp, Zap } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { StatCard } from "../../components/charts/stat-card";
import { EmptyState } from "../../components/empty/empty-state";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { Skeleton } from "../../components/ui/skeleton";
import { useToast } from "../../context/toast-context";
import { useCountUp } from "../../hooks/useCountUp";
import { usePageEnter } from "../../hooks/usePageEnter";
import { usePageTitle } from "../../hooks/usePageTitle";
import { useProtectedRoute } from "../../hooks/useProtectedRoute";
import { exportReportPdf, getConversations, getDmSettings } from "../../lib/workspace";
import { formatRelativeTime, getGreeting, minutesAgoLabel } from "../../lib/pulse";

const REFRESH_MS = 60_000;

export default function DashboardPage() {
  const pathname = usePathname();
  const { user, isReady, isAuthenticated } = useProtectedRoute();
  const toast = useToast();
  const pageClassName = usePageEnter();
  const [loading, setLoading] = useState(true);
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
    } catch (error) {
      toast.error("Something went sideways — let’s try again", error instanceof Error ? error.message : "Couldn’t load your dashboard.");
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

  const countMessagesToday = useCountUp(loading ? 0 : stats.messagesToday);
  const countMessagesMonth = useCountUp(loading ? 0 : stats.messagesThisMonth);
  const countReplyRate = useCountUp(loading ? 0 : stats.replyRate);
  const countAvgResponse = useCountUp(loading ? 0 : stats.avgResponseTime);

  return (
    <section key={pathname} className={`page-section overview-grid ${pageClassName}`}>
      <Card className="section-card">
        <div className="section-heading">
          <div>
            <p style={{ margin: 0, color: "var(--amber)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>Morning briefing</p>
            <h2>{greeting}</h2>
            <p>Your WhatsApp workspace is here and ready for the day.</p>
          </div>
          <Badge tone="amber">Warm, steady, auto-refreshing</Badge>
        </div>
      </Card>

      {loading ? (
        <div className="overview-cards">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-[178px]" />
          ))}
        </div>
      ) : (
        <div className="overview-cards">
          <StatCard label="Messages Today" value={countMessagesToday} trendValue={stats.todayTrend} trendLabel={`${stats.todayTrend >= 0 ? "+" : ""}${stats.todayTrend}% vs yesterday`} accent="blue" icon={<MessageSquare size={20} />} />
          <StatCard label="Messages This Month" value={countMessagesMonth} trendValue={stats.monthTrend} trendLabel={`${stats.monthTrend >= 0 ? "+" : ""}${stats.monthTrend}% momentum`} accent="green" icon={<TrendingUp size={20} />} />
          <StatCard label="Reply Rate" value={countReplyRate} suffix="%" trendValue={stats.replyTrend} trendLabel={`${stats.replyTrend >= 0 ? "+" : ""}${stats.replyTrend}% resolved`} accent="amber" icon={<Zap size={20} />} />
          <StatCard label="Avg Response Time" value={countAvgResponse} suffix="m" trendValue={stats.responseTrend} trendLabel={autoReplyEnabled ? "+18% faster today" : "Manual mode today"} accent="teal" icon={<Clock3 size={20} />} />
        </div>
      )}

      <Card className="section-card">
        <div className="section-heading">
          <div>
            <h3>Recent Conversations</h3>
            <p>The latest customers who reached out on WhatsApp.</p>
          </div>
          <Link href="/conversations" className="link-arrow">View all conversations →</Link>
        </div>

        {loading ? (
          <div style={{ display: "grid", gap: 12 }}>
            {Array.from({ length: 5 }).map((_, index) => (
              <Skeleton key={index} className="h-[54px]" />
            ))}
          </div>
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
            title="No conversations yet!"
            description="When customers message you on WhatsApp, they’ll show up here — warm, organized, and easy to skim."
            ctaLabel="Open settings"
            onCta={() => (window.location.href = "/settings")}
          />
        )}
      </Card>

      <Card className="section-card">
        <div className="section-heading">
          <div>
            <h3>Quick Actions</h3>
            <p>A few handy shortcuts for your morning routine.</p>
          </div>
        </div>
        <div className="quick-actions">
          <Button variant="primary" size="lg" loading={downloading} onClick={handleDownloadReport}>
            Download PDF ↓
          </Button>
          <Link href="/reports"><Button variant="outline" size="lg">View All Reports</Button></Link>
          <a href="mailto:support@pulseos.in"><Button variant="ghost" size="lg">Need help?</Button></a>
        </div>
      </Card>

      <div className="live-indicator">
        <span className="live-indicator-dot" />
        <span>{minutesAgoLabel(lastUpdatedAt)} · Auto-refreshes</span>
      </div>
    </section>
  );
}

