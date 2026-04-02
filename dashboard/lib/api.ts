import { clearAuthStorage, notifyAuthStorageSync, REFRESH_TOKEN_KEY, TOKEN_KEY } from "./auth-storage";

/** Default request timeout (ms). Login uses a longer override for Render cold starts. */
export const DEFAULT_API_TIMEOUT_MS = 10_000;

if (typeof window !== "undefined" && process.env.NODE_ENV === "production") {
  const v = process.env.NEXT_PUBLIC_API_URL;
  if (v == null || String(v).trim() === "") {
    throw new Error(
      "NEXT_PUBLIC_API_URL is missing. Set it in Vercel (e.g. https://your-api.onrender.com — origin only, no /api)."
    );
  }
}

const raw = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000").replace(/\/$/, "");

/** Base URL for `/api/*` routes — always ends with `/api` (append paths like `/auth/login`). */
export const API_URL = raw.endsWith("/api") ? raw : `${raw}/api`;

/** Origin without `/api` — for `/health`, `/auth/instagram`, etc. */
export const API_ORIGIN = API_URL.replace(/\/api$/, "");

/** @deprecated Use API_URL / API_ORIGIN */
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

function nestedErrorMessage(body: unknown): string | undefined {
  if (!body || typeof body !== "object") return undefined;
  const b = body as { error?: unknown };
  if (typeof b.error === "string") return b.error;
  if (b.error && typeof b.error === "object" && "message" in b.error) {
    const m = (b.error as { message?: string }).message;
    if (typeof m === "string") return m;
  }
  return undefined;
}

function friendlyHttpMessage(status: number, parsedBody: unknown, fallback: string): string {
  const nested = nestedErrorMessage(parsedBody);
  if (nested && nested.trim().length > 0 && !/^HTTP \d+$/.test(nested)) {
    return nested;
  }
  if (status === 401) return "Please log in again.";
  if (status === 403) return "You do not have access to this.";
  if (status === 429) {
    return "You have sent too many requests. Please wait a few minutes and try again.";
  }
  if (status >= 500) return "Something went wrong. Please try again.";
  return fallback;
}

/** Parse API error payloads (string `error` or nested `{ error: { message, fieldErrors } }`). */
async function readResponseJson(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return {};
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { _raw: text };
  }
}

export function parseApiErrorMessage(body: unknown): string {
  const nested = nestedErrorMessage(body);
  if (nested) return nested;
  if (!body || typeof body !== "object") return "Request failed";
  const b = body as Record<string, unknown>;
  if (typeof b.error === "string") return b.error;
  if (b.error && typeof b.error === "object") {
    const e = b.error as { message?: string; fieldErrors?: Record<string, string[] | undefined> };
    if (typeof e.message === "string") return e.message;
    if (e.fieldErrors && Object.keys(e.fieldErrors).length) {
      return Object.entries(e.fieldErrors)
        .flatMap(([k, arr]) => (arr ?? []).map((x) => `${k}: ${x}`))
        .join("; ");
    }
  }
  return "Request failed";
}

type ApiFetchInit = RequestInit & { timeoutMs?: number };

function isLoginPost(path: string, init?: ApiFetchInit): boolean {
  const p = path.startsWith("/") ? path : `/${path}`;
  const method = (init?.method ?? "GET").toUpperCase();
  return method === "POST" && p.startsWith("/auth/login");
}

function isRefreshPost(path: string, init?: ApiFetchInit): boolean {
  const p = path.startsWith("/") ? path : `/${path}`;
  const method = (init?.method ?? "GET").toUpperCase();
  return method === "POST" && (p === "/auth/refresh" || p.startsWith("/auth/refresh"));
}

let refreshInFlight: Promise<string | null> | null = null;

/** Exchange refresh token for new access (+ refresh). Returns new access or null. */
async function tryRefreshTokens(): Promise<string | null> {
  if (typeof window === "undefined") return null;
  const rt = localStorage.getItem(REFRESH_TOKEN_KEY);
  if (!rt) return null;
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      try {
        const res = await fetchWithTimeout(
          `${API_URL}/auth/refresh`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ refreshToken: rt })
          },
          Math.max(DEFAULT_API_TIMEOUT_MS, 25_000)
        );
        const body = await readResponseJson(res);
        if (!res.ok) return null;
        const access = (body as { accessToken?: string }).accessToken;
        const nextRt = (body as { refreshToken?: string }).refreshToken;
        if (!access) return null;
        localStorage.setItem(TOKEN_KEY, access);
        if (nextRt) localStorage.setItem(REFRESH_TOKEN_KEY, nextRt);
        notifyAuthStorageSync();
        return access;
      } catch {
        return null;
      } finally {
        refreshInFlight = null;
      }
    })();
  }
  return refreshInFlight;
}

