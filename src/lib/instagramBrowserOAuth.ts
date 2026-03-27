import { z } from "zod";
import { env } from "../config/env";
import { issueOAuthState } from "../services/oauthStateStore";

export async function buildInstagramBrowserOAuthUrl(input: {
  role: string;
  userId: string;
  clientIdFromToken?: string;
  query: Record<string, unknown>;
}): Promise<{ ok: true; url: string } | { ok: false; status: number; message: string }> {
  let clientId: string;
  if (input.role === "AGENCY_ADMIN") {
    const q = z.object({ clientId: z.string().min(1) }).safeParse(input.query);
    if (!q.success) {
      return { ok: false, status: 400, message: "Missing clientId query parameter." };
    }
    clientId = q.data.clientId;
  } else {
    if (!input.clientIdFromToken) {
      return { ok: false, status: 400, message: "No client assigned to this account." };
    }
    clientId = input.clientIdFromToken;
  }

  const appId = env.INSTAGRAM_APP_ID || env.FACEBOOK_APP_ID;
  if (!appId) {
    return { ok: false, status: 503, message: "Instagram OAuth is not configured (missing app id)." };
  }

  const state = await issueOAuthState({
    clientId,
    platform: "INSTAGRAM",
    initiatedBy: input.userId
  });

  const redirectUri = env.INSTAGRAM_FRONTEND_REDIRECT_URI;
  const url = `https://www.facebook.com/v19.0/dialog/oauth?${new URLSearchParams({
    client_id: appId,
    redirect_uri: redirectUri,
    state,
    response_type: "code",
    scope: "instagram_basic,instagram_manage_insights,pages_show_list,business_management"
  }).toString()}`;

  return { ok: true, url };
}
