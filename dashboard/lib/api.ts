import { CLIENT_ID_KEY, TOKEN_KEY } from "./auth-storage";

const raw = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api").replace(/\/$/, "");

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

function isLoginPost(path: string, init?: RequestInit): boolean {
  const p = path.startsWith("/") ? path : `/${path}`;
  const method = (init?.method ?? "GET").toUpperCase();
  return method === "POST" && p.startsWith("/auth/login");
}

/**
 * JSON API helper: `${API_URL}${path}`. Throws on non-OK with `body?.error?.message` when present.
 * Omits `Authorization` on `POST /auth/login`.
 */
export async function apiFetch<T = unknown>(path: string, options?: RequestInit): Promise<T> {
  const token = typeof window !== "undefined" ? localStorage.getItem(TOKEN_KEY) : null;
  const p = path.startsWith("/") ? path : `/${path}`;
  const skipAuth = isLoginPost(p, options);

  const res = await fetch(`${API_URL}${p}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token && !skipAuth ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers
    },
    cache: "no-store"
  });

  const body = await readResponseJson(res);

  if (!res.ok) {
    if (
      typeof window !== "undefined" &&
      res.status === 401 &&
      token &&
      !p.includes("/auth/login")
    ) {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(CLIENT_ID_KEY);
      window.location.assign("/login");
    }
    const raw =
      body && typeof body === "object" && "_raw" in body && typeof (body as { _raw: string })._raw === "string"
        ? (body as { _raw: string })._raw.slice(0, 200)
        : undefined;
    const msg =
      nestedErrorMessage(body) ??
      parseApiErrorMessage(body) ??
      raw ??
      `HTTP ${res.status}`;
    throw new Error(msg);
  }

  return body as T;
}

/** Same URL/auth as apiFetch but returns the raw `Response` (e.g. 429 handling). */
export async function apiFetchResponse(path: string, options?: RequestInit): Promise<Response> {
  const token = typeof window !== "undefined" ? localStorage.getItem(TOKEN_KEY) : null;
  const p = path.startsWith("/") ? path : `/${path}`;
  const skipAuth = isLoginPost(p, options);

  return fetch(`${API_URL}${p}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token && !skipAuth ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers
    },
    cache: "no-store"
  });
}

export async function apiRequestJson<T>(path: string, init?: RequestInit): Promise<T> {
  return apiFetch<T>(path, init);
}

async function requestWithToken<T>(path: string, token: string, init?: RequestInit): Promise<T> {
  const p = path.startsWith("/") ? path : `/${path}`;
  const response = await fetch(`${API_URL}${p}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...init?.headers
    },
    cache: "no-store"
  });
  const parsed = await readResponseJson(response);
  if (!response.ok) {
    const raw =
      parsed && typeof parsed === "object" && "_raw" in parsed && typeof (parsed as { _raw: string })._raw === "string"
        ? (parsed as { _raw: string })._raw.slice(0, 200)
        : undefined;
    throw new Error(parseApiErrorMessage(parsed) || raw || `Request failed: ${response.status}`);
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
      body: JSON.stringify({ platform: "INSTAGRAM" })
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

export async function fetchMe(token: string) {
  return requestWithToken<{
    success: boolean;
    user: { id: string; email: string; name: string | null; role: string; clientId: string | null };
    instagramConnected: boolean;
  }>("/auth/me", token);
}
