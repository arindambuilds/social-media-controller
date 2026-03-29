"use client";

import { useEffect } from "react";

const STORAGE_KEY = "smc_theme";

function applyTheme(mode: "light" | "dark") {
  document.documentElement.dataset.theme = mode;
  document.documentElement.classList.toggle("dark", mode === "dark");
}

export function AppProviders({ children }: Readonly<{ children: React.ReactNode }>) {
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as "light" | "dark" | null;
    if (stored === "light" || stored === "dark") {
      applyTheme(stored);
      return;
    }
    applyTheme("dark");
  }, []);

  return <>{children}</>;
}

export function toggleTheme(): "light" | "dark" {
  const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  applyTheme(next);
  localStorage.setItem(STORAGE_KEY, next);
  return next;
}

export function getTheme(): "light" | "dark" {
  if (typeof document === "undefined") return "dark";
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}
