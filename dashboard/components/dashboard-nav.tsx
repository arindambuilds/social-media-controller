"use client";

import { ChevronDown, LogOut, Menu, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../context/auth-context";
import { ThemeToggle } from "./theme-toggle";
import { NotificationBell } from "./NotificationBell";

/** Primary MVP nav (5 pages). */
const primaryLinks = [
  { href: "/analytics", label: "Analytics" },
  { href: "/insights", label: "Insights" },
  { href: "/leads", label: "Leads" },
  { href: "/posts", label: "Posts" },
  { href: "/accounts", label: "Accounts" }
] as const;

type SecondaryNavLink = { href: string; label: string; authOnly?: boolean; adminOnly?: boolean };

const secondaryLinks: SecondaryNavLink[] = [
  { href: "/", label: "Home" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/conversations", label: "WhatsApp chats", authOnly: true },
  { href: "/campaigns", label: "Campaigns", authOnly: true },
  { href: "/reports", label: "Reports", authOnly: true },
  { href: "/settings", label: "Settings", authOnly: true },
  { href: "/pulse", label: "Daily briefing", authOnly: true },
  { href: "/usage", label: "📊 Usage", authOnly: true },
  { href: "/billing", label: "💳 Billing", authOnly: true },
  { href: "/settings/branding", label: "🎨 Brand settings", authOnly: true },
  { href: "/dashboard/dm-settings", label: "DM settings", authOnly: true },
  { href: "/dashboard/dm-inbox", label: "DM inbox", authOnly: true },
  { href: "/onboarding", label: "Connect" },
  { href: "/audit", label: "Audit" },
  { href: "/admin/system", label: "System", authOnly: true, adminOnly: true },
  { href: "/login", label: "Login" }
];

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function userInitials(user: { name: string | null; email: string }): string {
  const n = user.name?.trim();
  if (n) {
    const parts = n.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase() || "?";
    }
    return n.slice(0, 2).toUpperCase();
  }
  const local = user.email.split("@")[0] ?? "?";
  return local.slice(0, 2).toUpperCase();
}

const AVATAR_GRADIENT = "linear-gradient(135deg, #6c63ff, #00d4aa)";

type NavLinksProps = {
  pathname: string;
  hasToken: boolean;
  showAuditLink: boolean;
  showAdminLink: boolean;
  onNavigate: () => void;
  variant: "bar" | "drawer";
};

function NavLinks({ pathname, hasToken, showAuditLink, showAdminLink, onNavigate, variant }: NavLinksProps) {
  const wrapClass = variant === "drawer" ? "app-nav-drawer-groups" : "app-nav-group-wrap";
  const linkClass = variant === "drawer" ? "app-nav-link app-nav-link--drawer" : "app-nav-link";

  return (
    <div className={wrapClass}>
      <div className="app-nav-group">
        <span className="app-nav-group-label">App</span>
        {primaryLinks.map(({ href, label }) => (
          <Link
            key={href}
            href={href}
            className={linkClass}
            data-active={isActive(pathname, href) ? "true" : undefined}
            style={isActive(pathname, href) ? { borderLeft: "2px solid var(--accent-cyan)", background: "var(--bg-card)" } : undefined}
            onClick={onNavigate}
          >
            {label}
          </Link>
        ))}
      </div>
      <div className="app-nav-group">
        <span className="app-nav-group-label">More</span>
        {secondaryLinks.map(({ href, label, authOnly, adminOnly }) => {
          if (authOnly && !hasToken) return null;
          if (href === "/login" && hasToken) return null;
          if (href === "/onboarding" && !hasToken) return null;
          if (href === "/audit" && !showAuditLink) return null;
          if (adminOnly && !showAdminLink) return null;
          return (
            <Link
              key={href}
              href={href}
              className={linkClass}
              data-active={isActive(pathname, href) ? "true" : undefined}
              style={isActive(pathname, href) ? { borderLeft: "2px solid var(--accent-cyan)", background: "var(--bg-card)" } : undefined}
              onClick={onNavigate}
            >
              {label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

export function DashboardNav() {
  const pathname = usePathname() ?? "/";
  const router = useRouter();
  const { token, isReady, user, userLoading, clearSession } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const hasToken = isReady && !!token;
  const showAuditLink = !userLoading && user?.role === "AGENCY_ADMIN";
  const showAdminLink = !userLoading && user?.role === "AGENCY_ADMIN";

  const closeMenu = useCallback(() => setMenuOpen(false), []);
  const closeUserMenu = useCallback(() => setUserMenuOpen(false), []);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setMenuOpen(false);
      setUserMenuOpen(false);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    const el = document.body;
    const apply = () => {
      el.style.overflow = window.matchMedia("(max-width: 767px)").matches ? "hidden" : "";
    };
    apply();
    const mq = window.matchMedia("(max-width: 767px)");
    mq.addEventListener("change", apply);
    return () => {
      mq.removeEventListener("change", apply);
      el.style.overflow = "";
    };
  }, [menuOpen]);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  useEffect(() => {
    if (!userMenuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setUserMenuOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [userMenuOpen]);

  useEffect(() => {
    if (!userMenuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [userMenuOpen]);

  const avatarStyle = useMemo(() => ({ background: AVATAR_GRADIENT }), []);

  function signOut() {
    clearSession();
    closeUserMenu();
    closeMenu();
    router.push("/login");
  }

  return (
    <header className="app-nav" style={{ background: "var(--bg-secondary)" }}>
      <div className="app-nav-inner">
        <Link
          href={hasToken ? "/dashboard" : "/"}
          className="app-nav-brand-wrap"
          style={{ display: "flex", alignItems: "center", gap: "10px", padding: "0 4px" }}
        >
          <Image
            src="/logo.png"
            alt="PulseOS"
            width={36}
            height={36}
            className="rounded-lg"
            style={{ flexShrink: 0 }}
          />
          <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.2 }}>
            <span className="app-nav-brand gradient-text" style={{ fontSize: "1rem", fontWeight: 700, letterSpacing: "0.05em" }}>
              PULSEOS
            </span>
            <span style={{ fontSize: "0.65rem", color: "var(--text-secondary)", letterSpacing: "0.03em" }}>
              AI social copilot
            </span>
          </div>
        </Link>

        <button
          type="button"
          className="app-nav-menu-toggle"
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          aria-expanded={menuOpen}
          aria-controls="app-nav-drawer"
          onClick={() => setMenuOpen((o) => !o)}
        >
          {menuOpen ? <X size={22} strokeWidth={2} aria-hidden /> : <Menu size={22} strokeWidth={2} aria-hidden />}
        </button>

        <nav id="app-nav-links" className="app-nav-center" aria-label="Primary">
          <NavLinks
            pathname={pathname}
            hasToken={hasToken}
            showAuditLink={showAuditLink}
            showAdminLink={showAdminLink}
            onNavigate={closeMenu}
            variant="bar"
          />
        </nav>

        <div className="app-nav-trailing">
          {hasToken && user ? (
            <>
              <NotificationBell />
              <div className="app-nav-user-desktop" ref={userMenuRef}>
              <button
                type="button"
                className="app-nav-user-trigger"
                aria-expanded={userMenuOpen}
                aria-haspopup="menu"
                onClick={() => setUserMenuOpen((o) => !o)}
              >
                <div className="app-nav-avatar" style={avatarStyle} aria-hidden>
                  {userInitials(user)}
                </div>
                <div className="app-nav-user-text">
                  <span className="app-nav-user-name">{user.name?.trim() || user.email.split("@")[0]}</span>
                  <span className="app-nav-user-email">{user.email}</span>
                </div>
                <ChevronDown
                  size={18}
                  strokeWidth={2}
                  className={`app-nav-user-chevron${userMenuOpen ? " is-open" : ""}`}
                  aria-hidden
                />
              </button>
              {userMenuOpen ? (
                <div className="app-nav-dropdown" role="menu">
                  <button type="button" className="app-nav-dropdown-item" role="menuitem" onClick={signOut}>
                    <LogOut size={16} strokeWidth={2} aria-hidden />
                    Sign out
                  </button>
                </div>
              ) : null}
            </div>
            </>
          ) : null}
          {hasToken && userLoading && !user ? (
            <div className="app-nav-user app-nav-user-loading app-nav-user-desktop" aria-hidden>
              <div className="app-nav-avatar skeleton" style={{ animation: "none", minWidth: 40 }} />
              <div className="app-nav-user-text">
                <span className="skeleton skeleton-line-inline" />
                <span className="skeleton skeleton-line-inline short" />
              </div>
            </div>
          ) : null}
          <div className={hasToken ? "app-nav-trailing-theme hidden md:flex" : "app-nav-trailing-theme flex"}>
            <ThemeToggle />
          </div>
        </div>
      </div>

      {/* Mobile: backdrop + right drawer */}
      <div
        className={`app-nav-drawer-backdrop${menuOpen ? " is-visible" : ""}`}
        aria-hidden
        onClick={closeMenu}
      />
      <aside
        id="app-nav-drawer"
        className={`app-nav-drawer${menuOpen ? " is-open" : ""}`}
        aria-hidden={!menuOpen}
        aria-label="Mobile navigation"
      >
        <div className="app-nav-drawer-head">
          <Link href={hasToken ? "/dashboard" : "/"} className="app-nav-drawer-brand" onClick={closeMenu}>
            <Image src="/logo.png" alt="PulseOS" width={40} height={40} className="rounded-xl" />
            <span className="app-nav-brand gradient-text">PULSEOS</span>
          </Link>
          <button
            type="button"
            className="app-nav-drawer-close"
            aria-label="Close menu"
            onClick={closeMenu}
          >
            <X size={22} strokeWidth={2} />
          </button>
        </div>
        <div className="app-nav-drawer-scroll">
          <NavLinks
            pathname={pathname}
            hasToken={hasToken}
            showAuditLink={showAuditLink}
            showAdminLink={showAdminLink}
            onNavigate={closeMenu}
            variant="drawer"
          />
        </div>
        {hasToken && user ? (
          <div className="app-nav-drawer-footer">
            <div className="app-nav-drawer-user">
              <div className="app-nav-avatar" style={avatarStyle} aria-hidden>
                {userInitials(user)}
              </div>
              <div className="app-nav-user-text">
                <span className="app-nav-user-name">{user.name?.trim() || user.email.split("@")[0]}</span>
                <span className="app-nav-user-email">{user.email}</span>
              </div>
            </div>
            <div className="app-nav-drawer-actions">
              <ThemeToggle />
              <button type="button" className="app-nav-signout" onClick={signOut}>
                <LogOut size={16} strokeWidth={2} aria-hidden />
                Sign out
              </button>
            </div>
          </div>
        ) : null}
      </aside>
    </header>
  );
}
