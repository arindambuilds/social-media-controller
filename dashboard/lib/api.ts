import { CLIENT_ID_KEY, TOKEN_KEY } from "./auth-storage";

/** API origin without `/api` — set `NEXT_PUBLIC_API_URL` in Vercel / `.env.local` (localhost fallback is dev only). */
export const API_ORIGIN = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
export const API_BASE_URL = `${API_ORIGIN}/api`;

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

/** Parse API error payloads (string `error` or nested `{ error: { message, fieldErrors } }`). */
export function parseApiErrorMessage(body: unknown): string {
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

export async function apiRequestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await apiFetch(path, init);
  const text = await res.text();
  let parsed: unknown = {};
  try {
    parsed = text ? JSON.parse(text) : {};
  } catch {
    parsed = {};
  }
  if (!res.ok) {
    throw new Error(parseApiErrorMessage(parsed) || `HTTP ${res.status}`);
  }
  return parsed as T;
}

export async function apiFetch(path: string, options?: RequestInit) {
  const token = typeof window !== "undefined" ? localStorage.getItem(TOKEN_KEY) : "";
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token ?? ""}`,
      ...(options?.headers ?? {})
    },
    cache: "no-store"
  });

  if (
    typeof window !== "undefined" &&
    res.status === 401 &&
    token &&
    !path.startsWith("/auth/login")
  ) {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(CLIENT_ID_KEY);
    window.location.assign("/login");
  }

  return res;
}

async function requestWithToken<T>(path: string, token: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(init?.headers ?? {})
    },
    cache: "no-store"
  });
  if (!response.ok) {
    const text = await response.text();
    let parsed: unknown = {};
    try {
      parsed = text ? JSON.parse(text) : {};
    } catch {
      parsed = {};
    }
    throw new Error(parseApiErrorMessage(parsed) || text || `Request failed: ${response.status}`);
  }
  return response.json() as Promise<T>;
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
