import { CLIENT_ID_KEY, TOKEN_KEY } from "./auth-storage";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
export const API_BASE_URL = `${API}/api`;

export type AnalyticsSummary = {
  success?: boolean;
  postsAnalyzed: number;
  averageEngagementRate: number;
  bestPostingHour: number | null;
  captionWinner: string;
  topHours: number[];
  captionPerformance: { avgLikes: number; avgComments: number; avgShares: number };
  topPosts: Array<{ id: string; content?: string | null; platformPostId: string }>;
  worstPosts: Array<{ id: string; content?: string | null; platformPostId: string }>;
};

export type CaptionCard = {
  hook: string;
  body: string;
  cta: string;
  hashtags: string[];
};

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
    throw new Error(text || `Request failed: ${response.status}`);
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