function forceLogoutToLogin(): void {
  if (typeof window === "undefined") return;
  clearAuthStorage();
  window.location.assign("/login");
}

function mapAbortToTimeout(err: unknown): Error {
  if (err instanceof Error && (err.name === "AbortError" || /abort/i.test(err.message))) {
    return new Error("Request timed out. The API may be waking up—wait up to a minute and try again.");
  }
  return err instanceof Error ? err : new Error(String(err));
}

async function fetchWithTimeout(url: string, init: ApiFetchInit | undefined, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  const parent = init?.signal;
  if (parent) {
    if (parent.aborted) controller.abort();
    else parent.addEventListener("abort", () => controller.abort(), { once: true });
  }
  const { timeoutMs: _timeoutIgnored, signal: _signalIgnored, ...passThrough } = init ?? {};
  void _timeoutIgnored;
  void _signalIgnored;
  try {
    return await fetch(url, {
      ...passThrough,
      signal: controller.signal,
      credentials: passThrough.credentials ?? "include"
    });
  } catch (e) {
    throw mapAbortToTimeout(e);
  } finally {
    clearTimeout(t);
  }
}

/** Clears httpOnly auth cookies when the API has AUTH_HTTPONLY_COOKIES enabled. */
export function authLogoutFireAndForget(): void {
  if (typeof window === "undefined") return;
  void fetchWithTimeout(
    `${API_URL}/auth/logout`,
    { method: "POST", headers: { "Content-Type": "application/json" } },
    DEFAULT_API_TIMEOUT_MS
  ).catch(() => {});
}

/**
 * JSON API helper: `${API_URL}${path}`. Throws on non-OK with `body?.error?.message` when present.
 * Omits `Authorization` on `POST /auth/login`. On 401, attempts refresh once then retries.
 */
export async function apiFetch<T = unknown>(path: string, options?: ApiFetchInit): Promise<T> {
  let token = typeof window !== "undefined" ? localStorage.getItem(TOKEN_KEY) : null;
  const p = path.startsWith("/") ? path : `/${path}`;
  const skipAuth = isLoginPost(p, options) || isRefreshPost(p, options);
  const timeoutMs = options?.timeoutMs ?? DEFAULT_API_TIMEOUT_MS;
  const url = `${API_URL}${p}`;

  const doFetch = (bearer: string | null) =>
    fetchWithTimeout(
      url,
      {
        ...options,
        headers: {
          "Content-Type": "application/json",
          ...(bearer && !skipAuth ? { Authorization: `Bearer ${bearer}` } : {}),
          ...options?.headers
        },
        cache: "no-store"
      },
      timeoutMs
    );

  let res = await doFetch(skipAuth ? null : token);
  let body = await readResponseJson(res);

  if (
    res.status === 401 &&
    typeof window !== "undefined" &&
    token &&
    !skipAuth &&
    !p.includes("/auth/login")
  ) {
    const next = await tryRefreshTokens();
    if (next) {
      token = next;
      res = await doFetch(next);
      body = await readResponseJson(res);
    }
  }

  if (!res.ok) {
    if (typeof window !== "undefined" && res.status === 401 && !skipAuth && !p.includes("/auth/login")) {
      forceLogoutToLogin();
    }
    const raw =
      body && typeof body === "object" && "_raw" in body && typeof (body as { _raw: string })._raw === "string"
        ? (body as { _raw: string })._raw.slice(0, 200)
        : undefined;
    const fallback = parseApiErrorMessage(body) ?? raw ?? `HTTP ${res.status}`;
    const msg = friendlyHttpMessage(res.status, body, fallback);
    throw new Error(msg);
  }

  return body as T;
}

/**
 * Multipart upload (e.g. voice clip) — does not set Content-Type so the browser sets the boundary.
 * Client-only. Retries once on 401 after refresh, like `apiFetch`.
 */
