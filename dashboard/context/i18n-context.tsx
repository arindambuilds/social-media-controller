"use client";

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import en from "../locales/en.json";
import odia from "../locales/odia.json";

type Language = "en" | "odia";

type Messages = typeof en;

type I18nContextValue = {
  language: Language;
  messages: Messages;
  setLanguage: (lang: Language) => void;
  t: (path: string, vars?: Record<string, string | number>) => string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

const STORAGE_KEY = "smc_language";

function resolveInitialLanguage(): Language {
  if (typeof window === "undefined") return "en";
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === "en" || stored === "odia") return stored;
  const nav = window.navigator as { language?: string; languages?: string[] };
  const lang = (nav.language || nav.languages?.[0] || "").toLowerCase();
  if (lang.startsWith("or") || lang.includes("odia")) return "odia";
  return "en";
}

function getBundle(lang: Language): Messages {
  return lang === "odia" ? (odia as Messages) : (en as Messages);
}

function interpolate(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (m, key) =>
    Object.prototype.hasOwnProperty.call(vars, key) ? String(vars[key] ?? "") : m
  );
}

function lookup(messages: Messages, path: string): string | undefined {
  const parts = path.split(".");
  let curr: any = messages;
  for (const p of parts) {
    if (curr == null || typeof curr !== "object") return undefined;
    curr = curr[p];
  }
  return typeof curr === "string" ? curr : undefined;
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => resolveInitialLanguage());

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEY, language);
    document.documentElement.lang = language === "odia" ? "or-IN" : "en-IN";
  }, [language]);

  const value = useMemo<I18nContextValue>(() => {
    const bundle = getBundle(language);
    const t = (path: string, vars?: Record<string, string | number>) => {
      const raw = lookup(bundle, path) ?? path;
      return interpolate(raw, vars);
    };
    const setLanguage = (lang: Language) => {
      setLanguageState(lang);
    };
    return { language, messages: bundle, setLanguage, t };
  }, [language]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error("useI18n must be used within I18nProvider");
  }
  return ctx;
}

