"use client";

const SESSION_ID_KEY = "pulse.analytics.sessionId";
const ATTR_SOURCE_KEY = "pulse.analytics.source";
const ATTR_FEATURE_KEY = "pulse.analytics.feature";
const CHECKOUT_INTENT_KEY = "pulse.analytics.checkoutIntent";

export type AnalyticsEventPayload = {
  event: string;
  userId?: string;
  sessionId: string;
  source?: string;
  feature?: string;
  metadata?: Record<string, unknown>;
  timestamp: number;
};

type TrackEventData = {
  userId?: string;
  source?: string;
  feature?: string;
  metadata?: Record<string, unknown>;
};

export type CheckoutIntent = {
  source?: string;
  feature?: string;
  planId?: string;
  startedAt: number;
  abandonedTracked?: boolean;
};

function randomId(prefix: string): string {
  const part = Math.random().toString(36).slice(2, 10);
  return `${prefix}_${Date.now()}_${part}`;
}

function safeGet(key: string): string | null {
  try {
    return window.localStorage.getItem(key) ?? window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string): void {
  try {
    window.sessionStorage.setItem(key, value);
    window.localStorage.setItem(key, value);
  } catch {
    // no-op
  }
}

export function getSessionId(): string {
  if (typeof window === "undefined") return randomId("srv");
  const existing = safeGet(SESSION_ID_KEY);
  if (existing) return existing;
  const created = randomId("sess");
  safeSet(SESSION_ID_KEY, created);
  return created;
}

export function persistAttributionFromUrl(): { source?: string; feature?: string } {
  if (typeof window === "undefined") return {};
  const params = new URLSearchParams(window.location.search);
  const source = params.get("source")?.trim() || undefined;
  const feature = params.get("feature")?.trim() || undefined;
  if (source) safeSet(ATTR_SOURCE_KEY, source);
  if (feature) safeSet(ATTR_FEATURE_KEY, feature);
  return { source, feature };
}

export function getAttributionContext(): { source?: string; feature?: string } {
  if (typeof window === "undefined") return {};
  const source = safeGet(ATTR_SOURCE_KEY) ?? undefined;
  const feature = safeGet(ATTR_FEATURE_KEY) ?? undefined;
  return {
    source: source?.trim() || undefined,
    feature: feature?.trim() || undefined
  };
}

export function setCheckoutIntent(intent: Omit<CheckoutIntent, "startedAt"> & { startedAt?: number }): void {
  if (typeof window === "undefined") return;
  const payload: CheckoutIntent = {
    ...intent,
    startedAt: intent.startedAt ?? Date.now()
  };
  safeSet(CHECKOUT_INTENT_KEY, JSON.stringify(payload));
}

export function getCheckoutIntent(): CheckoutIntent | null {
  if (typeof window === "undefined") return null;
  const raw = safeGet(CHECKOUT_INTENT_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as CheckoutIntent;
    if (!parsed || typeof parsed.startedAt !== "number") return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearCheckoutIntent(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(CHECKOUT_INTENT_KEY);
    window.sessionStorage.removeItem(CHECKOUT_INTENT_KEY);
  } catch {
    // no-op
  }
}

export async function trackEvent(event: string, data?: TrackEventData): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    // URL params are a source of truth for attribution.
    persistAttributionFromUrl();
    const attr = getAttributionContext();
    const payload: AnalyticsEventPayload = {
      event,
      userId: data?.userId,
      sessionId: getSessionId(),
      source: data?.source ?? attr.source,
      feature: data?.feature ?? attr.feature,
      metadata: data?.metadata,
      timestamp: Date.now()
    };
    await fetch("/api/analytics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      keepalive: true
    });
  } catch {
    // analytics must never break UI
  }
}

