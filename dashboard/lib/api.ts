import axios from "axios";
import {
  clearAccessToken as clearAccessTokenMem,
  getAccessToken,
  setAccessToken as setAccessTokenMem
} from "./auth-storage";

export const DEFAULT_API_TIMEOUT_MS = 10_000;
export const DEFAULT_LOCAL_API_ORIGIN = "http://localhost:4000";
export const DEFAULT_PRODUCTION_API_ORIGIN = "https://social-media-controller.onrender.com";

function resolveApiOrigin(): string {
  const fromEnv =
    process.env.NEXT_PUBLIC_API_BASE_URL?.trim() || process.env.NEXT_PUBLIC_API_URL?.trim() || "";
  const fallback =
    process.env.NODE_ENV === "production" ? DEFAULT_PRODUCTION_API_ORIGIN : DEFAULT_LOCAL_API_ORIGIN;
  const raw = fromEnv || fallback;
  return raw.replace(/\/$/, "");
}

if (typeof window !== "undefined" && process.env.NODE_ENV === "production") {
  const value = process.env.NEXT_PUBLIC_API_BASE_URL ?? process.env.NEXT_PUBLIC_API_URL;
  if (!value || String(value).trim() === "") {
    console.warn(
      "NEXT_PUBLIC_API_BASE_URL (or NEXT_PUBLIC_API_URL) is missing. Falling back to https://social-media-controller.onrender.com."
    );
  }
}

const rawOrigin = resolveApiOrigin();

/** Axios client for modules that prefer axios; most routes still use `apiFetch` below. */
export const apiClient = axios.create({
  baseURL: rawOrigin.endsWith("/api") ? rawOrigin : `${rawOrigin}/api`,
  withCredentials: true
});
export const API_URL = rawOrigin.endsWith("/api") ? rawOrigin : `${rawOrigin}/api`;
export const API_ORIGIN = API_URL.replace(/\/api$/, "");
export const API_BASE_URL = API_URL;

export type AnalyticsSummary = {
  success?: boolean;
  postsAnalyzed: number;
  averageEngagementRate: number;
  bestPostingHour: number | null;
  captionWinner: string;
  topHours: number[];
  likesByHour?: Array<{ hour: number; avgLikes: number }>;
  captionPerformance: { avgLikes: number; avgComments: number; avgShares: number };
  topPosts: Array<{
    id: string;
    content?: string | null;
    platformPostId: string;
    publishedAt?: Date | string;
    engagementStats?: unknown;
  }>;
  worstPosts: Array<{
    id: string;
    content?: string | null;
    platformPostId: string;
    publishedAt?: Date | string;
    engagementStats?: unknown;
  }>;
};

export type CaptionCard = {
  hook: string;
  body: string;
  cta: string;
  hashtags: string[];
};

type ApiFetchInit = RequestInit & { timeoutMs?: number };

const tokenListeners = new Set<() => void>();

export function subscribeAccessToken(listener: () => void): () => void {
  tokenListeners.add(listener);
  return () => tokenListeners.delete(listener);
}

export function notifyAccessTokenChanged(): void {
  tokenListeners.forEach((l) => l());
}

function nestedErrorMessage(body: unknown): string | undefined {
  if (!body || typeof body !== "object") return undefined;
  const candidate = body as { error?: unknown; message?: unknown };
  if (typeof candidate.message === "string") return candidate.message;
  if (typeof candidate.error === "string") return candidate.error;
  if (candidate.error && typeof candidate.error === "object" && "message" in candidate.error) {
    const message = (candidate.error as { message?: unknown }).message;
    if (typeof message === "string") return message;
  }
  return undefined;
}

export function parseApiErrorMessage(body: unknown): string {
  const nested = nestedErrorMessage(body);
  if (nested) return nested;
  if (body && typeof body === "object" && "_raw" in body && typeof (body as { _raw?: unknown })._raw === "string") {
    return (body as { _raw: string })._raw;
  }
  return "Something went sideways — let’s try again.";
}

function friendlyHttpMessage(status: number, parsedBody: unknown, fallback: string): string {
  const nested = nestedErrorMessage(parsedBody);
  if (nested && nested.trim()) return nested;
  if (status === 401) return "Please sign in again.";
  if (status === 403) return "You don’t have permission for that yet.";
  if (status === 429) return "You’ve made a lot of requests. Let’s pause for a moment and try again.";
  if (status >= 500) return "Something went sideways — let’s try again.";
  return fallback;
}

async function readResponseJson(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return {};
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { _raw: text };
  }
}

function mapAbortToTimeout(err: unknown): Error {
  if (err instanceof Error && (err.name === "AbortError" || /abort/i.test(err.message))) {
    return new Error("The API is taking a little longer than usual. Please try again in a moment.");
  }
  return err instanceof Error ? err : new Error(String(err));
}

