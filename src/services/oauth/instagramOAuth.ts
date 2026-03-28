import type { PageAccount } from "./metaOAuth";

const GRAPH = "https://graph.facebook.com/v19.0";

export async function getInstagramBusinessAccount(
  pageAccessToken: string,
  pageId: string
): Promise<{ instagramUserId: string; username: string | null }> {
  const url = `${GRAPH}/${pageId}?${new URLSearchParams({
    fields: "instagram_business_account{id,username}",
    access_token: pageAccessToken
  }).toString()}`;
  const data = await fetchJson<{
    instagram_business_account?: { id: string; username?: string };
  }>(url);
  const ig = data.instagram_business_account;
  if (!ig?.id) {
    throw new Error("No Instagram business account linked to this Facebook Page.");
  }
  return { instagramUserId: ig.id, username: ig.username ?? null };
}

export function pickPageForInstagram(pages: PageAccount[]): PageAccount | undefined {
  return pages.find((p) => p.instagram_business_account?.id);
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) {
    const err = payload.error as { message?: string } | undefined;
    throw new Error(err?.message ?? response.statusText);
  }
  return payload as T;
}
