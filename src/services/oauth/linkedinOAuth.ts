import { env } from "../../config/env";

const AUTH = "https://www.linkedin.com/oauth/v2/authorization";
const TOKEN = "https://www.linkedin.com/oauth/v2/accessToken";

const DEFAULT_SCOPES = "r_liteprofile,r_emailaddress,w_member_social";

export function buildAuthUrl(state: string, redirectUri: string, scopes = DEFAULT_SCOPES): string {
  if (!env.LINKEDIN_CLIENT_ID) {
    throw new Error("LINKEDIN_CLIENT_ID is not configured.");
  }
  const params = new URLSearchParams({
    response_type: "code",
    client_id: env.LINKEDIN_CLIENT_ID,
    redirect_uri: redirectUri,
    state,
    scope: scopes
  });
  return `${AUTH}?${params.toString()}`;
}

export async function exchangeCode(
  code: string,
  redirectUri: string
): Promise<{ accessToken: string; expiresIn?: number; refreshToken?: string }> {
  if (!env.LINKEDIN_CLIENT_ID || !env.LINKEDIN_CLIENT_SECRET) {
    throw new Error("LinkedIn OAuth credentials are missing.");
  }
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
    client_id: env.LINKEDIN_CLIENT_ID,
    client_secret: env.LINKEDIN_CLIENT_SECRET
  });
  const res = await fetch(TOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body
  });
  const payload = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const msg = (payload as { error_description?: string }).error_description ?? res.statusText;
    throw new Error(msg);
  }
  const accessToken = payload.access_token as string;
  const expiresIn = payload.expires_in as number | undefined;
  const refreshToken = payload.refresh_token as string | undefined;
  return { accessToken, expiresIn, refreshToken };
}

export async function refreshAccessToken(refreshToken: string): Promise<{
  accessToken: string;
  refreshToken?: string;
  expiresIn?: number;
}> {
  if (!env.LINKEDIN_CLIENT_ID || !env.LINKEDIN_CLIENT_SECRET) {
    throw new Error("LinkedIn OAuth credentials are missing.");
  }
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: env.LINKEDIN_CLIENT_ID,
    client_secret: env.LINKEDIN_CLIENT_SECRET
  });
  const res = await fetch(TOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body
  });
  const payload = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const msg = (payload as { error_description?: string }).error_description ?? res.statusText;
    throw new Error(msg);
  }
  return {
    accessToken: payload.access_token as string,
    refreshToken: (payload.refresh_token as string) ?? refreshToken,
    expiresIn: payload.expires_in as number | undefined
  };
}

export async function getProfile(accessToken: string): Promise<{ id: string; localizedFirstName?: string }> {
  const res = await fetch("https://api.linkedin.com/v2/me", {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  const payload = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    throw new Error((payload as { message?: string }).message ?? res.statusText);
  }
  return payload as { id: string; localizedFirstName?: string };
}
