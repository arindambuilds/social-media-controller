import { env } from "../config/env";
import { logger } from "../lib/logger";

/**
 * Sends an Instagram DM via the Messenger-compatible Graph API (page access token).
 * Never throws; logs errors and returns false on failure.
 */
export async function sendInstagramDm(
  recipientIgId: string,
  message: string,
  pageAccessToken: string
): Promise<boolean> {
  if (env.INSTAGRAM_MOCK_MODE === true) {
    logger.info("[DM Mock] Would send", { recipientIgId, message });
    return true;
  }

  const token = pageAccessToken?.trim();
  if (!token) {
    logger.warn("[instagramSender] skipped: empty page access token");
    return false;
  }

  try {
    const url = "https://graph.facebook.com/v18.0/me/messages";
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        recipient: { id: recipientIgId },
        message: { text: message }
      })
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      logger.warn("[instagramSender] Graph API error", {
        status: res.status,
        body: errText.slice(0, 500)
      });
      return false;
    }

    return true;
  } catch (err) {
    logger.warn("[instagramSender] request failed", {
      message: err instanceof Error ? err.message : String(err)
    });
    return false;
  }
}
