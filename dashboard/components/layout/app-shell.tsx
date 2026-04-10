"use client";

import {
  Bell,
  CreditCard,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquare,
  Settings,
  X,
  FileText,
  Sparkles
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";
import { useAuth } from "../../context/auth-context";
import { useNotifications } from "../../hooks/useNotifications";
import { useTypewriter } from "../../hooks/useTypewriter";
import { cn } from "../../lib/cn";
import { formatPlanLabel, getGreeting, getInitials, routeTitle } from "../../lib/pulse";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";

type Props = {
  children: React.ReactNode;
};

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/conversations", label: "Conversations", icon: MessageSquare },
  { href: "/reports", label: "Reports", icon: FileText },
  { href: "/settings", label: "Settings", icon: Settings },
  { href: "/billing", label: "Billing", icon: CreditCard }
] as const;

export function AppShell({ children }: Props) {
  const pathname = usePathname() ?? "/dashboard";
  const { user, clearSession } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const planLabel = formatPlanLabel(user?.plan);
  const title = routeTitle(pathname);
  const headerLabel = pathname.startsWith("/dashboard") ? getGreeting(user?.name ?? user?.email ?? "there") : title;
  const animatedHeader = useTypewriter(headerLabel, pathname.startsWith("/dashboard") ? 30 : 18);
  const initials = getInitials(user?.name ?? user?.email ?? "PulseOS");
  const { notifications, unreadCount, markAllAsRead } = useNotifications(user?.clientId ?? null);

  const topNotifications = useMemo(() => notifications.slice(0, 4), [notifications]);

  return (
    <div className="app-background min-h-screen">
      <div className="pulse-shell">
        <aside className={cn("pulse-sidebar", mobileOpen && "is-open")}>
          <div className="pulse-sidebar-brand">
            <Link
              href="/dashboard"
              className="sidebar-logo"
              style={{ display: "flex", alignItems: "center", gap: "10px", padding: "0 4px" }}
              onClick={() => setMobileOpen(false)}
            >
              <Image
                src="/logo.png"
                alt="PulseOS"
                width={36}
                height={36}
                priority
                unoptimized
                className="rounded-lg"
                style={{ flexShrink: 0 }}
              />
              <div className="pulse-sidebar-lockup" style={{ display: "flex", flexDirection: "column", lineHeight: 1.2 }}>
                <span className="pulse-wordmark gradient-text" style={{ fontSize: "1rem", fontWeight: 700, letterSpacing: "0.05em" }}>
                  PULSEOS
                </span>
                <span className="pulse-sidebar-tagline" style={{ fontSize: "0.65rem", color: "var(--text-secondary)", letterSpacing: "0.03em" }}>
                  AI social copilot
                </span>
              </div>
            </Link>
            <button
              type="button"
              className="pulse-mobile-close"
              aria-label="Close navigation"
              onClick={() => setMobileOpen(false)}
            >
              <X size={20} aria-hidden />
            </button>
          </div>

          <nav className="pulse-nav">
            {navItems.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn("nav-item interactive", active && "active")}
                  onClick={() => setMobileOpen(false)}
                >
                  <Icon size={18} aria-hidden />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="pulse-sidebar-user">
            <div className="sidebar-user-row">
              <div className="sidebar-avatar" style={{ backgroundColor: "rgba(200,169,81,0.22)" }}>
                {initials}
              </div>
              <div>
                <strong>{user?.name ?? user?.email?.split("@")[0] ?? "PulseOS"}</strong>
                <div className="sidebar-plan-row">
                  <Badge tone="amber">{planLabel} Plan</Badge>
                </div>
              </div>
            </div>
            <Button variant="ghost" className="sidebar-logout" onClick={clearSession}>
              <LogOut size={16} aria-hidden />
              Logout
            </Button>
          </div>
        </aside>

        {mobileOpen ? <button type="button" className="pulse-mobile-backdrop" aria-label="Close navigation" onClick={() => setMobileOpen(false)} /> : null}

        <div className="pulse-shell-content" style={{ background: "var(--bg-primary)" }}>
          <header
            className="pulse-header"
            style={{ background: "var(--bg-secondary)", borderBottom: "1px solid var(--border-glow)", color: "var(--white)" }}
          >
            <div className="pulse-header-left">
              <button type="button" className="pulse-mobile-toggle" aria-label="Open navigation" onClick={() => setMobileOpen(true)}>
                <Menu size={20} aria-hidden />
              </button>
              <div className="pulse-header-brand-wrap">
                <span className="circuit-dot" aria-hidden />
                <p className="pulse-header-brand gradient-text">PULSEOS</p>
              </div>
            </div>
            <div className="pulse-header-center" aria-live="polite">
              {animatedHeader}
            </div>
            <div className="pulse-header-right">
              <Badge tone="amber" className="pulse-header-plan">
                {planLabel} Plan
              </Badge>
              <div className="notification-wrap">
                <button
                  type="button"
                  className="notification-button interactive"
                  aria-label="Notifications"
                  onClick={() => setShowNotifications((open) => !open)}
                >
                  <Bell size={18} aria-hidden />
                  {unreadCount > 0 ? <span className="notification-count">{Math.min(unreadCount, 9)}</span> : null}
                </button>
                {showNotifications ? (
                  <div className="notification-panel">
                    <div className="notification-panel-head">
                      <strong>Updates</strong>
                      <button type="button" onClick={() => void markAllAsRead()}>
                        Mark all read
                      </button>
                    </div>
                    {topNotifications.length ? (
                      topNotifications.map((item) => (
                        <div key={item.id} className="notification-row">
                          <span className="notification-dot" />
                          <div>
                            <strong>{item.title}</strong>
                            <p>{item.body}</p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="notification-empty">
                        <Sparkles size={16} aria-hidden />
                        <span>Everything’s calm here right now.</span>
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
              <div className="header-avatar">{initials}</div>
            </div>
          </header>

          <main className="pulse-main">{children}</main>
          <footer className="pulse-footer" style={{ borderTop: "1px solid var(--border-glow)", padding: "12px 24px", display: "flex", gap: 16, justifyContent: "center", fontSize: "0.75rem", color: "var(--text-secondary)" }}>
            <Link href="/privacy" className="hover:text-white/70 transition-colors">Privacy Policy</Link>
            <span aria-hidden>·</span>
            <Link href="/terms" className="hover:text-white/70 transition-colors">Terms of Service</Link>
            <span aria-hidden>·</span>
            <span>Powered by WhatsApp Business API</span>
          </footer>
        </div>
      </div>
    </div>
  );
}

