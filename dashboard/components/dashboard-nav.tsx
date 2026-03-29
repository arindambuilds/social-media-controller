"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "../context/auth-context";
import { ThemeToggle } from "./theme-toggle";
import { DemoModeBadge } from "./demo-mode-badge";

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

export function DashboardNav() {
  const pathname = usePathname() ?? "/";
  const router = useRouter();
  const { token, isReady, user, userLoading, clearSession } = useAuth();
  const hasToken = isReady && !!token;
  const showAuditLink = !userLoading && user?.role === "AGENCY_ADMIN";

  function signOut() {
    clearSession();
    router.push("/login");
  }

  return (
    <header className="app-nav">
      <div className="app-nav-inner">
        <div className="app-nav-brand-wrap">
          <Link href="/" className="app-nav-mark" aria-hidden>
            P
          </Link>
          <Link href="/" className="app-nav-brand">
            Pulse<span> Studio</span>
          </Link>
          <DemoModeBadge />
        </div>

        <nav className="app-nav-center" aria-label="Primary">
          <div className="app-nav-group">
            <span className="app-nav-group-label">App</span>
            {primaryLinks.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className="app-nav-link"
                data-active={isActive(pathname, href) ? "true" : undefined}
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
                >
                  {label}
                </Link>
              );
            })}
          </div>
        </nav>

        <div className="app-nav-actions">
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
