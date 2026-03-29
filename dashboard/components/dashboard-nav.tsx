"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useAuth } from "../context/auth-context";
import { ThemeToggle } from "./theme-toggle";

/** Primary MVP nav (5 pages). */
const primaryLinks = [
  { href: "/analytics", label: "Analytics" },
  { href: "/insights", label: "Insights" },
  { href: "/leads", label: "Leads" },
  { href: "/posts", label: "Posts" },
  { href: "/accounts", label: "Accounts" }
] as const;

const secondaryLinks = [
  { href: "/", label: "Home" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/onboarding", label: "Connect" },
  { href: "/audit", label: "Audit" },
  { href: "/login", label: "Login" }
] as const;

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

function avatarHue(email: string): number {
  let h = 0;
  for (let i = 0; i < email.length; i += 1) {
    h = (h * 31 + email.charCodeAt(i)) >>> 0;
  }
  return h % 360;
}

export function DashboardNav() {
  const pathname = usePathname() ?? "/";
  const router = useRouter();
  const { token, isReady, user, userLoading, clearSession } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const hasToken = isReady && !!token;
  const showAuditLink = !userLoading && user?.role === "AGENCY_ADMIN";

  useEffect(() => {
    setMenuOpen(false);
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

  const avatarStyle = useMemo(() => {
    if (!user?.email) return undefined;
    const hue = avatarHue(user.email);
    return {
      background: `linear-gradient(135deg, hsl(${hue}, 52%, 46%), hsl(${(hue + 40) % 360}, 55%, 38%))`
    } as CSSProperties;
  }, [user?.email]);

  function signOut() {
    clearSession();
    router.push("/login");
  }

  function closeMenu() {
    setMenuOpen(false);
  }

  return (
    <header className="app-nav">
      <div className="app-nav-inner">
        <div className="app-nav-brand-wrap">
          <Link href={hasToken ? "/dashboard" : "/"} className="app-nav-mark" aria-hidden>
            P
          </Link>
          <Link href={hasToken ? "/dashboard" : "/"} className="app-nav-brand">
            Pulse<span> Studio</span>
          </Link>
        </div>

        <button
          type="button"
          className="app-nav-menu-toggle"
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          aria-expanded={menuOpen}
          aria-controls="app-nav-links"
          onClick={() => setMenuOpen((o) => !o)}
        >
          <span />
          <span />
          <span />
        </button>

        <nav
          id="app-nav-links"
          className={`app-nav-center ${menuOpen ? "is-open" : ""}`}
          aria-label="Primary"
        >
          <div className="app-nav-group">
            <span className="app-nav-group-label">App</span>
            {primaryLinks.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className="app-nav-link"
                data-active={isActive(pathname, href) ? "true" : undefined}
                onClick={closeMenu}
              >
                {label}
              </Link>
            ))}
          </div>

          <div className="app-nav-group">
            <span className="app-nav-group-label">More</span>
            {secondaryLinks.map(({ href, label }) => {
              if (href === "/login" && hasToken) return null;
              if (href === "/onboarding" && !hasToken) return null;
              if (href === "/audit" && !showAuditLink) return null;
              return (
                <Link
                  key={href}
                  href={href}
                  className="app-nav-link"
                  data-active={isActive(pathname, href) ? "true" : undefined}
                  onClick={closeMenu}
                >
                  {label}
                </Link>
              );
            })}
          </div>
        </nav>

        <div className="app-nav-trailing">
          {hasToken && user ? (
            <div className="app-nav-user" title={user.email}>
              <div className="app-nav-avatar" style={avatarStyle} aria-hidden>
                {userInitials(user)}
              </div>
              <div className="app-nav-user-text">
                <span className="app-nav-user-name">{user.name?.trim() || user.email.split("@")[0]}</span>
                <span className="app-nav-user-email">{user.email}</span>
              </div>
            </div>
          ) : null}
          {hasToken && userLoading && !user ? (
            <div className="app-nav-user app-nav-user-loading" aria-hidden>
              <div className="app-nav-avatar skeleton" style={{ animation: "none", minWidth: 40 }} />
              <div className="app-nav-user-text">
                <span className="skeleton skeleton-line-inline" />
                <span className="skeleton skeleton-line-inline short" />
              </div>
            </div>
          ) : null}
          <ThemeToggle />
          {hasToken ? (
            <button type="button" className="app-nav-signout" onClick={signOut}>
              Sign out
            </button>
          ) : null}
        </div>
      </div>
    </header>
  );
}
