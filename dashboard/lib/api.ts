const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000/api";

export type AnalyticsSummary = {
  postsAnalyzed: number;
  averageEngagementRate: number;
  topHours: Array<{ hour: number; avgEngagementRate: number }>;
  captionPerformance: Array<{ bucket: string; avgEngagementRate: number }>;
  topPosts: Array<{ id: string; caption: string; engagementRate: number; publishedAt: string | Date }>;
  worstPosts: Array<{ id: string; caption: string; engagementRate: number; publishedAt: string | Date }>;
};

async function request<T>(path: string, token: string, init?: RequestInit): Promise<T> {
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
    return request<AnalyticsSummary>(`/analytics/instagram/${clientId}/summary`, token);
  },
  generateInsight(clientId: string, token: string) {
    return request(`/ai/insights/content-performance/${clientId}`, token, {
      method: "POST"
    });
  },
  generateWeeklyRecommendation(clientId: string, token: string) {
    return request(`/ai/recommendations/weekly/${clientId}`, token, {
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
    return request<{ prompt: string; captions: string[] }>("/ai/captions/generate", token, {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },
  startInstagramAuth(clientId: string, token: string) {
    return request<{ state: string; authUrl: string }>("/social-accounts/instagram/start", token, {
      method: "POST",
      body: JSON.stringify({ clientId })
    });
  }
};
