"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { API_ORIGIN } from "../lib/api";
import { TOKEN_KEY } from "../lib/auth-storage";
import {
  deleteNotification as apiDelete,
  getNotifications,
  markAllAsRead as apiMarkAll,
  markAsRead as apiMarkRead,
  type Notification
} from "../lib/notifications";

const POLL_MS = 30_000;

function ssePayloadToNotification(data: {
  id: string;
  type: string;
  title: string;
  message: string;
  createdAt: string;
}): Notification {
  return {
    id: data.id,
    userId: "",
    title: data.title,
    body: data.message,
    type: data.type,
    read: false,
    readAt: null,
    metadata: null,
    createdAt: data.createdAt,
    updatedAt: data.createdAt
  };
}

export function useNotifications(clientId: string | null) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const esRef = useRef<EventSource | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = useCallback(async () => {
    try {
      const { notifications: list, unreadCount: uc } = await getNotifications(false, 50);
      setNotifications(list);
      setUnreadCount(uc);
    } catch {
      /* apiFetch may redirect to login */
    } finally {
      setLoading(false);
    }
  }, []);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const startPolling = useCallback(() => {
    stopPolling();
    pollRef.current = setInterval(() => {
      void refresh();
    }, POLL_MS);
  }, [refresh, stopPolling]);

  const closeSse = useCallback(() => {
    if (esRef.current) {
      esRef.current.close();
      esRef.current = null;
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    if (!clientId) {
      startPolling();
      return () => {
        stopPolling();
      };
    }

    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      startPolling();
      return () => stopPolling();
    }

    stopPolling();
    closeSse();

    const params = new URLSearchParams({ access_token: token, clientId });
    const url = `${API_ORIGIN}/api/events?${params.toString()}`;
    const es = new EventSource(url);
    esRef.current = es;

    es.addEventListener("open", () => {
      stopPolling();
    });

    es.addEventListener("notification", (ev) => {
      try {
        const raw = JSON.parse((ev as MessageEvent).data as string) as {
          data?: {
            id: string;
            type: string;
            title: string;
            message: string;
            createdAt: string;
          };
        };
        const d = raw.data;
        if (!d?.id) return;
        const row = ssePayloadToNotification(d);
        setNotifications((prev) => {
          if (prev.some((n) => n.id === row.id)) return prev;
          return [row, ...prev].slice(0, 100);
        });
        setUnreadCount((c) => c + 1);
      } catch {
        void refresh();
      }
    });

    es.onerror = () => {
      closeSse();
      startPolling();
    };

    return () => {
      closeSse();
      stopPolling();
    };
  }, [clientId, closeSse, refresh, startPolling, stopPolling]);

  const markAsRead = useCallback(
    async (id: string) => {
      await apiMarkRead(id);
      await refresh();
    },
    [refresh]
  );

  const markAllAsRead = useCallback(async () => {
    await apiMarkAll();
    await refresh();
  }, [refresh]);

  const deleteNotification = useCallback(
    async (id: string) => {
      await apiDelete(id);
      await refresh();
    },
    [refresh]
  );

  return {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    refresh,
    loading
  };
}
