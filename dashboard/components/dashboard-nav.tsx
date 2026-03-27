"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { clearAuthStorage, getStoredToken } from "../lib/auth-storage";
import { ThemeToggle } from "./theme-toggle";

const growLinks = [
  { href: "/analytics", label: "Analytics" },
  { href: "/insights", label: "Insights" }
] as const;

const connectLinks = [{ href: "/onboarding", label: "Connect" }] as const;

const moreLinks = [
  { href: "/", label: "Home" },
  { href: "/leads", label: "Leads" },
  { href: "/login", label: "Login" }
] as const;

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function DashboardNav() {
  const pathname = usePathname() ?? "/";
  const router = useRouter();
  const [hasToken, setHasToken] = useState(false);

  useEffect(() => {
    setHasToken(!!getStoredToken());
  }, [pathname]);

  function signOut() {
    clearAuthStorage();
    setHasToken(false);
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
        </div>

        <nav className="app-nav-center" aria-label="Primary">
          <div className="app-nav-group">
            <span className="app-nav-group-label">Grow</span>
            {growLinks.map(({ href, label }) => (
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

          {hasToken ? (
            <div className="app-nav-group">
              <span className="app-nav-group-label">Link</span>
              {connectLinks.map(({ href, label }) => (
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
          ) : null}

          <div className="app-nav-group">
            <span className="app-nav-group-label">More</span>
            {moreLinks.map(({ href, label }) => {
              if (href === "/login" && hasToken) return null;
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
