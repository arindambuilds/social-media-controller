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
            <div className="sidebar-logo">
              <img src="/logo.png" alt="PulseOS" width={140} style={{ display: "block", height: "auto" }} />
            </div>
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

        <div className="pulse-shell-content">
          <header className="pulse-header">
            <div className="pulse-header-left">
              <button type="button" className="pulse-mobile-toggle" aria-label="Open navigation" onClick={() => setMobileOpen(true)}>
                <Menu size={20} aria-hidden />
              </button>
              <div>
                <p className="pulse-header-brand">PulseOS</p>
              </div>
            </div>
            <div className="pulse-header-center" aria-live="polite">
              {animatedHeader}
            </div>
            <div className="pulse-header-right">
              <Badge tone="amber">{planLabel} Plan</Badge>
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
        </div>
      </div>
    </div>
  );
}

