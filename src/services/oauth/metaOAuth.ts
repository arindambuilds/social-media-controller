import { env } from "../../config/env";

const GRAPH = "https://graph.facebook.com/v19.0";

export const META_SCOPES_DEFAULT =
  "pages_manage_posts,pages_read_engagement,instagram_basic,instagram_content_publish,pages_show_list,business_management";

function appId(): string {
  return env.META_APP_ID || env.FACEBOOK_APP_ID || env.INSTAGRAM_APP_ID || "";
}

function appSecret(): string {
  return env.META_APP_SECRET || env.FACEBOOK_APP_SECRET || env.INSTAGRAM_APP_SECRET || "";
}

export function buildAuthUrl(state: string, redirectUri: string, scopes = META_SCOPES_DEFAULT): string {
  const id = appId();
  if (!id) {
    throw new Error("META_APP_ID (or FACEBOOK_APP_ID / INSTAGRAM_APP_ID) is not configured.");
  }
  const params = new URLSearchParams({
    client_id: id,
    redirect_uri: redirectUri,
    state,
    response_type: "code",
    scope: scopes
  });
  return `https://www.facebook.com/v19.0/dialog/oauth?${params.toString()}`;
}

export async function exchangeCode(
  code: string,
  redirectUri: string
): Promise<{ accessToken: string; expiresIn?: number }> {
  const id = appId();
  const secret = appSecret();
  if (!id || !secret) {
    throw new Error("Meta app credentials are missing.");
  }
  const url = `${GRAPH}/oauth/access_token?${new URLSearchParams({
    client_id: id,
    client_secret: secret,
    redirect_uri: redirectUri,
    code
  }).toString()}`;
  const data = await fetchJson<{ access_token: string; expires_in?: number }>(url);
  return { accessToken: data.access_token, expiresIn: data.expires_in };
}

export async function getLongLivedToken(shortToken: string): Promise<{ accessToken: string; expiresIn?: number }> {
  const id = appId();
  const secret = appSecret();
  if (!id || !secret) {
    throw new Error("Meta app credentials are missing.");
  }
  const url = `${GRAPH}/oauth/access_token?${new URLSearchParams({
    grant_type: "fb_exchange_token",
    client_id: id,
    client_secret: secret,
    fb_exchange_token: shortToken
  }).toString()}`;
  const data = await fetchJson<{ access_token: string; expires_in?: number }>(url);
  return { accessToken: data.access_token, expiresIn: data.expires_in };
}

export async function getAccountInfo(accessToken: string): Promise<{ id: string; name?: string; picture?: unknown }> {
  const url = `${GRAPH}/me?${new URLSearchParams({
    fields: "id,name,picture",
    access_token: accessToken
  }).toString()}`;
  return fetchJson(url);
}

export type PageAccount = {
  id: string;
  name: string;
  access_token: string;
  instagram_business_account?: { id: string; username?: string };
};

export async function listPagesWithTokens(userAccessToken: string): Promise<PageAccount[]> {
  const url = `${GRAPH}/me/accounts?${new URLSearchParams({
    fields: "id,name,access_token,instagram_business_account{id,username}",
    access_token: userAccessToken
  }).toString()}`;
  const data = await fetchJson<{ data: PageAccount[] }>(url);
  return data.data ?? [];
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
