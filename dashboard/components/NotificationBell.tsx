"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "../context/auth-context";
import { useNotifications } from "../hooks/useNotifications";

function formatRelativeTime(iso: string): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  const sec = Math.floor((Date.now() - t) / 1000);
  if (sec < 10) return "just now";
  if (sec < 60) return `${sec} sec ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return min === 1 ? "1 min ago" : `${min} min ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return hr === 1 ? "1 hour ago" : `${hr} hours ago`;
  const d = Math.floor(hr / 24);
  return d === 1 ? "1 day ago" : `${d} days ago`;
}

export function NotificationBell() {
  const { user, isReady, token } = useAuth();
  const clientId = user?.clientId ?? null;
  const { notifications, unreadCount, markAsRead, markAllAsRead, loading } = useNotifications(
    isReady && token ? clientId : null
  );
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (panelRef.current?.contains(t)) return;
      if (btnRef.current?.contains(t)) return;
      close();
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open, close]);

  if (!isReady || !token || !user) return null;

  const top = notifications.slice(0, 10);
  const message = (n: (typeof notifications)[0]) => n.body?.trim() || "—";

  return (
    <div className="relative flex items-center">
      <button
        ref={btnRef}
        type="button"
        className="relative flex h-10 w-10 items-center justify-center rounded-lg text-zinc-600 transition hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
        aria-label="Notifications"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>
        {unreadCount > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          ref={panelRef}
          className="absolute right-0 top-full z-50 mt-2 w-[min(100vw-2rem,22rem)] rounded-xl border border-zinc-200 bg-white shadow-xl dark:border-zinc-700 dark:bg-zinc-900"
          role="dialog"
          aria-label="Notifications"
        >
          <div className="flex items-center justify-between border-b border-zinc-100 px-3 py-2 dark:border-zinc-800">
            <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Notifications</span>
            <button
              type="button"
              className="text-xs font-medium text-violet-600 disabled:cursor-not-allowed disabled:opacity-40 dark:text-violet-400"
              disabled={unreadCount === 0 || loading}
              onClick={() => void markAllAsRead()}
            >
              Mark all as read
            </button>
          </div>
          <div className="max-h-[min(70vh,24rem)] overflow-y-auto">
            {top.length === 0 && !loading ? (
              <p className="px-4 py-10 text-center text-sm text-zinc-500 dark:text-zinc-400">
                You&apos;re all caught up
              </p>
            ) : null}
            {loading && top.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-zinc-500">Getting your data ready…</p>
            ) : null}
            <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {top.map((n) => (
                <li
                  key={n.id}
                  className={`px-3 py-2.5 ${
                    !n.read ? "border-l-2 border-l-violet-500 bg-violet-50/50 dark:bg-violet-950/20" : ""
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{n.title}</p>
                      <p className="mt-0.5 text-xs text-zinc-600 dark:text-zinc-400">{message(n)}</p>
                      <p className="mt-1 text-[11px] text-zinc-400">{formatRelativeTime(n.createdAt)}</p>
                    </div>
                    <button
                      type="button"
                      className="shrink-0 text-xs text-violet-600 disabled:cursor-default disabled:opacity-40 dark:text-violet-400"
                      disabled={n.read}
                      onClick={() => void markAsRead(n.id)}
                    >
                      {n.read ? "Read" : "Mark as read"}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}
    </div>
  );
}
