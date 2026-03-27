"use client";

import { useEffect, useState } from "react";
import { getTheme, toggleTheme } from "./app-providers";

export function ThemeToggle() {
  const [mode, setMode] = useState<"light" | "dark">("light");

  useEffect(() => {
    setMode(getTheme());
  }, []);

  return (
    <button
      type="button"
      className="theme-toggle"
      aria-label={mode === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      onClick={() => setMode(toggleTheme())}
    >
      <span className="theme-toggle-icon" aria-hidden>
        {mode === "dark" ? "☀" : "☾"}
      </span>
    </button>
  );
}
