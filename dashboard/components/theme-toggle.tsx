"use client";

import { MoonStar, SunMedium } from "lucide-react";
import { useEffect, useState } from "react";

export function ThemeToggle() {
  const [mode, setMode] = useState<"light" | "dark">("light");

  useEffect(() => {
    if (typeof document === "undefined") return;
    const nextMode = document.documentElement.dataset.theme === "dark" ? "dark" : "light";
    setMode(nextMode);
  }, []);

  function handleToggle() {
    const nextMode = mode === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = nextMode;
    setMode(nextMode);
  }

  return (
    <button
      type="button"
      className="theme-toggle interactive"
      aria-label={mode === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      onClick={handleToggle}
    >
      <span className="theme-toggle-icon" aria-hidden>
        {mode === "dark" ? <SunMedium size={16} /> : <MoonStar size={16} />}
      </span>
    </button>
  );
}