async function fetchWithTimeout(url: string, init: ApiFetchInit | undefined, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const { timeoutMs: _ignoredTimeout, signal: parentSignal, ...passThrough } = init ?? {};
  void _ignoredTimeout;

  if (parentSignal) {
    if (parentSignal.aborted) controller.abort();
    else parentSignal.addEventListener("abort", () => controller.abort(), { once: true });
  }

  try {
    return await fetch(url, {
      ...passThrough,
      signal: controller.signal,
      credentials: passThrough.credentials ?? "include"
    });
  } catch (error) {
    throw mapAbortToTimeout(error);
  } finally {
    clearTimeout(timeout);
  }
}

function isLoginPost(path: string, init?: ApiFetchInit): boolean {
  const method = (init?.method ?? "GET").toUpperCase();
  return method === "POST" && path.startsWith("/auth/login");
}

function isRefreshPost(path: string, init?: ApiFetchInit): boolean {
  const method = (init?.method ?? "GET").toUpperCase();
  return method === "POST" && path.startsWith("/auth/refresh");
}

/** Dedupes concurrent refresh POSTs. */
let refreshPromise: Promise<string | null> | null = null;

/**
 * POST /auth/refresh with credentials (httpOnly cookie). Updates in-memory access token on success.
 */
export async function refreshAccessToken(): Promise<string | null> {
  if (typeof window === "undefined") return null;
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    try {
      const res = await fetchWithTimeout(
        `${API_URL}/auth/refresh`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({})
        },
        Math.max(DEFAULT_API_TIMEOUT_MS, 25_000)
      );
      const body = await readResponseJson(res);
      if (!res.ok) return null;
      const nextAccess = (body as { accessToken?: string }).accessToken ?? null;
      if (nextAccess) {
        setAccessTokenMem(nextAccess);
        notifyAccessTokenChanged();
      }
      return nextAccess;
    } catch {
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

export async function restoreSessionFromRefresh(): Promise<string | null> {
  return refreshAccessToken();
}

function forceLogoutToLogin(): void {
  if (typeof window === "undefined") return;
  clearAccessTokenMem();
  notifyAccessTokenChanged();
  window.location.assign("/login");
}

function authHeaders(path: string, options?: ApiFetchInit, token?: string | null): HeadersInit {
  const skipAuth = isLoginPost(path, options) || isRefreshPost(path, options);
  const baseHeaders: HeadersInit = {
    ...(options?.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
    ...options?.headers
  };
  if (token && !skipAuth) {
    return { Authorization: `Bearer ${token}`, ...baseHeaders };
  }
  return baseHeaders;
}

export function authLogoutFireAndForget(): void {
  if (typeof window === "undefined") return;
  void fetchWithTimeout(
    `${API_URL}/auth/logout`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({})
    },
    DEFAULT_API_TIMEOUT_MS
  ).catch(() => undefined);
}

export async function apiFetch<T = unknown>(path: string, options?: ApiFetchInit): Promise<T> {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const timeoutMs = options?.timeoutMs ?? DEFAULT_API_TIMEOUT_MS;
  const url = `${API_URL}${normalizedPath}`;
  let token = typeof window !== "undefined" ? getAccessToken() : null;
  const skipAuth = isLoginPost(normalizedPath, options) || isRefreshPost(normalizedPath, options);

  const execute = (bearer: string | null) =>
    fetchWithTimeout(
      url,
      {
        ...options,
        headers: authHeaders(normalizedPath, options, bearer),
        cache: "no-store"
      },
      timeoutMs
    );

  let response = await execute(skipAuth ? null : token);
  let body = await readResponseJson(response);

  if (response.status === 401 && !skipAuth && typeof window !== "undefined") {
    const next = await refreshAccessToken();
    if (next) {
      token = next;
      response = await execute(next);
      body = await readResponseJson(response);
    }
  }

  if (!response.ok) {
    if (typeof window !== "undefined" && response.status === 401 && !skipAuth) {
      clearAccessTokenMem();
      notifyAccessTokenChanged();
      forceLogoutToLogin();
    }
    const fallback = parseApiErrorMessage(body);
    throw new Error(friendlyHttpMessage(response.status, body, fallback));
  }

  return body as T;
}

export async function apiFetchResponse(path: string, options?: ApiFetchInit): Promise<Response> {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const timeoutMs = options?.timeoutMs ?? DEFAULT_API_TIMEOUT_MS;
  const url = `${API_URL}${normalizedPath}`;
  let token = typeof window !== "undefined" ? getAccessToken() : null;
  const skipAuth = isLoginPost(normalizedPath, options) || isRefreshPost(normalizedPath, options);

  const execute = (bearer: string | null) =>
    fetchWithTimeout(
      url,
      {
        ...options,
        headers: authHeaders(normalizedPath, options, bearer),
        cache: "no-store"
      },
      timeoutMs
    );

  let response = await execute(skipAuth ? null : token);

  if (response.status === 401 && !skipAuth && typeof window !== "undefined") {
    const next = await refreshAccessToken();
    if (next) {
      token = next;
      response = await execute(next);
    } else {
      clearAccessTokenMem();
      notifyAccessTokenChanged();
      forceLogoutToLogin();
    }
  }
  return response;
}

export async function apiFetchFormData<T = unknown>(
  path: string,
  formData: FormData,
  options?: { timeoutMs?: number }
): Promise<T> {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const timeoutMs = options?.timeoutMs ?? 60_000;
  const url = `${API_URL}${normalizedPath}`;
  let token = typeof window !== "undefined" ? getAccessToken() : null;

  const execute = (bearer: string | null) =>
    fetchWithTimeout(
      url,
      {
        method: "POST",
        headers: bearer ? { Authorization: `Bearer ${bearer}` } : {},
        body: formData
      },
      timeoutMs
    );

  let response = await execute(token);
  let body = await readResponseJson(response);

  if (response.status === 401 && typeof window !== "undefined") {
    const next = await refreshAccessToken();
    if (next) {
      token = next;
      response = await execute(next);
      body = await readResponseJson(response);
    }
  }

  if (!response.ok) {
    if (typeof window !== "undefined" && response.status === 401) {
      clearAccessTokenMem();
      notifyAccessTokenChanged();
      forceLogoutToLogin();
    }
    throw new Error(friendlyHttpMessage(response.status, body, parseApiErrorMessage(body)));
  }

  return body as T;
}

export async function apiRequestJson<T>(path: string, init?: ApiFetchInit): Promise<T> {
  return apiFetch<T>(path, init);
}

async function requestWithToken<T>(path: string, token: string, init?: ApiFetchInit): Promise<T> {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const timeoutMs = init?.timeoutMs ?? DEFAULT_API_TIMEOUT_MS;
  const url = `${API_URL}${normalizedPath}`;

  const execute = (bearer: string) =>
    fetchWithTimeout(
      url,
      {
        ...init,
        headers: authHeaders(normalizedPath, init, bearer),
        cache: "no-store"
      },
      timeoutMs
    );

  let response = await execute(token);
  let body = await readResponseJson(response);

  if (response.status === 401 && typeof window !== "undefined") {
    const next = await refreshAccessToken();
    if (next) {
      response = await execute(next);
      body = await readResponseJson(response);
    }
  }

  if (!response.ok) {
    if (response.status === 401 && typeof window !== "undefined") {
      clearAccessTokenMem();
      notifyAccessTokenChanged();
      forceLogoutToLogin();
    }
    throw new Error(friendlyHttpMessage(response.status, body, parseApiErrorMessage(body)));
  }
  return body as T;
}

export const api = {
  analyticsSummary(clientId: string, token: string) {
    return requestWithToken<AnalyticsSummary>(`/analytics/INSTAGRAM/${clientId}/summary`, token);
  },
  generateInsight(clientId: string, token: string) {
    return requestWithToken(`/ai/insights/content-performance/${clientId}`, token, {
      method: "POST",
      body: JSON.stringify({ platform: "INSTAGRAM" }),
      timeoutMs: 90_000
    });
  },
  generateWeeklyRecommendation(clientId: string, token: string) {
    return requestWithToken(`/ai/recommendations/weekly/${clientId}`, token, { method: "POST" });
  },
  generateCaptions(
    token: string,
    payload: {
      clientId: string;
      niche: string;
      tone: string;
      objective: string;
      offer?: string;
    }
  ) {
    return requestWithToken<{ prompt: string; captions: CaptionCard[] | string[] }>("/ai/captions/generate", token, {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },
  startInstagramAuth(clientId: string, token: string) {
    return requestWithToken<{ state: string; authUrl: string }>("/social-accounts/instagram/start", token, {
      method: "POST",
      body: JSON.stringify({ clientId })
    });
  }
};

export async function fetchMe(explicitToken?: string | null, timeoutMs: number = DEFAULT_API_TIMEOUT_MS) {
  const token = explicitToken ?? getAccessToken();
  if (!token) {
    throw new Error("Not signed in");
  }
  return requestWithToken<{
    success: boolean;
    user: {
      id: string;
      email: string;
      name: string | null;
      role: string;
      clientId: string | null;
      plan?: string | null;
    };
    instagramConnected: boolean;
    plan?: string;
  }>("/auth/me", token, { timeoutMs });
}

export function setSessionMemory(accessToken: string | null): void {
  setAccessTokenMem(accessToken);
  notifyAccessTokenChanged();
}
