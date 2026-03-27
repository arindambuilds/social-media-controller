import { env } from "../config/env";

export type InstagramExchangeResult = {
  accessToken: string;
  refreshToken: null;
  expiresAt: Date | null;
  instagramBusinessAccountId: string;
  instagramUsername: string;
  pageId: string;
  pageName: string;
};

type FacebookTokenResponse = {
  access_token: string;
  token_type: string;
  expires_in?: number;
};

type FacebookPagesResponse = {
  data: Array<{
    id: string;
    name: string;
    instagram_business_account?: {
      id: string;
      username?: string;
    };
  }>;
};

export async function exchangeInstagramCode(
  code: string,
  redirectUri = env.INSTAGRAM_REDIRECT_URI
): Promise<InstagramExchangeResult> {
  const clientId = env.INSTAGRAM_APP_ID || env.FACEBOOK_APP_ID;
  const clientSecret = env.INSTAGRAM_APP_SECRET || env.FACEBOOK_APP_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("Instagram app credentials are missing.");
  }

  const shortLived = await fetchJson<FacebookTokenResponse>(
    `https://graph.facebook.com/v19.0/oauth/access_token?${new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      code
    }).toString()}`
  );

  const longLived = await fetchJson<FacebookTokenResponse>(
    `https://graph.facebook.com/v19.0/oauth/access_token?${new URLSearchParams({
      grant_type: "fb_exchange_token",
      client_id: clientId,
      client_secret: clientSecret,
      fb_exchange_token: shortLived.access_token
    }).toString()}`
  );

  const pages = await fetchJson<FacebookPagesResponse>(
    `https://graph.facebook.com/v19.0/me/accounts?${new URLSearchParams({
      fields: "id,name,instagram_business_account{id,username}",
      access_token: longLived.access_token
    }).toString()}`
  );

  const page = pages.data.find((entry) => entry.instagram_business_account?.id);
  if (!page?.instagram_business_account?.id) {
    throw new Error("No Instagram business account found on the connected Meta account.");
  }

  return {
    accessToken: longLived.access_token,
    refreshToken: null,
    expiresAt: longLived.expires_in ? new Date(Date.now() + longLived.expires_in * 1000) : null,
    instagramBusinessAccountId: page.instagram_business_account.id,
    instagramUsername: page.instagram_business_account.username ?? page.name,
    pageId: page.id,
    pageName: page.name
  };
}

export async function refreshInstagramLongLivedToken(accessToken: string) {
  const refreshed = await fetchJson<{ access_token: string; expires_in: number }>(
    `https://graph.instagram.com/refresh_access_token?${new URLSearchParams({
      grant_type: "ig_refresh_token",
      access_token: accessToken
    }).toString()}`
  );

  return {
    accessToken: refreshed.access_token,
    expiresAt: new Date(Date.now() + refreshed.expires_in * 1000)
  };
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    headers: {
      Accept: "application/json"
    }
  });

  const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) {
    const errorObject = payload.error as { message?: string } | undefined;
    throw new Error(errorObject?.message ?? response.statusText);
  }

  return payload as T;
}
