"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { API_ORIGIN } from "../lib/api";
import { getAccessToken } from "../lib/auth-storage";

export type PulseSseMessage = {
  type?: string;
  eventId?: string;
  clientId?: string;
  ts?: number;
  data?: Record<string, unknown>;
};

const MAX_BACKOFF_MS = 30_000;

function parseEnvelope(raw: string): PulseSseMessage | null {
  try {
    return JSON.parse(raw) as PulseSseMessage;
  } catch {
    return null;
  }
}

/**
 * Subscribes to `GET /api/events` (pass JWT as `access_token` — EventSource cannot set Authorization).
 * Exponential backoff on errors; dedupes by `eventId` when present.
 */
export function usePulseSse(
  clientId: string | null,
  options?: { enabled?: boolean; onPulse?: (msg: PulseSseMessage) => void }
): { connected: boolean; lastError: string | null } {
  const enabled = options?.enabled !== false;
  const onPulse = options?.onPulse;
  const seenIds = useRef<Set<string>>(new Set());
  const [connected, setConnected] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const backoffRef = useRef(1000);
  const esRef = useRef<EventSource | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cleanup = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (esRef.current) {
      esRef.current.close();
      esRef.current = null;
    }
    setConnected(false);
  }, []);

  const connect = useCallback(() => {
    if (typeof window === "undefined" || !clientId || !enabled) return;
    const token = getAccessToken();
    if (!token) {
      setLastError("Not signed in");
      return;
    }

    cleanup();
    setLastError(null);

    const params = new URLSearchParams({ access_token: token });
    params.set("clientId", clientId);
    const url = `${API_ORIGIN}/api/events?${params.toString()}`;

    const es = new EventSource(url);
    esRef.current = es;

    es.addEventListener("open", () => {
      backoffRef.current = 1000;
      setConnected(true);
    });

    es.addEventListener("connected", () => {
      setConnected(true);
    });

    es.addEventListener("pulse", (ev) => {
      const msg = parseEnvelope((ev as MessageEvent).data as string);
      if (!msg) return;
      if (msg.eventId) {
        if (seenIds.current.has(msg.eventId)) return;
        seenIds.current.add(msg.eventId);
        if (seenIds.current.size > 200) {
          seenIds.current = new Set([...seenIds.current].slice(-100));
        }
      }
      onPulse?.(msg);
    });

    es.onerror = () => {
      setConnected(false);
      es.close();
      const wait = backoffRef.current;
      backoffRef.current = Math.min(MAX_BACKOFF_MS, backoffRef.current * 2);
      setLastError("Reconnecting…");
      timerRef.current = setTimeout(() => connect(), wait);
    };
  }, [clientId, enabled, cleanup, onPulse]);

  useEffect(() => {
    if (!clientId || !enabled) {
      cleanup();
      return;
    }
    connect();
    return cleanup;
  }, [clientId, enabled, connect, cleanup]);

  return { connected, lastError };
}
