"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { API_ORIGIN } from "../lib/api";

type DemoModeContextValue = {
  /** True when API reports INGESTION_MODE=mock (synthetic Instagram / sync data). */
  isDemoMode: boolean;
  loaded: boolean;
};

const DemoModeContext = createContext<DemoModeContextValue>({
  isDemoMode: false,
  loaded: false
});

export function DemoModeProvider({ children }: Readonly<{ children: React.ReactNode }>) {
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_ORIGIN}/health`, { cache: "no-store" });
        if (!res.ok || cancelled) {
          if (!cancelled) setLoaded(true);
          return;
        }
        const body = (await res.json()) as { ingestionMode?: string };
        if (!cancelled) {
          setIsDemoMode(body.ingestionMode === "mock");
          setLoaded(true);
        }
      } catch {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <DemoModeContext.Provider value={{ isDemoMode, loaded }}>{children}</DemoModeContext.Provider>
  );
}

export function useDemoMode() {
  return useContext(DemoModeContext);
}
