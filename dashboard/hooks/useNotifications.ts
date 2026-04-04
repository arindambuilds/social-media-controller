"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { API_ORIGIN } from "../lib/api";
import { getAccessToken } from "../lib/auth-storage";
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
      const { notifications: list, unreadCount: unread } = await getNotifications(false, 50);
      setNotifications(list);
      setUnreadCount(unread);
    } catch {
      // auth middleware handles redirects when session expires
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

    const startPolling = () => {
      stopPolling();
      pollRef.current = setInterval(() => {
        void refresh();
      }, POLL_MS);
    };

    if (!clientId) {
      startPolling();
      return () => stopPolling();
    }

    const token = getAccessToken();
    if (!token) {
      startPolling();
      return () => stopPolling();
    }

    stopPolling();
    closeSse();

    const params = new URLSearchParams({ access_token: token, clientId });
    const source = new EventSource(`${API_ORIGIN}/api/events?${params.toString()}`);
    esRef.current = source;

    source.addEventListener("open", () => stopPolling());
    source.addEventListener("notification", (event) => {
      try {
        const raw = JSON.parse((event as MessageEvent).data as string) as {
          data?: {
            id: string;
            type: string;
            title: string;
            message: string;
            createdAt: string;
          };
        };
        if (!raw.data?.id) return;
        const row = ssePayloadToNotification(raw.data);
        setNotifications((current) => (current.some((item) => item.id === row.id) ? current : [row, ...current].slice(0, 100)));
        setUnreadCount((count) => count + 1);
      } catch {
        void refresh();
      }
    });
    source.onerror = () => {
      closeSse();
      startPolling();
    };

    return () => {
      closeSse();
      stopPolling();
    };
  }, [API_ORIGIN, clientId, closeSse, refresh, stopPolling]);

  const markAsRead = useCallback(async (id: string) => {
    await apiMarkRead(id);
    await refresh();
  }, [refresh]);

  const markAllAsRead = useCallback(async () => {
    await apiMarkAll();
    await refresh();
  }, [refresh]);

  const deleteNotification = useCallback(async (id: string) => {
    await apiDelete(id);
    await refresh();
  }, [refresh]);

  return { notifications, unreadCount, loading, refresh, markAsRead, markAllAsRead, deleteNotification };
}
