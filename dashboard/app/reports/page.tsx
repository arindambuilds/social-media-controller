"use client";

import { BarChart3, Download, MessageCircleMore, Send, Users } from "lucide-react";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { BarChart } from "../../components/charts/bar-chart";
import { PageTransition } from "../../components/layout/PageTransition";
import { StaggerContainer, StaggerItem } from "../../components/layout/StaggerContainer";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { EmptyState } from "../../components/ui/EmptyState";
import { ErrorState } from "../../components/ui/ErrorState";
import { Skeleton } from "../../components/ui/skeleton";
import { useToast } from "../../context/toast-context";
import { useCountUp } from "../../hooks/useCountUp";
import { usePageEnter } from "../../hooks/usePageEnter";
import { usePageTitle } from "../../hooks/usePageTitle";
import { useProtectedRoute } from "../../hooks/useProtectedRoute";
import { ConversationMessage, ConversationSummary, exportReportPdf, getConversationMessages, getConversations } from "../../lib/workspace";

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(date: Date): string {
  return date.toLocaleDateString("en-IN", { month: "short", year: "numeric" });
}

export default function ReportsPage() {
  const pathname = usePathname();
  const { user, isReady, isAuthenticated } = useProtectedRoute();
  const toast = useToast();
  const pageClassName = usePageEnter();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<"idle" | "loading" | "done">("idle");
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [messageMap, setMessageMap] = useState<Record<string, ConversationMessage[]>>({});

  usePageTitle("Reports");

  const loadReports = useCallback(async () => {
    if (!user?.clientId) {
      setLoading(false);
      return;
    }
    try {
      const rows = await getConversations(user.clientId);
      setConversations(rows);
      const messageEntries = await Promise.all(
        rows.slice(0, 24).map(async (conversation) => [conversation.id, await getConversationMessages(user.clientId!, conversation.id)] as const)
      );
      setMessageMap(Object.fromEntries(messageEntries));
      setLoadError(null);
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Couldn’t load reports.";
      setLoadError(detail);
      toast.error("Something went sideways — let’s try again", detail);
    } finally {
      setLoading(false);
    }
  }, [toast, user?.clientId]);

  useEffect(() => {
    if (!isReady || !isAuthenticated) return;
    void loadReports();
  }, [isAuthenticated, isReady, loadReports]);

  const reportData = useMemo(() => {
    const monthBuckets = new Map<string, { label: string; inbound: number; outbound: number; contacts: Set<string> }>();
    const now = new Date();
    for (let offset = 5; offset >= 0; offset -= 1) {
      const date = new Date(now.getFullYear(), now.getMonth() - offset, 1);
      monthBuckets.set(monthKey(date), { label: monthLabel(date), inbound: 0, outbound: 0, contacts: new Set<string>() });
    }

    conversations.forEach((conversation) => {
      const messages = messageMap[conversation.id] ?? [];
      messages.forEach((message) => {
        const date = new Date(message.sentAt);
        const key = monthKey(date);
        const bucket = monthBuckets.get(key);
        if (!bucket) return;
        if (message.direction === "outbound") bucket.outbound += 1;
        else bucket.inbound += 1;
        bucket.contacts.add(conversation.instagramUserId);
      });
    });

    const items = Array.from(monthBuckets.values());
    const current = items[items.length - 1] ?? { inbound: 0, outbound: 0, contacts: new Set<string>(), label: monthLabel(new Date()) };
    const replyRate = current.inbound > 0 ? Math.round((current.outbound / current.inbound) * 100) : 0;

    return {
      current,
      replyRate,
      history: items,
      bars: items.map((item) => ({ label: item.label.split(" ")[0] ?? item.label, value: item.inbound + item.outbound }))
    };
  }, [conversations, messageMap]);

  const heroInbound = useCountUp(loading ? 0 : reportData.current.inbound);
  const heroOutbound = useCountUp(loading ? 0 : reportData.current.outbound);
  const heroReply = useCountUp(loading ? 0 : reportData.replyRate);
  const heroContacts = useCountUp(loading ? 0 : reportData.current.contacts.size);

  async function handleDownload() {
    if (!user?.clientId || downloading === "loading") return;
    setDownloading("loading");
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
      setDownloading("done");
      toast.success("Downloaded ✓", "Your PDF report is ready.");
      window.setTimeout(() => setDownloading("idle"), 2000);
    } catch (error) {
      setDownloading("idle");
      toast.error("Something went sideways — let’s try again", error instanceof Error ? error.message : "Couldn’t download the report.");
    }
  }

  const currentMonthTitle = new Date().toLocaleDateString("en-IN", { month: "long", year: "numeric" });

  return (
    <PageTransition>
      <section key={pathname} className={`page-section overview-grid ${pageClassName} px-4 md:px-6 lg:px-8`}>
        {loading ? (
          <Skeleton className="h-[240px]" />
        ) : loadError && !conversations.length ? (
          <Card className="section-card">
            <ErrorState message="Couldn’t load reports" detail={loadError} onRetry={() => void loadReports()} />
          </Card>
        ) : conversations.length ? (
          <Card className="report-hero-card">
            <div className="section-heading" style={{ marginBottom: 16 }}>
              <div>
                <p style={{ margin: 0, color: "var(--accent-cyan)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>Latest report</p>
                <h2 className="gradient-text" style={{ fontSize: "2rem", margin: "8px 0 0" }}>{currentMonthTitle}</h2>
                <p>Generated on {new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</p>
              </div>
              <Button variant="primary" size="lg" loading={downloading === "loading"} onClick={handleDownload}>
                {downloading === "done" ? "Downloaded ✓" : downloading === "loading" ? "Downloading…" : "Download PDF ↓"}
              </Button>
            </div>
            <StaggerContainer className="report-stat-grid">
              <StaggerItem className="report-mini-stat">
                <MessageCircleMore size={18} />
                <strong style={{ fontVariantNumeric: "tabular-nums" }}>{heroInbound.toLocaleString("en-IN")}</strong>
                <span>Messages Received</span>
              </StaggerItem>
              <StaggerItem className="report-mini-stat">
                <Send size={18} />
                <strong style={{ fontVariantNumeric: "tabular-nums" }}>{heroOutbound.toLocaleString("en-IN")}</strong>
                <span>Messages Sent</span>
              </StaggerItem>
              <StaggerItem className="report-mini-stat">
                <BarChart3 size={18} />
                <strong style={{ fontVariantNumeric: "tabular-nums" }}>{heroReply}%</strong>
                <span>Reply Rate</span>
              </StaggerItem>
              <StaggerItem className="report-mini-stat">
                <Users size={18} />
                <strong style={{ fontVariantNumeric: "tabular-nums" }}>{heroContacts}</strong>
                <span>Unique Customers</span>
              </StaggerItem>
            </StaggerContainer>
          </Card>
        ) : (
          <Card className="section-card">
            <EmptyState
              illustration="reports"
              heading="Your first report is on its way"
              subline="PulseOS generates polished monthly reporting once customer conversations start flowing in."
            />
          </Card>
        )}

        <Card className="section-card">
          <div className="section-heading" style={{ marginBottom: 16 }}>
            <div>
              <h3 className="gradient-text">All Reports</h3>
              <p>{reportData.history.length} monthly snapshots ready to browse.</p>
            </div>
            <Badge tone="soft">{reportData.history.length} reports</Badge>
          </div>

          {loading ? (
            <div style={{ display: "grid", gap: 12 }}>
              {Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-[56px]" />)}
            </div>
          ) : loadError && !conversations.length ? (
            <ErrorState message="Report history is unavailable" detail={loadError} onRetry={() => void loadReports()} />
          ) : conversations.length ? (
            <table className="report-history-table">
              <thead>
                <tr>
                  <th>Month</th>
                  <th>Messages In</th>
                  <th>Messages Out</th>
                  <th>Reply Rate</th>
                  <th>Contacts</th>
                  <th>Download</th>
                </tr>
              </thead>
              <tbody>
                {reportData.history.map((item) => {
                  const rate = item.inbound > 0 ? Math.round((item.outbound / item.inbound) * 100) : 0;
                  return (
                    <tr key={item.label}>
                      <td>{item.label}</td>
                      <td>{item.inbound.toLocaleString("en-IN")}</td>
                      <td>{item.outbound.toLocaleString("en-IN")}</td>
                      <td><Badge tone={rate > 80 ? "green" : rate >= 60 ? "amber" : "red"}>{rate}%</Badge></td>
                      <td>{item.contacts.size}</td>
                      <td><button type="button" className="link-arrow" onClick={handleDownload}>Download PDF ↓</button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <EmptyState
              illustration="reports"
              heading="No monthly history yet"
              subline="As soon as customer conversations start flowing in, your monthly timeline will appear here."
            />
          )}
        </Card>

        <Card className="section-card">
          {loading ? <Skeleton className="h-[260px]" /> : <BarChart items={reportData.bars} />}
        </Card>
      </section>
    </PageTransition>
  );
}