export async function apiFetchFormData<T = unknown>(
  path: string,
  formData: FormData,
  options?: { timeoutMs?: number }
): Promise<T> {
  if (typeof window === "undefined") {
    throw new Error("apiFetchFormData is only available in the browser.");
  }
  let token = localStorage.getItem(TOKEN_KEY);
  const p = path.startsWith("/") ? path : `/${path}`;
  const timeoutMs = options?.timeoutMs ?? 60_000;
  const url = `${API_URL}${p}`;

  const doFetch = (bearer: string | null) =>
    fetchWithTimeout(
      url,
      {
        method: "POST",
        headers: bearer ? { Authorization: `Bearer ${bearer}` } : {},
        body: formData,
        credentials: "include"
      },
      timeoutMs
    );

  let res = await doFetch(token);
  let body = await readResponseJson(res);

  if (res.status === 401 && token && !p.includes("/auth/login")) {
    const next = await tryRefreshTokens();
    if (next) {
      token = next;
      res = await doFetch(next);
      body = await readResponseJson(res);
    }
  }

  if (!res.ok) {
    if (res.status === 401 && !p.includes("/auth/login")) {
      forceLogoutToLogin();
    }
    const fallback = parseApiErrorMessage(body) ?? `HTTP ${res.status}`;
    throw new Error(friendlyHttpMessage(res.status, body, fallback));
  }

  return body as T;
}

/** Same URL/auth as apiFetch but returns the raw `Response` (e.g. 429 handling). */
export async function apiFetchResponse(path: string, options?: ApiFetchInit): Promise<Response> {
  let token = typeof window !== "undefined" ? localStorage.getItem(TOKEN_KEY) : null;
  const p = path.startsWith("/") ? path : `/${path}`;
  const skipAuth = isLoginPost(p, options) || isRefreshPost(p, options);
  const timeoutMs = options?.timeoutMs ?? DEFAULT_API_TIMEOUT_MS;
  const url = `${API_URL}${p}`;

  const doFetch = (bearer: string | null) =>
    fetchWithTimeout(
      url,
      {
        ...options,
        headers: {
          "Content-Type": "application/json",
          ...(bearer && !skipAuth ? { Authorization: `Bearer ${bearer}` } : {}),
          ...options?.headers
        },
        cache: "no-store"
      },
      timeoutMs
    );

  let res = await doFetch(skipAuth ? null : token);

  if (
    res.status === 401 &&
    typeof window !== "undefined" &&
    token &&
    !skipAuth &&
    !p.includes("/auth/login")
  ) {
    const next = await tryRefreshTokens();
    if (next) {
      token = next;
      res = await doFetch(next);
    }
  }

  if (res.status === 401 && typeof window !== "undefined" && !skipAuth && !p.includes("/auth/login")) {
    forceLogoutToLogin();
  }

  return res;
}

export async function apiRequestJson<T>(path: string, init?: ApiFetchInit): Promise<T> {
  return apiFetch<T>(path, init);
}

async function requestWithToken<T>(path: string, token: string, init?: ApiFetchInit): Promise<T> {
  const p = path.startsWith("/") ? path : `/${path}`;
  const timeoutMs = init?.timeoutMs ?? DEFAULT_API_TIMEOUT_MS;
  const url = `${API_URL}${p}`;

  const run = (t: string) =>
    fetchWithTimeout(
      url,
      {
        ...init,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${t}`,
          ...init?.headers
        },
        cache: "no-store"
      },
      timeoutMs
    );

  let response = await run(token);
  if (response.status === 401 && typeof window !== "undefined") {
    const next = await tryRefreshTokens();
    if (next) response = await run(next);
  }

  const parsed = await readResponseJson(response);
  if (!response.ok) {
    if (response.status === 401 && typeof window !== "undefined") {
      forceLogoutToLogin();
    }
    const raw =
      parsed && typeof parsed === "object" && "_raw" in parsed && typeof (parsed as { _raw: string })._raw === "string"
        ? (parsed as { _raw: string })._raw.slice(0, 200)
        : undefined;
    const fb = parseApiErrorMessage(parsed) || raw || `Request failed: ${response.status}`;
    throw new Error(friendlyHttpMessage(response.status, parsed, fb));
  }
  return parsed as T;
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
    return requestWithToken(`/ai/recommendations/weekly/${clientId}`, token, {
      method: "POST"
    });
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
  const tok =
    explicitToken ??
    (typeof window !== "undefined" ? localStorage.getItem(TOKEN_KEY) : null);
  if (!tok) {
    throw new Error("Not signed in");
  }
  return requestWithToken<{
    success: boolean;
    user: { id: string; email: string; name: string | null; role: string; clientId: string | null };
    instagramConnected: boolean;
  }>("/auth/me", tok, { timeoutMs });
}
