"use client";

import { CircleAlert, CircleHelp, TriangleAlert, X } from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode
} from "react";
import { cn } from "../lib/cn";

export type ToastTone = "success" | "error" | "info" | "warning";

type ToastItem = {
  id: string;
  title: string;
  description?: string;
  tone: ToastTone;
  duration: number;
};

type ToastContextValue = {
  push: (toast: Omit<ToastItem, "id">) => void;
  success: (title: string, description?: string) => void;
  error: (title: string, description?: string) => void;
  info: (title: string, description?: string) => void;
  warning: (title: string, description?: string) => void;
  dismiss: (id: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

function ToastSuccessIcon() {
  return (
    <svg className="toast-icon-svg" viewBox="0 0 36 36" aria-hidden>
      <circle cx="18" cy="18" r="16" fill="rgba(34,197,94,0.14)" />
      <path
        className="toast-check-path"
        d="M10 18 L16 24 L26 14"
        fill="none"
        stroke="var(--success)"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ToastIcon({ tone }: { tone: ToastTone }) {
  if (tone === "success") return <ToastSuccessIcon />;
  if (tone === "error") return <CircleAlert size={18} strokeWidth={2} aria-hidden />;
  if (tone === "warning") return <TriangleAlert size={18} strokeWidth={2} aria-hidden />;
  return <CircleHelp size={18} strokeWidth={2} aria-hidden />;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const push = useCallback(
    (toast: Omit<ToastItem, "id">) => {
      const id = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
      const next: ToastItem = { id, ...toast };
      setToasts((current) => [next, ...current].slice(0, 4));
      window.setTimeout(() => dismiss(id), toast.duration);
    },
    [dismiss]
  );

  const value = useMemo<ToastContextValue>(
    () => ({
      push,
      dismiss,
      success: (title, description) => push({ title, description, tone: "success", duration: 4000 }),
      error: (title, description) => push({ title, description, tone: "error", duration: 4000 }),
      info: (title, description) => push({ title, description, tone: "info", duration: 4000 }),
      warning: (title, description) => push({ title, description, tone: "warning", duration: 4000 })
    }),
    [dismiss, push]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-viewport" aria-live="polite" aria-atomic="true">
        {toasts.map((toast) => (
          <div key={toast.id} className={cn("toast-card", `toast-${toast.tone}`)}>
            <div className="toast-icon">
              <ToastIcon tone={toast.tone} />
            </div>
            <div className="toast-copy">
              <strong>{toast.title}</strong>
              {toast.description ? <p>{toast.description}</p> : null}
            </div>
            <button
              type="button"
              className="toast-close"
              aria-label="Dismiss notification"
              onClick={() => dismiss(toast.id)}
            >
              <X size={16} aria-hidden />
            </button>
            <span className="toast-progress" style={{ animationDuration: `${toast.duration}ms` }} />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return ctx;
}
